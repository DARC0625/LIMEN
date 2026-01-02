#!/bin/bash
# Envoy 재시작 스크립트

set -e

ENVOY_CONFIG="/home/darc/LIMEN/frontend/envoy.yaml"

echo "=========================================="
echo "Envoy 재시작 스크립트"
echo "=========================================="
echo ""

# 설정 파일 검증
echo "1. Envoy 설정 파일 검증 중..."
if envoy --config-path ${ENVOY_CONFIG} --mode validate 2>&1 | grep -q "OK"; then
    echo "✅ 설정 파일이 유효합니다."
else
    echo "❌ 설정 파일에 오류가 있습니다!"
    envoy --config-path ${ENVOY_CONFIG} --mode validate
    exit 1
fi

echo ""

# 기존 Envoy 프로세스 종료
echo "2. 기존 Envoy 프로세스 종료 중..."
if systemctl is-active --quiet envoy 2>/dev/null; then
    echo "   systemd 서비스로 실행 중인 Envoy를 중지합니다..."
    sudo systemctl stop envoy
    sleep 2
elif pgrep -f "envoy" > /dev/null; then
    ENVOY_PID=$(pgrep -f "envoy")
    echo "   Envoy 프로세스 (PID: $ENVOY_PID)를 종료합니다..."
    sudo kill $ENVOY_PID
    sleep 2
else
    echo "   실행 중인 Envoy 프로세스가 없습니다."
fi

echo ""

# Envoy 시작
echo "3. Envoy 시작 중..."

if systemctl list-unit-files | grep -q envoy.service; then
    echo "   systemd 서비스로 Envoy를 시작합니다..."
    sudo systemctl start envoy
    sleep 2
    
    if systemctl is-active --quiet envoy; then
        echo "✅ Envoy가 정상적으로 시작되었습니다."
        echo ""
        echo "상태 확인:"
        sudo systemctl status envoy --no-pager -l | head -10
    else
        echo "❌ Envoy 시작에 실패했습니다!"
        sudo systemctl status envoy --no-pager -l
        exit 1
    fi
else
    echo "   systemd 서비스가 없습니다. 직접 실행합니다..."
    echo "   명령: envoy -c ${ENVOY_CONFIG}"
    echo ""
    echo "⚠️  백그라운드에서 실행하려면:"
    echo "   nohup envoy -c ${ENVOY_CONFIG} > /var/log/envoy.log 2>&1 &"
    echo ""
    read -p "지금 실행하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        envoy -c ${ENVOY_CONFIG} &
        sleep 2
        if pgrep -f "envoy" > /dev/null; then
            echo "✅ Envoy가 시작되었습니다. (PID: $(pgrep -f envoy))"
        else
            echo "❌ Envoy 시작에 실패했습니다!"
            exit 1
        fi
    fi
fi

echo ""
echo "=========================================="
echo "완료!"
echo "=========================================="
echo ""
echo "Envoy 관리 인터페이스: http://127.0.0.1:9901"
echo "로그 확인:"
echo "  - systemd: sudo journalctl -u envoy -f"
echo "  - 직접 실행: tail -f /var/log/envoy.log"
echo ""








