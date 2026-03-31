"""
Prompt Management API (GenAI Admin Day 4)

Provides CRUD operations for prompt templates with versioning,
variable management, and preview functionality.

Features:
- Prompt CRUD operations
- Automatic versioning on updates
- Variable management (required/optional)
- Prompt preview with variable substitution
- Filter by function type and active status

Permissions: ADMIN_GENAI_VIEW, ADMIN_GENAI_EDIT
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import Prompt, PromptVariable, User
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import re

router = APIRouter(prefix="/admin/prompts", tags=["admin-prompts"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class PromptVariableBase(BaseModel):
    """Base schema for prompt variables."""
    name: str = Field(..., pattern=r"^[a-zA-Z0-9_]+$", max_length=50, description="Variable name (alphanumeric + underscore)")
    type: str = Field("string", description="Variable type (string, number, boolean, array)")
    description: Optional[str] = Field(None, description="Description of the variable")
    default_value: Optional[str] = Field(None, description="Default value if not provided")
    is_required: bool = Field(True, description="Whether this variable is required")


class PromptVariableCreate(PromptVariableBase):
    """Schema for creating a prompt variable."""
    pass


class PromptVariableUpdate(BaseModel):
    """Schema for updating a prompt variable."""
    description: Optional[str] = None
    default_value: Optional[str] = None
    is_required: Optional[bool] = None


class PromptVariableResponse(PromptVariableBase):
    """Response schema for prompt variable."""
    id: int
    prompt_id: int

    class Config:
        from_attributes = True


class PromptBase(BaseModel):
    """Base schema for prompts."""
    name: str = Field(..., min_length=1, max_length=100, description="Unique prompt name")
    description: Optional[str] = Field(None, description="Description of the prompt")
    function_type: str = Field(..., min_length=1, max_length=50, description="Function type (summarization, extraction, etc.)")
    template: str = Field(..., min_length=1, description="Prompt template with {variable} placeholders")
    model_id: Optional[str] = Field(None, description="Preferred model ID")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="LLM temperature (0.0-2.0)")
    max_tokens: int = Field(500, ge=1, le=32000, description="Maximum tokens to generate")
    tags: Optional[List[str]] = Field(None, description="Tags for organization")


class PromptCreate(PromptBase):
    """Schema for creating a new prompt."""
    variables: List[PromptVariableCreate] = Field(default_factory=list, description="List of variables in the template")


class PromptUpdate(BaseModel):
    """Schema for updating a prompt."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    template: Optional[str] = Field(None, min_length=1)
    model_id: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=32000)
    is_active: Optional[bool] = None
    tags: Optional[List[str]] = None


class PromptResponse(PromptBase):
    """Response schema for prompt."""
    id: int
    version: int
    is_active: bool
    parent_id: Optional[int] = None
    created_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    variables: List[PromptVariableResponse] = []

    class Config:
        from_attributes = True


class PromptPreviewRequest(BaseModel):
    """Request schema for prompt preview."""
    template: str = Field(..., description="Prompt template to preview")
    variables: Dict[str, str] = Field(..., description="Variable values for substitution")


class PromptPreviewResponse(BaseModel):
    """Response schema for prompt preview."""
    rendered_prompt: str
    variable_count: int
    missing_variables: List[str] = []


# ============================================================================
# Helper Functions
# ============================================================================

def extract_variables_from_template(template: str) -> List[str]:
    """Extract {variable} placeholders from template."""
    pattern = r"\{(\w+)\}"
    return list(set(re.findall(pattern, template)))


def render_template(template: str, variables: Dict[str, str]) -> tuple[str, List[str]]:
    """Render template with variables. Returns (rendered, missing_vars)."""
    template_vars = extract_variables_from_template(template)
    missing = [v for v in template_vars if v not in variables]

    rendered = template
    for var_name, var_value in variables.items():
        rendered = rendered.replace(f"{{{var_name}}}", var_value)

    return rendered, missing


# ============================================================================
# API Routes - CRUD Operations
# ============================================================================

@router.get("/", response_model=List[PromptResponse])
async def list_prompts(
    function_type: Optional[str] = Query(None, description="Filter by function type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all prompt templates with optional filters.

    Query Parameters:
    - function_type: Filter by function type (summarization, extraction, etc.)
    - is_active: Filter by active status

    Permissions: ADMIN_GENAI_VIEW
    """
    query = db.query(Prompt)

    if function_type:
        query = query.filter(Prompt.function_type == function_type)

    if is_active is not None:
        query = query.filter(Prompt.is_active == is_active)

    prompts = query.order_by(Prompt.created_at.desc()).all()

    return prompts


@router.post("/", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt(
    payload: PromptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Create a new prompt template with variables.

    The template can include {variable} placeholders that will be substituted at runtime.

    Permissions: ADMIN_GENAI_EDIT
    """
    # Check for duplicate name
    existing = db.query(Prompt).filter(
        and_(
            Prompt.name == payload.name,
            Prompt.function_type == payload.function_type
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Prompt '{payload.name}' already exists for function type '{payload.function_type}'"
        )

    # Extract variables from template
    template_vars = extract_variables_from_template(payload.template)

    # Validate that all declared variables are in template
    declared_vars = {v.name for v in payload.variables}
    extra_vars = declared_vars - set(template_vars)
    if extra_vars:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Variables {extra_vars} declared but not used in template"
        )

    # Create prompt
    prompt = Prompt(
        name=payload.name,
        function_type=payload.function_type,
        template=payload.template,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        version=1,
        is_active=True,
        created_by_id=current_user.id
    )

    db.add(prompt)
    db.flush()  # Get prompt.id without committing

    # Add variables
    for var_data in payload.variables:
        variable = PromptVariable(
            prompt_id=prompt.id,
            **var_data.model_dump()
        )
        db.add(variable)

    db.commit()
    db.refresh(prompt)

    return prompt


@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Get specific prompt template by ID.

    Includes all variables and metadata.

    Permissions: ADMIN_GENAI_VIEW
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    return prompt


@router.patch("/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: int,
    payload: PromptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Update prompt template.

    Note: Updating the template or core parameters creates a new version.

    Permissions: ADMIN_GENAI_EDIT
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    # Track if we need to increment version
    increment_version = False

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)

    # Check if template changed (requires version increment)
    if "template" in update_data and update_data["template"] != prompt.template:
        increment_version = True

    # Check if temperature or max_tokens changed (requires version increment)
    if ("temperature" in update_data and update_data["temperature"] != prompt.temperature) or \
       ("max_tokens" in update_data and update_data["max_tokens"] != prompt.max_tokens):
        increment_version = True

    for field, value in update_data.items():
        setattr(prompt, field, value)

    if increment_version:
        prompt.version += 1

    prompt.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(prompt)

    return prompt


@router.delete("/{prompt_id}")
async def delete_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Delete prompt template.

    This will cascade delete all associated variables.

    Permissions: ADMIN_GENAI_EDIT
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    db.delete(prompt)
    db.commit()

    return {"message": f"Prompt '{prompt.name}' deleted successfully"}


# ============================================================================
# API Routes - Variable Management
# ============================================================================

@router.get("/{prompt_id}/variables", response_model=List[PromptVariableResponse])
async def list_prompt_variables(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all variables for a specific prompt.

    Permissions: ADMIN_GENAI_VIEW
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    return prompt.variables


@router.post("/{prompt_id}/variables", response_model=PromptVariableResponse, status_code=status.HTTP_201_CREATED)
async def add_prompt_variable(
    prompt_id: int,
    payload: PromptVariableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Add a new variable to a prompt.

    Note: The variable must exist as a {placeholder} in the template.

    Permissions: ADMIN_GENAI_EDIT
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    # Check if variable already exists
    existing_var = db.query(PromptVariable).filter(
        and_(
            PromptVariable.prompt_id == prompt_id,
            PromptVariable.name == payload.name
        )
    ).first()

    if existing_var:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Variable '{payload.name}' already exists for this prompt"
        )

    # Validate that variable exists in template
    template_vars = extract_variables_from_template(prompt.template)
    if payload.name not in template_vars:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Variable '{payload.name}' not found in template. Available: {template_vars}"
        )

    variable = PromptVariable(
        prompt_id=prompt_id,
        **payload.model_dump()
    )

    db.add(variable)
    db.commit()
    db.refresh(variable)

    return variable


@router.patch("/{prompt_id}/variables/{variable_id}", response_model=PromptVariableResponse)
async def update_prompt_variable(
    prompt_id: int,
    variable_id: int,
    payload: PromptVariableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Update a prompt variable.

    Permissions: ADMIN_GENAI_EDIT
    """
    variable = db.query(PromptVariable).filter(
        and_(
            PromptVariable.id == variable_id,
            PromptVariable.prompt_id == prompt_id
        )
    ).first()

    if not variable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Variable with ID {variable_id} not found for prompt {prompt_id}"
        )

    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(variable, field, value)

    db.commit()
    db.refresh(variable)

    return variable


@router.delete("/{prompt_id}/variables/{variable_id}")
async def delete_prompt_variable(
    prompt_id: int,
    variable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_EDIT.value))
):
    """
    Delete a prompt variable.

    Permissions: ADMIN_GENAI_EDIT
    """
    variable = db.query(PromptVariable).filter(
        and_(
            PromptVariable.id == variable_id,
            PromptVariable.prompt_id == prompt_id
        )
    ).first()

    if not variable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Variable with ID {variable_id} not found for prompt {prompt_id}"
        )

    db.delete(variable)
    db.commit()

    return {"message": f"Variable '{variable.name}' deleted successfully"}


# ============================================================================
# API Routes - Preview & Testing
# ============================================================================

@router.post("/preview", response_model=PromptPreviewResponse)
async def preview_prompt(
    payload: PromptPreviewRequest,
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    Preview a prompt template with variable substitution.

    Useful for testing prompts before saving them.

    Permissions: ADMIN_GENAI_VIEW
    """
    rendered, missing = render_template(payload.template, payload.variables)

    template_vars = extract_variables_from_template(payload.template)

    return PromptPreviewResponse(
        rendered_prompt=rendered,
        variable_count=len(template_vars),
        missing_variables=missing
    )


# ============================================================================
# API Routes - Versioning
# ============================================================================

@router.get("/{prompt_id}/versions", response_model=List[PromptResponse])
async def list_prompt_versions(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ADMIN_GENAI_VIEW.value))
):
    """
    List all versions of a prompt (same name, different versions).

    Note: This returns all prompts with the same name and function_type.

    Permissions: ADMIN_GENAI_VIEW
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found"
        )

    # Find all prompts with same name and function_type
    versions = db.query(Prompt).filter(
        and_(
            Prompt.name == prompt.name,
            Prompt.function_type == prompt.function_type
        )
    ).order_by(Prompt.version.desc()).all()

    return versions
