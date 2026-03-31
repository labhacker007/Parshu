# Jyoti - Feature List & Product Specification

> **Jyoti** is a fully admin-managed, enterprise-grade news feed aggregator with RBAC, AI-powered analysis, and multi-format content support. It competes with and goes beyond Feedly, Google News, Inoreader, and similar products.

---

## 1. Authentication & Identity Management

### 1.1 Multi-Method Authentication
| Feature | Description | Status |
|---------|-------------|--------|
| Email/Password Login | Argon2-hashed passwords, secure JWT tokens | Done |
| OAuth 2.0 (Google) | One-click Google sign-in | Done |
| OAuth 2.0 (Microsoft) | One-click Microsoft/Azure AD sign-in | Done |
| SAML 2.0 SSO | Enterprise single sign-on (Okta, Azure AD, OneLogin) | Done |
| OTP/2FA | TOTP-based two-factor authentication with QR code setup | Done |
| Token Refresh | Automatic JWT token refresh without re-login | Done |
| Password Change | Secure in-app password change with current password verification | Done |

### 1.2 Session Security
| Feature | Description | Status |
|---------|-------------|--------|
| JWT Access Tokens | HS256 signed, configurable expiry | Done |
| Refresh Tokens | Long-lived tokens with rotation | Done |
| Token Blocklist | Revoke compromised tokens via Redis | Done |
| Rate Limiting | Per-IP and per-user rate limits (in-memory + Redis) | Done |
| Brute Force Protection | Account lockout after repeated failed attempts | Done |

---

## 2. Role-Based Access Control (RBAC)

### 2.1 Roles
| Role | Description |
|------|-------------|
| **ADMIN** | Full platform access: manage users, sources, watchlists, GenAI config, audit logs |
| **USER** | Personal access: view articles, manage own feeds/watchlist/categories/bookmarks |

### 2.2 Granular Permissions (137 fine-grained permissions)
| Permission Category | Admin | User |
|---------------------|-------|------|
| Read Articles | Yes | Yes |
| Manage Feed Sources | Yes | No |
| Manage Global Watchlist | Yes | No |
| Manage User Watchlist | Yes | Yes (own) |
| Manage User Feeds | Yes | Yes (own) |
| Manage User Categories | Yes | Yes (own) |
| Manage Users | Yes | No |
| View Audit Logs | Yes | No |
| GenAI Admin (Models, Prompts, Guardrails) | Yes | No |
| Article Bookmarks | Yes | Yes |
| Article Export (PDF/Word) | Yes | Yes |

### 2.3 Custom Permissions
| Feature | Description | Status |
|---------|-------------|--------|
| Additional Roles | Assign extra roles per user | Done |
| Permission Grants | Grant specific permissions beyond role | Done |
| Permission Denials | Deny specific permissions from role | Done |

---

## 3. Feed Source Management (Admin)

### 3.1 Source Types
| Type | Description | Status |
|------|-------------|--------|
| RSS 2.0 | Standard RSS feed parsing | Done |
| Atom | Atom feed parsing | Done |
| Custom HTTP | JSON/HTML scraping with custom headers | Done |

### 3.2 Source Management
| Feature | Description | Status |
|---------|-------------|--------|
| CRUD Operations | Create, read, update, delete feed sources | Done |
| Bulk Import | Seed sources from JSON configuration | Done |
| High Fidelity Flag | Mark sources as premium/high-priority | Done |
| Custom Headers | HTTP headers for authenticated feeds | Done |
| Active/Inactive Toggle | Enable/disable sources without deletion | Done |
| Auto-Fetch Control | Per-source automatic fetch enable/disable | Done |
| Refresh Interval | Configurable per-source refresh interval (minutes) | Done |
| Fetch Error Tracking | Track and display last fetch error per source | Done |
| SSRF Protection | Prevent Server-Side Request Forgery on source URLs | Done |

### 3.3 Default Feeds for New Users
| Feature | Description | Status |
|---------|-------------|--------|
| Mark as Default | Admin marks sources as default for new registrations | Done |
| Auto-Subscribe | New users (email or OAuth) automatically get default feeds | Done |
| List Defaults | Admin view of all default feed sources | Done |

---

## 4. Article Management

### 4.1 Article Ingestion
| Feature | Description | Status |
|---------|-------------|--------|
| RSS/Atom Parsing | feedparser-based extraction | Done |
| Content Normalization | HTML sanitization with bleach | Done |
| Deduplication | Content hash-based duplicate detection | Done |
| Image Extraction | Extract article featured images | Done |
| Metadata Extraction | Title, author, published date, URL | Done |
| Batch Ingestion | Process multiple sources in parallel | Done |

### 4.2 Article Browsing
| Feature | Description | Status |
|---------|-------------|--------|
| Triage View | Paginated article listing with filters | Done |
| Status Filtering | Filter by NEW, READ, STARRED, etc. | Done |
| Source Filtering | Filter articles by feed source | Done |
| Priority Filtering | Show only high-priority (watchlist-matched) articles | Done |
| Date Range Filtering | Filter by published date range | Done |
| Search | Full-text search across article titles and content | Done |
| Pagination | Skip/limit-based pagination with total count | Done |

### 4.3 Article Interaction
| Feature | Description | Status |
|---------|-------------|--------|
| Read Status Tracking | Mark articles as read per user | Done |
| Bookmarks | Bookmark/unbookmark articles | Done |
| Bookmark List | View all bookmarked articles | Done |
| Article Detail | Full article view with metadata | Done |

### 4.4 Article Export
| Feature | Description | Status |
|---------|-------------|--------|
| PDF Export | Export article as formatted PDF (ReportLab) | Done |
| Word Export | Export article as Word document (python-docx) | Done |
| Metadata in Export | Include source, date, URL in exports | Done |

### 4.5 AI-Powered Summarization
| Feature | Description | Status |
|---------|-------------|--------|
| Article Summarization | AI-generated summary via configured GenAI model | Done |
| Multi-Provider Support | Ollama, OpenAI, Anthropic, Google Gemini | Done |
| Configurable Prompts | Admin-managed prompt templates for summarization | Done |

---

## 5. Watchlist System

### 5.1 Global Watchlist (Admin)
| Feature | Description | Status |
|---------|-------------|--------|
| Keyword Management | Admin adds/removes global watchlist keywords | Done |
| Auto-Priority | Articles matching global keywords auto-flagged as high-priority | Done |
| Active/Inactive Toggle | Enable/disable keywords without deletion | Done |

### 5.2 User Watchlist (Personal)
| Feature | Description | Status |
|---------|-------------|--------|
| Personal Keywords | Users add their own watchlist keywords | Done |
| Toggle Active/Inactive | Per-keyword enable/disable | Done |
| CRUD Operations | Full create, read, delete for user keywords | Done |
| Duplicate Prevention | Unique constraint per user + keyword | Done |

---

## 6. User Custom Feeds

### 6.1 Personal Feed Management
| Feature | Description | Status |
|---------|-------------|--------|
| Add Custom Feeds | Users add their own RSS/Atom feed URLs | Done |
| Feed CRUD | Create, read, update, delete personal feeds | Done |
| Category Assignment | Assign feeds to user-defined categories | Done |
| Feed Metadata | Name, URL, type, description per feed | Done |

### 6.2 User Categories
| Feature | Description | Status |
|---------|-------------|--------|
| Category CRUD | Create, read, update, delete categories | Done |
| Custom Colors | Hex color per category for visual organization | Done |
| Custom Icons | Icon name per category | Done |
| Ordering | Configurable category display order | Done |

---

## 7. Multi-Format Content Fetching

### 7.1 Supported Formats
| Format | Description | Status |
|--------|-------------|--------|
| HTML | Web page scraping with BeautifulSoup | Done |
| PDF | PDF text extraction (pypdf) | Done |
| Word (.docx) | Word document parsing (python-docx) | Done |
| CSV | CSV file parsing | Done |
| Excel (.xlsx) | Spreadsheet parsing (openpyxl) | Done |
| Plain Text | Raw text file reading | Done |

### 7.2 Content Features
| Feature | Description | Status |
|---------|-------------|--------|
| Auto-Detection | Format detection from content-type or URL extension | Done |
| Metadata Extraction | Title, word count, page count per format | Done |
| SSRF Protection | Block internal/private IP fetching | Done |

---

## 8. GenAI Administration

### 8.1 Ollama Integration
| Feature | Description | Status |
|---------|-------------|--------|
| Connection Status | Check Ollama service health and connectivity | Done |
| Model Discovery | List available Ollama models | Done |
| Model Pull | Download new models from Ollama registry | Done |
| Model Info | Get model details (size, parameters, family) | Done |

### 8.2 GenAI Model Management
| Feature | Description | Status |
|---------|-------------|--------|
| Multi-Provider | Support Ollama, OpenAI, Anthropic, Google Gemini | Done |
| Model CRUD | Register, update, delete AI models | Done |
| Default Model | Set default model for summarization | Done |
| Configuration | Per-model temperature, max_tokens, top_p settings | Done |
| Active/Inactive | Enable/disable models without deletion | Done |

### 8.3 GenAI Function Management
| Feature | Description | Status |
|---------|-------------|--------|
| Function Types | Summarization, extraction, classification, Q&A | Done |
| Function CRUD | Create, read, update, delete GenAI functions | Done |
| Configuration | Per-function parameters and settings | Done |

### 8.4 Prompt Template Management
| Feature | Description | Status |
|---------|-------------|--------|
| Template CRUD | Create, read, update, delete prompt templates | Done |
| Variable Substitution | {{variable}} placeholders with dynamic rendering | Done |
| Version Tracking | Version string per prompt for audit trail | Done |
| Prompt Rendering | Test render with sample variables | Done |
| Active/Inactive | Enable/disable prompts without deletion | Done |

### 8.5 Guardrails Management
| Feature | Description | Status |
|---------|-------------|--------|
| **PII Detection** | Detect emails, phone numbers, SSN, credit cards | Done |
| **PII Redaction** | Automatically redact detected PII | Done |
| **Prompt Injection Detection** | Block injection attacks (keyword-based) | Done |
| **Length Validation** | Enforce min/max input/output length limits | Done |
| **Token Estimation** | Approximate token count validation | Done |
| **Forbidden Keywords** | Block outputs containing specific words | Done |
| **Required Keywords** | Ensure outputs contain required words | Done |
| **Format Enforcement** | Enforce JSON/markdown output format | Done |
| **Toxicity Detection** | Block toxic/harmful content (configurable) | Done |
| Guardrail CRUD | Create, read, update, delete guardrails | Done |
| Prompt-Level Assignment | Attach guardrails to specific prompts | Done |
| Execution Ordering | Configurable guardrail execution order per prompt | Done |
| Test/Validate | Test guardrails with sample input before deployment | Done |
| Multi-Layer Validation | Chain multiple guardrails per prompt | Done |
| Actions on Failure | Configurable: retry, reject, fix, or log | Done |

---

## 9. Admin Dashboard & User Management

### 9.1 Dashboard
| Feature | Description | Status |
|---------|-------------|--------|
| System Stats | Total users, sources, articles counts | Done |
| Health Monitoring | Backend health check endpoint | Done |

### 9.2 User Management
| Feature | Description | Status |
|---------|-------------|--------|
| User CRUD | Create, read, update, delete users | Done |
| Role Assignment | Change user roles (ADMIN/USER) | Done |
| Active/Inactive | Enable/disable user accounts | Done |
| User Detail | View user profile with login history | Done |

---

## 10. Audit & Compliance

### 10.1 Audit Logging
| Feature | Description | Status |
|---------|-------------|--------|
| Request Logging | Log all API requests with correlation IDs | Done |
| Structured Logging | JSON-structured logs via structlog | Done |
| Audit Trail | Admin-viewable audit log endpoint | Done |
| User Attribution | Track which user performed each action | Done |
| IP Logging | Log client IP addresses | Done |

---

## 11. Security Features

### 11.1 Transport Security
| Feature | Description | Status |
|---------|-------------|--------|
| HTTPS Enforcement | HSTS header in production | Done |
| CORS Configuration | Strict CORS with credential support | Done |
| CSP Headers | Content Security Policy for all responses | Done |
| X-Frame-Options | DENY to prevent clickjacking | Done |
| X-Content-Type-Options | nosniff to prevent MIME sniffing | Done |
| Referrer Policy | strict-origin-when-cross-origin | Done |
| Permissions Policy | Disable camera, microphone, geolocation | Done |

### 11.2 Application Security
| Feature | Description | Status |
|---------|-------------|--------|
| Argon2 Password Hashing | Industry-standard password hashing | Done |
| Input Validation | Pydantic v2 schema validation on all endpoints | Done |
| SQL Injection Prevention | SQLAlchemy ORM parameterized queries | Done |
| XSS Prevention | HTML sanitization with bleach | Done |
| Rate Limiting | In-memory + Redis-backed rate limiting | Done |
| SSRF Protection | Block internal network requests | Done |
| Setup Token | Optional bootstrap token for shared dev environments | Done |

---

## 12. Infrastructure & Deployment

### 12.1 Database Support
| Feature | Description | Status |
|---------|-------------|--------|
| PostgreSQL | Production database with connection pooling | Done |
| SQLite | Development/testing database (auto-fallback) | Done |
| Auto-Migration | Schema migrations on startup (development) | Done |
| Alembic Support | Production migration framework | Done |

### 12.2 Caching
| Feature | Description | Status |
|---------|-------------|--------|
| Redis | Session cache, rate limiting, token blocklist | Done |
| In-Memory Fallback | Graceful degradation when Redis unavailable | Done |

### 12.3 Docker Deployment
| Feature | Description | Status |
|---------|-------------|--------|
| Multi-Service Compose | Backend, frontend, PostgreSQL, Redis | Done |
| Health Checks | Container health monitoring | Done |
| Multi-Stage Build | Optimized Docker images | Done |
| Environment Variables | Full configuration via .env files | Done |

### 12.4 Observability
| Feature | Description | Status |
|---------|-------------|--------|
| Structured Logging | JSON logs with correlation IDs (structlog) | Done |
| Prometheus Metrics | /metrics endpoint for monitoring | Done |
| Health Endpoint | /health with database connectivity check | Done |
| Request Tracing | Correlation IDs across request lifecycle | Done |

---

## 13. Frontend Features

### 13.1 UI/UX
| Feature | Description | Status |
|---------|-------------|--------|
| React SPA | Single-page application with React 18 | Done |
| Ant Design | Professional UI component library | Done |
| Dark/Light Theme | Configurable theme with persistence | Done |
| Responsive Layout | Mobile-friendly sidebar navigation | Done |
| Real-Time Updates | Auto-refresh article feeds | Done |

### 13.2 Pages
| Page | Description | Status |
|------|-------------|--------|
| Login | Email/password + OAuth buttons + OTP | Done |
| News Dashboard | Article triage with filters and search | Done |
| Sources Management | Admin CRUD for feed sources (with default toggle) | Done |
| Watchlist | Global (admin) + personal (user) tabs | Done |
| User Profile | Profile settings and password change | Done |
| Admin Panel | User management, dashboard stats | Done |

---

## 14. API Documentation

### 14.1 Auto-Generated
| Feature | Description | Status |
|---------|-------------|--------|
| Swagger UI | Interactive API docs at /docs | Done |
| ReDoc | Alternative docs at /redoc | Done |
| OpenAPI 3.0 | Machine-readable API schema at /openapi.json | Done |

---

## Competitive Comparison: Jyoti vs Feedly

| Feature | Feedly (Pro) | Jyoti |
|---------|-------------|-------|
| RSS/Atom Feeds | Yes | Yes |
| OAuth Login (Google/Microsoft) | Google only | Both |
| SAML SSO (Enterprise) | Enterprise only ($$$) | Included |
| 2FA/OTP | Yes | Yes |
| Admin User Management | No | Yes |
| Role-Based Access Control | No | Yes (Admin/User + 137 permissions) |
| Personal Watchlist | Yes (AI) | Yes |
| Global Admin Watchlist | No | Yes |
| Article Summarization | AI only (Leo) | Multi-provider AI |
| PDF/Word Export | No | Yes |
| Multi-Format Content (PDF, Word, Excel) | No | Yes |
| Custom Feed Categories | Yes | Yes |
| Default Feeds for New Users | No | Yes |
| GenAI Admin Panel | No | Yes |
| Prompt Template Management | No | Yes |
| AI Guardrails (PII, Injection) | No | Yes |
| Audit Logging | No | Yes |
| Self-Hosted | No | Yes |
| API-First Architecture | Yes | Yes |
| Prometheus Monitoring | No | Yes |

---

## Deployment Options

### Cloud
- **AWS**: ECS/Fargate with RDS PostgreSQL, ElastiCache Redis
- **Azure**: Container Apps with Azure Database for PostgreSQL, Azure Cache for Redis
- **GCP**: Cloud Run with Cloud SQL PostgreSQL, Memorystore for Redis
- **DigitalOcean**: App Platform with Managed Database

### On-Premise
- **Docker Compose**: Single-server deployment with all services
- **Kubernetes**: Helm chart for multi-node deployment
- **Bare Metal**: Systemd services with PostgreSQL and Redis

### Environment Agnostic
- All configuration via environment variables
- PostgreSQL + Redis as only external dependencies
- No vendor-specific SDK or cloud lock-in
- SQLite fallback for development/testing

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| **Frontend** | React 18, Ant Design 5, Axios |
| **Database** | PostgreSQL 15+ (production), SQLite (dev) |
| **Cache** | Redis 7+ |
| **AI** | Ollama (local), OpenAI, Anthropic, Google Gemini |
| **Auth** | JWT (HS256), OAuth 2.0 (Authlib), SAML 2.0 (pysaml2), TOTP |
| **Security** | Argon2, bleach, CORS, CSP, rate limiting |
| **Deployment** | Docker, Docker Compose, Kubernetes-ready |
| **Monitoring** | structlog, Prometheus, health checks |
| **Testing** | pytest, pytest-cov, requests-based integration tests |

---

*Version: 1.0 | Last Updated: 2026-02-08*
