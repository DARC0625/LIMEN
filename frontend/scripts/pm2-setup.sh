#!/bin/bash
# PM2 서비스 설정 스크립트

set -e

# 스크립트 위치 기준으로 상대 경로 계산
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/.."
DARC_DIR="${FRONTEND_DIR}/../darc.kr"

echo "=========================================="
echo "PM2 서비스 설정"
echo "=========================================="
echo ""

# 1. 기존 프로세스 정리
echo "1. 기존 프로세스 정리 중..."
pm2 delete all 2>/dev/null || true
pkill -9 -f "next.*9444\|next.*9445" 2>/dev/null || true
sleep 2
echo "✅ 정리 완료"
echo ""

# 2. LIMEN 프론트엔드 빌드 확인
echo "2. LIMEN 프론트엔드 빌드 확인 중..."
if [ ! -d "${FRONTEND_DIR}/.next" ]; then
  echo "   빌드 없음 - 빌드 시작..."
  cd "${FRONTEND_DIR}"
  npm run build
  echo "✅ 빌드 완료"
else
  echo "✅ 빌드 파일 존재"
fi
echo ""

# 3. DARC 빌드 확인
echo "3. DARC 빌드 확인 중..."
if [ ! -d "${DARC_DIR}/.next" ]; then
  echo "   빌드 없음 - 빌드 시작..."
  cd "${DARC_DIR}"
  npm run build
  echo "✅ 빌드 완료"
else
  echo "✅ 빌드 파일 존재"
fi
echo ""

# 4. PM2로 프로세스 시작
echo "4. PM2로 프로세스 시작 중..."
cd "${FRONTEND_DIR}"
pm2 start ecosystem.config.js
echo "✅ 프로세스 시작 완료"
echo ""

# 5. PM2 설정 저장
echo "5. PM2 설정 저장 중..."
pm2 save
echo "✅ 설정 저장 완료"
echo ""

# 6. 상태 확인
echo "6. 상태 확인 중..."
sleep 3
pm2 list
echo ""

# 7. 포트 확인
echo "7. 포트 확인 중..."
netstat -tlnp 2>/dev/null | grep -E ":(9444|9445)" || ss -tlnp 2>/dev/null | grep -E ":(9444|9445)"
echo ""

echo "=========================================="
echo "PM2 서비스 설정 완료!"
echo "=========================================="
echo ""
echo "관리 명령어:"
echo "  pm2 list              - 프로세스 목록"
echo "  pm2 restart limen-frontend  - LIMEN 재시작"
echo "  pm2 restart darc.kr   - DARC 재시작"
echo "  pm2 stop all          - 모두 중지"
echo "  pm2 start all          - 모두 시작"
echo "  pm2 logs              - 로그 확인"
echo ""

