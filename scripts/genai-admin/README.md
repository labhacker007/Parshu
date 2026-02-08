# GenAI Admin Toolkit - Developer Automation

**Smart, self-healing scripts for lazy but efficient full-stack engineers.**

## Philosophy

> "Work smarter, not harder. Automate the boring stuff."

This toolkit embodies the "lazy developer" approach:
- **One command** does the entire workflow
- **Self-healing** - automatically fixes common issues
- **Context-aware** - knows what changed and rebuilds only what's needed
- **Well-documented** - future you will thank present you

## Quick Start

```bash
# Windows
.\toolkit.bat setup

# Linux/Mac
./toolkit.sh setup
```

## Architecture

```
GenAI Admin System
├── Backend (FastAPI + SQLAlchemy)
│   ├── models.py         - 8 new tables (Prompt, Skill, Guardrail, etc.)
│   ├── admin/
│   │   ├── ollama_setup.py    - Day 2: Ollama installation API
│   │   ├── genai_functions.py - Day 3: Function-model mapping
│   │   ├── prompts.py         - Day 4: Prompt CRUD + versioning
│   │   ├── skills.py          - Day 5: Skills management
│   │   └── guardrails.py      - Day 5: Guardrails management
│   └── alembic/
│       └── versions/
│           └── 001_genai_admin.py - Migration
│
├── Frontend (React + Ant Design)
│   └── src/
│       └── pages/
│           └── Admin/
│               ├── GenAI/          - Day 6-7: GenAI admin UI
│               ├── Prompts/        - Prompt editor
│               ├── Skills/         - Skills library
│               └── Guardrails/     - Guardrails config
│
└── scripts/genai-admin/
    ├── toolkit.sh          - Main automation script
    ├── toolkit.bat         - Windows wrapper
    └── README.md           - This file
```

## Commands

### Setup & Health

```bash
# Initial setup (Day 1: DB + migration)
./toolkit.sh setup

# Check system health
./toolkit.sh health
```

### Day-by-Day Implementation

```bash
# Day 2: Ollama installation API
./toolkit.sh day2

# Day 3: Function-model configuration
./toolkit.sh day3

# Day 4: Prompt management
./toolkit.sh day4

# Day 5: Skills & guardrails
./toolkit.sh day5

# Days 6-7: Frontend UI
./toolkit.sh day6-7
```

### Development Workflow

```bash
# Smart rebuild (only changed services)
./toolkit.sh rebuild

# Run database migrations
./toolkit.sh migrate

# Seed sample data
./toolkit.sh seed

# Smart commit (auto-generates message)
./toolkit.sh commit

# Push to GitHub
./toolkit.sh push

# Complete workflow (setup -> test -> commit -> push)
./toolkit.sh full
```

## Self-Healing Features

The toolkit automatically handles:

### 1. **Missing Dependencies**
```bash
# Auto-detects and installs:
- Python packages (via pip)
- Node modules (via npm)
- Docker images (via build)
```

### 2. **Common Errors**
```bash
# Auto-fixes:
- Permission errors (rbac.py)
- Import errors (placeholder modules)
- Pydantic v2 compatibility (regex -> pattern)
- SQLAlchemy conflicts (reserved attributes)
```

### 3. **Failed Operations**
```bash
# Auto-retries with backoff:
- Database connections
- Docker container starts
- Migration conflicts (stamps if tables exist)
```

### 4. **State Recovery**
```bash
# Auto-rollback on critical failures:
- Database transaction rollback
- Container restart
- Git revert (if specified)
```

## Context Preservation

The toolkit maintains context through:

### 1. **State Files**
```bash
scripts/genai-admin/.state/
├── last_command.txt          # Last executed command
├── current_day.txt           # Current implementation day
├── health_check.json         # Latest health status
└── migration_history.json    # Migration tracking
```

### 2. **Logs**
```bash
scripts/genai-admin/logs/
├── YYYY-MM-DD_HH-MM-SS.log  # Timestamped logs
└── latest.log               # Symlink to most recent
```

### 3. **Configuration**
```bash
scripts/genai-admin/config.json
{
  "backend_port": 8000,
  "frontend_port": 3000,
  "auto_rebuild": true,
  "auto_commit": false,
  "verbose": false
}
```

## Smart Rebuild Logic

The toolkit only rebuilds what changed:

```bash
# Backend changes detected
- Modified: backend/app/**/*.py
- Action: Rebuild backend container only (~2 min)

# Frontend changes detected
- Modified: frontend/src/**/*.{js,jsx}
- Action: Rebuild frontend container (~11 min)

# No changes detected
- Action: Skip rebuild, just restart containers
```

## Example Workflows

### Workflow 1: Implementing a new feature

```bash
# Step 1: Implement Day 2 (Ollama API)
./toolkit.sh day2

# Step 2: Test it
curl http://localhost:8000/admin/ollama/status

# Step 3: Commit and push
./toolkit.sh commit
./toolkit.sh push
```

### Workflow 2: Full daily workflow

```bash
# Morning: Check system health
./toolkit.sh health

# Afternoon: Implement next day
./toolkit.sh day3

# Evening: Complete workflow
./toolkit.sh full
```

### Workflow 3: Debugging

```bash
# Enable verbose mode
export VERBOSE=1

# Run health check with details
./toolkit.sh health

# Check logs
tail -f scripts/genai-admin/logs/latest.log
```

## Integration with Existing Code

The toolkit reuses code from the New-look branch:

```bash
# Prompts
backend/app/genai/prompts.py           # Existing prompt definitions
backend/app/genai/prompts_newlook.py   # New-look specific prompts

# Provider
backend/app/genai/provider.py          # GenAI provider abstraction
backend/app/genai/config_manager.py    # Configuration management

# Summarization
backend/app/genai/summarization.py     # Article summarization logic
```

## Environment Variables

```bash
# Docker
DOCKER_BUILDKIT=1                    # Enable BuildKit for faster builds

# Database
DATABASE_URL=postgresql://...        # Production database
DATABASE_URL=sqlite:///orion_dev.db  # Development database

# GenAI
GENAI_PROVIDER=ollama                # ollama, openai, anthropic
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Toolkit
TOOLKIT_AUTO_REBUILD=true            # Auto rebuild on changes
TOOLKIT_AUTO_COMMIT=false            # Auto commit after each day
TOOLKIT_VERBOSE=false                # Verbose logging
```

## Troubleshooting

### Issue: Backend container won't start

```bash
# Check logs
docker logs parshu-backend-1 --tail 100

# Self-heal
./toolkit.sh health
```

### Issue: Migration conflict

```bash
# Toolkit auto-stamps existing tables
# Manual fix:
docker exec parshu-backend-1 alembic stamp head
```

### Issue: Permission denied

```bash
# Make script executable
chmod +x scripts/genai-admin/toolkit.sh
```

## Performance Metrics

Typical execution times:

```
Command         | Time    | Notes
----------------|---------|------------------------
health          | 5s      | Basic health check
setup           | 30s     | DB + migration
day2            | 2m      | Backend API only
day3            | 2m      | Backend API only
day4            | 3m      | Backend + migration
day5            | 3m      | Backend + migration
day6-7          | 15m     | Frontend rebuild
rebuild (smart) | 2-11m   | Depends on changes
full            | 20m     | Complete workflow
```

## Contributing

When adding new functionality:

1. **Add command** to `toolkit.sh` main switch
2. **Create function** with descriptive name
3. **Add logging** (info, success, error, warning)
4. **Handle errors** with self-healing
5. **Update README** with examples
6. **Test on clean system**

## License

Part of the Parshu/Jyoti project. Same license applies.

---

**Remember:** The best code is the code you don't have to write. Automate everything! 🚀
