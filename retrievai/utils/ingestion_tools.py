import hashlib
import logging
from os import PathLike
from pathlib import Path
from typing import List

import openai
from langchain_core.documents import Document
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from retrievai.utils.vectorstore_tools import create_vectorstore_from_documents, get_vectorstore
import streamlit as st

from langchain_community.document_loaders import (
    CSVLoader,
    EverNoteLoader,
    TextLoader,
    UnstructuredEPubLoader,
    UnstructuredHTMLLoader,
    UnstructuredMarkdownLoader,
    UnstructuredODTLoader,
    UnstructuredPowerPointLoader,
    UnstructuredWordDocumentLoader,
)
from retrievai.utils.pymupdf4llm_loaders import PyMuPDF4LLMLoader

# Load environment variables
persist_directory = Path(st.session_state["vectorstore"]["directory"])
chunk_size = st.session_state["embeddings"]["chunk_size"]
chunk_overlap = st.session_state["embeddings"]["chunk_overlap"]
OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY

# Define settings
settings_directory = Path(".retrievai")
hashes_file = settings_directory / "file_hashes.txt"

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Map file extensions to document loaders and their arguments
LOADER_MAPPING = {
    ".csv": (CSVLoader, {}),
    ".doc": (UnstructuredWordDocumentLoader, {}),
    ".docx": (UnstructuredWordDocumentLoader, {}),
    ".enex": (EverNoteLoader, {}),
    ".epub": (UnstructuredEPubLoader, {}),
    ".html": (UnstructuredHTMLLoader, {}),
    ".md": (UnstructuredMarkdownLoader, {}),
    ".odt": (UnstructuredODTLoader, {}),
    ".pdf": (PyMuPDF4LLMLoader, {"page_chunks": True, "show_progress": False}),
    ".ppt": (UnstructuredPowerPointLoader, {}),
    ".pptx": (UnstructuredPowerPointLoader, {}),
    ".txt": (TextLoader, {"encoding": "utf8"}),
}

# Helper function to compute file hash
def compute_file_hash(file) -> str:
    hasher = hashlib.md5()
    file.seek(0)  # Ensure the file pointer is at the start
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



def safe_load_single_document(file_path: str | PathLike) -> List[Document] | None:
    """
    Safely load a single document, logging errors for failed files.
    """
    file_path = Path(file_path)
    ext = file_path.suffix
    if ext in LOADER_MAPPING:
        loader_class, loader_args = LOADER_MAPPING[ext]
        try:
            loader = loader_class(str(file_path), **loader_args)
            return loader.load()
        except Exception as e:
            logger.error(f"Failed to load document {file_path}: {e}")
            return None
    else:
        logger.warning(f"Unsupported file type for {file_path}")
        return None



# Process uploaded files directly without saving them
def process_uploaded_files(files, existing_hashes, sub_progress_bar):
    total_files = len(files)
    documents = []

    for i, file in enumerate(files, start=1):
        file_hash = compute_file_hash(file)
        if file_hash in existing_hashes:
            continue

        file_content = file.read()
        file.seek(0)  # Reset file pointer after reading
        docs = safe_load_single_document(file_content)  # Adapt to work with raw content
        if docs:
            documents.extend(docs)

        sub_progress_bar.progress(i / total_files, text=f"Processing file {i}/{total_files}...")

    return documents

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
def ingest_documents(documents, sub_progress_bar, main_progress_bar):
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

#
# def load_documents(source_dir: str | PathLike, ignored_hashes: List[str] = []) -> List[Document]:
#     """
#     Load all documents from the source directory, ignoring duplicates.
#     """
#     source_dir = Path(source_dir)
#     all_files = []
#     for ext in LOADER_MAPPING:
#         all_files.extend(
#             source_dir.rglob(f"**/*{ext}")
#         )
#     filtered_files = [
#         file_path for file_path in all_files
#         if compute_file_hash(file_path) not in ignored_hashes
#     ]
#
#     results = []
#     total_files = len(filtered_files)
#     logger.info(f"Found {total_files} new files to process.")
#
#     with tqdm(total=total_files, desc="Loading documents", unit="file", ncols=80, dynamic_ncols=True,
#               leave=True) as pbar:
#         with Pool(processes=os.cpu_count()) as pool:
#             for docs in pool.imap_unordered(safe_load_single_document, filtered_files):
#                 if docs:
#                     results.extend(docs)
#                 pbar.update()
#     return results
#
#
# def process_documents(ignored_hashes: List[str] = []) -> List[Document]:
#     """
#     Load documents and split them into chunks.
#     """
#     logger.info(f"Loading documents from {source_directory}")
#     documents = load_documents(source_directory, ignored_hashes)
#
#     if not documents:
#         logger.info("No new documents to load.")
#         exit(0)
#
#     total_pages = len(documents)
#     logger.info(f"Loaded {total_pages} routes from {source_directory}")
#
#     # Initialize MarkdownTextSplitter
#     md_splitter = MarkdownHeaderTextSplitter(
#         headers_to_split_on=[("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")],
#         strip_headers=False,
#     )
#     text_splitter = RecursiveCharacterTextSplitter(
#         chunk_size=chunk_size, chunk_overlap=chunk_overlap,
#     )
#
#     # Process chunks with progress bar
#     logger.info("Splitting routes into chunks...")
#
#     chunks = []
#
#     with tqdm(total=total_pages, desc="Splitting routes", unit="page", ncols=80, dynamic_ncols=True, leave=True) as pbar:
#         for document in documents:
#             document_chunks = md_splitter.split_text(document.page_content)
#             final_chunks = text_splitter.split_documents(document_chunks)
#             for chunk in final_chunks:
#                 combined_metadata = {**document.metadata, **chunk.metadata}
#                 chunks.append(Document(page_content=chunk.page_content, metadata=combined_metadata))
#             pbar.update()
#
#     total_chunks = len(chunks)
#     logger.info(f"Split {total_pages} routes into {total_chunks} chunks of text (max. {chunk_size} tokens each).")
#
#     return chunks