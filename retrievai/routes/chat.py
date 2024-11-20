from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains.retrieval import create_retrieval_chain
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_openai import ChatOpenAI
import openai
from langchain_core.prompts import PromptTemplate
import chromadb
from glob import glob
import streamlit as st
from streamlit_extras.add_vertical_space import add_vertical_space

# Load the environment variables
OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY

# Define a simple template for the ChatGPT prompt
prompt_template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

<context>
{context}
</context>

Question: {input}:"""


# Prepare the embeddings and retriever
embeddings = OpenAIEmbeddings(
    model=st.session_state["embeddings"]["model"],
)
client = chromadb.PersistentClient(path=st.session_state["vectorstore"]["directory"])
db = Chroma(client=client, embedding_function=embeddings)
retriever = db.as_retriever(search_kwargs={"k": st.session_state["retriever"]["k"]}, search_type=st.session_state["retriever"]["search_type"])


_, center_page, _ = st.columns([1,7,1], vertical_alignment="center")
with center_page:
    st.header("Chat with your documents")

    # Check if the persist_directory is empty except for .gitkeep
    db_content = db.get()["documents"]
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
    else:

        paths = list(map(lambda x: f"documents/{x}", selected_documents))
        document_filter = {"source": {"$in": paths}}
        retriever = db.as_retriever(
            search_kwargs={"k": st.session_state["vectorstore"]["k"], "filter": document_filter}
        )

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

    llm = ChatOpenAI(
        model_name=st.session_state["chat"]["model"],
        temperature=st.session_state["chat"]["temperature"],
        streaming=st.session_state["chat"]["streaming"],
    )

    PROMPT = PromptTemplate(
        template=prompt_template,
        input_variables=["input", "context"],
    )

    FORMATTING_PROMPT = PromptTemplate(
        template="{page_content}\nSource:{file_path}, page {page}",
        input_variables=["page_content", "file_path", "page"]
    )

    combine_docs_chain = create_stuff_documents_chain(llm=llm, prompt=PROMPT, document_prompt=FORMATTING_PROMPT)

    rag_chain = create_retrieval_chain(retriever, combine_docs_chain)

    if run_openai_query and query:

        sources = []
        answer = ""

        # Get the answer from the chain
        for chunk in rag_chain.stream({"input":query}):
            if context_chunk := chunk.get("context"):
                sources = context_chunk
            if answer_chunk := chunk.get("answer"):
                answer += answer_chunk
                answer_box.success(answer)

        # Print the sources
        st.divider()
        st.write("## Sources 📚")

        # Print each source document
        for document in sources:
            formatted_sourcename = document.metadata["source"].replace(
                "documents/", ""
            )
            with st.expander(f"**Source:** {formatted_sourcename}"):
                st.markdown(document.page_content)