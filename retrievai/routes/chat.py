from glob import glob
import streamlit as st
from streamlit_extras.add_vertical_space import add_vertical_space

from retrievai.utils.rag_tools import get_rag_chain
from retrievai.utils.vectorstore_tools import get_vectorstore


_, center_page, _ = st.columns([1, 7, 1], vertical_alignment="center")
with center_page:
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
    left_column, right_column = st.columns([7, 1], vertical_alignment="center")
    with left_column:
        query = st.text_input("Ask any question using natural language:")
    with right_column:
        add_vertical_space(2)
        if st.button("Submit", key="Submit", type="primary"):
            run_openai_query = True
        else:
            run_openai_query = False

    # Prepare streaming callback
    answer_box = st.empty()

    if run_openai_query and query:

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
            formatted_sourcename = document.metadata["source"].replace(
                "documents/", ""
            )
            formatted_page_number = f"p. {document.metadata["page"]} / {document.metadata["total_pages"]}"
            with st.expander(f"{formatted_sourcename}, **{formatted_page_number}**"):
                if document.metadata["is_ocr"]:
                    st.warning("This chunk has been processed with Optical Character Recognition, since the source document was not machine-readable. It might contain errors or misplaced text.")
                st.markdown(document.page_content)
