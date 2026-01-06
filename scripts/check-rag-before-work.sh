#!/bin/bash
# LIMEN 작업 전 RAG 확인 스크립트
# 모든 작업 전에 반드시 RAG를 확인하도록 강제

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAG_DIR="$PROJECT_ROOT/RAG"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📚 RAG 문서 확인 (작업 전 필수)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. RAG 폴더 확인
if [ ! -d "$RAG_DIR" ]; then
    echo -e "${RED}❌ 오류: RAG 폴더가 존재하지 않습니다!${NC}"
    exit 1
fi

# 2. RAG 구조 확인
echo -e "${CYAN}📁 RAG 폴더 구조:${NC}"
if [ -f "$RAG_DIR/README.md" ]; then
    echo -e "${GREEN}   ✅ README.md 존재${NC}"
else
    echo -e "${YELLOW}   ⚠️  README.md 없음${NC}"
fi

# 주요 폴더 확인
for dir in "01-architecture" "02-development" "03-api" "04-operations" "05-frontend"; do
    if [ -d "$RAG_DIR/$dir" ]; then
        count=$(find "$RAG_DIR/$dir" -type f -name "*.md" 2>/dev/null | wc -l)
        echo -e "${GREEN}   ✅ $dir/ (문서 $count개)${NC}"
    else
        echo -e "${YELLOW}   ⚠️  $dir/ 없음${NC}"
    fi
done

echo ""

# 3. 최근 변경된 RAG 문서 확인
echo -e "${CYAN}📝 최근 변경된 RAG 문서 (최근 7일):${NC}"
recent_docs=$(find "$RAG_DIR" -type f -name "*.md" -mtime -7 2>/dev/null | head -10)
if [ -n "$recent_docs" ]; then
    echo "$recent_docs" | while read -r doc; do
        rel_path="${doc#$RAG_DIR/}"
        mod_time=$(stat -c "%y" "$doc" 2>/dev/null | cut -d' ' -f1 || echo "알 수 없음")
        echo -e "${GREEN}   ✅ $rel_path (수정: $mod_time)${NC}"
    done
else
    echo -e "${YELLOW}   ⚠️  최근 변경된 문서 없음${NC}"
fi

echo ""

# 4. 작업 유형별 관련 문서 안내
echo -e "${CYAN}💡 작업 유형별 참고 문서:${NC}"
echo ""
echo -e "${BLUE}   아키텍처 변경:${NC}"
echo "      - $RAG_DIR/01-architecture/"
echo ""
echo -e "${BLUE}   개발/코드 변경:${NC}"
echo "      - $RAG_DIR/02-development/"
echo ""
echo -e "${BLUE}   API 변경:${NC}"
echo "      - $RAG_DIR/03-api/"
echo ""
echo -e "${BLUE}   운영/배포 변경:${NC}"
echo "      - $RAG_DIR/04-operations/"
echo ""
echo -e "${BLUE}   프론트엔드 관련:${NC}"
echo "      - $RAG_DIR/05-frontend/"
echo ""

# 5. RAG 인덱스 확인
if [ -d "$RAG_DIR/index" ] && [ -n "$(ls -A "$RAG_DIR/index" 2>/dev/null)" ]; then
    echo -e "${GREEN}✅ RAG 인덱스 존재${NC}"
else
    echo -e "${YELLOW}⚠️  RAG 인덱스 없음 (인덱싱 필요)${NC}"
    echo "   실행: ./scripts/rag-index.sh"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ RAG 확인 완료 - 작업을 진행하세요${NC}"
echo -e "${YELLOW}⚠️  중요: 변경사항이 있으면 반드시 RAG에 기록하세요!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"





