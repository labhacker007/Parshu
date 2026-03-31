"""
Article bookmarks and read tracking for Jyoti.
Allows users to bookmark articles and track reading progress.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, String, Text, UniqueConstraint, Index
from app.core.database import get_db, Base
from app.auth.dependencies import get_current_user
from app.models import User
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/articles/bookmarks", tags=["article-bookmarks"])


# ============================================================================
# Database Model (add to models.py later)
# ============================================================================

class ArticleBookmark(Base):
    """User bookmarks for articles and fetched content."""
    __tablename__ = "article_bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content_id = Column(Integer, ForeignKey("fetched_content.id", ondelete="CASCADE"), nullable=False)
    is_bookmarked = Column(Boolean, default=True)
    is_read = Column(Boolean, default=False)
    notes = Column(String, nullable=True)  # User's personal notes
    bookmarked_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "content_id", name="uq_user_content_bookmark"),
        Index("idx_bookmark_user", "user_id"),
        Index("idx_bookmark_content", "content_id"),
    )


# ============================================================================
# Pydantic Schemas
# ============================================================================

class BookmarkCreate(BaseModel):
    content_id: int
    notes: Optional[str] = None


class BookmarkResponse(BaseModel):
    id: int
    user_id: int
    content_id: int
    is_bookmarked: bool
    is_read: bool
    notes: Optional[str]
    bookmarked_at: datetime
    read_at: Optional[datetime]

    class Config:
        from_attributes = True


class MarkAsReadRequest(BaseModel):
    content_ids: List[int]


# ============================================================================
# Routes
# ============================================================================

@router.post("/", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def create_bookmark(
    bookmark: BookmarkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bookmark an article/content item."""
    # Check if already bookmarked
    existing = db.query(ArticleBookmark).filter(
        ArticleBookmark.user_id == current_user.id,
        ArticleBookmark.content_id == bookmark.content_id
    ).first()

    if existing:
        # Update existing bookmark
        existing.is_bookmarked = True
        existing.notes = bookmark.notes or existing.notes
        existing.bookmarked_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    # Create new bookmark
    new_bookmark = ArticleBookmark(
        user_id=current_user.id,
        content_id=bookmark.content_id,
        notes=bookmark.notes,
        is_bookmarked=True
    )

    db.add(new_bookmark)
    db.commit()
    db.refresh(new_bookmark)

    return new_bookmark


@router.get("/", response_model=List[BookmarkResponse])
async def list_bookmarks(
    include_read: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all bookmarked articles for current user."""
    query = db.query(ArticleBookmark).filter(
        ArticleBookmark.user_id == current_user.id,
        ArticleBookmark.is_bookmarked == True
    )

    if not include_read:
        query = query.filter(ArticleBookmark.is_read == False)

    bookmarks = query.order_by(ArticleBookmark.bookmarked_at.desc()).all()

    return bookmarks


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(
    content_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove bookmark from an article."""
    bookmark = db.query(ArticleBookmark).filter(
        ArticleBookmark.user_id == current_user.id,
        ArticleBookmark.content_id == content_id
    ).first()

    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    # Soft delete - just mark as not bookmarked
    bookmark.is_bookmarked = False
    db.commit()

    return None


@router.post("/{content_id}/mark-read")
async def mark_as_read(
    content_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an article as read."""
    bookmark = db.query(ArticleBookmark).filter(
        ArticleBookmark.user_id == current_user.id,
        ArticleBookmark.content_id == content_id
    ).first()

    if not bookmark:
        # Create bookmark and mark as read
        bookmark = ArticleBookmark(
            user_id=current_user.id,
            content_id=content_id,
            is_bookmarked=False,
            is_read=True,
            read_at=datetime.utcnow()
        )
        db.add(bookmark)
    else:
        # Update existing
        bookmark.is_read = True
        bookmark.read_at = datetime.utcnow()

    db.commit()
    db.refresh(bookmark)

    return {"message": "Marked as read", "content_id": content_id}


@router.post("/mark-read/batch")
async def mark_multiple_as_read(
    request: MarkAsReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark multiple articles as read at once."""
    marked_count = 0

    for content_id in request.content_ids:
        bookmark = db.query(ArticleBookmark).filter(
            ArticleBookmark.user_id == current_user.id,
            ArticleBookmark.content_id == content_id
        ).first()

        if not bookmark:
            bookmark = ArticleBookmark(
                user_id=current_user.id,
                content_id=content_id,
                is_bookmarked=False,
                is_read=True,
                read_at=datetime.utcnow()
            )
            db.add(bookmark)
        else:
            bookmark.is_read = True
            bookmark.read_at = datetime.utcnow()

        marked_count += 1

    db.commit()

    return {
        "message": f"Marked {marked_count} articles as read",
        "count": marked_count
    }


@router.get("/stats")
async def get_reading_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get reading statistics for current user."""
    total_bookmarks = db.query(ArticleBookmark).filter(
        ArticleBookmark.user_id == current_user.id,
        ArticleBookmark.is_bookmarked == True
    ).count()

    total_read = db.query(ArticleBookmark).filter(
        ArticleBookmark.user_id == current_user.id,
        ArticleBookmark.is_read == True
    ).count()

    unread_bookmarks = db.query(ArticleBookmark).filter(
        ArticleBookmark.user_id == current_user.id,
        ArticleBookmark.is_bookmarked == True,
        ArticleBookmark.is_read == False
    ).count()

    return {
        "total_bookmarks": total_bookmarks,
        "total_read": total_read,
        "unread_bookmarks": unread_bookmarks
    }
