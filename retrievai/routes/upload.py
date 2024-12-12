import streamlit as st
from langchain_core.rate_limiters import BaseRateLimiter

from retrievai.utils.ingestion_tools import LOADER_MAPPING, load_existing_hashes, process_uploaded_files, \
    ingest_documents
from retrievai.utils.settings_tools import load_session_state

class ImprovedRateLimiter(BaseRateLimiter):

    def acquire(self, *, blocking: bool = True) -> bool:
        pass

    async def aacquire(self, *, blocking: bool = True) -> bool:
        pass


# Initialize session state
load_session_state()


# Streamlit App Layout
st.header("Document Ingestion")

# File upload section
uploaded_files = st.file_uploader(
    "Upload your documents",
    accept_multiple_files=True,
    type=list(LOADER_MAPPING.keys()),
    help="Accepted file types: " + ", ".join(LOADER_MAPPING.keys()),

)

# Trigger ingestion
if st.button("Start Ingestion"):
    # Placeholders for progress bars
    progress_placeholder = st.container()
    with progress_placeholder:
        main_progress_bar = st.progress(0, text="Step 1/4: Initializing...")
        sub_progress_bar = st.progress(0)

    # Load existing file hashes
    existing_hashes = load_existing_hashes()

    main_progress_bar.progress(0.25, text="Step 1/4: Processing uploaded files...")
    documents = process_uploaded_files(uploaded_files, existing_hashes, sub_progress_bar)

    if documents:
        new_chunks = ingest_documents(documents, sub_progress_bar, main_progress_bar)
        main_progress_bar.empty()
        sub_progress_bar.empty()
        st.success(f"Successfully ingested {len(uploaded_files)} files ({len(new_chunks)} chunks).")
    else:
        st.warning("No new files to process.")
        main_progress_bar = None
        sub_progress_bar = None
