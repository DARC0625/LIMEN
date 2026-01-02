#!/bin/bash
# Webhook 동기화 서버 시작 스크립트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIMEN_DIR="${LIMEN_DIR:-/home/darc/LIMEN}"
WEBHOOK_SCRIPT="${LIMEN_DIR}/scripts/webhook-sync-server.js"
WEBHOOK_PORT="${WEBHOOK_PORT:-3001}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-$(openssl rand -hex 32)}"

echo "🚀 Webhook 동기화 서버 시작..."
echo "📋 LIMEN 디렉토리: $LIMEN_DIR"
echo "📋 포트: $WEBHOOK_PORT"
echo "🔐 Secret: $WEBHOOK_SECRET"
echo ""

# PM2로 실행
if command -v pm2 &> /dev/null; then
  echo "📦 PM2로 서버 시작..."
  cd "$LIMEN_DIR"
  pm2 start "$WEBHOOK_SCRIPT" \
    --name "limen-webhook-sync" \
    --interpreter node \
    --env PORT="$WEBHOOK_PORT" \
    --env SECRET="$WEBHOOK_SECRET" \
    --env LIMEN_DIR="$LIMEN_DIR" \
    --log /tmp/limen-webhook.log \
    --error /tmp/limen-webhook-error.log \
    --out /tmp/limen-webhook-out.log
  
  pm2 save
  
  echo ""
  echo "✅ Webhook 서버가 PM2로 시작되었습니다"
  echo ""
  echo "📋 다음 단계:"
  echo "1. GitHub 저장소 → Settings → Webhooks → Add webhook"
  echo "2. Payload URL: http://your-server-ip:$WEBHOOK_PORT/webhook"
  echo "3. Content type: application/json"
  echo "4. Secret: $WEBHOOK_SECRET"
  echo "5. Events: Just the push event"
  echo ""
  echo "🔍 로그 확인:"
  echo "  pm2 logs limen-webhook-sync"
  echo "  tail -f /tmp/limen-webhook.log"
else
  echo "❌ PM2가 설치되어 있지 않습니다"
  echo "   npm install -g pm2"
  exit 1
fi

