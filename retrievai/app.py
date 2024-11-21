import streamlit as st

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

    login_page = st.Page(page="routes/login.py", title="Login", icon=":material/lock:")
    register_page = st.Page(page="routes/register.py", title="Register", icon=":material/lock:")
    logout_page = st.Page(page="routes/logout.py", title="Logout", icon=":material/lock:")

    settings_page = st.Page(page="routes/settings.py", title="Settings", icon=":material/settings:")
    bug_report_page = st.Page(page="routes/bug_report.py", title="Bug Report", icon=":material/bug_report:")
    chat_page = st.Page(page="routes/chat.py", title="Chat", icon=":material/chat:", default=True)
    documents_page = st.Page(page="routes/documents.py", title="Documents", icon=":material/folder:")
    source_finder_page = st.Page(page="routes/source_finder.py", title="Source Finder", icon=":material/search:")

    make_sidebar()

    if auth_status:
        load_session_state(".retrievai/app_settings.yaml")
        pg = st.navigation({
            "Chat": [chat_page, documents_page, source_finder_page],
            "User": [settings_page],
            "Help": [bug_report_page, logout_page],
        })
    elif auth_status is False:
        pg = st.navigation({
            "Login": [login_page, register_page],
            "Help": [bug_report_page]
        })
    elif auth_status is None:
        pg = st.navigation({
            "Login": [login_page, register_page],
            "Help": [bug_report_page]
        })
    else:
        pg = st.navigation({
            "Login": [login_page, register_page],
            "Help": [bug_report_page]
        })

    pg.run()


if __name__ == "__main__":
    main()
