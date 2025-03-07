import streamlit as st
from streamlit_extras.add_vertical_space import add_vertical_space

from retrievai.utils.settings_tools import save_session_state, load_session_state

load_session_state()

st.header("Settings")

# Create forms for updating each section of the settings
with st.form("Settings"):
    st.subheader("Chat Model")
    chat_model = st.selectbox(
        "Model",
        st.session_state.get("chat", {}).get("available_models", []),
        index=st.session_state.get("chat", {}).get("available_models", []).index(st.session_state.get("chat", {}).get("model", "")),
    )
    chat_temperature = st.slider(
        "Temperature", 0.0, 1.0, st.session_state.get("chat", {}).get("temperature", 0.0)
    )
    chat_streaming = st.toggle(
        "Streaming",
        value=st.session_state.get("chat", {}).get("streaming", False),
    )

    add_vertical_space(1)

    st.subheader("Embeddings Model")
    embeddings_model = st.selectbox(
        "Model",
        st.session_state.get("embeddings", {}).get("available_models", []),
        index=st.session_state.get("embeddings", {}).get("available_models", []).index(st.session_state.get("embeddings", {}).get("model", "")),
    )
    chunk_size = st.number_input(
        "Chunk Size",
        help="The target size for each text chunk",
        value=st.session_state.get("embeddings", {}).get("chunk_size", 1200),
        min_value=1,
    )
    chunk_overlap = st.number_input(
        "Chunk Overlap",
        help="The number of characters allowed as an overlap between chunks (to avoid losing context)",
        value=st.session_state.get("embeddings", {}).get("chunk_overlap", 200),
        min_value=0,
    )

    add_vertical_space(1)

    st.subheader("Vectorstore & Retriever")
    k = st.number_input(
        "k",
        help="Number of sources to return",
        value=st.session_state.get("vectorstore", {}).get("k", 10),
        min_value=1,
    )
    fetch_k = st.number_input(
        "Fetch k",
        help="Number of sources to fetch before ranking and returning",
        value=st.session_state.get("vectorstore", {}).get("fetch_k", 20),
        min_value=1,
    )
    search_type = st.selectbox(
        "Search Type",
        help="The search algorithm used to return and rank sources",
        options=["mmr", "similarity"],  # Provide valid options
        index=["mmr", "similarity"].index(st.session_state.get("vectorstore", {}).get("search_type", "mmr")),
    )
    directory = st.text_input(
        "Directory",
        help="The directory where the vector database is stored",
        value=st.session_state.get("vectorstore", {}).get("directory", ""),
    )

    add_vertical_space(1)

    # Submit button
    submitted = st.form_submit_button("Save Settings", type="primary", icon=":material/save:")

    if submitted:
        # Update settings dict with user input
        st.session_state["chat"]["model"] = chat_model
        st.session_state["chat"]["temperature"] = chat_temperature
        st.session_state["chat"]["streaming"] = chat_streaming

        st.session_state["embeddings"]["model"] = embeddings_model
        st.session_state["embeddings"]["chunk_size"] = chunk_size
        st.session_state["embeddings"]["chunk_overlap"] = chunk_overlap

        st.session_state["vectorstore"]["k"] = k
        st.session_state["vectorstore"]["fetch_k"] = fetch_k
        st.session_state["vectorstore"]["search_type"] = search_type
        st.session_state["vectorstore"]["directory"] = directory

        # Save updated settings
        save_session_state()
        st.success("Settings updated successfully!")