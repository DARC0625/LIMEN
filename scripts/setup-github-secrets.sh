#!/bin/bash
# GitHub Secrets를 CLI로 설정하는 스크립트

set -e

echo "🔧 GitHub Secrets 설정 (CLI)"
echo ""

# GitHub CLI 확인
if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI가 설치되어 있지 않습니다."
  echo ""
  echo "설치 방법:"
  echo "  sudo apt update && sudo apt install gh -y"
  echo ""
  echo "설치 후 다시 실행하세요."
  exit 1
fi

# GitHub 로그인 확인
if ! gh auth status &> /dev/null; then
  echo "⚠️  GitHub에 로그인되지 않았습니다."
  echo ""
  echo "로그인:"
  echo "  gh auth login"
  echo ""
  echo "로그인 후 다시 실행하세요."
  exit 1
fi

echo "✅ GitHub CLI 확인 완료"
echo ""

# 프론트엔드 Secrets 설정
echo "📝 프론트엔드 Secrets 설정 중..."
gh secret set FRONTEND_HOST --body '10.0.0.10' && echo "  ✅ FRONTEND_HOST"
gh secret set FRONTEND_USER --body 'darc' && echo "  ✅ FRONTEND_USER"
gh secret set FRONTEND_SSH_KEY < ~/.ssh/id_ed25519_github && echo "  ✅ FRONTEND_SSH_KEY"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 프론트엔드 Secrets 설정 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "백엔드 Secrets도 설정하려면:"
echo "  gh secret set BACKEND_HOST --body '백엔드서버IP'"
echo "  gh secret set BACKEND_USER --body 'darc0'"
echo "  gh secret set BACKEND_SSH_KEY < /path/to/backend/ssh/key"
echo ""

