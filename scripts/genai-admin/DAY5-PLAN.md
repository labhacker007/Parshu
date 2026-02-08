# Day 5: Guardrails Management Backend - Implementation Plan

## Overview

Build a complete Guardrails Management API with CRUD operations, multi-layer validation (input/output), and prompt-level associations.

**Research Findings:**
- ✅ **Guardrails:** Essential for production GenAI (PII detection, prompt injection, hallucination checks, cost controls)
- ❌ **Skills:** Obsolete concept replaced by native function calling in modern LLMs
- **Decision:** Implement Guardrails only, skip Skills entirely

## Database Schema (Already exists in models.py)

```python
class PromptGuardrail(Base):
    """Guardrails for validating prompt inputs/outputs."""
    __tablename__ = "prompt_guardrails"

    id = Column(Integer, primary_key=True, index=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    guardrail_type = Column(String(50), nullable=False, index=True)
    validation_rule = Column(JSON, nullable=False)
    error_message = Column(Text)
    is_active = Column(Boolean, default=True, index=True)
    severity = Column(String(20), default="error")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    prompt = relationship("Prompt", back_populates="guardrails")
```

## Guardrail Types & Validation Rules

### 1. Input Guardrails (Validate user input before LLM)

```python
GUARDRAIL_TYPES = {
    # Input validation
    "pii_detection": {
        "description": "Detect and block PII (emails, phone numbers, SSN, credit cards)",
        "validation_rule": {
            "patterns": ["email", "phone", "ssn", "credit_card"],
            "action": "block" | "redact" | "warn"
        }
    },

    "prompt_injection": {
        "description": "Detect prompt injection attacks",
        "validation_rule": {
            "keywords": ["ignore previous", "system:", "admin mode", "jailbreak"],
            "action": "block" | "warn"
        }
    },

    "input_length": {
        "description": "Enforce input length limits",
        "validation_rule": {
            "min_length": 10,
            "max_length": 10000,
            "max_tokens": 4000
        }
    },

    "profanity_filter": {
        "description": "Block offensive language",
        "validation_rule": {
            "wordlist": ["offensive", "words"],
            "action": "block" | "redact"
        }
    },

    # Output validation
    "hallucination_check": {
        "description": "Validate output against source content",
        "validation_rule": {
            "similarity_threshold": 0.7,
            "require_citations": True
        }
    },

    "toxicity_filter": {
        "description": "Block toxic/harmful outputs",
        "validation_rule": {
            "toxicity_threshold": 0.8,
            "categories": ["hate", "violence", "sexual", "self-harm"]
        }
    },

    "format_validation": {
        "description": "Enforce output format (JSON, markdown, etc.)",
        "validation_rule": {
            "format": "json" | "markdown" | "text",
            "schema": {}  # JSONSchema for JSON outputs
        }
    },

    # Business rules
    "rate_limit": {
        "description": "Limit API calls per user/time",
        "validation_rule": {
            "max_calls_per_minute": 10,
            "max_calls_per_day": 1000
        }
    },

    "cost_limit": {
        "description": "Cap token usage costs",
        "validation_rule": {
            "max_tokens_per_request": 2000,
            "max_cost_per_day_usd": 50.0
        }
    }
}
```

## API Endpoints to Implement

### 1. Guardrail CRUD Operations

**File:** `backend/app/admin/guardrails.py`

```
GET    /admin/guardrails/                           - List all guardrails (with filters)
POST   /admin/guardrails/                           - Create new guardrail
GET    /admin/guardrails/{guardrail_id}             - Get specific guardrail
PATCH  /admin/guardrails/{guardrail_id}             - Update guardrail
DELETE /admin/guardrails/{guardrail_id}             - Delete guardrail
```

### 2. Prompt-Level Guardrails

```
GET    /admin/prompts/{prompt_id}/guardrails        - List guardrails for prompt
POST   /admin/prompts/{prompt_id}/guardrails        - Add guardrail to prompt
PATCH  /admin/prompts/{prompt_id}/guardrails/{id}   - Update prompt guardrail
DELETE /admin/prompts/{prompt_id}/guardrails/{id}   - Remove guardrail from prompt
```

### 3. Guardrail Testing & Validation

```
POST   /admin/guardrails/test                       - Test guardrail against sample input
GET    /admin/guardrails/types                      - List available guardrail types
POST   /admin/guardrails/validate                   - Validate input against all active guardrails
```

## Pydantic Schemas

```python
class GuardrailValidationRule(BaseModel):
    """Flexible validation rule structure."""
    # For PII detection
    patterns: Optional[List[str]] = None
    action: Optional[str] = Field(None, pattern=r"^(block|redact|warn)$")

    # For prompt injection
    keywords: Optional[List[str]] = None

    # For length limits
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    max_tokens: Optional[int] = None

    # For hallucination check
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    require_citations: Optional[bool] = None

    # For toxicity filter
    toxicity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    categories: Optional[List[str]] = None

    # For format validation
    format: Optional[str] = None
    schema: Optional[Dict] = None

    # For rate limiting
    max_calls_per_minute: Optional[int] = None
    max_calls_per_day: Optional[int] = None

    # For cost limits
    max_tokens_per_request: Optional[int] = None
    max_cost_per_day_usd: Optional[float] = None


class GuardrailBase(BaseModel):
    """Base schema for guardrails."""
    guardrail_type: str = Field(..., description="Type of guardrail (pii_detection, prompt_injection, etc.)")
    validation_rule: GuardrailValidationRule = Field(..., description="Validation rule configuration")
    error_message: Optional[str] = Field(None, description="Custom error message when validation fails")
    severity: str = Field("error", pattern=r"^(info|warning|error|critical)$", description="Severity level")
    is_active: bool = Field(True, description="Whether guardrail is active")


class GuardrailCreate(GuardrailBase):
    """Schema for creating a guardrail."""
    prompt_id: int = Field(..., description="Prompt to attach guardrail to")


class GuardrailUpdate(BaseModel):
    """Schema for updating a guardrail."""
    validation_rule: Optional[GuardrailValidationRule] = None
    error_message: Optional[str] = None
    severity: Optional[str] = Field(None, pattern=r"^(info|warning|error|critical)$")
    is_active: Optional[bool] = None


class GuardrailResponse(GuardrailBase):
    """Response schema for guardrail."""
    id: int
    prompt_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GuardrailTestRequest(BaseModel):
    """Request schema for testing guardrail."""
    guardrail_type: str
    validation_rule: GuardrailValidationRule
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
    example_rule: Dict


class GuardrailValidationRequest(BaseModel):
    """Request to validate input against guardrails."""
    prompt_id: int
    input_text: str


class GuardrailValidationResponse(BaseModel):
    """Response from guardrail validation."""
    passed: bool
    violations: List[Dict[str, Any]] = []  # [{type, message, severity}]
    sanitized_input: Optional[str] = None
```

## Implementation Steps

### Step 1: Create Guardrails API File (40 min)
- Create `backend/app/admin/guardrails.py`
- Implement all CRUD endpoints
- Add prompt-level guardrail management
- Add validation/testing endpoints

### Step 2: Add Router to main.py (5 min)
- Import guardrails router
- Register with app

### Step 3: Create Validation Service (30 min)
- Create `backend/app/services/guardrail_validator.py`
- Implement PII detection (regex-based)
- Implement prompt injection detection
- Implement length validation
- Implement profanity filter
- (Future: integrate LlamaGuard or OpenAI moderation API)

### Step 4: Create Test Suite (40 min)
- Create `scripts/genai-admin/test_day5.py`
- Test CRUD operations
- Test prompt-level guardrail attachment
- Test validation logic for each guardrail type
- Test edge cases (invalid rules, conflicts, etc.)

### Step 5: Create Automation Scripts (20 min)
- Create production-ready-day5.bat
- Add sample guardrails seed data

### Step 6: Test & Validate (20 min)
- Run comprehensive test suite
- Verify all endpoints work
- Check edge cases

## Test Coverage

### Critical Test Cases
1. Create guardrail with PII detection
2. Create guardrail with prompt injection protection
3. Attach multiple guardrails to same prompt
4. Test guardrail validation (passing case)
5. Test guardrail validation (failing case)
6. Update guardrail rule
7. Toggle guardrail active status
8. Delete guardrail
9. List guardrails by type
10. Test invalid guardrail type (should fail)
11. Test invalid validation rule (should fail)
12. Test guardrail ordering/priority
13. Test unauthorized access
14. Test multiple violations in one input
15. Test guardrail with redaction action

## Expected Test Results

```
Passed: 15/15
- Login
- List guardrails (empty)
- Create PII detection guardrail
- Create prompt injection guardrail
- Create rate limit guardrail
- Get guardrail details
- Update guardrail rule
- List prompt guardrails
- Test guardrail validation (pass)
- Test guardrail validation (fail)
- Test multiple violations
- Test redaction action
- Delete guardrail
- 404 error handling
- Unauthorized access blocked
```

## Success Criteria

✅ All 15 tests passing
✅ CRUD operations working
✅ Prompt-level guardrail association working
✅ Validation logic working (PII, injection, length, profanity)
✅ RBAC enforced (admin only)
✅ Proper error handling
✅ No database schema changes needed (already exists)

## Estimated Time

- Planning: 20 min ✅ (this file)
- Implementation: 110 min (~2 hours)
- Testing: 40 min
- Bug fixes: 30 min
- **Total: ~3.5 hours**

## Integration with Previous Days

- **Day 3:** Guardrails link to GenAI Functions via Prompts
- **Day 4:** Guardrails attach to specific Prompt templates
- **Flow:** Function → uses Prompt → has Guardrails → validate input/output

```python
# Usage flow
function = GenAIFunctionConfig.get(name="summarization")
prompt = function.active_prompt
guardrails = prompt.guardrails

# Before LLM call
for guardrail in guardrails:
    if guardrail.is_input_type():
        validate_input(user_input, guardrail)

# After LLM response
for guardrail in guardrails:
    if guardrail.is_output_type():
        validate_output(llm_response, guardrail)
```

## Sample Guardrails to Seed

```python
SAMPLE_GUARDRAILS = [
    {
        "prompt_id": 1,  # Summarization prompt
        "guardrail_type": "pii_detection",
        "validation_rule": {
            "patterns": ["email", "phone", "ssn"],
            "action": "redact"
        },
        "error_message": "PII detected in input and has been redacted",
        "severity": "warning"
    },
    {
        "prompt_id": 1,
        "guardrail_type": "input_length",
        "validation_rule": {
            "min_length": 10,
            "max_length": 50000,
            "max_tokens": 10000
        },
        "error_message": "Input exceeds maximum length",
        "severity": "error"
    },
    {
        "prompt_id": 1,
        "guardrail_type": "prompt_injection",
        "validation_rule": {
            "keywords": ["ignore previous", "system:", "admin mode"],
            "action": "block"
        },
        "error_message": "Potential prompt injection detected",
        "severity": "critical"
    },
    {
        "prompt_id": 1,
        "guardrail_type": "toxicity_filter",
        "validation_rule": {
            "toxicity_threshold": 0.8,
            "categories": ["hate", "violence"]
        },
        "error_message": "Toxic content detected in output",
        "severity": "error"
    }
]
```

## Next: Day 6

After Day 5 is production-ready:
- Day 6-7: Frontend UI for GenAI Admin (single page with tabs: Functions, Prompts, Guardrails, Models)

## Why Skip Skills?

**Research Summary:**
- Skills were relevant in older chatbot frameworks (Alexa Skills, Dialogflow Intents)
- Modern LLMs (GPT-4, Claude, Llama) have native **function calling** which replaces Skills entirely
- Function calling offers:
  - Structured outputs via JSONSchema
  - Type validation
  - No token waste on skill descriptions
  - Native integration with OpenAI/Anthropic/Ollama APIs
- Adding a "Skills" layer would be redundant with our Prompts system
- **Verdict:** Not worth implementing. Use Prompts + Function Calling instead.

---

**Status:** Planning complete, ready for implementation
**Created:** 2026-02-08
**Lazy Engineer Mode:** ✅ Activated
**Architecture Decision:** Guardrails only, no Skills (based on research)
