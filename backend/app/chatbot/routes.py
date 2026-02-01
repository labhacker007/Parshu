"""Chatbot API routes with RAG and Guardrails support."""
import io
import base64
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models import User
from app.chatbot.service import get_chatbot, DocumentStore
from app.core.logging import logger

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict] = None
    use_rag: bool = True  # Whether to use knowledge base RAG


class ChatResponse(BaseModel):
    response: str
    sources: List[Dict] = []
    rag_sources: List[Dict] = []  # Knowledge base sources used
    feedback_needed: bool = False
    feedback_prompt: Optional[str] = None
    model_used: Optional[str] = None
    guardrails_applied: bool = False  # Whether guardrails were applied
    error: Optional[str] = None


class FeedbackRequest(BaseModel):
    message: str
    issue_type: str  # documentation, feature, bug
    context: Optional[Dict] = None


class DocumentUploadResponse(BaseModel):
    document_id: str
    title: str
    word_count: int
    message: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message to the Parshu chatbot and get a response.
    
    The chatbot uses:
    - Knowledge Base RAG: Retrieves relevant context from admin-managed documents
    - Guardrails: Applies configured guardrails for safe, accurate responses
    - Built-in Documentation: Falls back to built-in docs for platform info
    """
    # Get chatbot with database session for RAG support
    chatbot = get_chatbot(db_session=db)
    
    # Add user context
    user_context = {
        "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
        "user_id": current_user.id,
        "username": current_user.username,
        **(request.context or {})
    }
    
    result = await chatbot.chat(
        message=request.message,
        user_context=user_context,
        include_docs=True,
        db_session=db  # Pass db session for RAG
    )
    
    return ChatResponse(**result)


@router.post("/feedback")
async def submit_feedback(
    request: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit feedback about documentation or feature discrepancy."""
    chatbot = get_chatbot()
    
    result = await chatbot.submit_feedback(
        message=request.message,
        issue_type=request.issue_type,
        user_id=current_user.id,
        context=request.context
    )
    
    return result


@router.post("/clear-history")
def clear_history(
    current_user: User = Depends(get_current_user)
):
    """Clear conversation history for a fresh start."""
    chatbot = get_chatbot()
    chatbot.clear_history()
    return {"message": "Conversation history cleared"}


@router.get("/documents")
def list_documents(
    current_user: User = Depends(get_current_user)
):
    """List all documents in the chatbot knowledge base."""
    chatbot = get_chatbot()
    docs = chatbot.document_store.list_documents()
    return {"documents": docs, "total": len(docs)}


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Upload a document (PDF, Excel, TXT, CSV) to the chatbot knowledge base."""
    
    # Check file type
    allowed_types = {
        "application/pdf": "pdf",
        "text/plain": "txt",
        "text/csv": "csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-excel": "xls",
        "image/png": "image",
        "image/jpeg": "image",
        "image/jpg": "image"
    }
    
    content_type = file.content_type
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}. Supported: PDF, TXT, CSV, Excel, Images"
        )
    
    doc_type = allowed_types[content_type]
    file_content = await file.read()
    
    # Extract text based on file type
    text_content = ""
    
    if doc_type == "txt" or doc_type == "csv":
        text_content = file_content.decode('utf-8', errors='ignore')
    
    elif doc_type == "pdf":
        try:
            import pypdf
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))
            text_content = "\n".join(page.extract_text() for page in pdf_reader.pages)
        except ImportError:
            # Fallback: store as base64 with note
            text_content = f"[PDF document - text extraction requires pypdf library]\nBase64: {base64.b64encode(file_content[:1000]).decode()}"
        except Exception as e:
            logger.warning("pdf_extraction_failed", error=str(e))
            text_content = f"[PDF document - extraction failed: {str(e)}]"
    
    elif doc_type in ("xlsx", "xls"):
        try:
            import pandas as pd
            df = pd.read_excel(io.BytesIO(file_content))
            text_content = df.to_string()
        except ImportError:
            text_content = "[Excel document - requires pandas and openpyxl libraries]"
        except Exception as e:
            logger.warning("excel_extraction_failed", error=str(e))
            text_content = f"[Excel document - extraction failed: {str(e)}]"
    
    elif doc_type == "image":
        # For images, we'll store metadata and let the chatbot know there's an image
        # In a production system, you'd use OCR or vision models
        text_content = f"[Image document: {file.filename}]\nNote: Image uploaded for reference. Contents require visual inspection."
    
    if not text_content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract text from the uploaded file"
        )
    
    # Add to document store
    chatbot = get_chatbot()
    doc_title = title or file.filename or "Uploaded Document"
    
    doc_id = chatbot.document_store.add_document(
        content=text_content,
        title=doc_title,
        doc_type=doc_type,
        source="user_upload",
        metadata={
            "filename": file.filename,
            "uploaded_by": current_user.id,
            "content_type": content_type
        }
    )
    
    logger.info("document_uploaded", 
                doc_id=doc_id, 
                filename=file.filename, 
                user_id=current_user.id,
                word_count=len(text_content.split()))
    
    return DocumentUploadResponse(
        document_id=doc_id,
        title=doc_title,
        word_count=len(text_content.split()),
        message=f"Document '{doc_title}' uploaded successfully"
    )


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a document from the knowledge base."""
    chatbot = get_chatbot()
    
    doc = chatbot.document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Only allow deleting user-uploaded docs (not builtin)
    if doc.get("source") == "builtin" and current_user.role.value != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete built-in documentation"
        )
    
    chatbot.document_store.delete_document(doc_id)
    
    return {"message": f"Document {doc_id} deleted", "doc_id": doc_id}


@router.get("/documents/{doc_id}")
def get_document(
    doc_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific document from the knowledge base."""
    chatbot = get_chatbot()
    
    doc = chatbot.document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return doc


@router.post("/documents/query-context")
async def add_query_context(
    index_name: str = Form(...),
    dataset_info: str = Form(...),
    source_type: str = Form(...),
    syntax_docs: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Add index/dataset information for query formation context.
    
    This helps the chatbot generate more accurate hunt queries by knowing
    the specific indexes, datasets, and source fields available.
    """
    content = f"""Query Context Configuration
    
Index/Dataset: {index_name}
Source Type: {source_type}

Dataset Information:
{dataset_info}

{"Syntax Documentation:" + chr(10) + syntax_docs if syntax_docs else ""}

Use this information when generating hunt queries for this data source."""

    chatbot = get_chatbot()
    
    doc_id = chatbot.document_store.add_document(
        content=content,
        title=f"Query Context: {index_name} ({source_type})",
        doc_type="query_context",
        source="user_config",
        metadata={
            "index_name": index_name,
            "source_type": source_type,
            "configured_by": current_user.id
        }
    )
    
    return {
        "document_id": doc_id,
        "message": f"Query context for '{index_name}' added to knowledge base"
    }
