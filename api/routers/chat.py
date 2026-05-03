"""AI Chat endpoint using Groq API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status, Header, Depends
from pydantic import BaseModel, Field
from typing import Optional, Literal
import os
from groq import Groq

from api.core import verify_firebase_token

router = APIRouter(prefix="/api", tags=["chat"])

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
    
    Only authenticated Firebase users can access this endpoint.
    Responses are generated using Groq API.
    
    Args:
        payload: Chat message with user input
        current_user: Authenticated Firebase user (from token verification)
    """
    try:
        if not groq_client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI service not configured",
            )

        messages = [{"role": "system", "content": LEX_SYSTEM_PROMPT}]

        for item in payload.history[-10:]:
            messages.append({"role": item.role, "content": item.content})

        messages.append({"role": "user", "content": payload.message})

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=4000,
            messages=messages,
        )

        response_text = response.choices[0].message.content if response.choices else None

        if not response_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate response from AI",
            )

        return ChatResponse(
            reply=response_text,
            context=payload.context,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat request: {str(e)}",
        )
