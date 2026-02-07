"""
Knowledge Base API Routes for RAG-based GenAI operations.

Provides endpoints for:
- Document upload (files and URLs)
- Document management (list, update, delete)
- Manual search/retrieval
- Processing status
"""

import os
import shutil
from typing import List, Optional
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import logger
from app.auth.dependencies import get_current_user, require_permission
from app.auth.rbac import Permission, has_permission
from app.models import (
    User, KnowledgeDocument, KnowledgeDocumentType, 
    KnowledgeDocumentStatus, AuditEventType
)
from app.knowledge.service import KnowledgeService, KNOWLEDGE_STORAGE_PATH
from app.audit.manager import AuditManager


router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])
MANAGE_KNOWLEDGE = Permission.MANAGE_KNOWLEDGE.value


def _safe_filename(filename: str) -> str:
    name = (Path(filename).name or "upload").strip()
    safe_chars = []
    for ch in name:
        if ch.isalnum() or ch in (".", "-", "_", " "):
            safe_chars.append(ch)
        else:
            safe_chars.append("_")
    sanitized = "".join(safe_chars).strip().replace(" ", "_")
    return sanitized or "upload"


# ============================================================================
# SCHEMAS
# ============================================================================

class DocumentUploadRequest(BaseModel):
    """Request for URL-based document upload."""
    title: str = Field(..., min_length=1, max_length=500)
    source_url: HttpUrl
    description: Optional[str] = None
    doc_type: KnowledgeDocumentType = KnowledgeDocumentType.CUSTOM
    target_functions: Optional[List[str]] = None
    target_platforms: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    priority: int = Field(5, ge=1, le=10)
    crawl_depth: int = Field(0, ge=0, le=3, description="Depth to crawl (0=single page, 1=page+links, etc)")
    max_pages: int = Field(20, ge=1, le=100, description="Maximum pages to crawl")


class CrawlRequest(BaseModel):
    """Request to crawl a website."""
    url: HttpUrl
    title: str = Field(..., min_length=1, max_length=500)
    depth: int = Field(1, ge=0, le=3, description="Crawl depth (0=single page)")
    max_pages: int = Field(20, ge=1, le=100)
    same_domain_only: bool = True
    doc_type: KnowledgeDocumentType = KnowledgeDocumentType.PRODUCT_DOCUMENTATION
    target_functions: Optional[List[str]] = None
    target_platforms: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    priority: int = Field(5, ge=1, le=10)
    # Authentication options
    auth_type: Optional[str] = Field(None, description="Authentication type: 'basic', 'bearer', 'session', or None")
    auth_username: Optional[str] = Field(None, description="Username for basic auth")
    auth_password: Optional[str] = Field(None, description="Password for basic auth")
    auth_token: Optional[str] = Field(None, description="Bearer token for token auth")
    session_cookies: Optional[dict] = Field(None, description="Session cookies for authenticated crawling")


class UserDocumentUploadRequest(BaseModel):
    """Request for user-level document upload (chatbot)."""
    title: str = Field(..., min_length=1, max_length=500)
    source_url: HttpUrl
    description: Optional[str] = None
    crawl_depth: int = Field(0, ge=0, le=2, description="Depth to crawl (0=single page)")
    max_pages: int = Field(10, ge=1, le=50, description="Maximum pages to crawl")


class DocumentUpdateRequest(BaseModel):
    """Request to update document metadata."""
    title: Optional[str] = None
    description: Optional[str] = None
    target_functions: Optional[List[str]] = None
    target_platforms: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    is_active: Optional[bool] = None
    status: Optional[str] = Field(None, description="Override status (PENDING, READY, FAILED) - admin only")


class SearchRequest(BaseModel):
    """Request for knowledge base search."""
    query: str = Field(..., min_length=3)
    target_function: Optional[str] = None
    target_platform: Optional[str] = None
    doc_type: Optional[KnowledgeDocumentType] = None
    top_k: int = Field(5, ge=1, le=20)


class DocumentResponse(BaseModel):
    """Response for document details."""
    id: int
    title: str
    description: Optional[str]
    doc_type: str
    source_type: str
    source_url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    status: str
    processing_error: Optional[str]
    chunk_count: int
    crawl_depth: int = 0
    pages_crawled: int = 0
    target_functions: Optional[List[str]]
    target_platforms: Optional[List[str]]
    tags: Optional[List[str]]
    priority: int
    is_active: bool
    is_admin_managed: bool = True
    scope: str = "global"
    usage_count: int
    last_used_at: Optional[datetime]
    created_at: datetime
    uploaded_by_id: int
    uploaded_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class SearchResultResponse(BaseModel):
    """Response for search results."""
    chunk_id: int
    document_id: int
    document_title: str
    doc_type: Optional[str]
    content: str
    similarity: float
    priority: int
    tags: Optional[List[str]]


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/upload/file", response_model=DocumentResponse, summary="Upload a document file")
async def upload_document_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    doc_type: str = Form("custom"),
    target_functions: Optional[str] = Form(None),  # JSON array string
    target_platforms: Optional[str] = Form(None),  # JSON array string
    tags: Optional[str] = Form(None),  # JSON array string
    priority: int = Form(5),
    auto_process: bool = Form(True),
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Upload a document file to the knowledge base.
    
    Supported formats: PDF, Word (.docx), Excel (.xlsx), CSV, Text, Markdown
    """
    import json
    
    # Validate file type
    allowed_extensions = {'.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.md', '.json'}
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file_ext}. Allowed: {allowed_extensions}"
        )
    
    # Validate file size (max 50MB)
    max_size = 50 * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: 50MB"
        )
    
    # Save file
    safe_name = _safe_filename(file.filename)
    file_id = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{safe_name}"
    file_path = KNOWLEDGE_STORAGE_PATH / file_id

    # Defense-in-depth: ensure the resolved path stays under the intended storage directory.
    try:
        base = KNOWLEDGE_STORAGE_PATH.resolve()
        resolved = file_path.resolve()
        if not resolved.is_relative_to(base):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    # Parse JSON arrays
    target_funcs = json.loads(target_functions) if target_functions else None
    target_plats = json.loads(target_platforms) if target_platforms else None
    tags_list = json.loads(tags) if tags else None
    
    # Convert doc_type string to enum
    try:
        doc_type_enum = KnowledgeDocumentType(doc_type)
    except ValueError:
        doc_type_enum = KnowledgeDocumentType.CUSTOM
    
    # Create document (admin-managed, global scope)
    service = KnowledgeService(db)
    try:
        doc = await service.add_document(
            title=title,
            source_type="file",
            user_id=current_user.id,
            file_path=str(file_path),
            file_name=file.filename,
            doc_type=doc_type_enum,
            description=description,
            target_functions=target_funcs,
            target_platforms=target_plats,
            tags=tags_list,
            priority=priority,
            scope="global",
            is_admin_managed=True
        )
    except ValueError as e:
        # Clean up file if duplicate detected
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    
    # Process in background if requested
    if auto_process:
        background_tasks.add_task(process_document_task, doc.id)
    
    # Audit log
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Uploaded knowledge document: {title}",
        resource_type="knowledge_document",
        resource_id=doc.id
    )
    
    return _doc_to_response(doc)


@router.post("/upload/url", response_model=DocumentResponse, summary="Add a URL as knowledge source")
async def upload_document_url(
    background_tasks: BackgroundTasks,
    request: DocumentUploadRequest,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Add a URL as a knowledge source (admin-managed, global scope).
    
    The URL content will be fetched and processed for RAG.
    Optionally crawl linked pages with depth > 0.
    """
    service = KnowledgeService(db)
    
    try:
        doc = await service.add_document(
            title=request.title,
            source_type="url",
            user_id=current_user.id,
            source_url=str(request.source_url),
            doc_type=request.doc_type,
            description=request.description,
            target_functions=request.target_functions,
            target_platforms=request.target_platforms,
            tags=request.tags,
            priority=request.priority,
            scope="global",
            is_admin_managed=True,
            crawl_depth=request.crawl_depth
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    
    # Handle crawl based on depth
    if request.crawl_depth > 0:
        background_tasks.add_task(
            crawl_and_process_task, 
            doc.id, 
            str(request.source_url),
            request.crawl_depth,
            request.max_pages
        )
    else:
        # Just process the single URL
        background_tasks.add_task(process_document_task, doc.id)
    
    # Audit log
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Added knowledge URL: {request.title} (depth={request.crawl_depth})",
        resource_type="knowledge_document",
        resource_id=doc.id
    )
    
    return _doc_to_response(doc)


async def process_document_task(doc_id: int):
    """Background task to process a document.

    NOTE: Background tasks must not reuse the request-scoped DB session.
    """
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        service = KnowledgeService(db)
        await service.process_document(doc_id)
    except Exception as e:
        logger.error("background_document_processing_failed", doc_id=doc_id, error=str(e))
    finally:
        try:
            db.close()
        except Exception:
            pass


async def crawl_and_process_task(
    doc_id: int, 
    start_url: str, 
    depth: int, 
    max_pages: int,
):
    """Background task to crawl a website and process all pages."""
    from app.knowledge.crawler import crawl_url
    from app.core.database import SessionLocal

    db = SessionLocal()
     
    try:
        # Update status to CRAWLING
        doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
        if doc:
            doc.status = KnowledgeDocumentStatus.CRAWLING
            db.commit()
        
        # Crawl the website
        logger.info("starting_crawl", url=start_url, depth=depth, max_pages=max_pages)
        result = await crawl_url(start_url, depth=depth, max_pages=max_pages)
        
        # Update status to PROCESSING after crawl completes
        doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
        if doc:
            doc.status = KnowledgeDocumentStatus.PROCESSING
            doc.pages_crawled = result.get('pages_crawled', 0)
            db.commit()
        
        # Combine all crawled content
        combined_content = []
        for page in result.get('pages', []):
            combined_content.append(f"""
=== Page: {page['title']} ===
URL: {page['url']}
Depth: {page['depth']}

{page['content']}
""")
        
        # Update the document with combined content
        if doc:
            doc.raw_content = "\n\n".join(combined_content)
            doc.description = (doc.description or "") + f"\nCrawled {result['pages_crawled']} pages (depth={depth})"
            db.commit()
        
        # Now process the document (chunking and embedding)
        service = KnowledgeService(db)
        await service.process_document(doc_id)
        
        logger.info("crawl_complete", 
                   doc_id=doc_id, 
                   pages_crawled=result['pages_crawled'],
                   errors=result['errors_count'])
        
    except Exception as e:
        logger.error("crawl_and_process_failed", doc_id=doc_id, error=str(e))
        doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
        if doc:
            doc.status = KnowledgeDocumentStatus.FAILED
            doc.processing_error = str(e)
            db.commit()
    finally:
        try:
            db.close()
        except Exception:
            pass


@router.post("/{doc_id}/process", response_model=DocumentResponse, summary="Trigger document processing")
async def process_document(
    doc_id: int,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """Manually trigger processing for a document."""
    service = KnowledgeService(db)
    
    try:
        doc = await service.process_document(doc_id)
        return _doc_to_response(doc)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("process_document_failed", doc_id=doc_id, error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process document")


@router.get("/", response_model=List[DocumentResponse], summary="List knowledge documents")
async def list_documents(
    doc_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 100,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """List all documents in the knowledge base."""
    service = KnowledgeService(db)
    
    # Convert string to enum
    doc_type_enum = None
    if doc_type:
        try:
            doc_type_enum = KnowledgeDocumentType(doc_type)
        except ValueError:
            pass
    
    status_enum = None
    if status_filter:
        try:
            status_enum = KnowledgeDocumentStatus(status_filter)
        except ValueError:
            pass
    
    docs = service.list_documents(
        doc_type=doc_type_enum,
        status=status_enum,
        is_active=is_active,
        limit=limit
    )
    
    return [_doc_to_response(d) for d in docs]


@router.get("/stats", summary="Get knowledge base statistics")
async def get_knowledge_stats(
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """Get statistics about the knowledge base."""
    from sqlalchemy import func
    from app.models import KnowledgeChunk
    
    total_docs = db.query(func.count(KnowledgeDocument.id)).scalar()
    ready_docs = db.query(func.count(KnowledgeDocument.id)).filter(
        KnowledgeDocument.status == KnowledgeDocumentStatus.READY
    ).scalar()
    total_chunks = db.query(func.count(KnowledgeChunk.id)).scalar()
    total_usage = db.query(func.sum(KnowledgeDocument.usage_count)).scalar() or 0
    
    # By type
    by_type = db.query(
        KnowledgeDocument.doc_type,
        func.count(KnowledgeDocument.id)
    ).group_by(KnowledgeDocument.doc_type).all()
    
    # By status
    by_status = db.query(
        KnowledgeDocument.status,
        func.count(KnowledgeDocument.id)
    ).group_by(KnowledgeDocument.status).all()
    
    return {
        "total_documents": total_docs,
        "ready_documents": ready_docs,
        "total_chunks": total_chunks,
        "total_usage": total_usage,
        "by_type": {str(t.value if hasattr(t, 'value') else t): c for t, c in by_type},
        "by_status": {str(s.value if hasattr(s, 'value') else s): c for s, c in by_status}
    }


@router.get("/{doc_id}", response_model=DocumentResponse, summary="Get document details")
async def get_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific document."""
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Authorization:
    # - Admin-managed (global) docs require manage_knowledge
    # - User docs require ownership
    from app.auth.dependencies import get_effective_role
    if doc.is_admin_managed:
        if not has_permission(get_effective_role(current_user), MANAGE_KNOWLEDGE):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    else:
        if doc.uploaded_by_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    return _doc_to_response(doc)


@router.get("/{doc_id}/content", summary="Get document content and chunks")
async def get_document_content(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the raw content and chunks of a document."""
    from app.models import KnowledgeChunk
    
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    from app.auth.dependencies import get_effective_role
    if doc.is_admin_managed:
        if not has_permission(get_effective_role(current_user), MANAGE_KNOWLEDGE):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    else:
        if doc.uploaded_by_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    chunks = db.query(KnowledgeChunk).filter(
        KnowledgeChunk.document_id == doc_id
    ).order_by(KnowledgeChunk.chunk_index).all()
    
    # Extract crawled URLs from raw content if it's a crawled document
    crawled_urls = []
    if doc.crawl_depth > 0 and doc.raw_content:
        import re
        # Pattern to extract URLs from the "=== Page: ... ===" format
        url_pattern = r'URL: (https?://[^\s\n]+)'
        crawled_urls = re.findall(url_pattern, doc.raw_content)
    
    return {
        "id": doc.id,
        "title": doc.title,
        "raw_content": doc.raw_content[:10000] if doc.raw_content else None,
        "raw_content_length": len(doc.raw_content) if doc.raw_content else 0,
        "crawled_urls": crawled_urls,
        "pages_crawled": doc.pages_crawled or 0,
        "crawl_depth": doc.crawl_depth or 0,
        "chunks": [
            {
                "id": c.id,
                "index": c.chunk_index,
                "content": c.content,
                "token_count": c.token_count,
                "has_embedding": bool(c.embedding),
                "metadata": c.chunk_metadata
            }
            for c in chunks
        ]
    }


@router.get("/chunks/all", summary="Get all chunks across all documents (admin only)")
async def get_all_chunks(
    page: int = 1,
    page_size: int = 50,
    document_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """Get all chunks for admin viewing. Supports filtering and pagination."""
    from app.models import KnowledgeChunk
    
    query = db.query(KnowledgeChunk).join(KnowledgeDocument)
    
    if document_id:
        query = query.filter(KnowledgeChunk.document_id == document_id)
    
    if search:
        query = query.filter(KnowledgeChunk.content.ilike(f"%{search}%"))
    
    total = query.count()
    chunks = query.order_by(
        KnowledgeDocument.id, KnowledgeChunk.chunk_index
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "chunks": [
            {
                "id": c.id,
                "document_id": c.document_id,
                "document_title": c.document.title,
                "chunk_index": c.chunk_index,
                "content": c.content[:500] + "..." if len(c.content) > 500 else c.content,
                "full_content": c.content,
                "token_count": c.token_count,
                "has_embedding": bool(c.embedding),
                "embedding_model": c.embedding_model,
                "metadata": c.chunk_metadata
            }
            for c in chunks
        ]
    }


@router.delete("/chunks/{chunk_id}", summary="Delete a specific chunk (admin only)")
async def delete_chunk(
    chunk_id: int,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """Delete a specific chunk. Updates the document's chunk count."""
    from app.models import KnowledgeChunk
    
    chunk = db.query(KnowledgeChunk).filter(KnowledgeChunk.id == chunk_id).first()
    if not chunk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chunk not found")
    
    doc_id = chunk.document_id
    db.delete(chunk)
    
    # Update chunk count on document
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if doc:
        remaining = db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == doc_id).count()
        doc.chunk_count = remaining
    
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.KNOWLEDGE_BASE,
        action=f"Deleted chunk {chunk_id} from document {doc_id}",
        resource_type="knowledge_chunk",
        resource_id=chunk_id
    )
    
    return {"message": f"Chunk {chunk_id} deleted successfully"}


@router.patch("/{doc_id}", response_model=DocumentResponse, summary="Update document metadata")
async def update_document(
    doc_id: int,
    request: DocumentUpdateRequest,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """Update document metadata.
    
    Admins can also override the status to fix stuck documents (e.g., reset PROCESSING to FAILED).
    """
    service = KnowledgeService(db)
    
    doc = service.update_document(
        doc_id=doc_id,
        title=request.title,
        description=request.description,
        target_functions=request.target_functions,
        target_platforms=request.target_platforms,
        tags=request.tags,
        priority=request.priority,
        is_active=request.is_active
    )
    
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    # Handle status override (admin only - for fixing stuck documents)
    if request.status:
        try:
            new_status = KnowledgeDocumentStatus(request.status)
            doc.status = new_status
            db.commit()
            db.refresh(doc)
            logger.info("knowledge_document_status_override", 
                       doc_id=doc_id, 
                       new_status=request.status, 
                       user_id=current_user.id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Invalid status: {request.status}. Valid values: PENDING, PROCESSING, CRAWLING, READY, FAILED"
            )
    
    return _doc_to_response(doc)


@router.delete("/{doc_id}", summary="Delete a document")
def delete_document(
    doc_id: int,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """Delete a document from the knowledge base.
    
    With passive_deletes=True on the relationship and ON DELETE CASCADE on the FK,
    the database will automatically delete chunks when the document is deleted.
    """
    from sqlalchemy import text
    import os
    
    # Get document metadata using raw SQL
    doc_info = db.execute(
        text("SELECT title, file_path FROM knowledge_documents WHERE id = :id"),
        {"id": doc_id}
    ).first()
    
    if not doc_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    doc_title = doc_info[0]
    file_path = doc_info[1]
    
    try:
        # Simply delete the document - database CASCADE will handle chunks
        db.execute(
            text("DELETE FROM knowledge_documents WHERE id = :doc_id"),
            {"doc_id": doc_id}
        )
        
        db.commit()
        
        # Delete file if exists
        if file_path:
            import os
            file_full_path = f"/app/uploads/{file_path}" if not file_path.startswith("/") else file_path
            if os.path.exists(file_full_path):
                try:
                    os.remove(file_full_path)
                except Exception as e:
                    logger.warning("failed_to_delete_file", path=file_full_path, error=str(e))
        
        # Audit log
        try:
            AuditManager.log_event(
                db=db,
                user_id=current_user.id,
                event_type=AuditEventType.SYSTEM_CONFIG,
                action=f"Deleted knowledge document: {doc_title}",
                resource_type="knowledge_document",
                resource_id=doc_id
            )
            db.commit()
        except Exception as audit_err:
            logger.warning("audit_log_failed", error=str(audit_err))
        
        logger.info("knowledge_document_deleted", doc_id=doc_id, title=doc_title)
        
        return {"message": f"Document '{doc_title}' deleted successfully"}
        
    except Exception as e:
        db.rollback()
        logger.error("failed_to_delete_document", doc_id=doc_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to delete document"
        )


@router.post("/crawl", summary="Crawl a website and add to admin knowledge base")
async def crawl_website(
    background_tasks: BackgroundTasks,
    request: CrawlRequest,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Crawl a website with configurable depth and add all pages to admin knowledge base.
    
    - depth=0: Only the provided URL
    - depth=1: URL + all linked pages
    - depth=2: URL + linked pages + their linked pages
    - max_pages limits total pages crawled
    """
    service = KnowledgeService(db)
    
    try:
        # Create document entry (admin-managed, global scope)
        doc = await service.add_document(
            title=request.title,
            source_type="url",
            user_id=current_user.id,
            source_url=str(request.url),
            doc_type=request.doc_type,
            description=f"Crawled website (depth={request.depth}, max_pages={request.max_pages})",
            target_functions=request.target_functions,
            target_platforms=request.target_platforms,
            tags=request.tags,
            priority=request.priority,
            scope="global",
            is_admin_managed=True,
            crawl_depth=request.depth
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    
    # Start crawl in background
    background_tasks.add_task(
        crawl_and_process_task,
        doc.id,
        str(request.url),
        request.depth,
        request.max_pages
    )
    
    # Audit log
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Started crawl: {request.title} (depth={request.depth})",
        resource_type="knowledge_document",
        resource_id=doc.id
    )
    
    return {
        "message": f"Crawl started for {request.url}",
        "document_id": doc.id,
        "depth": request.depth,
        "max_pages": request.max_pages,
        "status": "PROCESSING"
    }


@router.post("/user/url", summary="Add URL to user's personal knowledge base")
async def add_user_url(
    background_tasks: BackgroundTasks,
    request: UserDocumentUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a URL to the user's personal knowledge base (for chatbot).
    
    This is separate from the admin-managed global knowledge base.
    Duplicate detection: If document already exists in admin KB, returns error.
    """
    service = KnowledgeService(db)
    
    try:
        doc = await service.add_document(
            title=request.title,
            source_type="url",
            user_id=current_user.id,
            source_url=str(request.source_url),
            doc_type=KnowledgeDocumentType.CUSTOM,
            description=request.description,
            tags=["user-uploaded", f"user:{current_user.id}"],
            priority=3,  # Lower priority than admin docs
            scope="user",
            is_admin_managed=False,
            crawl_depth=request.crawl_depth
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    
    # Handle crawl based on depth
    if request.crawl_depth > 0:
        background_tasks.add_task(
            crawl_and_process_task, 
            doc.id, 
            str(request.source_url),
            request.crawl_depth,
            request.max_pages
        )
    else:
        background_tasks.add_task(process_document_task, doc.id)
    
    return {
        "message": f"URL added to your personal knowledge base",
        "document_id": doc.id,
        "title": request.title,
        "crawl_depth": request.crawl_depth,
        "status": "PROCESSING"
    }


@router.get("/user/documents", summary="Get user's personal documents")
async def get_user_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get documents in user's personal knowledge base."""
    docs = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.uploaded_by_id == current_user.id,
        KnowledgeDocument.is_admin_managed == False
    ).order_by(KnowledgeDocument.created_at.desc()).all()
    
    return [_doc_to_response(d) for d in docs]


@router.delete("/user/documents/{doc_id}", summary="Delete user's personal document")
async def delete_user_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document from user's personal knowledge base."""
    doc = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.id == doc_id,
        KnowledgeDocument.uploaded_by_id == current_user.id,
        KnowledgeDocument.is_admin_managed == False
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or not owned by you")
    
    service = KnowledgeService(db)
    service.delete_document(doc_id)
    
    return {"message": "Document deleted"}


@router.post("/search", response_model=List[SearchResultResponse], summary="Search knowledge base")
async def search_knowledge(
    request: SearchRequest,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """Search the knowledge base for relevant content."""
    service = KnowledgeService(db)
    
    results = await service.search(
        query=request.query,
        target_function=request.target_function,
        target_platform=request.target_platform,
        doc_type=request.doc_type,
        top_k=request.top_k
    )
    
    return [SearchResultResponse(**r) for r in results]


@router.post("/user/search", response_model=List[SearchResultResponse], summary="Search user's personal knowledge base")
async def search_user_knowledge(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search only the authenticated user's personal documents."""
    service = KnowledgeService(db)

    results = await service.search(
        query=request.query,
        target_function=request.target_function,
        target_platform=request.target_platform,
        doc_type=request.doc_type,
        top_k=request.top_k,
        uploaded_by_id=current_user.id,
        include_admin_managed=False,
        include_user_managed=True,
    )

    return [SearchResultResponse(**r) for r in results]


# ============================================================================
# RAG WORKFLOW & TESTING ENDPOINTS
# ============================================================================

class RAGTestRequest(BaseModel):
    """Request to test RAG with a question."""
    question: str = Field(..., min_length=5, description="The question to ask the RAG system")
    target_platform: Optional[str] = None
    target_function: Optional[str] = None
    include_sources: bool = True
    max_context_tokens: int = Field(2000, ge=500, le=8000)


class RAGScheduleRequest(BaseModel):
    """Request to configure RAG schedule."""
    enabled: bool = True
    refresh_interval_hours: int = Field(24, ge=1, le=168)
    auto_process_pending: bool = True
    pending_check_minutes: int = Field(5, ge=1, le=60)


@router.post("/test", summary="Test RAG retrieval and generation")
async def test_rag(
    request: RAGTestRequest,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Test the RAG pipeline with a question.
    
    This endpoint:
    1. Searches the knowledge base for relevant context
    2. Generates a response using the configured GenAI model
    3. Returns the answer with source documents
    
    Use this to verify RAG is working correctly with your knowledge base.
    """
    from app.genai.provider import get_model_manager, GenAIProviderFactory
    
    service = KnowledgeService(db)
    
    # Step 1: Search for relevant context
    search_results = await service.search(
        query=request.question,
        target_function=request.target_function,
        target_platform=request.target_platform,
        top_k=5
    )
    
    if not search_results:
        return {
            "answer": "No relevant information found in the knowledge base for this question.",
            "sources": [],
            "context_used": "",
            "model_used": None,
            "success": False
        }
    
    # Step 2: Build context from search results
    context_parts = []
    sources = []
    token_count = 0
    
    for result in search_results:
        chunk_tokens = len(result["content"].split())
        if token_count + chunk_tokens > request.max_context_tokens:
            break
        
        context_parts.append(f"""
=== From: {result['document_title']} (Relevance: {result['similarity']:.2f}) ===
{result['content']}
""")
        sources.append({
            "document_id": result["document_id"],
            "title": result["document_title"],
            "similarity": round(result["similarity"], 3),
            "doc_type": result.get("doc_type")
        })
        token_count += chunk_tokens
    
    context = "\n".join(context_parts)
    
    # Step 3: Generate response using GenAI
    try:
        model_manager = get_model_manager()
        
        system_prompt = """You are a helpful assistant that answers questions based on the provided context.
        
Rules:
1. Only use information from the provided context to answer
2. If the context doesn't contain enough information, say so
3. Cite the source documents when providing information
4. Be concise but thorough
5. If asked about technical details, provide specific information from the context"""

        user_prompt = f"""Context from Knowledge Base:
{context}

Question: {request.question}

Please answer the question based on the context provided above."""

        result = await model_manager.generate_with_fallback(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2
        )
        
        return {
            "answer": result["response"],
            "sources": sources if request.include_sources else [],
            "context_used": context if request.include_sources else "[hidden]",
            "model_used": result["model_used"],
            "fallback_used": result.get("fallback", False),
            "success": True
        }
        
    except Exception as e:
        logger.error("rag_test_generation_failed", error=str(e))
        return {
            "answer": "RAG retrieval succeeded but generation failed",
            "sources": sources,
            "context_used": context,
            "model_used": None,
            "success": False,
            "error": "generation_failed"
        }


@router.get("/workflow/status", summary="Get RAG workflow status")
async def get_rag_workflow_status(
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Get the current status of the RAG workflow including:
    - Document processing status
    - Scheduled jobs
    - System health
    """
    from sqlalchemy import func
    from app.models import KnowledgeChunk
    from app.automation.scheduler import hunt_scheduler
    
    # Document stats by status
    status_counts = db.query(
        KnowledgeDocument.status,
        func.count(KnowledgeDocument.id)
    ).group_by(KnowledgeDocument.status).all()
    
    # Total chunks and embedding stats
    total_chunks = db.query(func.count(KnowledgeChunk.id)).scalar() or 0
    chunks_with_embeddings = db.query(func.count(KnowledgeChunk.id)).filter(
        KnowledgeChunk.embedding.isnot(None)
    ).scalar() or 0
    
    # Get scheduled jobs
    jobs = hunt_scheduler.get_jobs()
    rag_jobs = [j for j in jobs if 'rag' in j['id'].lower()]
    
    # Recent activity
    recent_docs = db.query(KnowledgeDocument).order_by(
        KnowledgeDocument.created_at.desc()
    ).limit(5).all()
    
    return {
        "status": "healthy",
        "documents": {
            "by_status": {str(s.value if hasattr(s, 'value') else s): c for s, c in status_counts},
            "total": sum(c for _, c in status_counts)
        },
        "chunks": {
            "total": total_chunks,
            "with_embeddings": chunks_with_embeddings,
            "embedding_coverage": f"{(chunks_with_embeddings/total_chunks*100):.1f}%" if total_chunks > 0 else "N/A"
        },
        "scheduled_jobs": rag_jobs,
        "recent_documents": [
            {
                "id": d.id,
                "title": d.title,
                "status": d.status.value if d.status else "UNKNOWN",
                "created_at": d.created_at.isoformat() if d.created_at else None
            }
            for d in recent_docs
        ]
    }


@router.post("/workflow/trigger", summary="Manually trigger RAG processing")
async def trigger_rag_workflow(
    action: str,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Manually trigger RAG workflow actions.
    
    Actions:
    - `process_pending`: Process all pending documents
    - `refresh_embeddings`: Refresh embeddings for frequently used documents
    - `reprocess_failed`: Retry processing for failed documents
    """
    from app.automation.scheduler import hunt_scheduler
    
    valid_actions = ["process_pending", "refresh_embeddings", "reprocess_failed"]
    
    if action not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Valid actions: {valid_actions}"
        )
    
    if action == "process_pending":
        # Get pending documents and process
        pending = db.query(KnowledgeDocument).filter(
            KnowledgeDocument.status == KnowledgeDocumentStatus.PENDING
        ).all()
        
        service = KnowledgeService(db)
        processed = 0
        failed = 0
        
        for doc in pending:
            try:
                await service.process_document(doc.id)
                processed += 1
            except Exception as e:
                failed += 1
                logger.error("manual_rag_process_failed", doc_id=doc.id, error=str(e))
        
        return {
            "action": action,
            "processed": processed,
            "failed": failed,
            "message": f"Processed {processed} documents, {failed} failed"
        }
    
    elif action == "refresh_embeddings":
        hunt_scheduler.run_job_now("rag_refresh")
        return {
            "action": action,
            "message": "RAG refresh job triggered"
        }
    
    elif action == "reprocess_failed":
        # Reset failed documents to pending
        failed_docs = db.query(KnowledgeDocument).filter(
            KnowledgeDocument.status == KnowledgeDocumentStatus.FAILED
        ).all()
        
        for doc in failed_docs:
            doc.status = KnowledgeDocumentStatus.PENDING
            doc.processing_error = None
        
        db.commit()
        
        return {
            "action": action,
            "documents_reset": len(failed_docs),
            "message": f"Reset {len(failed_docs)} failed documents to PENDING"
        }


@router.get("/guide", summary="Get RAG setup and usage guide")
async def get_rag_guide(
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive guide for setting up and using the RAG system.
    """
    return {
        "title": "Parshu RAG (Retrieval-Augmented Generation) Guide",
        "version": "1.0",
        "sections": [
            {
                "title": "1. What is RAG?",
                "content": """RAG (Retrieval-Augmented Generation) enhances AI responses by grounding them in your organization's knowledge base. Instead of relying solely on the AI model's training data, RAG:

1. **Retrieves** relevant documents from your knowledge base based on the query
2. **Augments** the AI prompt with this contextual information
3. **Generates** responses that are grounded in your specific data

This reduces hallucinations and ensures answers are relevant to your security context."""
            },
            {
                "title": "2. Setting Up Your Knowledge Base",
                "content": """To build an effective RAG knowledge base:

**Step 1: Add Documents**
- Upload PDFs, Word docs, Excel files, or text files
- Add URLs for web pages or documentation
- Use the crawl feature to ingest entire documentation sites

**Step 2: Configure Document Metadata**
- Set document type (Product Documentation, Runbook, Policy, Custom)
- Assign target platforms (XSIAM, Defender, Splunk, Wiz)
- Add relevant tags for organization
- Set priority (1-10, higher = more important in search results)

**Step 3: Process Documents**
- Documents are automatically chunked into smaller pieces
- Each chunk gets an embedding (vector representation)
- Embeddings enable semantic similarity search"""
            },
            {
                "title": "3. Document Types & Best Practices",
                "content": """**Product Documentation**: Platform-specific docs (XQL syntax, KQL reference)
- Set target_platforms to help with query generation
- High priority (7-10) recommended

**Runbooks**: Incident response procedures
- Tag with relevant IOC types or attack categories
- Medium-high priority (6-8)

**Security Policies**: Organizational guidelines
- Lower priority (3-5) unless directly relevant

**Custom**: Anything else
- Threat reports, research papers, internal notes
- Adjust priority based on relevance"""
            },
            {
                "title": "4. Automatic Processing",
                "content": """The RAG system includes automated workflows:

**Pending Document Processing** (every 5 minutes)
- Automatically processes newly uploaded documents
- Handles up to 3 documents per cycle

**Embedding Refresh** (daily at 2 AM)
- Refreshes embeddings for frequently-used documents
- Keeps vectors up-to-date with latest embedding models

**Manual Triggers**
- Use /workflow/trigger to manually run these processes
- Useful after bulk uploads or to retry failed documents"""
            },
            {
                "title": "5. Testing Your RAG Setup",
                "content": """Use the /test endpoint to verify RAG is working:

1. Ask a question relevant to your uploaded documents
2. Check the returned sources to verify retrieval is working
3. Verify the answer uses information from your knowledge base
4. Adjust document priorities if wrong documents are being retrieved

**Test Questions to Try**:
- "How do I write an XQL query to find suspicious PowerShell?"
- "What is our incident response procedure for ransomware?"
- "Explain the authentication flow in our security platform\""""
            },
            {
                "title": "6. Optimizing RAG Performance",
                "content": """**Improve Retrieval Quality**:
- Use descriptive document titles
- Add comprehensive descriptions
- Tag documents with relevant keywords
- Set appropriate priorities

**Improve Generation Quality**:
- Ensure documents have clear, well-structured content
- Remove boilerplate/noise from documents
- Keep chunks focused on specific topics

**Monitor Usage**:
- Check document usage_count to see what's being retrieved
- Review search results to verify relevance
- Adjust priorities based on actual usage patterns"""
            },
            {
                "title": "7. Troubleshooting",
                "content": """**Documents stuck in PENDING**:
- Check if background workers are running
- Use /workflow/trigger?action=process_pending
- Review logs for processing errors

**Documents in FAILED status**:
- Check processing_error field for details
- Common issues: unsupported format, empty content, network errors
- Use /workflow/trigger?action=reprocess_failed to retry

**Poor search results**:
- Verify embeddings exist (chunks.has_embedding)
- Check if Ollama/embedding service is running
- Try more specific queries

**Generation not using RAG**:
- Ensure GENAI_PROVIDER is configured
- Verify knowledge base has relevant documents
- Check that retrieval is returning results"""
            }
        ],
        "quick_start": [
            "1. Navigate to Admin > Knowledge Base (RAG)",
            "2. Click 'Upload Document' or 'Add URL'",
            "3. Fill in title, description, and metadata",
            "4. Wait for processing (status changes to READY)",
            "5. Test with /knowledge/test endpoint",
            "6. Use the chatbot - it now uses your knowledge base!"
        ],
        "api_endpoints": {
            "upload_file": "POST /api/knowledge/upload/file",
            "upload_url": "POST /api/knowledge/upload/url",
            "crawl_site": "POST /api/knowledge/crawl",
            "list_docs": "GET /api/knowledge/",
            "search": "POST /api/knowledge/search",
            "test_rag": "POST /api/knowledge/test",
            "workflow_status": "GET /api/knowledge/workflow/status",
            "trigger_workflow": "POST /api/knowledge/workflow/trigger"
        }
    }


# ============================================================================
# GITHUB REPOSITORY CRAWLER
# ============================================================================

class GitHubCrawlRequest(BaseModel):
    """Request to crawl a GitHub repository."""
    github_url: HttpUrl = Field(..., description="GitHub repository URL")
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    include_code: bool = Field(True, description="Include source code files")
    include_docs: bool = Field(True, description="Include documentation files (README, etc)")
    max_files: int = Field(100, ge=1, le=300, description="Maximum files to crawl")
    doc_type: KnowledgeDocumentType = KnowledgeDocumentType.CUSTOM
    target_functions: Optional[List[str]] = None
    target_platforms: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    priority: int = Field(5, ge=1, le=10)


@router.post("/crawl/github", summary="Crawl a GitHub repository")
async def crawl_github_repo(
    request: GitHubCrawlRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Crawl a GitHub repository and add its code/documentation to the knowledge base.
    
    This is useful for:
    - Adding internal tool documentation
    - Ingesting security tool source code for reference
    - Creating a knowledge base of your own application's code
    - Adding open-source security tool documentation
    """
    from app.knowledge.crawler import GitHubRepoCrawler, crawl_github_repo as async_crawl
    
    # Create document entry
    doc = KnowledgeDocument(
        title=request.title,
        description=request.description or f"GitHub repository: {request.github_url}",
        doc_type=request.doc_type,
        source_type="github",
        source_url=str(request.github_url),
        status=KnowledgeDocumentStatus.PENDING,
        target_functions=request.target_functions,
        target_platforms=request.target_platforms,
        tags=request.tags or ["github", "code", "repository"],
        priority=request.priority,
        is_admin_managed=True,
        scope="global",
        uploaded_by_id=current_user.id
    )
    
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # Start crawl in background
    async def process_github_crawl(doc_id: int):
        db = next(get_db())
        try:
            doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
            if not doc:
                return
            
            doc.status = KnowledgeDocumentStatus.PROCESSING
            db.commit()
            
            # Crawl the repository
            result = await async_crawl(
                github_url=str(request.github_url),
                include_code=request.include_code,
                include_docs=request.include_docs,
                max_files=request.max_files
            )
            
            if result.get("files_processed", 0) == 0:
                doc.status = KnowledgeDocumentStatus.FAILED
                doc.processing_error = "No files crawled from repository"
                db.commit()
                return
            
            # Combine all content
            crawler = GitHubRepoCrawler(
                include_code=request.include_code,
                include_docs=request.include_docs,
                max_files=request.max_files
            )
            crawler.files_processed = result.get("files", [])
            combined_content = crawler.get_combined_content()
            
            # Update document with crawled content
            doc.raw_content = combined_content
            doc.file_size = len(combined_content)
            doc.pages_crawled = result.get("files_processed", 0)
            
            # Process with embeddings
            service = KnowledgeService(db)
            await service.process_document(doc.id)
            
            logger.info("github_crawl_complete", 
                       doc_id=doc.id, 
                       files=result.get("files_processed", 0),
                       errors=result.get("errors_count", 0))
            
        except Exception as e:
            logger.error("github_crawl_failed", doc_id=doc_id, error=str(e))
            doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
            if doc:
                doc.status = KnowledgeDocumentStatus.FAILED
                doc.processing_error = str(e)
                db.commit()
        finally:
            db.close()
    
    # Add to background tasks
    import asyncio
    background_tasks.add_task(lambda: asyncio.run(process_github_crawl(doc.id)))
    
    # Log audit
    AuditManager.log_event(
        db, AuditEventType.KB_DOCUMENT_CREATED, current_user.id,
        f"Started GitHub crawl: {request.title}",
        {"github_url": str(request.github_url), "document_id": doc.id}
    )
    
    return {
        "message": "GitHub crawl started",
        "document_id": doc.id,
        "github_url": str(request.github_url),
        "status": "PENDING",
        "settings": {
            "include_code": request.include_code,
            "include_docs": request.include_docs,
            "max_files": request.max_files
        }
    }


@router.post("/self-document", summary="Create self-documentation from Parshu codebase")
async def create_self_documentation(
    background_tasks: BackgroundTasks,
    include_code: bool = True,
    include_docs: bool = True,
    max_files: int = 200,
    current_user: User = Depends(require_permission(MANAGE_KNOWLEDGE)),
    db: Session = Depends(get_db)
):
    """
    Create knowledge base documentation from the Parshu application itself.
    
    This allows the chatbot to answer questions about:
    - How Parshu works internally
    - Troubleshooting Parshu issues
    - Customizing and extending Parshu
    - Understanding Parshu's architecture
    
    Note: This requires the codebase to be accessible from the backend container.
    For production, use the GitHub crawler with your Parshu fork URL.
    """
    import os
    from pathlib import Path
    
    # Check if we have access to the codebase
    base_path = Path("/app")  # Default Docker path
    if not base_path.exists():
        base_path = Path(".")  # Local development
    
    if not (base_path / "app").exists():
        raise HTTPException(
            status_code=400,
            detail="Codebase not accessible. Use GitHub crawler with your Parshu repository URL instead."
        )
    
    # Create document entry
    doc = KnowledgeDocument(
        title="Parshu Application Documentation (Self-Generated)",
        description="Auto-generated documentation from the Parshu codebase for admin and engineer support",
        doc_type=KnowledgeDocumentType.PRODUCT_DOCUMENTATION,
        source_type="local",
        source_url="local://orion-codebase",
        status=KnowledgeDocumentStatus.PENDING,
        target_functions=["troubleshooting", "configuration", "development", "administration"],
        target_platforms=["orion"],
        tags=["orion", "self-documentation", "codebase", "internal"],
        priority=9,  # High priority for self-docs
        is_admin_managed=True,
        scope="global",
        uploaded_by_id=current_user.id
    )
    
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # Process in background
    async def process_self_documentation(doc_id: int):
        db = next(get_db())
        try:
            doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
            if not doc:
                return
            
            doc.status = KnowledgeDocumentStatus.PROCESSING
            db.commit()
            
            # Collect code files
            import glob
            
            content_parts = []
            files_processed = 0
            
            # Extensions to include
            include_extensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.md', '.css', '.json', '.yaml', '.yml']
            exclude_dirs = ['node_modules', '__pycache__', '.git', 'venv', 'dist', 'build', 'coverage']
            
            for ext in include_extensions:
                pattern = str(base_path / "**" / f"*{ext}")
                for filepath in glob.glob(pattern, recursive=True):
                    # Skip excluded directories
                    if any(excl in filepath for excl in exclude_dirs):
                        continue
                    
                    if files_processed >= max_files:
                        break
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        
                        # Skip very large files
                        if len(content) > 100000:
                            continue
                        
                        rel_path = os.path.relpath(filepath, base_path)
                        is_doc = ext in ['.md', '.txt', '.rst']
                        file_type = 'Documentation' if is_doc else 'Code'
                        
                        content_parts.append(f"""
=== [{file_type}] {rel_path} ===

{content}
""")
                        files_processed += 1
                        
                    except Exception as e:
                        logger.warning("self_doc_file_read_error", file=filepath, error=str(e))
            
            if files_processed == 0:
                doc.status = KnowledgeDocumentStatus.FAILED
                doc.processing_error = "No files found to process"
                db.commit()
                return
            
            # Combine content
            combined_content = "\n\n".join(content_parts)
            doc.raw_content = combined_content
            doc.file_size = len(combined_content)
            doc.pages_crawled = files_processed
            
            # Process with embeddings
            service = KnowledgeService(db)
            await service.process_document(doc.id)
            
            logger.info("self_documentation_complete", doc_id=doc.id, files=files_processed)
            
        except Exception as e:
            logger.error("self_documentation_failed", doc_id=doc_id, error=str(e))
            doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
            if doc:
                doc.status = KnowledgeDocumentStatus.FAILED
                doc.processing_error = str(e)
                db.commit()
        finally:
            db.close()
    
    import asyncio
    background_tasks.add_task(lambda: asyncio.run(process_self_documentation(doc.id)))
    
    return {
        "message": "Self-documentation generation started",
        "document_id": doc.id,
        "status": "PENDING"
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _doc_to_response(doc: KnowledgeDocument) -> DocumentResponse:
    """Convert document model to response."""
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        description=doc.description,
        doc_type=doc.doc_type.value if doc.doc_type else "custom",
        source_type=doc.source_type,
        source_url=doc.source_url,
        file_name=doc.file_name,
        file_size=doc.file_size,
        status=doc.status.value if doc.status else "PENDING",
        processing_error=doc.processing_error,
        chunk_count=doc.chunk_count or 0,
        crawl_depth=doc.crawl_depth or 0,
        pages_crawled=doc.pages_crawled or 0,
        target_functions=doc.target_functions,
        target_platforms=doc.target_platforms,
        tags=doc.tags,
        priority=doc.priority or 5,
        is_active=doc.is_active if doc.is_active is not None else True,
        is_admin_managed=doc.is_admin_managed if doc.is_admin_managed is not None else True,
        scope=doc.scope or "global",
        usage_count=doc.usage_count or 0,
        last_used_at=doc.last_used_at,
        created_at=doc.created_at,
        uploaded_by_id=doc.uploaded_by_id,
        uploaded_by_name=doc.uploaded_by.full_name if doc.uploaded_by else None
    )
