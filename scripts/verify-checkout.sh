#!/bin/bash

# 체크아웃 검증 스크립트
# 각 서버에서 실행하여 올바르게 설정되었는지 확인합니다.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/..")"

cd "$REPO_ROOT"

echo "🔍 체크아웃 검증 시작..."
echo "📁 리포지토리 루트: $REPO_ROOT"
echo ""

# Sparse-checkout 상태 확인
if git config core.sparseCheckout > /dev/null 2>&1; then
  echo "✅ Sparse-checkout 활성화됨"
  echo "📋 체크아웃된 디렉토리:"
  git sparse-checkout list | sed 's/^/  - /'
  echo ""
else
  echo "⚠️  Sparse-checkout 비활성화됨 (전체 체크아웃)"
  echo ""
fi

# 디렉토리 존재 여부 확인
echo "📊 디렉토리 상태:"
for dir in frontend backend docs; do
  if [ -d "$dir" ]; then
    echo "  ✅ $dir/ 존재"
  else
    echo "  ❌ $dir/ 없음"
  fi
done

echo ""

# 서버 타입 감지
if [ -d "frontend" ] && [ ! -d "backend" ]; then
  echo "🎯 서버 타입: 프론트엔드 서버"
  echo "✅ 올바르게 설정되었습니다!"
elif [ -d "backend" ] && [ ! -d "frontend" ]; then
  echo "🎯 서버 타입: 백엔드 서버"
  echo "✅ 올바르게 설정되었습니다!"
elif [ -d "docs" ] && [ ! -d "frontend" ] && [ ! -d "backend" ]; then
  echo "🎯 서버 타입: 문서 서버 (RAG)"
  echo "✅ 올바르게 설정되었습니다!"
elif [ -d "frontend" ] && [ -d "backend" ]; then
  echo "🎯 서버 타입: 전체 체크아웃 (로컬 개발 환경)"
  echo "⚠️  프로덕션 서버에서는 Sparse-checkout을 사용하세요."
else
  echo "❌ 알 수 없는 서버 타입"
  exit 1
fi

