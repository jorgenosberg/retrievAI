import logging
from os import PathLike
from pathlib import Path
from typing import List

from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
import streamlit as st
import openai

from retrievai.utils.settings_tools import load_session_state

load_session_state()

OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY

# Define settings
settings_directory = Path(".retrievai")
hashes_file = settings_directory / "file_hashes.txt"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def does_vectorstore_exist(persist_dir: str | PathLike) -> bool:
    """
    Check if vectorstore exists.
    """
    persist_dir = Path(persist_dir)
    return (persist_dir / "chroma.sqlite3").exists()


def get_vectorstore():
    embeddings = OpenAIEmbeddings(model=st.session_state["embeddings"]["model"])
    db = Chroma(embedding_function=embeddings, persist_directory=st.session_state["vectorstore"]["directory"])
    return db

def create_vectorstore_from_documents(documents):
    embeddings = OpenAIEmbeddings(model=st.session_state["embeddings"]["model"])
    db = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory=st.session_state["vectorstore"]["directory"],
    )
    return db

def get_retriever(document_filter: dict = None):
    db = get_vectorstore()
    search_kwargs = {
        "k": st.session_state["vectorstore"]["k"],
        "fetch_k": st.session_state["vectorstore"]["fetch_k"],
    }
    if document_filter:
        search_kwargs.update(document_filter)
    return db.as_retriever(
        search_type=st.session_state["vectorstore"]["search_type"],
        search_kwargs=search_kwargs,
    )

def get_all_embeddings():
    db = get_vectorstore()
    return db.get(
        limit=None,  # Fetch all results
        include=["metadatas", "documents"],
    )


def get_all_embeddings_grouped():
    results = get_all_embeddings()
    grouped_data = {}

    for id_, metadata, content in zip(results["ids"], results["metadatas"], results["documents"]):
        file_hash = metadata.get("file_hash", "Unknown")
        parent_doc = Path(metadata.get("source", "Unknown")).name  # Parent document name

        # Use file_hash as the grouping key, but keep parent_doc for display
        if file_hash not in grouped_data:
            grouped_data[file_hash] = {
                "parent_doc": parent_doc,
                "ids": [],
                "content_preview": []
            }
        grouped_data[file_hash]["ids"].append(id_)
        grouped_data[file_hash]["content_preview"].append(content[:50] + "..." if content else "No content")

    # Prepare the list for display
    grouped_list = [
        {
            "File Hash": file_hash,
            "Parent Document": data["parent_doc"],
            "Embedding Count": len(data["ids"]),
            "Embedding IDs": data["ids"],
            "Content Preview": "\n".join(data["content_preview"][:3]) + (
                "..." if len(data["content_preview"]) > 3 else ""),
        }
        for file_hash, data in grouped_data.items()
    ]
    return grouped_list

def remove_hash(file_hash: str):
    """
    Removes a hash from the hashes file.
    """
    if not hashes_file.exists():
        logger.warning("Hashes file does not exist. Nothing to remove.")
        return

    try:
        with open(hashes_file, "r") as f:
            hashes = f.readlines()

        hashes = [h.strip() for h in hashes if h.strip() != file_hash]

        with open(hashes_file, "w") as f:
            f.write("\n".join(hashes) + "\n")

        logger.info(f"Removed hash: {file_hash} from {hashes_file}")
    except Exception as e:
        logger.error(f"Failed to remove hash {file_hash}: {e}")

def delete_document_and_embeddings(embedding_ids, file_hash):
    if not embedding_ids:
        return
    db = get_vectorstore()
    db.delete(ids=embedding_ids)
    if file_hash:
        print(file_hash)
        remove_hash(file_hash)


def count_total_embeddings():
    results = get_all_embeddings()
    return len(results["ids"])

def count_total_documents():
    results = get_all_embeddings_grouped()
    return len(results)

