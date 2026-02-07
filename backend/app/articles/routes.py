"""Article management API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.auth.rbac import Permission
from app.models import Article, ArticleStatus, User, ExtractedIntelligence, FeedSource, AuditEventType
from app.articles.schemas import ArticleResponse, ArticleStatusUpdate, ArticleAnalysisUpdate, TriageArticlesResponse
from app.articles.service import (
    mark_article_as_read, get_article_read_status, get_hunt_status_for_article,
    update_article_status, search_articles, get_articles_with_hunt_status
)
from app.extraction.extractor import IntelligenceExtractor
from app.audit.manager import AuditManager
from app.core.logging import logger
from typing import Optional, List

router = APIRouter(prefix="/articles", tags=["articles"])


def article_to_response(article: Article, user_id: Optional[int] = None, db: Optional[Session] = None, include_intel: bool = False) -> ArticleResponse:
    """Convert Article model to ArticleResponse with source name, hunt status, and read status."""
    # Get intelligence count - always include this for displaying counters
    intelligence_count = 0
    if db:
        from app.models import ExtractedIntelligence
        intelligence_count = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == article.id
        ).count()
    
    response_data = {
        "id": article.id,
        "external_id": article.external_id,
        "title": article.title,
        "raw_content": article.raw_content,
        "normalized_content": article.normalized_content,
        "summary": article.summary,
        "url": article.url,
        "image_url": getattr(article, 'image_url', None),
        "published_at": article.published_at,  # Original publication date from source
        "ingested_at": getattr(article, 'ingested_at', None) or article.created_at,  # When Parshu ingested
        "status": article.status.value if hasattr(article.status, 'value') else article.status,
        "source_id": article.source_id,
        "source_name": article.feed_source.name if article.feed_source else None,
        "source_url": article.feed_source.url if article.feed_source else None,
        "assigned_analyst_id": article.assigned_analyst_id,
        "genai_analysis_remarks": article.genai_analysis_remarks,
        "executive_summary": article.executive_summary,
        "technical_summary": article.technical_summary,
        "reviewed_by_id": article.reviewed_by_id,
        "reviewed_at": article.reviewed_at,
        "analyzed_by_id": article.analyzed_by_id,
        "analyzed_at": article.analyzed_at,
        "is_high_priority": article.is_high_priority,
        "watchlist_match_keywords": article.watchlist_match_keywords or [],
        "intelligence_count": intelligence_count,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
        "extracted_intelligence": [],
        "hunt_status": [],
        "is_read": None
    }
    
    # Add hunt status, read status if db and user_id provided
    if db and user_id:
        response_data["is_read"] = get_article_read_status(db, article.id, user_id)
        response_data["hunt_status"] = get_hunt_status_for_article(db, article.id)
    
    # Load extracted intelligence if requested (for detail view)
    if db and include_intel:
        from app.models import HuntExecution, Hunt, HuntTriggerType
        
        intel = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == article.id
        ).all()
        
        intel_responses = []
        for i in intel:
            intel_type = i.intelligence_type.value if hasattr(i.intelligence_type, 'value') else str(i.intelligence_type)
            meta = i.meta or {}
            
            # Get hunt info if this intelligence came from a hunt execution
            hunt_done = False
            hunt_initiated_by = None
            hunt_done_at = None
            
            if i.hunt_execution_id:
                execution = db.query(HuntExecution).filter(HuntExecution.id == i.hunt_execution_id).first()
                if execution:
                    hunt_done = True
                    hunt_done_at = execution.executed_at
                    if execution.trigger_type == HuntTriggerType.AUTO or execution.trigger_type == "AUTO":
                        hunt_initiated_by = "AUTO"
                    elif execution.executed_by_id:
                        from app.models import User
                        user = db.query(User).filter(User.id == execution.executed_by_id).first()
                        hunt_initiated_by = user.username if user else f"User #{execution.executed_by_id}"
            
            # Determine MITRE framework
            mitre_framework = None
            if i.mitre_id:
                if i.mitre_id.startswith("AML"):
                    mitre_framework = "atlas"
                elif i.mitre_id.startswith("T"):
                    mitre_framework = "attack"
            
            intel_responses.append({
                "id": i.id,
                "intelligence_type": intel_type,
                "value": i.value,
                "confidence": i.confidence,
                "evidence": i.evidence,
                "mitre_id": i.mitre_id,
                "mitre_name": meta.get("mitre_name") or meta.get("name"),
                "mitre_url": meta.get("mitre_url") or meta.get("url"),
                "mitre_framework": mitre_framework,
                "source": meta.get("source", "article_extraction"),
                "ioc_type": meta.get("ioc_type") or meta.get("type"),
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "hunt_execution_id": i.hunt_execution_id,
                "hunt_done": hunt_done,
                "hunt_initiated_by": hunt_initiated_by,
                "hunt_done_at": hunt_done_at.isoformat() if hunt_done_at else None
            })
        
        response_data["extracted_intelligence"] = intel_responses
    
    return ArticleResponse(**response_data)


@router.get("/triage", response_model=TriageArticlesResponse)
def get_triage_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status_filter: Optional[str] = Query(None),
    high_priority_only: bool = Query(False),
    source_id: Optional[int] = Query(None),
    read_filter: Optional[bool] = Query(None, description="Filter by read/unread status"),
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Get articles for triage with pagination and filters including hunt status and read/unread."""
    # Use service layer for complex filtering
    if read_filter is not None:
        articles, total = get_articles_with_hunt_status(
            db, current_user.id, status_filter, read_filter, page, page_size
        )
    else:
        query = db.query(Article).options(joinedload(Article.feed_source))
        
        # Filter by status if provided, otherwise show all
        if status_filter:
            query = query.filter(Article.status == status_filter)
        
        if high_priority_only:
            query = query.filter(Article.is_high_priority == True)
        
        if source_id:
            query = query.filter(Article.source_id == source_id)
        
        # Order by created_at descending (newest first)
        query = query.order_by(desc(Article.created_at))
        
        total = query.count()
        articles = query.offset((page - 1) * page_size).limit(page_size).all()
    
    logger.info("triage_queue_accessed", user_id=current_user.id, total=total, page=page)
    
    # Convert to response with hunt status and read status
    articles_response = []
    for article in articles:
        article_dict = article_to_response(article, current_user.id, db).model_dump()
        articles_response.append(article_dict)
    
    return TriageArticlesResponse(
        articles=articles_response,
        total=total,
        page=page,
        page_size=page_size
    )


# NOTE: Static paths must come before path parameter routes
@router.post("/mark-all-read")
def mark_all_as_read(
    source_id: Optional[int] = Query(None, description="Mark only articles from this source"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all articles (or all from a source) as read for the current user."""
    from app.models import ArticleReadStatus
    from datetime import datetime as dt
    
    # Get articles to mark as read
    query = db.query(Article)
    if source_id:
        query = query.filter(Article.source_id == source_id)
    
    articles = query.all()
    marked_count = 0
    
    for article in articles:
        # Check if already marked
        existing = db.query(ArticleReadStatus).filter(
            ArticleReadStatus.article_id == article.id,
            ArticleReadStatus.user_id == current_user.id
        ).first()
        
        if existing:
            if not existing.is_read:
                existing.is_read = True
                existing.read_at = dt.utcnow()
                marked_count += 1
        else:
            read_status = ArticleReadStatus(
                article_id=article.id,
                user_id=current_user.id,
                is_read=True,
                read_at=dt.utcnow()
            )
            db.add(read_status)
            marked_count += 1
    
    db.commit()
    
    return {
        "message": f"Marked {marked_count} articles as read",
        "marked_count": marked_count,
        "source_id": source_id
    }


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Get a specific article with all details including extracted intelligence. Auto-marks as read."""
    article = db.query(Article).options(
        joinedload(Article.feed_source)
    ).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    # Auto-mark as read when viewed
    mark_article_as_read(db, article_id, current_user.id)
    
    # Include extracted intelligence for detail view
    return article_to_response(article, current_user.id, db, include_intel=True)


@router.patch("/{article_id}/analysis", response_model=ArticleResponse)
def update_article_analysis(
    article_id: int,
    update: ArticleAnalysisUpdate,
    current_user: User = Depends(require_permission(Permission.ANALYZE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Add executive and technical summaries."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    article.executive_summary = update.executive_summary
    article.technical_summary = update.technical_summary
    article.analyzed_by_id = current_user.id
    
    from datetime import datetime
    article.analyzed_at = datetime.utcnow()
    article.status = ArticleStatus.IN_ANALYSIS.value
    
    db.commit()
    db.refresh(article)
    
    logger.info("article_analysis_updated", article_id=article_id, user_id=current_user.id)
    
    return ArticleResponse.model_validate(article)


@router.get("/{article_id}/intelligence", response_model=list)
def get_article_intelligence(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Get all extracted intelligence for an article."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    intelligence = db.query(ExtractedIntelligence).filter(
        ExtractedIntelligence.article_id == article_id
    ).all()
    
    return [ArticleResponse.model_validate(i) for i in intelligence]


@router.post("/{article_id}/read")
def mark_as_read(
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an article as read for the current user."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    mark_article_as_read(db, article_id, current_user.id)
    
    return {"message": "Article marked as read", "article_id": article_id}


@router.get("/search")
def search_articles_endpoint(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Global search across articles and feed sources."""
    articles = search_articles(db, q, current_user.id, limit)
    
    # Convert to response format with read status
    results = []
    for article in articles:
        is_read = get_article_read_status(db, article.id, current_user.id)
        hunt_status = get_hunt_status_for_article(db, article.id)
        
        article_dict = article_to_response(article).model_dump()
        article_dict["is_read"] = is_read
        article_dict["hunt_status"] = [hs.model_dump() for hs in hunt_status]
        results.append(article_dict)
    
    return {"results": results, "count": len(results), "query": q}


@router.patch("/{article_id}/status", response_model=ArticleResponse)
def update_status(
    article_id: int,
    update: ArticleStatusUpdate,
    request: Request,
    current_user: User = Depends(require_permission(Permission.TRIAGE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Update article status and optionally add GenAI analysis remarks.
    
    Auto-triggers intelligence extraction when article is moved to IN_ANALYSIS or any status other than NEW.
    """
    # Get IP address from request state (set by middleware)
    client_ip = getattr(request.state, 'client_ip', None) or (request.client.host if request.client else None)
    
    try:
        status_enum = ArticleStatus[update.status]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {update.status}"
        )
    
    # Get old status before update
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    old_status = article.status
    
    # Update article status
    article = update_article_status(
        db,
        article_id,
        status_enum,
        current_user.id,
        update.genai_analysis_remarks
    )
    
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    # Log status change with IP address
    AuditManager.log_article_status_change(
        db, article_id, old_status.value if hasattr(old_status, 'value') else str(old_status), 
        update.status, current_user.id, ip_address=client_ip
    )
    
    logger.info("article_status_updated", article_id=article_id, status=update.status, user_id=current_user.id, ip_address=client_ip)
    
    # Auto-extract intelligence when status changes from NEW to any other status
    if status_enum != ArticleStatus.NEW:
        # Check if intelligence already exists
        existing_intel = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == article_id
        ).first()
        
        if not existing_intel:
            try:
                logger.info("auto_extracting_intelligence", article_id=article_id, status=update.status)
                
                # Prepare text for extraction
                extraction_text = f"{article.title}\n\n{article.summary or ''}\n\n{article.normalized_content or article.raw_content or ''}"
                
                # Get source URL to filter out source domain from IOCs
                source_url = article.url or (article.feed_source.url if article.feed_source else None)
                
                # Extract all intelligence (filters out source metadata)
                extracted = IntelligenceExtractor.extract_all(extraction_text, source_url=source_url)
                
                # Save extracted intelligence to database
                total_saved = 0
                for ioc in extracted["iocs"]:
                    intel = ExtractedIntelligence(
                        article_id=article_id,
                        intelligence_type=ioc["intelligence_type"],
                        value=ioc["value"],
                        confidence=ioc.get("confidence", 75),
                        context=f"Type: {ioc['type']}, Hash Type: {ioc.get('hash_type', 'N/A')}"
                    )
                    db.add(intel)
                    total_saved += 1
                
                # Note: IOAs removed - only tracking IOCs and TTPs
                
                for ttp in extracted["ttps"]:
                    intel = ExtractedIntelligence(
                        article_id=article_id,
                        intelligence_type=ttp["intelligence_type"],
                        value=f"{ttp['mitre_id']}: {ttp['name']}",
                        confidence=ttp.get("confidence", 80),
                        context=f"MITRE ATT&CK Technique"
                    )
                    db.add(intel)
                    total_saved += 1
                
                for atlas in extracted["atlas"]:
                    intel = ExtractedIntelligence(
                        article_id=article_id,
                        intelligence_type=atlas["intelligence_type"],
                        value=f"{atlas['mitre_id']}: {atlas['name']}",
                        confidence=atlas.get("confidence", 70),
                        context=f"MITRE ATLAS (AI/ML) Technique"
                    )
                    db.add(intel)
                    total_saved += 1
                
                db.commit()
                logger.info("auto_extraction_complete", article_id=article_id, total_items=total_saved)
            except Exception as e:
                logger.error("auto_extraction_failed", article_id=article_id, error=str(e))
                # Don't fail the status update if extraction fails
                db.rollback()
    
    # Return with hunt status and read status
    return article_to_response(article, current_user.id, db)


# ============ COMMENTS ENDPOINTS ============

from app.articles.schemas import CommentCreate, CommentUpdate, CommentResponse, ArticleCommentsResponse
from app.models import ArticleComment


@router.get("/{article_id}/comments", response_model=ArticleCommentsResponse)
def get_article_comments(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Get all comments for an article."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    comments = db.query(ArticleComment).filter(
        ArticleComment.article_id == article_id
    ).order_by(ArticleComment.created_at.asc()).all()
    
    # Build response with usernames
    comment_responses = []
    for comment in comments:
        user = db.query(User).filter(User.id == comment.user_id).first()
        comment_responses.append(CommentResponse(
            id=comment.id,
            article_id=comment.article_id,
            user_id=comment.user_id,
            username=user.username if user else None,
            comment_text=comment.comment_text,
            is_internal=comment.is_internal,
            parent_id=comment.parent_id,
            created_at=comment.created_at,
            updated_at=comment.updated_at
        ))
    
    return ArticleCommentsResponse(comments=comment_responses, total=len(comment_responses))


@router.post("/{article_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    article_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Add a comment to an article."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    # Validate parent comment if provided
    if comment_data.parent_id:
        parent = db.query(ArticleComment).filter(
            ArticleComment.id == comment_data.parent_id,
            ArticleComment.article_id == article_id
        ).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent comment not found")
    
    comment = ArticleComment(
        article_id=article_id,
        user_id=current_user.id,
        comment_text=comment_data.comment_text,
        is_internal=comment_data.is_internal,
        parent_id=comment_data.parent_id
    )
    
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    logger.info("comment_created", article_id=article_id, comment_id=comment.id, user_id=current_user.id)
    
    return CommentResponse(
        id=comment.id,
        article_id=comment.article_id,
        user_id=comment.user_id,
        username=current_user.username,
        comment_text=comment.comment_text,
        is_internal=comment.is_internal,
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at
    )


@router.patch("/{article_id}/comments/{comment_id}", response_model=CommentResponse)
def update_comment(
    article_id: int,
    comment_id: int,
    comment_data: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a comment (only by owner or admin)."""
    comment = db.query(ArticleComment).filter(
        ArticleComment.id == comment_id,
        ArticleComment.article_id == article_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    
    # Only owner or admin can edit
    if comment.user_id != current_user.id and current_user.role.value != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit this comment")
    
    comment.comment_text = comment_data.comment_text
    db.commit()
    db.refresh(comment)
    
    logger.info("comment_updated", comment_id=comment_id, user_id=current_user.id)
    
    return CommentResponse(
        id=comment.id,
        article_id=comment.article_id,
        user_id=comment.user_id,
        username=current_user.username,
        comment_text=comment.comment_text,
        is_internal=comment.is_internal,
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at
    )


@router.delete("/{article_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    article_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comment (only by owner or admin)."""
    comment = db.query(ArticleComment).filter(
        ArticleComment.id == comment_id,
        ArticleComment.article_id == article_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    
    # Only owner or admin can delete
    if comment.user_id != current_user.id and current_user.role.value != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete this comment")
    
    db.delete(comment)
    db.commit()
    
    logger.info("comment_deleted", comment_id=comment_id, user_id=current_user.id)


# ============ ARTICLE ASSIGNMENT ENDPOINTS ============

from app.articles.schemas import ArticleAssignRequest, ArticleAssignmentResponse
from datetime import datetime


@router.post("/{article_id}/assign", response_model=ArticleAssignmentResponse)
def assign_article(
    article_id: int,
    request: ArticleAssignRequest,
    current_user: User = Depends(require_permission(Permission.TRIAGE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Assign an article to an analyst.
    
    Pass analyst_id=null to unassign.
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    analyst = None
    analyst_name = None
    
    if request.analyst_id:
        analyst = db.query(User).filter(User.id == request.analyst_id).first()
        if not analyst:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Analyst not found")
        if not analyst.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Analyst account is inactive")
        analyst_name = analyst.full_name or analyst.username
    
    old_analyst_id = article.assigned_analyst_id
    article.assigned_analyst_id = request.analyst_id
    
    # Update status to IN_ANALYSIS if NEW and being assigned
    if article.status == ArticleStatus.NEW and request.analyst_id:
        article.status = ArticleStatus.IN_ANALYSIS
    
    db.commit()
    db.refresh(article)
    
    logger.info("article_assigned", 
               article_id=article_id, 
               from_analyst=old_analyst_id,
               to_analyst=request.analyst_id,
               by_user=current_user.id)
    
    return ArticleAssignmentResponse(
        article_id=article.id,
        assigned_analyst_id=article.assigned_analyst_id,
        assigned_analyst_name=analyst_name,
        assigned_at=datetime.utcnow() if request.analyst_id else None,
        message="Article assigned successfully" if request.analyst_id else "Article unassigned"
    )


@router.post("/{article_id}/claim")
def claim_article(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.TRIAGE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Claim an article for the current user."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    if article.assigned_analyst_id and article.assigned_analyst_id != current_user.id:
        assigned_user = db.query(User).filter(User.id == article.assigned_analyst_id).first()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Article already assigned to {assigned_user.username if assigned_user else 'another analyst'}"
        )
    
    article.assigned_analyst_id = current_user.id
    
    # Update status if NEW
    if article.status == ArticleStatus.NEW:
        article.status = ArticleStatus.IN_ANALYSIS
    
    db.commit()
    
    logger.info("article_claimed", article_id=article_id, user_id=current_user.id)
    
    return {
        "article_id": article.id,
        "assigned_analyst_id": current_user.id,
        "message": "Article claimed successfully"
    }


@router.get("/duplicates/detect")
def detect_duplicates(
    days: int = Query(7, ge=1, le=30, description="Number of days to look back"),
    similarity_threshold: float = Query(0.5, ge=0.1, le=1.0, description="Title similarity threshold"),
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Detect potential duplicate articles based on title similarity and publishing date.
    
    Groups articles that:
    - Were published on the same day
    - Have similar titles (>50% word overlap by default)
    - Come from different sources
    
    Returns:
        List of duplicate groups with article IDs and similarity scores
    """
    from datetime import timedelta
    from collections import defaultdict
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    articles = db.query(Article).filter(
        Article.created_at >= cutoff_date
    ).order_by(desc(Article.created_at)).all()
    
    # Group articles by publishing date
    date_groups = defaultdict(list)
    for article in articles:
        pub_date = (article.published_at or article.created_at).date()
        date_groups[pub_date].append(article)
    
    # Find duplicates within each date group
    duplicate_groups = []
    processed_ids = set()
    
    for date, date_articles in date_groups.items():
        for i, article in enumerate(date_articles):
            if article.id in processed_ids:
                continue
            
            # Get words from title (excluding short words)
            title_words = set(word.lower() for word in (article.title or "").split() if len(word) > 3)
            if not title_words:
                continue
            
            # Find similar articles
            similar_articles = []
            for j, other in enumerate(date_articles):
                if i == j or other.id in processed_ids:
                    continue
                
                # Calculate similarity
                other_words = set(word.lower() for word in (other.title or "").split() if len(word) > 3)
                if not other_words:
                    continue
                
                intersection = title_words & other_words
                union_size = max(len(title_words), len(other_words))
                similarity = len(intersection) / union_size if union_size > 0 else 0
                
                if similarity >= similarity_threshold:
                    similar_articles.append({
                        "id": other.id,
                        "title": other.title,
                        "source_id": other.source_id,
                        "source_name": other.feed_source.name if other.feed_source else None,
                        "similarity": round(similarity, 2),
                        "published_at": other.published_at.isoformat() if other.published_at else None
                    })
                    processed_ids.add(other.id)
            
            if similar_articles:
                processed_ids.add(article.id)
                duplicate_groups.append({
                    "primary": {
                        "id": article.id,
                        "title": article.title,
                        "source_id": article.source_id,
                        "source_name": article.feed_source.name if article.feed_source else None,
                        "published_at": article.published_at.isoformat() if article.published_at else None
                    },
                    "duplicates": similar_articles,
                    "total_sources": len(similar_articles) + 1,
                    "date": str(date)
                })
    
    return {
        "duplicate_groups": duplicate_groups,
        "total_groups": len(duplicate_groups),
        "total_duplicate_articles": len(processed_ids),
        "days_analyzed": days,
        "similarity_threshold": similarity_threshold
    }


@router.get("/my-queue")
def get_my_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get articles assigned to the current user."""
    query = db.query(Article).filter(Article.assigned_analyst_id == current_user.id)
    
    if status_filter:
        query = query.filter(Article.status == status_filter)
    
    total = query.count()
    articles = query.order_by(desc(Article.updated_at)).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "articles": [article_to_response(article, current_user.id, db) for article in articles],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/unassigned")
def get_unassigned_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    high_priority_only: bool = False,
    current_user: User = Depends(require_permission(Permission.TRIAGE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Get articles that haven't been assigned to anyone."""
    query = db.query(Article).filter(Article.assigned_analyst_id == None)
    
    if status_filter:
        query = query.filter(Article.status == status_filter)
    
    if high_priority_only:
        query = query.filter(Article.is_high_priority == True)
    
    total = query.count()
    articles = query.order_by(
        desc(Article.is_high_priority),
        desc(Article.created_at)
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "articles": [article_to_response(article, current_user.id, db) for article in articles],
        "total": total,
        "page": page,
        "page_size": page_size
    }


# =============================================================================
# Intelligence View Endpoints - Comprehensive IOC/TTP tracking
# =============================================================================

@router.get("/intelligence/summary")
def get_intelligence_summary(
    status_filter: Optional[str] = Query(None, description="Filter by article status"),
    intel_type: Optional[str] = Query(None, description="IOC, TTP, or ATLAS"),
    time_range: Optional[str] = Query(None, description="Time range: 1h, 6h, 12h, 24h, 7d, 30d, 90d, all"),
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Get summary of all extracted intelligence across articles with optional time filtering."""
    from sqlalchemy import func
    from app.models import ExtractedIntelligenceType, WatchListKeyword
    from datetime import datetime, timedelta
    
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
    
    # Base query
    query = db.query(ExtractedIntelligence).join(Article)
    
    if start_date:
        query = query.filter(Article.created_at >= start_date)
    
    if status_filter:
        query = query.filter(Article.status == status_filter)
    
    if intel_type:
        try:
            intel_enum = ExtractedIntelligenceType[intel_type.upper()]
            query = query.filter(ExtractedIntelligence.intelligence_type == intel_enum)
        except KeyError:
            pass
    
    # Get counts by type
    type_counts = db.query(
        ExtractedIntelligence.intelligence_type,
        func.count(ExtractedIntelligence.id)
    ).join(Article)
    
    if start_date:
        type_counts = type_counts.filter(Article.created_at >= start_date)
    
    if status_filter:
        type_counts = type_counts.filter(Article.status == status_filter)
    
    type_counts = type_counts.group_by(ExtractedIntelligence.intelligence_type).all()
    
    # Get MITRE technique counts
    mitre_counts = db.query(
        ExtractedIntelligence.mitre_id,
        func.count(ExtractedIntelligence.id)
    ).filter(
        ExtractedIntelligence.mitre_id != None
    ).group_by(ExtractedIntelligence.mitre_id).order_by(
        func.count(ExtractedIntelligence.id).desc()
    ).limit(20).all()
    
    # Get article counts by status with intelligence
    status_counts = db.query(
        Article.status,
        func.count(func.distinct(Article.id))
    ).join(ExtractedIntelligence).group_by(Article.status).all()
    
    # Get active watchlist keywords
    active_keywords = db.query(WatchListKeyword).filter(WatchListKeyword.is_active == True).all()
    
    return {
        "intelligence_by_type": {
            t.value if hasattr(t, 'value') else str(t): c 
            for t, c in type_counts
        },
        "top_mitre_techniques": [
            {"mitre_id": mid, "count": c} for mid, c in mitre_counts if mid
        ],
        "articles_with_intel_by_status": {
            s.value if hasattr(s, 'value') else str(s): c 
            for s, c in status_counts
        },
        "total_intelligence": query.count(),
        "active_watchlist_keywords": [kw.keyword for kw in active_keywords]
    }


@router.get("/intelligence/all")
def get_all_intelligence(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, description="Filter by article status"),
    intel_type: Optional[str] = Query(None, description="IOC, TTP, or ATLAS"),
    mitre_framework: Optional[str] = Query(None, description="attack or atlas"),
    with_hunts_only: bool = Query(False, description="Only show intel from hunt results"),
    article_id: Optional[int] = Query(None, description="Filter by specific article ID"),
    ioc_type: Optional[str] = Query(None, description="Filter by IOC subtype (ip, domain, hash, email, etc.)"),
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Get all extracted intelligence with article context, hunt info, and MITRE mapping."""
    from app.models import Hunt, HuntExecution, HuntTriggerType, ExtractedIntelligenceType, WatchListKeyword
    
    # Build query
    query = db.query(ExtractedIntelligence).join(Article).options(
        joinedload(ExtractedIntelligence.article).joinedload(Article.feed_source)
    )
    
    # Filter by specific article
    if article_id:
        query = query.filter(ExtractedIntelligence.article_id == article_id)
    
    if status_filter:
        query = query.filter(Article.status == status_filter)
    
    if intel_type:
        try:
            intel_enum = ExtractedIntelligenceType[intel_type.upper()]
            query = query.filter(ExtractedIntelligence.intelligence_type == intel_enum)
        except KeyError:
            pass
    
    if mitre_framework == "attack":
        query = query.filter(ExtractedIntelligence.mitre_id.like("T%"))
    elif mitre_framework == "atlas":
        query = query.filter(ExtractedIntelligence.mitre_id.like("AML%"))
    
    if with_hunts_only:
        query = query.filter(ExtractedIntelligence.hunt_execution_id != None)
    
    # Filter by IOC subtype (stored in meta.type)
    if ioc_type:
        # Use JSON contains for meta.type filtering
        query = query.filter(
            ExtractedIntelligence.meta.op('->>')('type') == ioc_type
        )
    
    total = query.count()
    intel_items = query.order_by(desc(ExtractedIntelligence.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    # Get active watchlist keywords for matching
    active_keywords = db.query(WatchListKeyword).filter(WatchListKeyword.is_active == True).all()
    keyword_list = [kw.keyword.lower() for kw in active_keywords]
    
    results = []
    for intel in intel_items:
        article = intel.article
        meta = intel.meta or {}
        
        # Get hunt info
        hunt_info = None
        if intel.hunt_execution_id:
            execution = db.query(HuntExecution).filter(HuntExecution.id == intel.hunt_execution_id).first()
            if execution:
                hunt = db.query(Hunt).filter(Hunt.id == execution.hunt_id).first()
                initiated_by = "AUTO" if execution.trigger_type == HuntTriggerType.AUTO else None
                if not initiated_by and execution.executed_by_id:
                    user = db.query(User).filter(User.id == execution.executed_by_id).first()
                    initiated_by = user.username if user else f"User #{execution.executed_by_id}"
                
                hunt_info = {
                    "hunt_id": execution.hunt_id,
                    "execution_id": execution.id,
                    "platform": hunt.platform if hunt else None,
                    "status": execution.status.value if hasattr(execution.status, 'value') else str(execution.status),
                    "hits_count": execution.hits_count or 0,
                    "initiated_by": initiated_by,
                    "executed_at": execution.executed_at.isoformat() if execution.executed_at else None,
                    "findings_summary": execution.findings_summary
                }
        
        # Determine MITRE framework
        mitre_fw = None
        if intel.mitre_id:
            mitre_fw = "atlas" if intel.mitre_id.startswith("AML") else "attack"
        
        # Check watchlist matches
        matched_keywords = []
        if article:
            content = ((article.title or "") + " " + (article.summary or "")).lower()
            matched_keywords = [kw for kw in keyword_list if kw in content]
        
        results.append({
            "id": intel.id,
            "intelligence_type": intel.intelligence_type.value if hasattr(intel.intelligence_type, 'value') else str(intel.intelligence_type),
            "value": intel.value,
            "confidence": intel.confidence,
            "evidence": intel.evidence,
            "ioc_type": meta.get("ioc_type") or meta.get("type"),
            "mitre_id": intel.mitre_id,
            "mitre_name": meta.get("mitre_name") or meta.get("name"),
            "mitre_url": f"https://attack.mitre.org/techniques/{intel.mitre_id}/" if intel.mitre_id and intel.mitre_id.startswith("T") else (f"https://atlas.mitre.org/techniques/{intel.mitre_id}" if intel.mitre_id else None),
            "mitre_framework": mitre_fw,
            "created_at": intel.created_at.isoformat() if intel.created_at else None,
            "article": {
                "id": article.id,
                "title": article.title,
                "status": article.status.value if hasattr(article.status, 'value') else str(article.status),
                "is_high_priority": article.is_high_priority,
                "source_name": article.feed_source.name if article.feed_source else None,
                "published_at": article.published_at.isoformat() if article.published_at else None,
                "ingested_at": (getattr(article, 'ingested_at', None) or article.created_at).isoformat() if (getattr(article, 'ingested_at', None) or article.created_at) else None,
                "created_at": article.created_at.isoformat() if article.created_at else None,
                "watchlist_matches": matched_keywords
            } if article else None,
            "hunt": hunt_info
        })
    
    return {
        "intelligence": results,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/intelligence/mitre-matrix")
def get_mitre_matrix(
    framework: str = Query("attack", description="attack or atlas"),
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Get intelligence mapped to MITRE ATT&CK or ATLAS matrix format."""
    from sqlalchemy import func
    
    # Get all TTPs with MITRE IDs
    query = db.query(
        ExtractedIntelligence.mitre_id,
        func.count(ExtractedIntelligence.id).label("count"),
        func.array_agg(func.distinct(Article.id)).label("article_ids")
    ).join(Article).filter(
        ExtractedIntelligence.mitre_id != None
    )
    
    if status_filter:
        query = query.filter(Article.status == status_filter)
    
    if framework == "attack":
        query = query.filter(ExtractedIntelligence.mitre_id.like("T%"))
    elif framework == "atlas":
        query = query.filter(ExtractedIntelligence.mitre_id.like("AML%"))
    
    results = query.group_by(ExtractedIntelligence.mitre_id).all()
    
    # Build matrix data
    matrix = {}
    for mitre_id, count, article_ids in results:
        if not mitre_id:
            continue
        
        # Parse tactic from technique ID
        tactic = "Other"
        if mitre_id.startswith("T1"):
            technique_num = int(mitre_id[1:5]) if mitre_id[1:5].isdigit() else 0
            if technique_num < 200:
                tactic = "Initial Access"
            elif technique_num < 300:
                tactic = "Execution"
            elif technique_num < 400:
                tactic = "Persistence"
            elif technique_num < 500:
                tactic = "Privilege Escalation"
            elif technique_num < 600:
                tactic = "Defense Evasion"
            elif technique_num < 700:
                tactic = "Credential Access"
            elif technique_num < 800:
                tactic = "Discovery"
            else:
                tactic = "Other"
        
        if tactic not in matrix:
            matrix[tactic] = []
        
        matrix[tactic].append({
            "technique_id": mitre_id,
            "count": count,
            "article_count": len(set(article_ids)) if article_ids else 0,
            "url": f"https://attack.mitre.org/techniques/{mitre_id}/" if framework == "attack" else f"https://atlas.mitre.org/techniques/{mitre_id}"
        })
    
    return {
        "framework": framework,
        "status_filter": status_filter,
        "tactics": matrix,
        "total_techniques": len(results)
    }


# ============ MANUAL GENAI ENDPOINTS ============

from pydantic import BaseModel

class GenAIExtractionRequest(BaseModel):
    use_genai: bool = True  # If false, use regex only
    model_id: Optional[str] = None  # Specific model to use (e.g., "ollama:llama3:latest", "openai")
    compare_mode: bool = False  # If true, return both regex and GenAI results without saving
    save_results: bool = True  # If false, only return results without saving to DB
    include_technical_summary: bool = True  # If true, extract from technical summary as well


@router.post("/{article_id}/extract-intelligence", summary="Manually extract IOCs/TTPs from article")
async def extract_article_intelligence(
    article_id: int,
    request: GenAIExtractionRequest = GenAIExtractionRequest(),
    current_user: User = Depends(require_permission(Permission.EXTRACT_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Manually extract IOCs and TTPs from an article.
    
    If use_genai=True (default), uses Ollama/OpenAI for intelligent extraction.
    If use_genai=False, uses regex-based extraction only.
    If compare_mode=True, runs both methods and returns comparison without saving.
    """
    from app.models import ExtractedIntelligenceType
    
    article = db.query(Article).options(
        joinedload(Article.feed_source)
    ).filter(Article.id == article_id).first()
    
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    # Prepare content - include technical summary if available for better extraction
    article_content = article.normalized_content or article.raw_content or ''
    technical_summary = article.technical_summary or ''
    
    # Build comprehensive content for extraction
    content_parts = [f"Title: {article.title}"]
    if article.summary:
        content_parts.append(f"Summary: {article.summary}")
    
    # Include technical summary in extraction input (contains structured IOC/TTP info)
    if request.include_technical_summary and technical_summary:
        content_parts.append(f"Technical Analysis:\n{technical_summary}")
    
    content_parts.append(f"Original Content:\n{article_content}")
    content = "\n\n".join(content_parts)
    
    source_url = article.url or (article.feed_source.url if article.feed_source else None)
    
    # Compare mode - run both methods and return without saving
    if request.compare_mode:
        regex_results = IntelligenceExtractor.extract_all(content, source_url=source_url)
        try:
            genai_results = await IntelligenceExtractor.extract_with_genai(content, source_url=source_url)
            genai_error = None
        except Exception as e:
            genai_results = {"iocs": [], "ttps": [], "atlas": []}
            genai_error = str(e)
        
        # Add source tags
        for ioc in regex_results.get("iocs", []):
            ioc["source"] = "regex"
        for ioc in genai_results.get("iocs", []):
            ioc["source"] = "genai"
        
        return {
            "article_id": article_id,
            "article_title": article.title,
            "mode": "compare",
            "regex": {
                "iocs": regex_results.get("iocs", []),
                "ttps": regex_results.get("ttps", []),
                "atlas": regex_results.get("atlas", []),
                "totals": {
                    "iocs": len(regex_results.get("iocs", [])),
                    "ttps": len(regex_results.get("ttps", [])),
                    "atlas": len(regex_results.get("atlas", []))
                }
            },
            "genai": {
                "iocs": genai_results.get("iocs", []),
                "ttps": genai_results.get("ttps", []),
                "atlas": genai_results.get("atlas", []),
                "totals": {
                    "iocs": len(genai_results.get("iocs", [])),
                    "ttps": len(genai_results.get("ttps", [])),
                    "atlas": len(genai_results.get("atlas", []))
                },
                "error": genai_error
            }
        }
    
    # Standard extraction
    if request.use_genai:
        try:
            extracted = await IntelligenceExtractor.extract_with_genai(content, source_url=source_url)
            extraction_method = "genai"
        except Exception as e:
            logger.warning("genai_extraction_fallback", article_id=article_id, error=str(e))
            extracted = IntelligenceExtractor.extract_all(content, source_url=source_url)
            extraction_method = "regex_fallback"
    else:
        extracted = IntelligenceExtractor.extract_all(content, source_url=source_url)
        extraction_method = "regex"
    
    # If save_results=False, just return the results without saving
    if not request.save_results:
        return {
            "article_id": article_id,
            "article_title": article.title,
            "extraction_method": extraction_method,
            "preview_only": True,
            "extracted_items": {
                "iocs": extracted.get("iocs", []),
                "ttps": extracted.get("ttps", []),
                "atlas": extracted.get("atlas", [])
            },
            "totals": {
                "iocs": len(extracted.get("iocs", [])),
                "ttps": len(extracted.get("ttps", [])),
                "atlas": len(extracted.get("atlas", []))
            }
        }
    
    # Clear existing intelligence
    db.query(ExtractedIntelligence).filter(
        ExtractedIntelligence.article_id == article_id
    ).delete()
    
    # Save extracted intelligence (IOCs and TTPs only)
    saved_count = {"iocs": 0, "ttps": 0, "atlas": 0}
    
    for ioc in extracted.get("iocs", []):
        intel = ExtractedIntelligence(
            article_id=article_id,
            intelligence_type=ExtractedIntelligenceType.IOC,
            value=ioc.get("value"),
            confidence=ioc.get("confidence", 80),
            evidence=ioc.get("evidence"),
            meta={"type": ioc.get("type"), "source": ioc.get("source", extraction_method)}
        )
        db.add(intel)
        saved_count["iocs"] += 1
    
    for ttp in extracted.get("ttps", []):
        intel = ExtractedIntelligence(
            article_id=article_id,
            intelligence_type=ExtractedIntelligenceType.TTP,
            value=ttp.get("name", ""),
            mitre_id=ttp.get("mitre_id"),
            confidence=ttp.get("confidence", 80),
            evidence=ttp.get("evidence"),
            meta={"source": ttp.get("source", extraction_method)}
        )
        db.add(intel)
        saved_count["ttps"] += 1
    
    # Note: IOAs removed - only tracking IOCs and TTPs
    
    for atlas in extracted.get("atlas", []):
        intel = ExtractedIntelligence(
            article_id=article_id,
            intelligence_type=ExtractedIntelligenceType.ATLAS,
            value=atlas.get("name", ""),
            mitre_id=atlas.get("mitre_id"),
            confidence=atlas.get("confidence", 70),
            meta={"framework": "ATLAS", "source": atlas.get("source", extraction_method)}
        )
        db.add(intel)
        saved_count["atlas"] += 1
    
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.EXTRACTION,
        action=f"Extracted intelligence from article {article_id} using {extraction_method}",
        resource_type="article",
        resource_id=article_id
    )
    
    logger.info("manual_extraction_complete", 
               article_id=article_id, 
               method=extraction_method,
               user_id=current_user.id, 
               counts=saved_count)
    
    return {
        "article_id": article_id,
        "article_title": article.title,
        "method": extraction_method,
        "extracted_count": sum(saved_count.values()),
        "saved": saved_count,
        "total": sum(saved_count.values()),
        "extracted_items": {
            "iocs": [{"type": i.get("type"), "value": i.get("value"), "confidence": i.get("confidence", 80), "source": i.get("source", extraction_method)} for i in extracted.get("iocs", [])],
            "ttps": [{"mitre_id": t.get("mitre_id"), "name": t.get("name"), "confidence": t.get("confidence", 80), "source": t.get("source", extraction_method)} for t in extracted.get("ttps", [])],
            "atlas": [{"mitre_id": a.get("mitre_id"), "name": a.get("name"), "confidence": a.get("confidence", 70), "source": a.get("source", extraction_method)} for a in extracted.get("atlas", [])]
        }
    }


class SummarizationRequest(BaseModel):
    model_id: Optional[str] = None  # Specific model to use


@router.post("/{article_id}/summarize", summary="Generate AI summary for article")
async def summarize_article(
    article_id: int,
    request: SummarizationRequest = SummarizationRequest(),
    current_user: User = Depends(require_permission(Permission.ANALYZE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Generate executive and technical summaries for an article using GenAI."""
    from app.genai.provider import get_model_manager
    
    article = db.query(Article).options(
        joinedload(Article.feed_source)
    ).filter(Article.id == article_id).first()
    
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    content = f"Title: {article.title}\n\n{article.normalized_content or article.raw_content or article.summary or ''}"
    
    try:
        model_manager = get_model_manager()
        
        # Use specified model or default
        model_id = request.model_id or model_manager.get_primary_model()
        
        # Executive summary prompt
        exec_result = await model_manager.generate_with_fallback(
            system_prompt="""You are a threat intelligence analyst writing for executives. 
Write a 2-3 paragraph executive summary covering:
1. What the threat is and its business impact
2. Key indicators and attack techniques  
3. High-level recommendations
Use clear, non-technical language suitable for C-level executives.""",
            user_prompt=f"Summarize this threat intelligence article:\n\n{content[:3000]}",
            preferred_model=model_id
        )
        exec_summary = exec_result.get("response", "")
        
        # Technical summary prompt
        tech_result = await model_manager.generate_with_fallback(
            system_prompt="""You are a senior SOC analyst writing a technical summary.
Include:
1. Attack chain analysis with MITRE ATT&CK mapping
2. Detailed IOC breakdown by type
3. Detection opportunities and hunt queries
4. Remediation steps
Be thorough and technical, suitable for SOC analysts and threat hunters.""",
            user_prompt=f"Write a technical summary for SOC analysts:\n\n{content[:4000]}",
            preferred_model=model_id
        )
        tech_summary = tech_result.get("response", "")
        
        model_used = exec_result.get("model_used", model_id)
        
        # Update article
        article.executive_summary = exec_summary
        article.technical_summary = tech_summary
        article.genai_analysis_remarks = f"Summarized using {model_used} by {current_user.username}"
        
        db.commit()
        
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.ARTICLE_LIFECYCLE,
            action=f"Generated AI summary for article {article_id} using {model_used}",
            resource_type="article",
            resource_id=article_id
        )
        
        logger.info("article_summarized", article_id=article_id, user_id=current_user.id, model=model_used)
        
        return {
            "article_id": article_id,
            "article_title": article.title,
            "status": "success",
            "model_used": model_used,
            "executive_summary": exec_summary,
            "technical_summary": tech_summary
        }
        
    except Exception as e:
        logger.error("summarization_failed", article_id=article_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {str(e)}"
        )


# ============ DELETE ENDPOINTS FOR INTELLIGENCE ============

@router.delete("/intelligence/{intel_id}", summary="Delete a specific intelligence item")
def delete_intelligence_item(
    intel_id: int,
    current_user: User = Depends(require_permission(Permission.EXTRACT_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Delete a specific extracted intelligence item (IOC, TTP, or ATLAS)."""
    intel = db.query(ExtractedIntelligence).filter(ExtractedIntelligence.id == intel_id).first()
    
    if not intel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intelligence item not found")
    
    article_id = intel.article_id
    intel_type = intel.intelligence_type.value if hasattr(intel.intelligence_type, 'value') else str(intel.intelligence_type)
    intel_value = intel.value
    
    db.delete(intel)
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.EXTRACTION,
        action=f"Deleted {intel_type}: {intel_value[:50]}",
        resource_type="intelligence",
        resource_id=intel_id
    )
    
    logger.info("intelligence_deleted", intel_id=intel_id, article_id=article_id, user_id=current_user.id)
    
    return {"message": f"Intelligence item {intel_id} deleted", "intel_type": intel_type}


class IntelligenceUpdateRequest(BaseModel):
    """Request to update an intelligence item."""
    value: Optional[str] = None
    confidence: Optional[int] = None
    mitre_id: Optional[str] = None
    mitre_name: Optional[str] = None
    evidence: Optional[str] = None
    meta: Optional[dict] = None


@router.patch("/intelligence/{intel_id}", summary="Update a specific intelligence item")
def update_intelligence_item(
    intel_id: int,
    request: IntelligenceUpdateRequest,
    current_user: User = Depends(require_permission(Permission.EXTRACT_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Update a specific extracted intelligence item (IOC or TTP).
    
    Allows editing:
    - Value (the IOC value or TTP name)
    - Confidence score
    - MITRE ID and name
    - Evidence/context
    - Metadata (IOC type, etc.)
    """
    intel = db.query(ExtractedIntelligence).filter(ExtractedIntelligence.id == intel_id).first()
    
    if not intel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intelligence item not found")
    
    old_value = intel.value
    
    # Update fields if provided
    if request.value is not None:
        intel.value = request.value
    
    if request.confidence is not None:
        intel.confidence = max(0, min(100, request.confidence))
    
    if request.mitre_id is not None:
        intel.mitre_id = request.mitre_id
    
    if request.evidence is not None:
        intel.evidence = request.evidence
    
    if request.meta is not None:
        # Merge with existing meta
        existing_meta = intel.meta or {}
        existing_meta.update(request.meta)
        # Store mitre_name in meta if provided
        if request.mitre_name is not None:
            existing_meta["mitre_name"] = request.mitre_name
        intel.meta = existing_meta
    elif request.mitre_name is not None:
        # Store mitre_name in meta even if no other meta provided
        existing_meta = intel.meta or {}
        existing_meta["mitre_name"] = request.mitre_name
        intel.meta = existing_meta
    db.commit()
    db.refresh(intel)
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.EXTRACTION,
        action=f"Updated intelligence: {old_value[:30]} -> {intel.value[:30]}",
        resource_type="intelligence",
        resource_id=intel_id
    )
    
    logger.info("intelligence_updated", 
               intel_id=intel_id, 
               article_id=intel.article_id, 
               user_id=current_user.id)
    
    meta = intel.meta or {}
    return {
        "id": intel.id,
        "value": intel.value,
        "intelligence_type": intel.intelligence_type.value if hasattr(intel.intelligence_type, 'value') else str(intel.intelligence_type),
        "confidence": intel.confidence,
        "mitre_id": intel.mitre_id,
        "mitre_name": meta.get("mitre_name"),
        "evidence": intel.evidence,
        "meta": intel.meta,
        "message": "Intelligence updated successfully"
    }


@router.delete("/intelligence/batch", summary="Delete multiple intelligence items")
def delete_intelligence_batch(
    intel_ids: List[int] = Query(..., description="List of intelligence IDs to delete"),
    current_user: User = Depends(require_permission(Permission.EXTRACT_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Delete multiple intelligence items at once."""
    deleted_count = 0
    
    for intel_id in intel_ids:
        intel = db.query(ExtractedIntelligence).filter(ExtractedIntelligence.id == intel_id).first()
        if intel:
            db.delete(intel)
            deleted_count += 1
    
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.EXTRACTION,
        action=f"Batch deleted {deleted_count} intelligence items",
        resource_type="intelligence",
        resource_id=None
    )
    
    logger.info("intelligence_batch_deleted", count=deleted_count, user_id=current_user.id)
    
    return {"message": f"Deleted {deleted_count} intelligence items", "deleted_count": deleted_count}


@router.delete("/{article_id}/intelligence/all", summary="Delete all intelligence for an article")
def delete_all_article_intelligence(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.EXTRACT_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Delete all extracted intelligence for a specific article."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    deleted_count = db.query(ExtractedIntelligence).filter(
        ExtractedIntelligence.article_id == article_id
    ).delete()
    
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.EXTRACTION,
        action=f"Deleted all {deleted_count} intelligence items from article {article_id}",
        resource_type="article",
        resource_id=article_id
    )
    
    logger.info("article_intelligence_cleared", article_id=article_id, count=deleted_count, user_id=current_user.id)
    
    return {
        "message": f"Deleted all intelligence for article {article_id}",
        "article_id": article_id,
        "deleted_count": deleted_count
    }


# ============ REVIEW/APPROVE ENDPOINTS FOR INTELLIGENCE ============

class IntelligenceReviewRequest(BaseModel):
    is_reviewed: bool = True  # Mark as reviewed/approved
    is_false_positive: bool = False  # Mark as false positive
    notes: Optional[str] = None  # Analyst notes


@router.post("/intelligence/{intel_id}/review", summary="Review/approve an intelligence item")
async def review_intelligence_item(
    intel_id: int,
    request: IntelligenceReviewRequest,
    current_user: User = Depends(require_permission(Permission.ANALYZE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Mark an extracted intelligence item as reviewed (approved or false positive)."""
    from datetime import datetime
    
    intel = db.query(ExtractedIntelligence).filter(ExtractedIntelligence.id == intel_id).first()
    
    if not intel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intelligence item not found")
    
    intel.is_reviewed = request.is_reviewed
    intel.is_false_positive = request.is_false_positive
    intel.reviewed_by = current_user.id
    intel.reviewed_at = datetime.utcnow()
    if request.notes:
        intel.notes = request.notes
    
    db.commit()
    db.refresh(intel)
    
    action = "approved" if not request.is_false_positive else "marked as false positive"
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.EXTRACTION,
        action=f"Intelligence item {intel_id} {action}",
        resource_type="intelligence",
        resource_id=intel_id
    )
    
    logger.info("intelligence_reviewed", intel_id=intel_id, is_false_positive=request.is_false_positive, user_id=current_user.id)
    
    return {
        "intel_id": intel_id,
        "status": "reviewed",
        "is_false_positive": request.is_false_positive,
        "reviewed_by": current_user.username,
        "reviewed_at": intel.reviewed_at.isoformat() if intel.reviewed_at else None
    }


class BatchReviewRequest(BaseModel):
    intel_ids: List[int]
    is_reviewed: bool = True
    is_false_positive: bool = False
    notes: Optional[str] = None


@router.post("/intelligence/batch-review", summary="Review multiple intelligence items")
async def review_intelligence_batch(
    request: BatchReviewRequest,
    current_user: User = Depends(require_permission(Permission.ANALYZE_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Mark multiple intelligence items as reviewed at once."""
    from datetime import datetime
    
    reviewed_count = 0
    now = datetime.utcnow()
    
    for intel_id in request.intel_ids:
        intel = db.query(ExtractedIntelligence).filter(ExtractedIntelligence.id == intel_id).first()
        if intel:
            intel.is_reviewed = request.is_reviewed
            intel.is_false_positive = request.is_false_positive
            intel.reviewed_by = current_user.id
            intel.reviewed_at = now
            if request.notes:
                intel.notes = request.notes
            reviewed_count += 1
    
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.EXTRACTION,
        action=f"Batch reviewed {reviewed_count} intelligence items",
        resource_type="intelligence",
        resource_id=None
    )
    
    logger.info("intelligence_batch_reviewed", count=reviewed_count, user_id=current_user.id)
    
    return {
        "message": f"Reviewed {reviewed_count} intelligence items",
        "reviewed_count": reviewed_count,
        "is_false_positive": request.is_false_positive
    }


# ============ ARTICLE EXPORT ENDPOINTS ============

from fastapi.responses import StreamingResponse
import io
from datetime import datetime as dt


@router.get("/{article_id}/export/pdf", summary="Export article as PDF")
async def export_article_pdf(
    article_id: int,
    include_intelligence: bool = Query(True, description="Include extracted IOCs and TTPs"),
    include_summaries: bool = Query(True, description="Include executive and technical summaries"),
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Export a single article as a professionally formatted PDF.
    
    Includes executive summary, technical summary, IOCs, TTPs, and metadata.
    """
    article = db.query(Article).options(
        joinedload(Article.feed_source)
    ).filter(Article.id == article_id).first()
    
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    # Get extracted intelligence if requested
    intel_list = []
    if include_intelligence:
        intel = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == article_id
        ).all()
        intel_list = intel
    
    # Generate PDF using ReportLab
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.colors import HexColor, white
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF generation requires reportlab. Install with: pip install reportlab"
        )
    
    # Get branding settings
    branding = {}
    try:
        from app.models import SystemConfiguration
        configs = db.query(SystemConfiguration).filter(
            SystemConfiguration.category == 'branding'
        ).all()
        for config in configs:
            branding[config.key] = config.value
    except:
        pass
    
    company_name = branding.get('company_name', 'Parshu Security')
    confidentiality = branding.get('confidentiality_notice', 'CONFIDENTIAL - Internal Use Only')
    primary_color = branding.get('primary_color', '#1890ff')
    dark_color = branding.get('dark_color', '#1a1a2e')
    
    pdf_buffer = io.BytesIO()
    
    # Custom header/footer with branding
    def add_header_footer(canvas, doc):
        canvas.saveState()
        # Header bar
        canvas.setFillColor(HexColor(dark_color))
        canvas.rect(0, 730, 612, 62, fill=1, stroke=0)
        
        canvas.setFillColor(white)
        canvas.setFont('Helvetica-Bold', 11)
        canvas.drawString(72, 755, company_name.upper())
        canvas.setFont('Helvetica', 9)
        canvas.drawString(72, 740, "Article Intelligence Report")
        canvas.drawRightString(540, 748, f"Page {doc.page}")
        
        # Blue accent line
        canvas.setStrokeColor(HexColor(primary_color))
        canvas.setLineWidth(3)
        canvas.line(0, 730, 612, 730)
        
        # Footer
        canvas.setFillColor(HexColor(dark_color))
        canvas.rect(0, 0, 612, 40, fill=1, stroke=0)
        
        canvas.setFillColor(white)
        canvas.setFont('Helvetica', 8)
        canvas.drawString(72, 18, f"Generated: {dt.utcnow().strftime('%B %d, %Y at %H:%M UTC')}")
        canvas.drawCentredString(306, 18, confidentiality)
        canvas.drawRightString(540, 18, "PARSHU PLATFORM")
        
        canvas.restoreState()
    
    doc = SimpleDocTemplate(
        pdf_buffer, 
        pagesize=letter, 
        rightMargin=50, 
        leftMargin=50, 
        topMargin=100, 
        bottomMargin=60
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles with branding colors
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=HexColor(dark_color),
        spaceAfter=20
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor('#16213e'),
        spaceBefore=16,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=HexColor('#333333'),
        alignment=TA_JUSTIFY
    )
    
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=HexColor('#666666'),
        spaceAfter=4
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph(article.title or "Untitled Article", title_style))
    elements.append(Spacer(1, 12))
    
    # Metadata table
    meta_data = [
        ['Source', article.feed_source.name if article.feed_source else 'Unknown'],
        ['Status', article.status.value if hasattr(article.status, 'value') else str(article.status)],
        ['Published', article.published_at.strftime('%Y-%m-%d %H:%M') if article.published_at else 'Unknown'],
        ['Generated', dt.utcnow().strftime('%Y-%m-%d %H:%M UTC')],
        ['URL', article.url[:80] + '...' if article.url and len(article.url) > 80 else (article.url or 'N/A')]
    ]
    
    if article.is_high_priority:
        meta_data.insert(1, ['Priority', 'HIGH PRIORITY'])
    
    meta_table = Table(meta_data, colWidths=[1.2*inch, 4.5*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#f0f0f0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), HexColor('#333333')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
    ]))
    
    elements.append(meta_table)
    elements.append(Spacer(1, 20))
    
    # Executive Summary
    if include_summaries and article.executive_summary:
        elements.append(Paragraph("Executive Summary", heading_style))
        # Clean markdown-style formatting for PDF
        exec_text = _clean_markdown_for_pdf(article.executive_summary)
        elements.append(Paragraph(exec_text, body_style))
        elements.append(Spacer(1, 12))
    
    # Technical Summary
    if include_summaries and article.technical_summary:
        elements.append(Paragraph("Technical Summary", heading_style))
        tech_text = _clean_markdown_for_pdf(article.technical_summary)
        elements.append(Paragraph(tech_text, body_style))
        elements.append(Spacer(1, 12))
    
    # Extracted Intelligence
    if include_intelligence and intel_list:
        elements.append(Paragraph("Extracted Intelligence", heading_style))
        
        # Separate IOCs and TTPs
        iocs = [i for i in intel_list if str(i.intelligence_type.value if hasattr(i.intelligence_type, 'value') else i.intelligence_type) == 'IOC']
        ttps = [i for i in intel_list if str(i.intelligence_type.value if hasattr(i.intelligence_type, 'value') else i.intelligence_type) == 'TTP']
        
        if iocs:
            elements.append(Paragraph(f"Indicators of Compromise ({len(iocs)})", ParagraphStyle('SubHeading', parent=styles['Heading3'], fontSize=11, spaceAfter=8)))
            ioc_data = [['Type', 'Value', 'Confidence']]
            for ioc in iocs[:50]:  # Limit to 50 for PDF size
                ioc_data.append([
                    (ioc.meta or {}).get('ioc_type', 'unknown'),
                    (ioc.value[:60] + '...') if len(ioc.value) > 60 else ioc.value,
                    f"{ioc.confidence}%"
                ])
            
            ioc_table = Table(ioc_data, colWidths=[1.2*inch, 3.8*inch, 0.7*inch])
            ioc_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#e6f7ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), HexColor('#333333')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('PADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            elements.append(ioc_table)
            elements.append(Spacer(1, 12))
        
        if ttps:
            elements.append(Paragraph(f"Tactics, Techniques & Procedures ({len(ttps)})", ParagraphStyle('SubHeading', parent=styles['Heading3'], fontSize=11, spaceAfter=8)))
            ttp_data = [['MITRE ID', 'Name', 'Confidence']]
            for ttp in ttps[:30]:  # Limit to 30
                ttp_data.append([
                    ttp.mitre_id or 'N/A',
                    (ttp.value[:50] + '...') if len(ttp.value) > 50 else ttp.value,
                    f"{ttp.confidence}%"
                ])
            
            ttp_table = Table(ttp_data, colWidths=[1*inch, 4*inch, 0.7*inch])
            ttp_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#f9f0ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), HexColor('#333333')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('PADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            elements.append(ttp_table)
    
    # Build PDF with branded header/footer
    doc.build(elements, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    pdf_buffer.seek(0)
    
    # Clean filename
    safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in (article.title or 'article')[:50])
    
    logger.info("article_pdf_exported", article_id=article_id, user_id=current_user.id)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_{article_id}.pdf"}
    )


def _clean_markdown_for_pdf(text: str) -> str:
    """Convert markdown to clean text for PDF rendering."""
    if not text:
        return ""
    
    import re
    
    # Remove markdown headers but keep text
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    
    # Convert bold
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'__([^_]+)__', r'<b>\1</b>', text)
    
    # Convert italic
    text = re.sub(r'\*([^*]+)\*', r'<i>\1</i>', text)
    text = re.sub(r'_([^_]+)_', r'<i>\1</i>', text)
    
    # Convert inline code
    text = re.sub(r'`([^`]+)`', r'<font face="Courier">\1</font>', text)
    
    # Convert bullet points
    text = re.sub(r'^[-*+]\s+', '• ', text, flags=re.MULTILINE)
    
    # Convert numbered lists
    text = re.sub(r'^\d+\.\s+', '• ', text, flags=re.MULTILINE)
    
    # Remove links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    
    # Remove horizontal rules
    text = re.sub(r'^[-*_]{3,}$', '', text, flags=re.MULTILINE)
    
    # Clean up extra whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()


@router.get("/{article_id}/export/html", summary="Export article as HTML")
async def export_article_html(
    article_id: int,
    include_intelligence: bool = Query(True, description="Include extracted IOCs and TTPs"),
    include_summaries: bool = Query(True, description="Include executive and technical summaries"),
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Export a single article as a professionally formatted HTML document.
    
    Can be viewed in browser, converted to Word, or printed as PDF.
    """
    article = db.query(Article).options(
        joinedload(Article.feed_source)
    ).filter(Article.id == article_id).first()
    
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    # Get extracted intelligence if requested
    intel_list = []
    if include_intelligence:
        intel = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == article_id
        ).all()
        intel_list = intel
    
    # Generate HTML
    html_content = _generate_article_html(article, intel_list, include_summaries, include_intelligence)
    
    logger.info("article_html_exported", article_id=article_id, user_id=current_user.id)
    
    safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in (article.title or 'article')[:50])
    
    return StreamingResponse(
        io.BytesIO(html_content.encode('utf-8')),
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_{article_id}.html"}
    )


def _generate_article_html(article: Article, intel_list: list, include_summaries: bool, include_intel: bool) -> str:
    """Generate a professional HTML report for an article."""
    
    def markdown_to_html(text: str) -> str:
        """Convert markdown to HTML."""
        if not text:
            return ""
        import re
        
        # Headers
        text = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', text, flags=re.MULTILINE)
        text = re.sub(r'^### (.+)$', r'<h3>\1</h3>', text, flags=re.MULTILINE)
        text = re.sub(r'^## (.+)$', r'<h2>\1</h2>', text, flags=re.MULTILINE)
        text = re.sub(r'^# (.+)$', r'<h1>\1</h1>', text, flags=re.MULTILINE)
        
        # Bold and italic
        text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'__([^_]+)__', r'<strong>\1</strong>', text)
        text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
        text = re.sub(r'_([^_]+)_', r'<em>\1</em>', text)
        
        # Inline code
        text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
        
        # Bullet lists
        lines = text.split('\n')
        result = []
        in_list = False
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(('- ', '* ', '+ ')):
                if not in_list:
                    result.append('<ul>')
                    in_list = True
                result.append(f'<li>{stripped[2:]}</li>')
            else:
                if in_list:
                    result.append('</ul>')
                    in_list = False
                if stripped:
                    result.append(f'<p>{line}</p>')
        if in_list:
            result.append('</ul>')
        
        return '\n'.join(result)
    
    # Separate IOCs and TTPs
    iocs = [i for i in intel_list if str(i.intelligence_type.value if hasattr(i.intelligence_type, 'value') else i.intelligence_type) == 'IOC']
    ttps = [i for i in intel_list if str(i.intelligence_type.value if hasattr(i.intelligence_type, 'value') else i.intelligence_type) == 'TTP']
    
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{article.title or "Article Report"}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 48px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }}
        h1 {{
            color: #1a1a2e;
            font-size: 28px;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 3px solid #1890ff;
        }}
        h2 {{
            color: #16213e;
            font-size: 20px;
            margin-top: 32px;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e8e8e8;
        }}
        h3 {{
            color: #0f3460;
            font-size: 16px;
            margin-top: 24px;
            margin-bottom: 12px;
        }}
        .meta-box {{
            background: linear-gradient(135deg, #f6f8fa 0%, #eef2f7 100%);
            padding: 20px 24px;
            border-radius: 8px;
            margin-bottom: 32px;
            border-left: 4px solid #1890ff;
        }}
        .meta-box p {{
            margin: 6px 0;
            font-size: 14px;
        }}
        .meta-box strong {{
            color: #555;
            min-width: 100px;
            display: inline-block;
        }}
        .priority-badge {{
            display: inline-block;
            background: #ff4d4f;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 8px;
        }}
        .summary-section {{
            margin-bottom: 28px;
        }}
        .summary-section.executive {{
            background: linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%);
            padding: 24px;
            border-radius: 8px;
            border: 1px solid #91d5ff;
        }}
        .summary-section.technical {{
            background: linear-gradient(135deg, #f9f0ff 0%, #fff0f6 100%);
            padding: 24px;
            border-radius: 8px;
            border: 1px solid #d3adf7;
        }}
        .summary-section h2 {{
            margin-top: 0;
            border-bottom: none;
            padding-bottom: 0;
        }}
        .summary-section.executive h2 {{ color: #0050b3; }}
        .summary-section.technical h2 {{ color: #531dab; }}
        p {{ margin-bottom: 12px; text-align: justify; }}
        ul, ol {{ margin: 12px 0 12px 24px; }}
        li {{ margin-bottom: 6px; }}
        code {{
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9em;
            color: #d63384;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 13px;
        }}
        th, td {{
            padding: 10px 12px;
            text-align: left;
            border: 1px solid #e8e8e8;
        }}
        th {{
            background: #f6f8fa;
            font-weight: 600;
            color: #333;
        }}
        .ioc-table th {{ background: #e6f7ff; }}
        .ttp-table th {{ background: #f9f0ff; }}
        .tag {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }}
        .tag-ioc {{ background: #fff1f0; color: #cf1322; }}
        .tag-ttp {{ background: #f9f0ff; color: #722ed1; }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e8e8e8;
            color: #999;
            font-size: 12px;
            text-align: center;
        }}
        @media print {{
            body {{ background: white; padding: 0; }}
            .container {{ box-shadow: none; padding: 20px; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{article.title or "Untitled Article"}</h1>
        
        <div class="meta-box">
            <p><strong>Source:</strong> {article.feed_source.name if article.feed_source else 'Unknown'}</p>
            <p><strong>Status:</strong> {article.status.value if hasattr(article.status, 'value') else str(article.status)}
                {' <span class="priority-badge">HIGH PRIORITY</span>' if article.is_high_priority else ''}</p>
            <p><strong>Published:</strong> {article.published_at.strftime('%B %d, %Y at %H:%M UTC') if article.published_at else 'Unknown'}</p>
            <p><strong>Report Generated:</strong> {dt.utcnow().strftime('%B %d, %Y at %H:%M UTC')}</p>
            {f'<p><strong>Original URL:</strong> <a href="{article.url}" target="_blank">{article.url}</a></p>' if article.url else ''}
        </div>'''
    
    # Executive Summary
    if include_summaries and article.executive_summary:
        html += f'''
        <div class="summary-section executive">
            <h2>📋 Executive Summary</h2>
            {markdown_to_html(article.executive_summary)}
        </div>'''
    
    # Technical Summary
    if include_summaries and article.technical_summary:
        html += f'''
        <div class="summary-section technical">
            <h2>🔧 Technical Summary</h2>
            {markdown_to_html(article.technical_summary)}
        </div>'''
    
    # IOCs
    if include_intel and iocs:
        html += f'''
        <h2>🎯 Indicators of Compromise ({len(iocs)})</h2>
        <table class="ioc-table">
            <thead>
                <tr><th>Type</th><th>Value</th><th>Confidence</th></tr>
            </thead>
            <tbody>'''
        for ioc in iocs[:100]:
            ioc_type = (ioc.meta or {}).get('ioc_type', 'unknown')
            html += f'''
                <tr>
                    <td><span class="tag tag-ioc">{ioc_type}</span></td>
                    <td><code>{ioc.value}</code></td>
                    <td>{ioc.confidence}%</td>
                </tr>'''
        html += '''
            </tbody>
        </table>'''
    
    # TTPs
    if include_intel and ttps:
        html += f'''
        <h2>⚔️ Tactics, Techniques & Procedures ({len(ttps)})</h2>
        <table class="ttp-table">
            <thead>
                <tr><th>MITRE ID</th><th>Name</th><th>Confidence</th></tr>
            </thead>
            <tbody>'''
        for ttp in ttps[:50]:
            html += f'''
                <tr>
                    <td><span class="tag tag-ttp">{ttp.mitre_id or 'N/A'}</span></td>
                    <td>{ttp.value}</td>
                    <td>{ttp.confidence}%</td>
                </tr>'''
        html += '''
            </tbody>
        </table>'''
    
    html += '''
        <div class="footer">
            <p>Generated by Parshu Threat Intelligence Platform</p>
        </div>
    </div>
</body>
</html>'''
    
    return html


@router.get("/{article_id}/export/csv", summary="Export article IOCs as CSV")
async def export_article_csv(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Export extracted IOCs and TTPs from an article as CSV.
    
    Useful for importing into SIEMs, threat intel platforms, or spreadsheets.
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    # Get extracted intelligence
    intel = db.query(ExtractedIntelligence).filter(
        ExtractedIntelligence.article_id == article_id
    ).all()
    
    # Generate CSV
    import csv
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'type', 'value', 'ioc_type', 'mitre_id', 'mitre_url', 
        'confidence', 'source', 'is_reviewed', 'is_false_positive',
        'article_title', 'article_url'
    ])
    
    for item in intel:
        intel_type = item.intelligence_type.value if hasattr(item.intelligence_type, 'value') else str(item.intelligence_type)
        meta = item.meta or {}
        
        writer.writerow([
            intel_type,
            item.value,
            meta.get('ioc_type', ''),
            item.mitre_id or '',
            item.mitre_url or '',
            item.confidence,
            meta.get('source', 'extracted'),
            'Yes' if item.is_reviewed else 'No',
            'Yes' if item.is_false_positive else 'No',
            article.title or '',
            article.url or ''
        ])
    
    output.seek(0)
    
    logger.info("article_csv_exported", article_id=article_id, user_id=current_user.id, intel_count=len(intel))
    
    safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in (article.title or 'article')[:50])
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_{article_id}_iocs.csv"}
    )


@router.post("/{article_id}/fetch-image", summary="Fetch image for article")
async def fetch_article_image(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),
    db: Session = Depends(get_db)
):
    """Fetch and update the image for an article that doesn't have one.
    
    Attempts to extract the og:image or main image from the article's source URL.
    """
    from app.ingestion.parser import FeedParser
    
    article = db.query(Article).filter(Article.id == article_id).first()
    
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    
    if not article.url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Article has no URL")
    
    try:
        # Try to fetch image from article URL
        image_url = FeedParser.fetch_og_image(article.url, timeout=10)
        
        if image_url:
            article.image_url = image_url
            db.commit()
            db.refresh(article)
            
            logger.info("article_image_fetched", article_id=article_id, image_url=image_url)
            
            return {
                "success": True,
                "article_id": article_id,
                "image_url": image_url
            }
        else:
            return {
                "success": False,
                "article_id": article_id,
                "message": "No image found at article URL"
            }
            
    except Exception as e:
        logger.error("article_image_fetch_failed", article_id=article_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch image"
        )


@router.post("/batch-fetch-images", summary="Fetch images for multiple articles")
async def batch_fetch_images(
    limit: int = Query(50, ge=1, le=200, description="Maximum articles to process"),
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Fetch images for articles that don't have them.
    
    Admin function to backfill images for existing articles.
    """
    from app.ingestion.parser import FeedParser
    
    # Find articles without images
    articles = db.query(Article).filter(
        Article.image_url.is_(None),
        Article.url.isnot(None)
    ).limit(limit).all()
    
    if not articles:
        return {
            "success": True,
            "message": "No articles need image updates",
            "processed": 0,
            "updated": 0
        }
    
    updated = 0
    failed = 0
    
    for article in articles:
        try:
            image_url = FeedParser.fetch_og_image(article.url, timeout=5)
            if image_url:
                article.image_url = image_url
                updated += 1
        except Exception:
            failed += 1
            continue
    
    db.commit()
    
    logger.info(
        "batch_image_fetch_complete",
        user_id=current_user.id,
        processed=len(articles),
        updated=updated,
        failed=failed
    )
    
    return {
        "success": True,
        "processed": len(articles),
        "updated": updated,
        "failed": failed,
        "remaining": db.query(Article).filter(
            Article.image_url.is_(None),
            Article.url.isnot(None)
        ).count()
    }
