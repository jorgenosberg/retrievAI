import streamlit as st
import hashlib
from pathlib import Path
from retrievai.ingest import LOADER_MAPPING, safe_load_single_document, persist_directory
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter

from retrievai.utils.settings_tools import load_session_state
from retrievai.utils.vectorstore_tools import get_vectorstore, create_vectorstore_from_documents

# Define directories
documents_directory = Path("documents")
settings_directory = Path(".retrievai")
hashes_file = settings_directory / "file_hashes.txt"
persist_directory = Path(st.session_state["vectorstore"]["directory"])

load_session_state()

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
def save_file_to_documents(file, file_hash: str):
    documents_directory.mkdir(parents=True, exist_ok=True)
    file_path = documents_directory / file.name
    with open(file_path, "wb") as f:
        f.write(file.read())
    save_file_hash(file_hash)
    return file_path

# Split documents into chunks
def split_documents(documents, chunk_size, chunk_overlap):
    st.info("Splitting documents into chunks...")
    progress_bar = st.progress(0)
    total_docs = len(documents)
    chunks = []

    # Split documents
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
        progress_bar.progress(i / total_docs)

    st.success(f"Split {total_docs} documents into {len(chunks)} chunks.")
    return chunks

# Ingest documents with progress tracking
def ingest_documents(source_dir: Path, ignored_hashes: set):
    st.info("Starting document ingestion process...")
    progress_bar = st.progress(0)
    status_text = st.empty()

    all_files = list(source_dir.rglob("*"))
    total_files = len(all_files)
    documents = []

    if not all_files:
        st.error("No files to ingest.")
        return

    # Load documents
    st.info("Loading documents...")
    for i, file_path in enumerate(all_files, start=1):
        file_hash = compute_file_hash(open(file_path, "rb"))
        if file_hash in ignored_hashes:
            st.info(f"Skipping already ingested file: {file_path.name}")
            continue
        docs = safe_load_single_document(file_path)
        if docs:
            documents.extend(docs)
        progress_bar.progress(i / total_files)

    if not documents:
        st.warning("No new documents to process.")
        return

    # Split documents into chunks
    chunk_size = st.secrets["CHUNK_SIZE"]
    chunk_overlap = st.secrets["CHUNK_OVERLAP"]
    chunks = split_documents(documents, chunk_size, chunk_overlap)

    # Add chunks to vectorstore
    st.info("Adding chunks to vectorstore...")
    if (persist_directory / "chroma.sqlite3").exists():
        st.info("Appending to existing vectorstore...")
        db = get_vectorstore()
        db.add_documents(chunks)
    else:
        st.info("Creating new vectorstore...")
        create_vectorstore_from_documents(chunks)

    st.success(f"Ingested {len(chunks)} chunks into the vectorstore.")

# Streamlit App Layout
st.header("Document Ingestion")

# Load existing file hashes
existing_hashes = load_existing_hashes()

# File upload section
uploaded_files = st.file_uploader(
    "Upload your documents",
    accept_multiple_files=True,
    type=list(LOADER_MAPPING.keys()),
    help="Accepted file types: " + ", ".join(LOADER_MAPPING.keys()),
)

# Trigger ingestion
if st.button("Start Ingestion"):
    new_files_saved = 0

    # Save files and compute new hashes
    for file in uploaded_files:
        file_hash = compute_file_hash(file)
        if file_hash in existing_hashes:
            st.info(f"Skipping already saved file: {file.name}")
            continue
        save_file_to_documents(file, file_hash)
        st.success(f"Saved {file.name} to the documents folder!")
        new_files_saved += 1

    if new_files_saved > 0:
        st.info(f"Saved {new_files_saved} new files. Starting ingestion...")
        ingest_documents(documents_directory, existing_hashes)
    else:
        st.warning("No new files to process.")
