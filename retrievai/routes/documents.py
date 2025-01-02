import streamlit as st
from retrievai.utils.vectorstore_tools import get_all_embeddings_grouped, \
    delete_document_and_embeddings
from streamlit_extras.stylable_container import stylable_container
from streamlit_theme import st_theme

current_theme = st_theme() or {}


if "documents_page" not in st.session_state:
    st.session_state.documents_page = {"current_page": 1}

current_page = st.session_state.get("documents_page", {}).get("current_page", 1)

# Helper functions for the page
@st.dialog(title="Metadata")
def show_metadata(metadata):
    st.write(metadata)

def get_current_page():
    return st.session_state.get("documents_page", {}).get("current_page", 1)

def set_current_page(page):
    st.session_state.get("documents_page", {})["current_page"] = page

def go_to_page(page):
    set_current_page(page)

def go_next():
    current_page = get_current_page()
    if current_page < total_pages:
        set_current_page(current_page + 1)

def go_previous():
    current_page = get_current_page()
    if current_page > 1:
        set_current_page(current_page - 1)


st.header("Documents")

PAGE_SIZE = 10

grouped_list = get_all_embeddings_grouped()

# Display the paginated table
col1, _, col2 = st.columns([2, 2, 1], vertical_alignment="bottom")
search_term = col1.text_input("Search by Parent Document", help="Search by document name or content preview")

filtered_list = [doc for doc in grouped_list if search_term.lower() in doc["Parent Document"].lower()]
total_pages = (len(filtered_list) + PAGE_SIZE - 1) // PAGE_SIZE
start_idx = (current_page - 1) * PAGE_SIZE
paginated_list = filtered_list[start_idx : start_idx + PAGE_SIZE]

dark_container_styles = """
{
    padding: 4px 8px;
    display: flex;
}
"""
light_container_styles = """
{{
    padding: 4px 8px;
    background-color: {color};
}}
""".format(color=current_theme.get("secondaryBackgroundColor", "#f0f2f6"))

if paginated_list:
    header_container = stylable_container(
        key="header_container",
        css_styles="""
        {{
            padding: 4px 8px;
            display: flex;
            border-bottom: 1px solid {color};
        }}
        """.format(color=current_theme.get("secondaryBackgroundColor", "#f0f2f6")),
    )
    col1, col2, col3, col4, _ = header_container.columns([4, 1, 5, 1, 1])
    col1.caption("Parent Document")
    col2.caption("Embeddings")
    col3.caption("Content Preview")
    col4.caption("Actions")

    for idx, doc in enumerate(paginated_list):

        with stylable_container(
            key="dark_container" if idx % 2 == 0 else "light_container",
            css_styles=dark_container_styles if idx % 2 == 0 else light_container_styles,
        ):
            col1, col2, col3, col4, col5 = st.columns([4, 1, 5, 1, 1], vertical_alignment="center")

            col1.write(f"**{doc['Parent Document']}**")
            col2.write(f"**{doc['Embedding Count']}**")
            col3.text(doc["Content Preview"])
            metadata_button = col4.button(
                "",
                icon=":material/visibility:",
                key=f"metadata_{doc['Parent Document']}",
                help=f"View metadata for {doc['Parent Document']}",
                use_container_width=True,
            )
            delete_button = col5.button(
                "",
                type="primary",
                icon=":material/delete:",
                key=f"delete_{doc['Parent Document']}",
                help=f"Delete {doc['Parent Document']} and all embeddings",
                use_container_width=True,
            )

            if metadata_button:
                show_metadata(doc["Metadata"])

            # Delete action
            if delete_button:
                delete_document_and_embeddings(doc.get("Embedding IDs", []), doc.get("File Hash"))
                st.success(f"Deleted '{doc['Parent Document']}' and its embeddings.")
                st.rerun()  # Refresh the page after deletion
else:
    st.write("No documents found.")


# Pagination controls
current_page = get_current_page()
col1, _, col2 = st.columns([1, 4, 2], vertical_alignment="center")

with col1:
    st.caption(f"Showing **{len(paginated_list)}** of **{len(filtered_list)}** documents")

with col2:
    col1, col2, col3 = st.columns([1, 4, 1], vertical_alignment="center")
    # Left button
    col1.button(
        "",
        icon=":material/chevron_left:",
        key="prev",
        disabled=current_page == 1,
        use_container_width=True,
        on_click=go_previous
    )

    col2.button(
        f"Page {current_page}/{total_pages}",
        key="page",
        disabled=True,
        use_container_width=True,
    )

    # Right button
    col3.button(
        "",
        icon=":material/chevron_right:",
        key="next",
        disabled=current_page == total_pages,
        use_container_width=True,
        on_click=go_next
    )


