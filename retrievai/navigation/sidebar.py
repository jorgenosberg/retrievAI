import streamlit as st

def make_sidebar():
    # Sidebar contents
    with st.sidebar:
        _, center_column, _ = st.columns([1, 3, 1], vertical_alignment="bottom")
        with center_column:
            st.write("Made with :material/favorite: by Jørgen")