"""RAG (Retrieval-Augmented Generation) chain utilities.

This module provides async functions for creating and using RAG chains
with streaming support for Server-Sent Events (SSE).
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, AsyncIterator

from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_classic.chains.retrieval import create_retrieval_chain
from langchain_openai import ChatOpenAI
from sqlmodel import select

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import AppSettings
from app.core.prompts import CHAT_PROMPT, DOCUMENT_PROMPT
from app.core.vectorstore import get_retriever
from app.core.openai_keys import resolve_openai_api_key

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_chat_llm(
    streaming: bool = True,
    user_id: Optional[int] = None,
) -> ChatOpenAI:
    """
    Get ChatOpenAI instance with settings from database.

    Priority order for model selection:
    1. User's personal preference (default_chat_model)
    2. Admin workspace settings (chat.model)
    3. Fallback default (gpt-4o-mini)

    Args:
        streaming: Whether to enable streaming
        user_id: User ID for personal preferences

    Returns:
        ChatOpenAI instance
    """
    async with AsyncSessionLocal() as session:
        # Start with admin workspace settings
        result = await session.execute(
            select(AppSettings).where(AppSettings.key == "chat")
        )
        chat_settings = result.scalar_one_or_none()

        if chat_settings:
            model = chat_settings.value.get("model", "gpt-4o-mini")
            temperature = chat_settings.value.get("temperature", 0.7)
        else:
            # Defaults
            model = "gpt-4o-mini"
            temperature = 0.7

        # Check for user-specific preference override
        if user_id is not None:
            from app.core.user_settings import get_or_create_user_preferences
            prefs = await get_or_create_user_preferences(session, user_id)
            user_model = prefs.preferences.get("default_chat_model")
            if user_model:
                model = user_model

    api_key = await resolve_openai_api_key(user_id=user_id)

    return ChatOpenAI(
        model=model,
        temperature=temperature,
        streaming=streaming,
        api_key=api_key,
    )


async def get_combine_docs_chain(
    streaming: bool = True,
    user_id: Optional[int] = None,
):
    """
    Create document combination chain.

    Args:
        streaming: Whether to enable streaming

    Returns:
        Document combination chain
    """
    llm = await get_chat_llm(streaming=streaming, user_id=user_id)

    return create_stuff_documents_chain(
        llm=llm,
        prompt=CHAT_PROMPT,
        document_prompt=DOCUMENT_PROMPT
    )


async def get_rag_chain(
    document_filter: Optional[Dict[str, Any]] = None,
    streaming: bool = True,
    user_id: Optional[int] = None,
):
    """
    Create complete RAG chain with retriever and LLM.

    Args:
        document_filter: Optional filter for document retrieval
        streaming: Whether to enable streaming

    Returns:
        Complete RAG chain
    """
    combine_docs_chain = await get_combine_docs_chain(
        streaming=streaming,
        user_id=user_id,
    )
    retriever = await get_retriever(document_filter=document_filter)

    return create_retrieval_chain(retriever, combine_docs_chain)


async def stream_rag_response(
    query: str,
    document_filter: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Stream RAG response as Server-Sent Events with enhanced UX.

    Args:
        query: User's question
        document_filter: Optional filter for document retrieval

    Yields:
        Dictionary events with 'type' and content:
        - {"type": "start", "content": {"query": "..."}} - Query received
        - {"type": "retrieving", "content": {"message": "..."}} - Searching documents
        - {"type": "sources", "content": [...]} - Retrieved sources
        - {"type": "thinking", "content": {"message": "..."}} - Generating response
        - {"type": "token", "content": "..."} - Streaming token
        - {"type": "done", "content": {"answer": "...", "token_count": N}} - Complete
        - {"type": "error", "content": "..."} - Error occurred
    """
    try:
        # Send start event
        yield {
            "type": "start",
            "content": {
                "query": query,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

        # Send retrieving event
        yield {
            "type": "retrieving",
            "content": {
                "message": "Searching through documents...",
            }
        }

        rag_chain = await get_rag_chain(
            document_filter=document_filter,
            streaming=True,
            user_id=user_id,
        )

        # Track state
        sources_sent = False
        answer_tokens = []
        token_count = 0
        thinking_sent = False

        # Stream the response
        async for chunk in rag_chain.astream({"input": query}):
            # Handle context (sources) - send once at beginning
            if "context" in chunk and not sources_sent:
                sources = []
                # Add document numbers to the metadata for citation purposes
                for idx, doc in enumerate(chunk["context"], start=1):
                    # Store original content before modification
                    original_content = doc.page_content

                    # Prepend document number to page_content for the model to see
                    doc.page_content = f"[Document {idx}]\n{doc.page_content}"
                    doc.metadata["doc_num"] = idx

                    # Send original content (without prefix) to frontend for matching
                    sources.append({
                        "content": original_content[:300],  # Preview of original content
                        "metadata": {
                            "source": doc.metadata.get("source", "Unknown"),
                            "page": doc.metadata.get("page"),
                            "file_hash": doc.metadata.get("file_hash"),
                            "title": doc.metadata.get("title"),
                            "doc_num": idx,
                        },
                    })

                yield {
                    "type": "sources",
                    "content": {
                        "sources": sources,
                        "count": len(sources),
                    }
                }
                sources_sent = True

                # Send thinking event before first token
                yield {
                    "type": "thinking",
                    "content": {
                        "message": "Generating response from retrieved documents...",
                    }
                }
                thinking_sent = True

            # Handle answer tokens
            if "answer" in chunk:
                # Send thinking event if not sent yet (in case sources come after)
                if not thinking_sent:
                    yield {
                        "type": "thinking",
                        "content": {
                            "message": "Generating response...",
                        }
                    }
                    thinking_sent = True

                token = chunk["answer"]
                answer_tokens.append(token)
                token_count += 1
                yield {
                    "type": "token",
                    "content": token,
                }

        # Send completion event with metadata
        full_answer = "".join(answer_tokens)
        yield {
            "type": "done",
            "content": {
                "answer": full_answer,
                "token_count": token_count,
                "sources_retrieved": len(sources) if sources_sent else 0,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

    except Exception as e:
        logger.error(f"Error in RAG streaming: {e}", exc_info=True)
        yield {
            "type": "error",
            "content": {
                "message": str(e),
                "error_type": type(e).__name__,
            }
        }


async def query_rag(
    query: str,
    document_filter: Optional[Dict[str, Any]] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Query RAG chain without streaming (returns complete response).

    Args:
        query: User's question
        document_filter: Optional filter for document retrieval

    Returns:
        Dictionary with 'answer' and 'sources' keys
    """
    try:
        rag_chain = await get_rag_chain(
            document_filter=document_filter,
            streaming=False,
            user_id=user_id,
        )

        result = await rag_chain.ainvoke({"input": query})

        # Extract sources
        sources = []
        if "context" in result:
            for doc in result["context"]:
                sources.append({
                    "content": doc.page_content[:200],  # Preview
                    "metadata": doc.metadata,
                })

        return {
            "answer": result.get("answer", ""),
            "sources": sources,
        }

    except Exception as e:
        logger.error(f"Error in RAG query: {e}")
        raise


def format_sse_event(data: Dict[str, Any]) -> str:
    """
    Format data as Server-Sent Event.

    Args:
        data: Data to send

    Returns:
        Formatted SSE string
    """
    return f"data: {json.dumps(data)}\n\n"
