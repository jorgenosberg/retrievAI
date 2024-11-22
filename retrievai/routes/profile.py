import time

import streamlit as st
from streamlit_extras.add_vertical_space import add_vertical_space

from retrievai.utils.auth_tools import get_authenticator, reload_authenticator
from retrievai.utils.settings_tools import load_session_state

load_session_state()

authenticator = get_authenticator()

@st.dialog("Update user details", width="large")
def update_user_details():

    try:
        if authenticator.update_user_details(st.session_state['username']):
            reload_authenticator()
            st.success('Details updated successfully')
            time.sleep(1.5)  # Wait for 2 seconds
            st.rerun()
    except Exception as e:
        st.error(e)

@st.dialog("Change user password", width="large")
def change_user_password():

    try:
        if authenticator.reset_password(st.session_state['username']):
            reload_authenticator()
            st.success('Password updated successfully')
            time.sleep(1.5)  # Wait for 2 seconds
            st.rerun()
    except Exception as e:
        st.error(e)

st.header("Profile")

st.text_input("Username", value=st.session_state.get("username", ""), disabled=True)
st.text_input("Name", value=st.session_state.get("name", ""), disabled=True)
st.text_input("Email", value=st.session_state.get("email", ""), disabled=True)


st.divider()

col1, col2, _ = st.columns([1, 1, 3])
with col1:
    st.button("Update profile", icon=":material/edit:", on_click=update_user_details, use_container_width=True)
with col2:
    st.button("Change password", icon=":material/password:", on_click=change_user_password, use_container_width=True)

