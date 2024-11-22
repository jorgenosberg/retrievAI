import streamlit as st
from glob import glob
import base64

if "selected_file" not in st.session_state:
    st.session_state.selected_file = None

st.header("Browse your documents")

files = glob("documents/*.pdf")

st.write(f"You currently have **{len(files)}** documents in your library.")

file_list, pdf_viewer = st.columns([3, 7])

with file_list:
    for index, file in enumerate(files):

        if st.button(
                f"**{file.replace('documents/', '')}**",
                use_container_width=True,
                key=index,
                help=f"Click to view {file.replace('documents/', '')}",
                type=(
                        "primary" if st.session_state.selected_file == file else "secondary"
                ),
        ):
            st.session_state.selected_file = file
            st.rerun()

with pdf_viewer:
    if st.session_state.selected_file is not None:
        with open(st.session_state.selected_file, "rb") as f:
            base64_pdf = base64.b64encode(f.read()).decode("utf-8")

        st.write(
            f"**{st.session_state.selected_file.replace('documents/', '')}:**"
        )

        st.markdown(
            f'<iframe src="data:application/pdf;base64,{base64_pdf}" width="100%" height="1000" type="application/pdf"></iframe>',
            unsafe_allow_html=True,
        )
