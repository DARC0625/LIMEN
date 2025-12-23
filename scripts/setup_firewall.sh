#!/bin/bash

# LIMEN 백엔드 방화벽 설정 스크립트
# 이 스크립트는 백엔드 서버(10.0.0.100)에서 실행해야 합니다.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 LIMEN 백엔드 방화벽 설정"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 커스텀 포트 (기본값: 18443)
BACKEND_PORT=${BACKEND_PORT:-18443}
FRONTEND_IP="10.0.0.10"
BACKEND_IP="10.0.0.110"  # WSL IP

# ufw 설치 확인
if ! command -v ufw &> /dev/null; then
    echo "⚠️  ufw가 설치되지 않았습니다. 설치 중..."
    sudo apt-get update
    sudo apt-get install -y ufw
fi

echo "1️⃣  현재 방화벽 상태 확인..."
sudo ufw status

echo ""
echo "2️⃣  기본 정책 설정 (모든 인바운드 차단, 아웃바운드 허용)..."
sudo ufw default deny incoming
sudo ufw default allow outgoing

echo ""
echo "3️⃣  SSH 포트 허용 (22번 포트)..."
sudo ufw allow 22/tcp comment 'SSH'

echo ""
echo "4️⃣  백엔드 포트(${BACKEND_PORT})를 프론트엔드(${FRONTEND_IP})에서만 허용..."
# 백엔드가 10.0.0.110에 바인딩되어 있으므로, 프론트엔드에서 접근 허용
sudo ufw allow from ${FRONTEND_IP} to ${BACKEND_IP} port ${BACKEND_PORT} proto tcp comment 'LIMEN Backend API'

echo ""
echo "5️⃣  PostgreSQL 포트(5432)는 로컬에서만 허용..."
sudo ufw allow from 127.0.0.1 to any port 5432 proto tcp comment 'PostgreSQL (localhost only)'

echo ""
echo "6️⃣  방화벽 활성화..."
sudo ufw --force enable

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 방화벽 설정 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "현재 방화벽 규칙:"
sudo ufw status numbered

echo ""
echo "📋 설정 요약:"
echo "  - 백엔드 포트: ${BACKEND_PORT}"
echo "  - 허용된 IP: ${FRONTEND_IP} (프론트엔드)"
echo "  - SSH: 22번 포트 허용"
echo "  - PostgreSQL: 127.0.0.1에서만 접근 가능"
echo ""
echo "⚠️  방화벽 규칙을 확인하고 필요시 수정하세요:"
echo "   sudo ufw status numbered"
echo "   sudo ufw delete [번호]"

