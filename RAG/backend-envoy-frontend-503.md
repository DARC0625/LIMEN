# Envoy 프론트엔드 클러스터 503 에러 해결 가이드

## 문제 상황
- 백엔드 서버는 정상 동작 중 (HTTP 200)
- Envoy가 프론트엔드 클러스터에 연결하지 못해 503 에러 발생
- Envoy 설정: `frontend_cluster` → `127.0.0.1:9443` (로컬호스트 주소)

**⚠️ 중요**: `127.0.0.1`은 로컬호스트 주소입니다. Envoy와 Next.js가 같은 서버에서 실행 중이 아니라면 실제 IP 주소를 사용해야 합니다.

## Envoy 서버에서 확인해야 할 사항

### 1. 프론트엔드 서버(Next.js) 실행 상태 확인
```bash
# Next.js 개발 서버가 9443 포트에서 실행 중인지 확인
ps aux | grep "next dev"
netstat -tlnp | grep 9443
# 또는
ss -tlnp | grep 9443
```

### 2. 프론트엔드 서버 연결 테스트
```bash
# Envoy 서버에서 프론트엔드 서버로 직접 연결 테스트
curl -v http://127.0.0.1:9443/
curl -v http://127.0.0.1:9443/api/health_proxy
```

### 3. Envoy 클러스터 상태 확인
```bash
# 프론트엔드 클러스터 상태 확인
curl http://localhost:9901/clusters | grep frontend_cluster

# 예상 출력에서 확인할 사항:
# - healthy 상태인지
# - unhealthy 상태인지
# - timeout 에러인지
```

### 4. Envoy 헬스체크 로그 확인
```bash
# Envoy 로그에서 헬스체크 실패 메시지 확인
journalctl -u envoy -n 100 --no-pager | grep -i "frontend\|health\|9443"

# 또는
tail -f /var/log/envoy/access.log | grep health_proxy
```

### 5. 프론트엔드 서버 주소 확인
Envoy 설정에서 프론트엔드 클러스터가 `127.0.0.1:9443`로 설정되어 있습니다.
- Envoy와 Next.js가 같은 서버에서 실행 중이어야 함
- 다른 서버에서 실행 중이라면 IP 주소로 변경 필요

## 가능한 원인 및 해결 방법

### 원인 1: Next.js 개발 서버가 실행되지 않음
**증상**: `127.0.0.1:9443`에 연결할 수 없음

**해결**:
```bash
# Next.js 개발 서버 시작
cd /home/darc/LIMEN/frontend
npm run dev
```

### 원인 2: 헬스체크 경로 실패
**증상**: `/api/health_proxy`가 404 또는 다른 에러 반환

**해결**:
- Next.js `next.config.js`의 rewrites 설정 확인
- `/api/health_proxy`가 백엔드로 제대로 프록시되는지 확인
- 또는 헬스체크 경로를 `/`로 변경 고려

### 원인 3: 프론트엔드 클러스터가 unhealthy 상태
**증상**: 헬스체크 실패로 인한 자동 차단

**해결**:
```bash
# Envoy 클러스터 상태 확인
curl http://localhost:9901/clusters | grep -A 10 frontend_cluster

# unhealthy 상태라면:
# 1. Next.js 서버가 정상 실행 중인지 확인
# 2. 헬스체크 경로가 정상 응답하는지 확인
# 3. Envoy 설정 리로드: kill -HUP <envoy_pid>
```

### 원인 4: Envoy와 Next.js가 다른 서버에서 실행
**증상**: `127.0.0.1:9443`에 연결할 수 없음 (다른 서버에서는 로컬호스트에 접근 불가)

**해결**:
- Envoy 설정에서 프론트엔드 클러스터 주소를 실제 Next.js 서버 IP로 변경
- 예: `address: 10.0.0.10` (실제 Next.js 서버 IP)
- **상세 가이드**: `docs/envoy-frontend-ip-fix.md` 참고

## 즉시 확인할 명령어 (Envoy 서버에서 실행)

```bash
# 1. Next.js 서버 실행 상태
ps aux | grep "next dev"
netstat -tlnp | grep 9443

# 2. 프론트엔드 서버 연결 테스트
curl -v http://127.0.0.1:9443/
curl -v http://127.0.0.1:9443/api/health_proxy

# 3. Envoy 클러스터 상태
curl http://localhost:9901/clusters | grep -A 5 frontend_cluster

# 4. Envoy 로그 확인
journalctl -u envoy -n 50 --no-pager | grep -i "frontend\|503\|unhealthy"
```

## Envoy 설정 수정이 필요한 경우

### 프론트엔드 클러스터 주소 변경
만약 Next.js가 다른 서버에서 실행 중이라면:

```yaml
# envoy.yaml
clusters:
  - name: frontend_cluster
    # ...
    endpoints:
      - lb_endpoints:
          - endpoint:
              address:
                socket_address:
                  address: 10.0.0.10  # 실제 Next.js 서버 IP
                  port_value: 9443
```

### 헬스체크 경로 변경
만약 `/api/health_proxy`가 작동하지 않는다면:

```yaml
health_checks:
  - http_health_check:
      path: "/"  # 또는 다른 경로
      expected_statuses:
        - start: 200
          end: 399
```

## 참고
- Envoy 설정 파일: `frontend/envoy.yaml`
- 프론트엔드 클러스터: `127.0.0.1:9443`
- 헬스체크 경로: `/api/health_proxy`
- Next.js 개발 서버: `npm run dev --port 9443`

