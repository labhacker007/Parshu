"""Admin management of default feed sources."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import DefaultFeedSource, FeedSource, User
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter(prefix="/admin/default-feeds", tags=["admin"])


class DefaultFeedSourceResponse(BaseModel):
    id: int
    source_id: int
    source_name: str
    source_url: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[DefaultFeedSourceResponse])
def list_default_feeds(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """List all default feed sources (admin only)."""
    defaults = db.query(DefaultFeedSource).join(FeedSource).all()

    return [
        DefaultFeedSourceResponse(
            id=d.id,
            source_id=d.source_id,
            source_name=d.source.name,
            source_url=d.source.url,
            is_default=d.is_default,
            created_at=d.created_at
        )
        for d in defaults
    ]


@router.post("/{source_id}", status_code=status.HTTP_201_CREATED)
def add_default_feed(
    source_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Mark a feed source as default for new users."""
    source = db.query(FeedSource).filter(FeedSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Feed source not found")

    # Check if already marked as default
    existing = db.query(DefaultFeedSource).filter(
        DefaultFeedSource.source_id == source_id
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Already a default feed")

    default_feed = DefaultFeedSource(
        source_id=source_id,
        is_default=True,
        created_by_id=current_user.id,
        created_at=datetime.utcnow()
    )

    db.add(default_feed)
    db.commit()
    db.refresh(default_feed)

    return {
        "message": f"'{source.name}' marked as default feed for new users",
        "default_feed_id": default_feed.id
    }


@router.delete("/{source_id}")
def remove_default_feed(
    source_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Remove default feed marking."""
    default = db.query(DefaultFeedSource).filter(
        DefaultFeedSource.source_id == source_id
    ).first()

    if not default:
        raise HTTPException(status_code=404, detail="Not a default feed")

    source_name = default.source.name if default.source else "Unknown"
    db.delete(default)
    db.commit()

    return {"message": f"'{source_name}' removed from default feeds"}


@router.get("/stats")
def get_default_feeds_stats(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Get statistics about default feeds."""
    total_defaults = db.query(DefaultFeedSource).count()
    total_sources = db.query(FeedSource).filter(FeedSource.is_active == True).count()

    return {
        "total_default_feeds": total_defaults,
        "total_active_sources": total_sources,
        "non_default_sources": total_sources - total_defaults
    }
