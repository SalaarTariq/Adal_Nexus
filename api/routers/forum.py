"""Forum endpoints for threads and replies using Firestore."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status, Depends, Response
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import firebase_admin
from firebase_admin import firestore

from api.main import get_current_user_id, get_db

router = APIRouter(prefix="/api", tags=["forum"])
db = get_db()

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


# ===== THREADS =====


@router.post("/forum/threads", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    payload: ThreadCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> ThreadResponse:
    """Create a new forum thread."""
    try:
        if payload.category not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
            )

        thread_data = {
            "title": payload.title,
            "description": payload.description,
            "category": payload.category,
            "tags": payload.tags or [],
            "authorId": current_user_id,
            "replyCount": 0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        doc_ref = db.collection("forumThreads").add(thread_data)
        thread_id = doc_ref[1].id

        return ThreadResponse(
            threadId=thread_id,
            **thread_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating thread: {str(e)}",
        )


@router.get("/forum/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(thread_id: str) -> ThreadResponse:
    """Get a single forum thread."""
    try:
        doc = db.collection("forumThreads").document(thread_id).get()
        if not doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found",
            )

        thread_data = doc.to_dict()
        return ThreadResponse(
            threadId=thread_id,
            **thread_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching thread: {str(e)}",
        )


@router.get("/forum/threads", response_model=List[ThreadResponse])
async def list_threads(
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> List[ThreadResponse]:
    """List all forum threads with optional category filter."""
    try:
        db = get_db()
        query = db.collection("forumThreads").order_by(
            "createdAt", direction=firestore.Query.DESCENDING
        )

        if category:
            if category not in VALID_CATEGORIES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
                )

            if category == "Constitutional":
                # Compatibility behavior: include older constitution-related threads
                # that were saved under "Legal Awareness".
                docs = query.limit(max(limit * 5, 50)).get()
                filtered_threads = []
                for doc in docs:
                    thread_data = doc.to_dict()
                    if thread_data.get("category") == "Constitutional" or (
                        thread_data.get("category") == "Legal Awareness"
                        and _is_constitution_related(thread_data)
                    ):
                        filtered_threads.append(
                            ThreadResponse(
                                threadId=doc.id,
                                **thread_data,
                            )
                        )

                return filtered_threads[skip : skip + limit]

            query = query.where("category", "==", category)

        query = query.offset(skip).limit(limit)

        docs = query.get()
        threads = []
        for doc in docs:
            thread_data = doc.to_dict()
            threads.append(
                ThreadResponse(
                    threadId=doc.id,
                    **thread_data,
                )
            )

        return threads
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing threads: {str(e)}",
        )


@router.put("/forum/threads/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: str,
    payload: ThreadUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> ThreadResponse:
    """Update a forum thread (only by author)."""
    try:
        doc = db.collection("forumThreads").document(thread_id).get()
        if not doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found",
            )

        thread_data = doc.to_dict()
        if thread_data.get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own threads",
            )

        update_data = {}
        if payload.title is not None:
            update_data["title"] = payload.title
        if payload.description is not None:
            update_data["description"] = payload.description
        if payload.category is not None:
            if payload.category not in VALID_CATEGORIES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
                )
            update_data["category"] = payload.category
        if payload.tags is not None:
            update_data["tags"] = payload.tags

        update_data["updatedAt"] = datetime.utcnow()

        db.collection("forumThreads").document(thread_id).update(update_data)

        updated_doc = db.collection("forumThreads").document(thread_id).get()
        updated_data = updated_doc.to_dict()
        return ThreadResponse(
            threadId=thread_id,
            **updated_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating thread: {str(e)}",
        )


@router.delete(
    "/forum/threads/{thread_id}",
    status_code=status.HTTP_200_OK,
    response_class=Response,
)
async def delete_thread(
    thread_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """Delete a forum thread (only by author)."""
    try:
        doc = db.collection("forumThreads").document(thread_id).get()
        if not doc.exists:
            # Idempotent delete
            return Response(status_code=status.HTTP_200_OK)

        thread_data = doc.to_dict()
        if thread_data.get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own threads",
            )

        # Delete thread
        db.collection("forumThreads").document(thread_id).delete()

        # Delete all replies
        replies = db.collection("forumReplies").where("threadId", "==", thread_id).get()
        for reply_doc in replies:
            reply_doc.reference.delete()

        # Delete all upvotes for replies in this thread
        for reply_doc in replies:
            reply_id = reply_doc.id
            upvotes = (
                db.collection("forum_reply_upvotes")
                .where("replyId", "==", reply_id)
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
            detail=f"Error deleting thread: {str(e)}",
        )


# ===== REPLIES =====


@router.post("/forum/threads/{thread_id}/replies", response_model=ReplyResponse, status_code=status.HTTP_201_CREATED)
async def create_reply(
    thread_id: str,
    payload: ReplyCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> ReplyResponse:
    """Create a reply in a forum thread."""
    try:
        # Check if thread exists
        thread_doc = db.collection("forumThreads").document(thread_id).get()
        if not thread_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found",
            )

        reply_data = {
            "threadId": thread_id,
            "content": payload.content,
            "authorId": current_user_id,
            "upvoteCount": 0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        doc_ref = db.collection("forumReplies").add(reply_data)
        reply_id = doc_ref[1].id

        # Increment thread's reply count
        thread_data = thread_doc.to_dict()
        new_reply_count = thread_data.get("replyCount", 0) + 1
        db.collection("forumThreads").document(thread_id).update({
            "replyCount": new_reply_count,
        })

        return ReplyResponse(
            replyId=reply_id,
            **reply_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating reply: {str(e)}",
        )


@router.get("/forum/threads/{thread_id}/replies", response_model=List[ReplyResponse])
async def list_replies(thread_id: str, skip: int = 0, limit: int = 50) -> List[ReplyResponse]:
    """List all replies for a thread."""
    try:
        db = get_db()
        # Check if thread exists
        thread_doc = db.collection("forumThreads").document(thread_id).get()
        if not thread_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found",
            )
        docs = (
            db.collection("forumReplies")
            .where("threadId", "==", thread_id)
            .get()
        )

        replies = []
        for doc in docs:
            reply_data = doc.to_dict()
            replies.append(
                ReplyResponse(
                    replyId=doc.id,
                    **reply_data,
                )
            )

        replies.sort(key=lambda reply: reply.createdAt)
        return replies[skip : skip + limit]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing replies: {str(e)}",
        )


@router.post("/forum/replies/{reply_id}/upvote", status_code=status.HTTP_200_OK)
async def toggle_upvote_reply(
    reply_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> dict:
    """Toggle upvote on a reply."""
    try:
        # Check if reply exists
        reply_doc = db.collection("forumReplies").document(reply_id).get()
        if not reply_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reply not found",
            )

        # Check if already upvoted
        existing = (
            db.collection("forum_reply_upvotes")
            .where("replyId", "==", reply_id)
            .where("userId", "==", current_user_id)
            .get()
        )

        if existing:
            # Remove upvote
            for doc in existing:
                doc.reference.delete()

            # Decrement upvote count
            reply_data = reply_doc.to_dict()
            new_count = max(0, reply_data.get("upvoteCount", 0) - 1)
            db.collection("forumReplies").document(reply_id).update({
                "upvoteCount": new_count,
            })

            return {"upvoted": False, "message": "Upvote removed"}
        else:
            # Add upvote
            db.collection("forum_reply_upvotes").add({
                "replyId": reply_id,
                "userId": current_user_id,
                "createdAt": datetime.utcnow(),
            })

            # Increment upvote count
            reply_data = reply_doc.to_dict()
            new_count = reply_data.get("upvoteCount", 0) + 1
            db.collection("forumReplies").document(reply_id).update({
                "upvoteCount": new_count,
            })

            return {"upvoted": True, "message": "Upvote added"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error toggling upvote: {str(e)}",
        )
