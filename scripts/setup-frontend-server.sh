#!/bin/bash

# 프론트엔드 서버 초기 설정 스크립트
# 이 스크립트는 프론트엔드 서버에서 실행하여 frontend/와 docs/만 체크아웃합니다.

set -e

REPO_URL="git@github.com:DARC0625/LIMEN.git"
TARGET_DIR="${1:-limen-frontend}"

if [ -d "$TARGET_DIR" ]; then
  echo "❌ $TARGET_DIR 디렉토리가 이미 존재합니다."
  echo "   기존 디렉토리를 삭제하거나 다른 이름을 사용하세요."
  exit 1
fi

echo "🚀 프론트엔드 서버 설정 시작..."
echo "📦 리포지토리: $REPO_URL"
echo "📁 대상 디렉토리: $TARGET_DIR"
echo ""

# 클론 (체크아웃 없이)
echo "1️⃣ 리포지토리 클론 중..."
git clone --no-checkout "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

# Sparse-checkout 설정
echo "2️⃣ Sparse-checkout 설정 중..."
git sparse-checkout init --cone

# 필요한 디렉토리만 추가
echo "3️⃣ 필요한 디렉토리 추가 중..."
git sparse-checkout set \
  frontend/ \
  docs/ \
  RAG/ \
  .github/workflows/frontend*.yml \
  .github/workflows/validate-md.yml \
  scripts/validate-md-files.js \
  scripts/setup-rag-for-frontend.sh \
  scripts/check-rag-before-work.sh \
  scripts/record-changes-to-rag.sh \
  scripts/workflow-guide.sh \
  scripts/verify-rag-structure.sh

# 체크아웃
echo "4️⃣ 파일 체크아웃 중..."
git checkout main

# 검증
echo ""
echo "5️⃣ 검증 중..."
if [ -d "frontend" ] && [ -d "docs" ]; then
  if [ ! -d "backend" ]; then
    echo "✅ 프론트엔드 서버 설정 완료!"
    echo ""
    echo "📁 위치: $(pwd)"
    echo "📋 체크아웃된 디렉토리:"
    git sparse-checkout list
    echo ""
    echo "📊 디렉토리 구조:"
    ls -la | grep -E "^d" | awk '{print $9}' | grep -v "^\.$" | grep -v "^\.\.$"
  else
    echo "❌ 오류: backend 디렉토리가 존재합니다!"
    exit 1
  fi
else
  echo "❌ 오류: frontend 또는 docs 디렉토리가 없습니다!"
  exit 1
fi

echo ""
echo "🎉 설정 완료! 이제 프론트엔드 개발을 시작할 수 있습니다."

