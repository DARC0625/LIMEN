#!/bin/bash
# LIMEN 마크다운 파일 검증 스크립트
# MD 파일 위치 및 한글 작성 규칙 검증

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs"
ERRORS=0
WARNINGS=0

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((ERRORS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "LIMEN 마크다운 파일 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 루트 및 코드 폴더에 MD 파일이 있는지 확인
echo "1. MD 파일 위치 검증..."
echo "----------------------------------------"

# 허용되는 위치
ALLOWED_PATHS=(
    "$PROJECT_ROOT/README.md"
    "$PROJECT_ROOT/docs"
    "$PROJECT_ROOT/backend/README.md"
    "$PROJECT_ROOT/backend/docs"
    "$PROJECT_ROOT/scripts/README.md"
    "$PROJECT_ROOT/infra/README.md"
    "$PROJECT_ROOT/backend/tests/README.md"
)

# 루트에 있는 모든 MD 파일 찾기
ROOT_MD_FILES=$(find "$PROJECT_ROOT" -maxdepth 1 -name "*.md" -type f 2>/dev/null | grep -v "README.md" || true)

if [ -n "$ROOT_MD_FILES" ]; then
    while IFS= read -r file; do
        log_error "루트에 MD 파일 발견: $file (docs/ 폴더로 이동 필요)"
    done <<< "$ROOT_MD_FILES"
fi

# backend, scripts, config 등에 MD 파일이 있는지 확인 (README.md 제외)
for dir in backend scripts config infra; do
    if [ -d "$PROJECT_ROOT/$dir" ]; then
        MD_FILES=$(find "$PROJECT_ROOT/$dir" -name "*.md" -type f 2>/dev/null | grep -v "README.md" | grep -v "/docs/" || true)
        if [ -n "$MD_FILES" ]; then
            while IFS= read -r file; do
                log_warning "코드 폴더에 MD 파일 발견: $file (docs/ 폴더로 이동 권장)"
            done <<< "$MD_FILES"
        fi
    fi
done

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    log_success "모든 MD 파일이 올바른 위치에 있습니다"
fi

echo ""

# 2. 파일명 규칙 검증
echo "2. 파일명 규칙 검증..."
echo "----------------------------------------"

# docs 폴더 내의 모든 MD 파일 검증
if [ -d "$DOCS_DIR" ]; then
    INVALID_NAMES=$(find "$DOCS_DIR" -name "*.md" -type f | grep -E "[A-Z]|_" || true)
    
    if [ -n "$INVALID_NAMES" ]; then
        while IFS= read -r file; do
            filename=$(basename "$file")
            if [[ "$filename" =~ [A-Z] ]]; then
                log_warning "대문자 포함 파일명: $file (소문자+하이픈 형식 권장)"
            fi
            if [[ "$filename" =~ _ ]]; then
                log_warning "언더스코어 포함 파일명: $file (하이픈 사용 권장)"
            fi
        done <<< "$INVALID_NAMES"
    else
        log_success "모든 파일명이 규칙을 따릅니다"
    fi
fi

echo ""

# 3. 한글 작성 여부 검증 (간단한 휴리스틱)
echo "3. 한글 작성 여부 검증 (샘플링)..."
echo "----------------------------------------"

# docs 폴더의 주요 문서들 샘플링
SAMPLE_FILES=$(find "$DOCS_DIR" -name "*.md" -type f | head -10)

if [ -n "$SAMPLE_FILES" ]; then
    KOREAN_COUNT=0
    ENGLISH_COUNT=0
    
    while IFS= read -r file; do
        # 첫 500자에서 한글 문자 개수 확인
        content=$(head -c 500 "$file" 2>/dev/null || echo "")
        korean_chars=$(echo "$content" | grep -oP '[가-힣]' | wc -l || echo "0")
        english_chars=$(echo "$content" | grep -oP '[a-zA-Z]' | wc -l || echo "0")
        
        if [ "$korean_chars" -gt 10 ]; then
            ((KOREAN_COUNT++))
        elif [ "$english_chars" -gt "$korean_chars" ] && [ "$english_chars" -gt 50 ]; then
            log_warning "영어 위주 문서 가능성: $file"
            ((ENGLISH_COUNT++))
        fi
    done <<< "$SAMPLE_FILES"
    
    if [ $KOREAN_COUNT -gt 0 ]; then
        log_success "$KOREAN_COUNT 개 문서가 한글로 작성되어 있습니다"
    fi
fi

echo ""

# 4. 문서 구조 검증
echo "4. 문서 구조 검증..."
echo "----------------------------------------"

# docs/README.md 존재 확인
if [ ! -f "$DOCS_DIR/README.md" ]; then
    log_error "docs/README.md 파일이 없습니다"
else
    log_success "docs/README.md 존재"
fi

# MARKDOWN_GUIDE.md 존재 확인
if [ ! -f "$DOCS_DIR/MARKDOWN_GUIDE.md" ]; then
    log_warning "docs/MARKDOWN_GUIDE.md 파일이 없습니다 (가이드 생성 권장)"
else
    log_success "docs/MARKDOWN_GUIDE.md 존재"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "검증 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "오류: $ERRORS"
echo "경고: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ 모든 검증을 통과했습니다${NC}"
    exit 0
else
    echo -e "${RED}✗ 일부 검증에 실패했습니다${NC}"
    exit 1
fi

