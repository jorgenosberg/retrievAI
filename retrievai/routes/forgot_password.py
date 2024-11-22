import streamlit as st

from retrievai.utils.auth_tools import get_authenticator

authenticator = get_authenticator()

try:
    if authenticator.forgot_password(st.session_state['username']):
        st.success('Entries updated successfully')
except Exception as e:
    st.error(e)