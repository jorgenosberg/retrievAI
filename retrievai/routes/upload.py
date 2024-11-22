import streamlit as st
import hashlib
from pathlib import Path
from retrievai.ingest import LOADER_MAPPING, safe_load_single_document, persist_directory
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter

from retrievai.utils.settings_tools import load_session_state
from retrievai.utils.vectorstore_tools import get_vectorstore, create_vectorstore_from_documents

load_session_state()

# Define directories
documents_directory = Path("documents")
settings_directory = Path(".retrievai")
hashes_file = settings_directory / "file_hashes.txt"
persist_directory = Path(st.session_state["vectorstore"]["directory"])

# Helper function to compute file hash
def compute_file_hash(file) -> str:
    hasher = hashlib.md5()
    for chunk in iter(lambda: file.read(4096), b""):
        hasher.update(chunk)
    file.seek(0)  # Reset file pointer after reading
    return hasher.hexdigest()

# Load existing file hashes
def load_existing_hashes() -> set:
    if not hashes_file.exists():
        return set()
    with open(hashes_file, "r") as f:
        return set(line.strip() for line in f.readlines())

# Save a new file hash
def save_file_hash(file_hash: str):
    settings_directory.mkdir(parents=True, exist_ok=True)
    with open(hashes_file, "a") as f:
        f.write(file_hash + "\n")

# Save uploaded files to the documents directory
def save_uploaded_files(files, existing_hashes, sub_progress_bar):
    documents_directory.mkdir(parents=True, exist_ok=True)
    new_files_saved = 0
    total_files = len(files)

    for i, file in enumerate(files, start=1):
        file_hash = compute_file_hash(file)
        if file_hash in existing_hashes:
            continue

        file_path = documents_directory / file.name
        with open(file_path, "wb") as f:
            f.write(file.read())
        save_file_hash(file_hash)

        new_files_saved += 1
        sub_progress_bar.progress(i / total_files, text=f"Saving file {i}/{total_files}...")

    return new_files_saved

# Split documents into chunks
def split_documents(documents, chunk_size, chunk_overlap, sub_progress_bar):
    total_docs = len(documents)
    chunks = []

    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")],
        strip_headers=False,
    )
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    for i, document in enumerate(documents, start=1):
        document_chunks = md_splitter.split_text(document.page_content)
        final_chunks = text_splitter.split_documents(document_chunks)
        for chunk in final_chunks:
            combined_metadata = {**document.metadata, **chunk.metadata}
            chunks.append(Document(page_content=chunk.page_content, metadata=combined_metadata))
        sub_progress_bar.progress(i / total_docs, text=f"Splitting document {i}/{total_docs}...")

    return chunks

# Ingest documents with progress tracking
def ingest_documents(source_dir: Path, ignored_hashes: set, sub_progress_bar, main_progress_bar):
    all_files = list(source_dir.rglob("*"))
    total_files = len(all_files)
    documents = []

    main_progress_bar.progress(0.5, text="Step 2/4: Loading and processing documents...")

    for i, file_path in enumerate(all_files, start=1):
        file_hash = compute_file_hash(open(file_path, "rb"))
        if file_hash in ignored_hashes:
            continue

        docs = safe_load_single_document(file_path)
        if docs:
            documents.extend(docs)
        sub_progress_bar.progress(i / total_files, text=f"Processing file {i}/{total_files}...")

    if not documents:
        return []

    main_progress_bar.progress(0.75, text="Step 3/4: Splitting documents into chunks...")
    chunk_size = st.session_state["embeddings"]["chunk_size"]
    chunk_overlap = st.session_state["embeddings"]["chunk_overlap"]
    chunks = split_documents(documents, chunk_size, chunk_overlap, sub_progress_bar)

    main_progress_bar.progress(1.0, text="Step 4/4: Adding chunks to vectorstore...")
    if (persist_directory / "chroma.sqlite3").exists():
        db = get_vectorstore()
        db.add_documents(chunks)
    else:
        create_vectorstore_from_documents(chunks)

    return chunks

# Streamlit App Layout
st.header("Document Ingestion")

# File upload section
uploaded_files = st.file_uploader(
    "Upload your documents",
    accept_multiple_files=True,
    type=list(LOADER_MAPPING.keys()),
    help="Accepted file types: " + ", ".join(LOADER_MAPPING.keys()),
)

# Trigger ingestion
if st.button("Start Ingestion"):
    # Placeholders for progress bars
    progress_placeholder = st.container()
    with progress_placeholder:
        main_progress_bar = st.progress(0, text="Step 1/4: Initializing...")
        sub_progress_bar = st.progress(0)

    # Load existing file hashes
    existing_hashes = load_existing_hashes()

    main_progress_bar.progress(0.25, text="Step 1/4: Saving uploaded files...")
    new_files_saved = save_uploaded_files(uploaded_files, existing_hashes, sub_progress_bar)

    if new_files_saved > 0:
        new_chunks = ingest_documents(documents_directory, existing_hashes, sub_progress_bar, main_progress_bar)
        main_progress_bar.empty()
        sub_progress_bar.empty()
        st.success(f"Successfully ingested {new_files_saved} files ({len(new_chunks)} chunks).")
    else:
        st.warning("No new files to process.")
