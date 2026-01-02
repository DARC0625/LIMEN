#!/bin/bash
# LIMEN 백엔드 서버 배포 스크립트
# 백엔드 코드와 RAG 문서만 포함하여 배포

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 배포 디렉토리는 /tmp에 생성하여 루트를 깔끔하게 유지
DEPLOY_DIR="${DEPLOY_DIR:-/tmp/limen-deploy-backend-$$}"
RAG_DIR="$PROJECT_ROOT/RAG"

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

# 배포 디렉토리 초기화
init_deploy_dir() {
    log_info "배포 디렉토리 초기화: $DEPLOY_DIR"
    
    # 기존 배포 디렉토리 제거
    if [ -d "$DEPLOY_DIR" ]; then
        log_warning "기존 배포 디렉토리 제거 중..."
        rm -rf "$DEPLOY_DIR"
    fi
    
    mkdir -p "$DEPLOY_DIR"
}

# 백엔드 코드 복사
copy_backend() {
    log_info "백엔드 코드 복사 중..."
    
    # backend/ 폴더 전체 복사
    cp -r "$PROJECT_ROOT/backend" "$DEPLOY_DIR/"
    
    # 불필요한 파일 제거
    find "$DEPLOY_DIR/backend" -type f -name "*.test" -delete 2>/dev/null || true
    find "$DEPLOY_DIR/backend" -type d -name "testdata" -exec rm -rf {} + 2>/dev/null || true
    
    log_success "백엔드 코드 복사 완료"
}

# RAG 문서 복사 (공유)
copy_rag() {
    log_info "RAG 문서 복사 중..."
    
    # RAG 폴더 생성
    mkdir -p "$DEPLOY_DIR/RAG"
    
    # 문서만 복사 (vectors, index, embeddings 제외)
    rsync -av --exclude='vectors' --exclude='index' --exclude='embeddings' \
        "$RAG_DIR/" "$DEPLOY_DIR/RAG/" || {
        # rsync가 없으면 수동 복사
        cp -r "$RAG_DIR"/*.md "$DEPLOY_DIR/RAG/" 2>/dev/null || true
        cp -r "$RAG_DIR"/01-architecture "$DEPLOY_DIR/RAG/" 2>/dev/null || true
        cp -r "$RAG_DIR"/02-development "$DEPLOY_DIR/RAG/" 2>/dev/null || true
        cp -r "$RAG_DIR"/03-deployment "$DEPLOY_DIR/RAG/" 2>/dev/null || true
        cp -r "$RAG_DIR"/04-operations "$DEPLOY_DIR/RAG/" 2>/dev/null || true
        cp -r "$RAG_DIR"/05-frontend "$DEPLOY_DIR/RAG/" 2>/dev/null || true
        cp -r "$RAG_DIR"/99-archive "$DEPLOY_DIR/RAG/" 2>/dev/null || true
        mkdir -p "$DEPLOY_DIR/RAG"/{vectors,index,embeddings}
    }
    
    log_success "RAG 문서 복사 완료"
}

# 필수 설정 파일 복사
copy_config() {
    log_info "설정 파일 복사 중..."
    
    # .env.example 복사
    if [ -f "$PROJECT_ROOT/backend/env.example" ]; then
        cp "$PROJECT_ROOT/backend/env.example" "$DEPLOY_DIR/backend/"
    fi
    
    # docker-compose.yml 복사 (백엔드 관련만)
    if [ -f "$PROJECT_ROOT/infra/docker/docker-compose.yml" ]; then
        mkdir -p "$DEPLOY_DIR/infra/docker"
        cp "$PROJECT_ROOT/infra/docker/docker-compose.yml" "$DEPLOY_DIR/infra/docker/"
        cp "$PROJECT_ROOT/infra/docker/.dockerignore" "$DEPLOY_DIR/infra/docker/" 2>/dev/null || true
    fi
    
    log_success "설정 파일 복사 완료"
}

# 스크립트 복사 (백엔드 관련만)
copy_scripts() {
    log_info "스크립트 복사 중..."
    
    mkdir -p "$DEPLOY_DIR/scripts"
    
    # 백엔드 관련 스크립트만 복사
    cp "$PROJECT_ROOT/scripts/start-LIMEN.sh" "$DEPLOY_DIR/scripts/" 2>/dev/null || true
    cp "$PROJECT_ROOT/scripts/LIMEN-control.sh" "$DEPLOY_DIR/scripts/" 2>/dev/null || true
    cp "$PROJECT_ROOT/scripts/rag-index.sh" "$DEPLOY_DIR/scripts/" 2>/dev/null || true
    cp "$PROJECT_ROOT/scripts/sync-rag-docs.sh" "$DEPLOY_DIR/scripts/" 2>/dev/null || true
    cp "$PROJECT_ROOT/scripts/limen.service" "$DEPLOY_DIR/scripts/" 2>/dev/null || true
    cp "$PROJECT_ROOT/scripts/install_service.sh" "$DEPLOY_DIR/scripts/" 2>/dev/null || true
    
    # 실행 권한 부여
    chmod +x "$DEPLOY_DIR/scripts"/*.sh 2>/dev/null || true
    
    log_success "스크립트 복사 완료"
}

# 보안 검증
verify_security() {
    log_info "보안 검증 중..."
    
    local violations=0
    
    # 프론트엔드 폴더 확인
    if [ -d "$DEPLOY_DIR/frontend" ]; then
        log_error "보안 위협: 프론트엔드 폴더가 포함되어 있습니다!"
        ((violations++))
    fi
    
    # 프론트엔드 관련 파일 확인 (엄격한 검증)
    # backend/ 폴더 내의 파일은 예외 (PM2 설정 등)
    local frontend_files=$(find "$DEPLOY_DIR" -type f \( \
        -name "package.json" \
        -o -name "package-lock.json" \
        -o -name "yarn.lock" \
        -o -name "pnpm-lock.yaml" \
        -o -name "next.config.js" \
        -o -name "next.config.ts" \
        -o -name "tailwind.config.js" \
        -o -name "tailwind.config.ts" \
        -o -name "tsconfig.json" \
        -o -name "jsconfig.json" \
        -o -name ".eslintrc*" \
        -o -name "postcss.config.js" \
        -o -name "babel.config.js" \
    \) 2>/dev/null | grep -v "backend" | head -10)
    
    # 프론트엔드 관련 JS/TS 파일 확인 (backend 폴더 제외)
    local frontend_js_files=$(find "$DEPLOY_DIR" -type f \( \
        -name "*.js" \
        -o -name "*.ts" \
        -o -name "*.tsx" \
        -o -name "*.jsx" \
    \) 2>/dev/null | grep -v "backend" | grep -v "ecosystem.config.js" | head -10)
    
    if [ -n "$frontend_js_files" ]; then
        frontend_files="$frontend_files"$'\n'"$frontend_js_files"
    fi
    
    if [ -n "$frontend_files" ]; then
        log_error "보안 위협: 프론트엔드 관련 파일이 포함되어 있습니다!"
        echo "$frontend_files" | while read -r file; do
            log_error "  - $file"
        done
        ((violations++))
    fi
    
    # node_modules 확인
    if find "$DEPLOY_DIR" -type d -name "node_modules" | grep -q .; then
        log_error "보안 위협: node_modules 폴더가 포함되어 있습니다!"
        ((violations++))
    fi
    
    # .next 빌드 폴더 확인
    if find "$DEPLOY_DIR" -type d -name ".next" | grep -q .; then
        log_error "보안 위협: .next 빌드 폴더가 포함되어 있습니다!"
        ((violations++))
    fi
    
    if [ $violations -eq 0 ]; then
        log_success "보안 검증 통과: 프론트엔드 관련 파일이 전혀 포함되지 않았습니다"
        return 0
    else
        log_error "보안 검증 실패: $violations 개의 위협 발견"
        return 1
    fi
}

# 배포 패키지 생성
create_package() {
    log_info "배포 패키지 생성 중..."
    
    local package_name="limen-backend-$(date +%Y%m%d-%H%M%S).tar.gz"
    local package_path="/tmp/$package_name"
    
    cd /tmp
    tar -czf "$package_path" -C "$DEPLOY_DIR" .
    
    log_success "배포 패키지 생성 완료: $package_name"
    log_info "패키지 위치: $package_path"
    echo "패키지 크기: $(du -h "$package_path" | cut -f1)"
    echo ""
    echo "패키지를 이동하려면:"
    echo "  mv $package_path ."
}

# 메인 실행
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "LIMEN 백엔드 서버 배포"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    init_deploy_dir
    copy_backend
    copy_rag
    copy_config
    copy_scripts
    
    echo ""
    log_info "배포 디렉토리 구조:"
    tree -L 2 "$DEPLOY_DIR" 2>/dev/null || find "$DEPLOY_DIR" -maxdepth 2 -type d | head -20
    
    echo ""
    if verify_security; then
        if [ "${1:-}" = "--package" ]; then
            create_package
        fi
        
        log_success "백엔드 배포 준비 완료!"
        log_info "배포 디렉토리: $DEPLOY_DIR"
    else
        log_error "보안 검증 실패로 배포를 중단합니다"
        exit 1
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 스크립트 직접 실행 시
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

