"""
GenAI Function-to-Model Configuration API

Maps each GenAI function to specific models with primary/secondary fallback,
tracks usage statistics, and allows admin to configure model parameters.

Features:
- Function-model mapping (primary/secondary fallback)
- Usage tracking (requests, tokens, cost)
- Model parameter configuration (temperature, max_tokens)
- Active prompt assignment per function
- Real-time statistics

Context:
- Day 3 of GenAI Admin implementation
- Integrates with Prompt, Skill, and Guardrail systems
- Used by frontend GenAI admin UI
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import (
    GenAIFunctionConfig, Prompt, PromptExecutionLog, User
)
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta

router = APIRouter(prefix="/admin/genai/functions", tags=["admin-genai-functions"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class FunctionConfigCreate(BaseModel):
    """Create new function configuration."""
    function_name: str = Field(..., min_length=1, max_length=100, description="Unique function identifier")
    display_name: str = Field(..., min_length=1, max_length=200, description="Human-readable name")
    description: Optional[str] = Field(None, description="Function purpose and use cases")
    active_prompt_id: Optional[int] = Field(None, description="ID of active prompt template")
    primary_model_id: Optional[str] = Field(None, max_length=100, description="Primary model (e.g., gpt-4o-mini)")
    secondary_model_id: Optional[str] = Field(None, max_length=100, description="Fallback model")


class FunctionConfigUpdate(BaseModel):
    """Update existing function configuration."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    active_prompt_id: Optional[int] = None
    primary_model_id: Optional[str] = Field(None, max_length=100)
    secondary_model_id: Optional[str] = Field(None, max_length=100)


class FunctionConfigResponse(BaseModel):
    """Function configuration with statistics."""
    id: int
    function_name: str
    display_name: str
    description: Optional[str]
    active_prompt_id: Optional[int]
    active_prompt_name: Optional[str] = None
    primary_model_id: Optional[str]
    secondary_model_id: Optional[str]
    total_requests: int
    total_tokens: int
    total_cost: float
    updated_by_id: Optional[int]
    updated_at: datetime

    # Statistics (computed)
    avg_tokens_per_request: Optional[float] = None
    avg_cost_per_request: Optional[float] = None
    last_used: Optional[datetime] = None

    class Config:
        from_attributes = True


class UsageStats(BaseModel):
    """Detailed usage statistics for a function."""
    function_name: str
    total_requests: int
    total_tokens: int
    total_cost: float
    requests_last_24h: int
    requests_last_7d: int
    requests_last_30d: int
    avg_tokens: float
    avg_cost: float
    avg_duration_ms: Optional[float] = None
    success_rate: float
    error_rate: float


class ModelRecommendation(BaseModel):
    """Recommended model for a function."""
    model_id: str
    reason: str
    use_cases: List[str]
    estimated_cost_per_1k: float
    speed: str  # "fast", "medium", "slow"
    quality: str  # "good", "better", "best"


# ============================================================================
# Helper Functions
# ============================================================================

def calculate_statistics(
    db: Session,
    function_name: str,
    days: int = 30
) -> Dict:
    """Calculate usage statistics for a function."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get execution logs
    logs = db.query(PromptExecutionLog).filter(
        PromptExecutionLog.function_name == function_name,
        PromptExecutionLog.timestamp >= cutoff_date
    ).all()

    if not logs:
        return {
            "total_requests": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "avg_tokens": 0.0,
            "avg_cost": 0.0,
            "success_rate": 0.0,
            "error_rate": 0.0
        }

    total_requests = len(logs)
    total_tokens = sum(log.tokens_used or 0 for log in logs)
    total_cost = sum(log.cost or 0.0 for log in logs)
    successful = sum(1 for log in logs if log.guardrails_passed)

    return {
        "total_requests": total_requests,
        "total_tokens": total_tokens,
        "total_cost": total_cost,
        "avg_tokens": total_tokens / total_requests if total_requests > 0 else 0,
        "avg_cost": total_cost / total_requests if total_requests > 0 else 0,
        "success_rate": (successful / total_requests * 100) if total_requests > 0 else 0,
        "error_rate": ((total_requests - successful) / total_requests * 100) if total_requests > 0 else 0
    }


# ============================================================================
# API Routes - CRUD Operations
# ============================================================================

@router.get("/", response_model=List[FunctionConfigResponse])
async def list_function_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all GenAI function configurations.

    Returns configuration, assigned prompts, and usage statistics for each function.

    Permissions: ADMIN_GENAI_VIEW
    """
    configs = db.query(GenAIFunctionConfig).all()

    response = []
    for config in configs:
        # Get active prompt name
        active_prompt_name = None
        if config.active_prompt_id:
            prompt = db.query(Prompt).filter(Prompt.id == config.active_prompt_id).first()
            if prompt:
                active_prompt_name = prompt.name

        # Calculate averages
        avg_tokens = config.total_tokens / config.total_requests if config.total_requests > 0 else 0
        avg_cost = config.total_cost / config.total_requests if config.total_requests > 0 else 0

        # Get last used timestamp
        last_log = db.query(PromptExecutionLog).filter(
            PromptExecutionLog.function_name == config.function_name
        ).order_by(PromptExecutionLog.timestamp.desc()).first()

        last_used = last_log.timestamp if last_log else None

        response.append(FunctionConfigResponse(
            id=config.id,
            function_name=config.function_name,
            display_name=config.display_name,
            description=config.description,
            active_prompt_id=config.active_prompt_id,
            active_prompt_name=active_prompt_name,
            primary_model_id=config.primary_model_id,
            secondary_model_id=config.secondary_model_id,
            total_requests=config.total_requests,
            total_tokens=config.total_tokens,
            total_cost=config.total_cost,
            updated_by_id=config.updated_by_id,
            updated_at=config.updated_at,
            avg_tokens_per_request=avg_tokens,
            avg_cost_per_request=avg_cost,
            last_used=last_used
        ))

    return response


@router.get("/{function_name}", response_model=FunctionConfigResponse)
async def get_function_config(
    function_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Get specific function configuration by name.

    Permissions: ADMIN_GENAI_VIEW
    """
    config = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == function_name
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Function '{function_name}' not found"
        )

    # Get active prompt name
    active_prompt_name = None
    if config.active_prompt_id:
        prompt = db.query(Prompt).filter(Prompt.id == config.active_prompt_id).first()
        if prompt:
            active_prompt_name = prompt.name

    # Calculate averages
    avg_tokens = config.total_tokens / config.total_requests if config.total_requests > 0 else 0
    avg_cost = config.total_cost / config.total_requests if config.total_requests > 0 else 0

    # Get last used timestamp
    last_log = db.query(PromptExecutionLog).filter(
        PromptExecutionLog.function_name == function_name
    ).order_by(PromptExecutionLog.timestamp.desc()).first()

    return FunctionConfigResponse(
        id=config.id,
        function_name=config.function_name,
        display_name=config.display_name,
        description=config.description,
        active_prompt_id=config.active_prompt_id,
        active_prompt_name=active_prompt_name,
        primary_model_id=config.primary_model_id,
        secondary_model_id=config.secondary_model_id,
        total_requests=config.total_requests,
        total_tokens=config.total_tokens,
        total_cost=config.total_cost,
        updated_by_id=config.updated_by_id,
        updated_at=config.updated_at,
        avg_tokens_per_request=avg_tokens,
        avg_cost_per_request=avg_cost,
        last_used=last_log.timestamp if last_log else None
    )


@router.post("/", response_model=FunctionConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_function_config(
    payload: FunctionConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Create new GenAI function configuration.

    Permissions: ADMIN_GENAI_EDIT
    """
    # Check if function already exists
    existing = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == payload.function_name
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Function '{payload.function_name}' already exists"
        )

    # Validate prompt if provided
    if payload.active_prompt_id:
        prompt = db.query(Prompt).filter(Prompt.id == payload.active_prompt_id).first()
        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prompt ID {payload.active_prompt_id} not found"
            )

    # Create config
    config = GenAIFunctionConfig(
        function_name=payload.function_name,
        display_name=payload.display_name,
        description=payload.description,
        active_prompt_id=payload.active_prompt_id,
        primary_model_id=payload.primary_model_id,
        secondary_model_id=payload.secondary_model_id,
        total_requests=0,
        total_tokens=0,
        total_cost=0.0,
        updated_by_id=current_user.id,
        updated_at=datetime.utcnow()
    )

    db.add(config)
    db.commit()
    db.refresh(config)

    # Get prompt name
    active_prompt_name = None
    if config.active_prompt_id:
        prompt = db.query(Prompt).filter(Prompt.id == config.active_prompt_id).first()
        if prompt:
            active_prompt_name = prompt.name

    return FunctionConfigResponse(
        id=config.id,
        function_name=config.function_name,
        display_name=config.display_name,
        description=config.description,
        active_prompt_id=config.active_prompt_id,
        active_prompt_name=active_prompt_name,
        primary_model_id=config.primary_model_id,
        secondary_model_id=config.secondary_model_id,
        total_requests=config.total_requests,
        total_tokens=config.total_tokens,
        total_cost=config.total_cost,
        updated_by_id=config.updated_by_id,
        updated_at=config.updated_at,
        avg_tokens_per_request=0.0,
        avg_cost_per_request=0.0,
        last_used=None
    )


@router.patch("/{function_name}", response_model=FunctionConfigResponse)
async def update_function_config(
    function_name: str,
    payload: FunctionConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Update existing function configuration.

    Permissions: ADMIN_GENAI_EDIT
    """
    config = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == function_name
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Function '{function_name}' not found"
        )

    # Validate prompt if provided
    if payload.active_prompt_id is not None:
        prompt = db.query(Prompt).filter(Prompt.id == payload.active_prompt_id).first()
        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prompt ID {payload.active_prompt_id} not found"
            )

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    config.updated_by_id = current_user.id
    config.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(config)

    # Get prompt name
    active_prompt_name = None
    if config.active_prompt_id:
        prompt = db.query(Prompt).filter(Prompt.id == config.active_prompt_id).first()
        if prompt:
            active_prompt_name = prompt.name

    # Calculate averages
    avg_tokens = config.total_tokens / config.total_requests if config.total_requests > 0 else 0
    avg_cost = config.total_cost / config.total_requests if config.total_requests > 0 else 0

    return FunctionConfigResponse(
        id=config.id,
        function_name=config.function_name,
        display_name=config.display_name,
        description=config.description,
        active_prompt_id=config.active_prompt_id,
        active_prompt_name=active_prompt_name,
        primary_model_id=config.primary_model_id,
        secondary_model_id=config.secondary_model_id,
        total_requests=config.total_requests,
        total_tokens=config.total_tokens,
        total_cost=config.total_cost,
        updated_by_id=config.updated_by_id,
        updated_at=config.updated_at,
        avg_tokens_per_request=avg_tokens,
        avg_cost_per_request=avg_cost,
        last_used=None
    )


@router.delete("/{function_name}")
async def delete_function_config(
    function_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Delete function configuration.

    Permissions: ADMIN_GENAI_EDIT
    """
    config = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == function_name
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Function '{function_name}' not found"
        )

    db.delete(config)
    db.commit()

    return {"message": f"Function '{function_name}' deleted successfully"}


# ============================================================================
# Statistics & Analytics
# ============================================================================

@router.get("/{function_name}/stats", response_model=UsageStats)
async def get_function_stats(
    function_name: str,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Get detailed usage statistics for a function.

    Query Parameters:
    - days: Number of days to analyze (default: 30)

    Permissions: ADMIN_GENAI_VIEW
    """
    config = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == function_name
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Function '{function_name}' not found"
        )

    # Calculate time-based request counts
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    requests_24h = db.query(func.count(PromptExecutionLog.id)).filter(
        PromptExecutionLog.function_name == function_name,
        PromptExecutionLog.timestamp >= day_ago
    ).scalar() or 0

    requests_7d = db.query(func.count(PromptExecutionLog.id)).filter(
        PromptExecutionLog.function_name == function_name,
        PromptExecutionLog.timestamp >= week_ago
    ).scalar() or 0

    requests_30d = db.query(func.count(PromptExecutionLog.id)).filter(
        PromptExecutionLog.function_name == function_name,
        PromptExecutionLog.timestamp >= month_ago
    ).scalar() or 0

    # Calculate detailed statistics
    stats = calculate_statistics(db, function_name, days)

    # Calculate average duration
    avg_duration = db.query(func.avg(PromptExecutionLog.execution_time_ms)).filter(
        PromptExecutionLog.function_name == function_name,
        PromptExecutionLog.timestamp >= now - timedelta(days=days)
    ).scalar()

    return UsageStats(
        function_name=function_name,
        total_requests=stats["total_requests"],
        total_tokens=stats["total_tokens"],
        total_cost=stats["total_cost"],
        requests_last_24h=requests_24h,
        requests_last_7d=requests_7d,
        requests_last_30d=requests_30d,
        avg_tokens=stats["avg_tokens"],
        avg_cost=stats["avg_cost"],
        avg_duration_ms=float(avg_duration) if avg_duration else None,
        success_rate=stats["success_rate"],
        error_rate=stats["error_rate"]
    )


@router.get("/{function_name}/recommendations", response_model=List[ModelRecommendation])
async def get_model_recommendations(
    function_name: str,
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Get recommended models for a specific function.

    Recommendations are based on:
    - Function type (summarization, extraction, analysis, etc.)
    - Use case requirements (speed vs quality)
    - Cost considerations

    Permissions: ADMIN_GENAI_VIEW
    """
    # Model recommendations by function type
    recommendations_map = {
        "summarization": [
            ModelRecommendation(
                model_id="gpt-4o-mini",
                reason="Best balance of speed, quality, and cost for summarization",
                use_cases=["Article summaries", "Quick insights", "Bullet points"],
                estimated_cost_per_1k=0.15,
                speed="fast",
                quality="better"
            ),
            ModelRecommendation(
                model_id="llama3.1:8b",
                reason="Free local model with good summarization quality",
                use_cases=["Privacy-sensitive content", "High-volume processing"],
                estimated_cost_per_1k=0.0,
                speed="medium",
                quality="good"
            )
        ],
        "extraction": [
            ModelRecommendation(
                model_id="gpt-4o",
                reason="Highest accuracy for complex entity extraction",
                use_cases=["IOC extraction", "Structured data parsing"],
                estimated_cost_per_1k=2.50,
                speed="medium",
                quality="best"
            ),
            ModelRecommendation(
                model_id="llama3.1:8b",
                reason="Good extraction accuracy at no cost",
                use_cases=["Simple entity extraction", "Keyword extraction"],
                estimated_cost_per_1k=0.0,
                speed="medium",
                quality="good"
            )
        ],
        "analysis": [
            ModelRecommendation(
                model_id="gpt-4o",
                reason="Best for deep analysis and reasoning",
                use_cases=["Threat analysis", "Complex Q&A", "Research"],
                estimated_cost_per_1k=2.50,
                speed="slow",
                quality="best"
            ),
            ModelRecommendation(
                model_id="llama3.1:70b",
                reason="High-quality local model for sensitive analysis",
                use_cases=["Private analysis", "Compliance-sensitive data"],
                estimated_cost_per_1k=0.0,
                speed="slow",
                quality="better"
            )
        ]
    }

    # Default recommendations for unknown function types
    default_recommendations = [
        ModelRecommendation(
            model_id="gpt-4o-mini",
            reason="Versatile model for general-purpose tasks",
            use_cases=["General AI tasks", "Experimentation"],
            estimated_cost_per_1k=0.15,
            speed="fast",
            quality="better"
        ),
        ModelRecommendation(
            model_id="llama3.1:8b",
            reason="Free local alternative",
            use_cases=["Privacy-focused", "Cost optimization"],
            estimated_cost_per_1k=0.0,
            speed="medium",
            quality="good"
        )
    ]

    # Try to match function name to type
    function_lower = function_name.lower()
    for func_type, recommendations in recommendations_map.items():
        if func_type in function_lower:
            return recommendations

    return default_recommendations


@router.post("/{function_name}/reset-stats")
async def reset_function_stats(
    function_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Reset usage statistics for a function (does not delete logs).

    Permissions: ADMIN_GENAI_EDIT
    """
    config = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == function_name
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Function '{function_name}' not found"
        )

    config.total_requests = 0
    config.total_tokens = 0
    config.total_cost = 0.0
    config.updated_by_id = current_user.id
    config.updated_at = datetime.utcnow()

    db.commit()

    return {"message": f"Statistics reset for function '{function_name}'"}
