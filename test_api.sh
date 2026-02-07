#!/bin/bash
# Test API endpoints

echo "=== Testing HuntSphere API ==="
echo ""

echo "1. Health Check:"
curl -s http://localhost:8000/health | python3 -m json.tool
echo ""

echo "2. Sources List (first 3):"
curl -s http://localhost:8000/sources/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total sources: {len(d)}'); [print(f'  - {s[\"name\"]}') for s in d[:3]]"
echo ""

echo "3. Articles Triage (needs auth):"
echo "   This endpoint requires authentication"
echo ""

echo "=== Done ==="
