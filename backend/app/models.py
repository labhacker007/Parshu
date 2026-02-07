from enum import Enum
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Enum as SQLEnum, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


# Enums
class ArticleStatus(str, Enum):
    NEW = "NEW"
    IN_ANALYSIS = "IN_ANALYSIS"
    NEED_TO_HUNT = "NEED_TO_HUNT"
    HUNT_GENERATED = "HUNT_GENERATED"
    REVIEWED = "REVIEWED"
    ARCHIVED = "ARCHIVED"


class HuntStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class HuntTriggerType(str, Enum):
    MANUAL = "MANUAL"
    AUTO = "AUTO"


class UserRole(str, Enum):
    ADMIN = "ADMIN"  # Full access: manage sources, users, global watchlist
    USER = "USER"    # Standard user: view feeds, manage personal feeds/watchlist


class ExtractedIntelligenceType(str, Enum):
    IOC = "IOC"  # Indicator of Compromise
    IOA = "IOA"  # Indicator of Attack
    TTP = "TTP"  # MITRE ATT&CK
    ATLAS = "ATLAS"  # MITRE ATLAS


class AuditEventType(str, Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    ARTICLE_LIFECYCLE = "ARTICLE_LIFECYCLE"
    EXTRACTION = "EXTRACTION"
    CONNECTOR_CONFIG = "CONNECTOR_CONFIG"
    HUNT_TRIGGER = "HUNT_TRIGGER"
    NOTIFICATION = "NOTIFICATION"
    REPORT_GENERATION = "REPORT_GENERATION"
    RBAC_CHANGE = "RBAC_CHANGE"
    SYSTEM_CONFIG = "SYSTEM_CONFIG"
    GENAI_SUMMARIZATION = "GENAI_SUMMARIZATION"
    KNOWLEDGE_BASE = "KNOWLEDGE_BASE"
    SCHEDULED_TASK = "SCHEDULED_TASK"
    ADMIN_ACTION = "ADMIN_ACTION"


# Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Null if OAuth/SAML auth
    full_name = Column(String, nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)  # Primary role

    # Multiple roles support - JSON array of additional roles
    # e.g., ["TI", "TH"] means user has TI and TH in addition to primary role
    additional_roles = Column(JSON, default=[])

    # Custom per-user permission overrides
    # Format: {"grant": ["view:hunts", "execute:hunts"], "deny": ["manage:users"]}
    # grant: permissions given even if role doesn't have them
    # deny: permissions revoked even if role has them
    custom_permissions = Column(JSON, default={"grant": [], "deny": []})

    is_active = Column(Boolean, default=True)

    # SAML authentication
    is_saml_user = Column(Boolean, default=False)
    saml_nameid = Column(String, nullable=True, unique=True)

    # OAuth authentication
    oauth_provider = Column(String, nullable=True)  # "google", "microsoft", None
    oauth_subject = Column(String, nullable=True, unique=True)  # OAuth user ID
    oauth_email = Column(String, nullable=True)
    oauth_picture = Column(String, nullable=True)  # Profile picture URL

    # Two-factor authentication
    otp_enabled = Column(Boolean, default=False)
    otp_secret = Column(String, nullable=True)

    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    articles = relationship(
        "Article",
        back_populates="assigned_analyst",
        foreign_keys=lambda: [Article.assigned_analyst_id],
    )
    audit_events = relationship("AuditLog", back_populates="user")
    hunt_executions = relationship("HuntExecution", back_populates="executed_by")
    watchlist_keywords = relationship("UserWatchListKeyword", back_populates="user", cascade="all, delete-orphan")
    
    def get_all_roles(self) -> list:
        """Get all roles for this user (primary + additional)."""
        roles = [self.role.value if hasattr(self.role, 'value') else self.role]
        if self.additional_roles:
            roles.extend(self.additional_roles)
        return list(set(roles))  # Remove duplicates


class FeedSource(Base):
    __tablename__ = "feed_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String, unique=True, nullable=False)
    feed_type = Column(String, default="rss")  # rss, atom, html
    is_active = Column(Boolean, default=True)
    high_fidelity = Column(Boolean, default=False, index=True)  # Auto-triage and hunt
    headers = Column(JSON, default={})  # Auth headers, User-Agent, etc.
    last_fetched = Column(DateTime, nullable=True)
    next_fetch = Column(DateTime, default=datetime.utcnow)
    fetch_error = Column(Text, nullable=True)
    
    # Refresh interval settings (in minutes) - null means use system default
    refresh_interval_minutes = Column(Integer, nullable=True)  # Admin-set per-source override
    auto_fetch_enabled = Column(Boolean, default=True)  # Can disable auto-fetch per source
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    articles = relationship("Article", back_populates="feed_source")
    user_preferences = relationship("UserSourcePreference", back_populates="source", cascade="all, delete-orphan")
    default_settings = relationship("DefaultFeedSource", back_populates="source", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_feed_source_active", "is_active"),
        Index("idx_feed_source_next_fetch", "next_fetch"),
        Index("idx_feed_source_high_fidelity", "high_fidelity"),
    )


class Article(Base):
    __tablename__ = "articles"
    
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("feed_sources.id"), nullable=False)
    external_id = Column(String, nullable=False)  # Feed entry ID for deduplication
    title = Column(String, nullable=False)
    raw_content = Column(Text, nullable=True)  # Original HTML/XML snapshot
    normalized_content = Column(Text, nullable=True)  # Cleaned HTML
    summary = Column(Text, nullable=True)
    url = Column(String, nullable=True, index=True)
    image_url = Column(String, nullable=True)  # Featured image from article
    published_at = Column(DateTime, nullable=True)
    status = Column(SQLEnum(ArticleStatus), default=ArticleStatus.NEW, index=True)
    
    # Analysis tracking
    assigned_analyst_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    genai_analysis_remarks = Column(Text, nullable=True)  # Renamed from analyst_remarks
    executive_summary = Column(Text, nullable=True)
    technical_summary = Column(Text, nullable=True)
    
    # Audit trail
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    analyzed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    analyzed_at = Column(DateTime, nullable=True)
    
    # Watch list
    is_high_priority = Column(Boolean, default=False, index=True)
    watchlist_match_keywords = Column(JSON, default=[])
    
    # Hunt tracking
    hunt_generated_count = Column(Integer, default=0, nullable=False)
    hunt_launched_count = Column(Integer, default=0, nullable=False)
    last_hunt_generated_at = Column(DateTime, nullable=True)
    last_hunt_launched_at = Column(DateTime, nullable=True)
    
    # Content deduplication
    content_hash = Column(String(64), nullable=True, index=True)  # SHA-256 hash for dedup
    
    # Dual date tracking
    ingested_at = Column(DateTime, default=datetime.utcnow, index=True)  # When Parshu ingested the article
    # Note: published_at is the original article publication date from the source
    # Note: created_at is retained for backward compatibility
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    feed_source = relationship("FeedSource", back_populates="articles")
    assigned_analyst = relationship("User", foreign_keys=[assigned_analyst_id], back_populates="articles")
    extracted_intelligence = relationship("ExtractedIntelligence", back_populates="article")
    ioc_links = relationship("ArticleIOC", back_populates="article", cascade="all, delete-orphan")
    hunts = relationship("Hunt", back_populates="article")
    hunt_tracking = relationship("ArticleHuntTracking", back_populates="article", cascade="all, delete-orphan")
    read_status = relationship("ArticleReadStatus", back_populates="article", cascade="all, delete-orphan")
    comments = relationship("ArticleComment", back_populates="article", cascade="all, delete-orphan", order_by="ArticleComment.created_at")
    
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_article_source_external"),
        Index("idx_article_status", "status"),
        Index("idx_article_created", "created_at"),
        Index("idx_article_high_priority", "is_high_priority"),
    )


class IOC(Base):
    """Central IOC table - same IOC can appear in multiple articles."""
    __tablename__ = "iocs"
    
    id = Column(Integer, primary_key=True, index=True)
    value = Column(String, nullable=False)  # IP, domain, hash, etc.
    ioc_type = Column(String(50), nullable=False)  # ip, domain, hash_md5, email, etc.
    description = Column(Text, nullable=True)
    confidence = Column(Integer, default=50)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    occurrence_count = Column(Integer, default=1)
    is_false_positive = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Many-to-many with articles through article_iocs
    articles = relationship("ArticleIOC", back_populates="ioc")
    
    __table_args__ = (
        UniqueConstraint("value", "ioc_type", name="uq_ioc_value_type"),
        Index("idx_iocs_value", "value"),
        Index("idx_iocs_type", "ioc_type"),
        Index("idx_iocs_last_seen", "last_seen_at"),
    )


class ArticleIOC(Base):
    """Junction table for Article-IOC many-to-many relationship."""
    __tablename__ = "article_iocs"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    ioc_id = Column(Integer, ForeignKey("iocs.id", ondelete="CASCADE"), nullable=False)
    extracted_at = Column(DateTime, default=datetime.utcnow)
    extracted_by = Column(String(50), default="genai")  # genai, regex, manual
    confidence = Column(Integer, default=50)
    evidence = Column(Text, nullable=True)
    context = Column(Text, nullable=True)  # Where in the article it was found
    
    # Relationships
    article = relationship("Article", back_populates="ioc_links")
    ioc = relationship("IOC", back_populates="articles")
    
    __table_args__ = (
        UniqueConstraint("article_id", "ioc_id", name="uq_article_ioc"),
        Index("idx_article_iocs_article", "article_id"),
        Index("idx_article_iocs_ioc", "ioc_id"),
    )


class ExtractedIntelligence(Base):
    __tablename__ = "extracted_intelligence"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    hunt_execution_id = Column(Integer, ForeignKey("hunt_executions.id"), nullable=True)  # If extracted from hunt results
    intelligence_type = Column(SQLEnum(ExtractedIntelligenceType), nullable=False)
    value = Column(String, nullable=False)  # IOC value, TTP ID, etc.
    confidence = Column(Integer, default=50)  # 0-100 confidence score
    evidence = Column(Text, nullable=True)  # Why we think this is valid
    mitre_id = Column(String, nullable=True)  # MITRE ATT&CK/ATLAS ID
    meta = Column("metadata", JSON, default={})  # Type-specific metadata
    is_reviewed = Column(Boolean, default=False)  # Analyst has reviewed/confirmed this
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Who reviewed it
    reviewed_at = Column(DateTime, nullable=True)  # When it was reviewed
    is_false_positive = Column(Boolean, default=False)  # Marked as false positive by analyst
    notes = Column(Text, nullable=True)  # Analyst notes
    created_at = Column(DateTime, default=datetime.utcnow)
    
    article = relationship("Article", back_populates="extracted_intelligence")
    hunt_execution = relationship("HuntExecution", back_populates="extracted_from_results")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    __table_args__ = (
        Index("idx_intelligence_type", "intelligence_type"),
        Index("idx_intelligence_value", "value"),
        Index("idx_intelligence_hunt_execution", "hunt_execution_id"),
    )


class WatchListKeyword(Base):
    __tablename__ = "watchlist_keywords"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserWatchListKeyword(Base):
    """User-specific watchlist keywords (in addition to global)."""
    __tablename__ = "user_watchlist_keywords"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    keyword = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="watchlist_keywords")

    __table_args__ = (
        UniqueConstraint("user_id", "keyword", name="uq_user_watchlist_keyword"),
        Index("idx_user_watchlist_user", "user_id"),
    )


class DefaultFeedSource(Base):
    """Admin-defined default feed sources for new users."""
    __tablename__ = "default_feed_sources"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("feed_sources.id", ondelete="CASCADE"), nullable=False)
    is_default = Column(Boolean, default=True)  # Auto-subscribe new users
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    source = relationship("FeedSource", back_populates="default_settings")
    created_by = relationship("User")

    __table_args__ = (
        Index("idx_default_feed_source", "source_id"),
    )


class Hunt(Base):
    __tablename__ = "hunts"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    platform = Column(String, nullable=False)  # xsiam, defender, wiz
    query_logic = Column(Text, nullable=False)
    title = Column(String, nullable=True)  # GenAI-generated title for the hunt
    initiated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    initiated_by_type = Column(String, default="USER")  # USER, AUTO, or GENAI
    status = Column(String, default="PENDING")  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    generated_by_model = Column(String, nullable=True)  # e.g., gpt-4
    prompt_template_version = Column(String, default="v1")
    response_hash = Column(String, nullable=True)  # Hash of GenAI response
    parent_hunt_id = Column(Integer, ForeignKey("hunts.id"), nullable=True)  # For edit versions
    
    # Query versioning
    query_version = Column(Integer, default=1, nullable=False)  # Increment on edits
    
    # Manual creation support
    is_manual = Column(Boolean, default=False, nullable=False)
    manual_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    article = relationship("Article", back_populates="hunts")
    executions = relationship("HuntExecution", back_populates="hunt")
    hunt_tracking = relationship("ArticleHuntTracking", back_populates="hunt", cascade="all, delete-orphan")
    initiated_by = relationship("User", foreign_keys=[initiated_by_id])
    parent_hunt = relationship("Hunt", remote_side=[id], backref="versions")


class HuntExecution(Base):
    __tablename__ = "hunt_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    hunt_id = Column(Integer, ForeignKey("hunts.id"), nullable=False)
    trigger_type = Column(SQLEnum(HuntTriggerType), nullable=False)  # MANUAL or AUTO
    status = Column(SQLEnum(HuntStatus), default=HuntStatus.PENDING)
    executed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    executed_at = Column(DateTime, nullable=True)
    results = Column(JSON, nullable=True)  # Query results
    findings_summary = Column(Text, nullable=True)  # Summary of findings
    hits_count = Column(Integer, default=0)  # Number of hits found
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    email_sent = Column(Boolean, default=False)  # Idempotent email tracking
    servicenow_ticket_id = Column(String, nullable=True)  # Idempotent ticket tracking
    # Query versioning - track which version of query was executed
    query_version = Column(Integer, default=1)  # Version of query at execution time
    query_snapshot = Column(Text, nullable=True)  # Snapshot of actual query executed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    hunt = relationship("Hunt", back_populates="executions")
    executed_by = relationship("User", back_populates="hunt_executions")
    extracted_from_results = relationship("ExtractedIntelligence", back_populates="hunt_execution")


class ReportStatus(str, Enum):
    """Status of a report."""
    DRAFT = "DRAFT"  # Being edited/reviewed
    PUBLISHED = "PUBLISHED"  # Finalized and ready for viewing/download


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    article_ids = Column(JSON, default=[])  # Array of article IDs
    content = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)  # Editable executive summary
    technical_summary = Column(Text, nullable=True)  # Editable technical summary
    key_findings = Column(JSON, default=[])  # Editable list of key findings
    recommendations = Column(JSON, default=[])  # Editable recommendations
    report_type = Column(String, default="comprehensive")  # comprehensive, executive, technical
    status = Column(SQLEnum(ReportStatus), default=ReportStatus.DRAFT, nullable=False, index=True)
    generated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    edited_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Last editor
    edited_at = Column(DateTime, nullable=True)  # Last edit time
    published_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Who published
    published_at = Column(DateTime, nullable=True)  # When published
    version = Column(Integer, default=1)  # Version tracking
    shared_with_emails = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Version control fields (will be added via migration)
    # parent_version_id = Column(Integer, ForeignKey("report_versions.id"), nullable=True)
    # allow_edits = Column(Boolean, default=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_type = Column(SQLEnum(AuditEventType), nullable=False, index=True)
    resource_type = Column(String, nullable=True)  # article, hunt, connector, etc.
    resource_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)  # created, updated, deleted, etc.
    details = Column(JSON, default={})  # Event-specific metadata
    correlation_id = Column(String, nullable=True, index=True)  # For tracing
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="audit_events")
    __table_args__ = (
        Index("idx_audit_event_type", "event_type"),
        Index("idx_audit_created", "created_at"),
        Index("idx_audit_correlation", "correlation_id"),
    )


class ConnectorConfig(Base):
    __tablename__ = "connector_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    connector_type = Column(String, nullable=False, index=True)  # References platform_id
    config = Column(JSON, default={})  # Encrypted in production
    is_active = Column(Boolean, default=True, index=True)
    last_tested_at = Column(DateTime, nullable=True)
    last_test_status = Column(String, nullable=True)  # success, failed
    last_test_message = Column(Text, nullable=True)  # Error details if failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class ConnectorPlatform(Base):
    """
    Platform registry - defines available connector platforms.
    This replaces hardcoded platform lists throughout the app.
    Platforms can be built-in or custom-created by admins.
    """
    __tablename__ = "connector_platforms"
    
    id = Column(Integer, primary_key=True, index=True)
    platform_id = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "defender", "splunk"
    name = Column(String(100), nullable=False)  # Display name
    description = Column(Text, nullable=True)
    vendor = Column(String(100), nullable=True)  # e.g., "Microsoft", "Splunk Inc"
    
    # Category/Classification
    category = Column(String(50), nullable=False, index=True)  # siem, edr, cloud_security, sandbox, enrichment, notification
    subcategory = Column(String(50), nullable=True)  # Additional classification
    
    # Visual
    icon_url = Column(String(500), nullable=True)  # URL or data URI for icon
    color = Column(String(20), nullable=True)  # Brand color hex code
    
    # Capabilities
    capabilities = Column(JSON, default=[])  # ["hunt", "enrich", "notify", "ingest", "export"]
    
    # Query language details (for hunt platforms)
    query_language = Column(String(50), nullable=True)  # KQL, SPL, XQL, SQL, GraphQL
    query_syntax = Column(JSON, default={})  # Tables, fields, operators, keywords, examples
    documentation_url = Column(String(500), nullable=True)
    
    # Configuration schema - defines what fields are needed
    config_schema = Column(JSON, default={})  # JSON Schema for config fields
    
    # API definition for custom connectors
    api_definition = Column(JSON, default={})  # Base URL, auth type, endpoints
    
    # Status
    is_builtin = Column(Boolean, default=False)  # Built-in vs custom
    is_active = Column(Boolean, default=True, index=True)
    is_beta = Column(Boolean, default=False)  # Mark experimental connectors
    
    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    templates = relationship("ConnectorTemplate", back_populates="platform", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_platform_category", "category"),
        Index("idx_platform_active", "is_active"),
    )


class ConnectorTemplate(Base):
    """
    Connector templates - reusable API endpoint configurations.
    Allows admins to define actions without coding.
    """
    __tablename__ = "connector_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    platform_id = Column(Integer, ForeignKey("connector_platforms.id", ondelete="CASCADE"), nullable=False)
    
    # Template identification
    template_id = Column(String(50), nullable=False)  # e.g., "search_events", "get_alert"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Action type
    action_type = Column(String(30), nullable=False)  # query, enrich, notify, ingest, export, test
    
    # HTTP configuration
    http_method = Column(String(10), default="POST")  # GET, POST, PUT, DELETE, PATCH
    endpoint_path = Column(String(500), nullable=False)  # Path with placeholders like {ioc_value}
    
    # Headers (can include auth tokens via placeholders)
    headers = Column(JSON, default={})  # {"Authorization": "Bearer {{api_key}}"}
    
    # Request body template (for POST/PUT)
    request_template = Column(JSON, default={})  # Jinja2/mustache style templating
    content_type = Column(String(50), default="application/json")
    
    # Query parameters template
    query_params = Column(JSON, default={})  # {"query": "{{hunt_query}}", "limit": 100}
    
    # Response parsing
    response_parser = Column(JSON, default={})  # JSONPath expressions for extracting data
    success_condition = Column(String(200), nullable=True)  # Expression to determine success
    
    # Input schema - what variables this template accepts
    input_schema = Column(JSON, default={})  # Defines expected inputs
    
    # Output schema - what this template returns
    output_schema = Column(JSON, default={})  # Defines output structure
    
    # Rate limiting
    rate_limit_requests = Column(Integer, nullable=True)  # Max requests per window
    rate_limit_window_seconds = Column(Integer, nullable=True)  # Window duration
    
    # Retry configuration
    retry_on_status = Column(JSON, default=[429, 500, 502, 503, 504])  # Retry on these status codes
    max_retries = Column(Integer, default=3)
    retry_delay_seconds = Column(Integer, default=1)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default template for action type
    
    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    platform = relationship("ConnectorPlatform", back_populates="templates")
    
    __table_args__ = (
        UniqueConstraint("platform_id", "template_id", name="uq_platform_template"),
        Index("idx_template_action", "action_type"),
    )


class ConnectorExecution(Base):
    """
    Tracks connector executions for debugging and analytics.
    """
    __tablename__ = "connector_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    connector_config_id = Column(Integer, ForeignKey("connector_configs.id", ondelete="SET NULL"), nullable=True)
    template_id = Column(Integer, ForeignKey("connector_templates.id", ondelete="SET NULL"), nullable=True)
    
    # Execution context
    platform_id = Column(String(50), nullable=False)
    action_type = Column(String(30), nullable=False)
    triggered_by = Column(String(50), nullable=True)  # manual, automation, hunt, enrichment
    
    # Request details (sanitized - no secrets)
    request_url = Column(String(1000), nullable=True)
    request_method = Column(String(10), nullable=True)
    request_body_preview = Column(Text, nullable=True)  # First 500 chars, sanitized
    
    # Response details
    response_status = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    response_body_preview = Column(Text, nullable=True)  # First 500 chars
    
    # Result
    status = Column(String(20), nullable=False, index=True)  # success, failed, timeout, rate_limited
    error_message = Column(Text, nullable=True)
    result_count = Column(Integer, nullable=True)  # Number of results/items returned
    
    # Correlation
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="SET NULL"), nullable=True)
    hunt_id = Column(Integer, ForeignKey("hunts.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamp
    executed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index("idx_execution_platform", "platform_id"),
        Index("idx_execution_status", "status"),
        Index("idx_execution_date", "executed_at"),
    )


class ArticleReadStatus(Base):
    __tablename__ = "article_read_status"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    article = relationship("Article", back_populates="read_status")
    user = relationship("User")
    
    __table_args__ = (
        UniqueConstraint("article_id", "user_id", name="uq_article_user_read_status"),
        Index("idx_read_status_article", "article_id"),
        Index("idx_read_status_user", "user_id"),
    )


class ArticleComment(Base):
    """Comments/notes on articles for analyst collaboration."""
    __tablename__ = "article_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment_text = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True)  # Internal vs external comment
    parent_id = Column(Integer, ForeignKey("article_comments.id"), nullable=True)  # For threaded replies
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    article = relationship("Article", back_populates="comments")
    user = relationship("User")
    replies = relationship("ArticleComment", backref="parent", remote_side=[id])
    
    __table_args__ = (
        Index("idx_comment_article", "article_id"),
        Index("idx_comment_user", "user_id"),
        Index("idx_comment_created", "created_at"),
    )


class SystemConfiguration(Base):
    """Dynamic system configuration stored in database.
    
    Allows admins to configure settings via UI without restarting services.
    Sensitive values like API keys are encrypted at rest.
    """
    __tablename__ = "system_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False, index=True)  # genai, notifications, hunt_connectors, etc.
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=True)  # Encrypted for sensitive values
    value_type = Column(String(20), default="string")  # string, int, bool, json
    is_sensitive = Column(Boolean, default=False)  # API keys, passwords
    description = Column(String(500), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint("category", "key", name="uq_config_category_key"),
        Index("idx_config_category", "category"),
    )


# ============================================================================
# KNOWLEDGE BASE FOR RAG (Retrieval Augmented Generation)
# ============================================================================

class KnowledgeDocumentType(str, Enum):
    """Type of knowledge document."""
    PRODUCT_DOCUMENTATION = "product_documentation"  # XSIAM, Defender, Splunk docs
    QUERY_SYNTAX = "query_syntax"  # XQL, KQL, SPL syntax guides
    THREAT_INTEL = "threat_intel"  # Threat actor profiles, malware analysis
    PLAYBOOK = "playbook"  # Incident response, hunting playbooks
    POLICY = "policy"  # Security policies, procedures
    CUSTOM = "custom"  # User-uploaded custom documents


class KnowledgeDocumentStatus(str, Enum):
    """Processing status of a document."""
    PENDING = "PENDING"
    CRAWLING = "CRAWLING"  # Actively crawling website
    PROCESSING = "PROCESSING"  # Processing/chunking content
    READY = "READY"
    FAILED = "FAILED"


class KnowledgeDocumentScope(str, Enum):
    """Scope of knowledge document - who can access it."""
    GLOBAL = "global"  # Admin-managed, applies to all users and functions
    USER = "user"  # User-managed, only visible to the uploader


class KnowledgeDocument(Base):
    """
    Knowledge documents for RAG-based GenAI operations.
    
    Two types of knowledge:
    1. Admin-managed (scope=global): High priority, applies across platform
    2. User-managed (scope=user): Individual user's documents for chatbot
    """
    __tablename__ = "knowledge_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Document metadata
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    doc_type = Column(SQLEnum(KnowledgeDocumentType), default=KnowledgeDocumentType.CUSTOM)
    
    # Scope and ownership
    scope = Column(String(20), default="global")  # "global" (admin) or "user" (individual)
    is_admin_managed = Column(Boolean, default=True)  # True = admin knowledge base
    
    # Source information
    source_type = Column(String(20), nullable=False)  # "file" or "url"
    source_url = Column(Text, nullable=True)  # URL if source_type is "url"
    file_name = Column(String(255), nullable=True)  # Original filename
    file_path = Column(String(500), nullable=True)  # Storage path
    file_size = Column(Integer, nullable=True)  # Size in bytes
    mime_type = Column(String(100), nullable=True)  # MIME type
    
    # Duplicate detection
    content_hash = Column(String(64), nullable=True, index=True)  # SHA-256 hash of content
    
    # Processing status
    status = Column(SQLEnum(KnowledgeDocumentStatus), default=KnowledgeDocumentStatus.PENDING)
    processing_error = Column(Text, nullable=True)
    
    # Extracted content
    raw_content = Column(Text, nullable=True)  # Full extracted text
    chunk_count = Column(Integer, default=0)  # Number of chunks created
    
    # Crawl settings (for URLs)
    crawl_depth = Column(Integer, default=0)  # How deep to crawl
    pages_crawled = Column(Integer, default=0)  # Actual pages crawled
    
    # Targeting - which GenAI functions should use this document
    target_functions = Column(JSON, nullable=True)  # ["hunt_query_xsiam", "ioc_extraction"]
    target_platforms = Column(JSON, nullable=True)  # ["xsiam", "defender", "splunk"]
    
    # Metadata
    tags = Column(JSON, nullable=True)  # ["syntax", "kql", "defender"]
    priority = Column(Integer, default=5)  # 1-10, higher = more important in retrieval
    is_active = Column(Boolean, default=True)
    
    # Audit
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)  # Track usage for analytics
    usage_count = Column(Integer, default=0)  # How many times referenced
    
    # Relationships
    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete", passive_deletes=True)
    
    __table_args__ = (
        Index("idx_knowledge_doc_type", "doc_type"),
        Index("idx_knowledge_status", "status"),
        Index("idx_knowledge_active", "is_active"),
    )


class KnowledgeChunk(Base):
    """
    Chunks of knowledge documents for embedding and retrieval.
    
    Each document is split into smaller chunks for more precise retrieval.
    Embeddings are stored for semantic similarity search.
    """
    __tablename__ = "knowledge_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False)
    
    # Chunk content
    chunk_index = Column(Integer, nullable=False)  # Order within document
    content = Column(Text, nullable=False)  # Chunk text
    token_count = Column(Integer, nullable=True)  # Approximate token count
    
    # Embedding (stored as JSON array of floats)
    # For production, use pgvector extension or dedicated vector DB
    embedding = Column(JSON, nullable=True)
    embedding_model = Column(String(100), nullable=True)  # Model used for embedding
    
    # Extra info
    chunk_metadata = Column(JSON, nullable=True)  # Section headers, page numbers, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    document = relationship("KnowledgeDocument", back_populates="chunks")
    
    __table_args__ = (
        Index("idx_chunk_document", "document_id"),
    )


# ============================================================================
# ENVIRONMENT CONTEXT - Company-specific knowledge
# ============================================================================

class EnvironmentAssetType(str, Enum):
    """Type of environment asset."""
    IP_RANGE = "ip_range"
    DOMAIN = "domain"
    PRODUCT = "product"
    TECHNOLOGY = "technology"
    CLOUD_RESOURCE = "cloud_resource"
    NETWORK_SEGMENT = "network_segment"
    CUSTOM = "custom"


class EnvironmentContext(Base):
    """
    Company environment context for relevance assessment.
    
    Stores information about the organization's environment:
    - IP ranges
    - Domain names
    - Products and versions
    - Cloud resources
    - Network segments
    
    Used to assess if threats are applicable to the organization.
    """
    __tablename__ = "environment_context"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Asset identification
    asset_type = Column(SQLEnum(EnvironmentAssetType), nullable=False)
    name = Column(String(255), nullable=False)  # Descriptive name
    value = Column(Text, nullable=False)  # The actual value (IP, domain, product name, etc.)
    
    # Additional details
    version = Column(String(100), nullable=True)  # For products/technologies
    vendor = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    # Criticality
    criticality = Column(String(20), default="medium")  # low, medium, high, critical
    business_unit = Column(String(255), nullable=True)  # Which team/department owns this
    
    # For vulnerability correlation
    cpe_identifier = Column(String(500), nullable=True)  # CPE for product matching
    
    # Metadata
    tags = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    source = Column(String(100), nullable=True)  # manual, wiz, defender, etc.
    
    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_env_asset_type", "asset_type"),
        Index("idx_env_value", "value"),
    )


# ============================================================================
# USER CUSTOM FEEDS - Personal RSS/Atom feeds per user
# ============================================================================

class UserFeed(Base):
    """
    User-specific custom feeds that are managed by individual users.
    These are separate from system FeedSources and allow users to add
    their own personal RSS/Atom feeds without affecting the global sources.
    """
    __tablename__ = "user_feeds"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Feed details
    name = Column(String(255), nullable=False)
    url = Column(String(2048), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="custom")  # custom, news, vendor, research, etc.
    feed_type = Column(String(50), default="rss")  # rss, atom
    
    # Status
    is_active = Column(Boolean, default=True)
    last_fetched = Column(DateTime, nullable=True)
    fetch_error = Column(Text, nullable=True)
    article_count = Column(Integer, default=0)
    
    # Preferences
    auto_ingest = Column(Boolean, default=True)  # Auto-fetch articles
    notify_on_new = Column(Boolean, default=False)  # Notify user on new articles
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = relationship("User", backref="custom_feeds")
    
    __table_args__ = (
        UniqueConstraint("user_id", "url", name="uq_user_feed_url"),
        Index("idx_user_feed_user", "user_id"),
        Index("idx_user_feed_active", "is_active"),
    )


# ============================================================================
# USER SOURCE PREFERENCES - Per-user overrides for source refresh settings
# ============================================================================

class UserSourcePreference(Base):
    """
    User-specific preferences for feed sources.
    
    Allows users to override admin-configured refresh intervals
    and other per-source settings for their own viewing/usage.
    """
    __tablename__ = "user_source_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(Integer, ForeignKey("feed_sources.id", ondelete="CASCADE"), nullable=False)
    
    # Refresh settings - null means use source/system default
    refresh_interval_minutes = Column(Integer, nullable=True)  # User override for refresh interval
    auto_fetch_enabled = Column(Boolean, nullable=True)  # User override for auto-fetch
    
    # Display preferences
    is_hidden = Column(Boolean, default=False)  # Hide this source from user's view
    is_pinned = Column(Boolean, default=False)  # Pin to top of source list
    notification_enabled = Column(Boolean, default=True)  # Notify on new articles from this source
    
    # Custom categorization
    custom_category = Column(String(100), nullable=True)  # User's custom category for this source
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="source_preferences")
    source = relationship("FeedSource", back_populates="user_preferences")
    
    __table_args__ = (
        UniqueConstraint("user_id", "source_id", name="uq_user_source_preference"),
        Index("idx_user_source_pref_user", "user_id"),
        Index("idx_user_source_pref_source", "source_id"),
    )


class ArticleApplicability(Base):
    """
    Tracks applicability of articles/threats to the organization's environment.
    """
    __tablename__ = "article_applicability"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    
    # Applicability assessment
    applicability_level = Column(String(20), nullable=False)  # high, medium, low, not_applicable
    confidence = Column(Integer, default=50)  # 0-100
    
    # Matched assets
    matched_assets = Column(JSON, nullable=True)  # List of EnvironmentContext IDs that matched
    match_reason = Column(Text, nullable=True)  # Why it was marked as applicable
    
    # GenAI assessment
    genai_assessment = Column(Text, nullable=True)
    assessed_by = Column(String(50), nullable=True)  # "genai", "analyst", "automated"
    
    # Audit
    assessed_at = Column(DateTime, default=datetime.utcnow)
    assessed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    article = relationship("Article", backref="applicability_assessments")


class ArticleHuntTracking(Base):
    """
    Tracks the relationship between articles and hunts for bidirectional visibility.
    Shows hunt generation and launch status in both Article Detail and Hunt Workbench.
    """
    __tablename__ = "article_hunt_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True)
    hunt_id = Column(Integer, ForeignKey("hunts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Status tracking
    generation_status = Column(String(50), nullable=False, default="GENERATED")  # GENERATED, EDITED, DELETED
    launch_status = Column(String(50), nullable=True)  # LAUNCHED, RUNNING, COMPLETED, FAILED
    
    # Timestamps
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    launched_at = Column(DateTime, nullable=True)
    
    # User tracking
    generated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    launched_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Visibility control
    is_visible_in_workbench = Column(Boolean, default=True, nullable=False, index=True)
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    article = relationship("Article", back_populates="hunt_tracking")
    hunt = relationship("Hunt", back_populates="hunt_tracking")
    generated_by = relationship("User", foreign_keys=[generated_by_user_id])
    launched_by = relationship("User", foreign_keys=[launched_by_user_id])
    
    __table_args__ = (
        UniqueConstraint("article_id", "hunt_id", name="uq_article_hunt_tracking"),
        Index("idx_article_hunt_tracking_status", "generation_status", "launch_status"),
    )
