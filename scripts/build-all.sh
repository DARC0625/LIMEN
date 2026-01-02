#!/bin/bash
# LIMEN 통합 빌드 스크립트
# 백엔드 + 에이전트 빌드

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
AGENT_DIR="$BACKEND_DIR/agent"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[BUILD]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 백엔드 빌드
build_backend() {
    log "Building backend..."
    cd "$BACKEND_DIR"
    
    # Go 모듈 정리
    go mod tidy
    go mod verify
    
    # 최적화된 빌드
    go build -ldflags="-s -w" -trimpath -o server ./cmd/server
    
    if [ -f "server" ]; then
        local size=$(du -h server | cut -f1)
        log "Backend built successfully (size: $size)"
        return 0
    else
        error "Backend build failed"
        return 1
    fi
}

# 에이전트 빌드
build_agent() {
    log "Building agent..."
    cd "$AGENT_DIR"
    
    # Cargo 업데이트
    cargo update
    
    # 릴리즈 빌드
    cargo build --release
    
    if [ -f "target/release/agent" ]; then
        local size=$(du -h target/release/agent | cut -f1)
        log "Agent built successfully (size: $size)"
        return 0
    else
        error "Agent build failed"
        return 1
    fi
}

# 전체 빌드
build_all() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Building LIMEN (Backend + Agent)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    build_backend
    build_agent
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "All builds complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 정리
clean() {
    log "Cleaning build artifacts..."
    cd "$BACKEND_DIR"
    rm -f server
    rm -rf logs/*.log
    rm -rf pids/*.pid
    
    cd "$AGENT_DIR"
    cargo clean
    
    log "Clean complete"
}

# 메인 로직
case "${1:-all}" in
    backend)
        build_backend
        ;;
    agent)
        build_agent
        ;;
    all)
        build_all
        ;;
    clean)
        clean
        ;;
    *)
        echo "Usage: $0 {backend|agent|all|clean}"
        echo ""
        echo "Commands:"
        echo "  backend - Build backend only"
        echo "  agent   - Build agent only"
        echo "  all     - Build both (default)"
        echo "  clean   - Clean build artifacts"
        exit 1
        ;;
esac


