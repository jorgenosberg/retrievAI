"""Markdown processing utilities.

This module contains pure functions for normalizing and processing Markdown content.
No changes needed from the original implementation.
"""

import re


def normalize_markdown(md_text: str) -> str:
    """
    Normalize Markdown content while preserving its structure.
    """
    # Protect URLs (including those without http/https)
    urls = re.findall(r'(https?://\S+|http://\S+|www\.\S+)', md_text)
    for i, url in enumerate(urls):
        md_text = md_text.replace(url, f"__URL_PLACEHOLDER_{i}__")

    # Protect Markdown links
    links = re.findall(r'\[[^]]+]\([^)]+\)', md_text)
    for i, link in enumerate(links):
        md_text = md_text.replace(link, f"__LINK_PLACEHOLDER_{i}__")

    # Protect emails
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', md_text)
    for i, email in enumerate(emails):
        md_text = md_text.replace(email, f"__EMAIL_PLACEHOLDER_{i}__")

    # Remove excessive newlines, keeping one newline between blocks
    md_text = re.sub(r'\n\s*\n', '\n\n', md_text.strip())

    # Normalize whitespace around Markdown headings
    md_text = re.sub(r'(#+)\s*', r'\1 ', md_text)

    # Fix broken lines where sentences are split across lines
    md_text = re.sub(r'(?<!\.)\n(?!\n)', ' ', md_text)  # Join lines without breaking paragraphs

    # Normalize spaces around punctuation
    md_text = re.sub(r'\s*([.,;:!?])\s*', r'\1 ', md_text)  # Ensure single space after punctuation
    md_text = re.sub(r'\s+', ' ', md_text)  # Normalize multiple spaces to a single space

    # Remove non-valid characters (non-printable and control characters)
    md_text = re.sub(r'[^\x20-\x7E]', '', md_text)  # Keep only printable ASCII

    # Ensure lists are properly formatted
    md_text = re.sub(r'(\n[-*+])\s+', r'\1 ', md_text)

    # Normalize links while preserving their display text
    md_text = re.sub(r'\[([^]]+)]\((\s*http[^)]+)\)', lambda m: f"[{m.group(1).strip()}]({m.group(2).strip()})",
                     md_text)

    # Normalize inline code and code blocks
    md_text = re.sub(r'`([^`]+)`', lambda m: f"`{m.group(1).strip()}`", md_text)
    md_text = re.sub(r'```[^\n]*\n(.*?)```', lambda m: f"```\n{m.group(1).strip()}\n```", md_text, flags=re.DOTALL)

    # Normalize bullet points and lists
    md_text = re.sub(r'(?<=\n)([-*+])\s+', r'\1 ', md_text)

    # Remove trailing spaces on each line
    md_text = re.sub(r'[ \t]+$', '', md_text, flags=re.M)

    # Restore URLs
    for i, url in enumerate(urls):
        md_text = md_text.replace(f"__URL_PLACEHOLDER_{i}__", url)

    # Restore Markdown links
    for i, link in enumerate(links):
        md_text = md_text.replace(f"__LINK_PLACEHOLDER_{i}__", link)

    # Restore emails
    for i, email in enumerate(emails):
        md_text = md_text.replace(f"__EMAIL_PLACEHOLDER_{i}__", email)

    return md_text
