# Day 4: Prompt Management Backend - Implementation Plan

## Overview

Build a complete Prompt Management API with CRUD operations, versioning, variable substitution, and template management.

## Database Schema (Already exists in models.py)

```python
class Prompt(Base):
    """Versioned prompt templates for GenAI functions."""
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    function_type = Column(String(50), nullable=False, index=True)
    template = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True, index=True)

    # GenAI parameters
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=500)

    # Metadata
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    variables = relationship("PromptVariable", back_populates="prompt", cascade="all, delete-orphan")
    skills = relationship("PromptSkill", back_populates="prompt", cascade="all, delete-orphan")
    guardrails = relationship("PromptGuardrail", back_populates="prompt", cascade="all, delete-orphan")


class PromptVariable(Base):
    """Variables used in prompt templates."""
    __tablename__ = "prompt_variables"

    id = Column(Integer, primary_key=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    variable_name = Column(String(100), nullable=False)
    description = Column(Text)
    default_value = Column(Text)
    is_required = Column(Boolean, default=True)
```

## API Endpoints to Implement

### 1. Prompt CRUD Operations

**File:** `backend/app/admin/prompts.py`

```
GET    /admin/prompts/                     - List all prompts (with filters)
POST   /admin/prompts/                     - Create new prompt
GET    /admin/prompts/{prompt_id}          - Get specific prompt
PATCH  /admin/prompts/{prompt_id}          - Update prompt
DELETE /admin/prompts/{prompt_id}          - Delete prompt
```

### 2. Prompt Versioning

```
GET    /admin/prompts/{prompt_id}/versions - List all versions of a prompt
POST   /admin/prompts/{prompt_id}/versions - Create new version (duplicate + increment)
POST   /admin/prompts/{prompt_id}/activate - Set as active version
GET    /admin/prompts/{prompt_id}/diff     - Compare two versions
```

### 3. Prompt Variables

```
GET    /admin/prompts/{prompt_id}/variables       - List variables
POST   /admin/prompts/{prompt_id}/variables       - Add variable
PATCH  /admin/prompts/{prompt_id}/variables/{id}  - Update variable
DELETE /admin/prompts/{prompt_id}/variables/{id}  - Delete variable
```

### 4. Prompt Testing & Preview

```
POST   /admin/prompts/preview              - Preview prompt with sample variables
POST   /admin/prompts/test                 - Test prompt execution with GenAI
```

## Pydantic Schemas

```python
class PromptVariableBase(BaseModel):
    variable_name: str
    description: Optional[str] = None
    default_value: Optional[str] = None
    is_required: bool = True

class PromptVariableCreate(PromptVariableBase):
    pass

class PromptVariableResponse(PromptVariableBase):
    id: int
    prompt_id: int

    class Config:
        from_attributes = True


class PromptBase(BaseModel):
    name: str
    function_type: str
    template: str
    temperature: float = 0.7
    max_tokens: int = 500

class PromptCreate(PromptBase):
    variables: List[PromptVariableCreate] = []

class PromptUpdate(BaseModel):
    name: Optional[str] = None
    template: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None

class PromptResponse(PromptBase):
    id: int
    version: int
    is_active: bool
    created_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    variables: List[PromptVariableResponse] = []

    class Config:
        from_attributes = True


class PromptPreviewRequest(BaseModel):
    template: str
    variables: Dict[str, str]

class PromptPreviewResponse(BaseModel):
    rendered_prompt: str
    variable_count: int
    missing_variables: List[str] = []
```

## Implementation Steps

### Step 1: Create Prompts API File (30 min)
- Create `backend/app/admin/prompts.py`
- Implement all CRUD endpoints
- Add versioning endpoints
- Add variable management endpoints

### Step 2: Add Router to main.py (5 min)
- Import prompts router
- Register with app

### Step 3: Create Test Suite (30 min)
- Create `scripts/genai-admin/test_day4.py`
- Test CRUD operations
- Test versioning workflow
- Test variable management
- Test preview/rendering

### Step 4: Create Automation Scripts (20 min)
- Update toolkit.sh with day4 command
- Create production-ready-day4.sh
- Create seed data script for sample prompts

### Step 5: Test & Validate (15 min)
- Run comprehensive test suite
- Verify all endpoints work
- Check edge cases

## Test Coverage

### Critical Test Cases
1. Create prompt with variables
2. Update prompt (should increment version)
3. List prompts with filters (by function_type, is_active)
4. Get prompt with all relationships loaded
5. Delete prompt (cascade delete variables)
6. Create new version of existing prompt
7. Activate specific version
8. Preview prompt with variable substitution
9. Handle missing required variables
10. Test unauthorized access

## Expected Test Results

```
Passed: 15/15
- Login
- List prompts (empty)
- Create prompt with variables
- Get prompt details
- Update prompt (version increments)
- List prompts (1 result)
- List prompt versions
- Create new version
- Activate version
- List variables
- Add variable
- Update variable
- Delete variable
- Preview prompt
- Delete prompt
```

## Success Criteria

✅ All 15 tests passing
✅ CRUD operations working
✅ Versioning working (auto-increment)
✅ Variable substitution working
✅ RBAC enforced (admin only)
✅ Proper error handling
✅ No database schema changes needed (already exists)

## Estimated Time

- Planning: 15 min ✅ (this file)
- Implementation: 90 min
- Testing: 30 min
- Bug fixes: 30 min
- **Total: ~3 hours**

## Integration with Day 3

Prompts will link to GenAI Functions via:
```python
# In GenAIFunctionConfig
active_prompt_id = Column(Integer, ForeignKey("prompts.id"))
```

This allows each function to have an active prompt template that defines how it interacts with the GenAI model.

## Sample Prompts to Seed

```python
SAMPLE_PROMPTS = [
    {
        "name": "article_summarization_executive",
        "function_type": "summarization",
        "template": """Provide a concise executive summary of the following article.

Article Title: {title}
Article Content: {content}

Focus on:
- Main topic and key points
- Critical insights
- Actionable takeaways

Keep it under 3 sentences.""",
        "temperature": 0.7,
        "max_tokens": 500,
        "variables": [
            {"variable_name": "title", "description": "Article title", "is_required": True},
            {"variable_name": "content", "description": "Article content", "is_required": True}
        ]
    },
    {
        "name": "article_summarization_technical",
        "function_type": "summarization",
        "template": """Provide a detailed technical summary of the following article.

Article: {content}

Include:
- Technical details and methodologies
- Key findings and data points
- Implications and future considerations

Be thorough and technical.""",
        "temperature": 0.5,
        "max_tokens": 1000,
        "variables": [
            {"variable_name": "content", "description": "Article content", "is_required": True}
        ]
    }
]
```

## Next: Day 5

After Day 4 is production-ready:
- Day 5: Skills & Guardrails Management
- Day 6-7: Frontend UI for GenAI Admin

---

**Status:** Planning complete, ready for implementation
**Created:** 2026-02-08
**Lazy Engineer Mode:** ✅ Activated
