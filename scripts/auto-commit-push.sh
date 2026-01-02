#!/bin/bash
# LIMEN 자동 커밋 및 푸시 스크립트
# AI 작업 완료 시 자동으로 커밋하고 푸시합니다

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

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

# Git 상태 확인
check_git_status() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Git 저장소가 아닙니다"
        return 1
    fi
    
    # 변경사항 확인
    if git diff --quiet && git diff --cached --quiet; then
        log_info "커밋할 변경사항이 없습니다"
        return 1
    fi
    
    return 0
}

# 변경된 파일 목록 가져오기
get_changed_files() {
    git status --short | awk '{print $2}' | head -10
}

# 커밋 메시지 생성
generate_commit_message() {
    local changed_files=$(get_changed_files | tr '\n' ' ')
    local file_count=$(git status --short | wc -l)
    
    # 변경 유형 감지
    local has_docs=false
    local has_code=false
    local has_config=false
    
    for file in $(get_changed_files); do
        if [[ "$file" == RAG/* ]] || [[ "$file" == *.md ]]; then
            has_docs=true
        elif [[ "$file" == backend/* ]] || [[ "$file" == frontend/* ]]; then
            has_code=true
        elif [[ "$file" == scripts/* ]] || [[ "$file" == config/* ]] || [[ "$file" == *.sh ]]; then
            has_config=true
        fi
    done
    
    # 커밋 메시지 생성
    local message="🤖 AI 작업 완료"
    
    if [ "$has_docs" = true ]; then
        message="$message - 문서 업데이트"
    fi
    if [ "$has_code" = true ]; then
        message="$message - 코드 변경"
    fi
    if [ "$has_config" = true ]; then
        message="$message - 설정 변경"
    fi
    
    message="$message\n\n변경된 파일: $file_count개"
    message="$message\n주요 변경: $changed_files"
    message="$message\n\n자동 커밋: $(date '+%Y-%m-%d %H:%M:%S')"
    
    echo -e "$message"
}

# 자동 커밋 및 푸시
auto_commit_and_push() {
    log_info "자동 커밋 및 푸시 시작..."
    
    # Git 상태 확인
    if ! check_git_status; then
        return 0
    fi
    
    # 변경사항 스테이징
    log_info "변경사항 스테이징 중..."
    git add -A
    
    # 커밋 메시지 생성
    local commit_message=$(generate_commit_message)
    
    # 커밋
    log_info "커밋 중..."
    git commit -m "$commit_message" || {
        log_error "커밋 실패"
        return 1
    }
    
    log_success "커밋 완료"
    
    # 현재 브랜치 확인
    local current_branch=$(git branch --show-current)
    log_info "현재 브랜치: $current_branch"
    
    # 푸시
    log_info "원격 저장소로 푸시 중..."
    if git push origin "$current_branch"; then
        log_success "푸시 완료: $current_branch"
        
        # 문서 동기화 트리거 (다른 서버에 알림)
        trigger_doc_sync
        
        return 0
    else
        log_error "푸시 실패"
        return 1
    fi
}

# 문서 동기화 트리거
trigger_doc_sync() {
    log_info "문서 동기화 트리거..."
    
    # 백엔드 서버 문서 동기화 (SSH 또는 HTTP API)
    if [ -n "$BACKEND_SYNC_URL" ]; then
        log_info "백엔드 서버에 문서 동기화 요청..."
        curl -X POST "$BACKEND_SYNC_URL/api/docs/sync" \
            -H "Content-Type: application/json" \
            -d '{"source":"git","branch":"'$(git branch --show-current)'"}' \
            --silent --show-error || log_warning "백엔드 동기화 요청 실패"
    fi
    
    # 프론트엔드 서버 문서 동기화
    if [ -n "$FRONTEND_SYNC_URL" ]; then
        log_info "프론트엔드 서버에 문서 동기화 요청..."
        curl -X POST "$FRONTEND_SYNC_URL/api/docs/sync" \
            -H "Content-Type: application/json" \
            -d '{"source":"git","branch":"'$(git branch --show-current)'"}' \
            --silent --show-error || log_warning "프론트엔드 동기화 요청 실패"
    fi
    
    # RAG 인덱싱 트리거 (문서는 이미 RAG/에 있으므로 동기화 불필요)
    if [ -f "$PROJECT_ROOT/scripts/rag-index.sh" ]; then
        log_info "RAG 인덱싱 트리거..."
        "$PROJECT_ROOT/scripts/rag-index.sh" --auto || log_warning "RAG 인덱싱 실패"
    fi
}

# 메인 실행
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "LIMEN 자동 커밋 및 푸시"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    auto_commit_and_push
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 스크립트 직접 실행 시
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

