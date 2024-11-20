import re


def normalize_markdown(md_text: str) -> str:
    """
    Normalize Markdown content while preserving its structure.
    """
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

    return md_text