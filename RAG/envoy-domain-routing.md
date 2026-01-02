# Envoy 도메인별 라우팅 설정 가이드

## 개요

같은 서버에서 여러 도메인을 포트만 다르게 운영하기 위해 Envoy를 활용한 도메인별 라우팅을 설정했습니다.

## 현재 설정

### 포트 구성
- **LIMEN 서비스**: 포트 `9444` → `limen.kr`, `www.limen.kr`
- **DARC.KR 웹사이트**: 포트 `9443` → `darc.kr`, `www.darc.kr`

### 도메인 라우팅
- `limen.kr`, `www.limen.kr` → LIMEN 프론트엔드 (포트 9444)
- `darc.kr`, `www.darc.kr` → DARC 웹사이트 (포트 9443)

## 설정 파일 위치

- **Envoy 설정**: `/home/darc/LIMEN/frontend/envoy.yaml`
- **LIMEN 프론트엔드**: `/home/darc/LIMEN/frontend/`

## 설정 단계

### 1. DNS 설정

`limen.kr` 도메인의 A 레코드를 서버 IP로 설정:

```
limen.kr.    A    [서버 IP 주소]
www.limen.kr. A    [서버 IP 주소]
```

### 2. Let's Encrypt 인증서 발급

LIMEN 도메인용 TLS 인증서 발급:

```bash
# Envoy를 일시적으로 중지 (포트 80, 443 사용)
sudo systemctl stop envoy

# 인증서 발급
sudo certbot certonly --standalone -d limen.kr -d www.limen.kr

# Envoy 재시작
sudo systemctl start envoy
```

인증서 위치:
- `/etc/letsencrypt/live/limen.kr/fullchain.pem`
- `/etc/letsencrypt/live/limen.kr/privkey.pem`

### 3. Envoy 설정 확인

`envoy.yaml` 파일이 올바르게 설정되었는지 확인:

```bash
cd /home/darc/LIMEN/frontend
envoy --config-path envoy.yaml --mode validate
```

### 4. Envoy 재시작

```bash
# systemd 사용 시
sudo systemctl restart envoy

# 또는 직접 실행 시
# 기존 프로세스 종료 후
envoy -c /home/darc/LIMEN/frontend/envoy.yaml
```

### 5. LIMEN 프론트엔드 재시작 (포트 9444)

```bash
cd /home/darc/LIMEN/frontend

# 개발 환경
npm run dev

# 프로덕션 환경
npm run build
npm run start
```

## 테스트

### HTTP 테스트
```bash
# LIMEN 서비스
curl -H "Host: limen.kr" http://localhost/
curl -H "Host: www.limen.kr" http://localhost/

# DARC 웹사이트
curl -H "Host: darc.kr" http://localhost/
```

### HTTPS 테스트
```bash
# LIMEN 서비스
curl -H "Host: limen.kr" https://localhost/ --insecure
curl -H "Host: www.limen.kr" https://localhost/ --insecure

# DARC 웹사이트
curl -H "Host: darc.kr" https://localhost/ --insecure
```

## Envoy 설정 구조

### Virtual Hosts (HTTP)
- `limen_frontend`: `limen.kr`, `www.limen.kr` → `limen_cluster`
- `darc_frontend`: `darc.kr`, `www.darc.kr` → `darc_cluster`
- `default_frontend`: `*` (fallback) → `limen_cluster`

### Clusters
- `limen_cluster`: `127.0.0.1:9444` (LIMEN Next.js)
- `darc_cluster`: `127.0.0.1:9443` (DARC 웹사이트)
- `backend_cluster`: `10.0.0.100:18443` (LIMEN 백엔드)
- `agent_cluster`: `10.0.0.100:9000` (LIMEN Agent)

### TLS 인증서
- LIMEN: `/etc/letsencrypt/live/limen.kr/`
- DARC: `/etc/letsencrypt/live/www.darc.kr/`

## 문제 해결

### 인증서 경로 오류
인증서가 다른 경로에 있다면 `envoy.yaml`의 `filename` 경로를 수정하세요.

### 포트 충돌
다른 서비스가 9443 또는 9444 포트를 사용 중인지 확인:

```bash
sudo netstat -tlnp | grep -E ':(9443|9444)'
```

### Envoy 설정 검증 실패
```bash
envoy --config-path envoy.yaml --mode validate
```

오류 메시지를 확인하고 `envoy.yaml`을 수정하세요.

## 추가 도메인 추가 방법

새로운 도메인을 추가하려면:

1. `envoy.yaml`의 `virtual_hosts`에 새 도메인 추가
2. 새 클러스터 정의 (필요한 경우)
3. HTTPS 리스너에 새 TLS 인증서 설정
4. Let's Encrypt 인증서 발급
5. Envoy 재시작

## 참고

- Envoy 관리 인터페이스: `http://127.0.0.1:9901`
- LIMEN 프론트엔드 포트: `9444`
- DARC 웹사이트 포트: `9443`

