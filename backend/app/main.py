"""Main FastAPI application."""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base
from app.audit.middleware import AuditMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.routers import router as auth_router
from app.articles.routes import router as articles_router
from app.hunts.routes import router as hunts_router
from app.reports.routes import router as reports_router
from app.integrations.sources import router as sources_router
from app.connectors.routes import router as connectors_router
from app.watchlist.routes import router as watchlist_router
from app.audit.routes import router as audit_router
from app.automation.routes import router as automation_router
from app.users.routes import router as users_router
from app.auth.saml import router as saml_router
from app.admin.routes import router as admin_router
from app.chatbot.routes import router as chatbot_router
from app.iocs.routes import router as iocs_router
# from app.guardrails.routes import router as guardrails_router  # TODO: Fix import issues
from app.core.logging import logger


# Initialize database
Base.metadata.create_all(bind=engine)


def run_schema_migrations():
    """Run schema migrations to add missing columns."""
    from sqlalchemy import text
    from app.core.database import SessionLocal
    
    db = SessionLocal()
    try:
        # Check if we're using PostgreSQL
        if "postgresql" in settings.DATABASE_URL:
            # Add missing columns to feed_sources table
            migrations = [
                "ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS refresh_interval_minutes INTEGER",
                "ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS auto_fetch_enabled BOOLEAN DEFAULT true",
                "ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS high_fidelity BOOLEAN DEFAULT false",
            ]
            
            for migration in migrations:
                try:
                    db.execute(text(migration))
                    db.commit()
                    logger.info("schema_migration_success", sql=migration[:50])
                except Exception as e:
                    db.rollback()
                    # Ignore if column already exists
                    if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                        logger.warning("schema_migration_warning", sql=migration[:50], error=str(e))
    except Exception as e:
        logger.error("schema_migration_failed", error=str(e))
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("app_startup", version=settings.APP_VERSION)
    
    # Development-only schema adjustments (use Alembic for controlled production migrations)
    if settings.DEBUG and settings.ENV != "prod":
        try:
            run_schema_migrations()
            logger.info("schema_migrations_complete")
        except Exception as e:
            logger.error("schema_migrations_failed", error=str(e))
    
    # Auto-seed database if empty (development only)
    if settings.DEBUG and settings.ENV != "prod":
        try:
            from app.core.database import SessionLocal
            from app.models import User
            db = SessionLocal()
            user_count = db.query(User).count()
            db.close()
            if user_count == 0:
                logger.info("database_empty_seeding")
                import os
                # Change to project root to find config/seed-sources.json
                original_cwd = os.getcwd()
                project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                os.chdir(project_root)
                try:
                    from app.seeds import seed_database
                    seed_database()
                    logger.info("database_seeded_successfully")
                finally:
                    os.chdir(original_cwd)
        except Exception as e:
            logger.error("auto_seed_failed", error=str(e))
    
    # Initialize scheduler for automated hunts (opt-in)
    from app.automation.scheduler import init_scheduler, shutdown_scheduler
    if settings.ENABLE_AUTOMATION_SCHEDULER:
        try:
            init_scheduler()
            logger.info("scheduler_started")
        except Exception as e:
            logger.error("scheduler_start_failed", error=str(e))
    
    yield
    
    # Shutdown scheduler
    if settings.ENABLE_AUTOMATION_SCHEDULER:
        try:
            shutdown_scheduler()
            logger.info("scheduler_stopped")
        except Exception as e:
            logger.error("scheduler_stop_failed", error=str(e))
    
    logger.info("app_shutdown")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Parshu - Threat Intelligence & Hunt Platform API",
    lifespan=lifespan
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # XSS Protection (legacy but still useful)
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Strict Transport Security (HTTPS only)
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    # Content Security Policy
    if request.url.path in ("/docs", "/redoc", "/openapi.json"):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
    else:
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "frame-ancestors 'none'; "
            "base-uri 'none'; "
            "form-action 'none'; "
            "img-src 'self' data:; "
            "connect-src 'self';"
        )
    
    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    return response

# Add middleware
app.add_middleware(RateLimitMiddleware)  # Rate limiting first (outer)
app.add_middleware(AuditMiddleware)

# Parse CORS origins from comma-separated string
cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]

# Validate CORS origins - never allow wildcard with credentials
if "*" in cors_origins and len(cors_origins) > 1:
    logger.warning("cors_wildcard_with_specific_origins", origins=cors_origins)
if "*" in cors_origins:
    logger.error("cors_wildcard_not_allowed_with_credentials")
    raise ValueError("CORS wildcard (*) is not allowed with allow_credentials=True")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],  # Restricted methods
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRF-Token"
    ],  # Restricted headers
    expose_headers=["Content-Length", "X-Total-Count"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Include routers
app.include_router(auth_router)
app.include_router(saml_router)  # SAML/SSO authentication
app.include_router(articles_router)
app.include_router(hunts_router)
app.include_router(reports_router)
app.include_router(sources_router)
app.include_router(connectors_router)
app.include_router(watchlist_router)
app.include_router(audit_router)
app.include_router(automation_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(chatbot_router)  # AI-powered chatbot
app.include_router(iocs_router)  # IOC management
# app.include_router(guardrails_router)  # Guardrails management - TODO: Fix imports and enable

# User Custom Feeds
from app.users.feeds import router as user_feeds_router
app.include_router(user_feeds_router)

# Knowledge Base for RAG
from app.knowledge.routes import router as knowledge_router
app.include_router(knowledge_router)

# GenAI Help & Troubleshooting
from app.genai.routes import router as genai_router
app.include_router(genai_router)

# Analytics & Reporting Dashboard
from app.analytics.routes import router as analytics_router
app.include_router(analytics_router)

# Source Refresh Settings
from app.integrations.refresh_settings import router as refresh_settings_router
app.include_router(refresh_settings_router)

# Report Version Control
from app.reports.version_control import router as report_versions_router
app.include_router(report_versions_router)

# Agentic Intelligence System
from app.intelligence.routes import router as intelligence_router
app.include_router(intelligence_router)

# Hunt Tracking System
from app.hunts.tracking import router as hunt_tracking_router
app.include_router(hunt_tracking_router)

# GenAI Testing Lab
from app.genai.testing import router as genai_testing_router
app.include_router(genai_testing_router)

# Cybersecurity Guardrails
from app.guardrails.guardrail_routes import router as guardrail_routes_router
app.include_router(guardrail_routes_router)

# Import GenAI models to ensure they're registered with SQLAlchemy
from app.genai import models as genai_models


@app.get("/health")
def health_check():
    """Health check endpoint."""
    from app.core.database import SessionLocal
    from app.models import User, FeedSource, Article
    
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        source_count = db.query(FeedSource).count()
        article_count = db.query(Article).count()
    except Exception as e:
        logger.error("health_check_failed", error=str(e))
        return {
            "status": "unhealthy",
            "version": settings.APP_VERSION,
            "error": "unhealthy"
        }
    finally:
        db.close()
    
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "database": {
            "users": user_count,
            "sources": source_count,
            "articles": article_count
        }
    }


# DEBUG ENDPOINTS REMOVED FOR SECURITY
# These endpoints exposed sensitive data without authentication
# Use proper authenticated endpoints instead:
# - GET /sources/ for feed sources
# - GET /articles/triage for articles


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


def _require_setup_access(request: Request) -> None:
    # Never expose bootstrap/setup endpoints in production-like environments.
    if settings.ENV == "prod" or not settings.DEBUG:
        raise HTTPException(status_code=404, detail="Not found")

    # Optional bootstrap token for shared dev environments.
    if settings.SETUP_TOKEN:
        provided = request.headers.get("X-Setup-Token")
        if not provided or provided != settings.SETUP_TOKEN:
            raise HTTPException(status_code=403, detail="Forbidden")


@app.post("/setup/seed")
def seed_database_setup(request: Request):
    """Seed the database with initial data. Only works if no users exist.
    
    SECURITY: Admin credentials are set via environment variables, not returned in response.
    """
    _require_setup_access(request)
    from app.core.database import SessionLocal
    from app.models import User
    
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count > 0:
            return {
                "success": False,
                "message": "Database already has users. Use /admin/seed-database instead.",
                "user_count": user_count
            }
    finally:
        db.close()
    
    try:
        from app.seeds import seed_database
        seed_database()
        
        db = SessionLocal()
        from app.models import FeedSource
        source_count = db.query(FeedSource).count()
        db.close()
        
        return {
            "success": True,
            "message": "Database seeded successfully! Admin credentials are set via ADMIN_EMAIL and ADMIN_PASSWORD environment variables.",
            "sources_added": source_count
        }
    except Exception as e:
        logger.error("database_seed_failed", error=str(e))
        return {
            "success": False,
            "message": "Seeding failed"
        }


@app.post("/setup/fix-schema")
def fix_schema_setup(request: Request):
    """Manually run schema migrations to fix missing columns."""
    _require_setup_access(request)
    try:
        run_schema_migrations()
        return {
            "success": True,
            "message": "Schema migrations completed. Missing columns added to feed_sources table."
        }
    except Exception as e:
        logger.error("schema_migration_failed", error=str(e))
        return {
            "success": False,
            "message": "Schema migration failed"
        }


@app.post("/setup/ingest")
def ingest_feeds_setup(request: Request):
    """Ingest articles from all active feed sources. Call this after seeding."""
    _require_setup_access(request)
    from app.core.database import SessionLocal
    from app.models import FeedSource, Article
    from app.ingestion.parser import FeedParser
    from datetime import datetime
    
    db = SessionLocal()
    try:
        sources = db.query(FeedSource).filter(FeedSource.is_active == True).all()
        
        if not sources:
            return {
                "success": False,
                "message": "No active sources found. Run /setup/seed first."
            }
        
        total_articles = 0
        results = []
        
        for source in sources[:5]:  # Limit to first 5 sources for quick setup
            try:
                feed = FeedParser.parse_feed(source.url)
                entries = FeedParser.extract_entries(feed)
                
                for entry in entries[:10]:  # Limit to 10 articles per source
                    # Check if already exists
                    existing = db.query(Article).filter(
                        Article.source_id == source.id,
                        Article.external_id == entry["external_id"]
                    ).first()
                    
                    if existing:
                        continue
                    
                    article = Article(
                        source_id=source.id,
                        external_id=entry["external_id"],
                        title=entry["title"],
                        raw_content=entry.get("raw_content", ""),
                        normalized_content=entry.get("summary", ""),
                        summary=entry.get("summary", ""),
                        url=entry.get("url", ""),
                        published_at=entry.get("published_at"),
                        status="NEW",
                        is_high_priority=False
                    )
                    db.add(article)
                    total_articles += 1
                
                source.last_fetched = datetime.utcnow()
                db.commit()
                
                results.append({
                    "source": source.name,
                    "status": "success",
                    "entries_found": len(entries)
                })
                
            except Exception as e:
                logger.warning("setup_ingest_source_failed", source=source.name, error=str(e))
                results.append({
                    "source": source.name,
                    "status": "error",
                    "error": "failed"
                })
        
        return {
            "success": True,
            "message": f"Ingested {total_articles} articles from {len(results)} sources",
            "articles_added": total_articles,
            "sources_processed": results
        }
        
    except Exception as e:
        logger.error("setup_ingest_failed", error=str(e))
        return {
            "success": False,
            "message": "Ingestion failed"
        }
    finally:
        db.close()
