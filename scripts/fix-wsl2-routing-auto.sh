#!/bin/bash
# WSL2 라우팅 문제 자동 수정 스크립트 (비밀번호 포함 버전)
# WSL2 재시작 시 자동으로 실행되도록 설정
# 중요: eth0의 IP 주소(10.0.0.100)는 절대 변경하지 않음 - 백엔드 주소 고정

set -e

# eth0의 IP 주소 확인 (10.0.0.100이어야 함)
ETH0_IP=$(ip addr show eth0 | grep "inet 10.0.0.100" || true)
if [ -z "$ETH0_IP" ]; then
    echo "⚠️  경고: eth0에 10.0.0.100이 없습니다. 확인 필요!"
    # 하지만 계속 진행 (IP는 WSL2가 자동으로 설정)
fi

# 문제가 되는 default route만 제거 (로컬 네트워크 라우팅은 유지)
BAD_ROUTE=$(ip route show | grep "default via 10.0.0.1 dev eth0" || true)

if [ -z "$BAD_ROUTE" ]; then
    # 문제가 없으면 종료
    exit 0
fi

# default route만 제거 (eth0의 IP 주소나 로컬 네트워크 라우팅은 변경하지 않음)
echo '0625' | sudo -S ip route del default via 10.0.0.1 dev eth0 2>/dev/null

# eth0의 IP 주소가 여전히 10.0.0.100인지 확인
ETH0_IP_AFTER=$(ip addr show eth0 | grep "inet 10.0.0.100" || true)
if [ -z "$ETH0_IP_AFTER" ]; then
    echo "❌ 오류: eth0의 IP 주소가 10.0.0.100이 아닙니다!"
    exit 1
fi

# 로컬 네트워크 라우팅 확인 (10.0.0.0/24는 eth0를 통해야 함)
LOCAL_ROUTE=$(ip route show | grep "10.0.0.0/24 dev eth0" || true)
if [ -z "$LOCAL_ROUTE" ]; then
    echo "⚠️  경고: 10.0.0.0/24 라우팅이 eth0를 통해 있지 않습니다!"
fi

# 확인
if ping -c 1 -W 1 8.8.8.8 >/dev/null 2>&1; then
    echo "✅ WSL2 라우팅 자동 수정 완료 (10.0.0.100 유지)"
else
    echo "⚠️  라우팅 수정 후에도 인터넷 연결 실패"
fi

