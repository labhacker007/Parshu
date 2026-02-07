#!/bin/bash

# HuntSphere - Frontend Startup Script

echo "========================================"
echo "  Starting HuntSphere Frontend"
echo "========================================"
echo ""

cd "$(dirname "$0")/frontend"

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

echo "✓ Node found: $(node --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Set API URL
export REACT_APP_API_URL="http://localhost:8000"

echo ""
echo "🚀 Starting Frontend..."
echo "   URL: http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

npm start
