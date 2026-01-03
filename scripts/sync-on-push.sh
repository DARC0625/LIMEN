#!/bin/bash
# LIMEN 로컬 자동 동기화 스크립트
# Git post-push hook에서 호출하여 로컬에서도 동기화 수행

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔄 로컬 동기화 실행 중...${NC}"

# RAG 인덱싱
if [ -f "$PROJECT_ROOT/scripts/rag-index.sh" ]; then
    echo -e "${BLUE}   RAG 인덱싱 실행...${NC}"
    "$PROJECT_ROOT/scripts/rag-index.sh" --auto || true
fi

echo -e "${GREEN}✅ 로컬 동기화 완료${NC}"


