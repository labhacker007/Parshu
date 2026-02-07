"""
User Custom Feeds API Routes

Allows users to manage their personal RSS/Atom feeds separately from
global feed sources managed by admins.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import logger
from app.auth.dependencies import get_current_user
from app.models import User, UserFeed

router = APIRouter(prefix="/users/feeds", tags=["user-feeds"])


# Schemas
class UserFeedCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=2048)
    description: Optional[str] = None
    category: str = "custom"
    feed_type: str = "rss"
    auto_ingest: bool = True
    notify_on_new: bool = False


class UserFeedUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    auto_ingest: Optional[bool] = None
    notify_on_new: Optional[bool] = None


class UserFeedResponse(BaseModel):
    id: int
    user_id: int
    name: str
    url: str
    description: Optional[str]
    category: str
    feed_type: str
    is_active: bool
    last_fetched: Optional[datetime]
    fetch_error: Optional[str]
    article_count: int
    auto_ingest: bool
    notify_on_new: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserFeedListResponse(BaseModel):
    feeds: List[UserFeedResponse]
    total: int


# Routes
@router.get("/", response_model=UserFeedListResponse)
async def list_user_feeds(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all custom feeds for the current user."""
    query = db.query(UserFeed).filter(UserFeed.user_id == current_user.id)
    
    if not include_inactive:
        query = query.filter(UserFeed.is_active == True)
    
    feeds = query.order_by(UserFeed.created_at.desc()).all()
    
    return UserFeedListResponse(
        feeds=[UserFeedResponse.model_validate(f) for f in feeds],
        total=len(feeds)
    )


@router.post("/validate-url")
async def validate_feed_url(
    url: str,
    current_user: User = Depends(get_current_user)
):
    """
    Validate if a URL is a valid RSS/Atom/JSON feed.
    Returns detected feed type and error details if invalid.
    """
    import feedparser
    
    try:
        from app.core.fetch import safe_fetch_text_async, FetchError
        from app.core.ssrf import ssrf_policy_from_settings

        policy = ssrf_policy_from_settings(enforce_allowlist=None)
        result = await safe_fetch_text_async(
            url,
            policy=policy,
            headers={'User-Agent': 'Parshu Feed Reader/1.0'},
            timeout_seconds=15.0,
            max_bytes=2_000_000,
        )

        content = result.text
        content_type = result.headers.get('content-type', '').lower()
        
        # Check for JSON feed
        if 'application/json' in content_type or 'application/feed+json' in content_type:
            try:
                import json
                data = json.loads(content)
                if 'items' in data or 'entries' in data:
                    return {
                        "valid": True,
                        "feed_type": "json",
                        "title": data.get('title', 'JSON Feed'),
                        "item_count": len(data.get('items', data.get('entries', [])))
                    }
            except:
                pass
        
        # Check for RSS/Atom using feedparser
        parsed = feedparser.parse(content)
        
        if parsed.bozo and not parsed.entries:
            # feedparser couldn't parse it
            bozo_exception = str(parsed.bozo_exception) if parsed.bozo_exception else "Unknown error"
            
            # Check if it might be HTML (not a feed)
            if '<html' in content.lower()[:1000]:
                return {
                    "valid": False,
                    "error": "URL returns an HTML page, not a feed",
                    "suggestion": "Look for RSS/Atom feed link on the page. Try adding /feed, /rss, or /atom.xml to the URL"
                }
            
            return {
                "valid": False,
                "error": f"Could not parse feed: {bozo_exception}",
                "suggestion": "Make sure the URL points to a valid RSS or Atom feed"
            }
        
        # Determine feed type
        feed_type = "rss"
        if 'atom' in parsed.version.lower() if parsed.version else False:
            feed_type = "atom"
        
        return {
            "valid": True,
            "feed_type": feed_type,
            "title": parsed.feed.get('title', 'Unknown Feed'),
            "description": parsed.feed.get('description', '')[:200] if parsed.feed.get('description') else None,
            "item_count": len(parsed.entries),
            "version": parsed.version
        }
        
    except FetchError:
        return {
            "valid": False,
            "error": "Unable to fetch URL",
            "suggestion": "Check if the URL is accessible and points to a valid feed."
        }
    except Exception as e:
        return {
            "valid": False,
            "error": "Validation failed",
            "suggestion": "Make sure the URL is a valid RSS/Atom/JSON feed."
        }


@router.post("/", response_model=UserFeedResponse, status_code=status.HTTP_201_CREATED)
async def create_user_feed(
    feed_data: UserFeedCreate,
    validate: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new custom feed for the current user."""
    # Check for duplicate URL for this user
    existing = db.query(UserFeed).filter(
        UserFeed.user_id == current_user.id,
        UserFeed.url == feed_data.url
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a feed with this URL"
        )
    
    # Validate the feed URL if validation is enabled
    if validate:
        validation = await validate_feed_url(feed_data.url, current_user)
        if not validation.get('valid'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid feed URL: {validation.get('error')}. {validation.get('suggestion', '')}"
            )
        # Auto-detect feed type
        detected_type = validation.get('feed_type', 'rss')
        feed_data.feed_type = detected_type
    
    # Create the feed
    feed = UserFeed(
        user_id=current_user.id,
        name=feed_data.name,
        url=feed_data.url,
        description=feed_data.description,
        category=feed_data.category,
        feed_type=feed_data.feed_type,
        auto_ingest=feed_data.auto_ingest,
        notify_on_new=feed_data.notify_on_new,
        is_active=True
    )
    
    db.add(feed)
    db.commit()
    db.refresh(feed)
    
    return UserFeedResponse.model_validate(feed)


@router.get("/{feed_id}", response_model=UserFeedResponse)
async def get_user_feed(
    feed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific custom feed."""
    feed = db.query(UserFeed).filter(
        UserFeed.id == feed_id,
        UserFeed.user_id == current_user.id
    ).first()
    
    if not feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed not found"
        )
    
    return UserFeedResponse.model_validate(feed)


@router.patch("/{feed_id}", response_model=UserFeedResponse)
async def update_user_feed(
    feed_id: int,
    feed_data: UserFeedUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a custom feed."""
    feed = db.query(UserFeed).filter(
        UserFeed.id == feed_id,
        UserFeed.user_id == current_user.id
    ).first()
    
    if not feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed not found"
        )
    
    # Update fields that were provided
    update_data = feed_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(feed, field, value)
    
    feed.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(feed)
    
    return UserFeedResponse.model_validate(feed)


@router.delete("/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_feed(
    feed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a custom feed."""
    feed = db.query(UserFeed).filter(
        UserFeed.id == feed_id,
        UserFeed.user_id == current_user.id
    ).first()
    
    if not feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed not found"
        )
    
    db.delete(feed)
    db.commit()


@router.post("/{feed_id}/toggle", response_model=UserFeedResponse)
async def toggle_user_feed(
    feed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle a feed's active status."""
    feed = db.query(UserFeed).filter(
        UserFeed.id == feed_id,
        UserFeed.user_id == current_user.id
    ).first()
    
    if not feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed not found"
        )
    
    feed.is_active = not feed.is_active
    feed.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(feed)
    
    return UserFeedResponse.model_validate(feed)


@router.post("/{feed_id}/ingest")
async def ingest_user_feed(
    feed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trigger ingestion for a specific user feed.
    
    Supports RSS, Atom feeds, as well as website/blog URLs.
    Fetches new articles and creates Article records in the database.
    """
    from app.models import Article, FeedSource
    from app.ingestion.parser import FeedParser
    import hashlib
    
    feed = db.query(UserFeed).filter(
        UserFeed.id == feed_id,
        UserFeed.user_id == current_user.id
    ).first()
    
    if not feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed not found"
        )
    
    try:
        # Parse the feed (RSS/Atom)
        parser = FeedParser()
        parsed_feed = parser.parse_feed(feed.url)
        entries = parser.extract_entries(parsed_feed)
        
        if not entries:
            # Maybe it's a website URL, try to detect feed URL
            feed.fetch_error = "No entries found - try adding an RSS/Atom feed URL"
            feed.last_fetched = datetime.utcnow()
            db.commit()
            return {
                "status": "partial",
                "message": "No entries found in feed. Make sure URL is an RSS/Atom feed.",
                "articles_fetched": 0,
                "suggestion": "Look for RSS icon on the website or try adding /feed, /rss, or /atom to the URL"
            }
        
        # Create or find a FeedSource for this user's custom feed
        source_name = f"User:{current_user.id}:{feed.name}"
        feed_source = db.query(FeedSource).filter(FeedSource.name == source_name).first()
        if not feed_source:
            feed_source = FeedSource(
                name=source_name,
                url=feed.url,
                category=feed.category or "custom",
                feed_type=feed.feed_type or "rss",
                is_active=True
            )
            db.add(feed_source)
            db.commit()
            db.refresh(feed_source)
        
        # Import articles
        articles_created = 0
        articles_skipped = 0
        created_articles = []
        
        for entry in entries:
            # Generate content hash for deduplication
            content_hash = hashlib.sha256(
                (entry.get("url", "") + entry.get("title", "")).encode()
            ).hexdigest()
            
            # Check for duplicates
            existing = db.query(Article).filter(
                Article.content_hash == content_hash
            ).first()
            
            if existing:
                articles_skipped += 1
                continue
            
            # Create article - ensure external_id is always set
            external_id = entry.get("external_id") or entry.get("url") or content_hash
            
            article = Article(
                source_id=feed_source.id,
                title=entry.get("title", "Untitled"),
                url=entry.get("url", ""),
                raw_content=entry.get("raw_content") or entry.get("summary", ""),
                summary=str(entry.get("summary", ""))[:500] if entry.get("summary") else None,
                image_url=entry.get("image_url"),
                content_hash=content_hash,
                status="NEW",
                published_at=entry.get("published_at"),
                external_id=external_id
            )
            db.add(article)
            articles_created += 1
            created_articles.append({
                "title": article.title[:100],
                "url": article.url
            })
        
        db.commit()
        
        # Update feed stats
        feed.last_fetched = datetime.utcnow()
        feed.fetch_error = None
        feed.article_count = (feed.article_count or 0) + articles_created
        db.commit()
        
        return {
            "status": "success",
            "message": f"Fetched {len(entries)} entries, created {articles_created} new articles",
            "articles_fetched": len(entries),
            "articles_created": articles_created,
            "articles_skipped": articles_skipped,
            "entries": created_articles[:5]  # Return first 5 for preview
        }
        
    except Exception as e:
        error_detail = str(e)
        feed.fetch_error = error_detail[:500]
        feed.last_fetched = datetime.utcnow()
        db.commit()
        
        # Log full detail server-side; return generic error to client
        logger.warning("user_feed_ingest_failed", user_id=current_user.id, feed_id=feed_id, error=error_detail)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to ingest feed"
        )


@router.get("/{feed_id}/articles")
async def get_feed_articles(
    feed_id: int,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get articles from a user's custom feed."""
    from app.models import Article, FeedSource
    
    feed = db.query(UserFeed).filter(
        UserFeed.id == feed_id,
        UserFeed.user_id == current_user.id
    ).first()
    
    if not feed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feed not found"
        )
    
    # Find the associated FeedSource
    source_name = f"User:{current_user.id}:{feed.name}"
    feed_source = db.query(FeedSource).filter(FeedSource.name == source_name).first()
    
    if not feed_source:
        return {
            "articles": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "message": "No articles yet. Click 'Fetch' to ingest articles from this feed."
        }
    
    # Get articles
    query = db.query(Article).filter(Article.source_id == feed_source.id)
    total = query.count()
    
    articles = query.order_by(Article.published_at.desc().nullslast(), Article.created_at.desc())\
        .offset((page - 1) * limit)\
        .limit(limit)\
        .all()
    
    return {
        "articles": [
            {
                "id": a.id,
                "title": a.title,
                "url": a.url,
                "summary": a.summary,
                "image_url": a.image_url,
                "status": a.status,
                "published_at": a.published_at.isoformat() if a.published_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in articles
        ],
        "total": total,
        "page": page,
        "limit": limit
    }
