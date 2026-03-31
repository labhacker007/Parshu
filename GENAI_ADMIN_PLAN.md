# GenAI Admin Management System - Implementation Plan

## Executive Summary

This plan outlines the implementation of a **no-code GenAI management system** for Jyoti that allows admins to:
- Install Ollama locally with one click
- Configure which model to use for each GenAI function
- Create, edit, and delete prompts/skills/guardrails without coding
- Preview final prompts before execution
- Monitor cost and performance

**Timeline:** 5-7 days
**Research Sources:** Industry best practices from 2026 prompt management platforms

---

## Research Findings

### Best Practices for Prompt Management (2026)

Based on research from leading platforms ([Braintrust](https://www.braintrust.dev/articles/best-prompt-management-tools-2026), [Agenta](https://agenta.ai/blog/the-definitive-guide-to-prompt-management-systems), [Langfuse](https://langfuse.com/docs/prompt-management/overview)):

1. **Centralize Early**: Store all prompts in database, not scattered in code
2. **Version Everything**: Track all changes with commit history and rollback capability
3. **Enable Non-Technical Users**: Visual interfaces for business users to edit prompts
4. **Record Metadata**: Store model, temperature, max_tokens with each prompt version
5. **Monitor Production**: Track token usage, response quality, user satisfaction
6. **Collaboration**: Allow product managers and domain experts to contribute

### Guardrails Integration

From [LangChain Guardrails](https://guardrailsai.com/docs/integrations/langchain) and [NVIDIA NeMo](https://developer.nvidia.com/blog/building-safer-llm-apps-with-langchain-templates-and-nvidia-nemo-guardrails/):

- **Structural Validation**: Ensure outputs match expected format (JSON, lists, etc.)
- **Quality Constraints**: Check for toxicity, PII, hallucinations
- **Corrective Actions**: Retry with modified prompts or fix outputs automatically
- **Moderation Rails**: Control user input and LLM output

### Ollama Automation

From [Ollama Docker Hub](https://hub.docker.com/r/ollama/ollama) and [Collabnix Guide](https://collabnix.com/getting-started-with-ollama-and-docker/):

- **Docker-based**: Simple `docker run` command or Docker Compose
- **GPU Support**: `--gpus all` flag for NVIDIA GPUs
- **Model Management**: Download models via API or CLI
- **Port 11434**: Standard Ollama API port

### Cost-Effective UI Patterns

From [Flowise](https://clickup.com/blog/prompt-engineering-tools/) and [No-Code Builders](https://emergent.sh/learn/best-no-code-web-app-builders):

- **Visual Workflow Builder**: Drag-and-drop nodes for prompt chaining
- **Form-Based Editing**: Fill out fields instead of writing code
- **Template Library**: Pre-built prompts for common use cases
- **Preview & Test**: See results before deploying to production

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin UI (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Ollama Setup │  │ Model Config │  │ Prompt Editor│     │
│  │  (One-Click) │  │  (Functions) │  │ (WYSIWYG)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Ollama       │  │ Prompt       │  │ GenAI        │     │
│  │ Orchestrator │  │ Manager      │  │ Executor     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ prompts      │  │ skills       │  │ guardrails   │     │
│  │ (versioned)  │  │ (reusable)   │  │ (validators) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. Prompts Table (Versioned)

```python
class Prompt(Base):
    """Versioned prompt templates."""
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # e.g., "Executive Summary"
    description = Column(Text)  # What this prompt does
    function_type = Column(String(50), nullable=False)  # "summarization", "ioc_extraction", etc.

    # Template with variables
    template = Column(Text, nullable=False)  # e.g., "Summarize: {title}\n{content}"

    # Version control
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    parent_id = Column(Integer, ForeignKey("prompts.id"), nullable=True)  # Previous version

    # Metadata
    model_id = Column(String(100))  # e.g., "gpt-4o-mini", "llama3.2"
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=500)

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Tags for organization
    tags = Column(JSON)  # ["cybersecurity", "executive"]

    # Relationships
    skills = relationship("PromptSkill", back_populates="prompt")
    guardrails = relationship("PromptGuardrail", back_populates="prompt")


class PromptVariable(Base):
    """Variables used in prompt templates."""
    __tablename__ = "prompt_variables"

    id = Column(Integer, primary_key=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id", ondelete="CASCADE"))
    name = Column(String(50), nullable=False)  # "title", "content", "persona"
    type = Column(String(20), default="string")  # string, number, boolean, array
    default_value = Column(Text)
    description = Column(Text)  # Help text for admin
    is_required = Column(Boolean, default=True)


class Skill(Base):
    """Reusable skills/instructions for prompts."""
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # e.g., "Cybersecurity Analyst"
    description = Column(Text)

    # The actual skill instruction
    instruction = Column(Text, nullable=False)
    # e.g., "You are a cybersecurity analyst with 10 years experience. Focus on IOCs."

    # Categorization
    category = Column(String(50))  # "persona", "formatting", "domain_expertise"

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Guardrail(Base):
    """Validation rules for LLM outputs."""
    __tablename__ = "guardrails"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # e.g., "No PII"
    description = Column(Text)

    # Guardrail type
    type = Column(String(50), nullable=False)
    # Types: "length", "toxicity", "pii", "format", "keywords_required", "keywords_forbidden"

    # Configuration (JSON)
    config = Column(JSON, nullable=False)
    # Examples:
    #   {"min_length": 50, "max_length": 500}
    #   {"forbidden_keywords": ["password", "ssn"]}
    #   {"required_format": "json"}

    # Action on failure
    action = Column(String(20), default="retry")  # "retry", "reject", "fix", "log"
    max_retries = Column(Integer, default=2)

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class PromptSkill(Base):
    """Many-to-many: Prompts <-> Skills."""
    __tablename__ = "prompt_skills"

    id = Column(Integer, primary_key=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id", ondelete="CASCADE"))
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"))
    order = Column(Integer, default=0)  # Order in which skills are applied

    prompt = relationship("Prompt", back_populates="skills")
    skill = relationship("Skill")


class PromptGuardrail(Base):
    """Many-to-many: Prompts <-> Guardrails."""
    __tablename__ = "prompt_guardrails"

    id = Column(Integer, primary_key=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id", ondelete="CASCADE"))
    guardrail_id = Column(Integer, ForeignKey("guardrails.id", ondelete="CASCADE"))
    order = Column(Integer, default=0)  # Order in which guardrails are checked

    prompt = relationship("Prompt", back_populates="guardrails")
    guardrail = relationship("Guardrail")


class GenAIFunctionConfig(Base):
    """Configuration for each GenAI function."""
    __tablename__ = "genai_function_configs"

    id = Column(Integer, primary_key=True)
    function_name = Column(String(100), unique=True, nullable=False)
    # e.g., "executive_summary", "technical_summary", "ioc_extraction", "qa_chat"

    display_name = Column(String(100))  # "Executive Summary"
    description = Column(Text)

    # Active prompt for this function
    active_prompt_id = Column(Integer, ForeignKey("prompts.id"))

    # Model assignment
    primary_model_id = Column(String(100))  # Can override global primary
    secondary_model_id = Column(String(100))  # Fallback

    # Cost tracking
    total_requests = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    total_cost = Column(Float, default=0.0)

    # Audit
    updated_by_id = Column(Integer, ForeignKey("users.id"))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PromptExecutionLog(Base):
    """Log every prompt execution for debugging."""
    __tablename__ = "prompt_execution_logs"

    id = Column(Integer, primary_key=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"))
    function_name = Column(String(100))

    # Input
    input_variables = Column(JSON)  # {"title": "...", "content": "..."}
    final_prompt = Column(Text)  # The actual prompt sent to LLM

    # Model
    model_used = Column(String(100))
    temperature = Column(Float)
    max_tokens = Column(Integer)

    # Output
    response = Column(Text)
    tokens_used = Column(Integer)
    cost = Column(Float)

    # Guardrails
    guardrails_passed = Column(Boolean, default=True)
    guardrail_failures = Column(JSON)  # List of failed guardrails
    retry_count = Column(Integer, default=0)

    # Timing
    execution_time_ms = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # User
    user_id = Column(Integer, ForeignKey("users.id"))
```

---

## Feature 1: One-Click Ollama Installation

### UI Design

**Location:** Admin Settings → GenAI → Ollama Setup

```
┌────────────────────────────────────────────────────────────┐
│  Ollama Local LLM Setup                                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ○ Not Installed                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Install Ollama Locally                             │  │
│  │  • Runs on your hardware (free)                     │  │
│  │  • Complete privacy (no data leaves your server)   │  │
│  │  • Supports: llama3.2, mistral, phi3, etc.         │  │
│  │                                                      │  │
│  │  [Install Ollama] (button)                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  After Installation:                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Available Models:                                   │  │
│  │  [ ] llama3.2:3b (Recommended - 2GB)                │  │
│  │  [ ] llama3.2:8b (Better quality - 5GB)             │  │
│  │  [ ] mistral:7b (Fast - 4GB)                        │  │
│  │  [ ] phi3:mini (Lightweight - 2GB)                  │  │
│  │                                                      │  │
│  │  [Download Selected Models]                          │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Backend Implementation

**NEW FILE:** `backend/app/admin/ollama_setup.py`

```python
"""One-click Ollama installation and management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import User
import subprocess
import httpx
import asyncio
from typing import List, Dict

router = APIRouter(prefix="/admin/ollama", tags=["admin-ollama"])


class OllamaOrchestrator:
    """Manages Ollama installation and lifecycle."""

    def __init__(self):
        self.ollama_url = "http://localhost:11434"
        self.docker_image = "ollama/ollama:latest"

    async def check_status(self) -> Dict:
        """Check if Ollama is running."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.ollama_url}/api/tags", timeout=5.0)
                if response.status_code == 200:
                    return {
                        "status": "running",
                        "models": response.json().get("models", [])
                    }
        except Exception:
            pass

        return {"status": "not_running", "models": []}

    async def install_via_docker(self) -> Dict:
        """Install Ollama using Docker Compose."""
        try:
            # Check if Docker is available
            result = subprocess.run(
                ["docker", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode != 0:
                return {
                    "success": False,
                    "error": "Docker is not installed. Please install Docker first."
                }

            # Create Ollama container
            cmd = [
                "docker", "run", "-d",
                "--name", "ollama",
                "-v", "ollama:/root/.ollama",
                "-p", "11434:11434",
                "--restart", "unless-stopped",
                self.docker_image
            ]

            # Add GPU support if available
            gpu_check = subprocess.run(
                ["docker", "run", "--rm", "--gpus", "all", "nvidia/cuda:11.0-base", "nvidia-smi"],
                capture_output=True,
                timeout=10
            )
            if gpu_check.returncode == 0:
                cmd.insert(3, "--gpus")
                cmd.insert(4, "all")

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            if result.returncode != 0:
                # Container might already exist
                if "already in use" in result.stderr:
                    # Start existing container
                    subprocess.run(["docker", "start", "ollama"], timeout=10)
                    return {"success": True, "message": "Ollama container started"}

                return {
                    "success": False,
                    "error": f"Failed to create container: {result.stderr}"
                }

            # Wait for Ollama to be ready
            await asyncio.sleep(5)

            return {
                "success": True,
                "message": "Ollama installed and running",
                "container_id": result.stdout.strip()
            }

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Docker command timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def download_model(self, model_name: str) -> Dict:
        """Download an Ollama model."""
        try:
            # Use Ollama API to pull model
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/pull",
                    json={"name": model_name}
                )

                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": f"Model {model_name} downloaded successfully"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed to download model: {response.text}"
                    }

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_available_models(self) -> List[Dict]:
        """List recommended Ollama models."""
        return [
            {
                "name": "llama3.2:3b",
                "display_name": "Llama 3.2 3B (Recommended)",
                "size": "2GB",
                "description": "Fast and efficient for most tasks",
                "recommended": True
            },
            {
                "name": "llama3.2:8b",
                "display_name": "Llama 3.2 8B",
                "size": "5GB",
                "description": "Better quality, requires more RAM"
            },
            {
                "name": "mistral:7b",
                "display_name": "Mistral 7B",
                "size": "4GB",
                "description": "Fast inference, good for code"
            },
            {
                "name": "phi3:mini",
                "display_name": "Phi-3 Mini",
                "size": "2GB",
                "description": "Microsoft's lightweight model"
            },
            {
                "name": "llama3.2:1b",
                "display_name": "Llama 3.2 1B (Ultra Lightweight)",
                "size": "1GB",
                "description": "Smallest model, runs on any hardware"
            }
        ]


# Singleton
_ollama_orchestrator = OllamaOrchestrator()


@router.get("/status")
async def get_ollama_status(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value))
):
    """Check if Ollama is installed and running."""
    status = await _ollama_orchestrator.check_status()
    return status


@router.post("/install")
async def install_ollama(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value))
):
    """Install Ollama using Docker (one-click)."""
    result = await _ollama_orchestrator.install_via_docker()
    return result


@router.get("/models/available")
async def list_available_models(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value))
):
    """List recommended Ollama models for download."""
    models = await _ollama_orchestrator.list_available_models()
    return {"models": models}


@router.post("/models/download")
async def download_model(
    model_name: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value))
):
    """Download an Ollama model."""
    result = await _ollama_orchestrator.download_model(model_name)
    return result


@router.get("/models/installed")
async def list_installed_models(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value))
):
    """List currently installed Ollama models."""
    status = await _ollama_orchestrator.check_status()
    return {"models": status.get("models", [])}


@router.delete("/models/{model_name}")
async def delete_model(
    model_name: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value))
):
    """Delete an Ollama model to free up space."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{_ollama_orchestrator.ollama_url}/api/delete",
                json={"name": model_name}
            )

            if response.status_code == 200:
                return {"message": f"Model {model_name} deleted"}
            else:
                raise HTTPException(status_code=500, detail=f"Failed to delete: {response.text}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Feature 2: Function-Model Configuration

### UI Design

**Location:** Admin Settings → GenAI → Function Configuration

```
┌────────────────────────────────────────────────────────────┐
│  GenAI Function Configuration                               │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Function              Primary Model      Secondary Model  │
│  ─────────────────────────────────────────────────────────│
│  Executive Summary     gpt-4o-mini        llama3.2:8b      │
│                        [Change]           [Change]         │
│                                                             │
│  Technical Summary     gpt-4o-mini        llama3.2:8b      │
│                        [Change]           [Change]         │
│                                                             │
│  Brief Summary         llama3.2:3b        gpt-4o-mini      │
│                        [Change]           [Change]         │
│                                                             │
│  IOC Extraction        gpt-4o-mini        claude-sonnet    │
│                        [Change]           [Change]         │
│                                                             │
│  [+ Add Custom Function]                                   │
│                                                             │
│  Global Settings:                                          │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Default Primary:   [gpt-4o-mini ▼]                 │   │
│  │ Default Secondary: [llama3.2:8b ▼]                 │   │
│  │                                                     │   │
│  │ Auto-fallback: [✓] Enabled                         │   │
│  │ Cost Alerts:   [✓] Notify when > $10/day           │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### Backend Implementation

**NEW FILE:** `backend/app/admin/genai_functions.py`

```python
"""Admin management of GenAI function configurations."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import User, GenAIFunctionConfig
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/admin/genai/functions", tags=["admin-genai"])


class FunctionConfigUpdate(BaseModel):
    primary_model_id: Optional[str] = None
    secondary_model_id: Optional[str] = None
    active_prompt_id: Optional[int] = None


class FunctionConfigResponse(BaseModel):
    id: int
    function_name: str
    display_name: str
    description: Optional[str]
    active_prompt_id: Optional[int]
    primary_model_id: Optional[str]
    secondary_model_id: Optional[str]
    total_requests: int
    total_tokens: int
    total_cost: float

    class Config:
        from_attributes = True


@router.get("/", response_model=List[FunctionConfigResponse])
def list_function_configs(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """List all GenAI function configurations."""
    configs = db.query(GenAIFunctionConfig).all()

    # If no configs exist, create defaults
    if not configs:
        default_functions = [
            {
                "function_name": "executive_summary",
                "display_name": "Executive Summary",
                "description": "High-level summary for executives",
                "primary_model_id": "gpt-4o-mini",
                "secondary_model_id": "llama3.2:8b"
            },
            {
                "function_name": "technical_summary",
                "display_name": "Technical Summary",
                "description": "Detailed technical analysis",
                "primary_model_id": "gpt-4o-mini",
                "secondary_model_id": "llama3.2:8b"
            },
            {
                "function_name": "brief_summary",
                "display_name": "Brief Summary",
                "description": "Quick 2-3 sentence summary",
                "primary_model_id": "llama3.2:3b",
                "secondary_model_id": "gpt-4o-mini"
            },
            {
                "function_name": "ioc_extraction",
                "display_name": "IOC Extraction",
                "description": "Extract security indicators",
                "primary_model_id": "gpt-4o-mini",
                "secondary_model_id": "claude-3-5-sonnet"
            }
        ]

        for func_data in default_functions:
            func = GenAIFunctionConfig(**func_data)
            db.add(func)

        db.commit()
        configs = db.query(GenAIFunctionConfig).all()

    return configs


@router.patch("/{function_name}")
def update_function_config(
    function_name: str,
    payload: FunctionConfigUpdate,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Update model assignment for a function."""
    config = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == function_name
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="Function not found")

    # Update fields
    if payload.primary_model_id is not None:
        config.primary_model_id = payload.primary_model_id
    if payload.secondary_model_id is not None:
        config.secondary_model_id = payload.secondary_model_id
    if payload.active_prompt_id is not None:
        config.active_prompt_id = payload.active_prompt_id

    config.updated_by_id = current_user.id

    db.commit()
    db.refresh(config)

    return config


@router.get("/stats")
def get_usage_stats(
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Get aggregated usage statistics."""
    configs = db.query(GenAIFunctionConfig).all()

    total_requests = sum(c.total_requests for c in configs)
    total_tokens = sum(c.total_tokens for c in configs)
    total_cost = sum(c.total_cost for c in configs)

    return {
        "total_requests": total_requests,
        "total_tokens": total_tokens,
        "total_cost": total_cost,
        "by_function": [
            {
                "function_name": c.function_name,
                "requests": c.total_requests,
                "tokens": c.total_tokens,
                "cost": c.total_cost
            }
            for c in configs
        ]
    }
```

---

## Feature 3: Prompt Management System

### UI Design

**Location:** Admin Settings → GenAI → Prompts

```
┌────────────────────────────────────────────────────────────┐
│  Prompt Library                                    [+ New]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Search: [____________________]  Filter: [All ▼]           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Executive Summary Prompt                     v2 ✓   │  │
│  │ Used by: Executive Summary function                 │  │
│  │ Model: gpt-4o-mini | Temp: 0.7 | Tokens: 500       │  │
│  │                                                      │  │
│  │ Skills: [Cybersecurity Analyst] [Executive Voice]   │  │
│  │ Guardrails: [Length 50-500] [No PII]               │  │
│  │                                                      │  │
│  │ [Edit] [Test] [History] [Duplicate]                │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ IOC Extraction Prompt                        v1 ✓   │  │
│  │ Used by: IOC Extraction function                    │  │
│  │ Model: gpt-4o-mini | Temp: 0.1 | Tokens: 1000      │  │
│  │                                                      │  │
│  │ Skills: [Security Expert] [JSON Formatter]          │  │
│  │ Guardrails: [Valid JSON] [Required Fields]         │  │
│  │                                                      │  │
│  │ [Edit] [Test] [History] [Duplicate]                │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Prompt Editor UI

```
┌────────────────────────────────────────────────────────────┐
│  Edit Prompt: Executive Summary                     [Save] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Basic Info:                                                │
│  Name: [Executive Summary_________________]                │
│  Description: [High-level summary for executives_______]   │
│  Function: [Executive Summary ▼]                           │
│                                                             │
│  Template:                                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ You are {persona}.                                  │   │
│  │                                                     │   │
│  │ Analyze this article and provide an executive      │   │
│  │ summary in 3-5 bullet points.                      │   │
│  │                                                     │   │
│  │ Title: {title}                                      │   │
│  │ Content: {content}                                  │   │
│  │                                                     │   │
│  │ Guidelines:                                         │   │
│  │ 1. Start with most critical impact                 │   │
│  │ 2. Keep under 150 words                            │   │
│  │ 3. Focus on business implications                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  Variables: (auto-detected from {})                        │
│  • persona (string) - Default: "executive"                 │
│  • title (string, required)                                │
│  • content (string, required)                              │
│                                                             │
│  Skills: (prepended to prompt)                             │
│  [+ Add Skill]  [Cybersecurity Analyst ✕] [Executive ✕]   │
│                                                             │
│  Guardrails: (validated after generation)                  │
│  [+ Add Guardrail]  [Length 50-500 ✕] [No PII ✕]          │
│                                                             │
│  Model Settings:                                            │
│  Model: [gpt-4o-mini ▼]  Temp: [0.7___]  Tokens: [500__] │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Preview Final Prompt:                               │   │
│  │                                                     │   │
│  │ [Show Preview]  (expands to show full prompt)      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  [Test with Sample Data]  [Save as New Version]  [Cancel] │
└────────────────────────────────────────────────────────────┘
```

### Backend Implementation

**NEW FILE:** `backend/app/admin/prompts.py`

```python
"""Admin management of prompt templates."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import User, Prompt, PromptVariable, Skill, Guardrail, PromptSkill, PromptGuardrail
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import re

router = APIRouter(prefix="/admin/prompts", tags=["admin-prompts"])


class PromptCreate(BaseModel):
    name: str
    description: Optional[str] = None
    function_type: str
    template: str
    model_id: Optional[str] = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 500
    tags: Optional[List[str]] = []
    skill_ids: Optional[List[int]] = []
    guardrail_ids: Optional[List[int]] = []


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template: Optional[str] = None
    model_id: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    tags: Optional[List[str]] = None
    skill_ids: Optional[List[int]] = None
    guardrail_ids: Optional[List[int]] = None


class PromptResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    function_type: str
    template: str
    version: int
    is_active: bool
    model_id: Optional[str]
    temperature: float
    max_tokens: int
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime
    skills: List[Dict[str, Any]]
    guardrails: List[Dict[str, Any]]
    variables: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class PromptPreviewRequest(BaseModel):
    """Request to preview a prompt with sample data."""
    template: str
    skill_ids: List[int] = []
    sample_variables: Dict[str, Any]


def extract_variables(template: str) -> List[Dict[str, Any]]:
    """Extract {variable} placeholders from template."""
    pattern = r'\{(\w+)\}'
    matches = re.findall(pattern, template)

    variables = []
    seen = set()

    for var_name in matches:
        if var_name not in seen:
            variables.append({
                "name": var_name,
                "type": "string",
                "is_required": True,
                "description": f"Value for {var_name}"
            })
            seen.add(var_name)

    return variables


@router.get("/", response_model=List[PromptResponse])
def list_prompts(
    function_type: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """List all prompt templates."""
    query = db.query(Prompt)

    if function_type:
        query = query.filter(Prompt.function_type == function_type)

    if active_only:
        query = query.filter(Prompt.is_active == True)

    prompts = query.order_by(desc(Prompt.created_at)).all()

    # Enrich with relationships
    result = []
    for prompt in prompts:
        # Get skills
        prompt_skills = db.query(PromptSkill).filter(
            PromptSkill.prompt_id == prompt.id
        ).order_by(PromptSkill.order).all()

        skills = []
        for ps in prompt_skills:
            skill = db.query(Skill).filter(Skill.id == ps.skill_id).first()
            if skill:
                skills.append({
                    "id": skill.id,
                    "name": skill.name,
                    "instruction": skill.instruction
                })

        # Get guardrails
        prompt_guardrails = db.query(PromptGuardrail).filter(
            PromptGuardrail.prompt_id == prompt.id
        ).order_by(PromptGuardrail.order).all()

        guardrails = []
        for pg in prompt_guardrails:
            guardrail = db.query(Guardrail).filter(Guardrail.id == pg.guardrail_id).first()
            if guardrail:
                guardrails.append({
                    "id": guardrail.id,
                    "name": guardrail.name,
                    "type": guardrail.type,
                    "config": guardrail.config
                })

        # Get variables
        variables = db.query(PromptVariable).filter(
            PromptVariable.prompt_id == prompt.id
        ).all()

        vars_list = [
            {
                "name": v.name,
                "type": v.type,
                "is_required": v.is_required,
                "default_value": v.default_value,
                "description": v.description
            }
            for v in variables
        ]

        result.append({
            **prompt.__dict__,
            "skills": skills,
            "guardrails": guardrails,
            "variables": vars_list
        })

    return result


@router.post("/", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
def create_prompt(
    payload: PromptCreate,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Create a new prompt template."""
    # Create prompt
    prompt = Prompt(
        name=payload.name,
        description=payload.description,
        function_type=payload.function_type,
        template=payload.template,
        version=1,
        is_active=True,
        model_id=payload.model_id,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        tags=payload.tags,
        created_by_id=current_user.id
    )

    db.add(prompt)
    db.flush()  # Get prompt.id

    # Extract and save variables
    variables = extract_variables(payload.template)
    for var in variables:
        prompt_var = PromptVariable(
            prompt_id=prompt.id,
            **var
        )
        db.add(prompt_var)

    # Add skills
    for idx, skill_id in enumerate(payload.skill_ids):
        prompt_skill = PromptSkill(
            prompt_id=prompt.id,
            skill_id=skill_id,
            order=idx
        )
        db.add(prompt_skill)

    # Add guardrails
    for idx, guardrail_id in enumerate(payload.guardrail_ids):
        prompt_guardrail = PromptGuardrail(
            prompt_id=prompt.id,
            guardrail_id=guardrail_id,
            order=idx
        )
        db.add(prompt_guardrail)

    db.commit()
    db.refresh(prompt)

    return prompt


@router.patch("/{prompt_id}")
def update_prompt(
    prompt_id: int,
    payload: PromptUpdate,
    create_new_version: bool = True,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Update a prompt (creates new version by default)."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    if create_new_version:
        # Deactivate old version
        prompt.is_active = False

        # Create new version
        new_prompt = Prompt(
            name=payload.name or prompt.name,
            description=payload.description or prompt.description,
            function_type=prompt.function_type,
            template=payload.template or prompt.template,
            version=prompt.version + 1,
            is_active=True,
            model_id=payload.model_id or prompt.model_id,
            temperature=payload.temperature if payload.temperature is not None else prompt.temperature,
            max_tokens=payload.max_tokens or prompt.max_tokens,
            tags=payload.tags or prompt.tags,
            parent_id=prompt.id,
            created_by_id=current_user.id
        )

        db.add(new_prompt)
        db.flush()

        # Copy variables if template changed
        if payload.template:
            variables = extract_variables(payload.template)
            for var in variables:
                prompt_var = PromptVariable(prompt_id=new_prompt.id, **var)
                db.add(prompt_var)
        else:
            # Copy from old version
            old_vars = db.query(PromptVariable).filter(
                PromptVariable.prompt_id == prompt.id
            ).all()
            for old_var in old_vars:
                new_var = PromptVariable(
                    prompt_id=new_prompt.id,
                    name=old_var.name,
                    type=old_var.type,
                    default_value=old_var.default_value,
                    description=old_var.description,
                    is_required=old_var.is_required
                )
                db.add(new_var)

        # Copy skills and guardrails if not specified
        if payload.skill_ids is not None:
            for idx, skill_id in enumerate(payload.skill_ids):
                ps = PromptSkill(prompt_id=new_prompt.id, skill_id=skill_id, order=idx)
                db.add(ps)
        else:
            old_skills = db.query(PromptSkill).filter(
                PromptSkill.prompt_id == prompt.id
            ).all()
            for old_skill in old_skills:
                new_ps = PromptSkill(
                    prompt_id=new_prompt.id,
                    skill_id=old_skill.skill_id,
                    order=old_skill.order
                )
                db.add(new_ps)

        if payload.guardrail_ids is not None:
            for idx, guardrail_id in enumerate(payload.guardrail_ids):
                pg = PromptGuardrail(prompt_id=new_prompt.id, guardrail_id=guardrail_id, order=idx)
                db.add(pg)
        else:
            old_guardrails = db.query(PromptGuardrail).filter(
                PromptGuardrail.prompt_id == prompt.id
            ).all()
            for old_gr in old_guardrails:
                new_pg = PromptGuardrail(
                    prompt_id=new_prompt.id,
                    guardrail_id=old_gr.guardrail_id,
                    order=old_gr.order
                )
                db.add(new_pg)

        db.commit()
        db.refresh(new_prompt)

        return {"message": "New version created", "new_version": new_prompt.version, "prompt_id": new_prompt.id}

    else:
        # In-place update
        if payload.name:
            prompt.name = payload.name
        if payload.description is not None:
            prompt.description = payload.description
        if payload.template:
            prompt.template = payload.template
            # Re-extract variables
            db.query(PromptVariable).filter(PromptVariable.prompt_id == prompt.id).delete()
            variables = extract_variables(payload.template)
            for var in variables:
                prompt_var = PromptVariable(prompt_id=prompt.id, **var)
                db.add(prompt_var)

        if payload.model_id:
            prompt.model_id = payload.model_id
        if payload.temperature is not None:
            prompt.temperature = payload.temperature
        if payload.max_tokens:
            prompt.max_tokens = payload.max_tokens
        if payload.tags is not None:
            prompt.tags = payload.tags

        # Update skills
        if payload.skill_ids is not None:
            db.query(PromptSkill).filter(PromptSkill.prompt_id == prompt.id).delete()
            for idx, skill_id in enumerate(payload.skill_ids):
                ps = PromptSkill(prompt_id=prompt.id, skill_id=skill_id, order=idx)
                db.add(ps)

        # Update guardrails
        if payload.guardrail_ids is not None:
            db.query(PromptGuardrail).filter(PromptGuardrail.prompt_id == prompt.id).delete()
            for idx, guardrail_id in enumerate(payload.guardrail_ids):
                pg = PromptGuardrail(prompt_id=prompt.id, guardrail_id=guardrail_id, order=idx)
                db.add(pg)

        db.commit()
        db.refresh(prompt)

        return {"message": "Prompt updated", "prompt_id": prompt.id}


@router.delete("/{prompt_id}")
def delete_prompt(
    prompt_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Soft delete a prompt (mark as inactive)."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    prompt.is_active = False
    db.commit()

    return {"message": "Prompt deactivated"}


@router.post("/preview")
def preview_prompt(
    payload: PromptPreviewRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Preview the final prompt with sample variables."""
    # Build final prompt
    final_prompt = ""

    # 1. Add skills
    if payload.skill_ids:
        skills = db.query(Skill).filter(Skill.id.in_(payload.skill_ids)).all()
        for skill in skills:
            final_prompt += f"{skill.instruction}\n\n"

    # 2. Add main template
    template = payload.template

    # 3. Replace variables
    for var_name, var_value in payload.sample_variables.items():
        template = template.replace(f"{{{var_name}}}", str(var_value))

    final_prompt += template

    return {
        "final_prompt": final_prompt,
        "character_count": len(final_prompt),
        "estimated_tokens": len(final_prompt) // 4  # Rough estimate
    }


@router.get("/{prompt_id}/history")
def get_prompt_history(
    prompt_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Get version history of a prompt."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Find all versions (follow parent_id chain)
    versions = []
    current = prompt

    while current:
        versions.append({
            "id": current.id,
            "version": current.version,
            "is_active": current.is_active,
            "created_at": current.created_at,
            "created_by_id": current.created_by_id
        })

        if current.parent_id:
            current = db.query(Prompt).filter(Prompt.id == current.parent_id).first()
        else:
            break

    return {"versions": versions}
```

---

## Feature 4: Skills & Guardrails Management

### Skills UI

**Location:** Admin Settings → GenAI → Skills

```
┌────────────────────────────────────────────────────────────┐
│  Skills Library                                    [+ New]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Cybersecurity Analyst                                │  │
│  │ Category: Persona                                    │  │
│  │                                                      │  │
│  │ "You are a cybersecurity analyst with 10 years of   │  │
│  │ experience analyzing threat intelligence. Focus on  │  │
│  │ technical accuracy and actionable recommendations."  │  │
│  │                                                      │  │
│  │ Used in: 3 prompts                                  │  │
│  │ [Edit] [Delete] [Duplicate]                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Executive Voice                                      │  │
│  │ Category: Formatting                                 │  │
│  │                                                      │  │
│  │ "Use clear, non-technical language suitable for     │  │
│  │ C-level executives. Avoid jargon. Focus on business │  │
│  │ impact and strategic implications."                  │  │
│  │                                                      │  │
│  │ Used in: 2 prompts                                  │  │
│  │ [Edit] [Delete] [Duplicate]                         │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Guardrails UI

**Location:** Admin Settings → GenAI → Guardrails

```
┌────────────────────────────────────────────────────────────┐
│  Guardrails Library                                [+ New]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Length Validator                                     │  │
│  │ Type: length                                         │  │
│  │                                                      │  │
│  │ Config:                                             │  │
│  │   Min Length: [50__] characters                     │  │
│  │   Max Length: [500_] characters                     │  │
│  │                                                      │  │
│  │ Action on Failure: [Retry ▼]  Max Retries: [2_]    │  │
│  │                                                      │  │
│  │ Used in: 5 prompts                                  │  │
│  │ [Edit] [Delete] [Test]                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ No PII                                               │  │
│  │ Type: pii                                            │  │
│  │                                                      │  │
│  │ Config:                                             │  │
│  │   [✓] Check for SSN                                 │  │
│  │   [✓] Check for credit cards                        │  │
│  │   [✓] Check for phone numbers                       │  │
│  │   [✓] Check for email addresses (in output)        │  │
│  │                                                      │  │
│  │ Action on Failure: [Reject ▼]  Max Retries: [0_]   │  │
│  │                                                      │  │
│  │ Used in: 8 prompts                                  │  │
│  │ [Edit] [Delete] [Test]                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Valid JSON                                           │  │
│  │ Type: format                                         │  │
│  │                                                      │  │
│  │ Config:                                             │  │
│  │   Required Format: [JSON ▼]                         │  │
│  │   Required Fields: [ips, domains, cves_________]    │  │
│  │   Validate Schema: [✓] Enabled                      │  │
│  │                                                      │  │
│  │ Action on Failure: [Fix ▼]  Max Retries: [3_]      │  │
│  │                                                      │  │
│  │ Used in: 1 prompt (IOC Extraction)                  │  │
│  │ [Edit] [Delete] [Test]                              │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Backend Implementation

**NEW FILE:** `backend/app/admin/skills.py`

```python
"""Admin management of skills."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import User, Skill
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/admin/skills", tags=["admin-skills"])


class SkillCreate(BaseModel):
    name: str
    description: Optional[str] = None
    instruction: str
    category: Optional[str] = "general"


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class SkillResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    instruction: str
    category: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[SkillResponse])
def list_skills(
    active_only: bool = True,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """List all skills."""
    query = db.query(Skill)

    if active_only:
        query = query.filter(Skill.is_active == True)

    skills = query.order_by(Skill.name).all()
    return skills


@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(
    payload: SkillCreate,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Create a new skill."""
    skill = Skill(
        name=payload.name,
        description=payload.description,
        instruction=payload.instruction,
        category=payload.category,
        is_active=True,
        created_by_id=current_user.id
    )

    db.add(skill)
    db.commit()
    db.refresh(skill)

    return skill


@router.patch("/{skill_id}")
def update_skill(
    skill_id: int,
    payload: SkillUpdate,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Update a skill."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()

    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    if payload.name is not None:
        skill.name = payload.name
    if payload.description is not None:
        skill.description = payload.description
    if payload.instruction is not None:
        skill.instruction = payload.instruction
    if payload.category is not None:
        skill.category = payload.category
    if payload.is_active is not None:
        skill.is_active = payload.is_active

    db.commit()
    db.refresh(skill)

    return skill


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Soft delete a skill."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()

    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    skill.is_active = False
    db.commit()

    return {"message": "Skill deactivated"}
```

**NEW FILE:** `backend/app/admin/guardrails.py`

```python
"""Admin management of guardrails."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.auth.rbac import Permission
from app.models import User, Guardrail
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/admin/guardrails", tags=["admin-guardrails"])


class GuardrailCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # "length", "toxicity", "pii", "format", "keywords_required", "keywords_forbidden"
    config: Dict[str, Any]
    action: str = "retry"  # "retry", "reject", "fix", "log"
    max_retries: int = 2


class GuardrailUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    action: Optional[str] = None
    max_retries: Optional[int] = None
    is_active: Optional[bool] = None


class GuardrailResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: str
    config: Dict[str, Any]
    action: str
    max_retries: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[GuardrailResponse])
def list_guardrails(
    active_only: bool = True,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """List all guardrails."""
    query = db.query(Guardrail)

    if active_only:
        query = query.filter(Guardrail.is_active == True)

    guardrails = query.order_by(Guardrail.name).all()
    return guardrails


@router.post("/", response_model=GuardrailResponse, status_code=status.HTTP_201_CREATED)
def create_guardrail(
    payload: GuardrailCreate,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Create a new guardrail."""
    guardrail = Guardrail(
        name=payload.name,
        description=payload.description,
        type=payload.type,
        config=payload.config,
        action=payload.action,
        max_retries=payload.max_retries,
        is_active=True,
        created_by_id=current_user.id
    )

    db.add(guardrail)
    db.commit()
    db.refresh(guardrail)

    return guardrail


@router.patch("/{guardrail_id}")
def update_guardrail(
    guardrail_id: int,
    payload: GuardrailUpdate,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Update a guardrail."""
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()

    if not guardrail:
        raise HTTPException(status_code=404, detail="Guardrail not found")

    if payload.name is not None:
        guardrail.name = payload.name
    if payload.description is not None:
        guardrail.description = payload.description
    if payload.type is not None:
        guardrail.type = payload.type
    if payload.config is not None:
        guardrail.config = payload.config
    if payload.action is not None:
        guardrail.action = payload.action
    if payload.max_retries is not None:
        guardrail.max_retries = payload.max_retries
    if payload.is_active is not None:
        guardrail.is_active = payload.is_active

    db.commit()
    db.refresh(guardrail)

    return guardrail


@router.delete("/{guardrail_id}")
def delete_guardrail(
    guardrail_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Soft delete a guardrail."""
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()

    if not guardrail:
        raise HTTPException(status_code=404, detail="Guardrail not found")

    guardrail.is_active = False
    db.commit()

    return {"message": "Guardrail deactivated"}


@router.post("/{guardrail_id}/test")
def test_guardrail(
    guardrail_id: int,
    test_content: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_SOURCES.value)),
    db: Session = Depends(get_db)
):
    """Test a guardrail against sample content."""
    guardrail = db.query(Guardrail).filter(Guardrail.id == guardrail_id).first()

    if not guardrail:
        raise HTTPException(status_code=404, detail="Guardrail not found")

    # Import guardrail executor
    from app.genai.guardrails import GuardrailExecutor
    executor = GuardrailExecutor()

    result = executor.validate(
        content=test_content,
        guardrail_type=guardrail.type,
        config=guardrail.config
    )

    return {
        "guardrail_name": guardrail.name,
        "passed": result["passed"],
        "violations": result.get("violations", []),
        "fixed_content": result.get("fixed_content")
    }
```

---

## Feature 5: Guardrail Execution Engine

**NEW FILE:** `backend/app/genai/guardrails.py`

```python
"""Guardrail execution and validation."""
import re
import json
from typing import Dict, Any, List


class GuardrailExecutor:
    """Execute guardrails on LLM outputs."""

    def validate(self, content: str, guardrail_type: str, config: Dict[str, Any]) -> Dict:
        """Validate content against a guardrail."""

        if guardrail_type == "length":
            return self._validate_length(content, config)

        elif guardrail_type == "pii":
            return self._validate_pii(content, config)

        elif guardrail_type == "format":
            return self._validate_format(content, config)

        elif guardrail_type == "keywords_required":
            return self._validate_keywords_required(content, config)

        elif guardrail_type == "keywords_forbidden":
            return self._validate_keywords_forbidden(content, config)

        elif guardrail_type == "toxicity":
            return self._validate_toxicity(content, config)

        else:
            return {"passed": True, "message": "Unknown guardrail type"}

    def _validate_length(self, content: str, config: Dict) -> Dict:
        """Check content length."""
        length = len(content)
        min_length = config.get("min_length", 0)
        max_length = config.get("max_length", float('inf'))

        if length < min_length:
            return {
                "passed": False,
                "violations": [f"Content too short: {length} < {min_length} characters"]
            }

        if length > max_length:
            return {
                "passed": False,
                "violations": [f"Content too long: {length} > {max_length} characters"]
            }

        return {"passed": True}

    def _validate_pii(self, content: str, config: Dict) -> Dict:
        """Check for PII (Personal Identifiable Information)."""
        violations = []

        # SSN pattern (123-45-6789)
        if config.get("check_ssn", True):
            ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
            if re.search(ssn_pattern, content):
                violations.append("Found SSN pattern")

        # Credit card pattern (4 groups of 4 digits)
        if config.get("check_credit_card", True):
            cc_pattern = r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b'
            if re.search(cc_pattern, content):
                violations.append("Found credit card pattern")

        # Phone number (various formats)
        if config.get("check_phone", True):
            phone_pattern = r'\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'
            if re.search(phone_pattern, content):
                violations.append("Found phone number")

        # Email addresses
        if config.get("check_email", False):
            email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            if re.search(email_pattern, content):
                violations.append("Found email address")

        if violations:
            return {"passed": False, "violations": violations}

        return {"passed": True}

    def _validate_format(self, content: str, config: Dict) -> Dict:
        """Check content format (JSON, markdown, etc.)."""
        required_format = config.get("required_format", "json").lower()

        if required_format == "json":
            try:
                parsed = json.loads(content)

                # Check required fields
                required_fields = config.get("required_fields", [])
                missing_fields = []

                for field in required_fields:
                    if field not in parsed:
                        missing_fields.append(field)

                if missing_fields:
                    return {
                        "passed": False,
                        "violations": [f"Missing required fields: {', '.join(missing_fields)}"]
                    }

                return {"passed": True, "parsed": parsed}

            except json.JSONDecodeError as e:
                return {
                    "passed": False,
                    "violations": [f"Invalid JSON: {str(e)}"]
                }

        return {"passed": True}

    def _validate_keywords_required(self, content: str, config: Dict) -> Dict:
        """Check that required keywords are present."""
        required_keywords = config.get("required_keywords", [])
        missing_keywords = []

        content_lower = content.lower()

        for keyword in required_keywords:
            if keyword.lower() not in content_lower:
                missing_keywords.append(keyword)

        if missing_keywords:
            return {
                "passed": False,
                "violations": [f"Missing required keywords: {', '.join(missing_keywords)}"]
            }

        return {"passed": True}

    def _validate_keywords_forbidden(self, content: str, config: Dict) -> Dict:
        """Check that forbidden keywords are NOT present."""
        forbidden_keywords = config.get("forbidden_keywords", [])
        found_keywords = []

        content_lower = content.lower()

        for keyword in forbidden_keywords:
            if keyword.lower() in content_lower:
                found_keywords.append(keyword)

        if found_keywords:
            return {
                "passed": False,
                "violations": [f"Found forbidden keywords: {', '.join(found_keywords)}"]
            }

        return {"passed": True}

    def _validate_toxicity(self, content: str, config: Dict) -> Dict:
        """Check for toxic content (basic implementation)."""
        # This is a simplified version. For production, use a library like:
        # - detoxify
        # - perspective API
        # - HuggingFace transformers toxicity models

        toxic_words = [
            "hate", "kill", "violent", "offensive"
            # Add more from a comprehensive list
        ]

        threshold = config.get("threshold", 0.5)

        content_lower = content.lower()
        found_toxic = [word for word in toxic_words if word in content_lower]

        if len(found_toxic) > 0:
            return {
                "passed": False,
                "violations": [f"Potentially toxic content detected: {', '.join(found_toxic)}"]
            }

        return {"passed": True}
```

---

## Implementation Timeline

### **Day 1: Database Models & Migration**
- Add all new models to `backend/app/models.py`
- Create Alembic migration
- Run migration
- Test with sample data

### **Day 2: Ollama Installation Feature**
- Create `backend/app/admin/ollama_setup.py`
- Implement Docker-based installation
- Add model download functionality
- Register router in main.py
- Test installation flow

### **Day 3: Function-Model Configuration**
- Create `backend/app/admin/genai_functions.py`
- Implement function config CRUD
- Add usage tracking
- Register router
- Test model assignment

### **Day 4: Prompt Management Backend**
- Create `backend/app/admin/prompts.py`
- Implement prompt CRUD with versioning
- Add preview functionality
- Add variable extraction
- Register router
- Test all routes

### **Day 5: Skills & Guardrails Backend**
- Create `backend/app/admin/skills.py`
- Create `backend/app/admin/guardrails.py`
- Create `backend/app/genai/guardrails.py` (executor)
- Register routers
- Test validation logic

### **Day 6-7: Frontend UI**
- Create admin GenAI settings pages
- Ollama setup UI
- Function configuration UI
- Prompt editor (WYSIWYG-style)
- Skills library UI
- Guardrails library UI
- Integration testing

---

## Cost Optimization Strategies

1. **Local Ollama First**: Default to free local models for non-critical tasks
2. **Function-Level Model Assignment**: Use expensive models only where needed
3. **Token Tracking**: Monitor usage per function to identify cost hotspots
4. **Caching**: Cache similar prompts/responses (not implemented in MVP, future enhancement)
5. **Fallback to Cheaper Models**: Secondary model can be cheaper local alternative
6. **Batch Processing**: Process multiple articles together when possible

---

## User Experience Goals

### For Non-Technical Admins:

1. **No Coding Required**: All configuration through web UI
2. **Visual Feedback**: Show estimated costs, token usage, response times
3. **Templates & Examples**: Pre-built prompts, skills, guardrails
4. **Test Before Deploy**: Preview prompts, test guardrails
5. **Version Control**: Easy rollback if something breaks
6. **Usage Monitoring**: Dashboard showing what's working, what's costing money

---

## Success Metrics

- **Admin can install Ollama** in < 2 minutes without technical knowledge
- **Admin can create new prompt** in < 5 minutes
- **Admin can modify existing prompt** without breaking production
- **Cost transparency**: Admin knows exactly what each function costs
- **Quality control**: Guardrails catch 95%+ of bad outputs before showing to users

---

## Sources

Research for this plan was based on:

- [7 best prompt management tools in 2026](https://www.braintrust.dev/articles/best-prompt-management-tools-2026) - Braintrust
- [The Definitive Guide to Prompt Management Systems](https://agenta.ai/blog/the-definitive-guide-to-prompt-management-systems) - Agenta
- [Open Source Prompt Management](https://langfuse.com/docs/prompt-management/overview) - Langfuse
- [LangChain Prompt Templates](https://docs.langchain.com/langsmith/prompt-engineering-concepts) - LangChain
- [LangChain with Guardrails AI](https://guardrailsai.com/docs/integrations/langchain) - Guardrails AI
- [Ollama Docker Installation](https://hub.docker.com/r/ollama/ollama) - Docker Hub
- [Getting Started with Ollama and Docker](https://collabnix.com/getting-started-with-ollama-and-docker/) - Collabnix
- [5 best prompt engineering tools](https://www.braintrust.dev/articles/best-prompt-engineering-tools-2026) - Braintrust
- [6 Best No-Code Web App Builders](https://emergent.sh/learn/best-no-code-web-app-builders) - Emergent

---

## Next Steps

1. Review and approve this plan
2. Begin Day 1 implementation (database models)
3. Iterate based on feedback
4. Deploy to staging for testing
5. User acceptance testing with non-technical admin
6. Production deployment
