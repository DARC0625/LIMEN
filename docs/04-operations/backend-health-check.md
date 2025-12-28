# 백엔드 상태 점검 가이드

## 빠른 점검 명령어

### 1. 서버 실행 상태
```bash
ps aux | grep './server' | grep -v grep
lsof -ti:18443
```

### 2. Health Check
```bash
curl http://localhost:18443/api/health
```

**정상 응답:**
```json
{
  "status": "ok",
  "db": "connected",
  "libvirt": "connected",
  "time": "2025-12-28T21:20:40+09:00"
}
```

### 3. 의존 서비스 확인
```bash
# PostgreSQL
ps aux | grep postgres | grep -v grep

# Libvirt
ps aux | grep libvirtd | grep -v grep

# Agent
curl http://localhost:9000/metrics
```

### 4. 로그 확인
```bash
# 최근 로그
tail -50 /home/darc0/projects/LIMEN/backend/server.log

# 에러만 확인
tail -100 /home/darc0/projects/LIMEN/backend/server.log | grep -E "(error|fatal|panic)"
```

### 5. 리소스 사용량
```bash
# 메모리
free -h

# CPU
top -bn1 | grep "Cpu(s)"

# 디스크
df -h /home/darc0/projects/LIMEN
```

## 정기 점검 체크리스트

### 일일 점검
- [ ] 서버 실행 상태 확인
- [ ] Health check 응답 확인
- [ ] 에러 로그 확인
- [ ] 리소스 사용량 확인

### 주간 점검
- [ ] 로그 파일 크기 확인
- [ ] 데이터베이스 연결 풀 상태
- [ ] Libvirt 연결 상태
- [ ] Agent 서비스 상태
- [ ] 디스크 사용량 확인

### 월간 점검
- [ ] 로그 로테이션 확인
- [ ] 보안 업데이트 확인
- [ ] 성능 메트릭 분석
- [ ] 백업 상태 확인

## 문제 해결

### 서버가 실행되지 않는 경우
```bash
cd /home/darc0/projects/LIMEN/backend
go build ./cmd/server
./server > server.log 2>&1 &
```

### Health check 실패
1. 데이터베이스 연결 확인
2. Libvirt 연결 확인
3. 포트 충돌 확인: `lsof -ti:18443`

### 에러 로그 확인
```bash
tail -100 server.log | grep -E "(error|fatal|panic)" -A 5
```

## 자동화 스크립트

점검 스크립트를 만들어서 정기적으로 실행할 수 있습니다:

```bash
#!/bin/bash
# backend-health-check.sh

echo "=== 백엔드 상태 점검 ==="
echo ""

echo "1. 서버 실행 상태:"
if ps aux | grep './server' | grep -v grep > /dev/null; then
    echo "✅ 서버 실행 중"
else
    echo "❌ 서버 미실행"
fi

echo ""
echo "2. Health Check:"
HEALTH=$(curl -s http://localhost:18443/api/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo "✅ Health check 통과"
    echo "$HEALTH" | jq .
else
    echo "❌ Health check 실패"
    echo "$HEALTH"
fi

echo ""
echo "3. 의존 서비스:"
if ps aux | grep postgres | grep -v grep > /dev/null; then
    echo "✅ PostgreSQL 실행 중"
else
    echo "❌ PostgreSQL 미실행"
fi

if ps aux | grep libvirtd | grep -v grep > /dev/null; then
    echo "✅ Libvirt 실행 중"
else
    echo "❌ Libvirt 미실행"
fi

if curl -s http://localhost:9000/metrics > /dev/null 2>&1; then
    echo "✅ Agent 서비스 정상"
else
    echo "❌ Agent 서비스 미응답"
fi

echo ""
echo "4. 최근 에러:"
ERROR_COUNT=$(tail -100 /home/darc0/projects/LIMEN/backend/server.log | grep -E "(error|fatal|panic)" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ 에러 없음"
else
    echo "⚠️  $ERROR_COUNT 개의 에러 발견"
    tail -100 /home/darc0/projects/LIMEN/backend/server.log | grep -E "(error|fatal|panic)" | tail -5
fi
```

## 모니터링 권장사항

1. **Prometheus 메트릭스 수집** (향후 구현)
2. **Grafana 대시보드** (향후 구현)
3. **알림 설정** (에러 발생 시 Slack/Discord 알림)
4. **로그 집중화** (ELK Stack 등)








