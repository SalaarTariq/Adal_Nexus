"""Post CRUD endpoints using Firestore."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from firebase_admin import firestore
from pydantic import BaseModel, Field

from api.core import get_current_user_id, get_db, adjust_user_reputation

router = APIRouter(prefix="/api", tags=["posts"])


class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    tags: Optional[List[str]] = []


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class PostResponse(BaseModel):
    postId: str
    title: str
    content: str
    tags: List[str]
    authorId: str
    createdAt: datetime
    updatedAt: datetime
    likeCount: int = 0

    model_config = {"from_attributes": True}


def _like_doc_id(post_id: str, user_id: str) -> str:
    """Deterministic like-doc ID so toggles can be done in a transaction."""
    return f"{user_id}_{post_id}"


def _serialize_post(doc) -> PostResponse:
    data = doc.to_dict() or {}
    data["likeCount"] = data.get("likeCount", 0)
    data["tags"] = data.get("tags", []) or []
    return PostResponse(postId=doc.id, **data)


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreate,
    current_user_id: str = Depends(get_current_user_id),
) -> PostResponse:
    """Create a new post."""
    try:
        post_data = {
            "title": payload.title,
            "content": payload.content,
            "tags": payload.tags or [],
            "authorId": current_user_id,
            "likeCount": 0,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        _, doc_ref = get_db().collection("posts").add(post_data)
        adjust_user_reputation(
            current_user_id,
            delta=5,
            reason="Created a new post",
            ref_type="POST",
            ref_id=doc_ref.id,
        )
        snapshot = doc_ref.get()
        return _serialize_post(snapshot)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating post: {e}",
        )


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: str) -> PostResponse:
    """Get a single post by ID."""
    try:
        doc = get_db().collection("posts").document(post_id).get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        return _serialize_post(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching post: {e}",
        )


@router.get("/posts/{post_id}/liked")
async def get_user_post_like(
    post_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> dict:
    """Return whether the authenticated user has liked the post."""
    try:
        like_ref = get_db().collection("post_likes").document(_like_doc_id(post_id, current_user_id))
        return {"liked": like_ref.get().exists}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking like state: {e}",
        )


@router.get("/posts", response_model=List[PostResponse])
async def list_posts(skip: int = 0, limit: int = 20) -> List[PostResponse]:
    """List posts, newest first."""
    try:
        query = (
            get_db()
            .collection("posts")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .offset(skip)
            .limit(limit)
        )
        return [_serialize_post(doc) for doc in query.get()]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing posts: {e}",
        )


@router.put("/posts/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    payload: PostUpdate,
    current_user_id: str = Depends(get_current_user_id),
) -> PostResponse:
    """Update a post (only by author)."""
    try:
        post_ref = get_db().collection("posts").document(post_id)
        snapshot = post_ref.get()
        if not snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

        if (snapshot.to_dict() or {}).get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own posts",
            )

        update_data: dict = {}
        if payload.title is not None:
            update_data["title"] = payload.title
        if payload.content is not None:
            update_data["content"] = payload.content
        if payload.tags is not None:
            update_data["tags"] = payload.tags
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP

        post_ref.update(update_data)
        return _serialize_post(post_ref.get())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating post: {e}",
        )


@router.delete(
    "/posts/{post_id}",
    status_code=status.HTTP_200_OK,
    response_class=Response,
)
async def delete_post(
    post_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> Response:
    """Delete a post (only by author)."""
    try:
        db = get_db()
        post_ref = db.collection("posts").document(post_id)
        snapshot = post_ref.get()
        if not snapshot.exists:
            # Idempotent delete: if it's already gone, return success
            return Response(status_code=status.HTTP_200_OK)

        if (snapshot.to_dict() or {}).get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own posts",
            )

        post_ref.delete()
        adjust_user_reputation(
            current_user_id,
            delta=-5,
            reason="Deleted a post",
            ref_type="POST",
            ref_id=post_id,
        )

        # Cascade-delete likes for this post.
        likes_query = db.collection("post_likes").where("postId", "==", post_id)
        for like_doc in likes_query.stream():
            like_doc.reference.delete()

        return Response(status_code=status.HTTP_200_OK)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting post: {e}",
        )


@router.post("/posts/{post_id}/like", status_code=status.HTTP_200_OK)
async def toggle_like_post(
    post_id: str,
    current_user_id: str = Depends(get_current_user_id),
) -> dict:
    """Toggle like on a post atomically."""
    db = get_db()
    post_ref = db.collection("posts").document(post_id)
    like_ref = db.collection("post_likes").document(_like_doc_id(post_id, current_user_id))

    @firestore.transactional
    def _txn(transaction) -> bool:
        post_snap = post_ref.get(transaction=transaction)
        if not post_snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

        like_snap = like_ref.get(transaction=transaction)
        if like_snap.exists:
            transaction.delete(like_ref)
            transaction.update(post_ref, {"likeCount": firestore.Increment(-1)})
            return False

        transaction.set(
            like_ref,
            {
                "postId": post_id,
                "userId": current_user_id,
                "createdAt": firestore.SERVER_TIMESTAMP,
            },
        )
        transaction.update(post_ref, {"likeCount": firestore.Increment(1)})
        return True

    try:
        liked = _txn(db.transaction())
        return {"liked": liked, "message": "Post liked" if liked else "Post unliked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error toggling like: {e}",
        )
