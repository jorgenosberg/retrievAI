
import streamlit as st

from retrievai.utils.auth_tools import get_authenticator

authenticator = get_authenticator()

# Login form
try:
    authenticator.login("main", 5, 5)
except Exception as e:
    st.error(e)

if st.session_state['authentication_status']:
    st.success("Successfully logged into RetrievAI! We're redirecting you now...")
elif st.session_state['authentication_status'] is False:
    st.error('Username/password is incorrect')

col1, col2, _ = st.columns([1, 1, 3])
with col1:
    st.page_link("routes/register.py", label="Register new account", icon=":material/person_add:",
                 use_container_width=True)
with col2:
    st.page_link("routes/forgot_password.py", label="Forgot password?", icon=":material/password:",
                 use_container_width=True)
