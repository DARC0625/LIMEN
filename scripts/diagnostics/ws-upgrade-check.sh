#!/bin/bash
# WebSocket 업그레이드 CLI 확인 스크립트
# 브라우저 없이 CLI로 WebSocket 업그레이드가 정상 작동하는지 확인합니다.

set -e

echo "=========================================="
echo "WebSocket 업그레이드 CLI 확인 스크립트"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 기본 설정
DOMAIN="${DOMAIN:-limen.kr}"
WS_ENDPOINT="${WS_ENDPOINT:-/ws/vm-status}"
VNC_ENDPOINT="${VNC_ENDPOINT:-/vnc/test-uuid-1234-5678-9012-345678901234}"
TIMEOUT="${TIMEOUT:-10}"

# websocat 또는 wscat 설치 확인
check_websocket_client() {
    echo "1. WebSocket 클라이언트 도구 확인"
    echo "----------------------------------------"
    
    if command -v websocat > /dev/null 2>&1; then
        echo -e "${GREEN}✓ websocat 설치됨${NC}"
        WEBSOCKET_CLIENT="websocat"
        WEBSOCKET_CMD="websocat -v"
        return 0
    elif command -v wscat > /dev/null 2>&1; then
        echo -e "${GREEN}✓ wscat 설치됨${NC}"
        WEBSOCKET_CLIENT="wscat"
        WEBSOCKET_CMD="wscat -c"
        return 0
    else
        echo -e "${YELLOW}⚠ websocat 또는 wscat이 설치되지 않았습니다${NC}"
        echo ""
        echo "설치 방법:"
        echo "  Ubuntu/Debian:"
        echo "    sudo apt-get update && sudo apt-get install -y websocat"
        echo ""
        echo "  또는 Node.js wscat:"
        echo "    npm install -g wscat"
        echo ""
        echo "  또는 Rust로 websocat 빌드:"
        echo "    cargo install websocat"
        return 1
    fi
}

# websocat 설치 시도
install_websocat() {
    echo "websocat 설치 시도 중..."
    if command -v apt-get > /dev/null 2>&1; then
        sudo apt-get update && sudo apt-get install -y websocat
        return $?
    elif command -v cargo > /dev/null 2>&1; then
        cargo install websocat
        return $?
    else
        echo -e "${RED}✗ 자동 설치 실패. 수동으로 설치하세요.${NC}"
        return 1
    fi
}

# WebSocket 업그레이드 테스트 (websocat)
test_websocket_websocat() {
    local url=$1
    local endpoint_name=$2
    
    echo ""
    echo "테스트: $endpoint_name"
    echo "URL: $url"
    echo "----------------------------------------"
    
    # websocat으로 연결 시도 (타임아웃 설정)
    timeout $TIMEOUT websocat -v "$url" 2>&1 | head -n 80 || {
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo -e "${YELLOW}⚠ 타임아웃 (${TIMEOUT}초) - 연결은 성공했지만 응답이 없습니다${NC}"
            echo "   (정상일 수 있음: 서버가 메시지를 보내지 않으면 타임아웃 발생)"
            return 0
        elif [ $exit_code -eq 1 ]; then
            # websocat의 일반적인 실패 코드
            local output=$(timeout $TIMEOUT websocat -v "$url" 2>&1 | head -n 80)
            if echo "$output" | grep -qi "101\|switching\|upgrade\|websocket"; then
                echo -e "${GREEN}✓ WebSocket 업그레이드 성공${NC}"
                echo "$output" | head -n 20
                return 0
            else
                echo -e "${RED}✗ WebSocket 업그레이드 실패${NC}"
                echo "$output"
                return 1
            fi
        else
            echo -e "${RED}✗ 예상치 못한 오류 (exit code: $exit_code)${NC}"
            return 1
        fi
    }
    
    # 성공적으로 출력이 있으면 업그레이드 성공으로 간주
    echo -e "${GREEN}✓ WebSocket 업그레이드 성공${NC}"
    return 0
}

# WebSocket 업그레이드 테스트 (wscat)
test_websocket_wscat() {
    local url=$1
    local endpoint_name=$2
    
    echo ""
    echo "테스트: $endpoint_name"
    echo "URL: $url"
    echo "----------------------------------------"
    
    # wscat으로 연결 시도
    timeout $TIMEOUT wscat -c "$url" 2>&1 | head -n 80 || {
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo -e "${YELLOW}⚠ 타임아웃 (${TIMEOUT}초) - 연결은 성공했지만 응답이 없습니다${NC}"
            return 0
        else
            local output=$(timeout $TIMEOUT wscat -c "$url" 2>&1 | head -n 80)
            if echo "$output" | grep -qi "connected\|websocket"; then
                echo -e "${GREEN}✓ WebSocket 업그레이드 성공${NC}"
                echo "$output" | head -n 20
                return 0
            else
                echo -e "${RED}✗ WebSocket 업그레이드 실패${NC}"
                echo "$output"
                return 1
            fi
        fi
    }
    
    echo -e "${GREEN}✓ WebSocket 업그레이드 성공${NC}"
    return 0
}

# 메인 테스트 실행
main() {
    # WebSocket 클라이언트 확인
    if ! check_websocket_client; then
        read -p "websocat을 자동으로 설치하시겠습니까? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if install_websocat; then
                check_websocket_client || exit 1
            else
                exit 1
            fi
        else
            exit 1
        fi
    fi
    
    echo ""
    echo "2. WebSocket 업그레이드 테스트"
    echo "=========================================="
    
    # 테스트할 엔드포인트 목록
    declare -a endpoints=(
        "wss://${DOMAIN}${WS_ENDPOINT}|/ws/ 엔드포인트"
        "wss://${DOMAIN}${VNC_ENDPOINT}|/vnc/ 엔드포인트"
    )
    
    # HTTP도 테스트 (개발 환경용)
    if [ "${TEST_HTTP:-false}" = "true" ]; then
        endpoints+=("ws://${DOMAIN}${WS_ENDPOINT}|/ws/ 엔드포인트 (HTTP)")
        endpoints+=("ws://${DOMAIN}${VNC_ENDPOINT}|/vnc/ 엔드포인트 (HTTP)")
    fi
    
    local success_count=0
    local fail_count=0
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS='|' read -r url endpoint_name <<< "$endpoint_info"
        
        if [ "$WEBSOCKET_CLIENT" = "websocat" ]; then
            if test_websocket_websocat "$url" "$endpoint_name"; then
                ((success_count++))
            else
                ((fail_count++))
            fi
        else
            if test_websocket_wscat "$url" "$endpoint_name"; then
                ((success_count++))
            else
                ((fail_count++))
            fi
        fi
    done
    
    echo ""
    echo "=========================================="
    echo "테스트 결과 요약"
    echo "=========================================="
    echo "성공: $success_count"
    echo "실패: $fail_count"
    echo ""
    
    if [ $fail_count -eq 0 ]; then
        echo -e "${GREEN}✓ 모든 WebSocket 업그레이드 테스트 통과${NC}"
        echo ""
        echo "판정: CLI로는 성공 → 브라우저별 실패는 프론트엔드/브라우저 정책 문제일 가능성 높음"
        exit 0
    else
        echo -e "${RED}✗ 일부 WebSocket 업그레이드 테스트 실패${NC}"
        echo ""
        echo "판정: CLI에서도 실패 → Envoy/Backend WS 설정 문제 확률 높음"
        echo ""
        echo "다음 단계:"
        echo "  1. Envoy 로그 확인: sudo tail -n 2000 /tmp/envoy.log | grep -E '\"/(ws|vnc)/'"
        echo "  2. 백엔드 로그 확인: journalctl -u limen-backend -n 100 | grep -i websocket"
        echo "  3. Envoy 클러스터 상태: curl http://localhost:9901/clusters | grep backend_cluster"
        exit 1
    fi
}

# 스크립트 실행
main "$@"
