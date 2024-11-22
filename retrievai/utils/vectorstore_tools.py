from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
import streamlit as st
import openai

OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY


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