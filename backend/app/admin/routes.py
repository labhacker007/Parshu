"""Admin settings management API endpoints."""
import json
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.logging import logger
from app.core.crypto import decrypt_config_secret, encrypt_config_secret
from app.core.ssrf import SSRFPolicy, resolve_host_ips, is_ip_allowed, validate_outbound_url
from app.auth.dependencies import get_current_user, require_permission
from app.auth.rbac import Permission

# Helper to get permission value
MANAGE_USERS = Permission.MANAGE_USERS.value
MANAGE_CONNECTORS = Permission.MANAGE_CONNECTORS.value
VIEW_AUDIT_LOGS = Permission.VIEW_AUDIT_LOGS.value
MANAGE_RBAC = Permission.MANAGE_RBAC.value
from app.models import User, ConnectorConfig, FeedSource, SystemConfiguration, UserRole, AuditEventType
from app.automation.scheduler import hunt_scheduler
from app.audit.manager import AuditManager


router = APIRouter(prefix="/admin", tags=["Admin"])


def encrypt_value(value: str) -> str:
    """Encrypt a sensitive value."""
    return encrypt_config_secret(value)


def decrypt_value(encrypted: str) -> Optional[str]:
    """Decrypt a sensitive value."""
    return decrypt_config_secret(encrypted)


def _outbound_host_allowed(host: str) -> bool:
    try:
        ips = resolve_host_ips(host)
    except Exception:
        return False
    if not ips:
        return False
    for ip in ips:
        if not is_ip_allowed(ip, allow_private=settings.SSRF_ALLOW_PRIVATE_IPS, allow_loopback=False):
            return False
    return True


def _validate_ollama_base_url(url: str) -> None:
    validate_outbound_url(
        url,
        policy=SSRFPolicy(
            allow_private_ips=True,
            allow_loopback_ips=True,
            allowed_ports={80, 443, 11434},
        ),
    )


class SettingsResponse(BaseModel):
    """Current application settings (safe to expose)."""
    # General
    app_version: str
    debug: bool
    cors_origins: List[str]
    
    # Authentication
    saml_enabled: bool
    otp_enabled: bool
    jwt_expiry_minutes: int
    
    # GenAI
    genai_provider: str
    genai_configured: bool
    
    # Notifications
    smtp_configured: bool
    slack_configured: bool
    servicenow_configured: bool
    
    # Data retention
    article_retention_days: int
    audit_retention_days: int
    hunt_retention_days: int
    
    # Feature flags
    watchlists_enabled: bool


class SystemStatsResponse(BaseModel):
    """System statistics."""
    total_users: int
    total_sources: int
    total_articles: int
    total_hunts: int
    total_connectors: int
    active_connectors: int
    scheduled_jobs: int


class ConnectorSummary(BaseModel):
    """Summary of a connector configuration."""
    id: int
    name: str
    connector_type: str
    is_active: bool
    last_tested_at: Optional[str]
    last_test_status: Optional[str]


class FeatureFlagsUpdate(BaseModel):
    """Update feature flags."""
    watchlists_enabled: Optional[bool] = None
    otp_enabled: Optional[bool] = None


@router.post("/seed-database")
async def seed_database_endpoint(
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Seed the database with default data (sources, watchlist, connectors)."""
    try:
        from app.seeds import seed_database
        seed_database()
        
        # Get counts
        sources_count = db.query(FeedSource).count()
        
        return {
            "success": True,
            "message": "Database seeded successfully",
            "sources_count": sources_count
        }
    except Exception as e:
        logger.error("seed_database_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to seed database"
        )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Get current application settings."""
    return SettingsResponse(
        app_version=settings.APP_VERSION,
        debug=settings.DEBUG,
        cors_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
        
        saml_enabled=settings.SAML_ENABLED,
        otp_enabled=settings.ENABLE_OTP,
        jwt_expiry_minutes=settings.JWT_EXPIRE_MINUTES,
        
        genai_provider=settings.GENAI_PROVIDER,
        genai_configured=bool(settings.OPENAI_API_KEY or settings.GEMINI_API_KEY or settings.ANTHROPIC_API_KEY),
        
        smtp_configured=bool(settings.SMTP_HOST and settings.SMTP_USER),
        slack_configured=bool(settings.SLACK_BOT_TOKEN),
        servicenow_configured=bool(settings.SERVICENOW_INSTANCE_URL),
        
        article_retention_days=settings.ARTICLE_RETENTION_DAYS,
        audit_retention_days=settings.AUDIT_RETENTION_DAYS,
        hunt_retention_days=settings.HUNT_RETENTION_DAYS,
        
        watchlists_enabled=settings.ENABLE_WATCH_LISTS
    )


@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Get system statistics."""
    from app.models import Article, Hunt, FeedSource, ConnectorConfig
    
    total_users = db.query(User).count()
    total_sources = db.query(FeedSource).count()
    total_articles = db.query(Article).count()
    total_hunts = db.query(Hunt).count()
    total_connectors = db.query(ConnectorConfig).count()
    active_connectors = db.query(ConnectorConfig).filter(ConnectorConfig.is_active == True).count()
    scheduled_jobs = len(hunt_scheduler.get_jobs())
    
    return SystemStatsResponse(
        total_users=total_users,
        total_sources=total_sources,
        total_articles=total_articles,
        total_hunts=total_hunts,
        total_connectors=total_connectors,
        active_connectors=active_connectors,
        scheduled_jobs=scheduled_jobs
    )


@router.get("/connectors", response_model=List[ConnectorSummary])
async def get_connectors_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS))
):
    """Get summary of all connectors."""
    connectors = db.query(ConnectorConfig).all()
    
    return [
        ConnectorSummary(
            id=c.id,
            name=c.name,
            connector_type=c.connector_type,
            is_active=c.is_active,
            last_tested_at=c.last_tested_at.isoformat() if c.last_tested_at else None,
            last_test_status=c.last_test_status
        )
        for c in connectors
    ]


@router.get("/genai/status")
async def get_genai_status(
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS))
):
    """Get GenAI provider configuration status."""
    providers = {
        "openai": {
            "configured": bool(settings.OPENAI_API_KEY),
            "model": settings.OPENAI_MODEL if settings.OPENAI_API_KEY else None,
            "active": settings.GENAI_PROVIDER == "openai"
        },
        "gemini": {
            "configured": bool(settings.GEMINI_API_KEY),
            "model": settings.GEMINI_MODEL if settings.GEMINI_API_KEY else None,
            "active": settings.GENAI_PROVIDER == "gemini"
        },
        "anthropic": {
            "configured": bool(settings.ANTHROPIC_API_KEY),
            "model": settings.ANTHROPIC_MODEL if settings.ANTHROPIC_API_KEY else None,
            "active": settings.GENAI_PROVIDER == "anthropic"
        },
        "ollama": {
            "configured": bool(settings.OLLAMA_BASE_URL),
            "model": settings.OLLAMA_MODEL if settings.OLLAMA_BASE_URL else None,
            "base_url": settings.OLLAMA_BASE_URL if settings.OLLAMA_BASE_URL else None,
            "active": settings.GENAI_PROVIDER == "ollama"
        }
    }
    
    return {
        "active_provider": settings.GENAI_PROVIDER,
        "providers": providers
    }


@router.get("/scheduler/status")
async def get_scheduler_status(
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS))
):
    """Get scheduler status and jobs with last run information."""
    jobs = hunt_scheduler.get_jobs()
    
    return {
        "running": hunt_scheduler._running,
        "job_count": len(jobs),
        "jobs": jobs,
        "job_history": hunt_scheduler.get_job_history()
    }


@router.post("/scheduler/jobs/{job_id}/run")
async def run_scheduler_job_now(
    job_id: str,
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS)),
    db: Session = Depends(get_db)
):
    """Manually trigger a scheduled job to run immediately for testing."""
    from app.audit.manager import AuditManager
    from app.models import AuditEventType
    
    # Check if job exists
    job = hunt_scheduler.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    
    # Trigger the job
    success = hunt_scheduler.run_job_now(job_id, triggered_by=current_user.username)
    
    if success:
        # Log admin action
        AuditManager.log_event(
            db=db,
            event_type=AuditEventType.ADMIN_ACTION,
            action="scheduler_job_triggered",
            user_id=current_user.id,
            resource_type="scheduled_job",
            resource_id=None,
            details={"job_id": job_id, "job_name": job.get("name"), "triggered_by": current_user.username}
        )
        
        return {
            "success": True,
            "message": f"Job '{job_id}' triggered successfully",
            "job": job
        }
    else:
        raise HTTPException(status_code=500, detail=f"Failed to trigger job '{job_id}'")


@router.get("/health")
async def admin_health_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Detailed health check for admin dashboard."""
    health = {
        "status": "healthy",
        "checks": {}
    }
    
    # Database check
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        health["checks"]["database"] = {"status": "healthy"}
    except Exception as e:
        logger.error("admin_health_database_check_failed", error=str(e))
        health["checks"]["database"] = {"status": "unhealthy", "error": "check_failed"}
        health["status"] = "degraded"
    
    # Scheduler check
    try:
        jobs = hunt_scheduler.get_jobs()
        health["checks"]["scheduler"] = {
            "status": "healthy" if hunt_scheduler._running else "stopped",
            "jobs": len(jobs)
        }
    except Exception as e:
        logger.error("admin_health_scheduler_check_failed", error=str(e))
        health["checks"]["scheduler"] = {"status": "unhealthy", "error": "check_failed"}
        health["status"] = "degraded"
    
    # GenAI check
    genai_configured = bool(
        settings.OPENAI_API_KEY or 
        settings.GEMINI_API_KEY or 
        settings.ANTHROPIC_API_KEY or
        settings.OLLAMA_BASE_URL
    )
    health["checks"]["genai"] = {
        "status": "healthy" if genai_configured else "not_configured",
        "provider": settings.GENAI_PROVIDER
    }
    
    # Notifications check
    health["checks"]["notifications"] = {
        "email": "configured" if settings.SMTP_HOST else "not_configured",
        "slack": "configured" if settings.SLACK_BOT_TOKEN else "not_configured",
        "servicenow": "configured" if settings.SERVICENOW_INSTANCE_URL else "not_configured"
    }
    
    return health


@router.get("/audit-summary")
async def get_audit_summary(
    db: Session = Depends(get_db),
    days: int = 7,
    current_user: User = Depends(require_permission(VIEW_AUDIT_LOGS))
):
    """Get audit log summary for the last N days."""
    from datetime import datetime, timedelta
    from sqlalchemy import func
    from app.models import AuditLog, AuditEventType
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Count by event type
    event_counts = db.query(
        AuditLog.event_type,
        func.count(AuditLog.id)
    ).filter(
        AuditLog.created_at >= cutoff
    ).group_by(AuditLog.event_type).all()
    
    # Count by day
    daily_counts = db.query(
        func.date(AuditLog.created_at),
        func.count(AuditLog.id)
    ).filter(
        AuditLog.created_at >= cutoff
    ).group_by(func.date(AuditLog.created_at)).all()
    
    return {
        "period_days": days,
        "by_event_type": {et.value: count for et, count in event_counts},
        "by_day": {str(date): count for date, count in daily_counts},
        "total_events": sum(count for _, count in event_counts)
    }


# =============================================================================
# Configuration Management - Save/Load settings from database
# =============================================================================

class ConfigurationItem(BaseModel):
    """Single configuration item."""
    category: str
    key: str
    value: Optional[str] = None
    value_type: str = "string"
    is_sensitive: bool = False
    description: Optional[str] = None


class ConfigurationUpdate(BaseModel):
    """Batch update configuration."""
    configurations: List[ConfigurationItem]


class ConfigurationResponse(BaseModel):
    """Configuration response (masks sensitive values)."""
    category: str
    key: str
    value: Optional[str] = None
    value_type: str
    is_sensitive: bool
    description: Optional[str] = None
    is_configured: bool = False


# Configuration templates - define available settings
CONFIGURATION_TEMPLATES = {
    "genai": [
        {"key": "provider", "description": "Active GenAI provider (openai, anthropic, gemini, ollama)", "value_type": "string"},
        {"key": "primary_model", "description": "Primary GenAI model (e.g., ollama:llama3:latest, openai, claude)", "value_type": "string"},
        {"key": "secondary_model", "description": "Secondary/fallback GenAI model for redundancy", "value_type": "string"},
        {"key": "openai_api_key", "description": "OpenAI API Key", "is_sensitive": True},
        {"key": "openai_model", "description": "OpenAI Model (e.g., gpt-4)", "value_type": "string"},
        {"key": "anthropic_api_key", "description": "Anthropic API Key", "is_sensitive": True},
        {"key": "anthropic_model", "description": "Anthropic Model (e.g., claude-3-opus)", "value_type": "string"},
        {"key": "gemini_api_key", "description": "Google Gemini API Key", "is_sensitive": True},
        {"key": "gemini_model", "description": "Gemini Model", "value_type": "string"},
        {"key": "ollama_base_url", "description": "Ollama Base URL", "value_type": "string"},
        {"key": "ollama_model", "description": "Ollama Model", "value_type": "string"},
        {"key": "auto_summarize_on_ingestion", "description": "Automatically summarize articles on ingestion", "value_type": "bool"},
    ],
    "hunt_connectors": [
        {"key": "xsiam_api_key", "description": "Palo Alto XSIAM API Key", "is_sensitive": True},
        {"key": "xsiam_base_url", "description": "XSIAM API Base URL", "value_type": "string"},
        {"key": "defender_tenant_id", "description": "Microsoft Defender Tenant ID", "value_type": "string"},
        {"key": "defender_client_id", "description": "Microsoft Defender Client ID", "value_type": "string"},
        {"key": "defender_client_secret", "description": "Microsoft Defender Client Secret", "is_sensitive": True},
        {"key": "wiz_api_key", "description": "Wiz API Key", "is_sensitive": True},
        {"key": "wiz_base_url", "description": "Wiz API Base URL", "value_type": "string"},
        {"key": "splunk_host", "description": "Splunk Host", "value_type": "string"},
        {"key": "splunk_token", "description": "Splunk Auth Token", "is_sensitive": True},
        {"key": "splunk_port", "description": "Splunk Port", "value_type": "int"},
        {"key": "virustotal_api_key", "description": "VirusTotal API Key", "is_sensitive": True},
        {"key": "vmray_api_key", "description": "VMRay API Key", "is_sensitive": True},
        {"key": "vmray_base_url", "description": "VMRay Base URL", "value_type": "string"},
    ],
    "notifications": [
        {"key": "smtp_host", "description": "SMTP Server Host", "value_type": "string"},
        {"key": "smtp_port", "description": "SMTP Port", "value_type": "int"},
        {"key": "smtp_user", "description": "SMTP Username", "value_type": "string"},
        {"key": "smtp_password", "description": "SMTP Password", "is_sensitive": True},
        {"key": "smtp_from_email", "description": "From Email Address", "value_type": "string"},
        {"key": "slack_bot_token", "description": "Slack Bot Token", "is_sensitive": True},
        {"key": "slack_webhook_url", "description": "Slack Webhook URL", "is_sensitive": True},
        {"key": "servicenow_instance", "description": "ServiceNow Instance URL", "value_type": "string"},
        {"key": "servicenow_username", "description": "ServiceNow Username", "value_type": "string"},
        {"key": "servicenow_password", "description": "ServiceNow Password", "is_sensitive": True},
    ],
    "authentication": [
        {"key": "saml_enabled", "description": "Enable SAML/SSO Authentication", "value_type": "bool"},
        {"key": "saml_idp_entity_id", "description": "SAML IdP Entity ID", "value_type": "string"},
        {"key": "saml_idp_sso_url", "description": "SAML IdP SSO URL", "value_type": "string"},
        {"key": "saml_idp_cert", "description": "SAML IdP Certificate", "is_sensitive": True},
        {"key": "otp_enabled", "description": "Enable MFA/TOTP", "value_type": "bool"},
        {"key": "jwt_expiry_minutes", "description": "JWT Token Expiry (minutes)", "value_type": "int"},
    ],
    "data_retention": [
        {"key": "article_retention_days", "description": "Article Retention (days)", "value_type": "int"},
        {"key": "audit_retention_days", "description": "Audit Log Retention (days)", "value_type": "int"},
        {"key": "hunt_retention_days", "description": "Hunt Result Retention (days)", "value_type": "int"},
    ],
    "automation": [
        {"key": "enable_scheduler", "description": "Enable Automation Scheduler", "value_type": "bool"},
        {"key": "feed_check_interval", "description": "Feed Check Interval (minutes)", "value_type": "int"},
        {"key": "auto_extract_intelligence", "description": "Auto-extract IOCs/TTPs on ingestion", "value_type": "bool"},
        {"key": "auto_hunt_enabled", "description": "Enable Auto-Hunt for high-fidelity sources", "value_type": "bool"},
        # Hunt Automation Settings
        {"key": "auto_generate_hunts_high_priority", "description": "Auto-generate hunts for high priority articles", "value_type": "bool"},
        {"key": "auto_generate_hunts_all", "description": "Auto-generate hunts for all NEED_TO_HUNT articles", "value_type": "bool"},
        {"key": "auto_execute_hunts_high_priority", "description": "Auto-execute hunts for high priority articles", "value_type": "bool"},
        {"key": "auto_execute_hunts_all", "description": "Auto-execute all generated hunts", "value_type": "bool"},
        {"key": "hunt_failure_notify_email", "description": "Send email on hunt failure", "value_type": "bool"},
        {"key": "hunt_failure_notify_slack", "description": "Send Slack notification on hunt failure", "value_type": "bool"},
        {"key": "hunt_failure_notify_servicenow", "description": "Create ServiceNow ticket on hunt failure", "value_type": "bool"},
        {"key": "hunt_default_platforms", "description": "Default platforms for auto-hunt (comma-separated: defender,xsiam,splunk,wiz)", "value_type": "string"},
    ],
    "branding": [
        {"key": "company_name", "description": "Company/Organization Name (appears on reports)", "value_type": "string"},
        {"key": "company_logo_url", "description": "Company Logo URL (for HTML reports and dashboard)", "value_type": "string"},
        {"key": "confidentiality_notice", "description": "Confidentiality Notice (e.g., 'CONFIDENTIAL - Internal Use Only')", "value_type": "string"},
        {"key": "report_footer", "description": "Custom Footer Text for Reports", "value_type": "string"},
        {"key": "primary_color", "description": "Primary Brand Color (hex, e.g., #1890ff)", "value_type": "string"},
        {"key": "dark_color", "description": "Dark Brand Color for headers (hex, e.g., #1a1a2e)", "value_type": "string"},
    ],
}


@router.get("/configurations", response_model=Dict[str, List[ConfigurationResponse]])
async def get_all_configurations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Get all configuration categories and their current values."""
    result = {}
    
    # Get all stored configurations
    stored_configs = db.query(SystemConfiguration).all()
    stored_map = {f"{c.category}:{c.key}": c for c in stored_configs}
    
    for category, templates in CONFIGURATION_TEMPLATES.items():
        result[category] = []
        for template in templates:
            key = template["key"]
            full_key = f"{category}:{key}"
            stored = stored_map.get(full_key)
            
            is_sensitive = template.get("is_sensitive", False)
            
            if stored:
                # Mask sensitive values
                display_value = "••••••••" if is_sensitive and stored.value else stored.value
                result[category].append(ConfigurationResponse(
                    category=category,
                    key=key,
                    value=display_value,
                    value_type=template.get("value_type", "string"),
                    is_sensitive=is_sensitive,
                    description=template.get("description"),
                    is_configured=bool(stored.value)
                ))
            else:
                result[category].append(ConfigurationResponse(
                    category=category,
                    key=key,
                    value=None,
                    value_type=template.get("value_type", "string"),
                    is_sensitive=is_sensitive,
                    description=template.get("description"),
                    is_configured=False
                ))
    
    return result


@router.get("/configurations/{category}", response_model=List[ConfigurationResponse])
async def get_category_configurations(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Get configuration for a specific category."""
    if category not in CONFIGURATION_TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Category '{category}' not found")
    
    templates = CONFIGURATION_TEMPLATES[category]
    stored_configs = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == category
    ).all()
    stored_map = {c.key: c for c in stored_configs}
    
    result = []
    for template in templates:
        key = template["key"]
        stored = stored_map.get(key)
        is_sensitive = template.get("is_sensitive", False)
        
        display_value = None
        if stored and stored.value:
            display_value = "••••••••" if is_sensitive else stored.value
        
        result.append(ConfigurationResponse(
            category=category,
            key=key,
            value=display_value,
            value_type=template.get("value_type", "string"),
            is_sensitive=is_sensitive,
            description=template.get("description"),
            is_configured=bool(stored and stored.value)
        ))
    
    return result


@router.post("/configurations")
async def save_configurations(
    update: ConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Save configuration values. Updates existing or creates new."""
    saved_count = 0
    
    for config in update.configurations:
        # Validate category/key
        if config.category not in CONFIGURATION_TEMPLATES:
            continue
        
        template_keys = [t["key"] for t in CONFIGURATION_TEMPLATES[config.category]]
        if config.key not in template_keys:
            continue
        
        # Find template for this key
        template = next(
            (t for t in CONFIGURATION_TEMPLATES[config.category] if t["key"] == config.key),
            None
        )
        if not template:
            continue
        
        is_sensitive = template.get("is_sensitive", False)
        
        # Get or create configuration entry
        existing = db.query(SystemConfiguration).filter(
            SystemConfiguration.category == config.category,
            SystemConfiguration.key == config.key
        ).first()
        
        # Encrypt sensitive values
        value_to_store = config.value
        if is_sensitive and value_to_store:
            value_to_store = encrypt_value(value_to_store)
        
        if existing:
            # Only update if value changed (skip masked values)
            if config.value and config.value != "••••••••":
                existing.value = value_to_store
                existing.updated_by = current_user.id
                saved_count += 1
        else:
            new_config = SystemConfiguration(
                category=config.category,
                key=config.key,
                value=value_to_store,
                value_type=template.get("value_type", "string"),
                is_sensitive=is_sensitive,
                description=template.get("description"),
                updated_by=current_user.id
            )
            db.add(new_config)
            saved_count += 1
    
    db.commit()
    
    # Audit log
    from app.models import AuditEventType
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.CONNECTOR_CONFIG,
        action=f"Updated {saved_count} configuration settings",
        user_id=current_user.id,
        resource_type="system_config"
    )
    
    logger.info("configurations_saved", count=saved_count, user_id=current_user.id)
    
    return {"message": f"Saved {saved_count} configuration(s)", "saved_count": saved_count}


class SingleConfigurationUpdate(BaseModel):
    """Single configuration update request."""
    category: str
    key: str
    value: str
    is_sensitive: bool = False


@router.post("/configuration")
async def save_single_configuration(
    update: SingleConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """
    Save a single configuration value. 
    Creates or updates the configuration.
    Simpler API for direct key-value updates like API keys.
    """
    from app.models import AuditEventType
    
    # Encrypt sensitive values
    value_to_store = update.value
    if update.is_sensitive and value_to_store:
        value_to_store = encrypt_value(value_to_store)
    
    # Get or create configuration entry
    existing = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == update.category,
        SystemConfiguration.key == update.key
    ).first()
    
    if existing:
        existing.value = value_to_store
        existing.is_sensitive = update.is_sensitive
        existing.updated_by = current_user.id
    else:
        new_config = SystemConfiguration(
            category=update.category,
            key=update.key,
            value=value_to_store,
            value_type="string",
            is_sensitive=update.is_sensitive,
            description=f"Auto-created: {update.category}.{update.key}",
            updated_by=current_user.id
        )
        db.add(new_config)
    
    db.commit()
    
    # Audit log
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Updated configuration {update.category}.{update.key}",
        user_id=current_user.id,
        resource_type="system_config"
    )
    
    logger.info("configuration_saved", 
                category=update.category, 
                key=update.key, 
                is_sensitive=update.is_sensitive,
                user_id=current_user.id)
    
    return {
        "message": f"Configuration saved: {update.category}.{update.key}",
        "category": update.category,
        "key": update.key
    }


@router.delete("/configurations/{category}/{key}")
async def delete_configuration(
    category: str,
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Delete a configuration value (reset to default)."""
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == category,
        SystemConfiguration.key == key
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    db.delete(config)
    db.commit()
    
    logger.info("configuration_deleted", category=category, key=key, user_id=current_user.id)
    
    return {"message": f"Configuration {category}.{key} deleted"}


@router.post("/configurations/test/{category}")
async def test_configuration(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS))
):
    """Test configuration for a category (e.g., test SMTP connection)."""
    results = {"category": category, "tests": []}
    
    # Get stored configurations for this category
    configs = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == category
    ).all()
    config_map = {c.key: decrypt_value(c.value) if c.is_sensitive else c.value for c in configs}
    
    if category == "notifications":
        # Test SMTP
        smtp_host = config_map.get("smtp_host")
        if smtp_host:
            if not _outbound_host_allowed(smtp_host):
                results["tests"].append({"name": "SMTP Connection", "status": "failed", "error": "Host not allowed"})
            else:
                try:
                    import smtplib
                    server = smtplib.SMTP(
                        smtp_host,
                        int(config_map.get("smtp_port", 587))
                    )
                    server.ehlo()
                    server.quit()
                    results["tests"].append({"name": "SMTP Connection", "status": "success"})
                except Exception as e:
                    logger.warning("smtp_test_failed", error=str(e))
                    results["tests"].append({"name": "SMTP Connection", "status": "failed", "error": "failed"})
        
        # Test Slack
        if config_map.get("slack_bot_token"):
            try:
                from slack_sdk import WebClient
                client = WebClient(token=config_map.get("slack_bot_token"))
                client.auth_test()
                results["tests"].append({"name": "Slack API", "status": "success"})
            except Exception as e:
                logger.warning("slack_test_failed", error=str(e))
                results["tests"].append({"name": "Slack API", "status": "failed", "error": "failed"})
    
    elif category == "genai":
        provider = config_map.get("provider", settings.GENAI_PROVIDER or "ollama")
        
        # Test OpenAI
        if config_map.get("openai_api_key") or settings.OPENAI_API_KEY:
            try:
                import openai
                key = config_map.get("openai_api_key") or settings.OPENAI_API_KEY
                client = openai.OpenAI(api_key=key)
                client.models.list()
                results["tests"].append({"name": "OpenAI API", "status": "success"})
            except Exception as e:
                logger.warning("openai_test_failed", error=str(e))
                results["tests"].append({"name": "OpenAI API", "status": "failed", "error": "failed"})
        
        # Test Ollama - use sync httpx to avoid event loop issues
        # Prioritize environment variable for Docker compatibility (host.docker.internal)
        ollama_url = settings.OLLAMA_BASE_URL or config_map.get("ollama_base_url") or "http://host.docker.internal:11434"
        if ollama_url:
            try:
                import httpx
                _validate_ollama_base_url(ollama_url)
                
                # Use sync client to avoid event loop conflicts
                with httpx.Client(timeout=10.0) as http_client:
                    response = http_client.get(f"{ollama_url}/api/tags")
                    response.raise_for_status()
                    ollama_response = response.json()
                
                models = [m.get("name") for m in ollama_response.get("models", [])]
                results["tests"].append({
                    "name": "Ollama Connection", 
                    "status": "success",
                    "available_models": models[:10]
                })
            except httpx.ConnectError as e:
                logger.warning("ollama_connect_failed", error=str(e))
                results["tests"].append({
                    "name": "Ollama Connection", 
                    "status": "failed", 
                    "error": "Cannot connect to Ollama. Make sure it is running."
                })
            except Exception as e:
                logger.warning("ollama_test_failed", error=str(e))
                results["tests"].append({"name": "Ollama Connection", "status": "failed", "error": "failed"})
        
        # Test Anthropic
        if config_map.get("anthropic_api_key") or settings.ANTHROPIC_API_KEY:
            try:
                import anthropic
                key = config_map.get("anthropic_api_key") or settings.ANTHROPIC_API_KEY
                client = anthropic.Anthropic(api_key=key)
                # Just test auth by creating client
                results["tests"].append({"name": "Anthropic API", "status": "success"})
            except Exception as e:
                logger.warning("anthropic_test_failed", error=str(e))
                results["tests"].append({"name": "Anthropic API", "status": "failed", "error": "failed"})
        
        results["active_provider"] = provider
    
    return results


# =============================================================================
# GenAI Test Endpoints - For testing query generation and summarization
# =============================================================================

class GenAITestRequest(BaseModel):
    """Request for testing GenAI capabilities."""
    provider: Optional[str] = None  # openai, ollama, anthropic, gemini
    test_type: str = "query"  # query, summary, analysis
    platform: Optional[str] = "xsiam"  # For hunt query generation
    sample_content: Optional[str] = None  # Article content to summarize
    sample_iocs: Optional[List[str]] = None  # IOCs to use in query
    sample_ttps: Optional[List[str]] = None  # TTPs to use in query


class ModelPreferenceUpdate(BaseModel):
    """Update primary/secondary model preferences."""
    primary_model: Optional[str] = None
    secondary_model: Optional[str] = None


class OllamaQuickSetup(BaseModel):
    """Quick setup for Ollama - just URL and model name."""
    url: str = "http://localhost:11434"
    model: str = "llama3:latest"
    set_as_primary: bool = True
    auto_detect: bool = True  # Try multiple URLs if the provided one fails


@router.post("/genai/ollama/setup")
async def quick_setup_ollama(
    setup: OllamaQuickSetup,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Quick setup for Ollama - just provide URL and model name.
    
    This endpoint:
    1. Tests the Ollama connection (tries multiple URLs if auto_detect=True)
    2. Verifies the model is available
    3. Saves the configuration
    4. Sets Ollama as the primary GenAI provider if requested
    
    IMPORTANT: Since Jyoti runs in Docker, 'localhost' inside the container 
    refers to the container itself, NOT your host machine. Use one of:
    - http://host.docker.internal:11434 (Mac/Windows - to reach host's Ollama)
    - http://ollama:11434 (if Ollama runs as a Docker service in same network)
    - http://<your-ip>:11434 (use actual IP if on different network)
    """
    import httpx
    from app.genai.provider import get_model_manager
    
    # URLs to try (in order of preference)
    urls_to_try = [setup.url]
    
    if setup.auto_detect:
        # Add alternative URLs if the user provided localhost
        if "localhost" in setup.url or "127.0.0.1" in setup.url:
            # Since we're in Docker, localhost won't work - try host.docker.internal
            urls_to_try = [
                "http://host.docker.internal:11434",  # Docker Desktop (Mac/Windows)
                "http://ollama:11434",                # Docker service name
                setup.url,                            # Original URL last
            ]
        elif "host.docker.internal" not in setup.url:
            # Also try host.docker.internal as backup
            urls_to_try.append("http://host.docker.internal:11434")
    
    # Step 1: Test connection to Ollama - try multiple URLs
    working_url = None
    available_models = []
    last_error = None
    attempted_urls = []
    
    for url in urls_to_try:
        attempted_urls.append(url)
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(f"{url}/api/tags")
                response.raise_for_status()
                ollama_data = response.json()
                available_models = [m.get("name") for m in ollama_data.get("models", [])]
                working_url = url
                break
        except httpx.ConnectError as e:
            last_error = f"Connection refused at {url}"
            continue
        except Exception as e:
            last_error = f"Error at {url}"
            continue
    
    if not working_url:
        # Provide detailed help message
        error_msg = f"""Cannot connect to Ollama. Tried: {', '.join(attempted_urls)}

SOLUTION (Jyoti runs in Docker, so networking is different):

1. If Ollama runs on your HOST machine (most common):
   - Use URL: http://host.docker.internal:11434
   - This special Docker hostname reaches your Mac/Windows host

2. If Ollama runs in Docker (same compose network):
   - Use URL: http://ollama:11434
   - Add Ollama to your docker-compose.yml

3. Make sure Ollama is running:
   - Run: ollama serve
   - Or: docker run -d -p 11434:11434 --name ollama ollama/ollama

Last error: {last_error}"""
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Step 2: Check if model exists
    model_found = setup.model in available_models
    pull_suggestion = None
    url_was_auto_corrected = (working_url != setup.url)
    
    if not model_found:
        # Model not found - suggest pull
        pull_suggestion = f"Model '{setup.model}' not found. Run: 'ollama pull {setup.model}'"
        # Still save config, user can pull later
    
    # Step 3: Save configuration to database (use the WORKING URL, not the original)
    configs_to_save = [
        ("genai", "ollama_base_url", working_url),
        ("genai", "ollama_model", setup.model),
    ]
    
    if setup.set_as_primary:
        configs_to_save.append(("genai", "provider", "ollama"))
        configs_to_save.append(("genai", "primary_model", f"ollama:{setup.model}"))
    
    for category, key, value in configs_to_save:
        existing = db.query(SystemConfiguration).filter(
            SystemConfiguration.category == category,
            SystemConfiguration.key == key
        ).first()
        
        if existing:
            existing.value = value
            existing.updated_by = current_user.id
        else:
            db.add(SystemConfiguration(
                category=category,
                key=key,
                value=value,
                value_type="string",
                updated_by=current_user.id
            ))
    
    db.commit()
    
    # Step 4: Update model manager
    if setup.set_as_primary:
        manager = get_model_manager()
        manager.set_primary_model(f"ollama:{setup.model}")
        # Clear cache to refresh available models
        manager._available_models = None
    
    from app.models import AuditEventType
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.CONNECTOR_CONFIG,
        action=f"Quick setup Ollama: URL={working_url}, Model={setup.model}",
        user_id=current_user.id,
        resource_type="genai_config",
        details={"url_auto_corrected": url_was_auto_corrected, "original_url": setup.url}
    )
    
    logger.info("ollama_quick_setup_complete", 
               url=working_url, 
               original_url=setup.url,
               url_auto_corrected=url_was_auto_corrected,
               model=setup.model, 
               model_found=model_found,
               set_as_primary=setup.set_as_primary,
               user_id=current_user.id)
    
    # Build response message
    if url_was_auto_corrected:
        base_message = f"Ollama configured! URL auto-corrected to {working_url}"
    else:
        base_message = "Ollama configured successfully!"
    
    if not model_found:
        base_message = f"{base_message} (model needs to be pulled)"
    
    return {
        "success": True,
        "message": base_message,
        "url": working_url,
        "original_url": setup.url if url_was_auto_corrected else None,
        "url_auto_corrected": url_was_auto_corrected,
        "model": setup.model,
        "model_available": model_found,
        "available_models": available_models[:10],
        "set_as_primary": setup.set_as_primary,
        "pull_suggestion": pull_suggestion
    }


@router.get("/genai/ollama/status")
async def check_ollama_status(
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS))
):
    """Check Ollama connection status and provide installation instructions.
    
    Returns:
        - Connection status
        - Available models if connected
        - Docker installation instructions
        - Pull commands for recommended models
    """
    import httpx
    
    # Try different possible Ollama URLs
    possible_urls = [
        settings.OLLAMA_BASE_URL,
        "http://host.docker.internal:11434",  # Docker on Mac/Windows
        "http://localhost:11434",              # Local installation
        "http://ollama:11434",                 # Docker service name
    ]
    
    connected = False
    connected_url = None
    available_models = []
    error_message = None
    
    for url in possible_urls:
        if not url:
            continue
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    available_models = [m.get("name") for m in data.get("models", [])]
                    connected = True
                    connected_url = url
                    break
        except Exception as e:
            error_message = "Unable to connect to Ollama"
            continue

    if not connected and not error_message:
        error_message = "Unable to connect to Ollama"
    
    # Recommended models for threat intelligence
    recommended_models = [
        {"name": "llama3:latest", "size": "4.7GB", "description": "Best for general threat intelligence analysis"},
        {"name": "mistral:latest", "size": "4.1GB", "description": "Fast and efficient for IOC extraction"},
        {"name": "codellama:latest", "size": "3.8GB", "description": "Best for hunt query generation"},
        {"name": "llama3:8b", "size": "4.7GB", "description": "Balanced performance and quality"},
    ]
    
    # Installation instructions
    installation = {
        "local": {
            "title": "Install Ollama Locally",
            "steps": [
                "1. Download Ollama from https://ollama.com/download",
                "2. Install and run: `ollama serve`",
                "3. Pull a model: `ollama pull llama3:latest`",
                "4. Use URL: http://localhost:11434"
            ],
            "commands": [
                "curl -fsSL https://ollama.com/install.sh | sh",
                "ollama serve &",
                "ollama pull llama3:latest"
            ]
        },
        "docker": {
            "title": "Run Ollama in Docker",
            "steps": [
                "1. Run Ollama container:",
                "   `docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama`",
                "2. Pull a model inside container:",
                "   `docker exec ollama ollama pull llama3:latest`",
                "3. Use URL: http://host.docker.internal:11434 (Mac/Windows) or http://ollama:11434 (Docker network)"
            ],
            "docker_compose": """
# Add to docker-compose.yaml:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

volumes:
  ollama_data:
""",
            "commands": [
                "docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama",
                "docker exec ollama ollama pull llama3:latest",
                "docker exec ollama ollama list"
            ]
        }
    }
    
    return {
        "connected": connected,
        "connected_url": connected_url,
        "available_models": available_models,
        "error": error_message if not connected else None,
        "recommended_models": recommended_models,
        "installation": installation,
        "configured_url": settings.OLLAMA_BASE_URL,
        "configured_model": settings.OLLAMA_MODEL
    }


@router.post("/genai/ollama/pull-model")
async def pull_ollama_model(
    model_name: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Trigger a model pull on Ollama (if running).
    
    Note: This is a long-running operation. The model download happens in background.
    """
    import httpx
    
    # Find working Ollama URL
    possible_urls = [
        settings.OLLAMA_BASE_URL,
        "http://host.docker.internal:11434",
        "http://localhost:11434",
    ]
    
    ollama_url = None
    for url in possible_urls:
        if not url:
            continue
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{url}/api/tags")
                if response.status_code == 200:
                    ollama_url = url
                    break
        except:
            continue
    
    if not ollama_url:
        raise HTTPException(
            status_code=400,
            detail="Cannot connect to Ollama. Please ensure Ollama is running."
        )
    
    # Define background task for model pull
    def pull_model_background(url: str, model: str):
        """Pull model in background with streaming to avoid timeout."""
        try:
            # Use streaming mode with a long timeout
            with httpx.Client(timeout=600.0) as http_client:  # 10 minute timeout
                with http_client.stream("POST", f"{url}/api/pull", json={"name": model, "stream": True}) as response:
                    response.raise_for_status()
                    # Consume the stream to complete the download
                    for chunk in response.iter_bytes():
                        pass  # Just consume to keep connection alive
            logger.info("ollama_model_pull_complete", model=model, url=url)
        except Exception as e:
            logger.error("ollama_model_pull_failed", model=model, error=str(e))
    
    # Start the pull in background
    background_tasks.add_task(pull_model_background, ollama_url, model_name)
    
    logger.info("ollama_model_pull_started", model=model_name, url=ollama_url, user_id=current_user.id)
    
    return {
        "success": True,
        "message": f"Model '{model_name}' pull started in background. This may take several minutes depending on model size.",
        "model": model_name,
        "ollama_url": ollama_url,
        "note": "Refresh the page in a few minutes to see the model in the available models list."
    }


@router.delete("/genai/ollama/model/{model_name}")
async def delete_ollama_model(
    model_name: str,
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Delete a model from Ollama.
    
    This removes the model from local storage, freeing up disk space.
    """
    import httpx
    
    # Find working Ollama URL
    possible_urls = [
        settings.OLLAMA_BASE_URL,
        "http://host.docker.internal:11434",
        "http://localhost:11434",
    ]
    
    ollama_url = None
    for url in possible_urls:
        if not url:
            continue
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{url}/api/tags")
                if response.status_code == 200:
                    ollama_url = url
                    break
        except:
            continue
    
    if not ollama_url:
        raise HTTPException(
            status_code=400,
            detail="Cannot connect to Ollama. Please ensure Ollama is running."
        )
    
    try:
        with httpx.Client(timeout=30.0) as client:
            # Use request method with DELETE to properly include JSON body
            # Some httpx versions don't handle delete() with json= correctly
            response = client.request(
                method="DELETE",
                url=f"{ollama_url}/api/delete",
                json={"name": model_name}
            )
            response.raise_for_status()
            
        logger.info("ollama_model_deleted", model=model_name, url=ollama_url, user_id=current_user.id)
        
        return {
            "success": True,
            "message": f"Model '{model_name}' has been deleted from Ollama.",
            "model": model_name
        }
    except httpx.HTTPStatusError as e:
        logger.error("ollama_model_delete_failed", model=model_name, status=e.response.status_code, error=str(e))
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Model not found")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to delete model")
    except Exception as e:
        logger.error("ollama_model_delete_failed", model=model_name, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to delete model"
        )


@router.get("/genai/models")
async def get_available_models(
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS)),
    db: Session = Depends(get_db)
):
    """
    Get all available GenAI models (API and local).
    
    This endpoint:
    1. Checks runtime availability (API keys, Ollama status)
    2. Merges with database registry for persistent configuration
    3. Deduplicates models to avoid showing duplicates
    """
    from app.genai.provider import get_model_manager
    
    try:
        manager = get_model_manager()
        # Pass db session for registry lookup and deduplication
        models = await manager.get_available_models(force_refresh=True, db_session=db)
        
        # Additional deduplication pass - ensure no duplicate IDs
        seen_ids = set()
        unique_models = []
        for model in models:
            model_id = model.get("id", "")
            model_name = model.get("model", "")
            
            # Create a unique key from id and model name
            unique_key = f"{model_id}:{model_name}"
            
            if unique_key not in seen_ids:
                seen_ids.add(unique_key)
                unique_models.append(model)
            else:
                logger.debug("duplicate_model_filtered", model_id=model_id, model_name=model_name)
        
        return {
            "models": unique_models,
            "primary_model": manager.get_primary_model(),
            "secondary_model": manager.get_secondary_model(),
            "total_count": len(unique_models),
            "api_models": len([m for m in unique_models if m.get("type") == "api"]),
            "local_models": len([m for m in unique_models if m.get("type") == "local"]),
            "deduplicated": len(models) != len(unique_models)
        }
    except Exception as e:
        logger.error("get_available_models_failed", error=str(e))
        return {
            "models": [],
            "primary_model": settings.GENAI_PROVIDER or "ollama",
            "secondary_model": None,
            "error": "failed_to_get_models"
        }


@router.get("/genai/ollama/library")
async def get_ollama_model_library(
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS))
):
    """Get the Ollama model library with installation status and sizes.
    
    Returns a comprehensive list of popular Ollama models with:
    - Model name and size
    - Whether it's installed locally
    - Description and use case
    - Actual disk size if installed
    """
    import httpx
    
    # Comprehensive model library with sizes and descriptions
    MODEL_LIBRARY = [
        {"name": "llama3.3:latest", "size": "43GB", "description": "Latest Llama 3.3 - best overall quality", "category": "General"},
        {"name": "llama3.2:latest", "size": "2.0GB", "description": "Llama 3.2 - efficient and fast", "category": "General"},
        {"name": "llama3.1:latest", "size": "4.7GB", "description": "Llama 3.1 - balanced performance", "category": "General"},
        {"name": "llama3:latest", "size": "4.7GB", "description": "Llama 3 - recommended for threat intel", "category": "General"},
        {"name": "llama3:8b", "size": "4.7GB", "description": "Llama 3 8B - smaller, faster", "category": "General"},
        {"name": "llama3:70b", "size": "40GB", "description": "Llama 3 70B - highest quality", "category": "General"},
        {"name": "mistral:latest", "size": "4.1GB", "description": "Mistral 7B - fast and efficient", "category": "General"},
        {"name": "mixtral:latest", "size": "26GB", "description": "Mixtral 8x7B - advanced reasoning", "category": "General"},
        {"name": "codellama:latest", "size": "3.8GB", "description": "Code Llama - best for query generation", "category": "Code"},
        {"name": "codellama:7b", "size": "3.8GB", "description": "Code Llama 7B - code analysis", "category": "Code"},
        {"name": "codellama:13b", "size": "7.4GB", "description": "Code Llama 13B - better code quality", "category": "Code"},
        {"name": "codellama:34b", "size": "19GB", "description": "Code Llama 34B - highest code quality", "category": "Code"},
        {"name": "deepseek-r1:latest", "size": "4.7GB", "description": "DeepSeek R1 - reasoning model", "category": "Reasoning"},
        {"name": "deepseek-r1:8b", "size": "4.9GB", "description": "DeepSeek R1 8B - compact reasoning", "category": "Reasoning"},
        {"name": "deepseek-r1:14b", "size": "9.0GB", "description": "DeepSeek R1 14B - balanced reasoning", "category": "Reasoning"},
        {"name": "deepseek-r1:32b", "size": "20GB", "description": "DeepSeek R1 32B - advanced reasoning", "category": "Reasoning"},
        {"name": "deepseek-coder:latest", "size": "776MB", "description": "DeepSeek Coder - code specialist", "category": "Code"},
        {"name": "phi:latest", "size": "1.6GB", "description": "Microsoft Phi - very compact", "category": "Compact"},
        {"name": "phi3:latest", "size": "2.2GB", "description": "Microsoft Phi-3 - efficient", "category": "Compact"},
        {"name": "phi3:mini", "size": "2.2GB", "description": "Phi-3 Mini - smallest phi", "category": "Compact"},
        {"name": "gemma:latest", "size": "5.0GB", "description": "Google Gemma - general purpose", "category": "General"},
        {"name": "gemma:2b", "size": "1.4GB", "description": "Gemma 2B - very fast", "category": "Compact"},
        {"name": "gemma:7b", "size": "5.0GB", "description": "Gemma 7B - balanced", "category": "General"},
        {"name": "gemma2:latest", "size": "5.4GB", "description": "Gemma 2 - improved version", "category": "General"},
        {"name": "qwen:latest", "size": "4.4GB", "description": "Qwen - multilingual support", "category": "General"},
        {"name": "qwen2:latest", "size": "4.4GB", "description": "Qwen 2 - improved quality", "category": "General"},
        {"name": "qwen2.5:latest", "size": "4.7GB", "description": "Qwen 2.5 - latest version", "category": "General"},
        {"name": "qwen2.5-coder:latest", "size": "4.7GB", "description": "Qwen 2.5 Coder - code focused", "category": "Code"},
        {"name": "qwen3:latest", "size": "4.7GB", "description": "Qwen 3 - newest release", "category": "General"},
        {"name": "qwen3-coder:480b-cloud", "size": "Cloud", "description": "Qwen 3 Coder 480B - cloud model", "category": "Cloud"},
        {"name": "qwen3-vl:latest", "size": "4.7GB", "description": "Qwen 3 Vision - multimodal", "category": "Vision"},
        {"name": "yi:latest", "size": "3.5GB", "description": "01.AI Yi - efficient", "category": "General"},
        {"name": "vicuna:latest", "size": "3.8GB", "description": "Vicuna - conversational", "category": "General"},
        {"name": "neural-chat:latest", "size": "4.1GB", "description": "Intel Neural Chat", "category": "General"},
        {"name": "starling-lm:latest", "size": "4.1GB", "description": "Starling - RLHF tuned", "category": "General"},
        {"name": "openchat:latest", "size": "4.1GB", "description": "OpenChat - fine-tuned", "category": "General"},
        {"name": "orca-mini:latest", "size": "1.9GB", "description": "Orca Mini - compact", "category": "Compact"},
        {"name": "tinyllama:latest", "size": "637MB", "description": "TinyLlama - very small", "category": "Compact"},
        {"name": "stablelm:latest", "size": "1.6GB", "description": "StableLM - Stability AI", "category": "Compact"},
        {"name": "dolphin-mistral:latest", "size": "4.1GB", "description": "Dolphin Mistral - uncensored", "category": "General"},
        {"name": "wizard-math:latest", "size": "4.1GB", "description": "Wizard Math - math focused", "category": "Specialized"},
        {"name": "meditron:latest", "size": "4.1GB", "description": "Meditron - medical domain", "category": "Specialized"},
        {"name": "sqlcoder:latest", "size": "4.1GB", "description": "SQLCoder - SQL generation", "category": "Code"},
        {"name": "starcoder:latest", "size": "4.3GB", "description": "StarCoder - code generation", "category": "Code"},
        {"name": "starcoder2:latest", "size": "4.0GB", "description": "StarCoder2 - improved", "category": "Code"},
    ]
    
    # Try to get installed models from Ollama
    installed_models = {}
    ollama_connected = False
    connected_url = None
    
    possible_urls = [
        settings.OLLAMA_BASE_URL,
        "http://host.docker.internal:11434",
        "http://localhost:11434",
        "http://ollama:11434",
    ]
    
    for url in possible_urls:
        if not url:
            continue
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    ollama_connected = True
                    connected_url = url
                    # Get installed models with their actual sizes
                    for model in data.get("models", []):
                        name = model.get("name", "")
                        size_bytes = model.get("size", 0)
                        # Convert bytes to human readable
                        if size_bytes > 1e9:
                            size_str = f"{size_bytes / 1e9:.1f}GB"
                        elif size_bytes > 1e6:
                            size_str = f"{size_bytes / 1e6:.1f}MB"
                        else:
                            size_str = f"{size_bytes / 1e3:.1f}KB"
                        installed_models[name] = {
                            "size": size_str,
                            "size_bytes": size_bytes,
                            "digest": model.get("digest", ""),
                            "modified_at": model.get("modified_at", "")
                        }
                    break
        except Exception:
            continue
    
    # Build library response with installation status
    library = []
    for model in MODEL_LIBRARY:
        model_name = model["name"]
        is_installed = model_name in installed_models
        
        entry = {
            **model,
            "installed": is_installed,
            "actual_size": installed_models.get(model_name, {}).get("size") if is_installed else None,
            "size_bytes": installed_models.get(model_name, {}).get("size_bytes", 0) if is_installed else 0,
        }
        library.append(entry)
    
    # Add any installed models not in our library
    for name, info in installed_models.items():
        if not any(m["name"] == name for m in library):
            library.append({
                "name": name,
                "size": info["size"],
                "actual_size": info["size"],
                "size_bytes": info["size_bytes"],
                "description": "Custom/unlisted model",
                "category": "Custom",
                "installed": True
            })
    
    # Sort: installed first, then by category
    library.sort(key=lambda x: (not x["installed"], x.get("category", "Z"), x["name"]))
    
    return {
        "connected": ollama_connected,
        "connected_url": connected_url,
        "installed_count": len(installed_models),
        "library_count": len(library),
        "models": library,
        "categories": list(set(m.get("category", "General") for m in library))
    }


@router.post("/genai/models/preferences")
async def set_model_preferences(
    preferences: ModelPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Set primary and secondary GenAI model preferences."""
    from app.genai.provider import get_model_manager
    
    manager = get_model_manager()
    
    if preferences.primary_model:
        manager.set_primary_model(preferences.primary_model)
        # Also save to database
        existing = db.query(SystemConfiguration).filter(
            SystemConfiguration.category == "genai",
            SystemConfiguration.key == "primary_model"
        ).first()
        
        if existing:
            existing.value = preferences.primary_model
            existing.updated_by = current_user.id
        else:
            db.add(SystemConfiguration(
                category="genai",
                key="primary_model",
                value=preferences.primary_model,
                value_type="string",
                description="Primary GenAI model for all operations",
                updated_by=current_user.id
            ))
    
    # Handle secondary model - allow setting to None to clear it
    if preferences.secondary_model is not None:
        if preferences.secondary_model:
            manager.set_secondary_model(preferences.secondary_model)
        else:
            manager.set_secondary_model(None)  # Clear secondary model
        
        # Also save to database
        existing = db.query(SystemConfiguration).filter(
            SystemConfiguration.category == "genai",
            SystemConfiguration.key == "secondary_model"
        ).first()
        
        if existing:
            if preferences.secondary_model:
                existing.value = preferences.secondary_model
                existing.updated_by = current_user.id
            else:
                # Clear the value if secondary model is empty string
                db.delete(existing)
        elif preferences.secondary_model:
            db.add(SystemConfiguration(
                category="genai",
                key="secondary_model",
                value=preferences.secondary_model,
                value_type="string",
                description="Secondary/fallback GenAI model",
                updated_by=current_user.id
            ))
    
    db.commit()
    
    from app.models import AuditEventType
    AuditManager.log_event(
        db=db,
        event_type=AuditEventType.CONNECTOR_CONFIG,
        action=f"Updated GenAI model preferences: primary={preferences.primary_model}, secondary={preferences.secondary_model}",
        user_id=current_user.id,
        resource_type="genai_config"
    )
    
    logger.info("genai_preferences_updated", 
               primary=preferences.primary_model, 
               secondary=preferences.secondary_model,
               user_id=current_user.id)
    
    return {
        "message": "Model preferences updated",
        "primary_model": manager.get_primary_model(),
        "secondary_model": manager.get_secondary_model()
    }


@router.post("/genai/test")
async def test_genai_generation(
    request: GenAITestRequest,
    current_user: User = Depends(require_permission(MANAGE_CONNECTORS))
):
    """Test GenAI query generation, summarization, or analysis."""
    from app.genai.provider import GenAIOrchestrator
    
    provider = request.provider or settings.GENAI_PROVIDER or "ollama"
    
    try:
        orchestrator = GenAIOrchestrator(provider)
        
        if request.test_type == "query":
            # Test hunt query generation
            sample_intelligence = {
                "iocs": [
                    {"type": "ip", "value": ioc} for ioc in (request.sample_iocs or ["192.168.1.100", "10.0.0.50"])
                ] + [
                    {"type": "domain", "value": "malicious-domain.com"},
                    {"type": "hash", "value": "d41d8cd98f00b204e9800998ecf8427e"}
                ],
                "ttps": [
                    {"mitre_id": ttp, "name": f"Technique {ttp}"} 
                    for ttp in (request.sample_ttps or ["T1059", "T1053"])
                ],
                "ioas": [
                    {"type": "ioa", "category": "credential_dumping"},
                    {"type": "ioa", "category": "lateral_movement"}
                ]
            }
            
            # Include product documentation in the prompt
            product_docs = get_platform_documentation(request.platform)
            
            result = await orchestrator.generate_hunt_query(
                platform=request.platform,
                intelligence=sample_intelligence,
                product_docs=product_docs
            )
            
            return {
                "status": "success",
                "provider": provider,
                "model": result.get("model"),
                "test_type": "hunt_query",
                "platform": request.platform,
                "generated_query": result.get("query"),
                "is_fallback": result.get("is_fallback", False)
            }
        
        elif request.test_type == "summary":
            # Test executive summary generation
            sample_content = request.sample_content or """
            A new ransomware campaign targeting healthcare organizations has been observed.
            The threat actors are using spear-phishing emails with malicious Excel attachments.
            Once executed, the malware establishes persistence via scheduled tasks and 
            communicates with C2 servers at 192.168.1.100 and malicious-domain.com.
            The ransomware encrypts files using AES-256 and demands payment in Bitcoin.
            MITRE ATT&CK techniques observed: T1566 (Phishing), T1053 (Scheduled Task),
            T1071 (Application Layer Protocol), T1486 (Data Encrypted for Impact).
            """
            
            sample_intelligence = {
                "iocs": [{"type": "ip", "value": "192.168.1.100"}, {"type": "domain", "value": "malicious-domain.com"}],
                "ttps": [{"mitre_id": "T1566", "name": "Phishing"}, {"mitre_id": "T1486", "name": "Data Encrypted"}],
                "ioas": []
            }
            
            summary = await orchestrator.generate_executive_summary(sample_content, sample_intelligence)
            
            return {
                "status": "success",
                "provider": provider,
                "test_type": "executive_summary",
                "generated_summary": summary
            }
        
        elif request.test_type == "analysis":
            # Test hunt result analysis
            sample_results = {
                "platform": request.platform,
                "hits": 5,
                "data": [
                    {"hostname": "WORKSTATION01", "ip": "192.168.1.100", "process": "powershell.exe"},
                    {"hostname": "SERVER02", "ip": "10.0.0.50", "file_hash": "d41d8cd98f00b204e9800998ecf8427e"}
                ]
            }
            
            context = {
                "title": "Test Threat Analysis",
                "summary": "Testing hunt result analysis capabilities"
            }
            
            sample_intelligence = {"iocs": [], "ttps": []}
            
            analysis = await orchestrator.analyze_hunt_results(sample_results, context, sample_intelligence)
            
            return {
                "status": "success",
                "provider": provider,
                "test_type": "hunt_analysis",
                "analysis": analysis
            }
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown test type: {request.test_type}")
    
    except Exception as e:
        logger.error("genai_test_failed", provider=provider, error=str(e))
        return {
            "status": "failed",
            "provider": provider,
            "error": "genai_test_failed",
            "suggestion": "Make sure your GenAI provider is configured correctly. For Ollama, ensure it's running at the configured URL."
        }


def get_platform_documentation(platform: str) -> str:
    """Get platform-specific query documentation to include in prompts."""
    
    docs = {
        "xsiam": """
CORTEX XSIAM XQL QUERY REFERENCE (Latest 2025):

Data Sources:
- xdr_data: Endpoint telemetry (processes, files, network)
- cloud_audit_logs: Cloud provider audit events
- identity_data: User authentication events
- network_story: Network flow data

Key Fields:
- action_process_image_sha256: File hash
- action_remote_ip, action_local_ip: Network IPs
- action_file_path: File paths
- agent_hostname: Endpoint name
- dns_query_name: DNS queries
- actor_effective_username: User context

Operators:
- =, !=, ~= (regex), contains, in, not in
- Wildcards: * (multiple chars)
- Time: _time >= now() - 7d

Example Production Query:
dataset = xdr_data
| filter action_remote_ip in ("1.2.3.4", "5.6.7.8") 
    or action_process_image_sha256 in ("hash1", "hash2")
| fields _time, agent_hostname, action_remote_ip, action_process_image_sha256
| sort desc _time
| limit 1000
""",
        
        "defender": """
MICROSOFT DEFENDER KQL QUERY REFERENCE (Latest 2025):

Tables:
- DeviceProcessEvents: Process execution
- DeviceNetworkEvents: Network connections
- DeviceFileEvents: File operations
- DeviceLogonEvents: Authentication
- DeviceRegistryEvents: Registry changes
- EmailEvents: Email security

Key Fields:
- Timestamp, DeviceName, DeviceId
- InitiatingProcessFileName, InitiatingProcessCommandLine
- RemoteIP, RemoteUrl, RemotePort
- SHA256, SHA1, MD5
- AccountName, AccountDomain

Operators:
- ==, !=, contains, has, startswith, endswith
- in, !in, has_any, has_all
- matches regex

Example Production Query:
let iocs = dynamic(["1.2.3.4", "5.6.7.8"]);
DeviceNetworkEvents
| where Timestamp > ago(7d)
| where RemoteIP in (iocs)
| project Timestamp, DeviceName, RemoteIP, InitiatingProcessFileName
| order by Timestamp desc
""",

        "splunk": """
SPLUNK SPL QUERY REFERENCE (Latest 2025):

Index Selection:
- index=main, index=security, index=network

Search Commands:
- search: Basic filtering
- where: Conditional filtering
- stats: Aggregations (count, sum, values)
- table: Column selection
- eval: Field calculations
- rex: Regex extraction
- lookup: Enrichment

Time Range:
- earliest=-7d latest=now
- earliest=@d (start of day)

Example Production Query:
index=security sourcetype=*
earliest=-7d
(dest_ip IN ("1.2.3.4", "5.6.7.8") OR file_hash IN ("hash1", "hash2"))
| stats count by src_ip, dest_ip, file_hash, host
| where count > 1
| sort -count
""",

        "wiz": """
WIZ CLOUD SECURITY QUERY REFERENCE (Latest 2025):

Query Types:
- securityFindings: Vulnerabilities and misconfigurations
- cloudResources: Cloud infrastructure
- containerImages: Container security
- kubernetesResources: K8s workloads

Filters:
- severity: CRITICAL, HIGH, MEDIUM, LOW
- status: OPEN, RESOLVED, IN_PROGRESS
- provider: AWS, AZURE, GCP

Example Production Query:
{
  securityFindings(
    filter: {
      severity: { equals: CRITICAL }
      status: { equals: OPEN }
    }
    first: 100
  ) {
    nodes {
      id
      title
      severity
      affectedResource { name type provider }
    }
  }
}
"""
    }
    
    return docs.get(platform.lower(), f"# {platform.upper()} query documentation not available")


# ============================================================================
# GUARDRAILS MANAGEMENT ENDPOINTS
# ============================================================================

class GuardrailItem(BaseModel):
    """Single guardrail configuration."""
    id: str
    name: str
    description: str
    enabled: bool = True
    category: str = "quality"  # quality, format, filtering, validation


class GuardrailsUpdate(BaseModel):
    """Request to update guardrails for a function."""
    function_name: str
    guardrails: List[GuardrailItem]


class GuardrailsResponse(BaseModel):
    """Response with guardrails and metadata."""
    function_name: str
    guardrails: List[Dict]
    is_custom: bool
    last_updated: Optional[str] = None


@router.get("/guardrails", summary="Get all available guardrails")
async def get_all_guardrails(
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Get all guardrails organized by function with custom overrides."""
    from app.genai.prompts import get_all_guardrails, get_all_functions, get_all_personas
    
    default_guardrails = get_all_guardrails()
    functions = get_all_functions()
    personas = get_all_personas()
    
    # Load custom guardrails from database
    custom_guardrails = {}
    configs = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails"
    ).all()
    
    for config in configs:
        try:
            custom_guardrails[config.key] = {
                "guardrails": json.loads(config.value) if config.value else [],
                "updated_at": config.updated_at.isoformat() if config.updated_at else None,
                "updated_by": config.updated_by
            }
        except json.JSONDecodeError:
            pass
    
    return {
        "default_guardrails": default_guardrails,
        "custom_guardrails": custom_guardrails,
        "available_functions": functions,
        "available_personas": list(personas.keys()),
        "categories": ["quality", "format", "filtering", "validation"]
    }


@router.get("/guardrails/{function_name}", summary="Get guardrails for a specific function")
async def get_function_guardrails(
    function_name: str,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Get guardrails for a specific GenAI function."""
    from app.genai.prompts import DEFAULT_GUARDRAILS, get_all_functions
    
    # Redirect to dedicated global guardrails endpoint if function_name is "global"
    if function_name == "global":
        return await get_global_guardrails(current_user, db)
    
    functions = get_all_functions()
    if function_name not in functions and function_name not in DEFAULT_GUARDRAILS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown function: {function_name}. Available: {functions}"
        )
    
    # Get default guardrails
    defaults = []
    
    # Map function name to guardrail category
    category_map = {
        "ioc_extraction": "ioc_extraction",
        "ttp_extraction": "ttp_extraction",
        "executive_summary": "summary",
        "technical_summary": "summary",
        "article_summary": "summary",
        "hunt_query_xsiam": "hunt_query",
        "hunt_query_defender": "hunt_query",
        "hunt_query_splunk": "hunt_query",
        "hunt_query_wiz": "hunt_query",
    }
    
    category = category_map.get(function_name, function_name)
    if category in DEFAULT_GUARDRAILS:
        defaults = DEFAULT_GUARDRAILS[category]
    
    # Always include global guardrails
    global_guardrails = DEFAULT_GUARDRAILS.get("global", [])
    
    # Check for custom overrides
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == function_name
    ).first()
    
    custom = []
    is_custom = False
    last_updated = None
    
    if config and config.value:
        try:
            custom = json.loads(config.value)
            is_custom = True
            last_updated = config.updated_at.isoformat() if config.updated_at else None
        except json.JSONDecodeError:
            pass
    
    return {
        "function_name": function_name,
        "global_guardrails": global_guardrails,
        "function_guardrails": defaults,
        "custom_guardrails": custom,
        "is_custom": is_custom,
        "last_updated": last_updated,
        "effective_guardrails": custom if is_custom else defaults
    }


@router.put("/guardrails/{function_name}", summary="Update guardrails for a function")
async def update_function_guardrails(
    function_name: str,
    request: GuardrailsUpdate,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Update or create custom guardrails for a GenAI function."""
    from app.genai.prompts import get_all_functions
    from app.models import AuditEventType
    
    functions = get_all_functions()
    # Allow custom function names for flexibility
    
    # Validate guardrails
    for g in request.guardrails:
        if not all([g.id, g.name, g.description]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Guardrail missing required fields: {g}"
            )
    
    # Check if config exists
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == function_name
    ).first()
    
    guardrails_json = json.dumps([g.model_dump() for g in request.guardrails])
    
    if config:
        config.value = guardrails_json
        config.updated_by = current_user.id
    else:
        config = SystemConfiguration(
            category="guardrails",
            key=function_name,
            value=guardrails_json,
            value_type="json",
            is_sensitive=False,
            description=f"Custom guardrails for {function_name}",
            updated_by=current_user.id
        )
        db.add(config)
    
    db.commit()
    
    # Audit log
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Updated guardrails for {function_name}",
        resource_type=f"guardrails:{function_name}",
        resource_id=None
    )
    
    logger.info("guardrails_updated", 
                function=function_name, 
                count=len(request.guardrails),
                user_id=current_user.id)
    
    return {
        "message": f"Guardrails updated for {function_name}",
        "function_name": function_name,
        "guardrail_count": len(request.guardrails)
    }


@router.delete("/guardrails/{function_name}", summary="Reset guardrails to defaults")
async def reset_function_guardrails(
    function_name: str,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Reset guardrails to defaults by removing custom overrides."""
    from app.models import AuditEventType
    
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == function_name
    ).first()
    
    if config:
        db.delete(config)
        db.commit()
        
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.SYSTEM_CONFIG,
            action=f"Reset guardrails to defaults for {function_name}",
            resource_type=f"guardrails:{function_name}",
            resource_id=None
        )
        
        logger.info("guardrails_reset", function=function_name, user_id=current_user.id)
        
        return {"message": f"Guardrails reset to defaults for {function_name}"}
    
    return {"message": f"No custom guardrails found for {function_name}"}


# ============================================================================
# GLOBAL GUARDRAILS MANAGEMENT
# ============================================================================

class GlobalGuardrailCreate(BaseModel):
    """Request to create a global guardrail."""
    id: str
    name: str
    description: str
    category: str = "data_protection"
    severity: str = "high"
    enabled: bool = True
    prompt_template: Optional[str] = None
    validation_pattern: Optional[str] = None


class GlobalGuardrailUpdate(BaseModel):
    """Request to update a global guardrail."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None
    prompt_template: Optional[str] = None
    validation_pattern: Optional[str] = None


@router.get("/guardrails/global", summary="Get all global guardrails")
async def get_global_guardrails(
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Get all global guardrails (built-in + custom) with full details."""
    from app.genai.prompts import DEFAULT_GUARDRAILS
    
    # Get built-in global guardrails
    built_in = DEFAULT_GUARDRAILS.get("global", [])
    
    # Get overrides for built-in guardrails
    override_config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == "global_overrides"
    ).first()
    
    overrides = {}
    if override_config and override_config.value:
        try:
            overrides = json.loads(override_config.value)
        except:
            pass
    
    # Apply overrides to built-in guardrails
    for g in built_in:
        if g["id"] in overrides:
            g["enabled"] = overrides[g["id"]].get("enabled", g.get("enabled", True))
        g["is_builtin"] = True
        g["can_disable"] = True  # Admin can disable built-in guardrails
        g["can_delete"] = False  # Cannot delete built-in guardrails
    
    # Get custom global guardrails from database
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == "global_custom"
    ).first()
    
    custom = []
    if config and config.value:
        try:
            custom = json.loads(config.value)
            for g in custom:
                g["is_builtin"] = False
                g["can_disable"] = True
                g["can_delete"] = True
        except:
            pass
    
    # Combine all guardrails
    all_guardrails = built_in + custom
    
    # Count by category
    by_category = {}
    for g in all_guardrails:
        cat = g.get("category", "other")
        by_category[cat] = by_category.get(cat, 0) + 1
    
    # Count enabled/disabled
    enabled_count = sum(1 for g in all_guardrails if g.get("enabled", True))
    
    return {
        "built_in": built_in,
        "custom": custom,
        "all": all_guardrails,
        "summary": {
            "total": len(all_guardrails),
            "enabled": enabled_count,
            "disabled": len(all_guardrails) - enabled_count,
            "builtin_count": len(built_in),
            "custom_count": len(custom),
            "by_category": by_category
        }
    }


@router.post("/guardrails/global", summary="Create a custom global guardrail")
async def create_global_guardrail(
    request: GlobalGuardrailCreate,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Create a new custom global guardrail."""
    from app.models import AuditEventType
    
    # Get existing custom global guardrails
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == "global_custom"
    ).first()
    
    existing = []
    if config and config.value:
        try:
            existing = json.loads(config.value)
        except:
            pass
    
    # Check for duplicate ID
    if any(g.get("id") == request.id for g in existing):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Guardrail with ID '{request.id}' already exists"
        )
    
    # Add new guardrail
    new_guardrail = {
        "id": request.id,
        "name": request.name,
        "description": request.description,
        "category": request.category,
        "severity": request.severity,
        "enabled": request.enabled,
        "prompt_template": request.prompt_template,
        "validation_pattern": request.validation_pattern,
        "is_custom": True,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": current_user.id
    }
    existing.append(new_guardrail)
    
    if config:
        config.value = json.dumps(existing)
        config.updated_by = current_user.id
    else:
        config = SystemConfiguration(
            category="guardrails",
            key="global_custom",
            value=json.dumps(existing),
            value_type="json",
            is_sensitive=False,
            description="Custom global guardrails",
            updated_by=current_user.id
        )
        db.add(config)
    
    db.commit()
    
    # Audit log
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Created global guardrail: {request.name} (ID: {request.guardrail_id})",
        resource_type="guardrails:global"
    )
    
    logger.info("global_guardrail_created", guardrail_id=request.guardrail_id, user_id=current_user.id)
    
    return {"message": f"Global guardrail '{request.name}' created", "guardrail": new_guardrail}


@router.put("/guardrails/global/{guardrail_id}", summary="Update a global guardrail")
async def update_global_guardrail(
    guardrail_id: str,
    request: GlobalGuardrailUpdate,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Update an existing custom global guardrail."""
    from app.models import AuditEventType
    
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == "global_custom"
    ).first()
    
    if not config or not config.value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail '{guardrail_id}' not found"
        )
    
    existing = json.loads(config.value)
    
    # Find and update the guardrail
    found = False
    for g in existing:
        if g.get("id") == guardrail_id:
            if request.name is not None:
                g["name"] = request.name
            if request.description is not None:
                g["description"] = request.description
            if request.category is not None:
                g["category"] = request.category
            if request.severity is not None:
                g["severity"] = request.severity
            if request.enabled is not None:
                g["enabled"] = request.enabled
            if request.prompt_template is not None:
                g["prompt_template"] = request.prompt_template
            if request.validation_pattern is not None:
                g["validation_pattern"] = request.validation_pattern
            g["updated_at"] = datetime.utcnow().isoformat()
            g["updated_by"] = current_user.id
            found = True
            break
    
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail '{guardrail_id}' not found"
        )
    
    config.value = json.dumps(existing)
    config.updated_by = current_user.id
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Updated global guardrail: {guardrail_id}",
        resource_type="guardrails:global"
    )
    
    logger.info("global_guardrail_updated", guardrail_id=guardrail_id, user_id=current_user.id)
    
    return {"message": f"Global guardrail '{guardrail_id}' updated"}


@router.put("/guardrails/global/{guardrail_id}/toggle", summary="Toggle global guardrail enabled/disabled")
async def toggle_global_guardrail(
    guardrail_id: str,
    enabled: bool = True,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Toggle a global guardrail on or off (works for both built-in and custom)."""
    from app.models import AuditEventType
    from app.genai.prompts import DEFAULT_GUARDRAILS
    
    # Check if it's a built-in guardrail
    builtin_guardrails = DEFAULT_GUARDRAILS.get("global", [])
    is_builtin = any(g["id"] == guardrail_id for g in builtin_guardrails)
    
    if is_builtin:
        # Store override for built-in guardrail
        override_config = db.query(SystemConfiguration).filter(
            SystemConfiguration.category == "guardrails",
            SystemConfiguration.key == "global_overrides"
        ).first()
        
        overrides = {}
        if override_config and override_config.value:
            try:
                overrides = json.loads(override_config.value)
            except:
                pass
        
        overrides[guardrail_id] = {"enabled": enabled}
        
        if override_config:
            override_config.value = json.dumps(overrides)
            override_config.updated_by = current_user.id
        else:
            override_config = SystemConfiguration(
                category="guardrails",
                key="global_overrides",
                value=json.dumps(overrides),
                value_type="json",
                is_sensitive=False,
                description="Overrides for built-in global guardrails",
                updated_by=current_user.id
            )
            db.add(override_config)
        
        db.commit()
        
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.SYSTEM_CONFIG,
            action=f"{'Enabled' if enabled else 'Disabled'} built-in global guardrail: {guardrail_id}",
            resource_type=f"guardrails:global:{guardrail_id}"
        )
        
        logger.info("builtin_global_guardrail_toggled", guardrail_id=guardrail_id, enabled=enabled, user_id=current_user.id)
        
        return {"message": f"Built-in global guardrail '{guardrail_id}' {'enabled' if enabled else 'disabled'}"}
    
    # Custom guardrail - use existing logic
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == "global_custom"
    ).first()
    
    if not config or not config.value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail '{guardrail_id}' not found"
        )
    
    existing = json.loads(config.value)
    
    found = False
    for g in existing:
        if g.get("id") == guardrail_id:
            g["enabled"] = enabled
            g["updated_at"] = datetime.utcnow().isoformat()
            found = True
            break
    
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail '{guardrail_id}' not found"
        )
    
    config.value = json.dumps(existing)
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"{'Enabled' if enabled else 'Disabled'} global guardrail: {guardrail_id}",
        resource_type="guardrails:global"
    )
    
    return {"message": f"Global guardrail '{guardrail_id}' {'enabled' if enabled else 'disabled'}"}


@router.delete("/guardrails/global/{guardrail_id}", summary="Delete a custom global guardrail")
async def delete_global_guardrail(
    guardrail_id: str,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Delete a custom global guardrail."""
    from app.models import AuditEventType
    
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == "global_custom"
    ).first()
    
    if not config or not config.value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail '{guardrail_id}' not found"
        )
    
    existing = json.loads(config.value)
    original_count = len(existing)
    existing = [g for g in existing if g.get("id") != guardrail_id]
    
    if len(existing) == original_count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardrail '{guardrail_id}' not found"
        )
    
    config.value = json.dumps(existing)
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Deleted global guardrail: {guardrail_id}",
        resource_type="guardrails:global"
    )
    
    logger.info("global_guardrail_deleted", guardrail_id=guardrail_id, user_id=current_user.id)
    
    return {"message": f"Global guardrail '{guardrail_id}' deleted"}


class BulkGuardrailAction(BaseModel):
    """Bulk guardrail action request."""
    guardrail_ids: List[str] = Field(..., description="List of guardrail IDs")
    action: str = Field(..., pattern="^(enable|disable|delete)$")


@router.post("/guardrails/global/bulk", summary="Bulk enable/disable/delete guardrails")
async def bulk_guardrail_action(
    request: BulkGuardrailAction,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Perform bulk actions on guardrails."""
    from app.genai.prompts import DEFAULT_GUARDRAILS
    from app.models import AuditEventType
    
    results = {"succeeded": [], "failed": []}
    
    # Load current overrides
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == "global_overrides"
    ).first()
    
    overrides = json.loads(config.value) if config and config.value else {}
    
    for gid in request.guardrail_ids:
        try:
            if request.action in ("enable", "disable"):
                overrides[gid] = {"enabled": request.action == "enable"}
                results["succeeded"].append(gid)
            elif request.action == "delete":
                # Only delete custom guardrails
                custom_config = db.query(SystemConfiguration).filter(
                    SystemConfiguration.category == "guardrails",
                    SystemConfiguration.key == "global_custom"
                ).first()
                
                if custom_config and custom_config.value:
                    custom = json.loads(custom_config.value)
                    new_custom = [g for g in custom if g.get("id") != gid]
                    if len(new_custom) < len(custom):
                        custom_config.value = json.dumps(new_custom)
                        results["succeeded"].append(gid)
                    else:
                        results["failed"].append({"id": gid, "reason": "Not a custom guardrail"})
                else:
                    results["failed"].append({"id": gid, "reason": "No custom guardrails"})
        except Exception as e:
            logger.error("bulk_guardrail_action_failed", guardrail_id=gid, error=str(e))
            results["failed"].append({"id": gid, "reason": "failed_to_process"})
    
    # Save overrides
    if request.action in ("enable", "disable"):
        if config:
            config.value = json.dumps(overrides)
        else:
            db.add(SystemConfiguration(
                category="guardrails",
                key="global_overrides",
                value=json.dumps(overrides)
            ))
    
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Bulk {request.action} on {len(results['succeeded'])} guardrails",
        resource_type="guardrails:bulk"
    )
    
    return {
        "message": f"Bulk {request.action} completed",
        "succeeded": len(results["succeeded"]),
        "failed": len(results["failed"]),
        "details": results
    }


class FunctionGuardrailCreate(BaseModel):
    """Create a new guardrail for a specific function."""
    id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=10)
    category: str = Field(default="quality")
    priority: int = Field(default=5, ge=1, le=99)
    enabled: bool = Field(default=True)
    tags: Optional[List[str]] = Field(default=[])


@router.post("/guardrails/{function_name}/add", summary="Add a new guardrail for a function")
async def add_function_guardrail(
    function_name: str,
    request: FunctionGuardrailCreate,
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Add a new guardrail to a specific function."""
    from app.genai.prompts import DEFAULT_GUARDRAILS
    from app.models import AuditEventType
    
    # Valid functions
    valid_functions = list(DEFAULT_GUARDRAILS.keys())
    if function_name not in valid_functions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid function. Must be one of: {valid_functions}"
        )
    
    # Load existing custom guardrails for this function
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.category == "guardrails",
        SystemConfiguration.key == function_name
    ).first()
    
    existing = json.loads(config.value) if config and config.value else []
    
    # Check for duplicate ID
    existing_ids = [g.get("id") for g in existing]
    default_ids = [g.get("id") for g in DEFAULT_GUARDRAILS.get(function_name, [])]
    
    if request.id in existing_ids or request.id in default_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Guardrail with ID '{request.id}' already exists"
        )
    
    # Create new guardrail
    new_guardrail = {
        "id": request.id,
        "name": request.name,
        "description": request.description,
        "category": request.category,
        "priority": request.priority,
        "enabled": request.enabled,
        "tags": request.tags or [],
        "is_custom": True,
        "created_by": current_user.id
    }
    
    existing.append(new_guardrail)
    
    if config:
        config.value = json.dumps(existing)
    else:
        db.add(SystemConfiguration(
            category="guardrails",
            key=function_name,
            value=json.dumps(existing)
        ))
    
    db.commit()
    
    AuditManager.log_event(
        db=db,
        user_id=current_user.id,
        event_type=AuditEventType.SYSTEM_CONFIG,
        action=f"Created guardrail '{request.id}' for function '{function_name}'",
        resource_type=f"guardrails:{function_name}"
    )
    
    logger.info("function_guardrail_created", 
                function=function_name, 
                guardrail_id=request.id, 
                user_id=current_user.id)
    
    return {
        "message": f"Guardrail '{request.id}' created for function '{function_name}'",
        "guardrail": new_guardrail
    }


@router.get("/prompts/personas", summary="Get all expert personas")
async def get_expert_personas(
    current_user: User = Depends(require_permission(MANAGE_USERS))
):
    """Get all available expert personas for prompt customization."""
    from app.genai.prompts import get_all_personas
    
    personas = get_all_personas()
    
    return {
        "personas": [
            {
                "key": key,
                "name": key.replace("_", " ").title(),
                "preview": value[:200] + "..." if len(value) > 200 else value
            }
            for key, value in personas.items()
        ]
    }


@router.get("/prompts/preview", summary="Preview a generated prompt")
async def preview_prompt(
    function: str,
    persona: str = "threat_intelligence",
    current_user: User = Depends(require_permission(MANAGE_USERS)),
    db: Session = Depends(get_db)
):
    """Preview what a generated prompt will look like with current guardrails."""
    from app.genai.prompts import PromptManager, PromptFunction, DEFAULT_GUARDRAILS, EXPERT_PERSONAS
    
    # Handle "global" function specially - show global guardrails
    if function == "global":
        global_guardrails = DEFAULT_GUARDRAILS.get("global", [])
        guardrails_text = "\n".join([f"- {g['name']}: {g['description']}" for g in global_guardrails])
        
        return {
            "function": "global",
            "persona": persona,
            "system_prompt": f"""GLOBAL GUARDRAILS (Applied to all functions):

{guardrails_text}

These guardrails are automatically included in every GenAI prompt to ensure:
- Accurate and reliable threat intelligence
- Properly formatted outputs
- Safe and appropriate responses
- Consistent quality across all functions""",
            "user_prompt": "[Global guardrails are injected into the system prompt for all functions]",
            "total_length": len(guardrails_text) + 200
        }
    
    try:
        prompt_function = PromptFunction(function)
    except ValueError:
        # Return a helpful message for unknown functions
        available = [f.value for f in PromptFunction]
        return {
            "function": function,
            "persona": persona,
            "system_prompt": f"Function '{function}' not found. Available functions: {', '.join(available)}",
            "user_prompt": "",
            "total_length": 0,
            "error": f"Unknown function: {function}"
        }
    
    manager = PromptManager(db_session=db)
    
    # Generate sample prompt
    if "extraction" in function:
        prompts = manager.build_extraction_prompt(
            content="[Sample article content would appear here...]",
            source_url="https://example.com/article",
            persona_key=persona
        )
    elif "summary" in function:
        prompts = manager.build_summary_prompt(
            content="[Sample article content would appear here...]",
            summary_type=function.split("_")[0],
            ioc_count=5,
            ttp_count=3
        )
    elif "hunt_query" in function:
        platform = function.replace("hunt_query_", "")
        prompts = manager.build_hunt_query_prompt(
            platform=platform,
            iocs="1.2.3.4, malware.com, abc123hash",
            ttps="T1566.001, T1059.001",
            context="Sample threat context"
        )
    else:
        prompts = {"system": "Function preview not available", "user": ""}
    
    return {
        "function": function,
        "persona": persona,
        "system_prompt": prompts["system"],
        "user_prompt": prompts["user"],
        "total_length": len(prompts["system"]) + len(prompts["user"])
    }


# =============================================================================
# RBAC Management Endpoints
# =============================================================================

@router.get("/rbac/permissions", summary="Get all available permissions")
def get_all_permissions(
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get list of all available permissions in the system."""
    from app.admin.rbac_service import RBACService
    
    try:
        permissions = RBACService.get_all_permissions()
        return {"permissions": permissions}
    except Exception as e:
        logger.error("failed_to_get_permissions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get permissions"
        )


@router.get("/rbac/roles", summary="Get all roles")
def get_all_roles(
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get list of all roles in the system."""
    from app.admin.rbac_service import RBACService
    
    try:
        roles = RBACService.get_all_roles()
        return {"roles": roles}
    except Exception as e:
        logger.error("failed_to_get_roles", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get roles"
        )


@router.get("/rbac/matrix", summary="Get permission matrix")
def get_permission_matrix(
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get the full permission matrix (roles x permissions)."""
    from app.admin.rbac_service import RBACService
    
    try:
        matrix = RBACService.get_permission_matrix(db)
        return matrix
    except Exception as e:
        logger.error("failed_to_get_permission_matrix", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get permission matrix"
        )


class UpdateRolePermissionsRequest(BaseModel):
    permissions: List[str] = Field(..., description="List of permission keys to grant to this role")


@router.put("/rbac/roles/{role}/permissions", summary="Update role permissions")
def update_role_permissions(
    role: str,
    request: UpdateRolePermissionsRequest,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Update the permissions for a specific role."""
    from app.admin.rbac_service import RBACService
    
    try:
        result = RBACService.update_role_permissions(
            db=db,
            role=role,
            permissions=request.permissions,
            admin_id=current_user.id
        )
        
        # Log audit event
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.SYSTEM_CONFIG,
            action=f"Updated permissions for role {role}",
            resource_type="role_permissions",
            details={"permissions": request.permissions}
        )
        db.commit()
        
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("failed_to_update_role_permissions", role=role, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role permissions"
        )


@router.get("/rbac/users/{user_id}/permissions", summary="Get user permission overrides")
def get_user_permission_overrides(
    user_id: int,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get permission overrides for a specific user."""
    from app.admin.rbac_service import RBACService
    
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        overrides = RBACService.get_user_permission_overrides(db, user_id)
        effective = RBACService.get_effective_user_permissions(db, user_id, user.role.value)
        
        return {
            "user_id": user_id,
            "username": user.username,
            "role": user.role.value,
            "overrides": overrides,
            "effective_permissions": effective
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_get_user_overrides", user_id=user_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user overrides"
        )


class SetUserPermissionOverrideRequest(BaseModel):
    permission: str = Field(..., description="Permission key")
    granted: bool = Field(..., description="Whether to grant or deny this permission")
    reason: Optional[str] = Field(None, description="Reason for the override")


@router.post("/rbac/users/{user_id}/permissions", summary="Set user permission override")
def set_user_permission_override(
    user_id: int,
    request: SetUserPermissionOverrideRequest,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Set a permission override for a specific user."""
    from app.admin.rbac_service import RBACService
    
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        result = RBACService.set_user_permission_override(
            db=db,
            user_id=user_id,
            permission=request.permission,
            granted=request.granted,
            reason=request.reason,
            admin_id=current_user.id
        )
        
        # Log audit event
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.SYSTEM_CONFIG,
            action=f"Set permission override for user {user.username}: {request.permission} = {request.granted}",
            resource_type="user_permission",
            details={
                "permission": request.permission,
                "granted": request.granted,
                "reason": request.reason
            }
        )
        db.commit()
        
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_set_user_override", user_id=user_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set user override"
        )


@router.delete("/rbac/users/{user_id}/permissions/{permission}", summary="Remove user permission override")
def remove_user_permission_override(
    user_id: int,
    permission: str,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Remove a permission override for a specific user."""
    from app.admin.rbac_service import RBACService
    
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        result = RBACService.remove_user_permission_override(
            db=db,
            user_id=user_id,
            permission=permission,
            admin_id=current_user.id
        )
        
        # Log audit event
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.SYSTEM_CONFIG,
            action=f"Removed permission override for user {user.username}: {permission}",
            resource_type="user_permission",
            details={"permission": permission}
        )
        db.commit()
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_remove_user_override", user_id=user_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove user override"
        )


# =============================================================================
# Page-Level RBAC Management
# =============================================================================

@router.get("/rbac/pages", summary="Get all page definitions")
def get_page_definitions(
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get all page definitions with permissions."""
    from app.auth.page_permissions import get_all_page_definitions
    
    try:
        pages = get_all_page_definitions()
        return {
            "pages": [p.dict() for p in pages]
        }
    except Exception as e:
        logger.error("failed_to_get_page_definitions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get page definitions"
        )


@router.get("/rbac/pages/role/{role}", summary="Get page access for role")
def get_role_page_access(
    role: str,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get which pages and permissions a role has access to.
    
    Uses the page registry for UI visibility and the RBAC service for persisted role permissions.
    """
    from app.admin.rbac_service import RBACService
    from app.auth.page_permissions import get_all_page_definitions, DEFAULT_ROLE_PAGE_PERMISSIONS
    from app.auth.rbac import get_user_permissions
    
    try:
        # Validate role
        try:
            role_enum = UserRole(role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

        # Prefer persisted role permissions if available; otherwise fall back to code defaults.
        persisted = RBACService.get_role_permissions(db, role)
        if any(str(p).startswith("page:") for p in persisted):
            effective_page_permissions = set([p for p in persisted if str(p).startswith("page:")])
        else:
            effective_page_permissions = set(DEFAULT_ROLE_PAGE_PERMISSIONS.get(role, []))

        page_defs = get_all_page_definitions()
        page_access = []
        for page in page_defs:
            granted = [p for p in page.permissions if p in effective_page_permissions]
            page_access.append(
                {
                    "page_key": page.page_key,
                    "page_name": page.page_name,
                    "page_path": page.page_path,
                    "category": page.category,
                    "has_access": len(granted) > 0,
                    "granted_permissions": granted,
                    "all_permissions": page.permissions,
                }
            )
        
        api_permissions = get_user_permissions(role_enum)
        return {
            "role": role,
            "pages": page_access,
            "api_permissions": api_permissions
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_get_role_page_access", role=role, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get role page access"
        )


class UpdatePageAccessRequest(BaseModel):
    permissions: List[str] = Field(..., description="List of permission keys to grant")


@router.put("/rbac/pages/{page_key}/role/{role}", summary="Update page access for role")
def update_page_access(
    page_key: str,
    role: str,
    request: UpdatePageAccessRequest,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Update page access permissions for a specific role."""
    from app.admin.rbac_service import RBACService
    from app.auth.page_permissions import get_all_page_definitions
    
    try:
        # Validate role
        try:
            UserRole(role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
        
        # Validate page exists
        all_pages = get_all_page_definitions()
        page = next((p for p in all_pages if p.page_key == page_key), None)
        if not page:
            raise HTTPException(status_code=404, detail=f"Page {page_key} not found")
        
        # Validate permissions belong to this page
        for perm in request.permissions:
            if perm not in page.permissions:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Permission {perm} is not valid for page {page_key}"
                )
        
        # Get current role permissions
        current_permissions = RBACService.get_role_permissions(db, role)
        
        # Remove all permissions from this page and add the new ones
        other_permissions = [p for p in current_permissions if p not in page.permissions]
        new_permissions = other_permissions + request.permissions
        
        # Update role permissions
        result = RBACService.update_role_permissions(
            db=db,
            role=role,
            permissions=new_permissions,
            admin_id=current_user.id
        )
        
        # Log audit event
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.SYSTEM_CONFIG,
            action=f"Updated page access for {page_key} for role {role}",
            resource_type="page_access",
            details={"page_key": page_key, "permissions": request.permissions}
        )
        db.commit()
        
        return {
            "success": True,
            "message": f"Updated access for {page_key}",
            "page_key": page_key,
            "role": role,
            "permissions": request.permissions
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_update_page_access", page_key=page_key, role=role, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update page access"
        )


# =============================================================================
# Comprehensive RBAC - All Permissions & Functional Areas
# =============================================================================

@router.get("/rbac/comprehensive/permissions", summary="Get all comprehensive permissions")
def get_comprehensive_permissions(
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get all permissions across all functional areas."""
    from app.auth.comprehensive_permissions import get_all_permissions
    
    try:
        permissions = get_all_permissions()
        return {"permissions": permissions}
    except Exception as e:
        logger.error("failed_to_get_comprehensive_permissions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get permissions"
        )


@router.get("/rbac/comprehensive/areas", summary="Get all functional areas")
def get_functional_areas(
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get all functional areas with their permissions."""
    from app.auth.comprehensive_permissions import get_all_functional_areas
    
    try:
        areas = get_all_functional_areas()
        return {"areas": areas}
    except Exception as e:
        logger.error("failed_to_get_functional_areas", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get functional areas"
        )


@router.get("/rbac/comprehensive/role/{role}", summary="Get role permissions (comprehensive)")
def get_comprehensive_role_permissions(
    role: str,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Get all permissions for a role from comprehensive system."""
    from app.admin.rbac_service import RBACService
    
    try:
        # Validate role
        try:
            UserRole(role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
        
        permissions = RBACService.get_role_permissions(db, role)
        return {"role": role, "permissions": permissions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_get_comprehensive_role_permissions", role=role, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get role permissions"
        )


class UpdateComprehensivePermissionsRequest(BaseModel):
    permissions: List[str] = Field(..., description="Complete list of permissions for the role")


@router.put("/rbac/comprehensive/role/{role}", summary="Update role permissions (comprehensive)")
def update_comprehensive_role_permissions(
    role: str,
    request: UpdateComprehensivePermissionsRequest,
    current_user: User = Depends(require_permission(MANAGE_RBAC)),
    db: Session = Depends(get_db)
):
    """Update all permissions for a role in comprehensive system."""
    from app.admin.rbac_service import RBACService
    
    try:
        # Validate role
        try:
            UserRole(role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
        
        result = RBACService.update_role_permissions(
            db=db,
            role=role,
            permissions=request.permissions,
            admin_id=current_user.id
        )
        
        # Log audit event
        AuditManager.log_event(
            db=db,
            user_id=current_user.id,
            event_type=AuditEventType.SYSTEM_CONFIG,
            action=f"Updated comprehensive permissions for {role}",
            resource_type="role_permissions",
            details={
                "permission_count": len(request.permissions),
                "permissions": request.permissions
            }
        )
        db.commit()
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("failed_to_update_comprehensive_role_permissions", role=role, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role permissions"
        )


## Duplicate route removed - using the one defined earlier in this file
