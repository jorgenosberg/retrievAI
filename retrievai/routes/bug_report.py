import urllib.parse
from datetime import datetime

from retrievai.utils.auth_tools import get_authenticator
import streamlit as st
from streamlit_extras.tags import tagger_component

authenticator = get_authenticator()

st.header("Do you need help?")
st.write("You can open an issue directly in the GitHub repository or send us an email with a description of the problem.")


col1, col2, _ = st.columns([1, 1, 3])
with col1:
    # GitHub Issue Button
    st.link_button(
        "Open GitHub issue",
        icon=":material/code:",
        url="https://github.com/jorgenosberg/retrievAI/issues/new",
        use_container_width=True
    )

with col2:
    # Email Button with formatted subject
    if "username" in st.session_state:
        # Get current time and format it
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        username = st.session_state['username']

        # Format the subject and URL-encode it
        subject = f"[Bug Report | RetrievAI | user: {username} | datetime: {current_time}]"
        encoded_subject = urllib.parse.quote(subject)

        # Format the mailto URL
        mailto_url = f"mailto:jorgenao@uio.no?subject={encoded_subject}"

        # Create the button
        st.link_button("Send us an email", icon=":material/email:", url=mailto_url, use_container_width=True)

st.divider()

st.subheader("Known issues")
elements = [
    {
        "title": "**Document filtering**",
        "text": "Document filtering on the `Chat` page is unpredictable",
        "tags": ["**bug**", "**#chat**", "**in progress**"],
        "color_name": ["red", "yellow", "blue"],
        "text_color_name": ["white", "black", "white"],
    },
    {
        "title": "OCR Quality",
        "text": "The Optical Character Recognition process is difficult, and not all documents are processed correctly. Source chunks that have been created with OCR are flagged in the GUI to let users know.",
        "tags": ["**#ocr**", "**in progress**"],
        "color_name": ["green", "blue"],
        "text_color_name": ["black", "white"],
    }
]
cols = st.columns(len(elements), vertical_alignment="bottom")
for i, element in enumerate(elements):
    with cols[i]:
        with st.container(
            border=True,
            height=175,
        ):
            tagger_component(
                element["title"],
                tags=element["tags"],
                color_name=element["color_name"],
                text_color_name=element["text_color_name"],
            )
            st.markdown(element["text"])

