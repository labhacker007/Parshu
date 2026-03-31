"""
Content fetching API routes.
Allows users to fetch and parse content from arbitrary URLs in various formats.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models import User, FetchedContent, UserFeed
from app.services.content_fetcher import content_fetcher, ContentFetchError
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/users/content", tags=["user-content"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class ContentFetchRequest(BaseModel):
    url: str
    feed_id: Optional[int] = None  # Optionally associate with a user feed


class ContentFetchResponse(BaseModel):
    id: int
    user_id: int
    feed_id: Optional[int]
    url: str
    title: str
    content: str
    content_format: str
    metadata: dict
    executive_summary: Optional[str]
    technical_summary: Optional[str]
    iocs: Optional[dict]
    fetched_at: datetime
    analyzed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ContentListResponse(BaseModel):
    contents: List[ContentFetchResponse]
    total: int


# ============================================================================
# Routes
# ============================================================================

@router.post("/fetch", response_model=ContentFetchResponse, status_code=status.HTTP_201_CREATED)
async def fetch_content_from_url(
    request: ContentFetchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch and parse content from a URL.
    Supports HTML, PDF, Word (.docx), CSV, Excel (.xlsx), and plain text.
    """
    # Validate feed_id if provided
    if request.feed_id:
        feed = db.query(UserFeed).filter(
            UserFeed.id == request.feed_id,
            UserFeed.user_id == current_user.id
        ).first()

        if not feed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feed not found"
            )

    # Fetch and parse content
    try:
        parsed_content = await content_fetcher.fetch_content(request.url)
    except ContentFetchError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Save to database
    fetched = FetchedContent(
        user_id=current_user.id,
        feed_id=request.feed_id,
        url=request.url,
        title=parsed_content["title"],
        content=parsed_content["content"],
        content_format=parsed_content["content_format"],
        metadata=parsed_content["metadata"],
        fetched_at=datetime.utcnow()
    )

    db.add(fetched)
    db.commit()
    db.refresh(fetched)

    return ContentFetchResponse.model_validate(fetched)


@router.get("/", response_model=ContentListResponse)
async def list_fetched_content(
    feed_id: Optional[int] = None,
    content_format: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all fetched content for the current user."""
    query = db.query(FetchedContent).filter(
        FetchedContent.user_id == current_user.id
    )

    if feed_id is not None:
        query = query.filter(FetchedContent.feed_id == feed_id)

    if content_format:
        query = query.filter(FetchedContent.content_format == content_format)

    total = query.count()

    contents = query.order_by(FetchedContent.fetched_at.desc()).offset(offset).limit(limit).all()

    return ContentListResponse(
        contents=[ContentFetchResponse.model_validate(c) for c in contents],
        total=total
    )


@router.get("/{content_id}", response_model=ContentFetchResponse)
async def get_fetched_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific fetched content item."""
    content = db.query(FetchedContent).filter(
        FetchedContent.id == content_id,
        FetchedContent.user_id == current_user.id
    ).first()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )

    return ContentFetchResponse.model_validate(content)


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fetched_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete fetched content."""
    content = db.query(FetchedContent).filter(
        FetchedContent.id == content_id,
        FetchedContent.user_id == current_user.id
    ).first()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )

    db.delete(content)
    db.commit()

    return None
