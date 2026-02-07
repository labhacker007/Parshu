#!/bin/bash

# HuntSphere Status Check Script
# Run this to diagnose why the application isn't loading data

echo "========================================"
echo "  HuntSphere Platform Status Check"
echo "========================================"
echo ""

# Check if Docker is running
echo "1. Checking Docker..."
if docker info > /dev/null 2>&1; then
    echo "   ✅ Docker is running"
else
    echo "   ❌ Docker is NOT running - Please start Docker Desktop"
    exit 1
fi

# Check Docker Compose services
echo ""
echo "2. Checking Docker Compose services..."
cd "$(dirname "$0")"
docker-compose ps 2>/dev/null || echo "   ⚠️  No docker-compose services found"

# Check if backend is reachable
echo ""
echo "3. Checking Backend API (http://localhost:8000)..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running"
    curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/health
else
    echo "   ❌ Backend is NOT reachable at http://localhost:8000"
    echo "   "
    echo "   To start the backend, run one of these:"
    echo "   "
    echo "   Option A - Docker Compose (recommended):"
    echo "      docker-compose up -d"
    echo "   "
    echo "   Option B - Direct Python:"
    echo "      cd backend && pip install -r requirements.txt"
    echo "      uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
fi

# Check if frontend is reachable
echo ""
echo "4. Checking Frontend (http://localhost:3000)..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "   ✅ Frontend is running"
else
    echo "   ❌ Frontend is NOT reachable at http://localhost:3000"
    echo "   "
    echo "   To start the frontend, run:"
    echo "      cd frontend && npm install && npm start"
fi

# Check PostgreSQL
echo ""
echo "5. Checking PostgreSQL (localhost:5432)..."
if nc -z localhost 5432 2>/dev/null; then
    echo "   ✅ PostgreSQL is running"
else
    echo "   ⚠️  PostgreSQL is NOT running on port 5432"
    echo "      Run: docker-compose up -d postgres"
fi

# Check Redis
echo ""
echo "6. Checking Redis (localhost:6379)..."
if nc -z localhost 6379 2>/dev/null; then
    echo "   ✅ Redis is running"
else
    echo "   ⚠️  Redis is NOT running on port 6379"
    echo "      Run: docker-compose up -d redis"
fi

echo ""
echo "========================================"
echo "  Summary"
echo "========================================"
echo ""
echo "If Backend is NOT running, start with:"
echo "  cd /Users/tarun_vashishth/Documents/Code/huntsphere"
echo "  docker-compose up -d"
echo ""
echo "Or view logs with:"
echo "  docker-compose logs -f backend"
echo ""
