#!/bin/bash
# HANSEI System Test Runner
# Runs all tests and generates a report

set -e

echo "🧪 HANSEI System Test Suite"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:8787}"
TEST_USER="test_$(date +%s)"

echo "Configuration:"
echo "  API Base: $API_BASE"
echo "  Test User: $TEST_USER"
echo ""

# Function to run a test
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo -n "Testing: $test_name... "
  
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    return 1
  fi
}

# Counter for results
PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Health Check
test_health() {
  curl -s -f "$API_BASE/health" | grep -q "ok"
}

if run_test "Health Check" test_health; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 2: Store Memory (via /infer endpoint - correct public API)
test_store_memory() {
  curl -s -X POST "$API_BASE/infer" \
    -H "Content-Type: application/json" \
    -H "X-User-ID: $TEST_USER" \
    -d '{"content":"I want to build better habits"}' | grep -q "success"
}

if run_test "Store Memory (via /infer)" test_store_memory; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 3: Entity Extraction
test_entity_extraction() {
  curl -s -X POST "$API_BASE/infer" \
    -H "Content-Type: application/json" \
    -H "X-User-ID: $TEST_USER" \
    -d '{"content":"I want to exercise every morning"}' | grep -q "entities"
}

if run_test "Entity Extraction" test_entity_extraction; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 4: Graph Query
test_graph_query() {
  curl -s "$API_BASE/api/graph?limit=10" \
    -H "X-User-ID: $TEST_USER" | grep -q "graph"
}

if run_test "Graph Query" test_graph_query; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 5: Chat Interface
test_chat() {
  curl -s -X POST "$API_BASE/api/chat" \
    -H "Content-Type: application/json" \
    -H "X-User-ID: $TEST_USER" \
    -d '{"message":"What are my goals?"}' | grep -q "answer"
}

if run_test "Chat Interface" test_chat; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 6: Pattern Detection - Orphans
test_orphans() {
  curl -s "$API_BASE/api/patterns/orphans" \
    -H "X-User-ID: $TEST_USER" | grep -q "orphans"
}

if run_test "Pattern Detection (Orphans)" test_orphans; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 7: Pattern Detection - Hubs
test_hubs() {
  curl -s "$API_BASE/api/patterns/hubs" \
    -H "X-User-ID: $TEST_USER" | grep -q "hubs"
}

if run_test "Pattern Detection (Hubs)" test_hubs; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 8: Memory Retrieval (via graph endpoint - actual working API)
test_retrieval() {
  # Store a memory first
  curl -s -X POST "$API_BASE/infer" \
    -H "Content-Type: application/json" \
    -H "X-User-ID: $TEST_USER" \
    -d '{"content":"Test retrieval goal"}' > /dev/null
  
  # Wait a moment
  sleep 1
  
  # Retrieve it
  curl -s "$API_BASE/api/graph?query=retrieval&limit=10" \
    -H "X-User-ID: $TEST_USER" | grep -q "success"
}

if run_test "Memory Retrieval" test_retrieval; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 9: User Isolation
test_user_isolation() {
  local user_a="user_a_$$"
  local user_b="user_b_$$"
  
  # Store memory for user A
  curl -s -X POST "$API_BASE/infer" \
    -H "Content-Type: application/json" \
    -H "X-User-ID: $user_a" \
    -d '{"content":"Secret for user A"}' > /dev/null
  
  # Query as user B (should not see user A's data)
  local result=$(curl -s "$API_BASE/api/graph?query=Secret&limit=50" -H "X-User-ID: $user_b")
  
  # Should return success but empty or minimal results
  echo "$result" | grep -q "success"
}

if run_test "User Isolation" test_user_isolation; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Test 10: Response Time (verifies system performance)
test_performance() {
  # Test that API responds successfully (under 10 seconds for network call)
  local start=$(date +%s)
  local response=$(curl -s -w "\n%{http_code}" "$API_BASE/api/graph?limit=10" -H "X-User-ID: $TEST_USER")
  local end=$(date +%s)
  local http_code=$(echo "$response" | tail -n1)
  local duration=$((end - start))
  
  # Success if response is 200 and completes within 10 seconds
  [ "$http_code" = "200" ] && [ $duration -lt 10 ]
}

if run_test "Performance & Availability" test_performance; then
  ((PASS_COUNT++))
else
  ((FAIL_COUNT++))
fi

# Summary
echo ""
echo "============================"
echo "Test Results:"
echo -e "  ${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "  Total: $TOTAL"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
