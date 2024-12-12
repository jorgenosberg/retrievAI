from pathlib import Path

import streamlit_authenticator as stauth
import streamlit as st


def get_authenticator():
    if "authenticator" in st.session_state:
        return st.session_state["authenticator"]

    config_file = Path(".retrievai/auth_config.yaml")
    if not config_file.exists():
        if not config_file.parent.exists():
            config_file.parent.mkdir(parents=True, exist_ok=True)
        config_file.touch(exist_ok=True)

        default_structure = {
            "credentials": {
                "usernames": {
                    "admin": "admin",
                    "user": "user",
                }
            },
            "cookie": {
                "name": "retrievai_auth",
                "key": "retrievai_auth_cookie",
                "expiry_days": 7.0,
            },
        }

    # Set up the authenticator
    authenticator = stauth.Authenticate(
        credentials=config_file.as_posix(),
        cookie_name="retrievai_auth",
        cookie_key="retrievai_auth_cookie",
        cookie_expiry_days=7.0,
        auto_hash=True,
    )

    st.session_state["authenticator"] = authenticator

    return authenticator


def reload_authenticator():
    st.session_state.pop("authenticator", None)
    return get_authenticator()
