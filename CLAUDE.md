# CLAUDE.md - Parshu Codebase Guide

## Project Overview

Parshu is an enterprise-grade Threat Intelligence Platform built for security teams.
It ingests threat intelligence from RSS/Atom feeds, extracts IOCs/IOAs/TTPs using GenAI,
enables threat hunting across multiple security platforms (XSIAM, Defender, Wiz, Splunk),
and generates shareable reports - all with RBAC and full audit logging.

**License:** PolyForm Noncommercial 1.0.0 (non-commercial use only).

## Repository Structure

```
Parshu/
├── backend/              # FastAPI (Python 3.11) API server
│   ├── app/              # Application package
│   │   ├── main.py       # FastAPI app entry point, middleware, router registration
│   │   ├── models.py     # SQLAlchemy ORM models (User, Article, Hunt, etc.)
│   │   ├── seeds.py      # Database seed logic (admin user + default feed sources)
│   │   ├── admin/        # Admin management endpoints
│   │   ├── analytics/    # Metrics and dashboard APIs
│   │   ├── articles/     # Article CRUD, triage queue, status workflow
│   │   ├── audit/        # Append-only audit logging + middleware
│   │   ├── auth/         # JWT auth, SAML/SSO, RBAC, dependencies
│   │   ├── automation/   # APScheduler-based task automation
│   │   ├── chatbot/      # AI chatbot interface
│   │   ├── connectors/   # Pluggable hunt platform connectors
│   │   ├── core/         # config.py, database.py, logging.py, rate_limit.py
│   │   ├── extraction/   # IOC/IOA/TTP extraction logic
│   │   ├── genai/        # GenAI provider abstraction + versioned prompts
│   │   ├── guardrails/   # Content filtering and safety guardrails
│   │   ├── hunts/        # Hunt query generation, execution, tracking
│   │   ├── ingestion/    # Feed parsing (RSS/Atom) and normalization
│   │   ├── integrations/ # External services (Slack, Email, ServiceNow)
│   │   ├── intelligence/ # Intelligence extraction and management
│   │   ├── iocs/         # Indicator of Compromise management
│   │   ├── knowledge/    # Knowledge base / RAG functionality
│   │   ├── notifications/# Email and Slack notifications
│   │   ├── reports/      # Report generation, versioning, export
│   │   ├── routers/      # API router aggregation
│   │   ├── users/        # User CRUD, profile, custom feeds
│   │   └── watchlist/    # High-priority watchlist filtering
│   ├── migrations/       # Alembic database migrations (19 versions)
│   ├── tests/            # pytest test suite
│   ├── requirements.txt  # Python dependencies (pinned versions)
│   ├── run.py            # Dev entry point (uvicorn with reload)
│   └── Dockerfile        # Backend container image
├── frontend/             # React 18 SPA (Create React App)
│   ├── src/
│   │   ├── index.js      # React entry point
│   │   ├── App.js        # Root component, routing, theme config
│   │   ├── api/client.js # Axios HTTP client with JWT interceptors
│   │   ├── store/index.js# Zustand auth store
│   │   ├── pages/        # Page components (Dashboard, ArticleQueue, Hunts, etc.)
│   │   ├── components/   # Reusable components (NavBar, RBAC, Chatbot, etc.)
│   │   ├── context/      # React context (ThemeContext, TimezoneContext)
│   │   ├── hooks/        # Custom React hooks
│   │   └── styles/       # Global CSS styles
│   ├── e2e/tests/        # Playwright E2E tests
│   ├── package.json      # NPM dependencies and scripts
│   ├── .eslintrc.json    # ESLint config (extends react-app)
│   └── playwright.config.js # Playwright E2E config
├── infra/                # Docker and Kubernetes deployment
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── Dockerfile.frontend.dev
│   ├── Dockerfile.tools
│   ├── k8s-manifests.yaml
│   └── namespace.yaml
├── config/
│   └── seed-sources.json # Default RSS feed sources (20 security feeds)
├── docker-compose.yml    # Local dev: postgres, redis, backend, frontend
├── env.example           # Environment variable template (~135 vars)
└── SECURITY.md           # Security policy and threat model
```

## Tech Stack

| Layer      | Technology                                                   |
|------------|--------------------------------------------------------------|
| Backend    | Python 3.11, FastAPI 0.104, Uvicorn, Pydantic 2.5           |
| Database   | PostgreSQL 15 (SQLAlchemy 2.0 ORM, Alembic migrations)      |
| Cache      | Redis 7                                                      |
| Frontend   | React 18, React Router 6, Zustand 4.4, Ant Design 5.11      |
| HTTP       | Axios 1.6 (frontend), httpx/requests (backend)               |
| GenAI      | OpenAI, Anthropic, Google Gemini, Ollama (multi-provider)    |
| Auth       | JWT (python-jose), SAML/SSO (pysaml2), Argon2 password hash  |
| Testing    | pytest + pytest-cov (backend), Jest + Playwright (frontend)  |
| Logging    | structlog (JSON), OpenTelemetry tracing, Prometheus metrics   |
| Container  | Docker Compose (dev), Kubernetes (production)                 |

## Development Setup

### Prerequisites
- Docker and Docker Compose
- (Optional) Ollama for local GenAI - default provider

### Start Development Environment
```bash
# Full stack (postgres + redis + backend + frontend)
docker-compose up --build

# Or use the helper script
./start-dev.sh
```

Services run at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API docs (Swagger):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health

### Running Without Docker
```bash
# Backend
cd backend
pip install -r requirements.txt
python run.py  # Starts uvicorn on port 8000 with --reload

# Frontend
cd frontend
npm install
npm start  # Starts dev server on port 3000
```

### Environment Variables
Copy `env.example` to `.env` and configure. Critical variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SECRET_KEY` - JWT signing key (must be 32+ chars in production)
- `ADMIN_PASSWORD` - Initial admin user password
- `GENAI_PROVIDER` - AI provider: `ollama`, `openai`, `anthropic`, or `gemini`

## Build & Test Commands

### Backend
```bash
# Run tests (from backend/ or inside Docker)
pytest -q

# Run tests with coverage
pytest --cov=app --cov-report=term-missing

# Run a specific test file
pytest tests/test_auth_flow.py -v

# Database migrations
alembic upgrade head        # Apply all migrations
alembic revision --autogenerate -m "description"  # Create new migration
```

### Frontend
```bash
# Unit tests
npm test                        # Watch mode
npm test -- --watchAll=false    # Single run (CI)

# E2E tests (requires Playwright browsers)
npx playwright install --with-deps  # Install browsers first
npm run test:e2e                    # Run E2E tests
npm run test:e2e:ci                 # CI mode with GitHub reporter

# Build production bundle
npm run build

# Lint
npx eslint src/
```

## Key Architecture Patterns

### Backend Module Convention
Each backend module follows a consistent structure:
- `routes.py` - FastAPI router with endpoint definitions (prefix + tags)
- `schemas.py` - Pydantic request/response models
- `service.py` - Business logic functions
- `models.py` (when needed) - Additional SQLAlchemy models

Routers are registered in `backend/app/main.py` with `app.include_router()`.

### Authentication & Authorization
- JWT bearer tokens via `Authorization: Bearer <token>` header
- Token refresh flow with separate refresh tokens
- `get_current_user` dependency provides the authenticated user
- `require_permission(Permission.XXX)` dependency enforces RBAC
- 7 roles: ADMIN, EXECUTIVE, MANAGER, TI, TH, IR, VIEWER
- Permission matrix defined in `backend/app/auth/rbac.py`
- Admin role impersonation for testing via `UserWithImpersonation` wrapper

### Article Triage State Machine
Articles follow this status workflow:
`NEW` -> `IN_ANALYSIS` -> `NEED_TO_HUNT` -> `HUNT_GENERATED` -> `REVIEWED` -> `ARCHIVED`

### GenAI Multi-Provider Architecture
The `backend/app/genai/` module abstracts across providers:
- Provider configured via `GENAI_PROVIDER` env var
- Versioned prompt templates in `genai/prompts/`
- Used for: hunt query generation, IOC extraction, report summarization, chatbot
- Default: Ollama (local) for development, cloud providers for production

### Frontend State Management
- **Auth state:** Zustand store (`frontend/src/store/index.js`) with localStorage persistence
- **API client:** Centralized Axios instance (`frontend/src/api/client.js`) with JWT interceptors and token refresh
- **Routing:** React Router v6 with `ProtectedRoute` component for auth guards
- **UI framework:** Ant Design with theme switching (dark/light) via ThemeContext

### Database
- SQLAlchemy 2.0 declarative models in `backend/app/models.py`
- Alembic manages schema migrations in `backend/migrations/`
- `get_db()` dependency yields a session per request
- Auto-seed on empty database during startup (dev convenience)

### Structured Logging
Uses `structlog` with JSON output. Import the shared logger:
```python
from app.core.logging import logger
logger.info("event_name", key="value")
```

### Audit Trail
All significant actions are logged via `AuditManager` and `AuditMiddleware`.
Event types defined in `models.py` as `AuditEventType` enum.

## Code Conventions

### Backend (Python)
- Use type hints on all function signatures
- Pydantic models for request/response validation (schemas.py)
- SQLAlchemy models use `Column()` declarative style
- Enums extend both `str` and `Enum` for JSON serialization
- Structured logging with event names: `logger.info("event_name", key=value)`
- Route functions use FastAPI dependency injection (`Depends()`)
- Settings loaded from environment via `pydantic-settings` (`core/config.py`)
- All passwords hashed with Argon2

### Frontend (JavaScript)
- Functional React components with hooks (no class components)
- Ant Design (`antd`) for UI components
- Zustand for global state (auth, theme)
- Axios client in `api/client.js` - all API calls go through this
- ESLint extends `react-app` preset
- Jest for unit tests, Playwright for E2E

### Security Practices
- HTML sanitization with Bleach on user content
- SSRF prevention with domain allowlists for feed ingestion
- CORS restricted to explicit origins (no wildcards with credentials)
- Security headers added via middleware (CSP, HSTS, X-Frame-Options)
- Input validation via Pydantic on all API endpoints
- Rate limiting middleware on API routes
- Secret validation enforced in production mode (32+ char SECRET_KEY)

## Common Development Tasks

### Adding a New Backend Module
1. Create directory under `backend/app/<module>/`
2. Add `__init__.py`, `routes.py`, `schemas.py`, `service.py`
3. Define router: `router = APIRouter(prefix="/<module>", tags=["<module>"])`
4. Register in `backend/app/main.py` with `app.include_router()`
5. Protect endpoints with `Depends(require_permission(Permission.XXX))`

### Adding a New Frontend Page
1. Create component in `frontend/src/pages/<PageName>.js`
2. Add route in `frontend/src/App.js` inside `<Routes>`
3. Wrap with `<ProtectedRoute>` for auth-gated access
4. Add navigation link in `frontend/src/components/NavBar.js`
5. Add API calls to `frontend/src/api/client.js`

### Adding a Database Migration
```bash
# Inside backend container or with proper DATABASE_URL set
cd backend
alembic revision --autogenerate -m "add xyz column"
alembic upgrade head
```

### Configuring a New GenAI Provider
Set in `.env`:
```bash
GENAI_PROVIDER=openai    # or anthropic, gemini, ollama
OPENAI_API_KEY=sk-...    # provider-specific credentials
```

## Important Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app creation, middleware stack, router registration |
| `backend/app/models.py` | All SQLAlchemy models and enum definitions |
| `backend/app/core/config.py` | Pydantic Settings with all env vars |
| `backend/app/core/database.py` | SQLAlchemy engine, session factory, `get_db()` |
| `backend/app/auth/rbac.py` | Permission enum and role-to-permission matrix |
| `backend/app/auth/dependencies.py` | `get_current_user`, `require_permission` |
| `frontend/src/api/client.js` | Axios instance, interceptors, all API functions |
| `frontend/src/store/index.js` | Zustand auth store |
| `frontend/src/App.js` | Root component, all routes, theme config |
| `docker-compose.yml` | Local dev stack definition |
| `config/seed-sources.json` | Default security feed sources |
