# 백엔드-Envoy 연결 진단 가이드

## 백엔드 측 확인 결과

### ✅ 정상 동작 확인

1. **백엔드 서버 실행 상태**
   - 백엔드 서버가 정상적으로 실행 중입니다
   - 프로세스 ID: 확인됨

2. **포트 리스닝 상태**
   - 포트 18443에서 정상 리스닝 중
   - 모든 인터페이스 (`*:18443`)에서 접근 가능

3. **헬스체크 엔드포인트**
   - 경로: `/api/health`
   - 로컬 접근: `http://localhost:18443/api/health` ✅
   - 외부 IP 접근: `http://10.0.0.100:18443/api/health` ✅
   - 응답 상태: `200 OK`
   - 응답 내용:
     ```json
     {
       "status": "ok",
       "db": "connected",
       "libvirt": "connected",
       "time": "2025-12-28T20:07:07+09:00"
     }
     ```

4. **네트워크 인터페이스**
   - 백엔드 서버 IP: `10.0.0.100`
   - 추가 IP 주소:
     - `127.0.0.1` (localhost)
     - `10.255.255.254`
     - `61.73.245.105`
     - `192.168.122.1`

5. **방화벽 규칙**
   - iptables 규칙 없음 (모든 트래픽 허용 상태)

## Envoy 서버에서 확인할 사항

### 1. Envoy 프록시 실행 상태 확인

```bash
# Envoy 프로세스 확인
ps aux | grep envoy

# Envoy 포트 확인 (80, 443)
netstat -tlnp | grep -E "(80|443)"
# 또는
ss -tlnp | grep -E "(80|443)"
```

**예상 결과:**
- Envoy 프로세스가 실행 중이어야 함
- 포트 80, 443에서 리스닝 중이어야 함

### 2. Envoy에서 백엔드 연결 테스트

```bash
# HTTP 연결 테스트
curl -v http://10.0.0.100:18443/api/health

# TCP 연결 테스트
telnet 10.0.0.100 18443
```

**예상 결과:**
- HTTP 200 응답
- TCP 연결 성공

### 3. Envoy 클러스터 상태 확인

```bash
# Envoy 관리 인터페이스로 클러스터 상태 확인
curl http://localhost:9901/clusters | grep backend_cluster

# 전체 클러스터 상태 확인
curl http://localhost:9901/clusters
```

**확인 사항:**
- `backend_cluster`가 `healthy` 상태인지 확인
- `frontend_cluster` 상태도 함께 확인

### 4. Envoy 로그 확인

```bash
# 최근 100줄 로그 확인
journalctl -u envoy -n 100 --no-pager | grep -i "503\|error\|unhealthy"

# 실시간 로그 모니터링
journalctl -u envoy -f

# 또는 로그 파일 확인
tail -f /var/log/envoy/error.log
```

**확인 사항:**
- 503 에러 발생 여부
- 백엔드 클러스터 연결 실패 메시지
- 헬스체크 실패 메시지

### 5. Envoy 설정 파일 확인

```bash
# Envoy 설정 파일 위치 확인 (일반적으로)
/etc/envoy/envoy.yaml
# 또는
/opt/envoy/config/envoy.yaml
```

**확인 사항:**
- 백엔드 클러스터 엔드포인트: `10.0.0.100:18443`
- 헬스체크 경로: `/api/health`
- 헬스체크 간격 및 타임아웃 설정

**예상 설정 예시:**
```yaml
clusters:
  - name: backend_cluster
    connect_timeout: 5s
    type: LOGICAL_DNS
    dns_lookup_family: V4_ONLY
    load_assignment:
      cluster_name: backend_cluster
      endpoints:
        - lb_endpoints:
            - endpoint:
                address:
                  socket_address:
                    address: 10.0.0.100
                    port_value: 18443
    health_checks:
      - timeout: 3s
        interval: 10s
        unhealthy_threshold: 3
        healthy_threshold: 2
        http_health_check:
          path: /api/health
          expected_statuses:
            - start: 200
              end: 299
```

## 문제 해결 체크리스트

### 백엔드 측 (이미 확인 완료 ✅)

- [x] 백엔드 서버 실행 중
- [x] 포트 18443 리스닝 중
- [x] `/api/health` 엔드포인트 정상 응답
- [x] 외부 IP에서 접근 가능 (`10.0.0.100:18443`)

### Envoy 서버 측 (확인 필요)

- [ ] Envoy 프로세스 실행 중
- [ ] Envoy 포트 80, 443 리스닝 중
- [ ] Envoy에서 백엔드로 연결 가능 (`10.0.0.100:18443`)
- [ ] 백엔드 클러스터가 `healthy` 상태
- [ ] Envoy 로그에 503 에러 없음
- [ ] Envoy 설정 파일의 백엔드 엔드포인트가 올바름
- [ ] 헬스체크 경로가 `/api/health`로 설정됨
- [ ] 네트워크 방화벽이 Envoy → 백엔드 연결을 허용

### 프론트엔드 클러스터 (확인 필요)

- [ ] 프론트엔드 클러스터가 `healthy` 상태
- [ ] Envoy에서 프론트엔드 서버(`localhost:9443`)로 연결 가능
- [ ] 프론트엔드 헬스체크가 정상 동작

## 진단 스크립트 실행

백엔드 서버에서 다음 스크립트를 실행하여 자동 진단:

```bash
cd /home/darc0/projects/LIMEN
./scripts/diagnostics/backend-envoy-check.sh
```

## 일반적인 문제 및 해결 방법

### 문제 1: Envoy가 백엔드에 연결할 수 없음

**증상:**
- Envoy 로그에 "connection refused" 또는 "timeout" 에러
- 백엔드 클러스터가 `unhealthy` 상태

**해결 방법:**
1. Envoy 서버에서 백엔드로의 네트워크 연결 확인:
   ```bash
   telnet 10.0.0.100 18443
   ```
2. 방화벽 규칙 확인:
   ```bash
   # Envoy 서버에서
   iptables -L OUTPUT -n -v | grep 10.0.0.100
   ```
3. 백엔드 서버의 방화벽 확인:
   ```bash
   # 백엔드 서버에서
   iptables -L INPUT -n -v | grep 18443
   ```

### 문제 2: 헬스체크 실패

**증상:**
- 백엔드 클러스터가 `unhealthy` 상태
- Envoy 로그에 헬스체크 실패 메시지

**해결 방법:**
1. 헬스체크 경로 확인:
   ```bash
   # Envoy 서버에서
   curl -v http://10.0.0.100:18443/api/health
   ```
2. Envoy 설정의 헬스체크 경로 확인: `/api/health`
3. 헬스체크 타임아웃 및 간격 조정

### 문제 3: 프론트엔드 클러스터 연결 실패

**증상:**
- 503 에러 발생
- 프론트엔드 클러스터가 `unhealthy` 상태

**해결 방법:**
1. 프론트엔드 서버 실행 상태 확인:
   ```bash
   # Envoy 서버에서
   curl -v http://localhost:9443
   ```
2. 프론트엔드 헬스체크 경로 확인
3. Envoy 설정의 프론트엔드 클러스터 엔드포인트 확인

## 연락처

문제가 지속되면 다음 정보와 함께 백엔드 팀에 문의하세요:

- Envoy 로그 (최근 100줄)
- Envoy 클러스터 상태 (`curl http://localhost:9901/clusters`)
- Envoy 설정 파일 (민감 정보 제외)
- 네트워크 연결 테스트 결과








