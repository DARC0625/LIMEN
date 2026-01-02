#!/bin/bash
# 서버에서 직접 실행하는 자동 동기화 스크립트
# GitHub Actions 대신 서버에서 직접 git pull 실행

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIMEN_DIR="${LIMEN_DIR:-/home/darc/LIMEN}"

echo "🔄 서버 자동 동기화 시작..."
echo "📋 LIMEN 디렉토리: $LIMEN_DIR"

# LIMEN 디렉토리 확인
if [ ! -d "$LIMEN_DIR" ]; then
  echo "❌ 오류: $LIMEN_DIR 디렉토리가 존재하지 않습니다"
  exit 1
fi

cd "$LIMEN_DIR" || exit 1

# 현재 상태 확인
echo "📋 현재 브랜치: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
echo "📋 현재 커밋: $(git log --oneline -1 2>/dev/null || echo 'unknown')"

# Git remote 확인
echo "📋 Git remote 확인:"
git remote -v

# 최신 코드 가져오기
echo "⬇️  최신 코드 가져오는 중..."
git fetch origin || {
  echo "⚠️  git fetch 실패, 계속 진행..."
}

# 강제 업데이트
echo "🔄 Git reset 실행..."
git reset --hard origin/main || {
  echo "❌ git reset 실패"
  exit 1
}

# 정리
echo "🔄 Git clean 실행..."
git clean -fd || {
  echo "⚠️  git clean 실패, 계속 진행..."
}

# 동기화 결과 확인
echo "✅ 동기화 완료 - 최신 커밋:"
git log --oneline -1

# RAG 인덱싱 실행
if [ -f "$LIMEN_DIR/scripts/rag-index.sh" ]; then
  echo "🔄 RAG 인덱싱 실행 중..."
  chmod +x "$LIMEN_DIR/scripts/rag-index.sh"
  cd "$LIMEN_DIR" && ./scripts/rag-index.sh --auto || true
fi

# 서비스 재시작 (PM2)
if command -v pm2 &> /dev/null; then
  echo "🔄 서비스 재시작 중..."
  
  # 프론트엔드 서비스
  if [ -d "$LIMEN_DIR/frontend" ]; then
    cd "$LIMEN_DIR/frontend" && pm2 restart limen-frontend --update-env || true
  fi
  
  # 백엔드 서비스
  if [ -d "$LIMEN_DIR/backend" ]; then
    cd "$LIMEN_DIR/backend" && pm2 restart limen --update-env || true
  fi
fi

echo "✅ 서버 자동 동기화 완료"
