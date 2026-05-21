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
  - Groq API (AI chatbot – Pakistan edition)
  - NO LangChain / LangGraph – raw SDK only
"""

from __future__ import annotations

import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Dict, Tuple

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from pydantic import BaseModel, Field


# Add the project root to sys.path to allow absolute imports like 'from api.routers ...'
# when running as a serverless function on Vercel.
project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

load_dotenv(Path(__file__).resolve().parent / ".env")

from api.core import get_db, init_firebase, verify_firebase_token  # noqa: E402


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


# Build the CORS allowlist. We want to support Vercel preview deployments which
# use unpredictable subdomains, so we accept a regex in addition to the static
# list of known production/dev origins.
_static_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://adal-nexus.vercel.app",
]
_vercel_url = os.getenv("VERCEL_URL")
if _vercel_url and _vercel_url not in _static_origins:
    _static_origins.append(
        _vercel_url if _vercel_url.startswith("http") else f"https://{_vercel_url}"
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_static_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Simple in-memory GET cache =====
# Caches GET /api/posts and GET /api/forum/threads for CACHE_TTL seconds.
# Mutations (POST/PUT/DELETE) on the same prefix invalidate the matching keys.
# In-process only — fine for an MVP with a single Vercel function instance.
_response_cache: Dict[str, Tuple[bytes, str, float]] = {}
_cache_lock = Lock()
CACHE_TTL = 30  # seconds
CACHEABLE_PATHS = ("/api/posts", "/api/forum/threads")


def _invalidate_cache_for_path(path: str) -> None:
    with _cache_lock:
        for prefix in CACHEABLE_PATHS:
            if path.startswith(prefix):
                stale = [k for k in _response_cache if prefix in k]
                for k in stale:
                    _response_cache.pop(k, None)


@app.middleware("http")
async def cache_middleware(request: Request, call_next):
    method = request.method
    path = request.url.path

    if method in ("POST", "PUT", "DELETE", "PATCH"):
        _invalidate_cache_for_path(path)
        return await call_next(request)

    if method != "GET" or path not in CACHEABLE_PATHS:
        return await call_next(request)

    cache_key = str(request.url)
    now = time.time()

    with _cache_lock:
        cached = _response_cache.get(cache_key)
    if cached is not None:
        body, media_type, ts = cached
        if now - ts < CACHE_TTL:
            return Response(content=body, status_code=200, media_type=media_type)

    response = await call_next(request)
    if response.status_code != 200:
        return response

    # StreamingResponse body must be drained before we can cache + re-emit it.
    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    with _cache_lock:
        _response_cache[cache_key] = (body, response.media_type or "application/json", now)

    return Response(
        content=body,
        status_code=response.status_code,
        media_type=response.media_type,
        headers={
            k: v
            for k, v in response.headers.items()
            if k.lower() not in {"content-length", "content-type"}
        },
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
class UserSignupPayload(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    userType: str = Field(default="student")  # student, lawyer, judge


_ALLOWED_USER_TYPES = {"student", "lawyer", "judge"}


@app.post("/api/auth/signup")
async def create_user_profile_on_signup(
    payload: UserSignupPayload,
    token: dict = Depends(verify_firebase_token),
):
    """Creates user profile in Firestore with admin privileges (bypasses security rules)."""
    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")

    if payload.userType not in _ALLOWED_USER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"userType must be one of: {', '.join(sorted(_ALLOWED_USER_TYPES))}",
        )

    try:
        db = get_db()
        user_ref = db.collection("users").document(uid)

        if user_ref.get().exists:
            return {"success": True, "message": "Profile already exists", "uid": uid}

        user_ref.set({
            "name": payload.name,
            "email": payload.email,
            "userType": payload.userType,
            "profilePhotoURL": "",
            "year": 1 if payload.userType == "student" else None,
            "specialisations": [],
            "bio": "",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        return {"success": True, "uid": uid}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user profile: {e}",
        )


@app.get("/api/auth/me")
async def get_current_user(token: dict = Depends(verify_firebase_token)):
    """Returns current user's profile from Firestore."""
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
    """Returns public profile for any user (no auth required)."""
    db = get_db()
    user_doc = db.collection("users").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = user_doc.to_dict()
    data["uid"] = uid
    return data


_ALLOWED_PROFILE_FIELDS = {
    "name",
    "bio",
    "specialisations",
    "profilePhotoURL",
    "userType",
    "year",
    "experience",
    "achievements",
    "projects",
    "socialLinks",
}


@app.put("/api/profile")
async def update_profile(update_data: dict, token: dict = Depends(verify_firebase_token)):
    """Updates current user's profile (field allowlist enforced)."""
    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")

    filtered_data = {k: v for k, v in update_data.items() if k in _ALLOWED_PROFILE_FIELDS}
    if "userType" in filtered_data and filtered_data["userType"] not in _ALLOWED_USER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"userType must be one of: {', '.join(sorted(_ALLOWED_USER_TYPES))}",
        )
    filtered_data["updatedAt"] = firestore.SERVER_TIMESTAMP

    db = get_db()
    db.collection("users").document(uid).update(filtered_data)

    updated_doc = db.collection("users").document(uid).get()
    result = updated_doc.to_dict()
    result["uid"] = uid
    return result


# ===== Routers =====
try:
    from api.routers import posts as posts_router
    app.include_router(posts_router.router)
except ImportError as e:
    print(f"Warning: posts router not available: {e}")

try:
    from api.routers import forum as forum_router
    app.include_router(forum_router.router)
except ImportError as e:
    print(f"Warning: forum router not available: {e}")

try:
    from api.routers import chat as chat_router
    app.include_router(chat_router.router)
except ImportError as e:
    print(f"Warning: chat router not available: {e}")


@app.get("/api/version")
def version():
    return {"version": "1.3.0"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
