import streamlit as st
from retrievai.utils.vectorstore_tools import get_vectorstore
from streamlit_extras.stylable_container import stylable_container
from streamlit_theme import st_theme

current_theme = st_theme() or {}


# Initialize vectorstore client
db = get_vectorstore()

# Fetch data from vectorstore
results = db.get(
    limit=None,  # Fetch all results
    include=["metadatas", "documents"],
)

# Group documents by parent document
grouped_data = {}
for id_, metadata, content in zip(results["ids"], results["metadatas"], results["documents"]):
    parent_document = metadata.get("source", "Unknown")
    if parent_document not in grouped_data:
        grouped_data[parent_document] = {"ids": [], "metadata": metadata, "content_preview": []}
    grouped_data[parent_document]["ids"].append(id_)
    grouped_data[parent_document]["content_preview"].append(content[:50] + "..." if content else "No content")

# Prepare data for display
grouped_list = [
    {
        "Parent Document": parent,
        "Embedding Count": len(data["ids"]),
        "Metadata": data["metadata"],
        "Content Preview": "\n".join(data["content_preview"][:3]) + ("..." if len(data["content_preview"]) > 3 else ""),
    }
    for parent, data in grouped_data.items()
]

PAGE_SIZE = 5

if "documents_page" not in st.session_state:
    st.session_state.documents_page = {"current_page": 1}

current_page = st.session_state.get("documents_page", {}).get("current_page", 1)

def get_current_page():
    return st.session_state.get("documents_page", {}).get("current_page", 1)

def set_current_page(page):
    st.session_state.get("documents_page", {})["current_page"] = page

# Callback functions for pagination
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

@st.dialog(title="Metadata")
def show_metadata(metadata):
    st.write(metadata)


st.header("Documents")

# Display the paginated table
col1, _, col2 = st.columns([2, 2, 1], vertical_alignment="bottom")
search_term = col1.text_input("Search by Parent Document", help="Search by document name or content preview")

filtered_list = [doc for doc in grouped_list if search_term.lower() in doc["Parent Document"].lower()]
total_pages = (len(filtered_list) + PAGE_SIZE - 1) // PAGE_SIZE
start_idx = (current_page - 1) * PAGE_SIZE
paginated_list = filtered_list[start_idx : start_idx + PAGE_SIZE]


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
        container_key = f"dark_container_{idx}" if idx % 2 == 0 else f"light_container_{idx}"
        container_styles = """
        {
            padding: 4px 8px;
            display: flex;
        }
        """ if idx % 2 == 0 else """
        {{
            padding: 4px 8px;
            background-color: {color};
        }}
        """.format(color=current_theme.get("secondaryBackgroundColor", "#f0f2f6"))
        with stylable_container(
            key=container_key,
            css_styles=container_styles,
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
                if doc["Parent Document"] in grouped_data:
                    db.delete(ids=grouped_data[doc["Parent Document"]]["ids"])  # Delete all embeddings
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
