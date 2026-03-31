# Threat Intelligence Platform

A modular, enterprise-grade threat intelligence ingestion, analysis, and hunting platform built with FastAPI, React, and PostgreSQL.

## Overview

This platform enables security teams to:
- 📰 **Ingest** threat intelligence from RSS/Atom feeds and normalize content
- 🔍 **Analyze** articles with state-machine triage workflow
- 🧠 **Extract** IOCs, IOAs, MITRE ATT&CK TTPs using GenAI
- 🎯 **Hunt** threats across XSIAM, Microsoft Defender, and Wiz platforms
- 📊 **Report** and share findings with stakeholders
- 🔐 **Audit** all activities with role-based access control (RBAC)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (3000)                 │
├─────────────────────────────────────────────────────────┤
│         FastAPI Backend (8000) - Core Services           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Auth/RBAC │ Audit │ Articles │ Hunts │ Reports  │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (5432) │ Redis (6379) │ GenAI Provider      │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Local Development with Docker

```bash
# Clone and navigate
cd threat-intel-platform

# Start all services
docker compose up -d

# Access services
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Create Initial Admin User

Set environment variables before starting the application:

```bash
# Required for admin user creation (minimum 12 characters)
export ADMIN_PASSWORD="YourSecurePassword123!"
export ADMIN_EMAIL="admin@yourcompany.com"

# Then start the application
docker-compose up -d
```

### Create Additional Users

Use the Admin panel in the web UI or the API:

```bash
# Via API (after logging in as admin)
curl -X POST http://localhost:8000/users/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@example.com",
    "username": "analyst",
    "password": "SecurePassword123!",
    "role": "TI",
    "full_name": "Security Analyst"
  }'
```

## Key Features

✅ **Article Ingestion & Triage**
- RSS/Atom feed parser with deduplication
- Article normalization & sanitization
- State machine: NEW → TRIAGED → IN_ANALYSIS → REVIEWED → REPORTED/ARCHIVED
- High-priority watchlist filtering

✅ **GenAI-Powered Intelligence Extraction**
- Automatic IOC/IOA/TTP extraction using OpenAI GPT-4
- Versioned prompt templates
- MITRE ATT&CK mapping
- Confidence scoring

✅ **Threat Hunting**
- Generate platform-specific hunt queries (XSIAM, Defender, Wiz)
- Manual & automated hunt execution
- Execution audit trail
- Results tracking

✅ **Reports & Sharing**
- Executive, technical, comprehensive report templates
- Email & Slack distribution (configurable)
- Analyst marks as REPORTED

✅ **Enterprise Security**
- JWT + SAML SSO (Okta/Azure AD/ADFS)
- Role-based access control (RBAC): Admin, TI, TH, IR, Viewer
- Time-based OTP optional
- Append-only audit logs with correlation IDs
- Rate limiting (planned)

## API Documentation

After starting Docker:
```
http://localhost:8000/docs
```

### Preview docs locally

If you want to render `docs/API.md` to HTML locally, you can either use the `tools` container (no host installs needed) or install tools locally.

- Use the Docker-based tools container (recommended):

```bash
# Build the tools image (only needed once)
docker compose build tools

# Start a tools container in the background
docker compose up -d tools

# Exec into the container
docker compose exec tools bash

# Inside container: install markdownlint CLI (optional)
npm install -g markdownlint-cli

# Lint markdown
markdownlint "docs/**/*.md"

# Render API.md to HTML (output written into repository .artifacts so host can open it)
mkdir -p .artifacts && pandoc docs/API.md -s -o .artifacts/API-preview.html
# exit container and open the preview on macOS
exit
open .artifacts/API-preview.html
```

- Or install locally with Homebrew:

```bash
brew install pandoc node
npx markdownlint-cli "docs/**/*.md"
pandoc docs/API.md -s -o /tmp/API-Preview.html
open /tmp/API-Preview.html
```

- If you prefer not to install tools locally, push a branch/PR to GitHub; the repository's `markdown-preview` workflow will render `docs/API.md` and upload an HTML artifact named `api-doc-preview`.

### Run frontend tests in Docker

To run frontend unit tests (without installing Node on the host):

```bash
# Build and start tools container (has node/pandoc)
docker compose build tools && docker compose up -d tools

# Install frontend deps and run tests inside the container
docker compose exec tools bash -lc "cd frontend && npm ci && npm test -- --watchAll=false"
```

### Run Playwright E2E (in container)

Playwright requires browser tooling; run it in the tools container (may require installing Playwright browsers once):

```bash
docker compose exec tools bash
cd frontend
npm ci
npx playwright install
npm run build
# serve build and run playwright tests (or run playwright against your running dev frontend)
npx http-server ./build -p 3000 -c-1 &
npx playwright test
```

This approach avoids changing your host environment and keeps test tooling containerized.

### Main Endpoints

**Auth**
- `POST /auth/register` - Register user
- `POST /auth/login` - Login with MFA optional
- `GET /auth/me` - Current user info

**Articles**
- `GET /articles/triage` - Triage queue (paginated)
- `GET /articles/{id}` - Article details + intelligence
- `PATCH /articles/{id}/status` - Update status
- `PATCH /articles/{id}/analysis` - Add summaries

**Hunts**
- `POST /hunts/generate` - Generate query from article
- `POST /hunts/{id}/execute` - Run hunt on platform
- `GET /hunts/{id}/executions` - Execution history

**Reports**
- `POST /reports/` - Generate from articles
- `GET /reports/{id}` - Retrieve report
- `POST /reports/{id}/share` - Share via email

**Sources**
- `GET /sources/` - List feed sources
- `POST /sources/` - Add new source
- `POST /sources/{id}/ingest` - Manual trigger

## Environment Configuration

```bash
cp backend/.env.example backend/.env
# Edit .env with your credentials:
# - OPENAI_API_KEY
# - XSIAM_API_KEY / DEFENDER_CLIENT_SECRET / WIZ_CLIENT_SECRET
# - SLACK_BOT_TOKEN
# - SAML_METADATA_URL (if using SSO)
```

### MyFeeds Docker Environment

1. Copy `.env.myfeeds.example` to `.env.myfeeds` and adjust the secrets/URLs for the MyFeeds fork.
2. Ensure `BACKEND_PORT` and `FRONTEND_PORT` are set in `.env.myfeeds` (defaults are `18000` and `13000`).
3. Start the MyFeeds stack so it runs alongside the default setup:

```bash
docker compose -f docker-compose.yml -f docker-compose.myfeeds.yml --env-file .env.myfeeds up -d
```

4. Backend: `http://localhost:18000`, Frontend: `http://localhost:13000`.
5. To stop it: `docker compose -f docker-compose.yml -f docker-compose.myfeeds.yml --env-file .env.myfeeds down`.

## Deployment

### Docker Local
```bash
docker-compose -f infra/docker-compose.yml up -d
```

### Kubernetes
```bash
kubectl apply -f infra/namespace.yaml
kubectl apply -f infra/k8s-manifests.yaml
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## Security

- **Threat Model**: See [docs/SECURITY.md](docs/SECURITY.md)
- **Secrets Management**: Use `.env` locally, K8s secrets in prod
- **Input Validation**: Pydantic + HTML sanitization (Bleach)
- **SSRF Prevention**: Domain allowlists per feed source
- **Audit Trail**: Immutable logging to PostgreSQL

## Development

```bash
# Run backend tests (inside container)
docker-compose -f infra/docker-compose.yml exec backend pytest -q

# Run frontend unit tests (locally)
cd frontend && npm ci && npm test -- --watchAll=false

# Run frontend Playwright E2E locally
cd frontend && npm ci && npm run playwright:install && npm run build
# serve the build in the background and run tests
npx http-server ./build -p 3000 -c-1 &
cd frontend && npx playwright test

# Logs
docker-compose -f infra/docker-compose.yml logs -f backend

# Database migrations
docker-compose -f infra/docker-compose.yml exec backend alembic upgrade head
```

**CI**
- Backend tests run in `.github/workflows/ci.yml` on push/PR. This job runs a Python matrix and uploads coverage (requires `CODECOV_TOKEN` secret to publish to Codecov).
- Playwright E2E run in `.github/workflows/e2e.yml` on push/PR.


## Project Structure

```
backend/           # FastAPI application
  ├── app/
  │   ├── auth/            # Authentication & RBAC
  │   ├── articles/        # Article APIs
  │   ├── hunts/           # Hunt generation & execution
  │   ├── ingestion/       # Feed parsing
  │   ├── extraction/      # IOC/TTP extraction
  │   ├── genai/           # GenAI orchestration
  │   ├── reports/         # Report generation
  │   ├── notifications/   # Email/Slack
  │   ├── audit/           # Audit logging
  │   └── core/            # Config, DB, logging
  └── migrations/          # Alembic DB versions

frontend/          # React application
  └── src/
      ├── api/             # API client
      ├── pages/           # React components
      └── store/           # Zustand state

infra/
  ├── docker-compose.yml   # Local dev
  ├── Dockerfile.*         # Multi-stage builds
  ├── k8s-manifests.yaml   # Kubernetes
  └── namespace.yaml

config/
  └── seed-sources.json    # Default feeds
```

## Support & Contributing

- **Issues**: File on GitHub
- **Questions**: Check docs/
- **Security**: Report privately to security team

## License

**PolyForm Noncommercial 1.0.0** - Community use only. Commercial sale prohibited.

See [LICENSE](LICENSE).
