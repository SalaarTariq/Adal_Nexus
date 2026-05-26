"""Forum endpoints for threads and replies using Firestore."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from firebase_admin import firestore
from pydantic import BaseModel, Field

from api.core import get_current_user_id, get_db, adjust_user_reputation

router = APIRouter(prefix="/api", tags=["forum"])

VALID_CATEGORIES = [
    "Constitutional",
    "Criminal",
    "Corporate",
    "Family",
    "Cyber",
    "Tax",
    "Career Advice",
    "Legal Awareness",
]


def _upvote_doc_id(reply_id: str, user_id: str) -> str:
    """Deterministic upvote-doc ID so toggles can be done in a transaction."""
    return f"{user_id}_{reply_id}"


def _is_constitution_related(thread_data: dict) -> bool:
    """Return True if thread appears to be constitution-focused."""
    title = str(thread_data.get("title", "")).lower()
    description = str(thread_data.get("description", "")).lower()
    tags = [str(tag).lower() for tag in (thread_data.get("tags") or [])]

    return (
        "constitution" in title
        or "constitutional" in title
        or "constitution" in description
        or "constitutional" in description
        or any(tag in {"constitution", "constitutional"} for tag in tags)
    )


class ThreadCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1)
    category: str
    tags: Optional[List[str]] = []


class ThreadUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class ThreadResponse(BaseModel):
    threadId: str
    title: str
    description: str
    category: str
    tags: List[str]
    authorId: str
    replyCount: int
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}


class ReplyCreate(BaseModel):
    content: str = Field(..., min_length=1)


class ReplyResponse(BaseModel):
    replyId: str
    threadId: str
    content: str
    authorId: str
    upvoteCount: int
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}


def _serialize_thread(doc) -> ThreadResponse:
    data = doc.to_dict() or {}
    data["replyCount"] = data.get("replyCount", 0)
    data["tags"] = data.get("tags", []) or []
    return ThreadResponse(threadId=doc.id, **data)


def _serialize_reply(doc) -> ReplyResponse:
    data = doc.to_dict() or {}
    data["upvoteCount"] = data.get("upvoteCount", 0)
    return ReplyResponse(replyId=doc.id, **data)


def _ensure_valid_category(category: str) -> None:
    if category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
        )


# ===== THREADS =====


@router.post("/forum/threads", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    payload: ThreadCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> ThreadResponse:
    """Create a new forum thread."""
    try:
        _ensure_valid_category(payload.category)

        thread_data = {
            "title": payload.title,
            "description": payload.description,
            "category": payload.category,
            "tags": payload.tags or [],
            "authorId": current_user_id,
            "replyCount": 0,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        _, doc_ref = get_db().collection("forumThreads").add(thread_data)
        return _serialize_thread(doc_ref.get())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating thread: {e}",
        )


@router.get("/forum/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(thread_id: str) -> ThreadResponse:
    """Get a single forum thread."""
    try:
        doc = get_db().collection("forumThreads").document(thread_id).get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
        return _serialize_thread(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching thread: {e}",
        )


@router.get("/forum/threads", response_model=List[ThreadResponse])
async def list_threads(
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> List[ThreadResponse]:
    """List all forum threads with optional category filter."""
    try:
        query = (
            get_db()
            .collection("forumThreads")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
        )

        if category:
            _ensure_valid_category(category)

            if category == "Constitutional":
                # Compatibility behavior: include older constitution-related threads
                # that were saved under "Legal Awareness".
                docs = query.limit(max(limit * 5, 50)).get()
                filtered = [
                    _serialize_thread(doc)
                    for doc in docs
                    if (doc.to_dict() or {}).get("category") == "Constitutional"
                    or (
                        (doc.to_dict() or {}).get("category") == "Legal Awareness"
                        and _is_constitution_related(doc.to_dict() or {})
                    )
                ]
                return filtered[skip : skip + limit]

            query = query.where("category", "==", category)

        query = query.offset(skip).limit(limit)
        return [_serialize_thread(doc) for doc in query.get()]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing threads: {e}",
        )


@router.put("/forum/threads/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: str,
    payload: ThreadUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> ThreadResponse:
    """Update a forum thread (only by author)."""
    try:
        thread_ref = get_db().collection("forumThreads").document(thread_id)
        snapshot = thread_ref.get()
        if not snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

        if (snapshot.to_dict() or {}).get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own threads",
            )

        update_data: dict = {}
        if payload.title is not None:
            update_data["title"] = payload.title
        if payload.description is not None:
            update_data["description"] = payload.description
        if payload.category is not None:
            _ensure_valid_category(payload.category)
            update_data["category"] = payload.category
        if payload.tags is not None:
            update_data["tags"] = payload.tags
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP

        thread_ref.update(update_data)
        return _serialize_thread(thread_ref.get())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating thread: {e}",
        )


@router.delete(
    "/forum/threads/{thread_id}",
    status_code=status.HTTP_200_OK,
    response_class=Response,
)
async def delete_thread(
    thread_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> Response:
    """Delete a forum thread (only by author)."""
    try:
        db = get_db()
        thread_ref = db.collection("forumThreads").document(thread_id)
        snapshot = thread_ref.get()
        if not snapshot.exists:
            # Idempotent delete
            return Response(status_code=status.HTTP_200_OK)

        if (snapshot.to_dict() or {}).get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own threads",
            )

        thread_ref.delete()

        # Materialize replies once so we can iterate twice (delete replies, then their upvotes).
        reply_docs = list(
            db.collection("forumReplies").where("threadId", "==", thread_id).get()
        )
        for reply_doc in reply_docs:
            reply_doc.reference.delete()

        for reply_doc in reply_docs:
            upvotes = (
                db.collection("forum_reply_upvotes")
                .where("replyId", "==", reply_doc.id)
                .get()
            )
            for upvote_doc in upvotes:
                upvote_doc.reference.delete()

        return Response(status_code=status.HTTP_200_OK)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting thread: {e}",
        )


# ===== REPLIES =====


@router.post(
    "/forum/threads/{thread_id}/replies",
    response_model=ReplyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reply(
    thread_id: str,
    payload: ReplyCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> ReplyResponse:
    """Create a reply in a forum thread and atomically bump replyCount."""
    try:
        db = get_db()
        thread_ref = db.collection("forumThreads").document(thread_id)
        if not thread_ref.get().exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

        reply_data = {
            "threadId": thread_id,
            "content": payload.content,
            "authorId": current_user_id,
            "upvoteCount": 0,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        # Use a batched write so the reply create + parent counter bump
        # are committed together (atomic-enough for our needs and avoids
        # the race condition of a manual read-then-update).
        reply_ref = db.collection("forumReplies").document()
        batch = db.batch()
        batch.set(reply_ref, reply_data)
        batch.update(thread_ref, {"replyCount": firestore.Increment(1)})
        batch.commit()
        adjust_user_reputation(
            current_user_id,
            delta=2,
            reason="Posted a forum reply",
            ref_type="REPLY",
            ref_id=reply_ref.id,
        )
        return _serialize_reply(reply_ref.get())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating reply: {e}",
        )


@router.get("/forum/threads/{thread_id}/replies", response_model=List[ReplyResponse])
async def list_replies(thread_id: str, skip: int = 0, limit: int = 50) -> List[ReplyResponse]:
    """List replies for a thread, oldest first."""
    try:
        db = get_db()
        if not db.collection("forumThreads").document(thread_id).get().exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

        query = (
            db.collection("forumReplies")
            .where("threadId", "==", thread_id)
            .order_by("createdAt", direction=firestore.Query.ASCENDING)
            .offset(skip)
            .limit(limit)
        )
        return [_serialize_reply(doc) for doc in query.get()]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing replies: {e}",
        )


@router.get("/forum/threads/{thread_id}/my-upvotes")
async def list_my_upvotes_for_thread(
    thread_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> dict:
    """Return reply IDs in this thread that the current user has upvoted."""
    try:
        db = get_db()
        reply_docs = list(
            db.collection("forumReplies").where("threadId", "==", thread_id).get()
        )
        if not reply_docs:
            return {"replyIds": []}

        reply_ids = [doc.id for doc in reply_docs]
        upvoted: list[str] = []
        # Firestore "in" queries support up to 10 entries per call; chunk if needed.
        for chunk_start in range(0, len(reply_ids), 10):
            chunk = reply_ids[chunk_start : chunk_start + 10]
            upvotes = (
                db.collection("forum_reply_upvotes")
                .where("userId", "==", current_user_id)
                .where("replyId", "in", chunk)
                .get()
            )
            for upvote_doc in upvotes:
                data = upvote_doc.to_dict() or {}
                if data.get("replyId"):
                    upvoted.append(data["replyId"])
        return {"replyIds": upvoted}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching upvotes: {e}",
        )


@router.post("/forum/replies/{reply_id}/upvote", status_code=status.HTTP_200_OK)
async def toggle_upvote_reply(
    reply_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> dict:
    """Toggle upvote on a reply atomically."""
    db = get_db()
    reply_ref = db.collection("forumReplies").document(reply_id)
    upvote_ref = db.collection("forum_reply_upvotes").document(
        _upvote_doc_id(reply_id, current_user_id)
    )

    @firestore.transactional
    def _txn(transaction) -> tuple[bool, str | None]:
        reply_snap = reply_ref.get(transaction=transaction)
        if not reply_snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found")

        reply_data = reply_snap.to_dict() or {}
        author_id = reply_data.get("authorId")

        upvote_snap = upvote_ref.get(transaction=transaction)
        if upvote_snap.exists:
            transaction.delete(upvote_ref)
            transaction.update(reply_ref, {"upvoteCount": firestore.Increment(-1)})
            return False, author_id

        transaction.set(
            upvote_ref,
            {
                "replyId": reply_id,
                "userId": current_user_id,
                "createdAt": firestore.SERVER_TIMESTAMP,
            },
        )
        transaction.update(reply_ref, {"upvoteCount": firestore.Increment(1)})
        return True, author_id

    try:
        upvoted, author_id = _txn(db.transaction())
        if author_id:
            delta = 1 if upvoted else -1
            reason = "Received a reply upvote" if upvoted else "Lost a reply upvote"
            adjust_user_reputation(
                author_id,
                delta=delta,
                reason=reason,
                ref_type="UPVOTE",
                ref_id=reply_id,
            )
        return {"upvoted": upvoted, "message": "Upvote added" if upvoted else "Upvote removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error toggling upvote: {e}",
        )
