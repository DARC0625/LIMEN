# 백엔드 503 에러 해결 가이드

## 문제 상황
- 프론트엔드에서 `www.darc.kr`을 통해 접근 시 503 Service Unavailable 에러 발생
- 백엔드 서버(`10.0.0.100:18443`)는 정상 응답 (HTTP 200)
- Envoy 프록시가 503 에러를 반환

## 백엔드에서 확인해야 할 사항

### 1. Envoy 프록시 실행 상태 확인
```bash
# Envoy 프로세스 확인
ps aux | grep envoy

# Envoy 포트 리스닝 확인 (일반적으로 80, 443, 8080 등)
netstat -tlnp | grep envoy
# 또는
ss -tlnp | grep envoy
```

### 2. Envoy가 백엔드에 연결 가능한지 확인
```bash
# Envoy 서버에서 백엔드로 직접 연결 테스트
curl -v http://10.0.0.100:18443/api/health

# 네트워크 연결 테스트
telnet 10.0.0.100 18443
# 또는
nc -zv 10.0.0.100 18443
```

### 3. Envoy 헬스체크 응답 확인
Envoy 설정(`envoy.yaml`)에서 헬스체크 경로가 `/api/health`로 설정되어 있습니다.
```bash
# 헬스체크 엔드포인트 직접 테스트
curl -v http://10.0.0.100:18443/api/health
```

### 4. Envoy 로그 확인
```bash
# Envoy 로그 확인 (로그 파일 위치는 설정에 따라 다름)
tail -f /var/log/envoy/access.log
tail -f /var/log/envoy/error.log

# 또는 systemd로 실행 중인 경우
journalctl -u envoy -f
```

### 5. 네트워크 방화벽 규칙 확인
```bash
# Envoy 서버에서 백엔드 서버로의 아웃바운드 연결 허용 확인
iptables -L -n | grep 18443
# 또는
ufw status | grep 18443
```

### 6. 백엔드 CORS 설정 확인
백엔드가 `www.darc.kr` 오리진에서의 요청을 허용하는지 확인:
- `Access-Control-Allow-Origin` 헤더 설정
- `Access-Control-Allow-Methods` 헤더 설정
- `Access-Control-Allow-Headers` 헤더 설정

### 7. Envoy 클러스터 상태 확인
Envoy 관리 인터페이스를 통해 클러스터 상태 확인:
```bash
# Envoy 관리 포트로 클러스터 상태 확인 (일반적으로 9901)
curl http://localhost:9901/clusters | grep backend_cluster
```

## 가능한 원인 및 해결 방법

### 원인 1: Envoy가 백엔드를 unhealthy로 표시
- **증상**: 헬스체크 실패로 인한 자동 차단
- **해결**: 
  - 백엔드 헬스체크 엔드포인트(`/api/health`)가 정상 응답하는지 확인
  - Envoy 헬스체크 설정 확인 (timeout, interval, threshold)

### 원인 2: 네트워크 연결 문제
- **증상**: Envoy가 백엔드에 연결할 수 없음
- **해결**:
  - 방화벽 규칙 확인
  - 네트워크 라우팅 확인
  - 백엔드 서버가 실제로 `10.0.0.100:18443`에서 리스닝하는지 확인

### 원인 3: Envoy 설정 오류
- **증상**: 잘못된 클러스터 또는 라우팅 설정
- **해결**:
  - `envoy.yaml` 설정 파일 검증
  - Envoy 설정 리로드: `kill -HUP <envoy_pid>`

### 원인 4: 백엔드 서버 과부하
- **증상**: 백엔드가 요청을 처리할 수 없음
- **해결**:
  - 백엔드 서버 리소스 확인 (CPU, 메모리)
  - 백엔드 로그 확인
  - 백엔드 서버 재시작

## 즉시 확인할 명령어

```bash
# 1. Envoy 실행 상태
ps aux | grep envoy

# 2. 백엔드 연결 테스트 (Envoy 서버에서 실행)
curl -v http://10.0.0.100:18443/api/health

# 3. Envoy 관리 인터페이스 확인
curl http://localhost:9901/clusters

# 4. Envoy 로그 확인
journalctl -u envoy -n 50 --no-pager
```

## 프론트엔드 설정 확인

프론트엔드는 프로덕션 환경에서 `/api` 경로를 통해 Envoy 프록시를 통해 백엔드에 접근합니다.
- 개발 환경: 직접 `http://10.0.0.100:18443/api` 연결
- 프로덕션 환경: `/api` → Envoy → `http://10.0.0.100:18443/api`

## 참고
- Envoy 설정 파일: `frontend/envoy.yaml`
- 백엔드 헬스체크 엔드포인트: `/api/health`
- 백엔드 주소: `10.0.0.100:18443`








