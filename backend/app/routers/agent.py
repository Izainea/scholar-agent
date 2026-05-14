"""Conversational agent endpoint — Server-Sent Events streaming."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services import agent as svc

router = APIRouter(prefix="/agent", tags=["agent"])


class ChatIn(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat")
async def chat(payload: ChatIn):
    """Stream the agent's response as Server-Sent Events.

    Event types: meta, delta, tool, result, final, error, done.
    """
    return StreamingResponse(
        svc.stream_chat(payload.message, payload.history),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
