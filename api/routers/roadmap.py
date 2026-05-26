"""Roadmap progress router using Firestore and reputation scoring."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import firestore
from pydantic import BaseModel, Field

from api.core import get_current_user_id, get_db, adjust_user_reputation

router = APIRouter(prefix="/api", tags=["roadmap"])
logger = logging.getLogger(__name__)


class RoadmapMilestonePayload(BaseModel):
    year: int = Field(..., ge=1, le=4)
    milestone: str = Field(..., min_length=1)
    completed: bool


@router.post("/roadmap/milestone", status_code=status.HTTP_200_OK)
async def update_milestone_endpoint(
    payload: RoadmapMilestonePayload,
    current_user_id: str = Depends(get_current_user_id),
) -> dict:
    """Updates a user's roadmap milestone completion state and dynamically adjusts reputation (+10/-10)."""
    try:
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable",
            )

        progress_ref = db.collection("roadmapProgress").document(current_user_id)
        year_key = f"year{payload.year}"
        milestone_field = f"{year_key}.{payload.milestone}"

        @firestore.transactional
        def _txn(transaction) -> tuple[bool, bool]:
            """Perform read and write inside Firestore transaction."""
            progress_snap = progress_ref.get(transaction=transaction)
            
            # Determine previous status
            prev_status = False
            if progress_snap.exists:
                progress_data = progress_snap.to_dict() or {}
                prev_status = progress_data.get(year_key, {}).get(payload.milestone, False)

            # If no change, return immediately to save operations
            if prev_status == payload.completed:
                return False, prev_status

            # Make updates inside transaction
            if not progress_snap.exists:
                transaction.set(
                    progress_ref,
                    {
                        year_key: {
                            payload.milestone: payload.completed,
                        },
                        "updatedAt": firestore.SERVER_TIMESTAMP,
                    },
                )
            else:
                transaction.update(
                    progress_ref,
                    {
                        milestone_field: payload.completed,
                        "updatedAt": firestore.SERVER_TIMESTAMP,
                    },
                )

            return True, prev_status

        # Execute transaction
        changed, prev_status = _txn(db.transaction())

        # Award/deduct reputation points if status changed
        if changed:
            delta = 10 if payload.completed else -10
            reason = f"Completed milestone: {payload.milestone} (Year {payload.year})" if payload.completed else f"Unchecked milestone: {payload.milestone} (Year {payload.year})"
            
            adjust_user_reputation(
                current_user_id,
                delta=delta,
                reason=reason,
                ref_type="MILESTONE",
                ref_id=f"{year_key}_{payload.milestone}",
            )

        return {
            "success": True,
            "changed": changed,
            "previousCompleted": prev_status,
            "completed": payload.completed,
        }

    except Exception as e:
        logger.exception("Error updating milestone")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating milestone: {e}",
        )
