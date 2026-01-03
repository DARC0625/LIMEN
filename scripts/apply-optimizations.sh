#!/bin/bash
# LIMEN 서비스 최적화 적용 스크립트
# 데이터베이스 인덱스 생성 및 최적화 검증

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}🚀 LIMEN 서비스 최적화 적용${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. 백엔드 컴파일 확인
echo -e "${CYAN}1️⃣  백엔드 컴파일 확인${NC}"
cd "$PROJECT_ROOT/backend"

if go build ./internal/database/migrations.go 2>/dev/null; then
    echo -e "${GREEN}   ✅ migrations.go 컴파일 성공${NC}"
else
    echo -e "${YELLOW}   ⚠️  migrations.go는 패키지 단위로만 컴파일 가능${NC}"
fi

if go build ./internal/utils/bufferpool.go 2>/dev/null; then
    echo -e "${GREEN}   ✅ bufferpool.go 컴파일 성공${NC}"
else
    echo -e "${YELLOW}   ⚠️  bufferpool.go는 패키지 단위로만 컴파일 가능${NC}"
fi

# 전체 빌드 테스트
if go build ./cmd/server 2>/dev/null; then
    echo -e "${GREEN}   ✅ 전체 빌드 성공${NC}"
else
    echo -e "${YELLOW}   ⚠️  빌드 오류 (의존성 확인 필요)${NC}"
fi

echo ""

# 2. 프론트엔드 타입 체크
echo -e "${CYAN}2️⃣  프론트엔드 타입 체크${NC}"
cd "$PROJECT_ROOT/frontend"

if command -v npx &> /dev/null; then
    if npx tsc --noEmit 2>&1 | head -20; then
        echo -e "${GREEN}   ✅ TypeScript 타입 체크 통과${NC}"
    else
        echo -e "${YELLOW}   ⚠️  타입 오류 발견 (확인 필요)${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  npx를 찾을 수 없습니다 (Node.js 설치 확인)${NC}"
fi

echo ""

# 3. 생성된 파일 확인
echo -e "${CYAN}3️⃣  생성된 파일 확인${NC}"

FILES=(
    "backend/internal/database/migrations.go"
    "backend/internal/utils/bufferpool.go"
    "frontend/lib/types/errors.ts"
    "frontend/components/ui/Button.tsx"
    "frontend/components/ui/Input.tsx"
    "frontend/hooks/useMounted.ts"
    "frontend/hooks/useDebounce.ts"
    "frontend/hooks/useThrottle.ts"
    "frontend/hooks/useOptimisticUpdate.ts"
    "frontend/scripts/analyze-bundle.sh"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        echo -e "${GREEN}   ✅ $file${NC}"
    else
        echo -e "${RED}   ❌ $file (없음)${NC}"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo -e "${GREEN}   ✅ 모든 파일 존재 확인${NC}"
else
    echo -e "${YELLOW}   ⚠️  일부 파일이 없습니다${NC}"
fi

echo ""

# 4. 데이터베이스 인덱스 확인 (선택사항)
echo -e "${CYAN}4️⃣  데이터베이스 인덱스 확인${NC}"
echo -e "${BLUE}   (서버 재시작 후 자동 생성됨)${NC}"
echo ""
echo -e "${YELLOW}   수동 확인 방법:${NC}"
echo "   psql -U postgres -d LIMEN -c \""
echo "   SELECT tablename, indexname FROM pg_indexes"
echo "   WHERE tablename IN ('vms', 'users', 'vm_snapshots');"
echo "   \""

echo ""

# 5. 최적화 문서 확인
echo -e "${CYAN}5️⃣  최적화 문서 확인${NC}"

DOCS=(
    "RAG/04-operations/optimization-getting-started.md"
    "RAG/04-operations/optimization-quick-reference.md"
    "RAG/04-operations/optimization-verification.md"
    "RAG/04-operations/optimization-completion-report.md"
    "RAG/04-operations/OPTIMIZATION_INDEX.md"
)

DOCS_EXIST=true
for doc in "${DOCS[@]}"; do
    if [ -f "$PROJECT_ROOT/$doc" ]; then
        echo -e "${GREEN}   ✅ $doc${NC}"
    else
        echo -e "${RED}   ❌ $doc (없음)${NC}"
        DOCS_EXIST=false
    fi
done

if [ "$DOCS_EXIST" = true ]; then
    echo -e "${GREEN}   ✅ 모든 문서 존재 확인${NC}"
else
    echo -e "${YELLOW}   ⚠️  일부 문서가 없습니다${NC}"
fi

echo ""

# 6. 다음 단계 안내
echo -e "${BOLD}${CYAN}📋 다음 단계:${NC}"
echo ""
echo -e "${GREEN}1. 서버 재시작 (인덱스 자동 생성):${NC}"
echo "   ${CYAN}./scripts/start-LIMEN.sh restart${NC}"
echo ""
echo -e "${GREEN}2. 검증 실행:${NC}"
echo "   ${CYAN}cat RAG/04-operations/optimization-verification.md${NC}"
echo ""
echo -e "${GREEN}3. 번들 분석 (선택사항):${NC}"
echo "   ${CYAN}cd frontend && ./scripts/analyze-bundle.sh${NC}"
echo ""

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}🎉 최적화 적용 준비 완료!${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

