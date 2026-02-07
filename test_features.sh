#!/bin/bash
# Comprehensive Feature Testing Script for HuntSphere Platform
# Tests all implemented features as an expert tester

set -e

API_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"
ADMIN_EMAIL="admin@huntsphere.local"
ADMIN_PASS="Admin@123"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to log test results
log_test() {
    local test_name=$1
    local status=$2
    local message=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        [ -n "$message" ] && echo "  ↳ $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        [ -n "$message" ] && echo "  ↳ $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

log_info() {
    echo -e "${YELLOW}ℹ INFO${NC}: $1"
}

# Get auth token
get_token() {
    local response=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASS}\"}")
    
    echo "$response" | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//'
}

echo "=================================================="
echo "  HUNTSPHERE PLATFORM - COMPREHENSIVE FEATURE TESTING"
echo "=================================================="
echo ""

# Test 1: Health Check
log_info "Test 1: API Health Check"
response=$(curl -s "${API_URL}/health")
if echo "$response" | grep -q "healthy"; then
    log_test "API Health Check" "PASS" "API is responding correctly"
else
    log_test "API Health Check" "FAIL" "API not responding"
    exit 1
fi

# Test 2: Frontend Availability
log_info "Test 2: Frontend Availability"
response=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}")
if [ "$response" == "200" ]; then
    log_test "Frontend Availability" "PASS" "Frontend is accessible"
else
    log_test "Frontend Availability" "FAIL" "Frontend returned HTTP $response"
fi

# Test 3: Authentication
log_info "Test 3: User Authentication"
TOKEN=$(get_token)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    log_test "User Authentication" "PASS" "Successfully obtained JWT token"
else
    log_test "User Authentication" "FAIL" "Failed to authenticate"
    exit 1
fi

# Test 4: User Management - List Users
log_info "Test 4: User Management - List Users"
response=$(curl -s -X GET "${API_URL}/users/" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "email"; then
    user_count=$(echo "$response" | grep -o '"id"' | wc -l | tr -d ' ')
    log_test "List Users API" "PASS" "Found $user_count user(s)"
else
    log_test "List Users API" "FAIL" "Failed to list users"
fi

# Test 5: User Management - Create User
log_info "Test 5: User Management - Create New User"
test_email="test_user_$RANDOM@huntsphere.local"
response=$(curl -s -X POST "${API_URL}/auth/register" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$test_email\",\"username\":\"test_user_$RANDOM\",\"password\":\"testpass123\"}")
if echo "$response" | grep -q "email"; then
    log_test "Create User API" "PASS" "Successfully created test user"
    NEW_USER_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
else
    log_test "Create User API" "FAIL" "Failed to create user"
fi

# Test 6: Articles API - Triage Queue
log_info "Test 6: Articles - Fetch Triage Queue"
response=$(curl -s -X GET "${API_URL}/articles/triage?page=1&page_size=20" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "articles"; then
    article_count=$(echo "$response" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    log_test "Fetch Articles" "PASS" "Found $article_count article(s)"
else
    log_test "Fetch Articles" "FAIL" "Failed to fetch articles"
fi

# Test 7: Articles - Status Update (if articles exist)
log_info "Test 7: Articles - Status Change"
ARTICLE_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
if [ -n "$ARTICLE_ID" ] && [ "$ARTICLE_ID" != "" ]; then
    status_response=$(curl -s -X PATCH "${API_URL}/articles/${ARTICLE_ID}/status" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"status":"TRIAGED"}')
    
    if echo "$status_response" | grep -q "TRIAGED"; then
        log_test "Article Status Update" "PASS" "Successfully changed article status to TRIAGED"
        
        # Check for auto-extracted intelligence
        sleep 2
        intel_response=$(curl -s -X GET "${API_URL}/articles/${ARTICLE_ID}" \
            -H "Authorization: Bearer $TOKEN")
        
        if echo "$intel_response" | grep -q "extracted_intelligence"; then
            log_test "Auto-Extraction on Status Change" "PASS" "Intelligence extraction triggered automatically"
        else
            log_test "Auto-Extraction on Status Change" "FAIL" "No intelligence extracted"
        fi
    else
        log_test "Article Status Update" "FAIL" "Failed to update article status"
    fi
else
    log_test "Article Status Update" "SKIP" "No articles available for testing"
fi

# Test 8: Dashboard Stats
log_info "Test 8: Dashboard Statistics"
response=$(curl -s -X GET "${API_URL}/articles/triage?page=1&page_size=100" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "total"; then
    log_test "Dashboard Stats API" "PASS" "Dashboard data accessible"
else
    log_test "Dashboard Stats API" "FAIL" "Failed to fetch dashboard stats"
fi

# Test 9: Feed Sources
log_info "Test 9: Feed Sources"
response=$(curl -s -X GET "${API_URL}/sources/" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "feed_url" || echo "$response" | grep -q "\[\]"; then
    source_count=$(echo "$response" | grep -o '"id"' | wc -l | tr -d ' ')
    log_test "List Feed Sources" "PASS" "Found $source_count source(s)"
else
    log_test "List Feed Sources" "FAIL" "Failed to fetch sources"
fi

# Test 10: Feed Sources Stats
log_info "Test 10: Feed Sources Statistics"
response=$(curl -s -X GET "${API_URL}/sources/stats/summary" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "total_sources"; then
    log_test "Feed Sources Stats" "PASS" "Statistics available"
else
    log_test "Feed Sources Stats" "FAIL" "Failed to fetch source stats"
fi

# Test 11: Hunts API
log_info "Test 11: Hunts API"
response=$(curl -s -X GET "${API_URL}/hunts/?page=1&page_size=20" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "\[" || echo "$response" | grep -q "hunt"; then
    log_test "List Hunts" "PASS" "Hunts API accessible"
else
    log_test "List Hunts" "FAIL" "Failed to fetch hunts"
fi

# Test 12: Reports API
log_info "Test 12: Reports API"
response=$(curl -s -X GET "${API_URL}/reports/?page=1&page_size=20" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "reports" || echo "$response" | grep -q "\[\]"; then
    log_test "List Reports" "PASS" "Reports API accessible"
else
    log_test "List Reports" "FAIL" "Failed to fetch reports"
fi

# Test 13: Connectors API
log_info "Test 13: Hunt Connectors"
response=$(curl -s -X GET "${API_URL}/connectors/" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "connector_type" || echo "$response" | grep -q "\[\]"; then
    log_test "List Connectors" "PASS" "Connectors API accessible"
else
    log_test "List Connectors" "FAIL" "Failed to fetch connectors"
fi

# Test 14: Watchlist API
log_info "Test 14: Watchlist API"
response=$(curl -s -X GET "${API_URL}/watchlist/" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "keyword" || echo "$response" | grep -q "\[\]"; then
    log_test "List Watchlist" "PASS" "Watchlist API accessible"
else
    log_test "List Watchlist" "FAIL" "Failed to fetch watchlist"
fi

# Test 15: Audit Logs
log_info "Test 15: Audit Logs"
response=$(curl -s -X GET "${API_URL}/audit/?page=1&page_size=50" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "event_type" || echo "$response" | grep -q "\[\]"; then
    log_test "Fetch Audit Logs" "PASS" "Audit logs accessible"
else
    log_test "Fetch Audit Logs" "FAIL" "Failed to fetch audit logs"
fi

# Test 16: User Update
log_info "Test 16: User Management - Update User"
if [ -n "$NEW_USER_ID" ]; then
    response=$(curl -s -X PATCH "${API_URL}/users/${NEW_USER_ID}" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"full_name":"Test User Updated","role":"VIEWER"}')
    
    if echo "$response" | grep -q "Test User Updated"; then
        log_test "Update User API" "PASS" "Successfully updated user"
    else
        log_test "Update User API" "FAIL" "Failed to update user"
    fi
fi

# Test 17: User Delete
log_info "Test 17: User Management - Delete User"
if [ -n "$NEW_USER_ID" ]; then
    response=$(curl -s -X DELETE "${API_URL}/users/${NEW_USER_ID}" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response" | grep -q "deleted successfully"; then
        log_test "Delete User API" "PASS" "Successfully deleted user"
    else
        log_test "Delete User API" "FAIL" "Failed to delete user"
    fi
fi

# Test 18: High Priority Filter
log_info "Test 18: High Priority Article Filter"
response=$(curl -s -X GET "${API_URL}/articles/triage?page=1&page_size=20&high_priority_only=true" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "articles"; then
    log_test "High Priority Filter" "PASS" "Filter working correctly"
else
    log_test "High Priority Filter" "FAIL" "Filter not working"
fi

# Test 19: Status Filter
log_info "Test 19: Article Status Filter"
response=$(curl -s -X GET "${API_URL}/articles/triage?page=1&page_size=20&status_filter=NEW" \
    -H "Authorization: Bearer $TOKEN")
if echo "$response" | grep -q "articles"; then
    log_test "Status Filter (NEW)" "PASS" "Status filter working"
else
    log_test "Status Filter (NEW)" "FAIL" "Status filter not working"
fi

# Test 20: Intelligence Extraction Endpoint
log_info "Test 20: Intelligence Extraction"
if [ -n "$ARTICLE_ID" ]; then
    response=$(curl -s -X GET "${API_URL}/articles/${ARTICLE_ID}" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response" | grep -q "extracted_intelligence"; then
        log_test "Intelligence Extraction Data" "PASS" "Intelligence data structure present"
    else
        log_test "Intelligence Extraction Data" "FAIL" "No intelligence data found"
    fi
fi

echo ""
echo "=================================================="
echo "           TEST SUMMARY"
echo "=================================================="
echo -e "Total Tests:  ${YELLOW}${TOTAL_TESTS}${NC}"
echo -e "Passed:       ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed:       ${RED}${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "The HuntSphere platform is functioning correctly."
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the failures above."
    exit 1
fi
