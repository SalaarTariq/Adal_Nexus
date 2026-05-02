"""Post CRUD endpoints using Firestore."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status, Depends, Response
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import firebase_admin
from firebase_admin import firestore

from api.main import verify_firebase_token, get_db

router = APIRouter(prefix="/api", tags=["posts"])
db = get_db()


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


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreate,
    current_user_id: str = Depends(verify_firebase_token),
) -> PostResponse:
    """Create a new post."""
    try:
        print(f"[create_post] Starting for user {current_user_id}, title: {payload.title[:50]}")
        post_data = {
            "title": payload.title,
            "content": payload.content,
            "tags": payload.tags or [],
            "authorId": current_user_id,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        print(f"[create_post] Writing to Firestore...")
        doc_ref = db.collection("posts").add(post_data)
        print(f"[create_post] Firestore write returned: {doc_ref}")
        post_id = doc_ref[1].id
        print(f"[create_post] Post created with ID: {post_id}")

        return PostResponse(
            postId=post_id,
            likeCount=0,
            **post_data,
        )
    except Exception as e:
        print(f"[create_post] Exception: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating post: {str(e)}",
        )


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: str) -> PostResponse:
    """Get a single post by ID."""
    try:
        doc = db.collection("posts").document(post_id).get()
        if not doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found",
            )

        # Count likes for this post
        likes_query = db.collection("post_likes").where("postId", "==", post_id)
        like_count = sum(1 for _ in likes_query.stream())

        post_data = doc.to_dict()
        return PostResponse(
            postId=post_id,
            likeCount=like_count,
            **post_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching post: {str(e)}",
        )


@router.get("/posts", response_model=List[PostResponse])
async def list_posts(skip: int = 0, limit: int = 20) -> List[PostResponse]:
    """List all posts with pagination."""
    try:
        posts = []
        query = (
            db.collection("posts")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .offset(skip)
            .limit(limit)
        )

        for doc in query.stream():
            # Count likes for each post
            post_id = doc.id
            likes_query = db.collection("post_likes").where("postId", "==", post_id)
            like_count = sum(1 for _ in likes_query.stream())

            post_data = doc.to_dict()
            posts.append(
                PostResponse(
                    postId=post_id,
                    likeCount=like_count,
                    **post_data,
                )
            )

        return posts
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing posts: {str(e)}",
        )


@router.put("/posts/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    payload: PostUpdate,
    current_user_id: str = Depends(verify_firebase_token),
) -> PostResponse:
    """Update a post (only by author)."""
    try:
        doc = db.collection("posts").document(post_id).get()
        if not doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found",
            )

        post_data = doc.to_dict()
        if post_data.get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own posts",
            )

        # Prepare update data
        update_data = {}
        if payload.title is not None:
            update_data["title"] = payload.title
        if payload.content is not None:
            update_data["content"] = payload.content
        if payload.tags is not None:
            update_data["tags"] = payload.tags

        update_data["updatedAt"] = datetime.utcnow()

        db.collection("posts").document(post_id).update(update_data)

        # Fetch updated post
        updated_doc = db.collection("posts").document(post_id).get()
        likes_query = db.collection("post_likes").where("postId", "==", post_id)
        like_count = sum(1 for _ in likes_query.stream())

        updated_data = updated_doc.to_dict()
        return PostResponse(
            postId=post_id,
            likeCount=like_count,
            **updated_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating post: {str(e)}",
        )


@router.delete(
    "/posts/{post_id}",
    status_code=status.HTTP_200_OK,
    response_class=Response,
)
async def delete_post(
    post_id: str,
    current_user_id: str = Depends(verify_firebase_token),
) -> None:
    """Delete a post (only by author)."""
    try:
        doc = db.collection("posts").document(post_id).get()
        if not doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found",
            )

        post_data = doc.to_dict()
        if post_data.get("authorId") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own posts",
            )

        # Delete post and associated likes
        db.collection("posts").document(post_id).delete()
        
        # Delete likes
        likes_query = db.collection("post_likes").where("postId", "==", post_id)
        for like_doc in likes_query.stream():
            like_doc.reference.delete()

        return Response(status_code=status.HTTP_200_OK)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting post: {str(e)}",
        )


@router.post("/posts/{post_id}/like", status_code=status.HTTP_200_OK)
async def toggle_like_post(
    post_id: str,
    current_user_id: str = Depends(verify_firebase_token),
) -> dict:
    """Toggle like on a post."""
    try:
        # Check if post exists
        post_doc = db.collection("posts").document(post_id).get()
        if not post_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found",
            )

        # Check if already liked
        existing = (
            db.collection("post_likes")
            .where("postId", "==", post_id)
            .where("userId", "==", current_user_id)
            .get()
        )

        if existing:
            # Unlike
            for doc in existing:
                doc.reference.delete()
            return {"liked": False, "message": "Post unliked"}
        else:
            # Like
            db.collection("post_likes").add({
                "postId": post_id,
                "userId": current_user_id,
                "createdAt": datetime.utcnow(),
            })
            return {"liked": True, "message": "Post liked"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error toggling like: {str(e)}",
        )
