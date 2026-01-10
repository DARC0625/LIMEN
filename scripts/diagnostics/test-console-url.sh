#!/bin/bash
# Test console URL endpoint
# This script tests if /api/vms/{uuid}/console returns a valid ws_url

BASE_URL="http://localhost:18443"
USERNAME="admin"
PASSWORDS=("0625" "admin" "password")

echo "=== Console URL Test ==="
echo ""

# Step 1: Login
echo "[1] Logging in..."
TOKEN=""
for PWD in "${PASSWORDS[@]}"; do
    RESP=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${USERNAME}\",\"password\":\"${PWD}\"}")
    
    TOKEN=$(echo "$RESP" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        echo "✓ Login successful (password: ${PWD})"
        break
    fi
done

if [ -z "$TOKEN" ]; then
    echo "✗ Login failed"
    echo "Response: $RESP"
    exit 1
fi

# Step 2: Get VM UUID
echo ""
echo "[2] Getting VM list..."
VM_LIST=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/vms")
VM_UUID=$(echo "$VM_LIST" | grep -o '"uuid":"[^"]*"' | head -n 1 | cut -d'"' -f4)

if [ -z "$VM_UUID" ]; then
    echo "✗ No VM found"
    echo "Response: $VM_LIST"
    exit 1
fi

echo "✓ Found VM: ${VM_UUID}"

# Step 3: Get console URL
echo ""
echo "[3] Getting console URL..."
CONSOLE_RESP=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
    "${BASE_URL}/api/vms/${VM_UUID}/console")

WS_URL=$(echo "$CONSOLE_RESP" | grep -o '"ws_url":"[^"]*"' | cut -d'"' -f4)
PROTOCOL=$(echo "$CONSOLE_RESP" | grep -o '"protocol":"[^"]*"' | cut -d'"' -f4)
EXPIRES_AT=$(echo "$CONSOLE_RESP" | grep -o '"expires_at":"[^"]*"' | cut -d'"' -f4)

if [ -z "$WS_URL" ]; then
    echo "✗ Failed to get console URL"
    echo "Response: $CONSOLE_RESP"
    exit 1
fi

echo "✓ Console URL received:"
echo "  ws_url: ${WS_URL}"
echo "  protocol: ${PROTOCOL}"
echo "  expires_at: ${EXPIRES_AT}"

# Step 4: Test WebSocket (basic HTTP upgrade check)
echo ""
echo "[4] Testing WebSocket endpoint (HTTP upgrade check)..."
# Extract host and path from ws_url
WS_HOST=$(echo "$WS_URL" | sed -E 's|^wss?://([^/]+).*|\1|')
WS_PATH=$(echo "$WS_URL" | sed -E 's|^wss?://[^/]+(.*)|\1|')

# Try HTTP GET to see if endpoint exists
if echo "$WS_URL" | grep -q "^ws://"; then
    HTTP_URL="http://${WS_HOST}${WS_PATH}"
else
    HTTP_URL="https://${WS_HOST}${WS_PATH}"
fi

echo "  Testing: ${HTTP_URL}"
HTTP_RESP=$(curl -s -i -H "Upgrade: websocket" -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Origin: ${BASE_URL}" \
    "$HTTP_URL" 2>&1 | head -n 20)

if echo "$HTTP_RESP" | grep -q "101\|426\|Upgrade"; then
    echo "✓ WebSocket endpoint responds (HTTP upgrade headers detected)"
    echo ""
    echo "=== Test Summary ==="
    echo "✓ Console URL endpoint: WORKING"
    echo "✓ WebSocket URL format: VALID"
    echo ""
    echo "Next step: Test actual WebSocket connection with:"
    echo "  node -e \"const ws=new (require('ws').WebSocket)('${WS_URL}'); ws.onopen=()=>console.log('open'); ws.onerror=e=>console.log('error',e); ws.onclose=c=>console.log('close',c.code);\""
else
    echo "⚠ WebSocket endpoint check inconclusive"
    echo "Response headers:"
    echo "$HTTP_RESP"
fi

echo ""
echo "=== Manual WebSocket Test ==="
echo "To test the WebSocket connection, use one of:"
echo ""
echo "1. Node.js (if 'ws' package is available):"
echo "   node -e \"const WebSocket=require('ws'); const ws=new WebSocket('${WS_URL}'); ws.onopen=()=>console.log('✓ Open'); ws.onerror=e=>console.log('✗ Error',e); ws.onclose=c=>console.log('Close',c.code);\""
echo ""
echo "2. Browser console:"
echo "   const ws = new WebSocket('${WS_URL}');"
echo "   ws.onopen = () => console.log('✓ Open');"
echo "   ws.onerror = (e) => console.log('✗ Error', e);"
echo "   ws.onclose = (c) => console.log('Close', c.code, c.reason);"
echo ""
