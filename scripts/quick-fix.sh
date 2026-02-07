#!/bin/bash
###############################################################################
# Jyoti - Quick Fix Script
# Automatically diagnoses and fixes common issues
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║             Jyoti - Quick Fix & Diagnostics                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

# 1. Check if containers are running
print_status "Checking container status..."
BACKEND_RUNNING=$(docker ps --filter "name=parshu-backend-1" --format "{{.Names}}" 2>/dev/null || echo "")
FRONTEND_RUNNING=$(docker ps --filter "name=parshu-frontend-1" --format "{{.Names}}" 2>/dev/null || echo "")

if [ -z "$BACKEND_RUNNING" ]; then
    print_error "Backend container is not running"
    print_status "Starting backend..."
    docker-compose up -d backend
    sleep 10
fi

if [ -z "$FRONTEND_RUNNING" ]; then
    print_error "Frontend container is not running"
    print_status "Starting frontend..."
    docker-compose up -d frontend
    sleep 5
fi

# 2. Check backend health
print_status "Checking backend health..."
BACKEND_RESPONSE=$(curl -s -m 5 http://localhost:8000/health 2>/dev/null || echo "failed")

if echo "$BACKEND_RESPONSE" | grep -q "healthy"; then
    print_success "Backend is healthy"
else
    print_error "Backend is not responding"
    print_status "Restarting backend container..."
    docker restart parshu-backend-1

    print_status "Waiting 15s for backend to restart..."
    sleep 15

    BACKEND_RESPONSE=$(curl -s -m 5 http://localhost:8000/health 2>/dev/null || echo "failed")
    if echo "$BACKEND_RESPONSE" | grep -q "healthy"; then
        print_success "Backend recovered after restart"
    else
        print_error "Backend still unhealthy. Showing logs:"
        docker logs parshu-backend-1 --tail 50
        exit 1
    fi
fi

# 3. Check frontend
print_status "Checking frontend..."
FRONTEND_RESPONSE=$(curl -s -m 5 http://localhost:3000/ 2>/dev/null || echo "failed")

if echo "$FRONTEND_RESPONSE" | grep -q "root"; then
    print_success "Frontend is serving pages"
else
    print_error "Frontend is not responding"
    print_status "Restarting frontend container..."
    docker restart parshu-frontend-1
    sleep 10
fi

# 4. Check database connectivity
print_status "Checking database..."
DB_CHECK=$(docker exec parshu-backend-1 python -c "from app.core.database import SessionLocal; db = SessionLocal(); print('OK'); db.close()" 2>&1 || echo "failed")

if echo "$DB_CHECK" | grep -q "OK"; then
    print_success "Database connection is working"
else
    print_error "Database connection failed"
    print_status "Restarting PostgreSQL..."
    docker restart parshu-postgres-1
    sleep 10
fi

# 5. Check CORS configuration
print_status "Checking CORS configuration..."
CORS_ORIGINS=$(docker exec parshu-backend-1 printenv CORS_ORIGINS 2>/dev/null || echo "")
if echo "$CORS_ORIGINS" | grep -q "localhost:3000"; then
    print_success "CORS is configured correctly: $CORS_ORIGINS"
else
    print_warning "CORS may not include frontend origin"
    echo "    Current: $CORS_ORIGINS"
    echo "    Should include: http://localhost:3000"
fi

# 6. Test login endpoint
print_status "Testing login endpoint..."
LOGIN_TEST=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test"}' 2>&1 || echo "failed")

if echo "$LOGIN_TEST" | grep -q "detail"; then
    print_success "Login endpoint is responding (credentials may be wrong, but endpoint works)"
else
    print_error "Login endpoint is not working"
    echo "    Response: $LOGIN_TEST"
fi

# 7. Check frontend build
print_status "Checking frontend build..."
MAIN_JS=$(docker exec parshu-frontend-1 ls /app/build/static/js/main.*.js 2>/dev/null | head -1 || echo "")
if [ -n "$MAIN_JS" ]; then
    print_success "Frontend build files exist"
else
    print_error "Frontend build files are missing"
    print_status "Rebuilding frontend..."
    docker-compose build --no-cache frontend
    docker-compose up -d frontend
    sleep 10
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Diagnostics Complete                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Final Status:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "parshu-|NAMES"
echo ""
echo -e "${BLUE}📍 Test URLs:${NC}"
echo -e "   Frontend:  ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend:   ${GREEN}http://localhost:8000/health${NC}"
echo -e "   API Docs:  ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo -e "${BLUE}💡 If frontend still shows black screen:${NC}"
echo -e "   1. Open browser DevTools (F12)"
echo -e "   2. Check Console tab for JavaScript errors"
echo -e "   3. Check Network tab - should see API calls to localhost:8000"
echo -e "   4. Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)"
echo ""
