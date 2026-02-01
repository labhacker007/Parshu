"""Scheduler for automated threat hunting and intelligence workflows.

Uses APScheduler for background job scheduling. 
For production with multiple workers, use Celery with Redis.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from functools import wraps
from enum import Enum
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.logging import logger
from app.models import (
    Article, ArticleStatus, FeedSource, Hunt, HuntExecution, 
    HuntStatus, HuntTriggerType, ConnectorConfig,
    KnowledgeDocument, KnowledgeDocumentStatus, Report, AuditEventType
)
from app.automation.engine import AutomationEngine


# Track last run times and results for each job
JOB_RUN_HISTORY: Dict[str, Dict] = {}


class SchedulableFunctionCategory(str, Enum):
    """Categories for schedulable functions."""
    INGESTION = "ingestion"
    PROCESSING = "processing"
    REPORTS = "reports"
    MAINTENANCE = "maintenance"
    KNOWLEDGE = "knowledge"
    HUNTS = "hunts"


# Registry of all schedulable functions with metadata
SCHEDULABLE_FUNCTIONS = {
    # Ingestion functions
    "fetch_all_feeds": {
        "name": "Fetch All Feed Sources",
        "category": SchedulableFunctionCategory.INGESTION,
        "description": "Fetches new articles from all active RSS/Atom feed sources",
        "details": "Connects to each configured feed source, downloads new entries, extracts article content and images, and stores them in the database for analysis.",
        "impact": "New articles appear in Article Queue and News & Feeds pages",
        "default_trigger": {"type": "interval", "minutes": 15},
        "is_system": True
    },
    
    # Processing functions
    "process_new_articles": {
        "name": "Process New Articles",
        "category": SchedulableFunctionCategory.PROCESSING,
        "description": "Processes new articles through AI analysis pipeline",
        "details": "Takes NEW status articles, runs IOC extraction, generates summaries, calculates priority scores, and prepares them for threat hunting.",
        "impact": "Articles move from NEW → IN_ANALYSIS status with extracted intelligence",
        "default_trigger": {"type": "interval", "minutes": 30},
        "is_system": True
    },
    "auto_hunt_high_fidelity": {
        "name": "Auto-Hunt High Fidelity Articles",
        "category": SchedulableFunctionCategory.HUNTS,
        "description": "Auto-triggers threat hunts for high-priority source articles",
        "details": "Identifies articles from high-fidelity sources (marked trusted), automatically generates hunt queries for configured SIEM/EDR platforms.",
        "impact": "Reduces manual triage time for trusted intelligence sources",
        "default_trigger": {"type": "interval", "minutes": 15},
        "is_system": True
    },
    
    # Report functions
    "daily_summary": {
        "name": "Daily Intelligence Report",
        "category": SchedulableFunctionCategory.REPORTS,
        "description": "Generates daily intelligence summary report",
        "details": "Creates a summary of the last 24 hours: new articles ingested, hunts executed, findings detected. Report saved as 'Parshu_Daily_Report_YYYY-MM-DD.pdf'",
        "impact": "Provides daily situational awareness for security teams",
        "default_trigger": {"type": "cron", "hour": 8, "minute": 0},
        "is_system": True
    },
    "weekly_report": {
        "name": "Weekly Intelligence Report",
        "category": SchedulableFunctionCategory.REPORTS,
        "description": "Generates weekly comprehensive intelligence report",
        "details": "Creates a comprehensive weekly summary with trends, top threats, hunt results, and key metrics. Saved as 'Parshu_Weekly_Report_YYYY-Wxx.pdf'",
        "impact": "Provides weekly executive briefing for leadership",
        "default_trigger": {"type": "cron", "day_of_week": "mon", "hour": 7, "minute": 0},
        "is_system": False
    },
    "executive_report": {
        "name": "Executive Summary Report",
        "category": SchedulableFunctionCategory.REPORTS,
        "description": "Generates executive-level threat summary",
        "details": "Creates high-level executive summary focusing on business impact, risk levels, and strategic recommendations. Uses GenAI for synthesis.",
        "impact": "Executive-ready briefing for C-level stakeholders",
        "default_trigger": {"type": "cron", "hour": 6, "minute": 0},
        "is_system": False
    },
    "technical_report": {
        "name": "Technical Intelligence Report",
        "category": SchedulableFunctionCategory.REPORTS,
        "description": "Generates technical threat analysis report",
        "details": "Creates detailed technical report with IOCs, TTPs, MITRE mappings, and detection rules for SOC teams.",
        "impact": "Technical reference for security operations",
        "default_trigger": {"type": "cron", "hour": 7, "minute": 0},
        "is_system": False
    },
    "custom_report_daily": {
        "name": "Custom Daily Report (High Priority)",
        "category": SchedulableFunctionCategory.REPORTS,
        "description": "Generates daily report for high-priority articles only",
        "details": "Creates a focused daily report containing only high-priority threat intelligence. Useful for critical alerts digest.",
        "impact": "Daily high-priority threat digest",
        "default_trigger": {"type": "cron", "hour": 8, "minute": 30},
        "is_system": False
    },
    "custom_report_weekly": {
        "name": "Custom Weekly Report (Comprehensive)",
        "category": SchedulableFunctionCategory.REPORTS,
        "description": "Generates comprehensive weekly intelligence report",
        "details": "Creates full weekly report with all reviewed articles, extracted intelligence, hunt results, and trend analysis.",
        "impact": "Complete weekly threat intelligence summary",
        "default_trigger": {"type": "cron", "day_of_week": "fri", "hour": 16, "minute": 0},
        "is_system": False
    },
    
    # Maintenance functions
    "weekly_cleanup": {
        "name": "Weekly Data Cleanup",
        "category": SchedulableFunctionCategory.MAINTENANCE,
        "description": "Archives old data based on retention policies",
        "details": f"Archives REVIEWED articles older than {settings.ARTICLE_RETENTION_DAYS} days. Moves them to ARCHIVED status to maintain database performance. Does NOT delete data.",
        "impact": f"REVIEWED articles older than {settings.ARTICLE_RETENTION_DAYS} days → ARCHIVED status",
        "default_trigger": {"type": "cron", "day_of_week": "sun", "hour": 3, "minute": 0},
        "is_system": True
    },
    
    # Knowledge functions
    "rag_refresh": {
        "name": "RAG Knowledge Base Refresh",
        "category": SchedulableFunctionCategory.KNOWLEDGE,
        "description": "Refreshes embeddings for frequently-used Knowledge Base documents",
        "details": "Re-processes documents used more than 10 times that haven't been updated in 7+ days. Ensures semantic search quality stays high.",
        "impact": "Maintains RAG search accuracy for popular documents",
        "default_trigger": {"type": "cron", "hour": 2, "minute": 0},
        "is_system": True
    },
    "rag_process_pending": {
        "name": "Process Pending RAG Documents",
        "category": SchedulableFunctionCategory.KNOWLEDGE,
        "description": "Processes newly uploaded Knowledge Base documents",
        "details": "Finds documents in PENDING status, extracts text, generates chunks, creates embeddings, and marks them READY for search.",
        "impact": "New KB documents become searchable within 5 minutes of upload",
        "default_trigger": {"type": "interval", "minutes": 5},
        "is_system": True
    },
}


def _log_scheduled_task_audit(db, job_id: str, action: str, status: str, details: dict = None):
    """Log audit event for scheduled task execution."""
    try:
        from app.audit.manager import AuditManager
        AuditManager.log_event(
            db=db,
            event_type=AuditEventType.SCHEDULED_TASK,
            action=action,
            user_id=None,  # System-initiated
            resource_type="scheduled_job",
            resource_id=None,  # job_id is a string, not an integer
            details={
                "job_id": job_id,
                "status": status,
                **(details or {})
            }
        )
    except Exception as e:
        logger.error("audit_log_error", job_id=job_id, error=str(e))


def _record_job_run(job_id: str, status: str, duration_ms: int = 0, details: dict = None):
    """Record job run in history for tracking last run times."""
    global JOB_RUN_HISTORY
    JOB_RUN_HISTORY[job_id] = {
        "last_run": datetime.utcnow().isoformat(),
        "last_status": status,
        "last_duration_ms": duration_ms,
        "last_details": details or {},
        "run_count": JOB_RUN_HISTORY.get(job_id, {}).get("run_count", 0) + 1
    }


class HuntScheduler:
    """Scheduler for automated threat hunts and intelligence workflows."""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self.scheduler = AsyncIOScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={
                'coalesce': True,
                'max_instances': 1,
                'misfire_grace_time': 300
            }
        )
        self.engine = AutomationEngine()
        self._initialized = True
        self._running = False
        
        logger.info("hunt_scheduler_initialized")
    
    def start(self):
        """Start the scheduler with default jobs."""
        if self._running:
            return
        
        try:
            # Add default scheduled jobs
            self._add_default_jobs()
            
            self.scheduler.start()
            self._running = True
            logger.info("hunt_scheduler_started")
        except Exception as e:
            logger.error("hunt_scheduler_start_error", error=str(e))
    
    def stop(self):
        """Stop the scheduler."""
        if self._running:
            self.scheduler.shutdown(wait=False)
            self._running = False
            logger.info("hunt_scheduler_stopped")
    
    def _add_default_jobs(self):
        """Add default scheduled jobs."""
        
        # Job 0: Fetch all active feed sources every 15 minutes
        self.scheduler.add_job(
            self._fetch_all_feeds,
            IntervalTrigger(minutes=15),
            id="fetch_all_feeds",
            name="Fetch All Feed Sources",
            replace_existing=True
        )
        
        # Job 1: Process new articles every 30 minutes
        self.scheduler.add_job(
            self._process_new_articles,
            IntervalTrigger(minutes=30),
            id="process_new_articles",
            name="Process New Articles",
            replace_existing=True
        )
        
        # Job 2: Auto-hunt high-fidelity articles every 15 minutes
        self.scheduler.add_job(
            self._auto_hunt_high_fidelity,
            IntervalTrigger(minutes=15),
            id="auto_hunt_high_fidelity",
            name="Auto-Hunt High Fidelity Articles",
            replace_existing=True
        )
        
        # Job 3: Daily summary report at 8 AM
        self.scheduler.add_job(
            self._daily_summary,
            CronTrigger(hour=8, minute=0),
            id="daily_summary",
            name="Daily Summary Report",
            replace_existing=True
        )
        
        # Job 4: Cleanup old data weekly
        self.scheduler.add_job(
            self._cleanup_old_data,
            CronTrigger(day_of_week='sun', hour=3, minute=0),
            id="weekly_cleanup",
            name="Weekly Data Cleanup",
            replace_existing=True
        )
        
        # Job 5: RAG Knowledge Base Refresh - daily at 2 AM
        self.scheduler.add_job(
            self._refresh_rag_embeddings,
            CronTrigger(hour=2, minute=0),
            id="rag_refresh",
            name="RAG Knowledge Base Refresh",
            replace_existing=True
        )
        
        # Job 6: Process pending RAG documents every 5 minutes
        self.scheduler.add_job(
            self._process_pending_rag_documents,
            IntervalTrigger(minutes=5),
            id="rag_process_pending",
            name="Process Pending RAG Documents",
            replace_existing=True
        )
        
        logger.info("default_scheduler_jobs_added", job_count=7)
    
    async def _fetch_all_feeds(self):
        """Fetch and ingest all active feed sources that are due for refresh.
        
        Respects per-source refresh intervals:
        1. Check system settings for global auto-fetch toggle
        2. Check each source's auto_fetch_enabled flag
        3. Check if source is due for refresh based on its interval
        """
        start_time = datetime.utcnow()
        logger.info("scheduled_job_started", job="fetch_all_feeds")
        
        db = SessionLocal()
        try:
            # Import the ingestion function
            from app.integrations.sources import ingest_source_sync
            from app.integrations.refresh_settings import get_system_refresh_settings
            from app.models import SystemConfiguration
            
            # Check global auto-fetch setting
            system_settings = get_system_refresh_settings(db)
            if not system_settings.auto_fetch_enabled:
                logger.info("auto_fetch_disabled_globally")
                _record_job_run("fetch_all_feeds", "skipped", 0, {"reason": "auto_fetch_disabled"})
                return
            
            # Get all active sources with auto-fetch enabled
            sources = db.query(FeedSource).filter(
                FeedSource.is_active == True,
                FeedSource.auto_fetch_enabled != False  # Include NULL (default True) and True
            ).all()
            
            if not sources:
                logger.info("no_active_sources_to_fetch")
                _record_job_run("fetch_all_feeds", "completed", 0, {"reason": "no_sources"})
                return
            
            now = datetime.utcnow()
            default_interval = system_settings.default_refresh_interval_minutes
            
            total_new = 0
            total_duplicates = 0
            total_high_priority = 0
            errors = 0
            fetched_count = 0
            skipped_count = 0
            
            for source in sources:
                try:
                    # Determine effective refresh interval for this source
                    effective_interval = source.refresh_interval_minutes or default_interval
                    
                    # Check if source is due for refresh
                    if source.last_fetched:
                        time_since_last_fetch = (now - source.last_fetched).total_seconds() / 60
                        if time_since_last_fetch < effective_interval:
                            # Not due yet
                            skipped_count += 1
                            continue
                    
                    # Use the sync ingestion function from sources.py
                    result = ingest_source_sync(db, source)
                    
                    # Update next_fetch time
                    source.next_fetch = now + timedelta(minutes=effective_interval)
                    db.commit()
                    
                    total_new += result.get("new_articles", 0)
                    total_duplicates += result.get("duplicates", 0)
                    total_high_priority += result.get("high_priority", 0)
                    fetched_count += 1
                    
                    logger.info(
                        "feed_source_fetched",
                        source_id=source.id,
                        source_name=source.name,
                        new_articles=result.get("new_articles", 0),
                        next_fetch_minutes=effective_interval
                    )
                except Exception as e:
                    errors += 1
                    logger.error(
                        "feed_source_fetch_error",
                        source_id=source.id,
                        source_name=source.name,
                        error=str(e)
                    )
            
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            details = {
                "sources_checked": len(sources),
                "sources_fetched": fetched_count,
                "sources_skipped": skipped_count,
                "new_articles": total_new,
                "duplicates": total_duplicates,
                "high_priority": total_high_priority,
                "errors": errors
            }
            
            # Log audit event
            _log_scheduled_task_audit(db, "fetch_all_feeds", "feed_ingestion", "completed" if errors == 0 else "partial", details)
            _record_job_run("fetch_all_feeds", "completed" if errors == 0 else "partial", duration_ms, details)
            
            logger.info("scheduled_job_completed", job="fetch_all_feeds", **details)
        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            _log_scheduled_task_audit(db, "fetch_all_feeds", "feed_ingestion", "failed", {"error": str(e)})
            _record_job_run("fetch_all_feeds", "failed", duration_ms, {"error": str(e)})
            logger.error("scheduled_job_error", job="fetch_all_feeds", error=str(e))
        finally:
            db.close()
    
    async def _process_new_articles(self):
        """Process new articles through automation workflow."""
        start_time = datetime.utcnow()
        logger.info("scheduled_job_started", job="process_new_articles")
        
        db = SessionLocal()
        try:
            results = await self.engine.process_new_articles(limit=10, auto_execute=True)
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            details = {"processed": len(results)}
            
            _log_scheduled_task_audit(db, "process_new_articles", "article_processing", "completed", details)
            _record_job_run("process_new_articles", "completed", duration_ms, details)
            logger.info("scheduled_job_completed", job="process_new_articles", processed=len(results))
        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            _log_scheduled_task_audit(db, "process_new_articles", "article_processing", "failed", {"error": str(e)})
            _record_job_run("process_new_articles", "failed", duration_ms, {"error": str(e)})
            logger.error("scheduled_job_error", job="process_new_articles", error=str(e))
        finally:
            db.close()
    
    async def _auto_hunt_high_fidelity(self):
        """Auto-trigger hunts for high-fidelity source articles."""
        start_time = datetime.utcnow()
        logger.info("scheduled_job_started", job="auto_hunt_high_fidelity")
        
        db = SessionLocal()
        try:
            # Get high-fidelity sources
            high_fidelity_sources = db.query(FeedSource).filter(
                FeedSource.high_fidelity == True,
                FeedSource.is_active == True
            ).all()
            
            if not high_fidelity_sources:
                logger.info("no_high_fidelity_sources")
                _record_job_run("auto_hunt_high_fidelity", "completed", 0, {"reason": "no_sources"})
                return
            
            source_ids = [s.id for s in high_fidelity_sources]
            
            # Get NEW articles from high-fidelity sources
            articles = db.query(Article).filter(
                Article.source_id.in_(source_ids),
                Article.status == ArticleStatus.NEW
            ).order_by(Article.created_at.desc()).limit(5).all()
            
            if not articles:
                logger.info("no_new_high_fidelity_articles")
                _record_job_run("auto_hunt_high_fidelity", "completed", 0, {"reason": "no_articles"})
                return
            
            # Process each article
            processed = 0
            for article in articles:
                try:
                    # Auto-triage to IN_ANALYSIS status
                    article.status = ArticleStatus.IN_ANALYSIS
                    db.commit()
                    
                    # Run automation
                    result = await self.engine.process_article(
                        article_id=article.id,
                        auto_execute=True,
                        notify=True
                    )
                    
                    if result.get("status") == "completed":
                        processed += 1
                        
                except Exception as e:
                    logger.error("auto_hunt_article_error", article_id=article.id, error=str(e))
            
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            details = {"sources": len(high_fidelity_sources), "articles_found": len(articles), "processed": processed}
            
            _log_scheduled_task_audit(db, "auto_hunt_high_fidelity", "auto_hunt", "completed", details)
            _record_job_run("auto_hunt_high_fidelity", "completed", duration_ms, details)
            logger.info("scheduled_job_completed", job="auto_hunt_high_fidelity", **details)
                       
        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            _log_scheduled_task_audit(db, "auto_hunt_high_fidelity", "auto_hunt", "failed", {"error": str(e)})
            _record_job_run("auto_hunt_high_fidelity", "failed", duration_ms, {"error": str(e)})
            logger.error("scheduled_job_error", job="auto_hunt_high_fidelity", error=str(e))
        finally:
            db.close()
    
    async def _daily_summary(self):
        """Generate and send daily summary with standardized naming."""
        start_time = datetime.utcnow()
        logger.info("scheduled_job_started", job="daily_summary")
        
        db = SessionLocal()
        try:
            # Use standardized date format: YYYY-MM-DD
            report_date = datetime.utcnow().strftime("%Y-%m-%d")
            report_name = f"Parshu_Daily_Report_{report_date}"
            
            yesterday = datetime.utcnow() - timedelta(days=1)
            
            # Count articles ingested
            new_articles = db.query(Article).filter(
                Article.created_at >= yesterday
            ).count()
            
            # Count hunts run
            hunts_run = db.query(HuntExecution).filter(
                HuntExecution.created_at >= yesterday
            ).count()
            
            # Count findings (hunts with hits)
            findings = db.query(HuntExecution).filter(
                HuntExecution.created_at >= yesterday,
                HuntExecution.hits_count > 0
            ).count()
            
            # Count high priority articles
            high_priority_articles = db.query(Article).filter(
                Article.created_at >= yesterday,
                Article.priority_score >= 7
            ).count()
            
            # Get active sources count
            active_sources = db.query(FeedSource).filter(
                FeedSource.is_active == True
            ).count()
            
            summary_data = {
                "report_name": report_name,
                "report_date": report_date,
                "period": "Last 24 hours",
                "metrics": {
                    "new_articles": new_articles,
                    "high_priority_articles": high_priority_articles,
                    "hunts_executed": hunts_run,
                    "hunts_with_findings": findings,
                    "active_sources": active_sources
                }
            }
            
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            details = {"report_name": report_name, **summary_data["metrics"]}
            
            _log_scheduled_task_audit(db, "daily_summary", "report_generation", "completed", details)
            _record_job_run("daily_summary", "completed", duration_ms, details)
            
            logger.info("daily_summary_generated",
                       report_name=report_name,
                       articles=new_articles,
                       high_priority=high_priority_articles,
                       hunts=hunts_run,
                       findings=findings)
            
        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            _log_scheduled_task_audit(db, "daily_summary", "report_generation", "failed", {"error": str(e)})
            _record_job_run("daily_summary", "failed", duration_ms, {"error": str(e)})
            logger.error("scheduled_job_error", job="daily_summary", error=str(e))
        finally:
            db.close()
    
    async def _cleanup_old_data(self):
        """Cleanup old data based on retention policies."""
        start_time = datetime.utcnow()
        logger.info("scheduled_job_started", job="weekly_cleanup")
        
        db = SessionLocal()
        try:
            # Archive old articles - archive REVIEWED articles older than retention period
            cutoff = datetime.utcnow() - timedelta(days=settings.ARTICLE_RETENTION_DAYS)
            old_articles = db.query(Article).filter(
                Article.status == ArticleStatus.REVIEWED,
                Article.updated_at < cutoff
            ).all()
            
            archived_count = 0
            for article in old_articles:
                article.status = ArticleStatus.ARCHIVED
                archived_count += 1
            
            db.commit()
            
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            details = {"archived_articles": archived_count, "retention_days": settings.ARTICLE_RETENTION_DAYS}
            
            _log_scheduled_task_audit(db, "weekly_cleanup", "data_cleanup", "completed", details)
            _record_job_run("weekly_cleanup", "completed", duration_ms, details)
            
            logger.info("scheduled_job_completed", job="weekly_cleanup", archived_articles=archived_count)
                       
        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            _log_scheduled_task_audit(db, "weekly_cleanup", "data_cleanup", "failed", {"error": str(e)})
            _record_job_run("weekly_cleanup", "failed", duration_ms, {"error": str(e)})
            logger.error("scheduled_job_error", job="weekly_cleanup", error=str(e))
        finally:
            db.close()
    
    async def _refresh_rag_embeddings(self):
        """Refresh RAG embeddings for documents that may need reprocessing."""
        start_time = datetime.utcnow()
        logger.info("scheduled_job_started", job="rag_refresh")
        
        db = SessionLocal()
        try:
            from app.knowledge.service import KnowledgeService
            
            # Find documents that need re-embedding (older than 7 days, frequently used)
            cutoff = datetime.utcnow() - timedelta(days=7)
            
            docs_to_refresh = db.query(KnowledgeDocument).filter(
                KnowledgeDocument.status == KnowledgeDocumentStatus.READY,
                KnowledgeDocument.is_active == True,
                KnowledgeDocument.usage_count > 10,  # Frequently used
                KnowledgeDocument.updated_at < cutoff
            ).limit(5).all()
            
            service = KnowledgeService(db)
            refreshed = 0
            
            for doc in docs_to_refresh:
                try:
                    await service.process_document(doc.id)
                    refreshed += 1
                except Exception as e:
                    logger.error("rag_refresh_doc_error", doc_id=doc.id, error=str(e))
            
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            details = {"refreshed": refreshed, "candidates": len(docs_to_refresh)}
            
            _log_scheduled_task_audit(db, "rag_refresh", "knowledge_refresh", "completed", details)
            _record_job_run("rag_refresh", "completed", duration_ms, details)
            
            logger.info("scheduled_job_completed", job="rag_refresh", refreshed=refreshed)
                       
        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            _log_scheduled_task_audit(db, "rag_refresh", "knowledge_refresh", "failed", {"error": str(e)})
            _record_job_run("rag_refresh", "failed", duration_ms, {"error": str(e)})
            logger.error("scheduled_job_error", job="rag_refresh", error=str(e))
        finally:
            db.close()
    
    async def _process_pending_rag_documents(self):
        """Process any RAG documents stuck in PENDING status."""
        start_time = datetime.utcnow()
        logger.info("scheduled_job_started", job="rag_process_pending")
        
        db = SessionLocal()
        try:
            from app.knowledge.service import KnowledgeService
            
            # Find pending documents
            pending_docs = db.query(KnowledgeDocument).filter(
                KnowledgeDocument.status == KnowledgeDocumentStatus.PENDING
            ).order_by(KnowledgeDocument.created_at).limit(3).all()
            
            if not pending_docs:
                logger.info("no_pending_rag_documents")
                _record_job_run("rag_process_pending", "completed", 0, {"reason": "no_pending"})
                return
            
            service = KnowledgeService(db)
            processed = 0
            failed = 0
            
            for doc in pending_docs:
                try:
                    await service.process_document(doc.id)
                    processed += 1
                except Exception as e:
                    failed += 1
                    logger.error("rag_process_doc_error", doc_id=doc.id, error=str(e))
            
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            details = {"processed": processed, "failed": failed, "pending_found": len(pending_docs)}
            
            status = "completed" if failed == 0 else "partial"
            _log_scheduled_task_audit(db, "rag_process_pending", "knowledge_processing", status, details)
            _record_job_run("rag_process_pending", status, duration_ms, details)
            
            logger.info("scheduled_job_completed", job="rag_process_pending", processed=processed, failed=failed)
                       
        except Exception as e:
            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            _log_scheduled_task_audit(db, "rag_process_pending", "knowledge_processing", "failed", {"error": str(e)})
            _record_job_run("rag_process_pending", "failed", duration_ms, {"error": str(e)})
            logger.error("scheduled_job_error", job="rag_process_pending", error=str(e))
        finally:
            db.close()
    
    async def _weekly_report(self):
        """Generate weekly comprehensive intelligence report."""
        logger.info("scheduled_job_started", job="weekly_report")
        
        db = SessionLocal()
        try:
            from app.reports.routes import _generate_comprehensive_report, _extract_key_findings, _extract_recommendations
            
            # Get week number
            now = datetime.utcnow()
            week_num = now.isocalendar()[1]
            report_name = f"Parshu_Weekly_Report_{now.year}-W{week_num:02d}"
            
            # Get reviewed articles from last 7 days
            week_ago = now - timedelta(days=7)
            articles = db.query(Article).filter(
                Article.status == ArticleStatus.REVIEWED,
                Article.updated_at >= week_ago
            ).order_by(Article.updated_at.desc()).limit(100).all()
            
            if not articles:
                logger.info("weekly_report_no_articles")
                return
            
            # Create report
            report = Report(
                title=report_name,
                article_ids=[a.id for a in articles],
                content=_generate_comprehensive_report(articles),
                report_type="comprehensive",
                generated_at=now,
                key_findings=_extract_key_findings(articles),
                recommendations=_extract_recommendations(articles)
            )
            db.add(report)
            db.commit()
            
            logger.info("scheduled_job_completed", 
                       job="weekly_report",
                       report_id=report.id,
                       article_count=len(articles))
                       
        except Exception as e:
            logger.error("scheduled_job_error", job="weekly_report", error=str(e))
        finally:
            db.close()
    
    async def _executive_report(self):
        """Generate executive-level threat summary report."""
        logger.info("scheduled_job_started", job="executive_report")
        
        db = SessionLocal()
        try:
            from app.reports.routes import _generate_executive_summary, _extract_key_findings, _extract_recommendations
            
            report_date = datetime.utcnow().strftime("%Y-%m-%d")
            report_name = f"Parshu_Executive_Summary_{report_date}"
            
            # Get high-priority reviewed articles from last 24 hours
            yesterday = datetime.utcnow() - timedelta(days=1)
            articles = db.query(Article).filter(
                Article.status == ArticleStatus.REVIEWED,
                Article.updated_at >= yesterday,
                Article.is_high_priority == True
            ).order_by(Article.updated_at.desc()).limit(50).all()
            
            # If no high priority, get regular reviewed
            if not articles:
                articles = db.query(Article).filter(
                    Article.status == ArticleStatus.REVIEWED,
                    Article.updated_at >= yesterday
                ).order_by(Article.updated_at.desc()).limit(20).all()
            
            if not articles:
                logger.info("executive_report_no_articles")
                return
            
            report = Report(
                title=report_name,
                article_ids=[a.id for a in articles],
                executive_summary=_generate_executive_summary(articles),
                report_type="executive",
                generated_at=datetime.utcnow(),
                key_findings=_extract_key_findings(articles),
                recommendations=_extract_recommendations(articles)
            )
            db.add(report)
            db.commit()
            
            logger.info("scheduled_job_completed", 
                       job="executive_report",
                       report_id=report.id,
                       article_count=len(articles))
                       
        except Exception as e:
            logger.error("scheduled_job_error", job="executive_report", error=str(e))
        finally:
            db.close()
    
    async def _technical_report(self):
        """Generate technical threat analysis report."""
        logger.info("scheduled_job_started", job="technical_report")
        
        db = SessionLocal()
        try:
            from app.reports.routes import _generate_technical_summary, _extract_key_findings
            
            report_date = datetime.utcnow().strftime("%Y-%m-%d")
            report_name = f"Parshu_Technical_Report_{report_date}"
            
            # Get reviewed articles from last 24 hours
            yesterday = datetime.utcnow() - timedelta(days=1)
            articles = db.query(Article).filter(
                Article.status == ArticleStatus.REVIEWED,
                Article.updated_at >= yesterday
            ).order_by(Article.updated_at.desc()).limit(50).all()
            
            if not articles:
                logger.info("technical_report_no_articles")
                return
            
            report = Report(
                title=report_name,
                article_ids=[a.id for a in articles],
                technical_summary=_generate_technical_summary(articles),
                report_type="technical",
                generated_at=datetime.utcnow(),
                key_findings=_extract_key_findings(articles)
            )
            db.add(report)
            db.commit()
            
            logger.info("scheduled_job_completed", 
                       job="technical_report",
                       report_id=report.id,
                       article_count=len(articles))
                       
        except Exception as e:
            logger.error("scheduled_job_error", job="technical_report", error=str(e))
        finally:
            db.close()
    
    async def _custom_report_daily(self):
        """Generate daily report for high-priority articles only."""
        logger.info("scheduled_job_started", job="custom_report_daily")
        
        db = SessionLocal()
        try:
            from app.reports.routes import _generate_executive_summary, _extract_key_findings, _extract_recommendations
            
            report_date = datetime.utcnow().strftime("%Y-%m-%d")
            report_name = f"Parshu_HighPriority_Daily_{report_date}"
            
            yesterday = datetime.utcnow() - timedelta(days=1)
            articles = db.query(Article).filter(
                Article.updated_at >= yesterday,
                Article.is_high_priority == True
            ).order_by(Article.updated_at.desc()).limit(30).all()
            
            if not articles:
                logger.info("custom_report_daily_no_articles")
                return
            
            report = Report(
                title=report_name,
                article_ids=[a.id for a in articles],
                executive_summary=_generate_executive_summary(articles),
                report_type="executive",
                generated_at=datetime.utcnow(),
                key_findings=_extract_key_findings(articles),
                recommendations=_extract_recommendations(articles)
            )
            db.add(report)
            db.commit()
            
            logger.info("scheduled_job_completed", 
                       job="custom_report_daily",
                       report_id=report.id,
                       article_count=len(articles))
                       
        except Exception as e:
            logger.error("scheduled_job_error", job="custom_report_daily", error=str(e))
        finally:
            db.close()
    
    async def _custom_report_weekly(self):
        """Generate comprehensive weekly intelligence report."""
        logger.info("scheduled_job_started", job="custom_report_weekly")
        
        db = SessionLocal()
        try:
            from app.reports.routes import _generate_comprehensive_report, _generate_executive_summary, _generate_technical_summary, _extract_key_findings, _extract_recommendations
            
            now = datetime.utcnow()
            week_num = now.isocalendar()[1]
            report_name = f"Parshu_Comprehensive_Weekly_{now.year}-W{week_num:02d}"
            
            week_ago = now - timedelta(days=7)
            articles = db.query(Article).filter(
                Article.status == ArticleStatus.REVIEWED,
                Article.updated_at >= week_ago
            ).order_by(Article.updated_at.desc()).limit(200).all()
            
            if not articles:
                logger.info("custom_report_weekly_no_articles")
                return
            
            report = Report(
                title=report_name,
                article_ids=[a.id for a in articles],
                content=_generate_comprehensive_report(articles),
                executive_summary=_generate_executive_summary(articles),
                technical_summary=_generate_technical_summary(articles),
                report_type="comprehensive",
                generated_at=now,
                key_findings=_extract_key_findings(articles),
                recommendations=_extract_recommendations(articles)
            )
            db.add(report)
            db.commit()
            
            logger.info("scheduled_job_completed", 
                       job="custom_report_weekly",
                       report_id=report.id,
                       article_count=len(articles))
                       
        except Exception as e:
            logger.error("scheduled_job_error", job="custom_report_weekly", error=str(e))
        finally:
            db.close()
    
    def get_function_by_id(self, function_id: str) -> Optional[Callable]:
        """Get the actual function for a schedulable function ID."""
        function_map = {
            "fetch_all_feeds": self._fetch_all_feeds,
            "process_new_articles": self._process_new_articles,
            "auto_hunt_high_fidelity": self._auto_hunt_high_fidelity,
            "daily_summary": self._daily_summary,
            "weekly_report": self._weekly_report,
            "executive_report": self._executive_report,
            "technical_report": self._technical_report,
            "custom_report_daily": self._custom_report_daily,
            "custom_report_weekly": self._custom_report_weekly,
            "weekly_cleanup": self._cleanup_old_data,
            "rag_refresh": self._refresh_rag_embeddings,
            "rag_process_pending": self._process_pending_rag_documents,
        }
        return function_map.get(function_id)
    
    def get_available_functions(self) -> List[Dict]:
        """Get list of all available schedulable functions with metadata."""
        functions = []
        for func_id, metadata in SCHEDULABLE_FUNCTIONS.items():
            functions.append({
                "id": func_id,
                "name": metadata["name"],
                "category": metadata["category"].value,
                "description": metadata["description"],
                "details": metadata["details"],
                "impact": metadata["impact"],
                "default_trigger": metadata["default_trigger"],
                "is_system": metadata["is_system"]
            })
        return functions
    
    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get a specific job by ID."""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                return {
                    "id": job.id,
                    "name": job.name,
                    "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger),
                    "paused": job.next_run_time is None
                }
            return None
        except Exception as e:
            logger.error("get_job_error", job_id=job_id, error=str(e))
            return None
    
    async def _custom_job_placeholder(self):
        """Placeholder function for custom jobs. Custom jobs can call external webhooks or APIs."""
        logger.info("custom_job_executed", message="This is a placeholder custom job")
    
    def add_custom_job(
        self,
        job_id: str,
        name: str,
        trigger: Any,
        enabled: bool = True,
        func = None,
        function_id: Optional[str] = None
    ) -> bool:
        """Add a custom scheduled job.
        
        Args:
            job_id: Unique identifier for the job
            name: Human-readable name
            trigger: APScheduler trigger object
            enabled: Whether job should be active
            func: Optional async function to execute (defaults to placeholder)
            function_id: ID of a registered schedulable function to use
            
        Returns:
            bool: True if job added successfully
        """
        try:
            # If function_id is provided, use the registered function
            if function_id:
                job_func = self.get_function_by_id(function_id)
                if not job_func:
                    logger.error("unknown_function_id", function_id=function_id)
                    return False
            else:
                job_func = func or self._custom_job_placeholder
            
            self.scheduler.add_job(
                job_func,
                trigger,
                id=job_id,
                name=name,
                replace_existing=True
            )
            
            # Pause if not enabled
            if not enabled:
                self.scheduler.pause_job(job_id)
            
            logger.info("custom_job_added", job_id=job_id, name=name, function_id=function_id, enabled=enabled)
            return True
            
        except Exception as e:
            logger.error("custom_job_add_error", job_id=job_id, error=str(e))
            return False
    
    def update_job(
        self,
        job_id: str,
        name: Optional[str] = None,
        trigger: Any = None,
        enabled: Optional[bool] = None
    ) -> bool:
        """Update an existing scheduled job.
        
        Args:
            job_id: Job identifier
            name: New name (optional)
            trigger: New trigger (optional)
            enabled: New enabled state (optional)
            
        Returns:
            bool: True if job updated successfully
        """
        try:
            job = self.scheduler.get_job(job_id)
            if not job:
                return False
            
            modifications = {}
            if name is not None:
                modifications['name'] = name
            if trigger is not None:
                modifications['trigger'] = trigger
            
            if modifications:
                job.modify(**modifications)
            
            # Handle enabled state
            if enabled is not None:
                if enabled:
                    self.scheduler.resume_job(job_id)
                else:
                    self.scheduler.pause_job(job_id)
            
            logger.info("job_updated", job_id=job_id, modifications=list(modifications.keys()))
            return True
            
        except Exception as e:
            logger.error("job_update_error", job_id=job_id, error=str(e))
            return False
    
    def remove_job(self, job_id: str) -> bool:
        """Remove a scheduled job."""
        try:
            self.scheduler.remove_job(job_id)
            logger.info("job_removed", job_id=job_id)
            return True
        except Exception as e:
            logger.error("job_remove_error", job_id=job_id, error=str(e))
            return False
    
    def get_jobs(self) -> List[Dict]:
        """Get list of all scheduled jobs with descriptions and last run info."""
        global JOB_RUN_HISTORY
        jobs = []
        for job in self.scheduler.get_jobs():
            # Get metadata from SCHEDULABLE_FUNCTIONS registry
            func_meta = SCHEDULABLE_FUNCTIONS.get(job.id, {})
            
            # Get last run info from history
            run_history = JOB_RUN_HISTORY.get(job.id, {})
            
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
                "paused": job.next_run_time is None,
                "function_id": job.id if job.id in SCHEDULABLE_FUNCTIONS else None,
                "category": func_meta.get("category", SchedulableFunctionCategory.MAINTENANCE).value if isinstance(func_meta.get("category"), SchedulableFunctionCategory) else func_meta.get("category", "custom"),
                "description": func_meta.get("description", "Custom scheduled job"),
                "details": func_meta.get("details", "User-defined automation task"),
                "impact": func_meta.get("impact", "Varies based on job configuration"),
                "is_system": func_meta.get("is_system", False),
                # Last run info
                "last_run": run_history.get("last_run"),
                "last_status": run_history.get("last_status"),
                "last_duration_ms": run_history.get("last_duration_ms"),
                "run_count": run_history.get("run_count", 0)
            })
        return jobs
    
    def pause_job(self, job_id: str) -> bool:
        """Pause a scheduled job."""
        try:
            self.scheduler.pause_job(job_id)
            logger.info("job_paused", job_id=job_id)
            return True
        except Exception as e:
            logger.error("job_pause_error", job_id=job_id, error=str(e))
            return False
    
    def resume_job(self, job_id: str) -> bool:
        """Resume a paused job."""
        try:
            self.scheduler.resume_job(job_id)
            logger.info("job_resumed", job_id=job_id)
            return True
        except Exception as e:
            logger.error("job_resume_error", job_id=job_id, error=str(e))
            return False
    
    def run_job_now(self, job_id: str, triggered_by: str = "manual") -> bool:
        """Trigger a job to run immediately."""
        db = SessionLocal()
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                job.modify(next_run_time=datetime.utcnow())
                
                # Log audit event for manual trigger
                _log_scheduled_task_audit(
                    db, job_id, "manual_trigger", "triggered",
                    {"triggered_by": triggered_by, "job_name": job.name}
                )
                
                logger.info("job_triggered", job_id=job_id, triggered_by=triggered_by)
                return True
            return False
        except Exception as e:
            logger.error("job_trigger_error", job_id=job_id, error=str(e))
            return False
        finally:
            db.close()
    
    def get_job_history(self, job_id: str = None) -> Dict:
        """Get run history for jobs."""
        global JOB_RUN_HISTORY
        if job_id:
            return JOB_RUN_HISTORY.get(job_id, {})
        return JOB_RUN_HISTORY


# Global scheduler instance
hunt_scheduler = HuntScheduler()


def init_scheduler():
    """Initialize and start the scheduler. Call this on app startup."""
    hunt_scheduler.start()


def shutdown_scheduler():
    """Shutdown the scheduler. Call this on app shutdown."""
    hunt_scheduler.stop()
