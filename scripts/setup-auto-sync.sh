#!/bin/bash
# LIMEN 자동 동기화 설정 스크립트
# GitHub Actions를 사용하여 푸시 시 자동으로 서버 동기화

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITHUB_DIR="$PROJECT_ROOT/.github/workflows"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}🔄 LIMEN 자동 동기화 설정${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. GitHub Actions 워크플로우 확인
echo -e "${CYAN}1️⃣  GitHub Actions 워크플로우 확인${NC}"
if [ -f "$GITHUB_DIR/auto-sync.yml" ]; then
    echo -e "${GREEN}   ✅ auto-sync.yml 존재${NC}"
else
    echo -e "${YELLOW}   ⚠️  auto-sync.yml 없음${NC}"
fi
echo ""

# 2. GitHub Secrets 설정 안내
echo -e "${CYAN}2️⃣  GitHub Secrets 설정 필요${NC}"
echo ""
echo -e "${YELLOW}다음 Secrets를 GitHub 저장소에 설정해야 합니다:${NC}"
echo ""
echo -e "${BLUE}백엔드 서버:${NC}"
echo "  - BACKEND_HOST: 백엔드 서버 IP 또는 도메인"
echo "  - BACKEND_USER: SSH 사용자명"
echo "  - BACKEND_SSH_KEY: SSH 개인 키"
echo "  - BACKEND_SSH_PORT: SSH 포트 (기본: 22)"
echo ""
echo -e "${BLUE}프론트엔드 서버:${NC}"
echo "  - FRONTEND_HOST: 프론트엔드 서버 IP 또는 도메인"
echo "  - FRONTEND_USER: SSH 사용자명"
echo "  - FRONTEND_SSH_KEY: SSH 개인 키"
echo "  - FRONTEND_SSH_PORT: SSH 포트 (기본: 22)"
echo ""
echo -e "${CYAN}설정 방법:${NC}"
echo "  1. GitHub 저장소 → Settings → Secrets and variables → Actions"
echo "  2. New repository secret 클릭"
echo "  3. 위의 각 Secret 추가"
echo ""

# 3. SSH 키 생성 안내
echo -e "${CYAN}3️⃣  SSH 키 설정${NC}"
if [ -f ~/.ssh/id_rsa.pub ]; then
    echo -e "${GREEN}   ✅ SSH 공개 키 존재${NC}"
    echo -e "${BLUE}   공개 키:${NC}"
    cat ~/.ssh/id_rsa.pub | head -1
    echo ""
    echo -e "${YELLOW}   이 키를 서버의 ~/.ssh/authorized_keys에 추가하세요${NC}"
else
    echo -e "${YELLOW}   ⚠️  SSH 키 없음${NC}"
    echo -e "${BLUE}   생성하려면:${NC}"
    echo "     ssh-keygen -t rsa -b 4096 -C 'github-actions@limen'"
fi
echo ""

# 4. 워크플로우 파일 경로 확인
echo -e "${CYAN}4️⃣  워크플로우 파일 경로${NC}"
echo "  $GITHUB_DIR/auto-sync.yml"
echo ""

# 5. 사용법 안내
echo -e "${CYAN}5️⃣  사용법${NC}"
echo ""
echo -e "${GREEN}자동 동기화는 다음 경우에 트리거됩니다:${NC}"
echo "  - main 브랜치에 푸시"
echo "  - GitHub Actions에서 수동 실행"
echo ""
echo -e "${GREEN}동기화 프로세스:${NC}"
echo "  1. GitHub Actions가 푸시 감지"
echo "  2. 백엔드 서버에 SSH 접속"
echo "  3. git pull로 최신 코드 가져오기"
echo "  4. RAG 인덱싱 실행"
echo "  5. 서비스 재시작 (선택적)"
echo "  6. 프론트엔드 서버에도 동일하게 수행"
echo ""

echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}✅ 자동 동기화 설정 완료!${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}⚠️  다음 단계:${NC}"
echo "  1. GitHub Secrets 설정 (위 참고)"
echo "  2. SSH 키를 서버에 추가"
echo "  3. auto-sync.yml의 서버 경로 확인 및 수정"
echo "  4. 테스트: git push origin main"
echo ""


