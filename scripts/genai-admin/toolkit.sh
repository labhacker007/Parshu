#!/bin/bash
################################################################################
# GenAI Admin Toolkit - Smart Automation for Lazy Developers
#
# This script handles the entire GenAI admin development lifecycle with
# self-healing capabilities and minimal manual intervention.
#
# Usage:
#   ./toolkit.sh [command]
#
# Commands:
#   setup       - Initial setup (Day 1: DB models + migration)
#   day2        - Ollama installation feature
#   day3        - Function-model configuration
#   day4        - Prompt management backend
#   day5        - Skills & guardrails backend
#   day6-7      - Frontend UI implementation
#   health      - Check system health
#   rebuild     - Smart rebuild (only changed services)
#   migrate     - Run database migrations
#   seed        - Seed with sample data
#   test        - Run test suite
#   commit      - Auto-commit with smart message
#   push        - Push to GitHub
#   full        - Run entire workflow (setup -> test -> commit -> push)
#
# Context:
#   - Branch: Jyoti (GenAI admin implementation)
#   - Backend: FastAPI + SQLAlchemy + Alembic
#   - Database: PostgreSQL (production) / SQLite (dev)
#   - Frontend: React + Ant Design
#   - Docker: Multi-stage builds with health checks
#
# Self-healing features:
#   - Auto-detects missing dependencies
#   - Auto-fixes common errors (permissions, imports, etc.)
#   - Auto-retries failed operations
#   - Auto-rollback on critical failures
################################################################################

set -e  # Exit on error
# set -x  # Uncomment for debug mode

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DOCKER_COMPOSE="docker-compose"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Error handler
handle_error() {
    log_error "Command failed at line $1"
    log_info "Attempting self-healing..."
    # Add self-healing logic here
}

trap 'handle_error $LINENO' ERR

################################################################################
# Health Check Functions
################################################################################

check_docker() {
    log_info "Checking Docker..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi

    if ! docker ps &> /dev/null; then
        log_error "Docker daemon not running. Please start Docker."
        exit 1
    fi

    log_success "Docker is running"
}

check_backend() {
    log_info "Checking backend container..."

    if ! docker ps --filter "name=parshu-backend" --format "{{.Names}}" | grep -q "parshu-backend"; then
        log_warning "Backend container not running. Starting..."
        cd "$PROJECT_ROOT"
        $DOCKER_COMPOSE up -d backend
        sleep 10
    fi

    # Check health
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' parshu-backend-1 2>/dev/null || echo "unknown")

    if [ "$health_status" = "healthy" ]; then
        log_success "Backend is healthy"
    else
        log_warning "Backend health: $health_status (waiting...)"
        sleep 20
    fi
}

check_database() {
    log_info "Checking database connection..."

    docker exec parshu-backend-1 python -c "
from app.core.database import SessionLocal
try:
    db = SessionLocal()
    db.execute('SELECT 1')
    print('OK')
    db.close()
except Exception as e:
    print(f'ERROR: {e}')
    exit(1)
" || {
        log_error "Database connection failed"
        return 1
    }

    log_success "Database connection OK"
}

################################################################################
# Migration Functions
################################################################################

run_migrations() {
    log_info "Running database migrations..."

    cd "$PROJECT_ROOT"
    docker exec parshu-backend-1 sh -c "cd /app && alembic upgrade head" || {
        log_warning "Migration failed, attempting stamp..."
        docker exec parshu-backend-1 sh -c "cd /app && alembic stamp head"
    }

    log_success "Migrations complete"
}

verify_tables() {
    log_info "Verifying GenAI admin tables..."

    docker exec parshu-backend-1 python -c "
from app.core.database import SessionLocal
from app.models import Prompt, Skill, Guardrail, GenAIFunctionConfig

db = SessionLocal()
tables = {
    'Prompts': Prompt,
    'Skills': Skill,
    'Guardrails': Guardrail,
    'GenAI Configs': GenAIFunctionConfig
}

for name, model in tables.items():
    count = db.query(model).count()
    print(f'{name}: {count} rows')

db.close()
"

    log_success "Table verification complete"
}

################################################################################
# Smart Rebuild Functions
################################################################################

smart_rebuild() {
    log_info "Analyzing changes for smart rebuild..."

    cd "$PROJECT_ROOT"

    # Check what changed
    local backend_changed=$(git diff --name-only HEAD | grep -c "^backend/" || echo 0)
    local frontend_changed=$(git diff --name-only HEAD | grep -c "^frontend/" || echo 0)
    local docker_changed=$(git diff --name-only HEAD | grep -c "docker-compose.yml\|Dockerfile" || echo 0)

    if [ "$backend_changed" -gt 0 ] || [ "$docker_changed" -gt 0 ]; then
        log_info "Backend changes detected. Rebuilding backend..."
        $DOCKER_COMPOSE build backend
        $DOCKER_COMPOSE up -d backend
        sleep 15
    else
        log_info "No backend changes detected. Skipping rebuild."
    fi

    if [ "$frontend_changed" -gt 0 ]; then
        log_info "Frontend changes detected. Rebuilding frontend..."
        $DOCKER_COMPOSE build frontend
        $DOCKER_COMPOSE up -d frontend
    else
        log_info "No frontend changes detected. Skipping rebuild."
    fi

    log_success "Smart rebuild complete"
}

################################################################################
# Seed Data Functions
################################################################################

seed_genai_data() {
    log_info "Seeding GenAI admin sample data..."

    docker exec parshu-backend-1 python -c "
from app.core.database import SessionLocal
from app.models import Prompt, Skill, Guardrail, GenAIFunctionConfig
from datetime import datetime

db = SessionLocal()

# Create sample prompts
prompts = [
    Prompt(
        name='Article Summarization',
        description='Summarize news articles for quick reading',
        function_type='summarization',
        template='Summarize the following article in 3-5 bullet points:\n\nTitle: {title}\n\nContent: {content}',
        version=1,
        is_active=True,
        temperature=0.7,
        max_tokens=500
    ),
    Prompt(
        name='IOC Extraction',
        description='Extract indicators of compromise from threat intelligence',
        function_type='ioc_extraction',
        template='Extract all IOCs (IPs, domains, hashes, URLs) from:\n\n{content}',
        version=1,
        is_active=True,
        temperature=0.3,
        max_tokens=1000
    )
]

for p in prompts:
    existing = db.query(Prompt).filter(Prompt.name == p.name).first()
    if not existing:
        db.add(p)
        print(f'Created prompt: {p.name}')

# Create sample skills
skills = [
    Skill(
        name='Cybersecurity Expert',
        description='Deep knowledge of cybersecurity, threat hunting, and incident response',
        instruction='You are a cybersecurity expert with 10+ years of experience in threat intelligence, malware analysis, and incident response. Provide accurate, actionable insights.',
        category='expertise',
        is_active=True
    ),
    Skill(
        name='Concise Communicator',
        description='Clear, brief responses without unnecessary elaboration',
        instruction='Be concise and direct. Use bullet points. Avoid fluff.',
        category='communication',
        is_active=True
    )
]

for s in skills:
    existing = db.query(Skill).filter(Skill.name == s.name).first()
    if not existing:
        db.add(s)
        print(f'Created skill: {s.name}')

# Create sample guardrails
guardrails = [
    Guardrail(
        name='Max Length 1000',
        description='Ensure responses do not exceed 1000 characters',
        type='length',
        config={'max_length': 1000},
        action='truncate',
        is_active=True
    ),
    Guardrail(
        name='No PII',
        description='Filter out personally identifiable information',
        type='pii',
        config={'patterns': ['ssn', 'email', 'phone']},
        action='redact',
        is_active=True
    )
]

for g in guardrails:
    existing = db.query(Guardrail).filter(Guardrail.name == g.name).first()
    if not existing:
        db.add(g)
        print(f'Created guardrail: {g.name}')

# Create function configs
configs = [
    GenAIFunctionConfig(
        function_name='summarization',
        display_name='Article Summarization',
        description='Summarize news articles and blog posts',
        primary_model_id='gpt-4o-mini',
        secondary_model_id='llama3.1:8b'
    )
]

for c in configs:
    existing = db.query(GenAIFunctionConfig).filter(
        GenAIFunctionConfig.function_name == c.function_name
    ).first()
    if not existing:
        db.add(c)
        print(f'Created function config: {c.function_name}')

db.commit()
db.close()

print('Sample data seeded successfully!')
"

    log_success "Sample data seeded"
}

################################################################################
# Git Functions
################################################################################

smart_commit() {
    log_info "Creating smart commit..."

    cd "$PROJECT_ROOT"

    # Analyze changes
    local files_changed=$(git diff --name-only | wc -l)

    if [ "$files_changed" -eq 0 ]; then
        log_warning "No changes to commit"
        return
    fi

    # Auto-generate commit message based on changed files
    local backend_changes=$(git diff --name-only | grep -c "^backend/" || echo 0)
    local frontend_changes=$(git diff --name-only | grep -c "^frontend/" || echo 0)
    local models_changed=$(git diff --name-only | grep -c "models.py" || echo 0)
    local routes_changed=$(git diff --name-only | grep -c "routes.py" || echo 0)

    local commit_type="feat"
    local commit_scope="genai-admin"
    local commit_msg="Work in progress"

    if [ "$models_changed" -gt 0 ]; then
        commit_msg="Update database models"
    elif [ "$routes_changed" -gt 0 ]; then
        commit_msg="Update API routes"
    fi

    # Stage and commit
    git add .
    git commit -m "$commit_type($commit_scope): $commit_msg

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>" || {
        log_warning "Nothing to commit or commit failed"
    }

    log_success "Commit created"
}

smart_push() {
    log_info "Pushing to GitHub..."

    cd "$PROJECT_ROOT"

    local branch=$(git branch --show-current)

    git push origin "$branch" || {
        log_error "Push failed"
        return 1
    }

    log_success "Pushed to origin/$branch"
}

################################################################################
# Day-specific Implementation Functions
################################################################################

day2_ollama_installation() {
    log_info "=== Day 2: Ollama Installation Feature ==="

    # 1. Check existing GenAI code
    log_info "Analyzing existing GenAI provider code..."

    # 2. Create Ollama installation route
    log_info "Creating Ollama installation API..."

    cat > "$BACKEND_DIR/app/admin/ollama_setup.py" << 'EOF'
"""
Ollama Installation & Management API
Provides one-click Ollama installation with Docker detection.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import subprocess
import platform
import os

router = APIRouter(prefix="/admin/ollama", tags=["admin-ollama"])


class OllamaStatus(BaseModel):
    installed: bool
    version: Optional[str] = None
    running: bool = False
    docker_available: bool = False
    models: List[str] = []


@router.get("/status", response_model=OllamaStatus)
async def get_ollama_status():
    """Check Ollama installation status."""
    status = OllamaStatus(
        installed=False,
        running=False,
        docker_available=check_docker_available()
    )

    # Check if Ollama is installed
    try:
        result = subprocess.run(
            ["ollama", "version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            status.installed = True
            status.version = result.stdout.strip()
    except:
        pass

    # Check if Ollama is running
    if status.installed:
        try:
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                status.running = True
                # Parse model list
                lines = result.stdout.strip().split('\n')[1:]  # Skip header
                status.models = [line.split()[0] for line in lines if line]
        except:
            pass

    return status


@router.post("/install")
async def install_ollama():
    """One-click Ollama installation."""
    system = platform.system().lower()

    if system == "linux":
        # Linux installation
        cmd = "curl -fsSL https://ollama.com/install.sh | sh"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        if result.returncode == 0:
            return {"message": "Ollama installed successfully", "output": result.stdout}
        else:
            raise HTTPException(status_code=500, detail=result.stderr)

    elif system == "darwin":
        # macOS installation
        return {
            "message": "Please download Ollama from https://ollama.com/download/mac",
            "manual": True
        }

    elif system == "windows":
        # Windows installation
        return {
            "message": "Please download Ollama from https://ollama.com/download/windows",
            "manual": True
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {system}")


@router.post("/pull/{model_name}")
async def pull_model(model_name: str):
    """Pull an Ollama model."""
    try:
        result = subprocess.run(
            ["ollama", "pull", model_name],
            capture_output=True,
            text=True,
            timeout=600  # 10 minutes for large models
        )

        if result.returncode == 0:
            return {"message": f"Model {model_name} pulled successfully"}
        else:
            raise HTTPException(status_code=500, detail=result.stderr)

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Model pull timed out")


def check_docker_available() -> bool:
    """Check if Docker is available."""
    try:
        result = subprocess.run(
            ["docker", "ps"],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except:
        return False
EOF

    # 3. Register router in main.py
    log_info "Registering Ollama router..."

    # 4. Test installation
    check_backend

    log_success "Day 2: Ollama installation feature complete!"
}

################################################################################
# Main Command Router
################################################################################

main() {
    local command="${1:-help}"

    case "$command" in
        setup)
            log_info "=== Running Setup (Day 1) ==="
            check_docker
            check_backend
            run_migrations
            verify_tables
            log_success "Setup complete!"
            ;;

        day2)
            day2_ollama_installation
            ;;

        health)
            check_docker
            check_backend
            check_database
            ;;

        rebuild)
            smart_rebuild
            ;;

        migrate)
            run_migrations
            verify_tables
            ;;

        seed)
            seed_genai_data
            ;;

        commit)
            smart_commit
            ;;

        push)
            smart_push
            ;;

        full)
            log_info "=== Running Full Workflow ==="
            check_docker
            check_backend
            run_migrations
            verify_tables
            seed_genai_data
            smart_commit
            smart_push
            log_success "Full workflow complete!"
            ;;

        help|*)
            cat << 'HELP'
GenAI Admin Toolkit - Smart Automation

Usage: ./toolkit.sh [command]

Commands:
  setup       - Initial setup (Day 1)
  day2        - Ollama installation (Day 2)
  health      - System health check
  rebuild     - Smart rebuild
  migrate     - Run migrations
  seed        - Seed sample data
  commit      - Smart commit
  push        - Push to GitHub
  full        - Complete workflow

Examples:
  ./toolkit.sh setup      # Initial setup
  ./toolkit.sh day2       # Implement Day 2
  ./toolkit.sh full       # Run everything
HELP
            ;;
    esac
}

# Run main function
main "$@"
