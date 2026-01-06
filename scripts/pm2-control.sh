#!/bin/bash
# LIMEN PM2 제어 스크립트

set -e

LIMEN_ROOT="/home/darc0/LIMEN"
cd "$LIMEN_ROOT/backend"

case "$1" in
    start)
        echo "🚀 LIMEN 서비스 시작 중..."
        pm2 start ecosystem.config.js
        pm2 save
        echo "✅ 서비스가 시작되었습니다."
        pm2 status
        ;;
    stop)
        echo "🛑 LIMEN 서비스 중지 중..."
        pm2 stop ecosystem.config.js
        echo "✅ 서비스가 중지되었습니다."
        ;;
    restart)
        echo "🔄 LIMEN 서비스 재시작 중..."
        pm2 restart ecosystem.config.js
        pm2 save
        echo "✅ 서비스가 재시작되었습니다."
        pm2 status
        ;;
    status)
        echo "📊 LIMEN 서비스 상태:"
        pm2 status
        pm2 logs --lines 10
        ;;
    logs)
        pm2 logs --lines ${2:-50}
        ;;
    *)
        echo "사용법: $0 {start|stop|restart|status|logs [lines]}"
        echo ""
        echo "명령어:"
        echo "  start   - 서비스 시작"
        echo "  stop    - 서비스 중지"
        echo "  restart - 서비스 재시작"
        echo "  status  - 서비스 상태 확인"
        echo "  logs    - 로그 확인 (기본 50줄)"
        exit 1
        ;;
esac


