import streamlit as st
from glob import glob
from streamlit_extras.add_vertical_space import add_vertical_space
import base64


def main():

    if "selected_file" not in st.session_state:
        st.session_state.selected_file = None

    # Set page config
    st.set_page_config(
        page_title="Documents – ChatGPT for your documents",
        page_icon="🗄",
        initial_sidebar_state="expanded",
        layout="wide",
    )

    # Sidebar contents
    with st.sidebar:
        st.info(
            "This page shows all the documents you have added to the **documents** folder. If you would like to add more documents to the Chroma database, simply add additional documents to the folder and run the **ingest.py** script again. \n\nTo ask a new question, go to the **Home** page."
        )
        _, center_column, _ = st.columns([1, 3, 1])
        with center_column:
            st.write("*Made with *❤️* by Jørgen*")

    st.header("Your documents 🗄")

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


if __name__ == "__main__":
    main()
