#!/bin/bash
# LIMEN RAG 문서 동기화 스크립트
# 모든 문서는 RAG/ 폴더에서 통합 관리됩니다

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAG_DIR="$PROJECT_ROOT/RAG"
# 모든 문서는 이제 RAG/ 폴더에 직접 저장됨
DOCS_DIR="$RAG_DIR"
RAG_DOCS_DIR="$DOCS_DIR"  # 동일한 위치

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# RAG 디렉토리 초기화
init_rag_dir() {
    if [ ! -d "$RAG_DIR" ]; then
        log_info "RAG 디렉토리 생성 중..."
        mkdir -p "$RAG_DIR"/{docs,vectors,index,embeddings}
        log_success "RAG 디렉토리 생성 완료"
    fi
    
    if [ ! -d "$RAG_DOCS_DIR" ]; then
        mkdir -p "$RAG_DOCS_DIR"
    fi
}

# 문서 상태 확인
sync_documents() {
    log_info "문서 위치 확인..."
    log_info "RAG 디렉토리: $DOCS_DIR"
    
    if [ ! -d "$DOCS_DIR" ]; then
        log_error "RAG 디렉토리가 없습니다: $DOCS_DIR"
        return 1
    fi
    
    # 문서 개수 확인 (vectors, index, embeddings 제외)
    local doc_count=$(find "$DOCS_DIR" -name "*.md" -type f \
        ! -path "*/vectors/*" ! -path "*/index/*" ! -path "*/embeddings/*" | wc -l)
    log_success "문서 확인 완료: $doc_count 개 문서"
    log_info "모든 문서는 RAG/ 폴더에 직접 저장되어 있습니다"
}

# 문서 상태 확인
check_sync_status() {
    local docs_count=$(find "$DOCS_DIR" -name "*.md" -type f \
        ! -path "*/vectors/*" ! -path "*/index/*" ! -path "*/embeddings/*" | wc -l)
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "문서 상태"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "문서 위치: $DOCS_DIR (RAG/ 폴더)"
    echo "문서 개수: $docs_count 개"
    
    if [ "$docs_count" -gt 0 ]; then
        log_success "문서 상태: 정상"
    else
        log_warning "문서가 없습니다"
    fi
}

# 변경된 문서 확인
sync_changed_documents() {
    log_info "변경된 문서 확인..."
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_warning "Git 저장소가 아닙니다"
        return
    fi
    
    # Git을 사용하여 변경된 파일 확인
    local changed_files=$(git diff --name-only HEAD HEAD~1 2>/dev/null | grep "\.md$" || true)
    
    if [ -z "$changed_files" ]; then
        # 최근 커밋의 변경사항 확인
        changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep "\.md$" || true)
    fi
    
    if [ -z "$changed_files" ]; then
        log_info "변경된 문서가 없습니다"
        return
    fi
    
    local count=0
    while IFS= read -r file; do
        if [ -f "$PROJECT_ROOT/$file" ] && [[ "$file" == RAG/* ]]; then
            log_info "변경된 문서: $file"
            ((count++))
        fi
    done <<< "$changed_files"
    
    log_success "변경된 문서 확인 완료: $count 개"
    log_info "모든 문서는 RAG/ 폴더에 직접 저장되어 있습니다"
}

# 메인 실행
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "LIMEN RAG 문서 동기화"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    init_rag_dir
    
    case "${1:-all}" in
        all|status)
            check_sync_status
            ;;
        changed)
            sync_changed_documents
            ;;
        --auto)
            # 자동 모드: 변경된 문서 확인
            sync_changed_documents
            ;;
        *)
            echo "사용법: $0 {all|changed|status|--auto}"
            echo ""
            echo "  all      - 문서 상태 확인"
            echo "  changed  - 변경된 문서 확인"
            echo "  status   - 문서 상태 확인"
            echo "  --auto   - 자동 모드 (변경된 문서 확인)"
            echo ""
            echo "참고: 모든 문서는 RAG/ 폴더에 직접 저장되어 있습니다"
            exit 1
            ;;
    esac
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 스크립트 직접 실행 시
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

