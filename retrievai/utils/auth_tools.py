import streamlit_authenticator as stauth
import streamlit as st


def get_authenticator():
    if "authenticator" in st.session_state:
        return st.session_state["authenticator"]

    # Set up the authenticator
    authenticator = stauth.Authenticate(
        credentials=".retrievai/auth_config.yaml",
        auto_hash=True,
    )

    st.session_state["authenticator"] = authenticator

    return authenticator


def reload_authenticator():
    st.session_state.pop("authenticator", None)
    return get_authenticator()
