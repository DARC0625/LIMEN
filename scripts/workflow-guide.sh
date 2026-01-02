#!/bin/bash
# LIMEN 작업 워크플로우 가이드
# 모든 작업은 이 워크플로우를 따라야 함

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}📚 LIMEN 작업 워크플로우 (필수 준수)${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BOLD}1️⃣  작업 시작 전: RAG 확인 (필수)${NC}"
echo -e "   ${CYAN}./scripts/check-rag-before-work.sh${NC}"
echo "   → 관련 문서를 반드시 확인하세요"
echo ""

echo -e "${BOLD}2️⃣  작업 수행${NC}"
echo "   → 코드/설정/문서 변경"
echo ""

echo -e "${BOLD}3️⃣  변경사항 RAG에 기록 (필수)${NC}"
echo -e "   ${CYAN}자동 기록:${NC}"
echo -e "   ${GREEN}./scripts/record-changes-to-rag.sh --auto${NC}"
echo ""
echo -e "   ${CYAN}수동 기록:${NC}"
echo -e "   ${GREEN}./scripts/record-changes-to-rag.sh -t <유형> -f <파일> '<설명>'${NC}"
echo ""
echo -e "   ${YELLOW}유형: architecture|development|api|operations|frontend|config${NC}"
echo ""

echo -e "${BOLD}4️⃣  RAG 문서 업데이트 (필요시)${NC}"
echo "   → 변경사항이 문서화가 필요한 경우:"
echo "     - $PROJECT_ROOT/RAG/01-architecture/ (아키텍처 변경)"
echo "     - $PROJECT_ROOT/RAG/02-development/ (개발 가이드 변경)"
echo "     - $PROJECT_ROOT/RAG/03-api/ (API 변경)"
echo "     - $PROJECT_ROOT/RAG/04-operations/ (운영 변경)"
echo ""

echo -e "${BOLD}5️⃣  커밋${NC}"
echo -e "   ${GREEN}git add .${NC}"
echo -e "   ${GREEN}git commit -m '변경 내용'${NC}"
echo ""
echo -e "   ${YELLOW}⚠️  pre-commit hook이 자동으로 RAG 검증을 수행합니다${NC}"
echo ""

echo -e "${BOLD}6️⃣  RAG 인덱싱 (자동)${NC}"
echo "   → post-commit hook이 자동으로 실행됩니다"
echo ""

echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${RED}⚠️  중요 규칙${NC}"
echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${RED}❌ 절대 하지 말 것:${NC}"
echo "   1. RAG 확인 없이 작업 시작"
echo "   2. 변경사항을 RAG에 기록하지 않음"
echo "   3. --no-verify로 RAG 검증 우회 (긴급 상황 제외)"
echo ""
echo -e "${GREEN}✅ 반드시 해야 할 것:${NC}"
echo "   1. 작업 전 RAG 확인"
echo "   2. 모든 변경사항 RAG에 기록"
echo "   3. 문서화가 필요한 변경은 상세 문서 작성"
echo "   4. 커밋 전 RAG 검증 통과"
echo ""

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}💡 빠른 시작${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}# 1. RAG 확인${NC}"
echo -e "${GREEN}./scripts/check-rag-before-work.sh${NC}"
echo ""
echo -e "${CYAN}# 2. 작업 수행${NC}"
echo -e "${GREEN}# ... 코드 변경 ...${NC}"
echo ""
echo -e "${CYAN}# 3. 변경사항 기록${NC}"
echo -e "${GREEN}./scripts/record-changes-to-rag.sh --auto${NC}"
echo ""
echo -e "${CYAN}# 4. 커밋${NC}"
echo -e "${GREEN}git add . && git commit -m '변경 내용'${NC}"
echo ""

