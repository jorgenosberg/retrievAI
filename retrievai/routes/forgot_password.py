import streamlit as st

from retrievai.utils.auth_tools import get_authenticator

authenticator = get_authenticator()

try:
    authenticator.forgot_password(location="main")
except Exception as e:
    st.error(e)