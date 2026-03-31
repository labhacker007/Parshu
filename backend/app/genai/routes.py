"""GenAI API routes for help, troubleshooting, configuration, and AI assistant features."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models import User
from app.core.logging import logger
from app.genai.config_manager import GenAIConfigManager
from app.genai.models import GenAIModelConfig, GenAIModelRegistry, GenAIUsageQuota, ConfigType

router = APIRouter(prefix="/genai", tags=["genai"])


@router.get("/providers/status")
async def get_provider_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get status of all GenAI providers - which ones are configured and usable.
    This is critical for the Testing Lab to only show working models.
    """
    from app.core.config import settings
    import httpx
    from app.auth.unified_permissions import has_api_permission

    role_name = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin = has_api_permission(role_name, "manage:genai")
    
    providers = {
        "ollama": {
            "name": "Ollama (Local)",
            "configured": bool(settings.OLLAMA_BASE_URL),
            "api_key_required": False,
            "is_local": True,
            "is_free": True,
            "base_url": settings.OLLAMA_BASE_URL,
            "model": settings.OLLAMA_MODEL,
            "status": "unknown",
            "available_models": []
        },
        "openai": {
            "name": "OpenAI",
            "configured": bool(settings.OPENAI_API_KEY),
            "api_key_required": True,
            "has_api_key": bool(settings.OPENAI_API_KEY),
            "is_local": False,
            "is_free": False,
            "model": settings.OPENAI_MODEL,
            "status": "not_configured" if not settings.OPENAI_API_KEY else "configured",
            "available_models": ["gpt-4", "gpt-4-turbo-preview", "gpt-3.5-turbo"] if settings.OPENAI_API_KEY else []
        },
        "anthropic": {
            "name": "Anthropic (Claude)",
            "configured": bool(settings.ANTHROPIC_API_KEY or settings.CLAUDE_API_KEY),
            "api_key_required": True,
            "has_api_key": bool(settings.ANTHROPIC_API_KEY or settings.CLAUDE_API_KEY),
            "is_local": False,
            "is_free": False,
            "model": settings.ANTHROPIC_MODEL,
            "status": "not_configured" if not (settings.ANTHROPIC_API_KEY or settings.CLAUDE_API_KEY) else "configured",
            "available_models": ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-5-sonnet-20241022"] if (settings.ANTHROPIC_API_KEY or settings.CLAUDE_API_KEY) else []
        },
        "gemini": {
            "name": "Google Gemini",
            "configured": bool(settings.GEMINI_API_KEY),
            "api_key_required": True,
            "has_api_key": bool(settings.GEMINI_API_KEY),
            "is_local": False,
            "is_free": False,
            "model": settings.GEMINI_MODEL,
            "status": "not_configured" if not settings.GEMINI_API_KEY else "configured",
            "available_models": ["gemini-pro", "gemini-1.5-pro"] if settings.GEMINI_API_KEY else []
        }
    }
    
    # Check Ollama connectivity
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                providers["ollama"]["status"] = "connected"
                providers["ollama"]["available_models"] = [m["name"] for m in data.get("models", [])]
            else:
                providers["ollama"]["status"] = "error"
    except Exception as e:
        providers["ollama"]["status"] = "disconnected"
        if is_admin:
            providers["ollama"]["error"] = str(e)
    
    # Get configured models from registry (handle case where table doesn't exist)
    from app.genai.models import GenAIModelRegistry
    registry_models = []
    try:
        registry_models = db.query(GenAIModelRegistry).filter(GenAIModelRegistry.is_enabled == True).all()
    except Exception as e:
        logger.warning("genai_model_registry_not_available", error=str(e))
        # Table might not exist yet - return provider info without registry
    
    # Build usable models list - only models that can actually be used
    usable_models = []
    
    for model in registry_models:
        provider = model.provider.lower()
        provider_info = providers.get(provider, {})
        
        # Check if this model is actually usable
        is_usable = False
        reason = ""
        
        if provider == "ollama":
            if providers["ollama"]["status"] == "connected":
                # Check if this specific model is available in Ollama
                if model.model_name in providers["ollama"]["available_models"] or \
                   any(model.model_name in m for m in providers["ollama"]["available_models"]):
                    is_usable = True
                else:
                    reason = f"Model {model.model_name} not pulled in Ollama. Run: ollama pull {model.model_name}"
            else:
                reason = "Ollama not running. Start with: ollama serve"
        elif provider == "openai":
            if providers["openai"]["has_api_key"]:
                is_usable = True
            else:
                reason = "OpenAI API key not configured. Set OPENAI_API_KEY in environment."
        elif provider == "anthropic":
            if providers["anthropic"]["has_api_key"]:
                is_usable = True
            else:
                reason = "Anthropic API key not configured. Set ANTHROPIC_API_KEY in environment."
        elif provider == "gemini":
            if providers["gemini"]["has_api_key"]:
                is_usable = True
            else:
                reason = "Gemini API key not configured. Set GEMINI_API_KEY in environment."
        
        usable_models.append({
            "id": model.id,
            "model_identifier": model.model_identifier,
            "provider": model.provider,
            "model_name": model.model_name,
            "display_name": model.display_name,
            "is_usable": is_usable,
            "reason": reason if not is_usable else None,
            "is_free": model.is_free,
            "is_local": model.is_local,
            "is_enabled": model.is_enabled
        })
    
    # Deduplicate models by model_identifier
    seen_identifiers = set()
    unique_usable = []
    unique_all = []
    
    for model in usable_models:
        identifier = model.get("model_identifier", "")
        if identifier not in seen_identifiers:
            seen_identifiers.add(identifier)
            unique_all.append(model)
            if model["is_usable"]:
                unique_usable.append(model)
    
    recommendations = get_setup_recommendations(providers)

    # Redact sensitive/provider-internal details for non-admin users
    if not is_admin:
        redacted = {}
        for key, info in providers.items():
            redacted[key] = {
                "name": info.get("name"),
                "configured": info.get("configured"),
                "is_local": info.get("is_local"),
                "is_free": info.get("is_free"),
                "status": info.get("status"),
                "available_models": info.get("available_models", []),
            }
        providers = redacted

    return {
        "providers": providers,
        "usable_models": unique_usable,
        "all_models": unique_all,
        "default_provider": settings.GENAI_PROVIDER,
        "recommendations": recommendations,
        "total_before_dedup": len(usable_models),
        "total_after_dedup": len(unique_all)
    }


def get_setup_recommendations(providers: dict) -> List[str]:
    """Generate setup recommendations based on provider status."""
    recommendations = []
    
    if providers["ollama"]["status"] != "connected":
        recommendations.append("🚀 Start Ollama locally: 'ollama serve' then 'ollama pull llama3'")
    
    if not providers["openai"]["has_api_key"]:
        recommendations.append("💡 Add OpenAI for better results: Set OPENAI_API_KEY environment variable")
    
    if not providers["anthropic"]["has_api_key"]:
        recommendations.append("💡 Add Claude for advanced reasoning: Set ANTHROPIC_API_KEY environment variable")
    
    if providers["ollama"]["status"] == "connected" and len(providers["ollama"]["available_models"]) == 0:
        recommendations.append("📥 Pull a model in Ollama: 'ollama pull llama3' or 'ollama pull mistral'")
    
    return recommendations


class HelpRequest(BaseModel):
    question: str
    model: Optional[str] = None
    context: Optional[Dict] = None


class HelpResponse(BaseModel):
    answer: str
    sources: List[str] = []
    model_used: Optional[str] = None


class TroubleshootRequest(BaseModel):
    issue: str
    system_info: Optional[Dict] = None
    logs: Optional[str] = None


class TroubleshootResponse(BaseModel):
    diagnosis: str
    suggested_fixes: List[str] = []
    severity: str = "low"  # low, medium, high, critical


# Built-in help documentation
JYOTI_HELP_DOCS = {
    "getting-started": """# Getting Started with Jyoti

1. **Initial Setup**
   - Configure GenAI provider (Admin → Configuration → GenAI)
   - Set up Ollama locally or use cloud API keys
   - Test connection in GenAI Lab

2. **Add Feed Sources**
   - Go to Sources page
   - Click "Add Source" to add RSS/Atom feeds
   - Enable auto-fetch in scheduler

3. **Configure Hunt Platforms**
   - Admin → Configuration → Hunt Connectors
   - Add Microsoft Defender, Splunk, or XSIAM credentials
   - Test each connector

4. **User Management**
   - Admin → Access Management
   - Create users with appropriate roles (TI, TH, IR, Viewer)
   - Configure RBAC permissions as needed
""",
    
    "ollama": """# Ollama Setup Guide

**Installation:**
- Mac: `brew install ollama`
- Linux: `curl -fsSL https://ollama.ai/install.sh | sh`
- Windows: Download from ollama.ai

**Start Ollama:**
```bash
ollama serve
```

**Pull a model:**
```bash
ollama pull llama3
ollama pull mistral
ollama pull codellama
```

**Configure in Jyoti:**
1. Go to Admin → Configuration → GenAI
2. Set Provider: Ollama
3. Set Base URL: 
   - Local: http://localhost:11434
   - Docker: http://host.docker.internal:11434
4. Select your preferred model
5. Test connection

**Troubleshooting:**
- Check if Ollama is running: `curl http://localhost:11434/api/tags`
- If using Docker, ensure `extra_hosts` is configured
- Check firewall settings if connection fails
""",

    "servicenow": """# ServiceNow Integration

**Configuration:**
1. Admin → Configuration → Notifications
2. Enter ServiceNow instance URL (e.g., https://yourinstance.service-now.com)
3. Add API credentials (username/password or API key)
4. Test connection

**Features:**
- Auto-create incidents on hunt failures
- Link tickets to articles and IOCs
- Track resolution status

**Incident Fields Mapped:**
- Short description: Hunt name + Article title
- Description: IOCs, query, failure reason
- Priority: Based on article priority
- Category: Security
""",

    "hunt": """# Hunt Query Generation

**Workflow:**
1. Article gets IOCs extracted (automatic or manual)
2. Generate hunt query for target platform
3. Preview query before execution
4. Execute and review results
5. Create tickets/alerts as needed

**Supported Platforms:**
- Microsoft Defender (KQL)
- Splunk (SPL)
- Palo Alto XSIAM (XQL)
- Wiz (Cloud security)

**Troubleshooting:**
- No IOCs: Check if extraction ran successfully
- Query errors: Verify platform connector config
- Timeout: Increase timeout in configuration
- Auth errors: Re-check API credentials
""",

    "feed": """# RSS Feed Management

**Adding Feeds:**
1. Go to Sources page
2. Click "Add Source"
3. Enter RSS/Atom feed URL
4. Set priority and category
5. Enable active status

**Feed Types Supported:**
- RSS 2.0
- Atom 1.0
- RSS 1.0

**Troubleshooting:**
- Feed not updating: Check last_fetched time
- Parse errors: Verify URL is valid RSS/Atom
- Empty results: Some feeds require headers
- Duplicates: Articles matched by external_id

**High Fidelity Sources:**
Mark sources as "high fidelity" to:
- Auto-triage new articles
- Auto-generate hunt queries
- Skip manual review step
""",

    "rbac": """# Role-Based Access Control

**Built-in Roles:**
- ADMIN: Full system access
- EXECUTIVE: Reports and dashboards (read-only)
- MANAGER: Team oversight and metrics
- TI (Threat Intelligence): Article triage and analysis
- TH (Threat Hunter): Execute and manage hunts
- IR (Incident Response): View and respond to threats
- VIEWER: Read-only access

**Custom Permissions:**
Admin → Access Management → Roles
- Add/remove permissions per role
- Create custom role combinations

**Page Access:**
Configure which roles can access specific pages
""",

    "reports": """# Report Generation

**Report Types:**
- Intelligence Summary
- Hunt Results
- IOC Analysis
- Trend Analysis
- SLA Compliance

**Creating Reports:**
1. Go to Reports page
2. Select report type
3. Configure date range and filters
4. Generate report
5. Export as PDF or share

**Scheduled Reports:**
- Configure in Admin → Scheduler
- Set frequency (daily/weekly/monthly)
- Auto-email to stakeholders
"""
}


def find_best_help_match(question: str) -> str:
    """Find the best matching help documentation for a question."""
    question_lower = question.lower()
    
    # Keywords to topic mapping
    keyword_matches = {
        "ollama": ["ollama", "llama", "model", "genai setup", "ai setup", "local model"],
        "servicenow": ["servicenow", "snow", "ticket", "incident", "itsm"],
        "hunt": ["hunt", "query", "kql", "spl", "xql", "defender", "splunk", "xsiam", "wiz"],
        "feed": ["feed", "rss", "atom", "source", "ingest", "article"],
        "rbac": ["role", "permission", "access", "rbac", "user", "admin"],
        "reports": ["report", "pdf", "export", "analytics", "metrics"],
        "getting-started": ["start", "setup", "begin", "install", "configure", "first"]
    }
    
    best_match = "getting-started"
    best_score = 0
    
    for topic, keywords in keyword_matches.items():
        score = sum(1 for kw in keywords if kw in question_lower)
        if score > best_score:
            best_score = score
            best_match = topic
    
    return JYOTI_HELP_DOCS.get(best_match, JYOTI_HELP_DOCS["getting-started"])


@router.post("/help", response_model=HelpResponse)
async def get_help(
    request: HelpRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get help and documentation assistance using GenAI.
    Falls back to built-in documentation if GenAI is unavailable.
    """
    try:
        from app.genai.provider import get_genai_provider
        config_manager = GenAIConfigManager(db)
        use_case = "help"

        provider = get_genai_provider()

        relevant_doc = find_best_help_match(request.question)
        prompt = f"""You are Jyoti's AI assistant. Help the user with their question about the platform.

Reference Documentation:
{relevant_doc}

User Question: {request.question}

Provide a helpful, concise answer based on the documentation. If the question isn't covered, 
suggest where they might find more information or what steps to take.
"""

        role_name = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        config = config_manager.get_config(use_case=use_case, user_id=current_user.id, user_role=role_name)
        model_identifier = request.model or config.get("model_details", {}).get("identifier")

        if not model_identifier:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No GenAI model configured for help requests"
            )

        config_manager.validate_model_for_use_case(model_identifier, use_case, role_name)
        config_manager._check_quota(current_user.id, role_name)

        start_time = datetime.utcnow()
        response = await provider.generate(
            prompt=prompt,
            model=model_identifier,
            max_tokens=config.get("max_tokens", 500),
            temperature=config.get("temperature", 0.3),
            top_p=config.get("top_p", 0.9)
        )
        elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        if isinstance(response, dict):
            answer = response.get("text", relevant_doc)
            model_used = response.get("model") or model_identifier
        else:
            answer = response or relevant_doc
            model_used = model_identifier

        tokens_used = max(len(answer.split()), 1)
        config_manager.log_request(
            use_case=use_case,
            model_used=model_identifier,
            config_id=config.get("config_id"),
            user_id=current_user.id,
            prompt=prompt,
            response=answer,
            tokens_used=tokens_used,
            response_time_ms=elapsed_ms,
            was_successful=True
        )

        return HelpResponse(
            answer=answer,
            sources=["Jyoti Documentation"],
            model_used=model_used
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("genai_help_fallback", error=str(e))
        
        answer = find_best_help_match(request.question)

        return HelpResponse(
            answer=answer,
            sources=["Built-in Documentation"],
            model_used="fallback"
        )


@router.post("/troubleshoot", response_model=TroubleshootResponse)
async def troubleshoot(
    request: TroubleshootRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI-powered troubleshooting for common issues.
    """
    issue_lower = request.issue.lower()
    
    # Common issue patterns and fixes
    troubleshooting_guide = {
        "connection": {
            "diagnosis": "Connection issues typically relate to network, firewall, or configuration problems.",
            "fixes": [
                "Check if the service is running (e.g., docker-compose ps)",
                "Verify the URL/endpoint is correct",
                "Check firewall rules and network policies",
                "Test connectivity with curl or browser",
                "Review docker logs for error messages"
            ],
            "severity": "medium"
        },
        "401": {
            "diagnosis": "Authentication failed. Credentials may be incorrect or expired.",
            "fixes": [
                "Verify API key or credentials are correct",
                "Check if token has expired",
                "Regenerate credentials if needed",
                "Ensure correct authentication method is used"
            ],
            "severity": "high"
        },
        "genai": {
            "diagnosis": "GenAI/Ollama connectivity or configuration issue.",
            "fixes": [
                "Verify Ollama is running: curl http://localhost:11434/api/tags",
                "Check Ollama URL in Admin → Configuration → GenAI",
                "For Docker: Use http://host.docker.internal:11434",
                "Ensure model is pulled: ollama pull llama3",
                "Check docker-compose extra_hosts configuration"
            ],
            "severity": "medium"
        },
        "feed": {
            "diagnosis": "RSS/Atom feed ingestion issue.",
            "fixes": [
                "Verify feed URL is valid and accessible",
                "Check if feed source is marked as active",
                "Review last_fetched timestamp",
                "Check for parse errors in logs",
                "Test feed URL in browser or RSS reader"
            ],
            "severity": "low"
        },
        "hunt": {
            "diagnosis": "Hunt execution or query generation issue.",
            "fixes": [
                "Verify platform connector is configured",
                "Check API credentials and permissions",
                "Ensure article has extracted IOCs",
                "Review query syntax for the target platform",
                "Check execution timeout settings"
            ],
            "severity": "medium"
        },
        "permission": {
            "diagnosis": "Access denied. User may lack required permissions.",
            "fixes": [
                "Check user role in Admin → Access Management",
                "Verify role has required permissions",
                "Admin can grant additional permissions",
                "Check page access configuration"
            ],
            "severity": "low"
        }
    }
    
    # Find matching diagnosis
    result = {
        "diagnosis": "Issue requires further investigation.",
        "fixes": [
            "Check application logs for detailed errors",
            "Review recent configuration changes",
            "Restart the affected service",
            "Contact support with error details"
        ],
        "severity": "low"
    }
    
    for keyword, guide in troubleshooting_guide.items():
        if keyword in issue_lower:
            result = guide
            break
    
    return TroubleshootResponse(
        diagnosis=result["diagnosis"],
        suggested_fixes=result["fixes"],
        severity=result["severity"]
    )


@router.get("/suggestions")
async def get_suggestions(
    topic: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get contextual suggestions based on topic."""
    suggestions = {
        "general": [
            "How do I set up Ollama?",
            "How do I add a new RSS feed?",
            "How do I configure hunt platforms?",
            "How do I create a report?",
            "How do I manage user permissions?"
        ],
        "genai": [
            "How do I install Ollama?",
            "Which model should I use?",
            "How do I test the GenAI connection?",
            "Why is GenAI not responding?"
        ],
        "hunt": [
            "How do I generate a hunt query?",
            "How do I connect to Microsoft Defender?",
            "What do I do if a hunt fails?",
            "How do I auto-execute hunts?"
        ],
        "feed": [
            "How do I add a custom RSS feed?",
            "Why aren't my feeds updating?",
            "How do I set feed priority?",
            "What is high fidelity mode?"
        ]
    }
    
    return {
        "suggestions": suggestions.get(topic, suggestions["general"]),
        "topic": topic or "general"
    }


# ============================================================================
# MODEL CONFIGURATION ENDPOINTS
# ============================================================================

class ModelConfigCreate(BaseModel):
    """Schema for creating model configuration."""
    config_name: str = Field(..., min_length=1, max_length=100)
    config_type: str = Field(..., pattern="^(global|model|use_case)$")
    model_identifier: Optional[str] = Field(None, max_length=100)
    use_case: Optional[str] = Field(None, max_length=50)
    
    # Parameters
    temperature: float = Field(0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(2000, gt=0, le=100000)
    top_p: float = Field(0.9, ge=0.0, le=1.0)
    frequency_penalty: float = Field(0.0, ge=-2.0, le=2.0)
    presence_penalty: float = Field(0.0, ge=-2.0, le=2.0)
    
    # Advanced
    stop_sequences: Optional[List[str]] = []
    timeout_seconds: int = Field(30, gt=0, le=300)
    retry_attempts: int = Field(3, ge=0, le=10)
    preferred_model: Optional[str] = None
    
    # Cost control
    max_cost_per_request: Optional[float] = Field(None, ge=0)
    fallback_model: Optional[str] = None
    daily_request_limit: Optional[int] = Field(None, gt=0)
    
    # Security
    allowed_users: Optional[List[int]] = []
    allowed_roles: Optional[List[str]] = []
    require_approval: bool = False
    
    description: Optional[str] = None


class ModelConfigUpdate(BaseModel):
    """Schema for updating model configuration."""
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0, le=100000)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    frequency_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    stop_sequences: Optional[List[str]] = None
    timeout_seconds: Optional[int] = Field(None, gt=0, le=300)
    retry_attempts: Optional[int] = Field(None, ge=0, le=10)
    preferred_model: Optional[str] = None
    max_cost_per_request: Optional[float] = Field(None, ge=0)
    fallback_model: Optional[str] = None
    daily_request_limit: Optional[int] = Field(None, gt=0)
    allowed_users: Optional[List[int]] = None
    allowed_roles: Optional[List[str]] = None
    require_approval: Optional[bool] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class ModelRegistryCreate(BaseModel):
    """Schema for registering new model."""
    model_identifier: str = Field(..., min_length=1, max_length=100)
    provider: str = Field(..., pattern="^(openai|anthropic|gemini|ollama|other)$")
    model_name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=200)
    
    # Capabilities
    supports_streaming: bool = False
    supports_function_calling: bool = False
    supports_vision: bool = False
    max_context_length: int = Field(..., gt=0)
    
    # Cost
    cost_per_1k_input_tokens: Optional[float] = Field(None, ge=0)
    cost_per_1k_output_tokens: Optional[float] = Field(None, ge=0)
    is_free: bool = False
    
    # Security
    requires_api_key: bool = True
    is_local: bool = False
    
    # Access control
    allowed_for_use_cases: Optional[List[str]] = []
    restricted_to_roles: Optional[List[str]] = []
    
    description: Optional[str] = None
    documentation_url: Optional[str] = None


class QuotaCreate(BaseModel):
    """Schema for creating usage quota."""
    quota_name: str = Field(..., min_length=1, max_length=100)
    quota_type: str = Field(..., pattern="^(user|role|global)$")
    user_id: Optional[int] = None
    role_name: Optional[str] = None
    
    daily_request_limit: Optional[int] = Field(None, gt=0)
    monthly_request_limit: Optional[int] = Field(None, gt=0)
    daily_cost_limit: Optional[float] = Field(None, gt=0)
    monthly_cost_limit: Optional[float] = Field(None, gt=0)
    daily_token_limit: Optional[int] = Field(None, gt=0)
    monthly_token_limit: Optional[int] = Field(None, gt=0)


# ============================================================================
# MODEL REGISTRY ENDPOINTS
# ============================================================================

@router.get("/models/available")
async def get_available_models(
    provider: Optional[str] = None,
    is_free: Optional[bool] = None,
    is_local: Optional[bool] = None,
    use_case: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available models (enabled only)."""
    config_manager = GenAIConfigManager(db)
    models = config_manager.get_available_models(
        provider=provider,
        is_free=is_free,
        is_local=is_local,
        use_case=use_case
    )
    
    return {
        "models": [
            {
                "id": m.id,
                "model_identifier": m.model_identifier,
                "provider": m.provider,
                "model_name": m.model_name,
                "display_name": m.display_name,
                "supports_streaming": m.supports_streaming,
                "supports_function_calling": m.supports_function_calling,
                "supports_vision": m.supports_vision,
                "max_context_length": m.max_context_length,
                "cost_per_1k_input_tokens": m.cost_per_1k_input_tokens,
                "cost_per_1k_output_tokens": m.cost_per_1k_output_tokens,
                "is_free": m.is_free,
                "is_local": m.is_local,
                "description": m.description,
                "total_requests": m.total_requests,
                "avg_response_time_ms": m.avg_response_time_ms
            }
            for m in models
        ],
        "total": len(models)
    }


@router.get("/admin/models/available")
async def get_available_models_admin(
    provider: Optional[str] = None,
    is_free: Optional[bool] = None,
    is_local: Optional[bool] = None,
    use_case: Optional[str] = None,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Get all available models (enabled only) - Admin alias."""
    return await get_available_models(
        provider=provider,
        is_free=is_free,
        is_local=is_local,
        use_case=use_case,
        current_user=current_user,
        db=db,
    )


@router.get("/admin/models/all")
async def get_all_models(
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Get all registered models (including disabled) - Admin only."""
    models = db.query(GenAIModelRegistry).order_by(
        GenAIModelRegistry.provider,
        GenAIModelRegistry.model_name
    ).all()
    
    return {
        "models": [
            {
                "id": m.id,
                "model_identifier": m.model_identifier,
                "provider": m.provider,
                "model_name": m.model_name,
                "display_name": m.display_name,
                "is_enabled": m.is_enabled,
                "is_free": m.is_free,
                "is_local": m.is_local,
                "requires_admin_approval": m.requires_admin_approval,
                "approved_at": m.approved_at.isoformat() if m.approved_at else None,
                "total_requests": m.total_requests,
                "total_cost": m.total_cost,
                "last_used_at": m.last_used_at.isoformat() if m.last_used_at else None
            }
            for m in models
        ],
        "total": len(models)
    }


@router.post("/admin/models/register")
async def register_model(
    model_data: ModelRegistryCreate,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Register a new model - Admin only."""
    
    # Check if model already exists
    existing = db.query(GenAIModelRegistry).filter(
        GenAIModelRegistry.model_identifier == model_data.model_identifier
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model already registered"
        )
    
    # Create model
    model = GenAIModelRegistry(
        **model_data.dict(),
        is_enabled=False,  # Disabled by default for security
        added_by_user_id=current_user.id,
        added_at=datetime.utcnow()
    )
    
    db.add(model)
    db.commit()
    db.refresh(model)
    
    logger.info(
        "model_registered",
        model_id=model.id,
        identifier=model.model_identifier,
        user_id=current_user.id
    )
    
    return {
        "message": "Model registered successfully",
        "model_id": model.id,
        "model_identifier": model.model_identifier
    }


@router.post("/admin/models/deduplicate")
async def deduplicate_models(
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """
    Deduplicate the model registry by removing duplicate entries.
    
    This endpoint:
    1. Identifies models with duplicate model_identifier
    2. Keeps the most recently used/enabled one
    3. Removes or disables duplicates
    4. Returns a report of what was cleaned up
    """
    from sqlalchemy import func
    
    # Find duplicate model_identifiers
    duplicates = db.query(
        GenAIModelRegistry.model_identifier,
        func.count(GenAIModelRegistry.id).label('count')
    ).group_by(
        GenAIModelRegistry.model_identifier
    ).having(
        func.count(GenAIModelRegistry.id) > 1
    ).all()
    
    if not duplicates:
        return {
            "message": "No duplicates found",
            "duplicates_found": 0,
            "models_removed": 0
        }
    
    removed = []
    kept = []
    
    for dup in duplicates:
        identifier = dup.model_identifier
        
        # Get all models with this identifier
        models = db.query(GenAIModelRegistry).filter(
            GenAIModelRegistry.model_identifier == identifier
        ).order_by(
            GenAIModelRegistry.is_enabled.desc(),  # Enabled first
            GenAIModelRegistry.added_at.desc()      # Then newest
        ).all()
        
        # Keep the first (enabled and/or newest), remove rest
        keep = models[0]
        kept.append({
            "id": keep.id,
            "model_identifier": keep.model_identifier,
            "reason": "Kept as primary (enabled/newest)"
        })
        
        for model in models[1:]:
            removed.append({
                "id": model.id,
                "model_identifier": model.model_identifier,
                "was_enabled": model.is_enabled
            })
            db.delete(model)
    
    db.commit()
    
    logger.info(
        "models_deduplicated",
        duplicates_found=len(duplicates),
        models_removed=len(removed),
        user_id=current_user.id
    )
    
    return {
        "message": f"Deduplicated {len(duplicates)} duplicate model(s)",
        "duplicates_found": len(duplicates),
        "models_removed": len(removed),
        "removed": removed,
        "kept": kept
    }


@router.post("/admin/models/sync")
async def sync_models_with_providers(
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """
    Sync the model registry with actual available providers.
    
    This endpoint:
    1. Checks all configured providers (API keys, Ollama)
    2. Adds missing models to registry (disabled by default)
    3. Updates availability status of existing models
    4. Returns a sync report
    """
    from app.genai.provider import get_model_manager
    from app.core.config import settings
    import httpx
    
    manager = get_model_manager()
    sync_report = {
        "added": [],
        "updated": [],
        "unavailable": [],
        "already_exists": []
    }
    
    # Get existing registry entries
    existing_models = {
        m.model_identifier: m 
        for m in db.query(GenAIModelRegistry).all()
    }
    
    # Check OpenAI
    if settings.OPENAI_API_KEY:
        model_id = "openai"
        if model_id not in existing_models:
            model = GenAIModelRegistry(
                model_identifier=model_id,
                provider="openai",
                model_name=settings.OPENAI_MODEL or "gpt-4-turbo-preview",
                display_name="OpenAI GPT-4",
                is_enabled=False,
                is_free=False,
                is_local=False,
                max_context_length=128000,
                supports_streaming=True,
                supports_function_calling=True,
                added_by_user_id=current_user.id,
                added_at=datetime.utcnow()
            )
            db.add(model)
            sync_report["added"].append(model_id)
        else:
            sync_report["already_exists"].append(model_id)
    
    # Check Anthropic
    if settings.ANTHROPIC_API_KEY or settings.CLAUDE_API_KEY:
        model_id = "claude"
        if model_id not in existing_models:
            model = GenAIModelRegistry(
                model_identifier=model_id,
                provider="anthropic",
                model_name=settings.ANTHROPIC_MODEL or "claude-3-5-sonnet-20241022",
                display_name="Anthropic Claude",
                is_enabled=False,
                is_free=False,
                is_local=False,
                max_context_length=200000,
                supports_streaming=True,
                supports_function_calling=True,
                added_by_user_id=current_user.id,
                added_at=datetime.utcnow()
            )
            db.add(model)
            sync_report["added"].append(model_id)
        else:
            sync_report["already_exists"].append(model_id)
    
    # Check Gemini
    if settings.GEMINI_API_KEY:
        model_id = "gemini"
        if model_id not in existing_models:
            model = GenAIModelRegistry(
                model_identifier=model_id,
                provider="gemini",
                model_name="gemini-1.5-pro",
                display_name="Google Gemini Pro",
                is_enabled=False,
                is_free=False,
                is_local=False,
                max_context_length=1000000,
                supports_streaming=True,
                supports_function_calling=True,
                added_by_user_id=current_user.id,
                added_at=datetime.utcnow()
            )
            db.add(model)
            sync_report["added"].append(model_id)
        else:
            sync_report["already_exists"].append(model_id)
    
    # Check Ollama models
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                ollama_models = response.json().get("models", [])
                for ollama_model in ollama_models:
                    model_name = ollama_model["name"]
                    model_id = f"ollama:{model_name}"
                    
                    if model_id not in existing_models:
                        model = GenAIModelRegistry(
                            model_identifier=model_id,
                            provider="ollama",
                            model_name=model_name,
                            display_name=f"Ollama - {model_name}",
                            is_enabled=False,
                            is_free=True,
                            is_local=True,
                            max_context_length=8192,  # Default, varies by model
                            supports_streaming=True,
                            supports_function_calling=False,
                            description=f"Local Ollama model ({ollama_model.get('size', 'unknown')})",
                            added_by_user_id=current_user.id,
                            added_at=datetime.utcnow()
                        )
                        db.add(model)
                        sync_report["added"].append(model_id)
                    else:
                        sync_report["already_exists"].append(model_id)
    except Exception as e:
        sync_report["ollama_error"] = str(e)
    
    db.commit()
    
    logger.info(
        "models_synced",
        added=len(sync_report["added"]),
        already_exists=len(sync_report["already_exists"]),
        user_id=current_user.id
    )
    
    return {
        "message": f"Sync complete. Added {len(sync_report['added'])} new model(s).",
        **sync_report
    }


@router.patch("/admin/models/{model_id}/toggle")
async def toggle_model(
    model_id: int,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Enable/disable a model - Admin only."""
    model = db.query(GenAIModelRegistry).get(model_id)
    
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found"
        )
    
    model.is_enabled = not model.is_enabled
    
    # Auto-approve when enabling if not already approved
    if model.is_enabled and model.requires_admin_approval and not model.approved_at:
        model.approved_at = datetime.utcnow()
        model.approved_by_user_id = current_user.id
    
    db.commit()
    
    logger.info(
        "model_toggled",
        model_id=model.id,
        identifier=model.model_identifier,
        enabled=model.is_enabled,
        user_id=current_user.id
    )
    
    return {
        "message": f"Model {'enabled' if model.is_enabled else 'disabled'}",
        "model_id": model.id,
        "is_enabled": model.is_enabled
    }


# ============================================================================
# CONFIGURATION ENDPOINTS
# ============================================================================

@router.get("/admin/configs")
async def get_configs(
    config_type: Optional[str] = None,
    use_case: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Get all configurations."""
    query = db.query(GenAIModelConfig)
    
    if config_type:
        query = query.filter(GenAIModelConfig.config_type == config_type)
    
    if use_case:
        query = query.filter(GenAIModelConfig.use_case == use_case)
    
    if is_active is not None:
        query = query.filter(GenAIModelConfig.is_active == is_active)
    
    configs = query.order_by(GenAIModelConfig.config_type, GenAIModelConfig.config_name).all()
    
    return {
        "configs": [
            {
                "id": c.id,
                "config_name": c.config_name,
                "config_type": c.config_type,
                "model_identifier": c.model_identifier,
                "use_case": c.use_case,
                "temperature": c.temperature,
                "max_tokens": c.max_tokens,
                "top_p": c.top_p,
                "preferred_model": c.preferred_model,
                "is_active": c.is_active,
                "is_default": c.is_default,
                "total_requests": c.total_requests,
                "avg_cost_per_request": c.avg_cost_per_request,
                "last_used_at": c.last_used_at.isoformat() if c.last_used_at else None
            }
            for c in configs
        ],
        "total": len(configs)
    }


@router.post("/admin/configs")
async def create_config(
    config_data: ModelConfigCreate,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Create new configuration - Admin only."""
    
    # Check if config name already exists
    existing = db.query(GenAIModelConfig).filter(
        GenAIModelConfig.config_name == config_data.config_name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Configuration name already exists"
        )
    
    # Validate model if specified
    if config_data.preferred_model:
        config_manager = GenAIConfigManager(db)
        config_manager._validate_model(config_data.preferred_model)
    
    # Create configuration
    config = GenAIModelConfig(
        **config_data.dict(),
        created_by_user_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    logger.info(
        "config_created",
        config_id=config.id,
        config_name=config.config_name,
        user_id=current_user.id
    )
    
    return {
        "message": "Configuration created successfully",
        "config_id": config.id,
        "config_name": config.config_name
    }


@router.put("/admin/configs/{config_id}")
async def update_config(
    config_id: int,
    config_data: ModelConfigUpdate,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Update configuration - Admin only."""
    config = db.query(GenAIModelConfig).get(config_id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    # Update fields
    for field, value in config_data.dict(exclude_unset=True).items():
        setattr(config, field, value)
    
    config.updated_by_user_id = current_user.id
    config.updated_at = datetime.utcnow()
    config.version += 1
    
    db.commit()
    
    logger.info(
        "config_updated",
        config_id=config.id,
        config_name=config.config_name,
        user_id=current_user.id
    )
    
    return {
        "message": "Configuration updated successfully",
        "config_id": config.id,
        "version": config.version
    }


@router.delete("/admin/configs/{config_id}")
async def delete_config(
    config_id: int,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Soft delete configuration - Admin only."""
    config = db.query(GenAIModelConfig).get(config_id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    if config.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default configuration"
        )
    
    config.is_active = False
    config.updated_by_user_id = current_user.id
    config.updated_at = datetime.utcnow()
    
    db.commit()
    
    logger.info(
        "config_deleted",
        config_id=config.id,
        config_name=config.config_name,
        user_id=current_user.id
    )
    
    return {
        "message": "Configuration deleted successfully",
        "config_id": config.id
    }


# ============================================================================
# QUOTA ENDPOINTS
# ============================================================================

@router.get("/admin/quotas")
async def get_quotas(
    quota_type: Optional[str] = None,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Get all quotas - Admin only."""
    query = db.query(GenAIUsageQuota)
    
    if quota_type:
        query = query.filter(GenAIUsageQuota.quota_type == quota_type)
    
    quotas = query.order_by(GenAIUsageQuota.quota_type, GenAIUsageQuota.quota_name).all()
    
    return {
        "quotas": [
            {
                "id": q.id,
                "quota_name": q.quota_name,
                "quota_type": q.quota_type,
                "user_id": q.user_id,
                "role_name": q.role_name,
                "daily_request_limit": q.daily_request_limit,
                "monthly_request_limit": q.monthly_request_limit,
                "daily_cost_limit": q.daily_cost_limit,
                "monthly_cost_limit": q.monthly_cost_limit,
                "current_daily_requests": q.current_daily_requests,
                "current_monthly_requests": q.current_monthly_requests,
                "current_daily_cost": q.current_daily_cost,
                "current_monthly_cost": q.current_monthly_cost,
                "is_exceeded": q.is_exceeded,
                "is_active": q.is_active
            }
            for q in quotas
        ],
        "total": len(quotas)
    }


@router.post("/admin/quotas")
async def create_quota(
    quota_data: QuotaCreate,
    current_user: User = Depends(require_permission("manage:genai")),
    db: Session = Depends(get_db)
):
    """Create usage quota - Admin only."""
    
    # Check if quota already exists
    existing = db.query(GenAIUsageQuota).filter(
        GenAIUsageQuota.quota_name == quota_data.quota_name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Quota name already exists"
        )
    
    quota = GenAIUsageQuota(
        **quota_data.dict(),
        created_by_user_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        last_daily_reset=datetime.utcnow(),
        last_monthly_reset=datetime.utcnow()
    )
    
    db.add(quota)
    db.commit()
    db.refresh(quota)
    
    logger.info(
        "quota_created",
        quota_id=quota.id,
        quota_name=quota.quota_name,
        user_id=current_user.id
    )
    
    return {
        "message": "Quota created successfully",
        "quota_id": quota.id
    }


# ============================================================================
# USAGE STATISTICS
# ============================================================================

@router.get("/admin/usage/stats")
async def get_usage_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
    use_case: Optional[str] = None,
    current_user: User = Depends(require_permission("view:analytics")),
    db: Session = Depends(get_db)
):
    """Get usage statistics."""
    config_manager = GenAIConfigManager(db)
    stats = config_manager.get_usage_stats(
        start_date=start_date,
        end_date=end_date,
        user_id=user_id,
        use_case=use_case
    )
    
    return stats


@router.get("/my-quota")
async def get_my_quota(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's quota status."""
    quota = db.query(GenAIUsageQuota).filter(
        GenAIUsageQuota.quota_type == "user",
        GenAIUsageQuota.user_id == current_user.id,
        GenAIUsageQuota.is_active == True
    ).first()
    
    if not quota:
        return {
            "has_quota": False,
            "message": "No quota configured"
        }
    
    return {
        "has_quota": True,
        "daily_limit": quota.daily_request_limit,
        "daily_used": quota.current_daily_requests,
        "daily_remaining": (quota.daily_request_limit - quota.current_daily_requests) if quota.daily_request_limit else None,
        "monthly_limit": quota.monthly_request_limit,
        "monthly_used": quota.current_monthly_requests,
        "monthly_remaining": (quota.monthly_request_limit - quota.current_monthly_requests) if quota.monthly_request_limit else None,
        "daily_cost_limit": quota.daily_cost_limit,
        "daily_cost_used": quota.current_daily_cost,
        "monthly_cost_limit": quota.monthly_cost_limit,
        "monthly_cost_used": quota.current_monthly_cost,
        "is_exceeded": quota.is_exceeded
    }
