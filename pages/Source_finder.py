# Streamlit
import streamlit as st
from streamlit_extras.add_vertical_space import add_vertical_space
from streamlit_pills import pills

# LangChain/OpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
import openai

# Chroma
import chromadb

# Env
from glob import glob

# Load the environment variables
PERSIST_DIRECTORY = st.secrets["PERSIST_DIRECTORY"]
OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY


def main():

    # Set page config
    st.set_page_config(
        page_title="Source Finder – ChatGPT for your documents",
        page_icon="🔎",
        initial_sidebar_state="expanded",
    )

    # Sidebar contents
    with st.sidebar:
        st.info(
            "This page allows you to search for relevant sources from the document database, either by keyword(s) or a full query. \n\nTo ask a new question, go to the **Home** page."
        )
        left_column, right_column = st.columns([3, 1])
        with left_column:
            st.write("## Settings 🔧")
        with right_column:
            add_vertical_space(1)
            edit_mode = not st.checkbox("Edit", key="edit_mode")
        sources_to_retrieve = st.slider(
            "Select number of sources to retrieve",
            min_value=1,
            max_value=50,
            value=25,
            key="sources_to_retrieve",
            disabled=edit_mode,
        )
        similarity_treshold = st.slider(
            "Select similarity threshold",
            min_value=0.1,
            max_value=1.0,
            key="similarity_treshold",
            value=0.5,
            disabled=edit_mode,
        )
        st.warning(
            "Note that a higher number of sources increases the likelihood of retrieving irrelevant chunks of text. For this reason, the default for this app is 25, with a similarity threshold of 0.5."
        )
        _, center_column, _ = st.columns([1, 3, 1])
        with center_column:
            st.write("*Made with *❤️* by Jørgen*")

    st.header("Source finder 🔎")

    left_column, right_column = st.columns([7, 1])
    with left_column:
        query = st.text_input(
            "Find sources by topic, keyword or full query:", key="query"
        )
    with right_column:
        add_vertical_space(2)
        st.button("Submit", key="Submit", type="primary")

    # Prepare the embeddings and retriever
    embeddings = OpenAIEmbeddings()
    client = chromadb.PersistentClient(path=PERSIST_DIRECTORY)
    db = Chroma(client=client, embedding_function=embeddings)
    retriever = db.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={
            "score_threshold": similarity_treshold,
            "k": sources_to_retrieve,
        },
    )

    if query:
        with st.spinner("Searching for relevant sources..."):
            docs = retriever.get_relevant_documents(query)

        st.divider()

        left_column, right_column = st.columns([2.75, 1])
        with left_column:
            st.write("## Sources 📚")
        with right_column:
            expanded = (
                pills(
                    label="",
                    options=["Expand all", "Collapse all"],
                    key="expanded",
                    index=1,
                    label_visibility="hidden",
                )
                == "Expand all"
            )

        # Print each source document
        for index, document in enumerate(docs):
            formatted_sourcename = document.metadata["source"].replace(
                "source_documents/", ""
            )
            with st.expander(
                f"**{index+1}:** {formatted_sourcename}", expanded=expanded
            ):
                st.write(document.page_content)


if __name__ == "__main__":
    main()
