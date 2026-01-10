#!/bin/bash
# LIMEN 변경사항 RAG 기록 스크립트
# 코드/설정 변경 시 자동으로 RAG 문서에 기록

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAG_DIR="$PROJECT_ROOT/RAG"
CHANGELOG="$RAG_DIR/CHANGELOG.md"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 사용법
usage() {
    echo "사용법: $0 [옵션] <변경 내용>"
    echo ""
    echo "옵션:"
    echo "  -t, --type TYPE      변경 유형 (architecture|development|api|operations|frontend|config)"
    echo "  -f, --file FILE      변경된 파일 경로"
    echo "  -d, --description     상세 설명 (여러 줄 가능, EOF로 종료)"
    echo "  -a, --auto           Git 변경사항 자동 감지"
    echo "  -h, --help           도움말"
    echo ""
    echo "예시:"
    echo "  $0 -t api -f backend/internal/handlers/vm.go 'VM 생성 API 수정'"
    echo "  $0 -a  # Git 변경사항 자동 감지"
    exit 1
}

# CHANGELOG 초기화
init_changelog() {
    if [ ! -f "$CHANGELOG" ]; then
        cat > "$CHANGELOG" << 'EOF'
# LIMEN 변경 이력 (CHANGELOG)

이 파일은 LIMEN 프로젝트의 모든 변경사항을 기록합니다.
모든 코드, 설정, 문서 변경은 여기에 기록되어야 합니다.

## 기록 규칙

1. **모든 변경사항 기록**: 코드, 설정, 스크립트, 문서 변경 모두 기록
2. **날짜별 정렬**: 최신 변경사항이 위에 오도록
3. **유형별 분류**: architecture, development, api, operations, frontend, config
4. **상세 설명**: 무엇을, 왜, 어떻게 변경했는지 명확히 기록

---

EOF
    fi
}

# 변경사항 기록
record_change() {
    local type="$1"
    local file="$2"
    local description="$3"
    local date=$(date +"%Y-%m-%d %H:%M:%S")
    
    # 유형별 폴더 매핑
    case "$type" in
        architecture) folder="01-architecture" ;;
        development) folder="02-development" ;;
        api) folder="03-api" ;;
        operations) folder="04-operations" ;;
        frontend) folder="05-frontend" ;;
        config) folder="04-operations/config" ;;
        *) folder="04-operations" ;;
    esac
    
    # CHANGELOG에 기록
    init_changelog
    
    # 임시 파일에 새 항목 추가
    local temp_file=$(mktemp)
    cat > "$temp_file" << EOF
## $date - $type

**파일**: \`$file\`

**변경 내용**:
$description

---

EOF
    
    # 기존 내용 앞에 추가
    cat "$temp_file" "$CHANGELOG" > "${CHANGELOG}.tmp"
    mv "${CHANGELOG}.tmp" "$CHANGELOG"
    rm -f "$temp_file"
    
    echo -e "${GREEN}✅ 변경사항이 CHANGELOG에 기록되었습니다${NC}"
    echo -e "${BLUE}   위치: $CHANGELOG${NC}"
    
    # 관련 문서 폴더에 상세 문서 생성 (선택사항)
    if [ -d "$RAG_DIR/$folder" ]; then
        echo -e "${CYAN}💡 관련 문서 폴더: $RAG_DIR/$folder/${NC}"
        echo -e "${YELLOW}   필요시 상세 문서를 추가하세요${NC}"
    fi
}

# Git 변경사항 자동 감지
auto_detect() {
    echo -e "${BLUE}🔍 Git 변경사항 자동 감지 중...${NC}"
    echo ""
    
    # 스테이징된 파일 확인
    staged_files=$(git diff --cached --name-only 2>/dev/null || true)
    
    # 수정된 파일 확인
    modified_files=$(git diff --name-only 2>/dev/null || true)
    
    if [ -z "$staged_files" ] && [ -z "$modified_files" ]; then
        echo -e "${YELLOW}⚠️  변경된 파일이 없습니다${NC}"
        exit 0
    fi
    
    echo -e "${CYAN}📝 변경된 파일:${NC}"
    [ -n "$staged_files" ] && echo "$staged_files" | sed 's/^/   [스테이징] /'
    [ -n "$modified_files" ] && echo "$modified_files" | sed 's/^/   [수정] /'
    echo ""
    
    # 파일 유형별로 분류
    for file in $staged_files $modified_files; do
        if [ -z "$file" ]; then continue; fi
        
        # 유형 자동 감지
        type=""
        if echo "$file" | grep -qE "^backend/"; then
            if echo "$file" | grep -qE "(handlers|routes|api)"; then
                type="api"
            else
                type="development"
            fi
        elif echo "$file" | grep -qE "^scripts/"; then
            type="operations"
        elif echo "$file" | grep -qE "\.(json|yaml|yml|env|config)"; then
            type="config"
        elif echo "$file" | grep -qE "^infra/"; then
            type="operations"
        else
            type="development"
        fi
        
        # 간단한 설명 생성
        description="파일 변경: \`$file\`"
        
        echo -e "${BLUE}📝 기록 중: $file (유형: $type)${NC}"
        record_change "$type" "$file" "$description"
        echo ""
    done
    
    echo -e "${GREEN}✅ 모든 변경사항이 기록되었습니다${NC}"
}

# 메인 로직
TYPE=""
FILE=""
DESCRIPTION=""
AUTO=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TYPE="$2"
            shift 2
            ;;
        -f|--file)
            FILE="$2"
            shift 2
            ;;
        -d|--description)
            # 여러 줄 입력 받기
            DESCRIPTION=""
            shift
            while IFS= read -r line; do
                if [ "$line" = "EOF" ]; then
                    break
                fi
                DESCRIPTION="${DESCRIPTION}${line}"$'\n'
            done
            ;;
        -a|--auto)
            AUTO=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$DESCRIPTION" ]; then
                DESCRIPTION="$1"
            else
                DESCRIPTION="${DESCRIPTION} $1"
            fi
            shift
            ;;
    esac
done

if [ "$AUTO" = true ]; then
    auto_detect
    exit 0
fi

if [ -z "$TYPE" ] || [ -z "$FILE" ] || [ -z "$DESCRIPTION" ]; then
    echo -e "${RED}❌ 오류: 유형, 파일, 설명이 필요합니다${NC}"
    echo ""
    usage
fi

record_change "$TYPE" "$FILE" "$DESCRIPTION"

# RAG 인덱싱 자동 실행
if [ -f "$PROJECT_ROOT/scripts/rag-index.sh" ]; then
    echo ""
    echo -e "${BLUE}🔄 RAG 인덱싱 실행 중...${NC}"
    "$PROJECT_ROOT/scripts/rag-index.sh" || {
        echo -e "${YELLOW}⚠️  RAG 인덱싱 실패 (수동 실행 가능)${NC}"
    }
fi







