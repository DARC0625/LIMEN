#!/bin/bash
# LIMEN 자동 시작 설정 스크립트
# WSL 및 systemd 자동 시작 설정

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_FILE="$SCRIPT_DIR/limen.service"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SYSTEMD_SYSTEM_DIR="/etc/systemd/system"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# systemd 사용자 서비스 설정
setup_systemd_user() {
    log "Setting up systemd user service..."
    
    mkdir -p "$SYSTEMD_USER_DIR"
    
    # 서비스 파일 복사
    cp "$SERVICE_FILE" "$SYSTEMD_USER_DIR/limen.service"
    log "Service file copied to $SYSTEMD_USER_DIR/limen.service"
    
    # systemd 재로드
    systemctl --user daemon-reload
    log "Systemd daemon reloaded"
    
    # 서비스 활성화
    systemctl --user enable limen.service
    log "Service enabled for auto-start"
    
    # 서비스 시작
    systemctl --user start limen.service
    log "Service started"
    
    # 상태 확인
    sleep 2
    systemctl --user status limen.service --no-pager || true
}

# WSL 자동 시작 설정 (.bashrc)
setup_wsl_autostart() {
    log "Setting up WSL auto-start..."
    
    BASHRC="$HOME/.bashrc"
    START_SCRIPT="$PROJECT_ROOT/scripts/start-limen.sh"
    
    # 이미 설정되어 있는지 확인
    if grep -q "start-limen.sh" "$BASHRC" 2>/dev/null; then
        warn "Auto-start already configured in .bashrc"
        return 0
    fi
    
    # 자동 시작 코드 추가
    cat >> "$BASHRC" << 'EOF'

# LIMEN Auto-start (only if not already running)
if [ -f "$HOME/projects/LIMEN/scripts/start-limen.sh" ]; then
    if ! pgrep -f "LIMEN.*backend.*server" > /dev/null; then
        "$HOME/projects/LIMEN/scripts/start-limen.sh" start > /dev/null 2>&1 &
    fi
fi
EOF
    
    log "Auto-start added to .bashrc"
}

# systemd 사용자 서비스 제거
remove_systemd_user() {
    log "Removing systemd user service..."
    
    if systemctl --user is-active --quiet limen.service 2>/dev/null; then
        systemctl --user stop limen.service
    fi
    
    if systemctl --user is-enabled --quiet limen.service 2>/dev/null; then
        systemctl --user disable limen.service
    fi
    
    rm -f "$SYSTEMD_USER_DIR/limen.service"
    systemctl --user daemon-reload
    
    log "Systemd user service removed"
}

# 메인 로직
case "${1:-setup}" in
    setup)
        log "Setting up LIMEN auto-start..."
        
        # systemd 사용자 서비스 설정
        if systemctl --user > /dev/null 2>&1; then
            setup_systemd_user
        else
            warn "Systemd user service not available, using WSL auto-start only"
            setup_wsl_autostart
        fi
        
        # WSL 자동 시작도 설정 (백업)
        setup_wsl_autostart
        
        log "Auto-start setup complete!"
        log "LIMEN will start automatically on WSL boot"
        ;;
    remove)
        remove_systemd_user
        log "Auto-start removed"
        ;;
    status)
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "LIMEN Auto-start Status"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        if systemctl --user is-enabled --quiet limen.service 2>/dev/null; then
            echo -e "${GREEN}✓${NC} Systemd user service: enabled"
            if systemctl --user is-active --quiet limen.service 2>/dev/null; then
                echo -e "${GREEN}✓${NC} Systemd user service: active"
            else
                echo -e "${YELLOW}○${NC} Systemd user service: inactive"
            fi
        else
            echo -e "${YELLOW}○${NC} Systemd user service: not enabled"
        fi
        
        if grep -q "start-limen.sh" "$HOME/.bashrc" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} WSL auto-start: configured in .bashrc"
        else
            echo -e "${YELLOW}○${NC} WSL auto-start: not configured"
        fi
        ;;
    *)
        echo "Usage: $0 {setup|remove|status}"
        echo ""
        echo "Commands:"
        echo "  setup  - Set up auto-start (default)"
        echo "  remove - Remove auto-start"
        echo "  status - Show auto-start status"
        exit 1
        ;;
esac


