import os

import yaml
import streamlit as st

def save_session_state(file_path = ".retrievai/app_settings.yaml"):
    with open(file_path, "w") as f:
        relevant_settings = {
            "chat": st.session_state.get("chat", {}),
            "embeddings": st.session_state.get("embeddings", {}),
            "vectorstore": st.session_state.get("vectorstore", {}),
        }
        yaml.dump(relevant_settings, f)

def load_session_state(file_path = ".retrievai/app_settings.yaml"):
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            saved_state = yaml.safe_load(f)
            if saved_state:
                st.session_state.update(saved_state)