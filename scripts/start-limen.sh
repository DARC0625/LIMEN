#!/bin/bash
# LIMEN 백엔드 + 에이전트 통합 시작 스크립트
# WSL 자동 시작용

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
AGENT_DIR="$BACKEND_DIR/agent"

# 로그 디렉토리
LOG_DIR="$BACKEND_DIR/logs"
mkdir -p "$LOG_DIR"

# PID 파일 디렉토리
PID_DIR="$BACKEND_DIR/pids"
mkdir -p "$PID_DIR"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
AGENT_PID_FILE="$PID_DIR/agent.pid"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 프로세스가 실행 중인지 확인
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# 에이전트 시작
start_agent() {
    # 포트 9000이 사용 중이면 기존 프로세스 정리
    local port_pid=$(lsof -ti:9000 2>/dev/null | head -1)
    if [ -n "$port_pid" ]; then
        local proc_path=$(readlink -f "/proc/$port_pid/exe" 2>/dev/null || echo "")
        if [ -n "$proc_path" ] && echo "$proc_path" | grep -q "agent"; then
            warn "Port 9000 is in use by existing agent (PID: $port_pid), cleaning up..."
            kill -TERM "$port_pid" 2>/dev/null || true
            sleep 2
            if ps -p "$port_pid" > /dev/null 2>&1; then
                kill -KILL "$port_pid" 2>/dev/null || true
            fi
            # PID 파일 업데이트
            echo "$port_pid" > "$AGENT_PID_FILE"
        fi
    fi
    
    if is_running "$AGENT_PID_FILE"; then
        warn "Agent is already running (PID: $(cat $AGENT_PID_FILE))"
        return 0
    fi

    log "Starting agent..."
    cd "$AGENT_DIR"
    
    # 빌드 확인
    if [ ! -f "target/release/agent" ]; then
        warn "Agent binary not found, building..."
        cargo build --release
    fi
    
    # 에이전트 시작
    nohup ./target/release/agent > "$LOG_DIR/agent.log" 2>&1 &
    AGENT_PID=$!
    echo $AGENT_PID > "$AGENT_PID_FILE"
    
    # 시작 확인
    sleep 2
    if ps -p "$AGENT_PID" > /dev/null 2>&1; then
        # 포트 리스닝 확인
        sleep 1
        if ss -tuln 2>/dev/null | grep -q ":9000"; then
            log "Agent started (PID: $AGENT_PID)"
            return 0
        else
            warn "Agent process started but port 9000 not listening yet, waiting..."
            sleep 2
            if ss -tuln 2>/dev/null | grep -q ":9000"; then
                log "Agent started (PID: $AGENT_PID)"
                return 0
            fi
        fi
    fi
    
    error "Failed to start agent"
    # 로그 확인
    if [ -f "$LOG_DIR/agent.log" ]; then
        error "Last 5 lines of agent.log:"
        tail -5 "$LOG_DIR/agent.log" >&2
    fi
    rm -f "$AGENT_PID_FILE"
    return 1
}

# 백엔드 시작
start_backend() {
    # 포트 18443이 사용 중이면 기존 프로세스 정리
    local port_pid=$(lsof -ti:18443 2>/dev/null | head -1)
    if [ -n "$port_pid" ]; then
        local proc_path=$(readlink -f "/proc/$port_pid/exe" 2>/dev/null || echo "")
        if [ -n "$proc_path" ] && echo "$proc_path" | grep -q "server"; then
            warn "Port 18443 is in use by existing backend (PID: $port_pid), using existing process..."
            echo "$port_pid" > "$BACKEND_PID_FILE"
            if ps -p "$port_pid" > /dev/null 2>&1; then
                log "Backend already running (PID: $port_pid)"
                return 0
            fi
        fi
    fi
    
    if is_running "$BACKEND_PID_FILE"; then
        warn "Backend is already running (PID: $(cat $BACKEND_PID_FILE))"
        return 0
    fi

    log "Starting backend..."
    cd "$BACKEND_DIR"
    
    # 빌드 확인
    if [ ! -f "server" ]; then
        warn "Backend binary not found, building..."
        go build -ldflags="-s -w" -trimpath -o server ./cmd/server
    fi
    
    # 백엔드 시작 (LOG_DIR 환경 변수 설정하여 파일 로깅 활성화)
    # LOG_DIR을 설정하면 파일 로테이션이 활성화되고, 구조화된 로그가 limen.log에 기록됨
    # stdout/stderr는 server_stdout.log에 기록 (에러 메시지용)
    export LOG_DIR="$LOG_DIR"
    nohup env LOG_DIR="$LOG_DIR" ./server > "$LOG_DIR/server_stdout.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$BACKEND_PID_FILE"
    
    # 시작 확인
    sleep 2
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        # 포트 리스닝 확인
        sleep 1
        if ss -tuln 2>/dev/null | grep -q ":18443"; then
            log "Backend started (PID: $BACKEND_PID)"
            return 0
        else
            warn "Backend process started but port 18443 not listening yet, waiting..."
            sleep 2
            if ss -tuln 2>/dev/null | grep -q ":18443"; then
                log "Backend started (PID: $BACKEND_PID)"
                return 0
            fi
        fi
    fi
    
    error "Failed to start backend"
    # 로그 확인
    if [ -f "$LOG_DIR/server.log" ]; then
        error "Last 5 lines of server.log:"
        tail -5 "$LOG_DIR/server.log" >&2
    fi
    rm -f "$BACKEND_PID_FILE"
    return 1
}

# 안전한 프로세스 종료 (정확한 실행 파일 경로 확인)
safe_kill_by_port() {
    local port=$1
    local expected_path=$2
    local service_name=$3
    
    # 포트를 사용하는 프로세스 찾기
    local pid=$(lsof -ti:$port 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        # 프로세스의 실행 파일 경로 확인
        local proc_path=$(readlink -f "/proc/$pid/exe" 2>/dev/null || echo "")
        if [ -n "$proc_path" ] && echo "$proc_path" | grep -q "$expected_path"; then
            log "Stopping $service_name (PID: $pid)..."
            kill -TERM "$pid" 2>/dev/null || true
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                warn "$service_name did not stop gracefully, forcing..."
                kill -KILL "$pid" 2>/dev/null || true
            fi
            log "$service_name stopped"
            return 0
        fi
    fi
    return 1
}

# 서비스 중지
stop_service() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            log "Stopping $service_name (PID: $pid)..."
            kill -TERM "$pid" 2>/dev/null || true
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                warn "$service_name did not stop gracefully, forcing..."
                kill -KILL "$pid" 2>/dev/null || true
            fi
            log "$service_name stopped"
        fi
        rm -f "$pid_file"
    fi
}

# 모든 서비스 중지
stop_all() {
    # 먼저 PID 파일로 정상 종료 시도
    stop_service "$BACKEND_PID_FILE" "Backend"
    stop_service "$AGENT_PID_FILE" "Agent"
    
    # PID 파일이 없거나 실패한 경우, 포트로 확인하여 안전하게 종료
    safe_kill_by_port 18443 "backend/server" "Backend" || true
    safe_kill_by_port 9000 "agent/target/release/agent" "Agent" || true
}

# 상태 확인
status() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "LIMEN Services Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if is_running "$BACKEND_PID_FILE"; then
        echo -e "${GREEN}✓${NC} Backend: running (PID: $(cat $BACKEND_PID_FILE))"
    else
        echo -e "${RED}✗${NC} Backend: not running"
    fi
    
    if is_running "$AGENT_PID_FILE"; then
        echo -e "${GREEN}✓${NC} Agent: running (PID: $(cat $AGENT_PID_FILE))"
    else
        echo -e "${RED}✗${NC} Agent: not running"
    fi
    
    echo ""
    echo "Port Status:"
    if ss -tuln 2>/dev/null | grep -q ":18443"; then
        echo -e "${GREEN}✓${NC} Backend (18443): listening"
    else
        echo -e "${RED}✗${NC} Backend (18443): not listening"
    fi
    
    if ss -tuln 2>/dev/null | grep -q ":9000"; then
        echo -e "${GREEN}✓${NC} Agent (9000): listening"
    else
        echo -e "${YELLOW}○${NC} Agent (9000): not listening"
    fi
}

# 메인 로직
case "${1:-start}" in
    start)
        log "Starting LIMEN services..."
        start_agent
        sleep 1
        start_backend
        sleep 1
        status
        ;;
    stop)
        log "Stopping LIMEN services..."
        stop_all
        ;;
    restart)
        log "Restarting LIMEN services..."
        stop_all
        sleep 2
        start_agent
        sleep 1
        start_backend
        sleep 1
        status
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac


