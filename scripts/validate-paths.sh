#!/bin/bash
# LIMEN 경로 검증 스크립트
# 잘못된 경로 참조를 찾아서 알려줍니다

set -e

LIMEN_ROOT="/home/darc0/LIMEN"
WRONG_PATHS=(
    "/home/darc0/limen"
    "/home/darc0/projects/LIMEN"
    "/path/to/LIMEN"
    "/path/to/limen"
)

echo "🔍 LIMEN 경로 검증 중..."
echo "올바른 경로: $LIMEN_ROOT"
echo ""

ERRORS=0

# 잘못된 경로 참조 검색 (문서 파일, 마이그레이션 코드, .gitignore는 제외)
for wrong_path in "${WRONG_PATHS[@]}"; do
    echo "검색 중: $wrong_path"
    results=$(grep -r "$wrong_path" "$LIMEN_ROOT" \
        --exclude-dir=.git \
        --exclude-dir=node_modules \
        --exclude-dir=target \
        --exclude-dir=.next \
        --exclude="*.md" \
        --exclude="validate-paths.sh" \
        --exclude="*.example" \
        --exclude=".gitignore" \
        2>/dev/null | \
        grep -v "path migration\|Handle path migration\|Migrated image path\|strings.Contains\|strings.Replace" | \
        grep -v "RAG/.*\.md" | \
        grep -v "^#.*limen" | \
        head -5)
    
    if [ -n "$results" ]; then
        echo "$results"
        echo "⚠️  경고: 잘못된 경로 발견: $wrong_path"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ 모든 경로가 올바릅니다!"
    exit 0
else
    echo "❌ $ERRORS 개의 잘못된 경로 참조가 발견되었습니다."
    echo "위의 파일들을 확인하고 수정해주세요."
    exit 1
fi

