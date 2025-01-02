from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains.retrieval import create_retrieval_chain
from langchain_openai import ChatOpenAI
import streamlit as st

from retrievai.utils.prompt_tools import CHAT_PROMPT, DOCUMENT_PROMPT
from retrievai.utils.vectorstore_tools import get_retriever


def get_chat_llm():
    return ChatOpenAI(
        model_name=st.session_state["chat"]["model"],
        temperature=st.session_state["chat"]["temperature"],
        streaming=st.session_state["chat"]["streaming"],
    )


def get_combine_docs_chain():
    llm = get_chat_llm()

    return create_stuff_documents_chain(llm=llm, prompt=CHAT_PROMPT, document_prompt=DOCUMENT_PROMPT)


def get_rag_chain(document_filter: dict = None):
    combine_docs_chain = get_combine_docs_chain()
    retriever = get_retriever(document_filter=document_filter)

    return create_retrieval_chain(retriever, combine_docs_chain)
