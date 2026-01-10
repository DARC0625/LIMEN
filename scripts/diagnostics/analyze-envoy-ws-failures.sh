#!/bin/bash
# Envoy WebSocket 실패 로그 분석 스크립트
# 브라우저별 실패율을 분석합니다.

set -e

echo "=========================================="
echo "Envoy WebSocket 실패 로그 분석"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 기본 설정
ENVOY_LOG="${ENVOY_LOG:-/tmp/envoy.log}"
MINUTES="${MINUTES:-10}"
LINES="${LINES:-2000}"

# 로그 파일 확인
if [ ! -f "$ENVOY_LOG" ]; then
    echo -e "${RED}✗ Envoy 로그 파일을 찾을 수 없습니다: $ENVOY_LOG${NC}"
    echo ""
    echo "Envoy 로그 파일 위치 확인:"
    echo "  - /tmp/envoy.log (기본)"
    echo "  - journalctl -u envoy (systemd)"
    echo "  - PM2 로그 (pm2 logs envoy)"
    exit 1
fi

echo "로그 파일: $ENVOY_LOG"
echo "분석 기간: 최근 ${MINUTES}분"
echo ""

# 1. /ws/ 및 /vnc/ 실패 요청 추출
echo "1. WebSocket 엔드포인트 실패 요청 (4xx, 5xx)"
echo "----------------------------------------"
echo ""

# 최근 N분간의 로그에서 /ws/ 또는 /vnc/ 경로의 4xx, 5xx 응답 추출
failures=$(tail -n $LINES "$ENVOY_LOG" | \
    grep -E '"(/ws/|/vnc/)' | \
    grep -E '"(4[0-9]{2}|5[0-9]{2})"' | \
    tail -n 50)

if [ -z "$failures" ]; then
    echo -e "${GREEN}✓ 최근 실패한 WebSocket 요청이 없습니다${NC}"
else
    echo -e "${YELLOW}⚠ 실패한 WebSocket 요청 발견:${NC}"
    echo "$failures" | while IFS= read -r line; do
        # JSON 파싱 (간단한 버전)
        path=$(echo "$line" | grep -o '"path":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        user_agent=$(echo "$line" | grep -o '"user_agent":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        request_id=$(echo "$line" | grep -o '"request_id":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        
        echo "  Status: $status | Path: $path | UA: $user_agent | Request-ID: $request_id"
    done
fi

echo ""

# 2. 브라우저별 실패 통계
echo "2. 브라우저별 실패 통계"
echo "----------------------------------------"
echo ""

# User-Agent에서 브라우저 패밀리 추출 및 카운트
tail -n $LINES "$ENVOY_LOG" | \
    grep -E '"(/ws/|/vnc/)' | \
    grep -E '"(4[0-9]{2}|5[0-9]{2})"' | \
    grep -o '"user_agent":"[^"]*"' | \
    cut -d'"' -f4 | \
    while read -r ua; do
        ua_lower=$(echo "$ua" | tr '[:upper:]' '[:lower:]')
        if echo "$ua_lower" | grep -q "chrome" && ! echo "$ua_lower" | grep -q "edg" && ! echo "$ua_lower" | grep -q "opr"; then
            echo "chrome"
        elif echo "$ua_lower" | grep -q "firefox"; then
            echo "firefox"
        elif echo "$ua_lower" | grep -q "safari" && ! echo "$ua_lower" | grep -q "chrome"; then
            echo "safari"
        elif echo "$ua_lower" | grep -q "edg"; then
            echo "edge"
        elif echo "$ua_lower" | grep -q "opr\|opera"; then
            echo "opera"
        else
            echo "unknown"
        fi
    done | sort | uniq -c | sort -rn | while read -r count browser; do
        echo "  $browser: $count 실패"
    done

echo ""

# 3. 실패 이유별 통계 (response_flags)
echo "3. 실패 이유별 통계 (Response Flags)"
echo "----------------------------------------"
echo ""

tail -n $LINES "$ENVOY_LOG" | \
    grep -E '"(/ws/|/vnc/)' | \
    grep -E '"(4[0-9]{2}|5[0-9]{2})"' | \
    grep -o '"response_flags":"[^"]*"' | \
    cut -d'"' -f4 | \
    sort | uniq -c | sort -rn | while read -r count flag; do
        if [ -z "$flag" ] || [ "$flag" = "-" ]; then
            echo "  (플래그 없음): $count"
        else
            echo "  $flag: $count"
        fi
    done

echo ""

# 4. 경로별 실패 통계
echo "4. 경로별 실패 통계"
echo "----------------------------------------"
echo ""

tail -n $LINES "$ENVOY_LOG" | \
    grep -E '"(/ws/|/vnc/)' | \
    grep -E '"(4[0-9]{2}|5[0-9]{2})"' | \
    grep -o '"path":"[^"]*"' | \
    cut -d'"' -f4 | \
    sort | uniq -c | sort -rn | head -10 | while read -r count path; do
        echo "  $path: $count 실패"
    done

echo ""

# 5. 최근 실패 상세 로그 (최근 10개)
echo "5. 최근 실패 상세 로그 (최근 10개)"
echo "----------------------------------------"
echo ""

tail -n $LINES "$ENVOY_LOG" | \
    grep -E '"(/ws/|/vnc/)' | \
    grep -E '"(4[0-9]{2}|5[0-9]{2})"' | \
    tail -n 10 | while IFS= read -r line; do
        # JSON을 보기 좋게 포맷팅 (jq가 있으면 사용)
        if command -v jq > /dev/null 2>&1; then
            echo "$line" | jq -c '{status, path, user_agent, request_id, response_flags, upgrade, origin}' 2>/dev/null || echo "$line"
        else
            echo "$line"
        fi
        echo ""
    done

echo ""
echo "=========================================="
echo "분석 완료"
echo "=========================================="
echo ""
echo "추가 명령어:"
echo "  # 최근 10분간 /ws/ /vnc/ 실패만 뽑기"
echo "  sudo tail -n 2000 $ENVOY_LOG | grep -E '\"(/ws/|/vnc/)' | grep -E '\"(4[0-9]{2}|5[0-9]{2})' | tail -n 50"
echo ""
echo "  # 특정 브라우저 실패만 필터링"
echo "  sudo tail -n 2000 $ENVOY_LOG | grep -E '\"(/ws/|/vnc/)' | grep -E '\"(4[0-9]{2}|5[0-9]{2})' | grep -i firefox"
echo ""
