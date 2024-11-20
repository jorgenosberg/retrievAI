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
from streamlit_extras.switch_page_button import switch_page

# Load the environment variables
PERSIST_DIRECTORY = st.secrets["PERSIST_DIRECTORY"]
OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY

# Define a simple template for the ChatGPT prompt
prompt_template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

<context>
{context}
</context>

Question: {input}:"""

# Set page config
st.set_page_config(
    page_title="Home – ChatGPT for your documents",
    page_icon="🤖",
    initial_sidebar_state="expanded",
)

# Sidebar contents
with st.sidebar:
    model_list = [
        "gpt-4o-mini",
        "gpt-4o",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
    ]

    if "selected_model" not in st.session_state:
        st.session_state.selected_model = model_list[0]
    if "chunks_to_retrieve" not in st.session_state:
        st.session_state.chunks_to_retrieve = 10

    st.write("## Settings 🔧")
    st.session_state.selected_model = st.selectbox(
        "Select OpenAI model",
        model_list,
        index=model_list.index(st.session_state.selected_model),
    )
    st.session_state.chunks_to_retrieve = st.slider(
        "Select number of chunks to retrieve",
        min_value=1,
        max_value=20,
        value=st.session_state.chunks_to_retrieve,
    )
    _, center_column, _ = st.columns([1, 3, 1])
    with center_column:
        st.write("*Made with ❤️by Jørgen*")


def main():
    st.header("Ask GPT about your documents 💬")

    # Load settings from st.session_state if available
    selected_model = st.session_state.selected_model.split()[0]
    chunks_to_retrieve = st.session_state.chunks_to_retrieve

    # Prepare the embeddings and retriever
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small"
    )
    client = chromadb.PersistentClient(path=PERSIST_DIRECTORY)
    db = Chroma(client=client, embedding_function=embeddings)
    retriever = db.as_retriever(search_kwargs={"k": chunks_to_retrieve}, search_type="mmr")

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
            search_kwargs={"k": chunks_to_retrieve, "filter": document_filter}
        )

    ### Prepare the LLM and QA chain ###
    left_column, right_column = st.columns([7, 1])
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
        model_name=selected_model,
        temperature=0,
        streaming=True,
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

    else:
        st.info(
            "Enter a question to get started!\nYou can ask any question you want in English"
            + ", and the app will try to answer according to the information found in the documents you have "
            + "uploaded.\n"
            + "- LangChain optimizes your question slightly\n"
            + "- The app runs a similarity search in the Chroma VectorStore to look for relevant chunks of text\n"
            + "- If relevant sources are found, it then sends those chunks of text along with the optimized prompt to the LLM of your choice.\n"
            + "- The LLM then generates an answer based on the prompt and the chunks of text and returns it as a real-time stream.\n\n"
            f"*The currently selected model is **{selected_model}*** 🤖\n\n",
            icon="ℹ️",
        )
        left_column, right_column = st.columns([2, 4])
        with left_column:
            if st.button("See documents 🗄", key="Documents"):
                switch_page("Documents")


if __name__ == "__main__":
    main()
