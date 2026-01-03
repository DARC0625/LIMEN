#!/bin/bash
# LIMEN Alerts E2E Test Script
# Tests end-to-end alert flow: Prometheus -> Alertmanager -> Webhook

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:18443}"
METRICS_URL="${METRICS_URL:-${BACKEND_URL}/api/metrics}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"

echo "=== LIMEN Alerts E2E Test ==="
echo "Backend URL: ${BACKEND_URL}"
echo "Metrics URL: ${METRICS_URL}"
echo "Prometheus URL: ${PROMETHEUS_URL}"
echo "Alertmanager URL: ${ALERTMANAGER_URL}"
echo ""

# Test 1: Check if metrics endpoint is accessible
echo "1. Checking metrics endpoint..."
if curl -s "${METRICS_URL}" > /dev/null; then
    echo "   ✓ Metrics endpoint is accessible"
else
    echo "   ✗ Metrics endpoint is not accessible"
    exit 1
fi

# Test 2: Check Prometheus targets
echo ""
echo "2. Checking Prometheus targets..."
if curl -s "${PROMETHEUS_URL}/api/v1/targets" > /dev/null; then
    echo "   ✓ Prometheus API is accessible"
    echo "   Please check: ${PROMETHEUS_URL}/targets"
    echo "   Expected: LIMEN backend target should be UP"
else
    echo "   ⚠ Prometheus is not accessible (may not be running)"
    echo "   Please ensure Prometheus is running and scraping ${METRICS_URL}"
fi

# Test 3: Check Alertmanager
echo ""
echo "3. Checking Alertmanager..."
if curl -s "${ALERTMANAGER_URL}/api/v2/status" > /dev/null; then
    echo "   ✓ Alertmanager API is accessible"
    echo "   Please check: ${ALERTMANAGER_URL}"
else
    echo "   ⚠ Alertmanager is not accessible (may not be running)"
    echo "   Please ensure Alertmanager is running"
fi

# Test 4: Trigger auth failures to fire HighAuthFailureRate alert
echo ""
echo "4. Triggering auth failures to fire HighAuthFailureRate alert..."
echo "   This will attempt 20 failed logins..."

FAILURE_COUNT=0
for i in {1..20}; do
    HTTP_CODE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"invalid_user","password":"invalid_pass"}' \
        -w "%{http_code}" -o /dev/null)
    
    if [ "${HTTP_CODE}" = "401" ]; then
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        echo -n "."
    else
        echo "   ⚠ Unexpected response code: ${HTTP_CODE}"
    fi
    
    sleep 0.5
done

echo ""
echo "   ✓ Triggered ${FAILURE_COUNT} auth failures"

# Test 5: Check metrics after triggering
echo ""
echo "5. Checking auth_failure_total metric..."
sleep 2
AUTH_FAILURE_METRIC=$(curl -s "${METRICS_URL}" | grep 'auth_failure_total{reason="invalid_credentials"}' | head -1)
if [ -n "${AUTH_FAILURE_METRIC}" ]; then
    echo "   ✓ Auth failure metric: ${AUTH_FAILURE_METRIC}"
else
    echo "   ⚠ Auth failure metric not found"
fi

# Test 6: Wait for alert to fire (if Prometheus is configured)
echo ""
echo "6. Waiting for alert to propagate (30 seconds)..."
echo "   Please check:"
echo "   - Prometheus alerts: ${PROMETHEUS_URL}/alerts"
echo "   - Alertmanager alerts: ${ALERTMANAGER_URL}"
echo "   - Webhook logs (if configured)"
sleep 30

# Test 7: Check Prometheus alerts
echo ""
echo "7. Checking Prometheus alerts..."
if curl -s "${PROMETHEUS_URL}/api/v1/alerts" > /dev/null; then
    ALERTS=$(curl -s "${PROMETHEUS_URL}/api/v1/alerts" | jq -r '.data.alerts[] | select(.state=="firing") | "\(.labels.alertname): \(.state)"' 2>/dev/null || echo "jq not available")
    if [ -n "${ALERTS}" ]; then
        echo "   ✓ Firing alerts found:"
        echo "${ALERTS}" | sed 's/^/      /'
    else
        echo "   ⚠ No firing alerts found (may need to wait longer or check threshold)"
    fi
else
    echo "   ⚠ Cannot check Prometheus alerts (Prometheus may not be running)"
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "Next steps:"
echo "1. Check Prometheus targets: ${PROMETHEUS_URL}/targets"
echo "2. Check Prometheus alerts: ${PROMETHEUS_URL}/alerts"
echo "3. Check Alertmanager: ${ALERTMANAGER_URL}"
echo "4. Check webhook logs (if configured)"
echo ""
echo "Evidence to collect:"
echo "- Screenshot: Prometheus targets (UP status)"
echo "- Screenshot: Prometheus alerts (firing state)"
echo "- Screenshot: Alertmanager UI (firing alerts)"
echo "- Log: Webhook receiver (if configured)"

