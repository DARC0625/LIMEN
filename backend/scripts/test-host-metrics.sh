#!/bin/bash
# Test script to verify host metrics are updating

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:18443}"
METRICS_URL="${METRICS_URL:-${BACKEND_URL}/api/metrics}"

echo "=== Host Metrics Update Test ==="
echo "Metrics URL: ${METRICS_URL}"
echo ""

echo "Test 1: First measurement"
echo "Timestamp: $(date)"
echo "Host metrics:"
curl -s "${METRICS_URL}" | grep "^host_" || echo "No host_ metrics found"

echo ""
echo "Waiting 35 seconds for next measurement..."
sleep 35

echo ""
echo "Test 2: Second measurement"
echo "Timestamp: $(date)"
echo "Host metrics:"
curl -s "${METRICS_URL}" | grep "^host_" || echo "No host_ metrics found"

echo ""
echo "=== Test Complete ==="
echo ""
echo "Expected: Values should be different between measurements (if system is active)"

