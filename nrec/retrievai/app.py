import streamlit as st
import logging

from retrievai.utils.auth_tools import get_authenticator
from retrievai.utils.settings_tools import load_session_state

logger = logging.getLogger("retrievai")
logger.setLevel(logging.DEBUG)

# Set page config
st.set_page_config(
    page_title="RetrievAI – Understand your documents",
    page_icon=":material/smart_toy:",
    initial_sidebar_state="auto",
    layout="wide",
)

auth_status = st.session_state.get("authentication_status", None)

login_page = st.Page(page="routes/login.py", title="Login", icon=":material/lock:")
register_page = st.Page(page="routes/register.py", title="Register", icon=":material/person_add:")
forgot_password_page = st.Page(page="routes/forgot_password.py", title="Forgot Password", icon=":material/password:")

settings_page = st.Page(page="routes/settings.py", title="Settings", icon=":material/settings:")
profile_page = st.Page(page="routes/profile.py", title="Profile", icon=":material/account_circle:")

bug_report_page = st.Page(page="routes/bug_report.py", title="Report a bug", icon=":material/bug_report:")
chat_page = st.Page(page="routes/chat.py", title="Chat", icon=":material/chat:")
documents_page = st.Page(page="routes/documents.py", title="Documents", icon=":material/folder:")
source_finder_page = st.Page(page="routes/source_finder.py", title="Find source", icon=":material/search:")
upload_page = st.Page(page="routes/upload.py", title="Upload documents", icon=":material/cloud_upload:")

if auth_status:
    load_session_state(".retrievai/app_settings.yaml")
    try:
        authenticator = get_authenticator()
        authenticator.logout(location="sidebar")
    except Exception as e:
        st.error(e)
    pg = st.navigation({
        "Chat": [chat_page, source_finder_page, documents_page, upload_page],
        "User": [profile_page, settings_page],
        "Help": [bug_report_page],
    })
else:
    pg = st.navigation({
        "Login": [login_page, register_page, forgot_password_page],
        "Help": [bug_report_page]
    })

pg.run()
