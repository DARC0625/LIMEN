# Envoy 프론트엔드 클러스터 IP 주소 수정 가이드

## 문제
Envoy 설정에서 프론트엔드 클러스터가 `127.0.0.1:9443` (로컬호스트)로 설정되어 있습니다.

## 확인 사항

### 1. Envoy와 Next.js가 같은 서버에서 실행되는가?
- **같은 서버**: `127.0.0.1` 사용 가능 (현재 설정 유지)
- **다른 서버**: 실제 IP 주소 사용 필요

### 2. 현재 서버 IP 확인
```bash
hostname -I
# 또는
ip addr show | grep "inet " | grep -v "127.0.0.1"
```

## 해결 방법

### 경우 1: 같은 서버에서 실행 (현재 설정 유지)
Envoy와 Next.js가 같은 서버(`10.0.0.10`)에서 실행 중이라면:
- `127.0.0.1:9443` 설정 유지 가능
- Next.js 서버가 `127.0.0.1:9443`에서 리스닝하는지 확인 필요

### 경우 2: 다른 서버에서 실행 (IP 주소 변경 필요)
Next.js가 다른 서버에서 실행 중이라면:

#### Envoy 설정 수정 (`envoy.yaml`)
```yaml
clusters:
  - name: frontend_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: frontend_cluster
      endpoints:
        - lb_endpoints:
            - endpoint:
                address:
                  socket_address:
                    address: 10.0.0.10  # 실제 Next.js 서버 IP
                    port_value: 9443
```

#### 또는 도메인 사용
```yaml
address:
  socket_address:
    address: frontend-server.example.com  # Next.js 서버 도메인
    port_value: 9443
```

## 확인 명령어

### Envoy 서버에서 실행
```bash
# 1. Next.js 서버가 어느 IP에서 리스닝하는지 확인
netstat -tlnp | grep 9443
# 또는
ss -tlnp | grep 9443

# 2. 로컬호스트로 연결 테스트
curl -v http://127.0.0.1:9443/

# 3. 실제 IP로 연결 테스트 (다른 서버인 경우)
curl -v http://10.0.0.10:9443/
```

## 권장 사항

### 프로덕션 환경
- 환경 변수나 설정 파일을 통해 IP 주소 관리
- 예: `FRONTEND_SERVER_IP` 환경 변수 사용

### 개발 환경
- 같은 서버에서 실행: `127.0.0.1` 사용
- 다른 서버에서 실행: 실제 IP 사용

## 현재 설정 확인
```bash
# Envoy 설정 파일에서 프론트엔드 클러스터 확인
grep -A 15 "frontend_cluster" /path/to/envoy.yaml
```

## 참고
- 현재 서버 IP: `10.0.0.10`
- 백엔드 IP: `10.0.0.100`
- 프론트엔드 포트: `9443`








