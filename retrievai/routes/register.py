import time

import streamlit as st

from retrievai.utils.auth_tools import get_authenticator

authenticator = get_authenticator()

pre_authorized_users = [
    "hermat@ifi.uio.no",
    "sunedm@ifi.uio.no",
    "jorgen.osberg@gmail.com",
    "jorgenao@uio.no",
    "geirksa@ifi.uio.no",
    "johansa@ifi.uio.no",
]

try:
    email, name, username = authenticator.register_user(location="main", pre_authorized=pre_authorized_users, captcha=True)
    if email and name and username:
        st.success(f'{username} ({email}) registered successfully')
        time.sleep(1.2)
        st.switch_page("routes/login.py")
except Exception as e:
    st.error(e)