from glob import glob
from pathlib import Path

import streamlit as st

from retrievai.utils.auth_tools import get_authenticator
from retrievai.utils.rag_tools import get_rag_chain
from retrievai.utils.vectorstore_tools import get_vectorstore

authenticator = get_authenticator()

st.header("Chat with your documents")

# Check if the persist_directory is empty except for .gitkeep
db_content = get_vectorstore().get()["documents"]
if len(db_content) == 0:
    st.warning(
        "No documents found in the database. Please add documents to the documents folder and run the ingest.py script."
        + "\n\n"
        + "If you query ChatGPT now, you will only get general answers from the selected model without any context from your documents. Please note that this might lead to irrelevant answers and hallucination, even with the model temperature set to 0."
    )

files = list(
    map(
        lambda x: x.replace("documents/", ""), glob("documents/*.pdf")
    )
)
selected_documents = st.multiselect(
    label="Filter source documents", options=["All"] + files, default="All"
)

if not selected_documents or "All" in selected_documents:
    selected_documents = files
    document_filter = None
else:
    paths = list(map(lambda x: f"documents/{x}", selected_documents))
    document_filter = {"source": {"$in": paths}}

rag_chain = get_rag_chain(document_filter=document_filter)


### Prepare the LLM and QA chain ###
query = st.text_input("Ask any question using natural language:", placeholder="Use enter (⏎) to activate your query")

# Prepare streaming callback
answer_box = st.empty()

if query:

    sources = []
    answer = ""

    # Get the answer from the chain
    for chunk in rag_chain.stream({"input": query}):
        if context_chunk := chunk.get("context"):
            sources = context_chunk
        if answer_chunk := chunk.get("answer"):
            answer += answer_chunk
            answer_box.success(answer)

    # Print the sources
    st.divider()
    st.write("### Sources used")

    # Print each source document
    for document in sources:
        formatted_sourcename = Path(document.metadata["source"]).name
        formatted_page_number = f"p. {document.metadata["page"]} / {document.metadata["total_pages"]}"
        with st.expander(f"{formatted_sourcename}, **{formatted_page_number}**"):
            if document.metadata["is_ocr"]:
                st.warning("This chunk has been processed with Optical Character Recognition, since the source document was not machine-readable. It might contain errors or misplaced text.")
            st.markdown(document.page_content)
