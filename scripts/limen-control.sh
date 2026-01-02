#!/bin/bash
# LIMEN 통합 제어 스크립트
# 사용법: ./limen-control.sh {start|stop|restart|status}

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 단일 LIMEN 서비스 (백엔드+에이전트)
LIMEN_SERVICE="limen"

# 기타 의존 서비스
DEPENDENCIES=(
    "postgresql"
    "libvirtd"
)

# 상태 확인 함수
check_service() {
    local service=$1
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${GREEN}●${NC} $service: ${GREEN}running${NC}"
        return 0
    elif systemctl is-enabled --quiet "$service" 2>/dev/null; then
        echo -e "${YELLOW}○${NC} $service: ${YELLOW}stopped${NC}"
        return 1
    else
        echo -e "${RED}✗${NC} $service: ${RED}not found${NC}"
        return 2
    fi
}

# 서비스 시작
start_service() {
    local service=$1
    if systemctl start "$service" 2>/dev/null; then
        sleep 1
        if systemctl is-active --quiet "$service"; then
            echo -e "${GREEN}✓${NC} Started $service"
            return 0
        else
            echo -e "${RED}✗${NC} Failed to start $service"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} $service not available or already running"
        return 0
    fi
}

# 서비스 중지
stop_service() {
    local service=$1
    if systemctl stop "$service" 2>/dev/null; then
        sleep 1
        if ! systemctl is-active --quiet "$service"; then
            echo -e "${GREEN}✓${NC} Stopped $service"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} $service still running"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} $service not available or already stopped"
        return 0
    fi
}

# 모든 서비스 시작
start_all() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Starting LIMEN Services..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # PostgreSQL 먼저 시작
    start_service "postgresql"
    sleep 2
    
    # Libvirt 시작
    start_service "libvirtd"
    sleep 2
    
    # LIMEN 통합 서비스 시작
    start_service "$LIMEN_SERVICE"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    status_all
}

# 모든 서비스 중지
stop_all() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Stopping LIMEN Services..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # LIMEN 통합 서비스 중지
    stop_service "$LIMEN_SERVICE"
    
    # 시스템 서비스는 유지 (다른 프로세스가 사용할 수 있음)
    echo -e "${YELLOW}ℹ${NC} PostgreSQL and Libvirt are kept running (may be used by other processes)"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    status_all
}

# 모든 서비스 재시작
restart_all() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Restarting LIMEN Services..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    stop_all
    sleep 2
    start_all
}

# 모든 서비스 상태 확인
status_all() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "LIMEN Services Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_service "$LIMEN_SERVICE"
    for service in "${DEPENDENCIES[@]}"; do
        check_service "$service"
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 포트 확인
    echo "Port Status:"
    if ss -tuln | grep -q ":18443"; then
        echo -e "${GREEN}✓${NC} Backend (18443): listening"
    else
        echo -e "${RED}✗${NC} Backend (18443): not listening"
    fi
    
    if ss -tuln | grep -q ":9000"; then
        echo -e "${GREEN}✓${NC} Agent (9000): listening"
    else
        echo -e "${YELLOW}○${NC} Agent (9000): not listening"
    fi
    
    if ss -tuln | grep -q ":5432"; then
        echo -e "${GREEN}✓${NC} PostgreSQL (5432): listening"
    else
        echo -e "${RED}✗${NC} PostgreSQL (5432): not listening"
    fi
}

# 메인 로직
case "${1:-status}" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        restart_all
        ;;
    status)
        status_all
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all LIMEN services"
        echo "  stop    - Stop all LIMEN services"
        echo "  restart - Restart all LIMEN services"
        echo "  status  - Show status of all services (default)"
        exit 1
        ;;
esac
