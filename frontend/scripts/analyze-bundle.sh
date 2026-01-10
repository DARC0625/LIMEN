#!/bin/bash
# 번들 분석 스크립트
# 프론트엔드 번들 크기 분석 및 최적화 제안

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 LIMEN 프론트엔드 번들 분석"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 1. 의존성 확인
echo -e "${CYAN}1️⃣  의존성 확인${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules가 없습니다. 설치 중...${NC}"
    npm install
else
    echo -e "${GREEN}✅ node_modules 존재${NC}"
fi
echo ""

# 2. 번들 분석 실행
echo -e "${CYAN}2️⃣  번들 분석 실행${NC}"
echo -e "${BLUE}이 작업은 몇 분이 걸릴 수 있습니다...${NC}"
echo ""

ANALYZE=true npm run build:analyze:turbo 2>&1 | tee /tmp/bundle-analysis.log

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}❌ 번들 분석 실패${NC}"
    echo "로그를 확인하세요: /tmp/bundle-analysis.log"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ 번들 분석 완료${NC}"
echo ""

# 3. 결과 확인
echo -e "${CYAN}3️⃣  빌드 결과 확인${NC}"
if [ -d ".next" ]; then
    echo -e "${GREEN}✅ .next 디렉토리 생성됨${NC}"
    
    # 번들 크기 확인
    if [ -d ".next/static/chunks" ]; then
        echo ""
        echo -e "${BOLD}📊 번들 파일 크기:${NC}"
        echo ""
        
        # 가장 큰 파일 상위 10개
        echo -e "${CYAN}가장 큰 JS 파일 (상위 10개):${NC}"
        find .next/static/chunks -name "*.js" -type f -exec ls -lh {} \; | \
            sort -k5 -hr | head -10 | \
            awk '{printf "  %-60s %8s\n", $9, $5}'
        
        echo ""
        echo -e "${CYAN}CSS 파일:${NC}"
        find .next/static/chunks -name "*.css" -type f -exec ls -lh {} \; | \
            awk '{printf "  %-60s %8s\n", $9, $5}'
        
        echo ""
        # 총 크기 계산
        TOTAL_SIZE=$(find .next/static/chunks -name "*.js" -type f -exec stat -c%s {} \; | awk '{sum+=$1} END {print sum}')
        TOTAL_SIZE_MB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024" | bc)
        
        echo -e "${BOLD}총 JS 번들 크기: ${TOTAL_SIZE_MB} MB${NC}"
        
        if (( $(echo "$TOTAL_SIZE_MB > 1" | bc -l) )); then
            echo -e "${YELLOW}⚠️  번들 크기가 1MB를 초과합니다. 최적화를 고려하세요.${NC}"
        else
            echo -e "${GREEN}✅ 번들 크기가 적절합니다.${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  chunks 디렉토리를 찾을 수 없습니다.${NC}"
    fi
else
    echo -e "${RED}❌ .next 디렉토리가 생성되지 않았습니다.${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}🎉 번들 분석 완료!${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}💡 다음 단계:${NC}"
echo "   1. 번들 분석 결과를 확인하세요"
echo "   2. 큰 파일들을 식별하고 최적화하세요"
echo "   3. noVNC 같은 큰 의존성을 동적 로딩하세요"
echo ""






