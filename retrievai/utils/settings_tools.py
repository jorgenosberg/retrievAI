import os

import yaml
import streamlit as st

def save_session_state(file_path):
    with open(file_path, "w") as f:
        yaml.dump(st.session_state.to_dict(), f)

def load_session_state(file_path):
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            saved_state = yaml.safe_load(f)
            if saved_state:
                st.session_state.update(saved_state)