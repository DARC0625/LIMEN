#!/bin/bash
# GitHub Actions가 서버에 SSH 접속할 수 있도록 설정
# 서버의 authorized_keys에 GitHub Actions 공개키 추가

set -e

AUTHORIZED_KEYS_FILE="$HOME/.ssh/authorized_keys"
SSH_DIR="$HOME/.ssh"

echo "🔧 GitHub Actions SSH 접속 설정"
echo ""

# .ssh 디렉토리 생성
if [ ! -d "$SSH_DIR" ]; then
  mkdir -p "$SSH_DIR"
  chmod 700 "$SSH_DIR"
  echo "✅ .ssh 디렉토리 생성"
fi

# authorized_keys 파일 생성
if [ ! -f "$AUTHORIZED_KEYS_FILE" ]; then
  touch "$AUTHORIZED_KEYS_FILE"
  chmod 600 "$AUTHORIZED_KEYS_FILE"
  echo "✅ authorized_keys 파일 생성"
fi

echo ""
echo "📋 현재 authorized_keys 내용:"
cat "$AUTHORIZED_KEYS_FILE" || echo "(비어있음)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 GitHub Actions용 SSH 키 설정 방법:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "방법 1: 서버의 SSH 공개키를 GitHub Actions Secrets에 등록"
echo "  1. 서버의 공개키 확인:"
echo "     cat ~/.ssh/id_ed25519_github.pub"
echo ""
echo "  2. GitHub Secrets에 FRONTEND_SSH_KEY로 등록"
echo "     (개인키가 아닌 공개키를 등록하는 것이 아님!)"
echo ""
echo "방법 2: GitHub Actions의 공개키를 서버에 추가"
echo "  1. GitHub Actions에서 임시로 SSH 키 생성"
echo "  2. 공개키를 서버의 authorized_keys에 추가"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 올바른 설정:"
echo "  - GitHub Secrets의 FRONTEND_SSH_KEY: 서버의 SSH 개인키"
echo "  - GitHub Actions가 이 개인키를 사용해서 서버에 접속"
echo ""
echo "⚠️  주의:"
echo "  - 개인키는 절대 공개하지 마세요"
echo "  - GitHub Secrets에만 등록하세요"
echo ""

# 서버의 SSH 키 확인
echo "📋 서버의 SSH 키:"
if [ -f "$SSH_DIR/id_ed25519_github.pub" ]; then
  echo "✅ 공개키 발견:"
  cat "$SSH_DIR/id_ed25519_github.pub"
  echo ""
  echo "이 공개키가 GitHub Deploy keys에 등록되어 있어야 합니다."
elif [ -f "$SSH_DIR/id_rsa.pub" ]; then
  echo "✅ 공개키 발견:"
  cat "$SSH_DIR/id_rsa.pub"
  echo ""
  echo "이 공개키가 GitHub Deploy keys에 등록되어 있어야 합니다."
else
  echo "❌ SSH 공개키를 찾을 수 없습니다."
  echo "   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 설정 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

