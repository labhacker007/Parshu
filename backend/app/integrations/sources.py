"""Feed sources management APIs with synchronous ingestion."""
import asyncio
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.auth.rbac import Permission
from app.models import FeedSource, Article, ArticleStatus, User, WatchListKeyword, ExtractedIntelligence, ExtractedIntelligenceType
from app.ingestion.parser import FeedParser
from app.extraction.extractor import IntelligenceExtractor
from app.core.logging import logger
from app.genai.provider import get_model_manager
from app.core.fetch import safe_fetch_text_sync, FetchError
from app.core.ssrf import ssrf_policy_from_settings
from app.knowledge.service import DocumentProcessor, KNOWLEDGE_STORAGE_PATH
from pydantic import BaseModel, HttpUrl
import hashlib
from typing import List, Optional, Tuple, Dict
from datetime import datetime
import re


def extract_image_url(entry: dict) -> Optional[str]:
    """Extract the featured image URL from a feed entry.
    
    Attempts to find an image from:
    1. media_content or media_thumbnail (RSS media extensions)
    2. enclosure links with image types
    3. First img tag in content
    4. og:image meta tag equivalent in content
    """
    # Check for media content (common in RSS feeds)
    if "media_content" in entry:
        media = entry["media_content"]
        if isinstance(media, list) and len(media) > 0:
            return media[0].get("url")
        elif isinstance(media, dict):
            return media.get("url")
    
    if "media_thumbnail" in entry:
        thumbnail = entry["media_thumbnail"]
        if isinstance(thumbnail, list) and len(thumbnail) > 0:
            return thumbnail[0].get("url")
        elif isinstance(thumbnail, dict):
            return thumbnail.get("url")
    
    # Check for enclosures (podcasts and media feeds)
    if "enclosures" in entry:
        for enc in entry.get("enclosures", []):
            if "image" in enc.get("type", ""):
                return enc.get("url")
    
    # Check raw_content for img tags
    raw_content = entry.get("raw_content", "") or entry.get("content", "") or entry.get("summary", "")
    if raw_content:
        # Find first img src
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw_content, re.IGNORECASE)
        if img_match:
            img_url = img_match.group(1)
            # Skip base64 data URIs and tracking pixels
            if not img_url.startswith('data:') and 'pixel' not in img_url.lower() and 'track' not in img_url.lower():
                return img_url
    
    # Check for image field directly (some APIs provide this)
    if entry.get("image"):
        if isinstance(entry["image"], str):
            return entry["image"]
        elif isinstance(entry["image"], dict):
            return entry["image"].get("url") or entry["image"].get("href")
    
    return None


def await_or_run(coro):
    """Helper to run async coroutine in sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Create a new loop in a thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result(timeout=60)
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


CUSTOM_FEED_DIR = Path(KNOWLEDGE_STORAGE_PATH) / "custom_feeds"
CUSTOM_FEED_DIR.mkdir(parents=True, exist_ok=True)


def _extract_title_from_html(html: str) -> Optional[str]:
    """Extract <title> from HTML content."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        title_tag = soup.title
        if title_tag and title_tag.string:
            return title_tag.string.strip()
    except Exception:
        pass
    return None


def _persist_extracted_intelligence(
    db: Session,
    article_id: int,
    extracted: Dict[str, List],
    method: str
) -> None:
    """Persist extracted IOCs/TTPs/ATLAS/IOAs."""
    for ioc in extracted.get("iocs", []):
        value = ioc.get("value")
        if not value:
            continue
        intel = ExtractedIntelligence(
            article_id=article_id,
            intelligence_type=ExtractedIntelligenceType.IOC,
            value=value,
            confidence=ioc.get("confidence", 85),
            evidence=ioc.get("evidence"),
            meta={"type": ioc.get("type"), "source": method}
        )
        db.add(intel)

    for ttp in extracted.get("ttps", []):
        mitre_id = ttp.get("mitre_id")
        if not mitre_id:
            continue
        intel = ExtractedIntelligence(
            article_id=article_id,
            intelligence_type=ExtractedIntelligenceType.TTP,
            value=ttp.get("name") or mitre_id,
            mitre_id=mitre_id,
            confidence=ttp.get("confidence", 85),
            evidence=ttp.get("evidence"),
            meta={"source": method}
        )
        db.add(intel)

    for atlas in extracted.get("atlas", []):
        atlas_id = atlas.get("mitre_id") or atlas.get("value")
        if not atlas_id:
            continue
        intel = ExtractedIntelligence(
            article_id=article_id,
            intelligence_type=ExtractedIntelligenceType.ATLAS,
            value=atlas.get("name") or atlas_id,
            mitre_id=atlas.get("mitre_id"),
            confidence=atlas.get("confidence", 70),
            meta={"framework": "ATLAS", "source": method}
        )
        db.add(intel)

    for ioa in extracted.get("ioas", []):
        ioa_value = ioa.get("value")
        if not ioa_value:
            continue
        intel = ExtractedIntelligence(
            article_id=article_id,
            intelligence_type=ExtractedIntelligenceType.IOA,
            value=ioa_value,
            confidence=ioa.get("confidence", 75),
            evidence=ioa.get("evidence"),
            meta={"source": method, "category": ioa.get("category")}
        )
        db.add(intel)


def _generate_article_summaries(
    article: Article,
    content: str,
    extracted: Dict[str, List]
) -> None:
    """Generate executive and technical summaries via GenAI."""
    try:
        model_manager = get_model_manager()
        content_for_summary = f"{article.title}\n\n{content[:4000]}"

        ioc_count = len(extracted.get("iocs", []))
        ttp_list = [ttp.get("mitre_id") or ttp.get("name") for ttp in extracted.get("ttps", [])[:5]]

        exec_result = await_or_run(
            model_manager.generate_with_fallback(
                system_prompt="""You are a threat intelligence analyst. Write a 2-3 sentence executive summary for C-level executives. Focus on business impact and key threats. Be concise.""",
                user_prompt=f"Summarize this threat intelligence article:\n\n{content_for_summary[:2000]}"
            )
        )
        tech_result = await_or_run(
            model_manager.generate_with_fallback(
                system_prompt="""You are a senior SOC analyst. Write a technical summary with key IOCs, TTPs, and detection opportunities. Be specific and actionable.""",
                user_prompt=f"Write a technical summary for SOC analysts:\n\nIOCs found: {ioc_count}\nTTPs: {ttp_list}\n\nArticle:\n{content_for_summary[:2500]}"
            )
        )

        article.executive_summary = exec_result.get("response", "")[:1000]
        article.technical_summary = tech_result.get("response", "")[:2000]
        article.genai_analysis_remarks = (
            f"Auto-summarized at ingestion using {exec_result.get('model_used', 'unknown')}"
        )

        logger.info(
            "auto_summarization_complete",
            article_id=article.id,
            model=exec_result.get("model_used")
        )

    except Exception as summary_err:
        logger.warning("auto_summarization_failed", article_id=article.id, error=str(summary_err))


def _auto_analyze_article(
    db: Session,
    article: Article,
    content: str,
    source_url: str
) -> Tuple[Dict[str, List], str]:
    """Run GenAI extraction and summarization for an article."""
    try:
        extracted = await_or_run(
            IntelligenceExtractor.extract_with_genai(content, source_url=source_url, db_session=db)
        )
        method = "genai"
    except Exception as genai_err:
        logger.warning("genai_extraction_fallback", article_id=article.id, error=str(genai_err))
        extracted = IntelligenceExtractor.extract_all(content, source_url=source_url)
        method = "regex"

    _persist_extracted_intelligence(db, article.id, extracted, method)
    _generate_article_summaries(article, content, extracted)
    return extracted, method


router = APIRouter(prefix="/sources", tags=["sources"])


class FeedSourceCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    url: HttpUrl
    feed_type: str = "rss"  # rss, atom, html
    is_active: Optional[bool] = True


class FeedSourceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    url: Optional[HttpUrl] = None
    feed_type: Optional[str] = None
    is_active: Optional[bool] = None


class FeedSourceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    url: str
    feed_type: str
    is_active: bool
    last_fetched: Optional[datetime] = None
    next_fetch: Optional[datetime] = None
    fetch_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Article statistics
    article_count: int = 0
    new_articles: int = 0
    reviewed_articles: int = 0
    
    class Config:
        from_attributes = True


class IngestionResult(BaseModel):
    source_id: int
    source_name: str
    new_articles: int
    duplicates: int
    high_priority: int
    status: str
    error: Optional[str] = None


class CustomFeedIngestRequest(BaseModel):
    url: HttpUrl
    title: Optional[str] = None
    feed_name: Optional[str] = None
    description: Optional[str] = None
    high_priority: bool = False


class CustomFeedIngestResponse(BaseModel):
    article_id: Optional[int]
    article_title: Optional[str]
    source_id: Optional[int]
    source_name: Optional[str]
    executive_summary: Optional[str]
    technical_summary: Optional[str]
    ioc_count: int = 0
    ttp_count: int = 0
    status: str
    message: Optional[str] = None
    extraction_method: Optional[str] = None
    created_source: bool = False


def get_source_with_stats(db: Session, source: FeedSource) -> FeedSourceResponse:
    """Get source with article statistics."""
    # Count articles by status
    total = db.query(func.count(Article.id)).filter(Article.source_id == source.id).scalar() or 0
    new = db.query(func.count(Article.id)).filter(
        Article.source_id == source.id,
        Article.status == ArticleStatus.NEW
    ).scalar() or 0
    reviewed = db.query(func.count(Article.id)).filter(
        Article.source_id == source.id,
        Article.status == ArticleStatus.REVIEWED
    ).scalar() or 0
    
    return FeedSourceResponse(
        id=source.id,
        name=source.name,
        description=source.description,
        url=source.url,
        feed_type=source.feed_type,
        is_active=source.is_active,
        last_fetched=source.last_fetched,
        next_fetch=source.next_fetch,
        fetch_error=source.fetch_error,
        created_at=source.created_at,
        updated_at=source.updated_at,
        article_count=total,
        new_articles=new,
        reviewed_articles=reviewed
    )


def ingest_source_sync(db: Session, source: FeedSource) -> dict:
    """Alias for ingest_feed_sync that returns a dict for scheduler compatibility."""
    result = ingest_feed_sync(db, source)
    return {
        "new_articles": result.new_articles,
        "duplicates": result.duplicates,
        "high_priority": result.high_priority,
        "status": result.status,
        "error": result.error
    }


def ingest_feed_sync(db: Session, source: FeedSource) -> IngestionResult:
    """Synchronously ingest articles from a feed source."""
    try:
        logger.info("ingesting_feed", source_id=source.id, url=source.url)
        
        # Parse feed
        feed = FeedParser.parse_feed(source.url)
        entries = FeedParser.extract_entries(feed)
        
        # Get watchlist keywords
        keywords = db.query(WatchListKeyword).filter(WatchListKeyword.is_active == True).all()
        keyword_list = [kw.keyword.lower() for kw in keywords]
        
        # Initialize duplicate checker
        from app.articles.duplicate_checker import DuplicateChecker
        duplicate_checker = DuplicateChecker(db)
        
        # Store articles
        article_count = 0
        duplicate_count = 0
        high_priority_count = 0
        
        for entry in entries:
            # Check for exact duplicates by external_id
            existing = db.query(Article).filter(
                Article.source_id == source.id,
                Article.external_id == entry["external_id"]
            ).first()
            
            if existing:
                duplicate_count += 1
                logger.debug("skipping_existing_article", external_id=entry["external_id"])
                continue
            
            # Check for content-based duplicates using GenAI/heuristics
            try:
                duplicate_result = duplicate_checker.check_duplicate(
                    title=entry["title"],
                    content=entry.get("raw_content", "") or entry.get("summary", ""),
                    url=entry.get("url"),
                    published_at=entry.get("published_at")
                )
                
                if duplicate_result["is_duplicate"] and duplicate_result["confidence"] >= 0.85:
                    duplicate_count += 1
                    logger.info(
                        "duplicate_detected_skipping",
                        title=entry["title"][:50],
                        confidence=duplicate_result["confidence"],
                        reasoning=duplicate_result["reasoning"]
                    )
                    continue
            except Exception as dup_err:
                logger.warning("duplicate_check_failed", error=str(dup_err))
                # Continue with ingestion if duplicate check fails
            
            # Check if matches watchlist
            content = (entry.get("title", "") + " " + entry.get("summary", "")).lower()
            matched_keywords = [kw for kw in keyword_list if kw in content]
            is_high_priority = len(matched_keywords) > 0
            
            if is_high_priority:
                high_priority_count += 1
            
            # Extract image URL from content
            image_url = extract_image_url(entry)
            
            # Create article
            article = Article(
                source_id=source.id,
                external_id=entry["external_id"],
                title=entry["title"],
                raw_content=entry.get("raw_content", ""),
                normalized_content=FeedParser.normalize_content(entry.get("raw_content", "")),
                summary=entry.get("summary", ""),
                url=entry.get("url", ""),
                image_url=image_url,
                published_at=entry.get("published_at"),
                status=ArticleStatus.NEW,
                is_high_priority=is_high_priority,
                watchlist_match_keywords=matched_keywords if matched_keywords else []
            )
            
            db.add(article)
            db.flush()  # Get article ID for extraction
            
            extraction_text = f"{entry['title']}\n\n{entry.get('summary', '')}\n\n{entry.get('raw_content', '')}"
            source_url = entry.get("url") or source.url

            try:
                extracted, extraction_method = _auto_analyze_article(
                    db=db,
                    article=article,
                    content=extraction_text,
                    source_url=source_url
                )
                logger.info(
                    "auto_analysis_complete",
                    article_id=article.id,
                    method=extraction_method,
                    iocs=len(extracted.get("iocs", [])),
                    ttps=len(extracted.get("ttps", [])),
                    ioas=len(extracted.get("ioas", [])),
                    atlas=len(extracted.get("atlas", []))
                )
            except Exception as analysis_err:
                logger.warning("auto_analysis_failed", article_id=article.id, error=str(analysis_err))

            article_count += 1
        
        # Update source
        source.last_fetched = datetime.utcnow()
        source.fetch_error = None
        
        db.commit()
        
        logger.info(
            "feed_ingestion_complete",
            source_id=source.id,
            new_articles=article_count,
            duplicates=duplicate_count,
            high_priority=high_priority_count
        )
        
        return IngestionResult(
            source_id=source.id,
            source_name=source.name,
            new_articles=article_count,
            duplicates=duplicate_count,
            high_priority=high_priority_count,
            status="success"
        )
        
    except Exception as e:
        logger.error("feed_ingestion_failed", source_id=source.id, error=str(e))
        source.fetch_error = str(e)
        db.commit()
        
        return IngestionResult(
            source_id=source.id,
            source_name=source.name,
            new_articles=0,
            duplicates=0,
            high_priority=0,
            status="error",
            error=str(e)
        )


@router.post("/", response_model=FeedSourceResponse)
def create_feed_source(
    request: FeedSourceCreateRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Create a new feed source."""
    # Check if source already exists
    existing = db.query(FeedSource).filter(FeedSource.url == str(request.url)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Feed source URL already registered")
    
    source = FeedSource(
        name=request.name,
        description=request.description,
        url=str(request.url),
        feed_type=request.feed_type,
        is_active=request.is_active if request.is_active is not None else True
    )
    
    db.add(source)
    db.commit()
    db.refresh(source)
    
    logger.info("feed_source_created", source_id=source.id, url=source.url, user_id=current_user.id)
    
    return get_source_with_stats(db, source)


@router.get("/", response_model=List[FeedSourceResponse])
def list_feed_sources(
    current_user: User = Depends(require_permission(Permission.READ_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """List all feed sources with article statistics."""
    sources = db.query(FeedSource).all()
    return [get_source_with_stats(db, s) for s in sources]


@router.get("/{source_id}", response_model=FeedSourceResponse)
def get_feed_source(
    source_id: int,
    current_user: User = Depends(require_permission(Permission.READ_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Get a specific feed source with statistics."""
    source = db.query(FeedSource).filter(FeedSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed source not found")
    
    return get_source_with_stats(db, source)


@router.patch("/{source_id}", response_model=FeedSourceResponse)
def update_feed_source(
    source_id: int,
    request: FeedSourceUpdateRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Update a feed source."""
    source = db.query(FeedSource).filter(FeedSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed source not found")
    
    if request.name is not None:
        source.name = request.name
    if request.description is not None:
        source.description = request.description
    if request.url is not None:
        source.url = str(request.url)
    if request.feed_type is not None:
        source.feed_type = request.feed_type
    if request.is_active is not None:
        source.is_active = request.is_active
    
    db.commit()
    db.refresh(source)
    
    logger.info("feed_source_updated", source_id=source_id, user_id=current_user.id)
    
    return get_source_with_stats(db, source)


@router.delete("/{source_id}")
def delete_feed_source(
    source_id: int,
    delete_articles: bool = False,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Delete a feed source and optionally its articles."""
    source = db.query(FeedSource).filter(FeedSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed source not found")
    
    # Count associated articles
    article_count = db.query(Article).filter(Article.source_id == source_id).count()
    
    if delete_articles:
        # Delete all associated articles first
        db.query(Article).filter(Article.source_id == source_id).delete()
        logger.info("articles_deleted_with_source", source_id=source_id, count=article_count)
    elif article_count > 0:
        # Set articles to have no source instead of deleting
        db.query(Article).filter(Article.source_id == source_id).update({"source_id": None})
    
    db.delete(source)
    db.commit()
    
    logger.info("feed_source_deleted", source_id=source_id, user_id=current_user.id, articles_deleted=delete_articles)
    
    return {"message": f"Feed source deleted. {article_count} articles {'deleted' if delete_articles else 'orphaned'}."}


@router.post("/{source_id}/ingest", response_model=IngestionResult)
def trigger_feed_ingestion(
    source_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Trigger immediate ingestion for a feed source (synchronous)."""
    source = db.query(FeedSource).filter(FeedSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed source not found")
    
    if not source.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Feed source is not active")
    
    logger.info("feed_ingestion_triggered", source_id=source_id, user_id=current_user.id)
    
    # Run ingestion synchronously
    result = ingest_feed_sync(db, source)
    
    return result


@router.post("/ingest-all")
def trigger_all_ingestion(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Trigger ingestion for all active feed sources."""
    sources = db.query(FeedSource).filter(FeedSource.is_active == True).all()
    
    if not sources:
        return {"message": "No active sources to ingest", "results": []}
    
    results = []
    total_articles = 0
    total_high_priority = 0
    
    for source in sources:
        result = ingest_feed_sync(db, source)
        results.append(result)
        total_articles += result.new_articles
        total_high_priority += result.high_priority
    
    logger.info(
        "all_sources_ingestion_complete",
        sources_count=len(sources),
        total_new_articles=total_articles,
        total_high_priority=total_high_priority,
        user_id=current_user.id
    )
    
    return {
        "message": f"Ingested {len(sources)} sources",
        "total_new_articles": total_articles,
        "total_high_priority": total_high_priority,
        "results": [r.model_dump() for r in results]
    }


@router.post("/custom/ingest", response_model=CustomFeedIngestResponse, summary="Ingest a custom document or webpage")
def ingest_custom_feed(
    payload: CustomFeedIngestRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Ingest a standalone document (PDF/Word/HTML) and auto-run GenAI analysis."""
    policy = ssrf_policy_from_settings(enforce_allowlist=None)
    try:
        fetch_result = safe_fetch_text_sync(
            payload.url,
            policy=policy,
            headers={"User-Agent": "Jyoti Feed Reader/1.0"},
            timeout_seconds=30.0,
            max_bytes=10_000_000
        )
    except FetchError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch URL: {str(e)}"
        )

    content_type = (fetch_result.headers.get("content-type") or "").split(";")[0].lower()
    parsed_url = urlparse(payload.url)
    path_suffix = Path(parsed_url.path).suffix.lower()
    document_exts = {".pdf", ".doc", ".docx"}
    is_document = (
        any(token in content_type for token in ("pdf", "word", "officedocument"))
        or path_suffix in document_exts
    )

    extracted_text = ""
    if is_document:
        file_ext = path_suffix if path_suffix else ".bin"
        temp_path = CUSTOM_FEED_DIR / f"{uuid4().hex}{file_ext}"
        temp_path.write_bytes(fetch_result.content)
        try:
            extracted_text = await_or_run(
                DocumentProcessor.extract("file", str(temp_path), mime_type=content_type or None)
            )
        finally:
            try:
                temp_path.unlink()
            except Exception:
                pass
    elif "text/html" in content_type or path_suffix in {".html", ".htm"}:
        extracted_text = await_or_run(DocumentProcessor.extract("url", payload.url))
    else:
        extracted_text = fetch_result.text

    normalized_content = FeedParser.normalize_content(extracted_text or "")
    summary_text = (extracted_text or "")[:500] or None
    content_hash = hashlib.sha256((extracted_text or "").encode("utf-8")).hexdigest()

    title = payload.title or _extract_title_from_html(fetch_result.text) or parsed_url.hostname or "Custom Document"

    source_name = payload.feed_name or f"custom:{parsed_url.hostname or 'custom'}"
    source = db.query(FeedSource).filter(FeedSource.name == source_name).first()
    created_source = False
    if not source:
        source = FeedSource(
            name=source_name,
            description=payload.description,
            url=payload.url,
            feed_type="custom",
            is_active=True
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        created_source = True
    else:
        if payload.description:
            source.description = payload.description
        source.updated_at = datetime.utcnow()

    duplicate = db.query(Article).filter(
        or_(
            Article.content_hash == content_hash,
            Article.url == payload.url
        )
    ).first()

    source.last_fetched = datetime.utcnow()
    source.fetch_error = None
    db.commit()

    if duplicate:
        ioc_count = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == duplicate.id,
            ExtractedIntelligence.intelligence_type == ExtractedIntelligenceType.IOC
        ).count()
        ttp_count = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == duplicate.id,
            ExtractedIntelligence.intelligence_type == ExtractedIntelligenceType.TTP
        ).count()
        return CustomFeedIngestResponse(
            article_id=duplicate.id,
            article_title=duplicate.title,
            source_id=source.id,
            source_name=source.name,
            executive_summary=duplicate.executive_summary,
            technical_summary=duplicate.technical_summary,
            ioc_count=ioc_count,
            ttp_count=ttp_count,
            status="duplicate",
            message="This document was already ingested",
            created_source=created_source
        )

    article = Article(
        source_id=source.id,
        external_id=payload.url,
        title=title,
        raw_content=extracted_text,
        normalized_content=normalized_content,
        summary=summary_text,
        url=payload.url,
        published_at=None,
        status=ArticleStatus.NEW,
        is_high_priority=payload.high_priority,
        content_hash=content_hash
    )
    db.add(article)
    db.flush()

    extracted_result, extraction_method = _auto_analyze_article(
        db=db,
        article=article,
        content=extracted_text,
        source_url=payload.url
    )

    source.last_fetched = datetime.utcnow()
    source.fetch_error = None
    db.commit()
    db.refresh(article)

    logger.info(
        "custom_feed_ingested",
        source_id=source.id,
        article_id=article.id,
        url=payload.url,
        user_id=current_user.id
    )

    return CustomFeedIngestResponse(
        article_id=article.id,
        article_title=article.title,
        source_id=source.id,
        source_name=source.name,
        executive_summary=article.executive_summary,
        technical_summary=article.technical_summary,
        ioc_count=len(extracted_result.get("iocs", [])),
        ttp_count=len(extracted_result.get("ttps", [])),
        status="success",
        message="Custom document ingested",
        extraction_method=extraction_method,
        created_source=created_source
    )


@router.get("/stats/summary")
def get_sources_summary(
    time_range: Optional[str] = None,  # e.g., "24h", "7d", "30d", "all"
    current_user: User = Depends(require_permission(Permission.READ_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Get summary statistics for all sources with optional time filtering."""
    from datetime import timedelta
    
    # Calculate start date based on time_range
    start_date = None
    if time_range and time_range != "all":
        now = datetime.utcnow()
        if time_range == "1h":
            start_date = now - timedelta(hours=1)
        elif time_range == "6h":
            start_date = now - timedelta(hours=6)
        elif time_range == "12h":
            start_date = now - timedelta(hours=12)
        elif time_range in ["24h", "1d"]:
            start_date = now - timedelta(hours=24)
        elif time_range == "7d":
            start_date = now - timedelta(days=7)
        elif time_range == "30d":
            start_date = now - timedelta(days=30)
        elif time_range == "90d":
            start_date = now - timedelta(days=90)
    
    # Sources don't change based on time, always show total
    total_sources = db.query(func.count(FeedSource.id)).scalar() or 0
    active_sources = db.query(func.count(FeedSource.id)).filter(FeedSource.is_active == True).scalar() or 0
    
    # Filter articles by time range
    article_query = db.query(Article)
    if start_date:
        article_query = article_query.filter(Article.created_at >= start_date)
    
    total_articles = article_query.count()
    new_articles = article_query.filter(Article.status == ArticleStatus.NEW).count()
    reviewed_articles = article_query.filter(Article.status == ArticleStatus.REVIEWED).count()
    high_priority = article_query.filter(Article.is_high_priority == True).count()
    
    return {
        "total_sources": total_sources,
        "active_sources": active_sources,
        "total_articles": total_articles,
        "new_articles": new_articles,
        "reviewed_articles": reviewed_articles,
        "high_priority_articles": high_priority,
        "time_range": time_range or "all"
    }
