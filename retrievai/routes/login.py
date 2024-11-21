# Load credentials from the YAML file
import yaml
import streamlit_authenticator as stauth
import streamlit as st

with open(".retrievai/auth_config.yaml") as file:
    config = yaml.safe_load(file)

# Set up the authenticator
authenticator = stauth.Authenticate(
    config["credentials"],
    config["cookie"]["name"],
    config["cookie"]["key"],
    config["cookie"]["expiry_days"],
    auto_hash=True,
)

# Pre-hashing all plain text passwords once
# stauth.Hasher.hash_passwords(config['credentials'])

# Login form
try:
    authenticator.login("main", 5, 5)
except Exception as e:
    st.error(e)

if st.session_state['authentication_status']:
    st.success("Successfully logged into RetrievAI! We're redirecting you now...")
elif st.session_state['authentication_status'] is False:
    st.error('Username/password is incorrect')
