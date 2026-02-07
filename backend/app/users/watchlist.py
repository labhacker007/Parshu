"""User-specific watchlist management."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models import User, UserWatchListKeyword
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter(prefix="/users/watchlist", tags=["user-watchlist"])


class UserWatchlistCreate(BaseModel):
    keyword: str


class UserWatchlistResponse(BaseModel):
    id: int
    user_id: int
    keyword: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserWatchlistResponse])
def list_user_watchlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List current user's watchlist keywords."""
    keywords = db.query(UserWatchListKeyword).filter(
        UserWatchListKeyword.user_id == current_user.id
    ).order_by(UserWatchListKeyword.keyword).all()

    return keywords


@router.post("/", response_model=UserWatchlistResponse, status_code=status.HTTP_201_CREATED)
def create_user_watchlist_keyword(
    payload: UserWatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add keyword to user's watchlist."""
    keyword = payload.keyword.strip().lower()

    if not keyword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Keyword cannot be empty"
        )

    # Check for duplicates
    existing = db.query(UserWatchListKeyword).filter(
        UserWatchListKeyword.user_id == current_user.id,
        UserWatchListKeyword.keyword == keyword
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Keyword already in your watchlist"
        )

    keyword_obj = UserWatchListKeyword(
        user_id=current_user.id,
        keyword=keyword,
        is_active=True
    )

    db.add(keyword_obj)
    db.commit()
    db.refresh(keyword_obj)

    return keyword_obj


@router.patch("/{keyword_id}/toggle")
def toggle_user_watchlist_keyword(
    keyword_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle keyword active status."""
    keyword = db.query(UserWatchListKeyword).filter(
        UserWatchListKeyword.id == keyword_id,
        UserWatchListKeyword.user_id == current_user.id
    ).first()

    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")

    keyword.is_active = not keyword.is_active
    keyword.updated_at = datetime.utcnow()
    db.commit()

    return {"keyword": keyword.keyword, "is_active": keyword.is_active}


@router.delete("/{keyword_id}")
def delete_user_watchlist_keyword(
    keyword_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove keyword from user's watchlist."""
    keyword = db.query(UserWatchListKeyword).filter(
        UserWatchListKeyword.id == keyword_id,
        UserWatchListKeyword.user_id == current_user.id
    ).first()

    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")

    db.delete(keyword)
    db.commit()

    return {"message": "Keyword removed from watchlist", "keyword": keyword.keyword}


@router.get("/stats")
def get_user_watchlist_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user watchlist statistics."""
    total_keywords = db.query(UserWatchListKeyword).filter(
        UserWatchListKeyword.user_id == current_user.id
    ).count()

    active_keywords = db.query(UserWatchListKeyword).filter(
        UserWatchListKeyword.user_id == current_user.id,
        UserWatchListKeyword.is_active == True
    ).count()

    return {
        "total_keywords": total_keywords,
        "active_keywords": active_keywords,
        "inactive_keywords": total_keywords - active_keywords
    }
