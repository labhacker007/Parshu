#!/bin/bash
# Stop Threat Intelligence Platform

echo "Stopping Threat Intelligence Platform..."

# Kill processes on ports 8000 and 3000
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "Backend stopped"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Frontend stopped"

echo "✅ Threat Intelligence Platform stopped"
