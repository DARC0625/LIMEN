#!/bin/bash
# LIMEN 백엔드를 systemd 서비스로 등록하는 스크립트

set -e

SERVICE_NAME="limen-backend"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
BACKEND_DIR="/home/darc0/projects/LIMEN/backend"
SERVER_BINARY="${BACKEND_DIR}/server"
ENV_FILE="${BACKEND_DIR}/.env"

echo "🔧 LIMEN 백엔드 systemd 서비스 생성 중..."

# 서버 바이너리 확인
if [ ! -f "$SERVER_BINARY" ]; then
    echo "❌ 서버 바이너리를 찾을 수 없습니다: $SERVER_BINARY"
    exit 1
fi

# 환경 변수 파일 확인
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env 파일이 없습니다. env.example을 복사하세요."
    exit 1
fi

# systemd 서비스 파일 생성
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=LIMEN Backend Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=darc0
Group=darc0
WorkingDirectory=$BACKEND_DIR
ExecStart=$SERVER_BINARY
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=limen-backend
EnvironmentFile=$ENV_FILE

# 보안 설정
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo "✅ 서비스 파일 생성 완료: $SERVICE_FILE"

# systemd 재로드
echo "🔄 systemd 재로드 중..."
sudo systemctl daemon-reload

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 서비스 등록 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 사용 방법:"
echo "  시작:   sudo systemctl start $SERVICE_NAME"
echo "  중지:   sudo systemctl stop $SERVICE_NAME"
echo "  재시작: sudo systemctl restart $SERVICE_NAME"
echo "  상태:   sudo systemctl status $SERVICE_NAME"
echo "  로그:   sudo journalctl -u $SERVICE_NAME -f"
echo "  자동시작: sudo systemctl enable $SERVICE_NAME"
echo ""












