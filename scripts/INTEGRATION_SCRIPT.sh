#!/bin/bash

# LIMEN 리포지토리 통합 스크립트
# 이 스크립트는 프론트엔드와 백엔드를 darc0625/limen 리포지토리에 통합합니다.

set -e

echo "🚀 LIMEN 리포지토리 통합 시작..."

# 1. Git 리포지토리 초기화 (이미 되어있으면 스킵)
if [ ! -d ".git" ]; then
    echo "📦 Git 리포지토리 초기화..."
    git init
fi

# 2. 원격 리포지토리 연결
echo "🔗 원격 리포지토리 연결..."
if ! git remote | grep -q "origin"; then
    git remote add origin https://github.com/darc0625/limen.git
    echo "✅ 원격 리포지토리 추가됨: https://github.com/darc0625/limen.git"
else
    echo "ℹ️  원격 리포지토리가 이미 설정되어 있습니다."
    git remote set-url origin https://github.com/darc0625/limen.git
fi

# 3. 문서 디렉토리 구조 생성
echo "📁 문서 디렉토리 구조 생성..."
mkdir -p docs/architecture
mkdir -p docs/api
mkdir -p docs/development
mkdir -p docs/components
mkdir -p docs/deployment

# 4. 프론트엔드 문서 이동
echo "📝 프론트엔드 문서 통합..."
if [ -f "frontend/DEVELOPMENT.md" ]; then
    cp frontend/DEVELOPMENT.md docs/development/FRONTEND_DEVELOPMENT.md
    echo "✅ DEVELOPMENT.md 이동 완료"
fi

if [ -f "frontend/docs/COMPONENTS.md" ]; then
    cp frontend/docs/COMPONENTS.md docs/components/FRONTEND_COMPONENTS.md
    echo "✅ COMPONENTS.md 이동 완료"
fi

if [ -f "frontend/UPGRADE_SUMMARY.md" ]; then
    cp frontend/UPGRADE_SUMMARY.md docs/development/UPGRADE_SUMMARY.md
    echo "✅ UPGRADE_SUMMARY.md 이동 완료"
fi

# 5. .gitignore 확인
if [ ! -f ".gitignore" ]; then
    echo "📋 .gitignore 생성..."
    # .gitignore는 이미 생성되어 있음
fi

# 6. README.md 확인
if [ ! -f "README.md" ]; then
    echo "📖 README.md 생성..."
    # README.md는 이미 생성되어 있음
fi

# 7. 초기 커밋 준비
echo "📦 변경사항 스테이징..."
git add .

echo ""
echo "✅ 통합 준비 완료!"
echo ""
echo "다음 단계:"
echo "1. git status 로 변경사항 확인"
echo "2. git commit -m 'Initial commit: Integrate frontend and backend'"
echo "3. git branch -M main"
echo "4. git push -u origin main"
echo ""
echo "⚠️  주의: 백엔드 코드가 이미 리포지토리에 있다면,"
echo "   먼저 git pull origin main 으로 기존 코드를 가져온 후"
echo "   충돌을 해결하고 커밋하세요."

