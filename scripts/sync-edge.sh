#!/usr/bin/env bash
set -euo pipefail

# Edge 서버 동기화 스크립트
# 목적: Edge 서버 전용 (프론트 서버 / 외부 노출)
# 포함 폴더: frontend/ (EDGE ONLY), config/, infra/, scripts/, RAG/ (필수), shared/
# 정책:
#   - POLICY:D0: RAG=docs 정책 (모든 문서는 RAG/ 아래, 양쪽 서버 필수)
#   - POLICY:D1: src 분리 정책 (root src/ 금지, frontend/src와 backend/src로 분리)

REPO_DIR="${REPO_DIR:-/opt/limen/repo}"
LOG_FILE="${LOG_FILE:-/var/log/limen/sync-edge.log}"

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== Edge 서버 동기화 시작 ==="

# 리포지토리 디렉토리로 이동
if [ ! -d "$REPO_DIR" ]; then
    log "[ERROR] Repository directory not found: $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"

# Git 저장소인지 확인
if [ ! -d ".git" ]; then
    log "[ERROR] Not a git repository: $REPO_DIR"
    exit 1
fi

# 원격 저장소에서 최신 변경사항 가져오기
log "Fetching latest changes from origin/main..."
git fetch origin main || {
    log "[ERROR] Failed to fetch from origin/main"
    exit 1
}

# 현재 브랜치 확인
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "Current branch: $CURRENT_BRANCH"

# main 브랜치로 리셋 (hard reset)
log "Resetting to origin/main..."
git reset --hard origin/main || {
    log "[ERROR] Failed to reset to origin/main"
    exit 1
}

# Sparse checkout 설정 확인 및 업데이트
log "Updating sparse-checkout configuration..."
if ! git sparse-checkout list > /dev/null 2>&1; then
    log "Initializing sparse-checkout..."
    git sparse-checkout init --cone
fi

# Edge 서버에 필요한 경로만 설정 (POLICY:D0 - RAG=docs 정책 반영)
# ⚠️ .github/, .vscode/는 서버 배포 시 제외 (CI/DEV 전용)
# ✅ 포함: frontend, config, infra, scripts, RAG
# ❌ 제외: backend, .github, .vscode
git sparse-checkout set \
    frontend \
    config \
    infra \
    scripts \
    RAG

# 게이트: Edge 서버에 존재하면 안 되는 폴더들
# 정책: Edge 서버는 frontend만 포함하고, backend 코드나 루트 src/는 금지
for forbidden in "backend" "src"; do
    if [ -d "$forbidden" ]; then
        log "[FATAL][POLICY:D1] $forbidden/ exists on EDGE server. Aborting."
        case "$forbidden" in
            "backend")
                log "[FATAL][POLICY:D1] This violates security policy: backend code must not be on edge servers."
                ;;
            "src")
                log "[FATAL][POLICY:D1] root src/ exists. Must be split into frontend/src and backend/src."
                ;;
        esac
        exit 1
    fi
done

# Sparse checkout 적용 확인
log "Verifying sparse-checkout..."
CHECKOUT_PATHS=$(git sparse-checkout list)
log "Checked out paths:"
echo "$CHECKOUT_PATHS" | while read -r path; do
    log "  - $path"
done

# 필수 디렉토리 존재 확인
REQUIRED_DIRS=("frontend" "config" "infra" "scripts" "RAG")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        log "[ERROR] Required directory missing: $dir"
        exit 1
    fi
done

# shared는 선택사항 (없을 수 있음)
if [ ! -d "shared" ]; then
    log "[INFO] shared directory not found (optional, may not exist)"
fi

log "[OK] Sparse-checkout verification passed"

# 클린업: 허용 목록 외 파일/디렉토리 제거
log "Running cleanup to remove non-allowed files..."
if [ -f "$REPO_DIR/scripts/edge/cleanup-edge-server.sh" ]; then
    bash "$REPO_DIR/scripts/edge/cleanup-edge-server.sh" "$REPO_DIR" || {
        log "[ERROR] Cleanup failed"
        exit 1
    }
    log "[OK] Cleanup completed"
else
    log "[WARNING] Cleanup script not found: scripts/edge/cleanup-edge-server.sh"
    log "[WARNING] Skipping cleanup (non-critical)"
fi

# 최신 커밋 정보
LATEST_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT_MSG=$(git log -1 --pretty=format:"%s")
log "Latest commit: $LATEST_COMMIT"
log "Commit message: $LATEST_COMMIT_MSG"

log "=== Edge 서버 동기화 완료 ==="

# 재시작 명령 (실제 운영 환경에 맞게 수정 필요)
# 예시:
# - PM2: pm2 reload limen-frontend
# - systemd: systemctl restart limen-edge
# - Docker: docker-compose restart edge

RESTART_CMD="${RESTART_CMD:-}"
if [ -n "$RESTART_CMD" ]; then
    log "Executing restart command: $RESTART_CMD"
    eval "$RESTART_CMD" || {
        log "[WARNING] Restart command failed, but sync completed successfully"
    }
else
    log "[INFO] No restart command configured. Manual restart may be required."
    log "[INFO] Set RESTART_CMD environment variable to enable auto-restart."
fi

log "=== 동기화 프로세스 종료 ==="
