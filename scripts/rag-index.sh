#!/bin/bash
# LIMEN RAG 인덱싱 스크립트
# 문서를 벡터 데이터베이스에 인덱싱하여 RAG 시스템 구축

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAG_DIR="${RAG_PATH:-$PROJECT_ROOT/RAG}"
# 모든 문서는 이제 RAG/ 폴더에 직접 저장됨
DOCS_DIR="$RAG_DIR"
RAG_DOCS_DIR="$DOCS_DIR"  # 동일한 위치
VECTOR_DB_DIR="$RAG_DIR/vectors"
INDEX_FILE="$RAG_DIR/index/index.json"

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
    # RAG/ 자체가 문서 폴더이므로 docs 서브폴더는 생성하지 않음
    mkdir -p "$RAG_DIR"/{vectors,index,embeddings}
    mkdir -p "$VECTOR_DB_DIR"
    
    if [ ! -f "$INDEX_FILE" ]; then
        mkdir -p "$(dirname "$INDEX_FILE")"
        echo '{"documents": [], "last_updated": null}' > "$INDEX_FILE"
    fi
    
    # 문서 디렉토리 확인 (vectors, index, embeddings 제외)
    local doc_files=$(find "$DOCS_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l)
    local doc_dirs=$(find "$DOCS_DIR" -maxdepth 1 -type d ! -name "$(basename "$DOCS_DIR")" ! -name "vectors" ! -name "index" ! -name "embeddings" 2>/dev/null | wc -l)
    
    if [ "$doc_files" -eq 0 ] && [ "$doc_dirs" -eq 0 ]; then
        log_error "문서가 없습니다: $DOCS_DIR"
        return 1
    fi
}

# 문서 청크 분할
chunk_document() {
    local file="$1"
    local content=$(cat "$file")
    local max_chunk_size=1000  # 문자 수
    
    # 마크다운 섹션 단위로 분할
    local chunks=()
    local current_chunk=""
    local current_size=0
    
    while IFS= read -r line; do
        # 섹션 헤더 감지 (#으로 시작)
        if [[ "$line" =~ ^#+ ]]; then
            # 현재 청크가 있으면 저장
            if [ -n "$current_chunk" ]; then
                chunks+=("$current_chunk")
            fi
            current_chunk="$line"$'\n'
            current_size=${#current_chunk}
        else
            current_chunk+="$line"$'\n'
            current_size=${#current_chunk}
            
            # 최대 크기 초과 시 분할
            if [ $current_size -gt $max_chunk_size ]; then
                chunks+=("$current_chunk")
                current_chunk=""
                current_size=0
            fi
        fi
    done <<< "$content"
    
    # 마지막 청크 추가
    if [ -n "$current_chunk" ]; then
        chunks+=("$current_chunk")
    fi
    
    # 청크 배열 반환 (임시 파일 사용)
    local temp_file=$(mktemp)
    printf '%s\n' "${chunks[@]}" > "$temp_file"
    echo "$temp_file"
}

# 문서 메타데이터 추출
extract_metadata() {
    local file="$1"
    # RAG 디렉토리 기준으로 경로 계산
    local relative_path="${file#$RAG_DOCS_DIR/}"
    if [ "$relative_path" = "$file" ]; then
        # RAG 디렉토리가 아니면 전체 경로 사용
        relative_path="$file"
    fi
    
    # 파일 정보
    local title=$(head -1 "$file" | sed 's/^# *//')
    local size=$(wc -c < "$file")
    local modified=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)
    
    # 카테고리 추출 (경로 기반)
    local category=""
    if [[ "$relative_path" == 01-architecture/* ]]; then
        category="architecture"
    elif [[ "$relative_path" == 02-development/* ]]; then
        category="development"
    elif [[ "$relative_path" == 03-deployment/* ]]; then
        category="deployment"
    elif [[ "$relative_path" == 04-operations/* ]]; then
        category="operations"
    elif [[ "$relative_path" == 05-frontend/* ]]; then
        category="frontend"
    elif [[ "$relative_path" == 99-archive/* ]]; then
        category="archive"
    fi
    
    cat <<EOF
{
  "path": "$relative_path",
  "title": "$title",
  "size": $size,
  "modified": $modified,
  "category": "$category"
}
EOF
}

# 문서 인덱싱
index_document() {
    local file="$1"
    # RAG 디렉토리 기준으로 경로 계산
    local relative_path="${file#$RAG_DOCS_DIR/}"
    if [ "$relative_path" = "$file" ]; then
        # RAG 디렉토리가 아니면 전체 경로 사용
        relative_path="$file"
    fi
    
    log_info "인덱싱: $relative_path"
    
    # 메타데이터 추출
    local metadata=$(extract_metadata "$file")
    
    # 문서 청크 분할
    local chunks_file=$(chunk_document "$file")
    local chunk_count=$(wc -l < "$chunks_file")
    
    # 벡터 임베딩 생성 (향후 LLM API 연동)
    # 현재는 메타데이터만 저장
    local vector_file="$VECTOR_DB_DIR/$(echo "$relative_path" | tr '/' '_' | tr ' ' '_').json"
    
    cat <<EOF > "$vector_file"
{
  "metadata": $metadata,
  "chunks": $chunk_count,
  "indexed_at": $(date +%s)
}
EOF
    
    rm -f "$chunks_file"
    
    log_success "인덱싱 완료: $relative_path"
}

# 전체 문서 인덱싱
index_all_documents() {
    log_info "전체 문서 인덱싱 시작..."
    log_info "RAG 디렉토리: $RAG_DOCS_DIR"
    
    # RAG 디렉토리에서 인덱싱 (vectors, index, embeddings 제외)
    if [ ! -d "$RAG_DOCS_DIR" ]; then
        log_error "RAG 디렉토리가 없습니다: $RAG_DOCS_DIR"
        return 1
    fi
    
    local count=0
    while IFS= read -r file; do
        # vectors, index, embeddings 폴더 제외
        if [[ "$file" != *"/vectors/"* ]] && [[ "$file" != *"/index/"* ]] && [[ "$file" != *"/embeddings/"* ]]; then
            index_document "$file"
            ((count++))
        fi
    done < <(find "$RAG_DOCS_DIR" -name "*.md" -type f)
    
    # 인덱스 파일 업데이트
    local index_data=$(cat <<EOF
{
  "documents": $count,
  "last_updated": $(date +%s),
  "vector_db": "$VECTOR_DB_DIR"
}
EOF
)
    echo "$index_data" > "$INDEX_FILE"
    
    log_success "전체 인덱싱 완료: $count 개 문서"
}

# 변경된 문서만 인덱싱
index_changed_documents() {
    log_info "변경된 문서 인덱싱..."
    
    # Git을 사용하여 변경된 파일 확인
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_warning "Git 저장소가 아니므로 전체 인덱싱 수행"
        index_all_documents
        return
    fi
    
    local changed_files=$(git diff --name-only HEAD HEAD~1 2>/dev/null | grep "\.md$" || true)
    
    if [ -z "$changed_files" ]; then
        log_info "변경된 문서가 없습니다"
        return
    fi
    
    local count=0
    while IFS= read -r file; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            index_document "$PROJECT_ROOT/$file"
            ((count++))
        fi
    done <<< "$changed_files"
    
    log_success "변경된 문서 인덱싱 완료: $count 개"
}

# RAG 검색 (간단한 버전)
search_rag() {
    local query="$1"
    
    log_info "RAG 검색: $query"
    
    # 간단한 텍스트 검색 (vectors, index, embeddings 제외)
    local results=$(grep -r -l "$query" "$RAG_DOCS_DIR" --include="*.md" \
        --exclude-dir="vectors" --exclude-dir="index" --exclude-dir="embeddings" 2>/dev/null | head -10)
    
    if [ -z "$results" ]; then
        log_warning "검색 결과가 없습니다"
        return
    fi
    
    echo "검색 결과:"
    echo "$results" | while read -r file; do
        local relative_path="${file#$DOCS_DIR/}"
        echo "  - $relative_path"
    done
}

# 메인 실행
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "LIMEN RAG 인덱싱"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    init_rag_dir
    
    case "${1:-all}" in
        all)
            index_all_documents
            ;;
        changed)
            index_changed_documents
            ;;
        search)
            if [ -z "$2" ]; then
                log_error "검색어를 입력하세요: $0 search <query>"
                exit 1
            fi
            search_rag "$2"
            ;;
        --auto)
            # 자동 모드: 변경된 문서만 인덱싱
            index_changed_documents
            ;;
        *)
            echo "사용법: $0 {all|changed|search|--auto}"
            echo ""
            echo "  all      - 전체 문서 인덱싱"
            echo "  changed  - 변경된 문서만 인덱싱"
            echo "  search   - 문서 검색"
            echo "  --auto   - 자동 모드 (변경된 문서만)"
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

