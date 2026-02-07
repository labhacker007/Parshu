"""IOC management and querying API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from datetime import datetime

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.auth.rbac import Permission
from app.models import User, IOC, ArticleIOC, Article
from app.core.logging import logger

router = APIRouter(prefix="/iocs", tags=["IOCs"])


@router.get("/types", summary="Get all IOC types")
def get_ioc_types(
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
):
    """Get all supported IOC types - serves as guardrail for extraction across the platform."""
    from app.extraction.ioc_types import get_all_ioc_types, IOCCategory
    
    try:
        types = get_all_ioc_types()
        categories = [{"key": cat.value, "name": cat.value.replace("_", " ").title()} for cat in IOCCategory]
        
        return {
            "types": types,
            "categories": categories,
            "total_types": len(types),
            "description": "Comprehensive list of all IOC types supported for extraction across the Parshu platform"
        }
    except Exception as e:
        logger.error("failed_to_get_ioc_types", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get IOC types"
        )


class IOCResponse(BaseModel):
    id: int
    value: str
    ioc_type: str
    description: Optional[str] = None
    confidence: int
    first_seen_at: datetime
    last_seen_at: datetime
    occurrence_count: int
    is_false_positive: bool
    article_count: int  # How many articles this IOC appears in
    
    class Config:
        from_attributes = True


class IOCArticleResponse(BaseModel):
    id: int
    ioc_id: int
    article_id: int
    article_title: str
    extracted_at: datetime
    confidence: int
    evidence: Optional[str] = None
    
    class Config:
        from_attributes = True


@router.get("/", summary="List all IOCs")
def list_iocs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    ioc_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """List all IOCs with pagination and filtering."""
    try:
        # Base query with article count
        query = db.query(
            IOC,
            func.count(ArticleIOC.id).label('article_count')
        ).outerjoin(ArticleIOC).group_by(IOC.id)
        
        # Apply filters
        if ioc_type:
            query = query.filter(IOC.ioc_type == ioc_type)
        
        if search:
            query = query.filter(IOC.value.ilike(f'%{search}%'))
        
        # Order by last seen (most recent first)
        query = query.order_by(desc(IOC.last_seen_at))
        
        # Pagination
        total = query.count()
        offset = (page - 1) * page_size
        results = query.offset(offset).limit(page_size).all()
        
        iocs = []
        for ioc, article_count in results:
            iocs.append({
                "id": ioc.id,
                "value": ioc.value,
                "ioc_type": ioc.ioc_type,
                "description": ioc.description,
                "confidence": ioc.confidence,
                "first_seen_at": ioc.first_seen_at,
                "last_seen_at": ioc.last_seen_at,
                "occurrence_count": ioc.occurrence_count,
                "is_false_positive": ioc.is_false_positive,
                "article_count": article_count or 0
            })
        
        return {
            "iocs": iocs,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        logger.error("failed_to_list_iocs", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list IOCs"
        )


@router.get("/{ioc_id}", summary="Get IOC details")
def get_ioc(
    ioc_id: int,
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific IOC including all related articles."""
    try:
        ioc = db.query(IOC).filter(IOC.id == ioc_id).first()
        if not ioc:
            raise HTTPException(status_code=404, detail="IOC not found")
        
        # Get all articles this IOC appears in
        article_links = db.query(ArticleIOC).options(
            joinedload(ArticleIOC.article)
        ).filter(ArticleIOC.ioc_id == ioc_id).all()
        
        articles = []
        for link in article_links:
            articles.append({
                "id": link.article_id,
                "title": link.article.title,
                "url": link.article.url,
                "published_at": link.article.published_at,
                "status": link.article.status.value if hasattr(link.article.status, 'value') else link.article.status,
                "extracted_at": link.extracted_at,
                "confidence": link.confidence,
                "evidence": link.evidence,
                "context": link.context
            })
        
        return {
            "id": ioc.id,
            "value": ioc.value,
            "ioc_type": ioc.ioc_type,
            "description": ioc.description,
            "confidence": ioc.confidence,
            "first_seen_at": ioc.first_seen_at,
            "last_seen_at": ioc.last_seen_at,
            "occurrence_count": ioc.occurrence_count,
            "is_false_positive": ioc.is_false_positive,
            "notes": ioc.notes,
            "articles": articles,
            "article_count": len(articles)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_get_ioc", ioc_id=ioc_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get IOC"
        )


@router.get("/search/{value}", summary="Search IOC by value")
def search_ioc_by_value(
    value: str,
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Search for an IOC by its exact value."""
    try:
        iocs = db.query(IOC).filter(IOC.value == value).all()
        
        if not iocs:
            return {"found": False, "iocs": []}
        
        results = []
        for ioc in iocs:
            article_count = db.query(func.count(ArticleIOC.id)).filter(
                ArticleIOC.ioc_id == ioc.id
            ).scalar()
            
            results.append({
                "id": ioc.id,
                "value": ioc.value,
                "ioc_type": ioc.ioc_type,
                "confidence": ioc.confidence,
                "article_count": article_count or 0,
                "first_seen_at": ioc.first_seen_at,
                "last_seen_at": ioc.last_seen_at
            })
        
        return {
            "found": True,
            "iocs": results
        }
    except Exception as e:
        logger.error("failed_to_search_ioc", value=value, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search IOC"
        )


@router.get("/article/{article_id}", summary="Get IOCs for an article")
def get_article_iocs(
    article_id: int,
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Get all IOCs associated with a specific article."""
    try:
        # Verify article exists
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Get all IOCs for this article
        article_iocs = db.query(ArticleIOC).options(
            joinedload(ArticleIOC.ioc)
        ).filter(ArticleIOC.article_id == article_id).all()
        
        iocs = []
        for link in article_iocs:
            # Get article count for each IOC
            article_count = db.query(func.count(ArticleIOC.id)).filter(
                ArticleIOC.ioc_id == link.ioc_id
            ).scalar()
            
            iocs.append({
                "id": link.ioc.id,
                "value": link.ioc.value,
                "ioc_type": link.ioc.ioc_type,
                "confidence": link.confidence,
                "extracted_at": link.extracted_at,
                "extracted_by": link.extracted_by,
                "evidence": link.evidence,
                "context": link.context,
                "article_count": article_count or 0,
                "is_false_positive": link.ioc.is_false_positive
            })
        
        return {
            "article_id": article_id,
            "article_title": article.title,
            "iocs": iocs,
            "total_iocs": len(iocs)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_get_article_iocs", article_id=article_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get article IOCs"
        )


@router.get("/stats/summary", summary="Get IOC statistics")
def get_ioc_stats(
    current_user: User = Depends(require_permission(Permission.READ_INTELLIGENCE.value)),
    db: Session = Depends(get_db)
):
    """Get overall IOC statistics."""
    try:
        total_iocs = db.query(func.count(IOC.id)).scalar() or 0
        
        # IOCs by type
        iocs_by_type = db.query(
            IOC.ioc_type,
            func.count(IOC.id).label('count')
        ).group_by(IOC.ioc_type).all()
        
        # Recent IOCs (last 7 days)
        from datetime import timedelta
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_iocs = db.query(func.count(IOC.id)).filter(
            IOC.created_at >= seven_days_ago
        ).scalar() or 0
        
        # False positives
        false_positives = db.query(func.count(IOC.id)).filter(
            IOC.is_false_positive == True
        ).scalar() or 0
        
        return {
            "total_iocs": total_iocs,
            "by_type": {ioc_type: count for ioc_type, count in iocs_by_type},
            "recent_iocs_7d": recent_iocs,
            "false_positives": false_positives
        }
    except Exception as e:
        logger.error("failed_to_get_ioc_stats", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get IOC stats"
        )
