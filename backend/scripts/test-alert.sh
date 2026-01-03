#!/bin/bash
# Test script to trigger alerts for verification
# This script simulates conditions that trigger alerts

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:18443}"
METRICS_URL="${METRICS_URL:-${BACKEND_URL}/api/metrics}"

echo "=== LIMEN Alert Test Script ==="
echo "Backend URL: ${BACKEND_URL}"
echo "Metrics URL: ${METRICS_URL}"
echo ""

# Test 1: Check if metrics endpoint is accessible
echo "1. Testing metrics endpoint..."
if curl -s "${METRICS_URL}" > /dev/null; then
    echo "   ✓ Metrics endpoint is accessible"
else
    echo "   ✗ Metrics endpoint is not accessible"
    exit 1
fi

# Test 2: Check host metrics
echo ""
echo "2. Checking host metrics..."
HOST_CPU=$(curl -s "${METRICS_URL}" | grep "^host_cpu_usage_percent" | head -1 | awk '{print $2}')
HOST_MEM=$(curl -s "${METRICS_URL}" | grep "^host_memory_usage_percent" | head -1 | awk '{print $2}')
HOST_DISK=$(curl -s "${METRICS_URL}" | grep "^host_disk_usage_percent" | head -1 | awk '{print $2}')

if [ -n "${HOST_CPU}" ]; then
    echo "   ✓ Host CPU usage: ${HOST_CPU}"
else
    echo "   ✗ Host CPU usage metric not found"
fi

if [ -n "${HOST_MEM}" ]; then
    echo "   ✓ Host Memory usage: ${HOST_MEM}"
else
    echo "   ✗ Host Memory usage metric not found"
fi

if [ -n "${HOST_DISK}" ]; then
    echo "   ✓ Host Disk usage: ${HOST_DISK}"
else
    echo "   ✗ Host Disk usage metric not found"
fi

# Test 3: Check quota denied metric
echo ""
echo "3. Checking quota denied metric..."
QUOTA_DENIED=$(curl -s "${METRICS_URL}" | grep "^vm_quota_denied_total" | head -1)
if [ -n "${QUOTA_DENIED}" ]; then
    echo "   ✓ Quota denied metric found: ${QUOTA_DENIED}"
else
    echo "   ✗ Quota denied metric not found"
fi

# Test 4: Check auth failure metric
echo ""
echo "4. Checking auth failure metric..."
AUTH_FAILURE=$(curl -s "${METRICS_URL}" | grep "^auth_failure_total" | head -1)
if [ -n "${AUTH_FAILURE}" ]; then
    echo "   ✓ Auth failure metric found: ${AUTH_FAILURE}"
else
    echo "   ✗ Auth failure metric not found"
fi

# Test 5: Check console active sessions metric
echo ""
echo "5. Checking console active sessions metric..."
CONSOLE_SESSIONS=$(curl -s "${METRICS_URL}" | grep "^console_active_sessions" | head -1 | awk '{print $2}')
if [ -n "${CONSOLE_SESSIONS}" ]; then
    echo "   ✓ Console active sessions: ${CONSOLE_SESSIONS}"
else
    echo "   ✗ Console active sessions metric not found"
fi

# Test 6: Trigger auth failure (simulate)
echo ""
echo "6. Simulating auth failure..."
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"invalid_user","password":"invalid_pass"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "${LOGIN_RESPONSE}" | tail -1)
if [ "${HTTP_CODE}" = "401" ]; then
    echo "   ✓ Auth failure triggered (expected 401)"
    
    # Check if metric increased
    sleep 1
    AUTH_FAILURE_AFTER=$(curl -s "${METRICS_URL}" | grep 'auth_failure_total{reason="invalid_credentials"}' | awk '{print $2}')
    echo "   Auth failure count: ${AUTH_FAILURE_AFTER}"
else
    echo "   ✗ Unexpected response: ${HTTP_CODE}"
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "To verify alerts are working:"
echo "1. Ensure Prometheus is scraping ${METRICS_URL}"
echo "2. Ensure Alertmanager is configured with ${BACKEND_URL}/config/alertmanager.yml"
echo "3. Check Alertmanager UI: http://localhost:9093"
echo "4. Check Prometheus alerts: http://localhost:9090/alerts"

