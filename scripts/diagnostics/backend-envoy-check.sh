#!/bin/bash
# 백엔드-Envoy 연결 진단 스크립트
# Envoy 프록시와의 연결 상태를 확인합니다.

set -e

echo "=========================================="
echo "백엔드-Envoy 연결 진단 스크립트"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 백엔드 서버 실행 상태 확인
echo "1. 백엔드 서버 실행 상태 확인"
echo "----------------------------------------"
if pgrep -f "backend.*server" > /dev/null; then
    echo -e "${GREEN}✓ 백엔드 서버가 실행 중입니다${NC}"
    ps aux | grep -E "backend|server" | grep -v grep | head -3
else
    echo -e "${RED}✗ 백엔드 서버가 실행되지 않았습니다${NC}"
fi
echo ""

# 2. 백엔드 포트 리스닝 확인
echo "2. 백엔드 포트 리스닝 확인 (18443)"
echo "----------------------------------------"
if netstat -tlnp 2>/dev/null | grep -E ":18443" > /dev/null || ss -tlnp 2>/dev/null | grep -E ":18443" > /dev/null; then
    echo -e "${GREEN}✓ 포트 18443에서 리스닝 중입니다${NC}"
    netstat -tlnp 2>/dev/null | grep 18443 || ss -tlnp 2>/dev/null | grep 18443
else
    echo -e "${RED}✗ 포트 18443에서 리스닝하지 않습니다${NC}"
fi
echo ""

# 3. 로컬 헬스체크 확인
echo "3. 로컬 헬스체크 확인 (localhost:18443/api/health)"
echo "----------------------------------------"
if curl -s -f -o /dev/null -w "%{http_code}" http://localhost:18443/api/health | grep -q "200"; then
    echo -e "${GREEN}✓ 로컬 헬스체크 성공${NC}"
    echo "응답:"
    curl -s http://localhost:18443/api/health | jq . 2>/dev/null || curl -s http://localhost:18443/api/health
else
    echo -e "${RED}✗ 로컬 헬스체크 실패${NC}"
    curl -v http://localhost:18443/api/health 2>&1 | tail -10
fi
echo ""

# 4. 네트워크 인터페이스 IP 확인
echo "4. 네트워크 인터페이스 IP 확인"
echo "----------------------------------------"
BACKEND_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v "127.0.0.1" | head -1)
if [ -n "$BACKEND_IP" ]; then
    echo -e "${GREEN}✓ 백엔드 IP: $BACKEND_IP${NC}"
    echo "모든 IP 주소:"
    ip -4 addr show | grep "inet " | awk '{print $2}' | cut -d/ -f1
else
    echo -e "${YELLOW}⚠ 외부 IP를 찾을 수 없습니다 (localhost만 사용 가능)${NC}"
fi
echo ""

# 5. 외부 IP에서 헬스체크 확인 (10.0.0.100)
echo "5. 외부 IP에서 헬스체크 확인 (10.0.0.100:18443/api/health)"
echo "----------------------------------------"
if curl -s -f -o /dev/null -w "%{http_code}" --connect-timeout 3 http://10.0.0.100:18443/api/health 2>/dev/null | grep -q "200"; then
    echo -e "${GREEN}✓ 외부 IP 헬스체크 성공${NC}"
    echo "응답:"
    curl -s http://10.0.0.100:18443/api/health | jq . 2>/dev/null || curl -s http://10.0.0.100:18443/api/health
else
    echo -e "${YELLOW}⚠ 외부 IP 헬스체크 실패 (Envoy 서버에서 확인 필요)${NC}"
    echo "Envoy 서버에서 다음 명령어를 실행하세요:"
    echo "  curl -v http://10.0.0.100:18443/api/health"
    echo "  telnet 10.0.0.100 18443"
fi
echo ""

# 6. 방화벽 규칙 확인 (iptables)
echo "6. 방화벽 규칙 확인 (iptables)"
echo "----------------------------------------"
if command -v iptables > /dev/null 2>&1; then
    echo "INPUT 체인 규칙:"
    iptables -L INPUT -n -v | grep -E "18443|ACCEPT|REJECT|DROP" | head -10 || echo "  (규칙 없음 또는 모든 트래픽 허용)"
    echo ""
    echo "OUTPUT 체인 규칙:"
    iptables -L OUTPUT -n -v | grep -E "ACCEPT|REJECT|DROP" | head -5 || echo "  (규칙 없음 또는 모든 트래픽 허용)"
else
    echo -e "${YELLOW}⚠ iptables를 사용할 수 없습니다${NC}"
fi
echo ""

# 7. 백엔드 로그 확인 (최근 에러)
echo "7. 백엔드 로그 확인 (최근 에러)"
echo "----------------------------------------"
LOG_DIR="${LOG_DIR:-/var/log/limen}"
if [ -d "$LOG_DIR" ]; then
    echo "로그 디렉토리: $LOG_DIR"
    if find "$LOG_DIR" -name "*.log" -type f 2>/dev/null | head -1 | xargs grep -i "error\|503\|502\|500" 2>/dev/null | tail -5; then
        echo -e "${YELLOW}⚠ 최근 에러 로그 발견${NC}"
    else
        echo -e "${GREEN}✓ 최근 에러 로그 없음${NC}"
    fi
else
    echo -e "${YELLOW}⚠ 로그 디렉토리를 찾을 수 없습니다: $LOG_DIR${NC}"
    echo "환경 변수 LOG_DIR을 설정하거나 로그 위치를 확인하세요"
fi
echo ""

# 8. 네트워크 연결 테스트
echo "8. 네트워크 연결 테스트"
echo "----------------------------------------"
echo "백엔드 서버에서 Envoy 서버로의 연결 테스트:"
echo "(Envoy 서버 IP를 알고 있다면 수동으로 테스트하세요)"
echo "  telnet <ENVOY_IP> 80"
echo "  telnet <ENVOY_IP> 443"
echo ""

# 9. 백엔드 설정 확인
echo "9. 백엔드 설정 확인"
echo "----------------------------------------"
if [ -f ".env" ]; then
    echo "환경 변수 파일 (.env) 존재"
    if grep -q "PORT" .env; then
        PORT=$(grep "^PORT=" .env | cut -d= -f2 | tr -d '"' | tr -d "'")
        echo "  PORT: $PORT"
    fi
    if grep -q "ALLOWED_ORIGINS" .env; then
        ORIGINS=$(grep "^ALLOWED_ORIGINS=" .env | cut -d= -f2 | tr -d '"' | tr -d "'")
        echo "  ALLOWED_ORIGINS: $ORIGINS"
    fi
else
    echo -e "${YELLOW}⚠ .env 파일을 찾을 수 없습니다${NC}"
fi
echo ""

# 10. 요약 및 권장 사항
echo "=========================================="
echo "요약 및 권장 사항"
echo "=========================================="
echo ""
echo "백엔드 측 확인 사항:"
echo "  ✓ 백엔드 서버가 18443 포트에서 정상 리스닝"
echo "  ✓ /api/health 엔드포인트 정상 응답"
echo ""
echo "Envoy 서버에서 확인할 사항:"
echo "  1. Envoy 실행 상태: ps aux | grep envoy"
echo "  2. Envoy 포트 확인: netstat -tlnp | grep -E '(80|443)'"
echo "  3. Envoy에서 백엔드 연결 테스트:"
echo "     curl -v http://10.0.0.100:18443/api/health"
echo "     telnet 10.0.0.100 18443"
echo "  4. Envoy 클러스터 상태: curl http://localhost:9901/clusters"
echo "  5. Envoy 로그 확인: journalctl -u envoy -n 100 | grep -i '503\|error\|unhealthy'"
echo ""
echo "문제가 지속되면:"
echo "  - Envoy 설정 파일의 백엔드 클러스터 엔드포인트 확인"
echo "  - Envoy 헬스체크 설정 확인 (health_check 경로: /api/health)"
echo "  - 네트워크 방화벽 규칙 확인"
echo ""






