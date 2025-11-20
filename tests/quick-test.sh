#!/bin/bash
# Quick smoke test - tests core functionality

set -e

API_BASE="${1:-https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run}"
TEST_USER="quick_test_$(date +%s)"

echo "🚀 HANSEI Quick Test"
echo "API: $API_BASE"
echo ""

# Test 1: Health
echo -n "1. Health check... "
if curl -s -f "$API_BASE/health" | grep -q "ok"; then
  echo "✓"
else
  echo "✗ FAILED"
  exit 1
fi

# Test 2: Extract Entities
echo -n "2. Entity extraction... "
RESPONSE=$(curl -s -X POST "$API_BASE/infer" \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $TEST_USER" \
  -d '{"content":"I want to meditate every morning"}')

if echo "$RESPONSE" | grep -q "entities"; then
  echo "✓"
  echo "   Extracted: $(echo "$RESPONSE" | jq -r '.extracted.entities[0].content' 2>/dev/null || echo 'parsed successfully')"
else
  echo "✗ FAILED"
  echo "   Response: $RESPONSE"
  exit 1
fi

# Test 3: Graph Query
echo -n "3. Graph query... "
if curl -s "$API_BASE/api/graph?limit=10" -H "X-User-ID: $TEST_USER" | grep -q "graph"; then
  echo "✓"
else
  echo "✗ FAILED"
  exit 1
fi

# Test 4: Chat
echo -n "4. Chat interface... "
if curl -s -X POST "$API_BASE/api/chat" \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $TEST_USER" \
  -d '{"message":"What are my goals?"}' | grep -q "answer"; then
  echo "✓"
else
  echo "✗ FAILED"
  exit 1
fi

echo ""
echo "✅ All quick tests passed!"
echo ""
echo "For comprehensive tests, run: ./tests/run-tests.sh"
