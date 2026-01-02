#!/bin/bash
# systemd 서비스 설치 스크립트

set -e

SERVICE_NAME="limen"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SOURCE_FILE="/home/darc0/projects/LIMEN/${SERVICE_NAME}.service"

echo "🔧 LIMEN 통합 systemd 서비스 설치 중..."

# 소스 파일 확인
if [ ! -f "$SOURCE_FILE" ]; then
    echo "❌ 서비스 파일을 찾을 수 없습니다: $SOURCE_FILE"
    exit 1
fi

# 서비스 파일 복사
echo "📋 서비스 파일 복사 중..."
sudo cp "$SOURCE_FILE" "$SERVICE_FILE"
sudo chmod 644 "$SERVICE_FILE"

echo "✅ 서비스 파일 생성 완료: $SERVICE_FILE"

# systemd 재로드
echo "🔄 systemd 재로드 중..."
sudo systemctl daemon-reload

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 서비스 등록 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 다음 명령어를 실행하세요:"
echo ""
echo "  # 서비스 시작"
echo "  sudo systemctl start $SERVICE_NAME"
echo ""
echo "  # 자동 시작 활성화"
echo "  sudo systemctl enable $SERVICE_NAME"
echo ""
echo "  # 상태 확인"
echo "  sudo systemctl status $SERVICE_NAME"
echo ""
echo "  # 로그 확인"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo ""




