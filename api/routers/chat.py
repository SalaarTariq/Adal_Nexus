"""AI Chat endpoint using Groq API."""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from groq import Groq
from pydantic import BaseModel, Field

from api.core import verify_firebase_token

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)

# Initialize Groq API
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Best balance of reasoning quality and speed for legal guidance.
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# System prompt for Lex - Pakistan-aware legal mentor
LEX_SYSTEM_PROMPT = """You are Lex, a Pakistan-aware legal mentor and advisor specialized in Pakistani law.
You provide guidance on:
- Constitution of Pakistan (1973, as amended)
- Pakistan Penal Code (PPC)
- Criminal Procedure Code (CrPC)
- Pakistani contract law, tort law, and family law
- Pakistani bar exams and legal education
- Career guidance for lawyers and law students in Pakistan

Always provide accurate, carefully cited legal information. When referencing laws, include the specific section numbers.
If you don't know something or it's outside your domain, acknowledge that and suggest consulting qualified legal professionals.
Be helpful, professional, and maintain the dignity of the Pakistani legal system.
Respond in clear, understandable language suitable for law students through senior advocates."""


# ===== Per-user rate limiting =====
# Sliding-window limiter: at most CHAT_RATE_LIMIT requests per CHAT_RATE_WINDOW_SECONDS
# per Firebase UID. Stored in-process; resets on cold-start. Good enough for an MVP
# and stops a single user from accidentally (or deliberately) burning the Groq budget.
CHAT_RATE_LIMIT = int(os.getenv("CHAT_RATE_LIMIT", "20"))
CHAT_RATE_WINDOW_SECONDS = int(os.getenv("CHAT_RATE_WINDOW_SECONDS", "60"))

_rate_buckets: Dict[str, Deque[float]] = defaultdict(deque)
_rate_lock = Lock()


def _check_rate_limit(uid: str) -> None:
    now = time.monotonic()
    cutoff = now - CHAT_RATE_WINDOW_SECONDS
    with _rate_lock:
        bucket = _rate_buckets[uid]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= CHAT_RATE_LIMIT:
            retry_in = max(1, int(bucket[0] + CHAT_RATE_WINDOW_SECONDS - now))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit reached. Try again in {retry_in}s.",
                headers={"Retry-After": str(retry_in)},
            )
        bucket.append(now)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=5000)


class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    context: Optional[str] = "Pakistani Law"
    history: list[ChatHistoryMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    context: str = "Pakistani Law"


@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat(
    payload: ChatMessage,
    current_user: dict = Depends(verify_firebase_token),
) -> ChatResponse:
    """
    Send a message to Lex (AI legal mentor) and get a response.

    Auth: Firebase ID token (Bearer).
    Rate-limited per UID.
    """
    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured",
        )

    uid = current_user.get("uid") or "anonymous"
    _check_rate_limit(uid)

    messages = [{"role": "system", "content": LEX_SYSTEM_PROMPT}]
    for item in payload.history[-10:]:
        messages.append({"role": item.role, "content": item.content})
    messages.append({"role": "user", "content": payload.message})

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=4000,
            messages=messages,
        )
    except Exception as e:
        logger.exception("Groq request failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream AI error: {e}",
        )

    response_text = response.choices[0].message.content if response.choices else None
    if not response_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an empty response",
        )

    return ChatResponse(reply=response_text, context=payload.context or "Pakistani Law")
