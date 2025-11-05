"""Prompt templates for RAG system.

This module contains prompt templates used in the RAG chain.
In the future, these will be stored in the database via AppSettings model
to allow admin customization.
"""

from langchain.prompts import PromptTemplate


# Default RAG prompt template
DEFAULT_PROMPT_TEMPLATE = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

<context>
{context}
</context>

Question: {input}:"""

CHAT_PROMPT = PromptTemplate(
    template=DEFAULT_PROMPT_TEMPLATE,
    input_variables=["input", "context"],
)

DOCUMENT_PROMPT = PromptTemplate(
    template="{page_content}\nSource:{file_path}, page {page}",
    input_variables=["page_content", "file_path", "page"]
)


async def get_chat_prompt_from_db() -> PromptTemplate:
    """
    Retrieve chat prompt template from database settings.
    Falls back to default if not found.

    TODO: Implement database retrieval from AppSettings model.
    """
    # For now, return the default prompt
    # Later this will query the database:
    # async with get_session() as session:
    #     result = await session.execute(
    #         select(AppSettings).where(AppSettings.key == "chat_prompt")
    #     )
    #     settings = result.scalar_one_or_none()
    #     if settings:
    #         return PromptTemplate(
    #             template=settings.value.get("template", DEFAULT_PROMPT_TEMPLATE),
    #             input_variables=["input", "context"]
    #         )
    return CHAT_PROMPT


async def get_document_prompt_from_db() -> PromptTemplate:
    """
    Retrieve document prompt template from database settings.
    Falls back to default if not found.

    TODO: Implement database retrieval from AppSettings model.
    """
    return DOCUMENT_PROMPT
