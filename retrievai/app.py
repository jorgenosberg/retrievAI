import streamlit as st
import yaml
import streamlit_authenticator as stauth

from retrievai.navigation.sidebar import make_sidebar
from retrievai.utils.settings_tools import load_session_state


def main():
    # Set page config
    st.set_page_config(
        page_title="RetrievAI – Understand your documents",
        page_icon=":material/smart_toy:",
        initial_sidebar_state="auto",
        layout="wide",
    )

    auth_status = st.session_state.get("authentication_status", None)

    login_page = st.Page(page="routes/login.py", title="Login", icon=":material/lock:", default=not auth_status)
    chat_page = st.Page(page="routes/chat.py", title="Chat", icon=":material/chat:", default=auth_status)
    documents_page = st.Page(page="routes/documents.py", title="Documents", icon=":material/folder:")
    source_finder_page = st.Page(page="routes/source_finder.py", title="Source Finder", icon=":material/search:")

    make_sidebar()

    if auth_status:
        load_session_state(".retrievai/app_settings.yaml")
        pg = st.navigation([chat_page, documents_page, source_finder_page])
    elif auth_status is False:
        pg = st.navigation([login_page])
    elif auth_status is None:
        pg = st.navigation([login_page])
    else:
        pg = st.navigation([login_page])

    pg.run()


if __name__ == "__main__":
    main()
