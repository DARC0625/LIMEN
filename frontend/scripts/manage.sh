#!/bin/bash
# LIMEN Frontend 통합 관리 스크립트

set -e

# 스크립트 위치 기준으로 상대 경로 계산
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/.."
DARC_DIR="${FRONTEND_DIR}/../darc.kr"
PORT_LIMEN=9444
PORT_DARC=9445
ECOSYSTEM_FILE="${FRONTEND_DIR}/ecosystem.config.js"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

# 포트 정리 함수
cleanup_port() {
    local port=$1
    log_info "포트 $port 정리 중..."
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
    pkill -9 -f "next.*$port" 2>/dev/null || true
    sleep 1
}

# 빌드 함수
build_frontend() {
    local dir=$1
    local name=$2
    
    log_info "$name 빌드 중..."
    cd "$dir"
    
    # .next 디렉토리 삭제 (깨끗한 빌드)
    if [ "$3" = "clean" ]; then
        log_info "이전 빌드 파일 삭제 중..."
        rm -rf .next
    fi
    
    npm run build
    if [ $? -ne 0 ]; then
        log_error "$name 빌드 실패!"
        return 1
    fi
    
    # 빌드 파일 검증
    CHUNK_COUNT=$(find .next/static/chunks -name "*.js" 2>/dev/null | wc -l)
    if [ "$CHUNK_COUNT" -eq 0 ]; then
        log_error "$name 빌드 파일이 없습니다!"
        return 1
    fi
    
    log_success "$name 빌드 완료: $CHUNK_COUNT 개 파일"
    return 0
}

# LIMEN 프론트엔드 재시작
restart_limen() {
    log_info "LIMEN 프론트엔드 재시작 시작..."
    
    # 포트 정리
    cleanup_port $PORT_LIMEN
    
    # 빌드
    if ! build_frontend "$FRONTEND_DIR" "LIMEN" "clean"; then
        return 1
    fi
    
    # PM2로 재시작
    log_info "PM2로 재시작 중..."
    pm2 restart limen-frontend || pm2 start ecosystem.config.js --only limen-frontend
    
    # 상태 확인
    sleep 3
    if pm2 list | grep -q "limen-frontend.*online"; then
        log_success "LIMEN 프론트엔드 재시작 완료"
        return 0
    else
        log_error "LIMEN 프론트엔드 재시작 실패"
        pm2 logs limen-frontend --lines 10 --nostream
        return 1
    fi
}

# DARC 재시작
restart_darc() {
    log_info "DARC 재시작 시작..."
    
    # 포트 정리
    cleanup_port $PORT_DARC
    
    # 빌드
    if ! build_frontend "$DARC_DIR" "DARC" "clean"; then
        return 1
    fi
    
    # PM2로 재시작
    log_info "PM2로 재시작 중..."
    pm2 restart darc.kr || pm2 start ecosystem.config.js --only darc.kr
    
    # 상태 확인
    sleep 3
    if pm2 list | grep -q "darc.kr.*online"; then
        log_success "DARC 재시작 완료"
        return 0
    else
        log_error "DARC 재시작 실패"
        pm2 logs darc.kr --lines 10 --nostream
        return 1
    fi
}

# 전체 재시작
restart_all() {
    log_info "전체 재시작 시작..."
    restart_limen
    restart_darc
    log_success "전체 재시작 완료"
}

# PM2 설정
setup_pm2() {
    log_info "PM2 서비스 설정 시작..."
    
    # 기존 프로세스 정리
    log_info "기존 프로세스 정리 중..."
    pm2 delete all 2>/dev/null || true
    cleanup_port $PORT_LIMEN
    cleanup_port $PORT_DARC
    sleep 2
    
    # 빌드 확인 및 실행
    if [ ! -d "${FRONTEND_DIR}/.next" ]; then
        build_frontend "$FRONTEND_DIR" "LIMEN" "clean"
    fi
    
    if [ ! -d "${DARC_DIR}/.next" ]; then
        build_frontend "$DARC_DIR" "DARC" "clean"
    fi
    
    # PM2로 프로세스 시작
    log_info "PM2로 프로세스 시작 중..."
    cd "$FRONTEND_DIR"
    pm2 start ecosystem.config.js
    
    # PM2 설정 저장
    log_info "PM2 설정 저장 중..."
    pm2 save
    
    # 상태 확인
    sleep 3
    pm2 list
    
    log_success "PM2 서비스 설정 완료!"
}

# 메인 함수
main() {
    case "$1" in
        build)
            case "$2" in
                limen) build_frontend "$FRONTEND_DIR" "LIMEN" "${3:-clean}" ;;
                darc) build_frontend "$DARC_DIR" "DARC" "${3:-clean}" ;;
                all)
                    build_frontend "$FRONTEND_DIR" "LIMEN" "clean"
                    build_frontend "$DARC_DIR" "DARC" "clean"
                    ;;
                *) log_error "사용법: $0 build {limen|darc|all}" ;;
            esac
            ;;
        restart)
            case "$2" in
                limen) restart_limen ;;
                darc) restart_darc ;;
                all) restart_all ;;
                *) log_error "사용법: $0 restart {limen|darc|all}" ;;
            esac
            ;;
        pm2)
            case "$2" in
                setup) setup_pm2 ;;
                list) pm2 list ;;
                status) pm2 status ;;
                logs)
                    if [ -z "$3" ]; then
                        pm2 logs --lines 50
                    else
                        pm2 logs "$3" --lines 50
                    fi
                    ;;
                restart)
                    if [ -z "$3" ]; then
                        pm2 restart all
                    else
                        pm2 restart "$3"
                    fi
                    ;;
                stop)
                    if [ -z "$3" ]; then
                        pm2 stop all
                    else
                        pm2 stop "$3"
                    fi
                    ;;
                start)
                    if [ -z "$3" ]; then
                        pm2 start all
                    else
                        pm2 start "$3"
                    fi
                    ;;
                save) pm2 save ;;
                *) log_error "사용법: $0 pm2 {setup|list|status|logs|restart|stop|start|save} [name]" ;;
            esac
            ;;
        clean)
            log_info "빌드 캐시 정리 중..."
            cd "$FRONTEND_DIR"
            rm -rf .next
            cd "$DARC_DIR"
            rm -rf .next
            log_success "빌드 캐시 정리 완료"
            ;;
        *)
            echo "LIMEN Frontend 통합 관리 스크립트"
            echo ""
            echo "사용법: $0 {command} [options]"
            echo ""
            echo "명령어:"
            echo "  build {limen|darc|all} [clean]  - 빌드 (기본: clean)"
            echo "  restart {limen|darc|all}        - 재시작"
            echo "  pm2 {command} [options]         - PM2 관리"
            echo "    setup                          - PM2 서비스 설정"
            echo "    list                           - 프로세스 목록"
            echo "    status                         - 상태 확인"
            echo "    logs [name]                    - 로그 확인"
            echo "    restart [name]                 - 재시작"
            echo "    stop [name]                    - 중지"
            echo "    start [name]                   - 시작"
            echo "    save                           - 설정 저장"
            echo "  clean                            - 빌드 캐시 정리"
            echo ""
            echo "예시:"
            echo "  $0 build limen                   - LIMEN 빌드"
            echo "  $0 restart limen                 - LIMEN 재시작"
            echo "  $0 pm2 setup                     - PM2 설정"
            echo "  $0 pm2 logs limen-frontend       - LIMEN 로그"
            ;;
    esac
}

main "$@"

