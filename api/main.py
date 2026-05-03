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
import time
from typing import Dict, Tuple
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore, auth
from fastapi import FastAPI, HTTPException, Depends, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent / ".env")

# Global cache for Firebase app and Firestore client
_firebase_app = None
_firestore_client = None

def init_firebase():
    """Initialize Firebase Admin SDK and return the app instance."""
    global _firebase_app
    if _firebase_app:
        return _firebase_app
    
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
    
    _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app

def get_db():
    """Get a cached Firestore client."""
    global _firestore_client
    if _firestore_client is None:
        init_firebase()
        _firestore_client = firestore.client()
    return _firestore_client

def _is_test_mode_allowed() -> bool:
    """
    Check whether test mode is allowed.
    Test mode is ONLY allowed when ENABLE_TEST_MODE=true is set AND
    the environment is NOT production.
    """
    enable_test = os.getenv("ENABLE_TEST_MODE", "false").lower() == "true"
    is_production = os.getenv("VERCEL_ENV", "").lower() == "production" or \
                    os.getenv("NODE_ENV", "").lower() == "production"
    return enable_test and not is_production


async def verify_firebase_token(
    request: Request,
    authorization: str | None = Header(None),
):
    """
    Verify Firebase ID token from Authorization header.
    Returns decoded token dict with uid, email, etc.

    DEV-ONLY: If the request includes the header `X-Test-Mode: true` and
    the env var ENABLE_TEST_MODE=true is set (and we are NOT in production),
    token verification is skipped and a hard-coded test user is returned.
    """
    # --- Test mode bypass (development only) ---
    test_mode = request.headers.get("x-test-mode", "").lower() == "true"
    
    if test_mode:
        if not _is_test_mode_allowed():
            raise HTTPException(
                status_code=403,
                detail="Test mode is not allowed in this environment",
            )
        return {
            "uid": "test_user_123",
            "email": "test@adalcommunity.pk",
            "name": "Test User",
        }

    # --- Normal Firebase token verification ---
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token_str = authorization.split(" ", 1)[1]
    try:
        decoded = auth.verify_id_token(token_str)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def get_current_user_id(
    token: dict = Depends(verify_firebase_token),
) -> str:
    """
    Convenience dependency that extracts just the uid string
    from the verified token dict. Use this in routers that
    need the user ID as a plain string.
    """
    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")
    return uid


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

# Simple in-memory cache for GET requests (with TTL)
_response_cache: Dict[str, Tuple[str, float]] = {}
CACHE_TTL = 30  # 30 seconds


@app.middleware("http")
async def cache_middleware(request: Request, call_next):
    """Cache GET requests to /api/posts and /api/forum/threads for 30 seconds."""
    # Clear cache on mutation requests
    if request.method in ["POST", "PUT", "DELETE"]:
        if request.url.path.startswith("/api/posts"):
            keys_to_delete = [k for k in _response_cache.keys() if "/api/posts" in k]
            for k in keys_to_delete:
                del _response_cache[k]
        elif request.url.path.startswith("/api/forum/threads"):
            keys_to_delete = [k for k in _response_cache.keys() if "/api/forum/threads" in k]
            for k in keys_to_delete:
                del _response_cache[k]
        return await call_next(request)
        
    # Only cache GET requests
    if request.method != "GET":
        return await call_next(request)
    
    # Only cache specific endpoints
    if request.url.path not in ["/api/posts", "/api/forum/threads"]:
        return await call_next(request)
    
    # Create cache key from path and query params
    cache_key = str(request.url)
    now = time.time()
    
    # Check cache
    if cache_key in _response_cache:
        cached_response, timestamp = _response_cache[cache_key]
        if now - timestamp < CACHE_TTL:
            return Response(
                content=cached_response,
                status_code=200,
                media_type="application/json",
            )
    
    # Get fresh response
    response = await call_next(request)
    
    # Cache if successful
    if response.status_code == 200:
        body = b""
        async for chunk in response.body_iterator:
            body += chunk
        
        _response_cache[cache_key] = (body.decode(), now)
        return Response(
            content=body,
            status_code=response.status_code,
            media_type=response.media_type,
        )
    
    return response


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
from pydantic import BaseModel, Field

class UserSignupPayload(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    userType: str = Field(default="student")  # student, lawyer, judge

@app.post("/api/auth/signup")
async def create_user_profile_on_signup(payload: UserSignupPayload, token: dict = Depends(verify_firebase_token)):
    """
    POST /api/auth/signup
    Called by frontend after Firebase Auth signup succeeds.
    Creates user profile in Firestore with admin privileges (bypasses security rules).
    """
    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")
    
    try:
        db = get_db()
        user_ref = db.collection("users").document(uid)
        
        # Check if profile already exists
        if user_ref.get().exists:
            return {"success": True, "message": "Profile already exists"}
        
        # Create profile with admin write (bypasses security rules)
        user_ref.set({
            "name": payload.name,
            "email": payload.email,
            "userType": payload.userType,
            "profilePhotoURL": "",
            "year": 1 if payload.userType == "student" else None,
            "specialisations": [],
            "bio": "",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        })
        
        return {"success": True, "uid": uid}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user profile: {str(e)}"
        )

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
    allowed_fields = {"name", "bio", "specialisations", "profilePhotoURL", "userType", "year", "experience", "achievements", "projects", "socialLinks"}
    filtered_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    filtered_data["updatedAt"] = datetime.utcnow()
    
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
