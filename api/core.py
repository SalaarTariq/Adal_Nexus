import os
from pathlib import Path
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore, auth
from fastapi import HTTPException, Header, Request, Depends
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")

# Global cache for Firebase app and Firestore client
_firebase_app = None
_firestore_client = None

def init_firebase():
    """Initialize Firebase Admin SDK and return the app instance."""
    global _firebase_app
    if _firebase_app:
        return _firebase_app
    
    # Check if already initialized by another module (prevents "app already exists" error)
    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    # Check if running on Vercel (use env vars) or locally (use service account file)
    private_key = os.getenv("FIREBASE_PRIVATE_KEY")
    if private_key:
        # Vercel environment – credentials from env vars
        cred_dict = {
            "type": "service_account",
            "project_id": os.getenv("FIREBASE_PROJECT_ID"),
            "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", ""),
            "private_key": private_key.replace("\\n", "\n"),
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
            "client_id": os.getenv("FIREBASE_CLIENT_ID", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        }
        cred = credentials.Certificate(cred_dict)
    else:
        # Local development – using service account JSON file
        key_path = Path(__file__).resolve().parent / "firebase-key.json"
        if key_path.exists():
            cred = credentials.Certificate(str(key_path))
        else:
            print("Warning: Firebase credentials not found (env or file)")
            return None
    
    _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app

def get_db():
    """Get a cached Firestore client."""
    global _firestore_client
    if _firestore_client is None:
        if init_firebase() is None:
            # Return a dummy client or handle it in the routers
            # For now, let's allow it to fail later or return None
            return None
        _firestore_client = firestore.client()
    return _firestore_client

def _is_test_mode_allowed() -> bool:
    """Test-mode header bypass is only honoured outside any deployed environment.

    Requires ENABLE_TEST_MODE=true AND no VERCEL_ENV (so it's off on preview
    and production deployments) AND NODE_ENV is not "production".
    """
    enable_test = os.getenv("ENABLE_TEST_MODE", "false").lower() == "true"
    vercel_env = os.getenv("VERCEL_ENV", "").lower()  # "production" | "preview" | "development" | ""
    is_node_prod = os.getenv("NODE_ENV", "").lower() == "production"
    return enable_test and vercel_env in ("", "development") and not is_node_prod

async def verify_firebase_token(
    request: Request,
    authorization: str | None = Header(None),
):
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

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token_str = authorization.split(" ", 1)[1]
    try:
        init_firebase()
        decoded = auth.verify_id_token(token_str)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

async def get_current_user_id(
    token: dict = Depends(verify_firebase_token),
) -> str:
    uid = token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")
    return uid
