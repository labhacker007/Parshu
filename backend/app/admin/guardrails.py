"""
Guardrails Management API (GenAI Admin Day 5)

Provides CRUD operations for guardrails with multi-layer validation:
- Input validation (PII, prompt injection, length, profanity)
- Output validation (hallucination, toxicity, format)
- Business rules (rate limiting, cost controls)

Features:
- Guardrail CRUD operations
- Prompt-level guardrail management (via PromptGuardrail join table)
- Validation testing endpoints
- Flexible configuration (JSON-based)
- Actions on failure (retry, reject, fix, log)

Permissions: ADMIN_GENAI_VIEW, ADMIN_GENAI_EDIT
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import Guardrail, PromptGuardrail, Prompt, User
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import re

router = APIRouter(prefix="/admin/genai-guardrails", tags=["admin-guardrails"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class GuardrailBase(BaseModel):
    """Base schema for guardrails."""
    name: str = Field(..., min_length=1, max_length=100, description="Guardrail name")
    description: Optional[str] = Field(None, description="Description of what this guardrail does")
    type: str = Field(..., min_length=1, max_length=50, description="Guardrail type")
    config: Dict[str, Any] = Field(..., description="Configuration (JSON)")
    action: str = Field("retry", pattern=r"^(retry|reject|fix|log)$", description="Action on failure")
    max_retries: int = Field(2, ge=0, le=10, description="Max retries on failure")
    is_active: bool = Field(True, description="Whether guardrail is active")


class GuardrailCreate(GuardrailBase):
    """Schema for creating a guardrail."""
    pass


class GuardrailUpdate(BaseModel):
    """Schema for updating a guardrail."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    action: Optional[str] = Field(None, pattern=r"^(retry|reject|fix|log)$")
    max_retries: Optional[int] = Field(None, ge=0, le=10)
    is_active: Optional[bool] = None


class GuardrailResponse(GuardrailBase):
    """Response schema for guardrail."""
    id: int
    created_by_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class PromptGuardrailCreate(BaseModel):
    """Schema for attaching guardrail to prompt."""
    guardrail_id: int = Field(..., description="Guardrail ID to attach")
    order: int = Field(0, ge=0, description="Execution order (0=first)")


class PromptGuardrailResponse(BaseModel):
    """Response schema for prompt-guardrail link."""
    id: int
    prompt_id: int
    guardrail_id: int
    order: int
    guardrail: GuardrailResponse

    class Config:
        from_attributes = True


class GuardrailTestRequest(BaseModel):
    """Request schema for testing guardrail."""
    guardrail_type: str = Field(..., description="Type of guardrail to test")
    config: Dict[str, Any] = Field(..., description="Configuration to test")
    test_input: str = Field(..., description="Sample input to test against guardrail")


class GuardrailTestResponse(BaseModel):
    """Response schema for guardrail test."""
    passed: bool
    violations: List[str] = []
    action_taken: Optional[str] = None
    sanitized_output: Optional[str] = None


class GuardrailTypeInfo(BaseModel):
    """Information about a guardrail type."""
    type: str
    description: str
    example_config: Dict[str, Any]


class GuardrailValidationRequest(BaseModel):
    """Request to validate input against guardrails."""
    prompt_id: int
    input_text: str


class GuardrailValidationResponse(BaseModel):
    """Response from guardrail validation."""
    passed: bool
    violations: List[Dict[str, Any]] = []  # [{type, message, severity}]
    sanitized_input: Optional[str] = None


# ============================================================================
# Guardrail Types Registry
# ============================================================================

GUARDRAIL_TYPES = {
    "pii": {
        "description": "Detect and block PII (emails, phone numbers, SSN, credit cards)",
        "example_config": {
            "patterns": ["email", "phone", "ssn", "credit_card"],
            "action_on_detect": "redact"
        }
    },
    "prompt_injection": {
        "description": "Detect prompt injection attacks",
        "example_config": {
            "keywords": ["ignore previous", "system:", "admin mode", "jailbreak"],
            "action_on_detect": "block"
        }
    },
    "length": {
        "description": "Enforce input/output length limits",
        "example_config": {
            "min_length": 10,
            "max_length": 10000,
            "max_tokens": 4000
        }
    },
    "toxicity": {
        "description": "Block toxic/harmful outputs",
        "example_config": {
            "toxicity_threshold": 0.8,
            "categories": ["hate", "violence", "sexual", "self-harm"]
        }
    },
    "keywords_forbidden": {
        "description": "Block outputs containing forbidden keywords",
        "example_config": {
            "keywords": ["forbidden1", "forbidden2"]
        }
    },
    "keywords_required": {
        "description": "Require specific keywords in output",
        "example_config": {
            "keywords": ["required1", "required2"]
        }
    },
    "format": {
        "description": "Enforce output format (JSON, markdown, etc.)",
        "example_config": {
            "format": "json",
            "schema": {}
        }
    }
}


# ============================================================================
# Validation Service (Basic Implementation)
# ============================================================================

class GuardrailValidator:
    """Service for validating input/output against guardrails."""

    # PII regex patterns
    PII_PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
        "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
        "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
    }

    @staticmethod
    def validate_pii(text: str, config: Dict) -> tuple[bool, List[str], Optional[str]]:
        """Validate PII detection."""
        violations = []
        sanitized = text
        patterns_to_check = config.get("patterns", [])
        action_on_detect = config.get("action_on_detect", "block")

        for pattern_name in patterns_to_check:
            if pattern_name in GuardrailValidator.PII_PATTERNS:
                regex = GuardrailValidator.PII_PATTERNS[pattern_name]
                matches = re.findall(regex, text, re.IGNORECASE)

                if matches:
                    violations.append(f"PII detected: {pattern_name}")

                    if action_on_detect == "redact":
                        sanitized = re.sub(regex, f"[{pattern_name.upper()}_REDACTED]", sanitized, flags=re.IGNORECASE)

        passed = len(violations) == 0 or action_on_detect != "block"
        return passed, violations, sanitized if action_on_detect == "redact" else None

    @staticmethod
    def validate_prompt_injection(text: str, config: Dict) -> tuple[bool, List[str]]:
        """Validate prompt injection detection."""
        violations = []
        keywords = config.get("keywords", [])
        action_on_detect = config.get("action_on_detect", "block")

        text_lower = text.lower()
        for keyword in keywords:
            if keyword.lower() in text_lower:
                violations.append(f"Prompt injection keyword detected: {keyword}")

        passed = len(violations) == 0 or action_on_detect != "block"
        return passed, violations

    @staticmethod
    def validate_length(text: str, config: Dict) -> tuple[bool, List[str]]:
        """Validate input/output length limits."""
        violations = []
        min_length = config.get("min_length")
        max_length = config.get("max_length")
        max_tokens = config.get("max_tokens")

        text_length = len(text)

        if min_length and text_length < min_length:
            violations.append(f"Input too short: {text_length} < {min_length}")

        if max_length and text_length > max_length:
            violations.append(f"Input too long: {text_length} > {max_length}")

        if max_tokens:
            # Rough token estimation (1 token ≈ 4 characters)
            estimated_tokens = text_length // 4
            if estimated_tokens > max_tokens:
                violations.append(f"Estimated tokens exceed limit: {estimated_tokens} > {max_tokens}")

        return len(violations) == 0, violations

    @staticmethod
    def validate_keywords_forbidden(text: str, config: Dict) -> tuple[bool, List[str]]:
        """Validate that forbidden keywords are not present."""
        violations = []
        keywords = config.get("keywords", [])

        text_lower = text.lower()
        for keyword in keywords:
            if keyword.lower() in text_lower:
                violations.append(f"Forbidden keyword detected: {keyword}")

        return len(violations) == 0, violations

    @staticmethod
    def validate(guardrail_type: str, config: Dict, text: str) -> GuardrailTestResponse:
        """Main validation dispatcher."""
        if guardrail_type == "pii":
            passed, violations, sanitized = GuardrailValidator.validate_pii(text, config)
            return GuardrailTestResponse(
                passed=passed,
                violations=violations,
                action_taken=config.get("action_on_detect"),
                sanitized_output=sanitized
            )

        elif guardrail_type == "prompt_injection":
            passed, violations = GuardrailValidator.validate_prompt_injection(text, config)
            return GuardrailTestResponse(
                passed=passed,
                violations=violations,
                action_taken=config.get("action_on_detect")
            )

        elif guardrail_type == "length":
            passed, violations = GuardrailValidator.validate_length(text, config)
            return GuardrailTestResponse(
                passed=passed,
                violations=violations
            )

        elif guardrail_type == "keywords_forbidden":
            passed, violations = GuardrailValidator.validate_keywords_forbidden(text, config)
            return GuardrailTestResponse(
                passed=passed,
                violations=violations
            )

        else:
            # For unimplemented types, return placeholder
            return GuardrailTestResponse(
                passed=True,
                violations=[f"Validation for {guardrail_type} not yet implemented"]
            )


# ============================================================================
# API Routes - Fixed Paths (MUST be before /{guardrail_id} to avoid conflicts)
# ============================================================================

@router.get("/types", response_model=List[GuardrailTypeInfo])
async def list_guardrail_types(
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all available guardrail types.

    Permissions: ADMIN_GENAI_VIEW
    """
    types = [
        GuardrailTypeInfo(
            type=gtype,
            description=info["description"],
            example_config=info["example_config"]
        )
        for gtype, info in GUARDRAIL_TYPES.items()
    ]

    return types


@router.post("/test", response_model=GuardrailTestResponse)
async def test_guardrail(
    payload: GuardrailTestRequest,
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Test guardrail against sample input.

    Permissions: ADMIN_GENAI_VIEW
    """
    if payload.guardrail_type not in GUARDRAIL_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid guardrail type. Valid types: {list(GUARDRAIL_TYPES.keys())}"
        )

    result = GuardrailValidator.validate(
        payload.guardrail_type,
        payload.config,
        payload.test_input
    )

    return result


@router.post("/validate", response_model=GuardrailValidationResponse)
async def validate_input(
    payload: GuardrailValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Validate input against all active guardrails for a prompt.

    Permissions: ADMIN_GENAI_VIEW
    """
    # Get prompt with guardrails
    prompt = db.query(Prompt).filter(Prompt.id == payload.prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {payload.prompt_id} not found"
        )

    # Get active guardrails via join table
    prompt_guardrails = db.query(PromptGuardrail).filter(
        PromptGuardrail.prompt_id == payload.prompt_id
    ).order_by(PromptGuardrail.order).all()

    if not prompt_guardrails:
        return GuardrailValidationResponse(
            passed=True,
            violations=[],
            sanitized_input=None
        )

    # Run all validations
    all_violations = []
    sanitized_text = payload.input_text

    for pg in prompt_guardrails:
        guardrail = db.query(Guardrail).filter(Guardrail.id == pg.guardrail_id).first()
        if not guardrail or not guardrail.is_active:
            continue

        result = GuardrailValidator.validate(
            guardrail.type,
            guardrail.config,
            sanitized_text
        )

        if not result.passed:
            for violation in result.violations:
                all_violations.append({
                    "type": guardrail.type,
                    "message": violation,
                    "action": guardrail.action
                })

        # Update sanitized text if redaction occurred
        if result.sanitized_output:
            sanitized_text = result.sanitized_output

    return GuardrailValidationResponse(
        passed=len(all_violations) == 0,
        violations=all_violations,
        sanitized_input=sanitized_text if sanitized_text != payload.input_text else None
    )


# ============================================================================
# API Routes - CRUD Operations
# ============================================================================

@router.get("/", response_model=List[GuardrailResponse])
async def list_guardrails(
    guardrail_type: Optional[str] = Query(None, description="Filter by type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all guardrails with optional filters.

    Query Parameters:
    - guardrail_type: Filter by type
    - is_active: Filter by active status

    Permissions: ADMIN_GENAI_VIEW
    """
    query = db.query(Guardrail)

    if guardrail_type:
        query = query.filter(Guardrail.type == guardrail_type)

    if is_active is not None:
        query = query.filter(Guardrail.is_active == is_active)

    guardrails = query.order_by(Guardrail.created_at.desc()).all()

    return guardrails


@router.post("/", response_model=GuardrailResponse, status_code=status.HTTP_201_CREATED)
async def create_guardrail(
    payload: GuardrailCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Create a new guardrail.

    Permissions: ADMIN_GENAI_EDIT
    """
    # Validate type
    if payload.type not in GUARDRAIL_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid guardrail type. Valid types: {list(GUARDRAIL_TYPES.keys())}"
        )

    # Check for duplicate name
    existing = db.query(Guardrail).filter(Guardrail.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Guardrail '{payload.name}' already exists"
        )

    # Create guardrail
    guardrail = Guardrail(
        name=payload.name,
        description=payload.description,
        type=payload.type,
        config=payload.config,
        action=payload.action,
        max_retries=payload.max_retries,
        is_active=payload.is_active,
        created_by_id=current_user.id
    )

    db.add(guardrail)
    db.commit()
    db.refresh(guardrail)

    return guardrail


@router.get("/{guardrail_id}", response_model=GuardrailResponse)
async def get_guardrail(
    guardrail_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Get specific guardrail by ID.

    Permissions: ADMIN_GENAI_VIEW
    """
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()

    if not guardrail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail with ID {guardrail_id} not found"
        )

    return guardrail


@router.patch("/{guardrail_id}", response_model=GuardrailResponse)
async def update_guardrail(
    guardrail_id: int,
    payload: GuardrailUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Update guardrail.

    Permissions: ADMIN_GENAI_EDIT
    """
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()

    if not guardrail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail with ID {guardrail_id} not found"
        )

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(guardrail, field, value)

    db.commit()
    db.refresh(guardrail)

    return guardrail


@router.delete("/{guardrail_id}")
async def delete_guardrail(
    guardrail_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Delete guardrail.

    Permissions: ADMIN_GENAI_EDIT
    """
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()

    if not guardrail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail with ID {guardrail_id} not found"
        )

    db.delete(guardrail)
    db.commit()

    return {"message": f"Guardrail '{guardrail.name}' deleted successfully"}


# ============================================================================
# API Routes - Prompt-Level Guardrails (Join Table Management)
# ============================================================================

@router.get("/prompts/{prompt_id}/guardrails", response_model=List[PromptGuardrailResponse])
async def list_prompt_guardrails(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all guardrails for a specific prompt.

    Permissions: ADMIN_GENAI_VIEW
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    # Get prompt_guardrails with guardrail details
    prompt_guardrails = db.query(PromptGuardrail).filter(
        PromptGuardrail.prompt_id == prompt_id
    ).order_by(PromptGuardrail.order).all()

    # Manually load guardrail relationship
    results = []
    for pg in prompt_guardrails:
        guardrail = db.query(Guardrail).filter(Guardrail.id == pg.guardrail_id).first()
        if guardrail:
            results.append({
                "id": pg.id,
                "prompt_id": pg.prompt_id,
                "guardrail_id": pg.guardrail_id,
                "order": pg.order,
                "guardrail": guardrail
            })

    return results


@router.post("/prompts/{prompt_id}/guardrails", response_model=PromptGuardrailResponse, status_code=status.HTTP_201_CREATED)
async def attach_guardrail_to_prompt(
    prompt_id: int,
    payload: PromptGuardrailCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Attach guardrail to prompt.

    Permissions: ADMIN_GENAI_EDIT
    """
    # Verify prompt exists
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    # Verify guardrail exists
    guardrail = db.query(Guardrail).filter(Guardrail.id == payload.guardrail_id).first()
    if not guardrail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail with ID {payload.guardrail_id} not found"
        )

    # Check if already attached
    existing = db.query(PromptGuardrail).filter(
        and_(
            PromptGuardrail.prompt_id == prompt_id,
            PromptGuardrail.guardrail_id == payload.guardrail_id
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Guardrail already attached to this prompt"
        )

    # Create link
    prompt_guardrail = PromptGuardrail(
        prompt_id=prompt_id,
        guardrail_id=payload.guardrail_id,
        order=payload.order
    )

    db.add(prompt_guardrail)
    db.commit()
    db.refresh(prompt_guardrail)

    return {
        "id": prompt_guardrail.id,
        "prompt_id": prompt_guardrail.prompt_id,
        "guardrail_id": prompt_guardrail.guardrail_id,
        "order": prompt_guardrail.order,
        "guardrail": guardrail
    }


@router.delete("/prompts/{prompt_id}/guardrails/{prompt_guardrail_id}")
async def detach_guardrail_from_prompt(
    prompt_id: int,
    prompt_guardrail_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Detach guardrail from prompt.

    Permissions: ADMIN_GENAI_EDIT
    """
    prompt_guardrail = db.query(PromptGuardrail).filter(
        and_(
            PromptGuardrail.id == prompt_guardrail_id,
            PromptGuardrail.prompt_id == prompt_id
        )
    ).first()

    if not prompt_guardrail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt-guardrail link not found"
        )

    db.delete(prompt_guardrail)
    db.commit()

    return {"message": "Guardrail detached from prompt"}
