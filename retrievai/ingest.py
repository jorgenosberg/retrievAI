import openai
import streamlit as st
import os
from os import PathLike
import hashlib
from typing import List
from multiprocessing import Pool
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter
from tqdm import tqdm

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
import logging

from retrievai.utils.vectorstore_tools import get_vectorstore, create_vectorstore_from_documents

# Load environment variables
persist_directory = Path(st.secrets["PERSIST_DIRECTORY"])
source_directory = Path(st.secrets["SOURCE_DIRECTORY"])
chunk_size = st.secrets["CHUNK_SIZE"]
chunk_overlap = st.secrets["CHUNK_OVERLAP"]
OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY


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


def compute_file_hash(file_path: str | PathLike) -> str:
    """
    Compute MD5 hash of a file for duplicate detection.
    """
    file_path = Path(file_path)
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        hasher.update(f.read())
    return hasher.hexdigest()


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


def does_vectorstore_exist(persist_dir: str | PathLike) -> bool:
    """
    Check if vectorstore exists.
    """
    persist_dir = Path(persist_dir)
    return (persist_dir / "chroma.sqlite3").exists()


def load_documents(source_dir: str | PathLike, ignored_hashes: List[str] = []) -> List[Document]:
    """
    Load all documents from the source directory, ignoring duplicates.
    """
    source_dir = Path(source_dir)
    all_files = []
    for ext in LOADER_MAPPING:
        all_files.extend(
            source_dir.rglob(f"**/*{ext}")
        )
    filtered_files = [
        file_path for file_path in all_files
        if compute_file_hash(file_path) not in ignored_hashes
    ]

    results = []
    total_files = len(filtered_files)
    logger.info(f"Found {total_files} new files to process.")

    with tqdm(total=total_files, desc="Loading documents", unit="file", ncols=80, dynamic_ncols=True,
              leave=True) as pbar:
        with Pool(processes=os.cpu_count()) as pool:
            for docs in pool.imap_unordered(safe_load_single_document, filtered_files):
                if docs:
                    results.extend(docs)
                pbar.update()
    return results


def process_documents(ignored_hashes: List[str] = []) -> List[Document]:
    """
    Load documents and split them into chunks.
    """
    logger.info(f"Loading documents from {source_directory}")
    documents = load_documents(source_directory, ignored_hashes)

    if not documents:
        logger.info("No new documents to load.")
        exit(0)

    total_pages = len(documents)
    logger.info(f"Loaded {total_pages} routes from {source_directory}")

    # Initialize MarkdownTextSplitter
    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")],
        strip_headers=False,
    )
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap,
    )

    # Process chunks with progress bar
    logger.info("Splitting routes into chunks...")

    chunks = []

    with tqdm(total=total_pages, desc="Splitting routes", unit="page", ncols=80, dynamic_ncols=True, leave=True) as pbar:
        for document in documents:
            document_chunks = md_splitter.split_text(document.page_content)
            final_chunks = text_splitter.split_documents(document_chunks)
            for chunk in final_chunks:
                combined_metadata = {**document.metadata, **chunk.metadata}
                chunks.append(Document(page_content=chunk.page_content, metadata=combined_metadata))
            pbar.update()

    total_chunks = len(chunks)
    logger.info(f"Split {total_pages} routes into {total_chunks} chunks of text (max. {chunk_size} tokens each).")

    return chunks


def main():
    logger.info("Starting document ingestion...")

    if does_vectorstore_exist(persist_directory):
        logger.info(f"Appending to existing vectorstore at {persist_directory}")
        db = get_vectorstore()
        collection = db.get()
        existing_hashes = [metadata["file_hash"] for metadata in collection["metadatas"]]
        texts = process_documents(existing_hashes)
        logger.info("Creating embeddings. This may take some time...")
        db.add_documents(texts)
    else:
        logger.info("Creating new vectorstore")
        texts = process_documents()
        logger.info("Creating embeddings. This may take some time...")
        create_vectorstore_from_documents(texts)

    logger.info("Ingestion complete!")
    logger.info(
        f"Processed a total of {len(texts)} chunks. Run `streamlit run Home.py` to start chatting with your documents.")


if __name__ == "__main__":
    main()
