#!/bin/bash
###############################################################################
# Jyoti - Automated Startup & Troubleshooting Script
# This script handles common Docker issues automatically
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Jyoti News Aggregator - Auto Startup            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if Docker is running
print_status "Checking Docker status..."
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi
print_success "Docker is running"

# Check if ports are available
print_status "Checking if ports 3000 and 8000 are available..."
if netstat -an | grep -q ":3000.*LISTEN" 2>/dev/null || lsof -i :3000 >/dev/null 2>&1; then
    print_warning "Port 3000 is in use. Attempting to free it..."
    docker-compose down 2>/dev/null || true
    sleep 2
fi
if netstat -an | grep -q ":8000.*LISTEN" 2>/dev/null || lsof -i :8000 >/dev/null 2>&1; then
    print_warning "Port 8000 is in use. Attempting to free it..."
    docker-compose down 2>/dev/null || true
    sleep 2
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down 2>/dev/null || true
print_success "Containers stopped"

# Check if rebuild is needed
REBUILD_NEEDED=false
if [ ! "$(docker images -q parshu-frontend 2>/dev/null)" ]; then
    print_warning "Frontend image not found. Will build."
    REBUILD_NEEDED=true
fi
if [ ! "$(docker images -q parshu-backend 2>/dev/null)" ]; then
    print_warning "Backend image not found. Will build."
    REBUILD_NEEDED=true
fi

# Build if needed
if [ "$REBUILD_NEEDED" = true ] || [ "$1" = "--rebuild" ]; then
    print_status "Building Docker images (this may take 5-10 minutes)..."
    docker-compose build --no-cache
    print_success "Images built successfully"
fi

# Start containers
print_status "Starting containers..."
docker-compose up -d
print_success "Containers started"

# Wait for containers to be healthy
print_status "Waiting for containers to become healthy (max 120s)..."
TIMEOUT=120
ELAPSED=0
INTERVAL=5

while [ $ELAPSED -lt $TIMEOUT ]; do
    # Check container status
    BACKEND_HEALTH=$(docker inspect parshu-backend-1 --format='{{.State.Health.Status}}' 2>/dev/null || echo "starting")
    FRONTEND_HEALTH=$(docker inspect parshu-frontend-1 --format='{{.State.Health.Status}}' 2>/dev/null || echo "starting")
    POSTGRES_HEALTH=$(docker inspect parshu-postgres-1 --format='{{.State.Health.Status}}' 2>/dev/null || echo "starting")
    REDIS_HEALTH=$(docker inspect parshu-redis-1 --format='{{.State.Health.Status}}' 2>/dev/null || echo "starting")

    echo -ne "\r  Backend: $BACKEND_HEALTH | Frontend: $FRONTEND_HEALTH | PostgreSQL: $POSTGRES_HEALTH | Redis: $REDIS_HEALTH"

    if [ "$BACKEND_HEALTH" = "healthy" ] && [ "$FRONTEND_HEALTH" = "healthy" ] && [ "$POSTGRES_HEALTH" = "healthy" ] && [ "$REDIS_HEALTH" = "healthy" ]; then
        echo ""
        print_success "All containers are healthy!"
        break
    fi

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""

# Check if timeout occurred
if [ $ELAPSED -ge $TIMEOUT ]; then
    print_error "Containers did not become healthy within ${TIMEOUT}s"
    print_warning "Running diagnostics..."

    # Show logs for unhealthy containers
    if [ "$BACKEND_HEALTH" != "healthy" ]; then
        print_error "Backend is unhealthy. Last 30 lines of logs:"
        docker logs parshu-backend-1 --tail 30
    fi
    if [ "$FRONTEND_HEALTH" != "healthy" ]; then
        print_error "Frontend is unhealthy. Last 30 lines of logs:"
        docker logs parshu-frontend-1 --tail 30
    fi

    exit 1
fi

# Run health checks
print_status "Running application health checks..."

# Check backend API
BACKEND_RESPONSE=$(curl -s -m 5 http://localhost:8000/health 2>/dev/null || echo "failed")
if echo "$BACKEND_RESPONSE" | grep -q "healthy"; then
    print_success "Backend API is responding: $(echo $BACKEND_RESPONSE | jq -r .status 2>/dev/null || echo 'OK')"
else
    print_error "Backend API is not responding correctly"
    print_warning "Attempting backend restart..."
    docker restart parshu-backend-1
    sleep 10
    BACKEND_RESPONSE=$(curl -s -m 5 http://localhost:8000/health 2>/dev/null || echo "failed")
    if echo "$BACKEND_RESPONSE" | grep -q "healthy"; then
        print_success "Backend API recovered after restart"
    else
        print_error "Backend still not responding. Check logs:"
        echo "    docker logs parshu-backend-1"
        exit 1
    fi
fi

# Check frontend
FRONTEND_RESPONSE=$(curl -s -m 5 http://localhost:3000/ 2>/dev/null || echo "failed")
if echo "$FRONTEND_RESPONSE" | grep -q "root"; then
    print_success "Frontend is serving pages"
else
    print_error "Frontend is not responding correctly"
    exit 1
fi

# Get admin credentials from .env
if [ -f .env ]; then
    ADMIN_EMAIL=$(grep ADMIN_EMAIL .env | cut -d '=' -f2)
    ADMIN_PASSWORD=$(grep ADMIN_PASSWORD .env | cut -d '=' -f2)
else
    ADMIN_EMAIL="admin@huntsphere.local"
    ADMIN_PASSWORD="Admin123!@2026"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✓ JYOTI IS READY!                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Access URLs:${NC}"
echo -e "   Frontend:  ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend:   ${GREEN}http://localhost:8000${NC}"
echo -e "   API Docs:  ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo -e "${BLUE}🔐 Admin Credentials:${NC}"
echo -e "   Email:    ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "   Password: ${GREEN}${ADMIN_PASSWORD}${NC}"
echo ""
echo -e "${BLUE}📊 Container Status:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "parshu-|NAMES"
echo ""
echo -e "${BLUE}💡 Useful Commands:${NC}"
echo -e "   View logs:        ${YELLOW}docker-compose logs -f${NC}"
echo -e "   Restart backend:  ${YELLOW}docker restart parshu-backend-1${NC}"
echo -e "   Stop all:         ${YELLOW}docker-compose down${NC}"
echo -e "   Rebuild:          ${YELLOW}./scripts/jyoti-start.sh --rebuild${NC}"
echo ""
