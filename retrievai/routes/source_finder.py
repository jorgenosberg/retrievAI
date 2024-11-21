import streamlit as st
from streamlit_extras.add_vertical_space import add_vertical_space
from streamlit_pills import pills
import openai

from retrievai.utils.vectorstore_tools import get_retriever

# Load the environment variables
OPENAI_API_KEY = st.secrets["OPENAI_API_KEY"]
openai.api_key = OPENAI_API_KEY

retriever = get_retriever()

_, center_page, _ = st.columns([1, 7, 1], vertical_alignment="center")
with center_page:
    st.header("Source finder")

    left_column, right_column = st.columns([7, 1])
    with left_column:
        query = st.text_input(
            "Find sources by topic, keyword or full query:", key="query"
        )
    with right_column:
        add_vertical_space(2)
        st.button("Submit", key="Submit", type="primary")

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
                "documents/", ""
            )
            with st.expander(
                    f"**{index + 1}:** {formatted_sourcename}", expanded=expanded
            ):
                st.write(document.page_content)
