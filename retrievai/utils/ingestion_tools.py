import hashlib
import logging
import time
from datetime import datetime
from os import PathLike
from pathlib import Path
from typing import List
import tempfile

import openai
from langchain_core.documents import Document
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from streamlit.runtime.uploaded_file_manager import UploadedFile

from retrievai.utils.vectorstore_tools import create_vectorstore_from_documents, get_vectorstore, does_vectorstore_exist
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
tmp_directory = Path(st.session_state["embeddings"]["tmp_directory"])
chunk_size = st.session_state["embeddings"]["chunk_size"]
chunk_overlap = st.session_state["embeddings"]["chunk_overlap"]
batch_size = st.session_state["embeddings"]["batch_size"]
rate_limit = st.session_state["embeddings"]["rate_limit"]
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
def compute_file_hash(filename: str, identifier: str) -> str:
    hash_input = f"{filename}-{identifier}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()

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




def add_hash_to_chunks(documents: List[Document], file_hash: str) -> List[Document]:
    """
    Add the file hash to the metadata of each document's chunks.
    """
    for document in documents:
        document.metadata["file_hash"] = file_hash
    return documents

def safe_load_single_document(file_path: str | PathLike, ext: str) -> List[Document] | None:
    """
    Safely load a single document, logging errors for failed files.
    """
    file_path = Path(file_path)
    filename = file_path.name

    if ext in LOADER_MAPPING:
        loader_class, loader_args = LOADER_MAPPING[ext]
        try:
            loader = loader_class(file_path.as_posix(), **loader_args)
            return loader.load()
        except Exception as e:
            logger.error(f"Failed to load document {filename}: {e}")
            return None
    else:
        logger.warning(f"Unsupported file type for {filename}")
        return None

# Process uploaded files directly without saving them
def process_uploaded_files(files:  list[UploadedFile] | None | UploadedFile, sub_progress_bar) -> List[Document]:
    total_files = len(files)
    documents = []
    existing_hashes = load_existing_hashes()

    if not files:
        logger.warning(f"No files uploaded.")
        return documents

    if not isinstance(files, list):
        files = [files]

    for i, file in enumerate(files, start=1):
        timestamp = datetime.now().isoformat()
        file_hash = compute_file_hash(file.name, timestamp)
        file_extension = Path(file.name).suffix
        original_name = Path(file.name).name

        if file_hash in existing_hashes:
            logger.info(f"Skipping file {file.name} as it has already been processed.")
            continue


        with tempfile.NamedTemporaryFile(delete=False, dir=tmp_directory, suffix=file_extension) as temp_file:
            temp_file.write(file.getvalue())
            temp_file.flush()
            temp_file.seek(0)
            temp_file_path = Path(temp_file.name)

        # Rename the tempfile to include the original filename
        renamed_file_path = temp_file_path.parent / original_name
        temp_file_path.rename(renamed_file_path)

        try:
            docs = safe_load_single_document(renamed_file_path, file_extension)  # Adapt to work with raw content

            if docs:
                docs = add_hash_to_chunks(docs, file_hash)
                documents.extend(docs)
                save_file_hash(file_hash)

        except Exception as e:
            logger.error(f"Failed to process file {file.name}: {e}")
        finally:
            # Ensure the temporary file is deleted
            renamed_file_path.unlink(missing_ok=True)
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

    chunks = split_documents(documents, chunk_size, chunk_overlap, sub_progress_bar)

    main_progress_bar.progress(1.0, text="Step 4/4: Adding chunks to vectorstore...")

    total_chunks = len(chunks)
    db = get_vectorstore()
    ingested_chunks = []

    for i in range(0, total_chunks, batch_size):
        batch = chunks[i:i + batch_size]
        db.add_documents(batch)
        ingested_chunks.extend(batch)

        # Respect rate limit
        time.sleep(1 / rate_limit)

        sub_progress_bar.progress(
            (i + len(batch)) / total_chunks,
            text=f"Ingesting batch {i // batch_size + 1}/{(total_chunks + batch_size - 1) // batch_size}...",
        )

    if does_vectorstore_exist(persist_directory):
        db = get_vectorstore()
        db.add_documents(chunks)
    else:
        create_vectorstore_from_documents(chunks)

    return chunks