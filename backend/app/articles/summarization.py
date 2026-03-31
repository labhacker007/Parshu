"""
Article summarization API routes.
Simplified for Jyoti news aggregator.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models import User, FetchedContent
from app.genai.summarization import get_summarization_service
from app.genai.prompts import SummaryType
from app.genai.provider import get_model_manager
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

router = APIRouter(prefix="/articles", tags=["articles-genai"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class SummarizeRequest(BaseModel):
    title: str
    content: str
    summary_type: str = "brief"  # executive, technical, brief
    persona: str = "analyst"
    preferred_model: Optional[str] = None


class AnalyzeContentRequest(BaseModel):
    include_iocs: bool = True
    preferred_model: Optional[str] = None


# ============================================================================
# Routes
# ============================================================================

@router.post("/summarize")
async def summarize_article(
    request: SummarizeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a summary of an article.
    Supports: executive, technical, brief.
    """
    try:
        # Validate summary type
        try:
            summary_type = SummaryType(request.summary_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid summary_type. Must be: executive, technical, or brief"
            )

        service = get_summarization_service()
        result = await service.summarize_article(
            title=request.title,
            content=request.content,
            summary_type=summary_type,
            persona=request.persona,
            preferred_model=request.preferred_model
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-iocs")
async def extract_iocs(
    title: str,
    content: str,
    preferred_model: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Extract IOCs (security indicators) from an article.
    Returns IPs, domains, URLs, hashes, emails, CVEs.
    """
    try:
        service = get_summarization_service()
        result = await service.extract_iocs(
            title=title,
            content=content,
            preferred_model=preferred_model
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{content_id}/analyze")
async def analyze_content(
    content_id: int,
    request: AnalyzeContentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate summaries and extract IOCs for fetched content.
    Updates the FetchedContent record with analysis.
    """
    # Get the content
    content = db.query(FetchedContent).filter(
        FetchedContent.id == content_id,
        FetchedContent.user_id == current_user.id
    ).first()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    try:
        service = get_summarization_service()

        # Generate all summaries
        results = await service.generate_all_summaries(
            title=content.title or "Untitled",
            content=content.content or "",
            include_iocs=request.include_iocs,
            preferred_model=request.preferred_model
        )

        if not results.get("success"):
            raise HTTPException(
                status_code=500,
                detail=results.get("error", "Analysis failed")
            )

        # Update content record
        content.executive_summary = results.get("executive_summary")
        content.technical_summary = results.get("technical_summary")
        content.iocs = results.get("iocs") if request.include_iocs else None
        content.analyzed_at = datetime.utcnow()

        db.commit()
        db.refresh(content)

        return {
            "content_id": content_id,
            "executive_summary": content.executive_summary,
            "technical_summary": content.technical_summary,
            "brief_summary": results.get("brief_summary"),
            "iocs": content.iocs,
            "model_used": results.get("model_used"),
            "analyzed_at": content.analyzed_at
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_available_models(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all available GenAI models (API + local Ollama).
    Shows current primary/secondary models.
    """
    try:
        model_manager = get_model_manager()
        models = await model_manager.get_available_models(db_session=db)

        return {
            "models": models,
            "primary_model": model_manager.get_primary_model(),
            "secondary_model": model_manager.get_secondary_model()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/set-primary")
async def set_primary_model(
    model_id: str,
    current_user: User = Depends(get_current_user)
):
    """Set the primary GenAI model (admin only)."""
    # TODO: Add permission check for admin
    try:
        model_manager = get_model_manager()
        model_manager.set_primary_model(model_id)

        return {"message": f"Primary model set to: {model_id}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test-genai")
async def test_genai_connection(
    model_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Test connection to GenAI provider."""
    try:
        model_manager = get_model_manager()

        if not model_id:
            model_id = model_manager.get_primary_model()

        provider = await model_manager.get_provider(model_id)

        test_result = await provider.generate(
            system_prompt="You are a helpful assistant.",
            user_prompt="Say 'Connected!' in one word.",
            temperature=0,
            max_tokens=5
        )

        return {
            "status": "success",
            "model_id": model_id,
            "test_response": test_result
        }

    except Exception as e:
        return {
            "status": "error",
            "model_id": model_id,
            "error": str(e)
        }
