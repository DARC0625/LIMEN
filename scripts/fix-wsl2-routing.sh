#!/bin/bash
# WSL2 라우팅 문제 자동 수정 스크립트
# 미러 모드에서 eth0의 잘못된 라우트를 제거하여 eth1을 통한 인터넷 연결 복구

set -e

echo "🔧 WSL2 라우팅 문제 수정 중..."

# 문제가 되는 라우트 확인
BAD_ROUTE=$(ip route show | grep "default via 10.0.0.1 dev eth0" || true)

if [ -z "$BAD_ROUTE" ]; then
    echo "✅ 문제가 되는 라우트가 없습니다."
    exit 0
fi

echo "⚠️  문제가 되는 라우트 발견: $BAD_ROUTE"

# 라우트 제거 시도
if sudo ip route del default via 10.0.0.1 dev eth0 2>/dev/null; then
    echo "✅ 라우트 제거 성공"
else
    echo "❌ 라우트 제거 실패 - sudo 권한 필요"
    echo ""
    echo "다음 명령을 수동으로 실행하세요:"
    echo "  sudo ip route del default via 10.0.0.1 dev eth0"
    exit 1
fi

# 인터넷 연결 테스트
echo ""
echo "🌐 인터넷 연결 테스트 중..."
if ping -c 2 -W 2 8.8.8.8 >/dev/null 2>&1; then
    echo "✅ 인터넷 연결 정상!"
    
    # GitHub 연결 테스트
    if curl -I --connect-timeout 3 https://github.com >/dev/null 2>&1; then
        echo "✅ GitHub 연결 정상!"
    fi
    
    exit 0
else
    echo "❌ 인터넷 연결 실패"
    exit 1
fi

