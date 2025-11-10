"""Chat API endpoints - RAG with streaming."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, col
from pydantic import BaseModel

from app.db.session import get_session
from app.db.models import User, Conversation, Message, ConversationRead, MessageRead
from app.dependencies import get_current_user
from app.core.rag import stream_rag_response, query_rag, format_sse_event

router = APIRouter()


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[UUID] = None
    stream: bool = True


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    conversation_id: UUID
    message_id: int


class ConversationWithMessages(BaseModel):
    conversation: ConversationRead
    messages: List[MessageRead]


@router.post("/")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Chat with RAG system.

    If stream=true, returns Server-Sent Events.
    If stream=false, returns complete response.

    Creates a new conversation if conversation_id is not provided.
    """
    # Get or create conversation
    if request.conversation_id:
        # Fetch existing conversation
        statement = select(Conversation).where(Conversation.id == request.conversation_id)
        result = await session.execute(statement)
        conversation = result.scalar_one_or_none()

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        # Check ownership
        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
    else:
        # Create new conversation
        conversation = Conversation(user_id=current_user.id)
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)

    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.message,
    )
    session.add(user_message)
    await session.commit()

    # Handle streaming vs non-streaming
    if request.stream:
        # Streaming response with SSE
        async def event_generator():
            sources = []
            answer_tokens = []
            full_answer = ""

            try:
                async for event in stream_rag_response(
                    query=request.message,
                    user_id=current_user.id,
                ):
                    # Collect answer tokens for saving to DB
                    if event["type"] == "token":
                        answer_tokens.append(event["content"])

                    # Collect sources for saving to DB
                    if event["type"] == "sources":
                        sources = event["content"].get("sources", [])

                    # Get final answer from done event
                    if event["type"] == "done":
                        full_answer = event["content"].get("answer", "".join(answer_tokens))

                    # Send SSE event to client
                    yield format_sse_event(event)

                # Save assistant message to database after streaming completes
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=full_answer,
                    sources={"sources": sources} if sources else None,
                )
                session.add(assistant_message)
                await session.commit()

                # Send final metadata event with message ID
                yield format_sse_event({
                    "type": "saved",
                    "content": {
                        "message_id": assistant_message.id,
                        "conversation_id": str(conversation.id),
                    }
                })

            except Exception as e:
                # Send error event
                yield format_sse_event({
                    "type": "error",
                    "content": {
                        "message": str(e),
                        "error_type": type(e).__name__,
                    }
                })

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )
    else:
        # Non-streaming response
        try:
            result = await query_rag(
                query=request.message,
                user_id=current_user.id,
            )

            # Save assistant message
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=result["answer"],
                sources={"sources": result["sources"]} if result["sources"] else None,
            )
            session.add(assistant_message)
            await session.commit()
            await session.refresh(assistant_message)

            return ChatResponse(
                answer=result["answer"],
                sources=result["sources"],
                conversation_id=conversation.id,
                message_id=assistant_message.id,
            )

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Chat error: {str(e)}",
            )


@router.get("/conversations", response_model=List[ConversationRead])
async def list_conversations(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    List user's conversations with pagination.

    Returns conversations ordered by most recent first.
    """
    query = (
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(col(Conversation.updated_at).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await session.execute(query)
    conversations = result.scalars().all()

    return conversations


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get conversation with all messages.

    Returns:
        - conversation: Conversation metadata
        - messages: All messages in chronological order
    """
    # Fetch conversation
    statement = select(Conversation).where(Conversation.id == conversation_id)
    result = await session.execute(statement)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # Check ownership
    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Fetch messages
    messages_query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(col(Message.created_at).asc())
    )
    messages_result = await session.execute(messages_query)
    messages = messages_result.scalars().all()

    return {
        "conversation": ConversationRead.model_validate(conversation),
        "messages": [MessageRead.model_validate(m) for m in messages],
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Delete a conversation and all its messages.

    Messages are cascade deleted automatically.
    """
    # Fetch conversation
    statement = select(Conversation).where(Conversation.id == conversation_id)
    result = await session.execute(statement)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # Check ownership
    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Delete conversation (messages cascade)
    await session.delete(conversation)
    await session.commit()

    return {
        "message": "Conversation deleted successfully",
        "conversation_id": conversation_id,
    }


@router.put("/conversations/{conversation_id}/title")
async def update_conversation_title(
    conversation_id: UUID,
    title: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Update conversation title.
    """
    # Fetch conversation
    statement = select(Conversation).where(Conversation.id == conversation_id)
    result = await session.execute(statement)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # Check ownership
    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Update title
    conversation.title = title
    session.add(conversation)
    await session.commit()

    return {
        "message": "Title updated successfully",
        "conversation_id": conversation_id,
        "title": title,
    }
