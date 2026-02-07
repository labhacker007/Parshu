#!/bin/bash

# HuntSphere - Quick Development Startup Script
# This starts the backend with SQLite (no Docker needed)

echo "========================================"
echo "  Starting HuntSphere Platform (Dev Mode)"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

echo "✓ Python found: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "backend/venv" ]; then
    echo ""
    echo "📦 Creating Python virtual environment..."
    python3 -m venv backend/venv
fi

# Activate virtual environment
source backend/venv/bin/activate

# Upgrade pip and install dependencies
echo ""
echo "📦 Installing Python dependencies (this may take a minute)..."
pip install --upgrade pip -q 2>/dev/null
pip install -r backend/requirements.txt -q 2>/dev/null || pip install -r backend/requirements.txt

# Set environment variables for SQLite (no PostgreSQL needed)
export DATABASE_URL="sqlite:///./huntsphere_dev.db"
export SECRET_KEY="dev-secret-key-change-in-production"
export CORS_ORIGINS="http://localhost:3000,http://localhost:8000"
export DEBUG="true"
export ENABLE_OTP="false"
export GENAI_PROVIDER="ollama"
export OLLAMA_BASE_URL="http://localhost:11434"

echo ""
echo "🚀 Starting Backend Server..."
echo "   URL: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo ""
echo "   Default login: admin / Admin@123"
echo "   (OTP is disabled for local development)"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
