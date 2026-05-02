"""
Adal Nexus – Pakistan Legal Community Platform
FastAPI backend (Firebase MVP Edition).

Deployed by Vercel as serverless functions via @vercel/python.
Uses Firebase Firestore for data, Firebase Auth for authentication.

Local dev:  uvicorn api.main:app --reload --port 8000
Next.js dev server proxies /api/* to this server (see next.config.js).

Stack:
  - Python 3.11+ / FastAPI
  - Firebase Firestore (NoSQL database)
  - Firebase Authentication (ID token verification)
  - Google Gemini API (AI chatbot – Pakistan edition)
  - NO LangChain / LangGraph – raw SDK only
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, auth
from fastapi import FastAPI, HTTPException, Depends, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from functools import lru_cache
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent / ".env")

# Initialize Firebase Admin SDK
_firebase_initialized = False

def init_firebase():
    """Initialize Firebase Admin SDK."""
    global _firebase_initialized
    if _firebase_initialized:
        return
    
    # Check if running on Vercel (use env vars) or locally (use service account file)
    if os.getenv("FIREBASE_PRIVATE_KEY"):
        # Vercel environment – credentials from env vars
        cred_dict = {
            "type": "service_account",
            "project_id": os.getenv("FIREBASE_PROJECT_ID"),
            "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", ""),
            "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
            "client_id": os.getenv("FIREBASE_CLIENT_ID", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        }
        cred = credentials.Certificate(cred_dict)
    else:
        # Local development – using service account JSON file
        cred = credentials.Certificate("./firebase-key.json")
    
    firebase_admin.initialize_app(cred)
    _firebase_initialized = True

@lru_cache(maxsize=1)
def get_db():
    """Get Firestore client (cached)."""
    init_firebase()
    return firestore.client()

async def verify_firebase_token(authorization: str | None = Header(None)):
    """
    Verify Firebase ID token from Authorization header.
    Returns decoded token dict with uid, email, etc.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token_str = authorization.split(" ", 1)[1]
    try:
        init_firebase()
        decoded = auth.verify_id_token(token_str)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """App lifecycle: initialize Firebase on startup."""
    init_firebase()
    yield


# Initialize FastAPI app
app = FastAPI(
    title="Adal Nexus API",
    description="Backend for Pakistan's Legal Community Platform (Firebase MVP).",
    version="1.3.0",
    lifespan=lifespan,
)

# Ensure Firebase is ready before router modules import Firestore clients.
init_firebase()

# CORS for Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://adal-nexus.vercel.app",  # Production Vercel domain
        os.getenv("VERCEL_URL", ""),  # Vercel preview deployment
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Health Check =====
@app.get("/")
async def root():
    """Root endpoint for browser checks."""
    return {"status": "ok", "service": "Adal Nexus API"}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Avoid noisy favicon 404s during browser navigation."""
    return Response(status_code=204)


@app.get("/api/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "version": "1.3.0", "database": "Firebase Firestore"}


# ===== Authentication =====
@app.get("/api/auth/me")
async def get_current_user(token: dict = Depends(verify_firebase_token)):
    """
    GET /api/auth/me
    Returns current user's profile from Firestore.
    """
    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")
    
    db = get_db()
    user_doc = db.collection("users").document(uid).get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = user_doc.to_dict()
    user_data["uid"] = uid
    return user_data


# ===== Profiles =====
@app.get("/api/profile/{uid}")
async def get_profile(uid: str):
    """
    GET /api/profile/{uid}
    Returns public profile for any user (no auth required).
    """
    db = get_db()
    user_doc = db.collection("users").document(uid).get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    data = user_doc.to_dict()
    data["uid"] = uid
    return data


@app.put("/api/profile")
async def update_profile(update_data: dict, token: dict = Depends(verify_firebase_token)):
    """
    PUT /api/profile
    Updates current user's profile.
    """
    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")
    
    # Sanitize: only allow certain fields
    allowed_fields = {"name", "bio", "specialisations", "profilePhotoURL", "userType", "year"}
    filtered_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    db = get_db()
    db.collection("users").document(uid).update(filtered_data)
    
    updated_doc = db.collection("users").document(uid).get()
    result = updated_doc.to_dict()
    result["uid"] = uid
    return result







# Include routers (Firebase Firestore backed)
try:
    from api.routers import posts as posts_router
    app.include_router(posts_router.router)
except ImportError:
    print("Warning: posts router not available")

try:
    from api.routers import forum as forum_router
    app.include_router(forum_router.router)
except ImportError:
    print("Warning: forum router not available")

try:
    from api.routers import chat as chat_router
    app.include_router(chat_router.router)
except ImportError:
    print("Warning: chat router not available")

# Version endpoint
@app.get("/api/version")
def version():
    return {"version": "1.3.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
