# 보안 강화 가이드

> [← 운영](../operations-guide.md) | [보안](./hardening.md)

## 개요

LIMEN 시스템의 보안 강화 기능과 설정 방법을 설명합니다.

> **참고**: 향후 스위치 도입 및 스노트(Snort) 규칙 기반 방화벽/IPS 기능을 직접 개발할 예정입니다.  
> 네트워크 레벨 보안 기능(IP 기반 접근 제어 등)은 해당 시스템에서 처리될 예정이므로,  
> 현재 애플리케이션 레벨 보안 기능은 선택적으로 사용하거나 네트워크 레벨 보안의 보완 역할로 활용됩니다.

---

## 적용된 보안 기능

### 1. IP 화이트리스트 ✅

**목적**: 관리자 엔드포인트에 대한 접근 제한

**기능**:
- 관리자 엔드포인트(`/api/admin/*`)에 대한 IP 기반 접근 제어
- 개별 IP 주소 또는 CIDR 범위 지원
- 비어 있으면 모든 IP 허용 (제한 없음)

> **참고**: 향후 스위치/방화벽에서 네트워크 레벨 IP 필터링을 제공할 예정입니다.  
> 현재 기능은 애플리케이션 레벨의 추가 보안 계층으로, 네트워크 레벨 보안의 보완 역할을 합니다.  
> 네트워크 레벨 보안이 구축되면 이 기능은 선택적으로 사용하거나 비활성화할 수 있습니다.

**설정 방법**:

```bash
# 환경 변수 설정
ADMIN_IP_WHITELIST=192.168.1.100,10.0.0.0/8,127.0.0.1
```

**예시**:
- `192.168.1.100`: 특정 IP만 허용
- `10.0.0.0/8`: 사설 네트워크 전체 허용
- `127.0.0.1,::1`: 로컬호스트만 허용

**적용 범위**:
- `/api/admin/users` (모든 메서드)
- `/api/admin/users/{id}/role`
- `/api/admin/users/{id}/approve`

---

### 2. Rate Limiting 세분화 ✅

**목적**: 엔드포인트별 요청 제한으로 DDoS 공격 방지

**기능**:
- 엔드포인트별 다른 Rate Limit 설정
- IP 기반 제한
- Burst 크기 조정 가능

> **참고**: Rate Limiting은 애플리케이션 레벨에서 필요한 기능으로 유지됩니다.  
> 네트워크 레벨 DDoS 방어와 함께 다층 방어 전략의 일부로 작동합니다.

**기본 설정**:

| 엔드포인트 | RPS | Burst | 설명 |
|-----------|-----|-------|------|
| 기본 | 10 | 20 | 모든 엔드포인트 기본값 |
| `/api/vms` | 5 | 10 | VM 작업 (생성, 삭제 등) |
| `/api/admin` | 2 | 5 | 관리자 작업 (엄격) |
| `/api/snapshots` | 3 | 6 | 스냅샷 작업 |
| `/api/quota` | 5 | 10 | 할당량 조회 |
| `/api/metrics` | 10 | 20 | 메트릭스 조회 |
| `/agent/metrics` | 10 | 20 | 에이전트 메트릭스 |

**제외된 엔드포인트**:
- `/api/health`: 헬스 체크
- `/api/auth/login`: 로그인
- `/api/auth/register`: 회원가입

**응답 헤더**:
```
Retry-After: 1
```

---

### 3. 보안 스캔 자동화 ✅

**목적**: CI/CD 파이프라인에서 자동 보안 검사

**구현된 스캔**:

#### Trivy (취약점 스캔)
- 파일 시스템 스캔
- Go 의존성 스캔
- Rust 의존성 스캔
- 심각도: CRITICAL, HIGH, MEDIUM
- 결과: GitHub Security 탭에 업로드

#### Gosec (Go 보안 검사)
- SQL Injection 검사
- Command Injection 검사
- 파일 시스템 접근 검사
- 암호화 사용 검사
- 결과: JSON 리포트 생성

**CI/CD 통합**:
```yaml
# .github/workflows/ci.yml
security:
  name: Security Scan
  steps:
    - Run Trivy vulnerability scanner
    - Run Go security check (gosec)
    - Upload results to GitHub Security
```

**실행 시점**:
- 모든 PR
- main/develop 브랜치 푸시

---

### 4. 보안 헤더 강화 ✅

**적용된 보안 헤더**:

#### X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
- MIME 타입 스니핑 방지

#### X-Frame-Options
```
X-Frame-Options: DENY
```
- Clickjacking 공격 방지

#### X-XSS-Protection
```
X-XSS-Protection: 1; mode=block
```
- XSS 공격 방지 (레거시 브라우저 지원)

#### Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
- Referrer 정보 제어

#### Permissions-Policy
```
Permissions-Policy: geolocation=(), microphone=(), camera=(), ...
```
- 브라우저 기능 제한

#### Content-Security-Policy (CSP)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; ...
```
- 콘텐츠 보안 정책
- Swagger UI 지원 (unpkg.com 허용)
- `upgrade-insecure-requests`: HTTP → HTTPS 자동 업그레이드

#### Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
- HTTPS만 사용 강제 (HTTPS 사용 시)
- 1년 유효기간
- 서브도메인 포함
- 브라우저 preload 리스트 지원

---

## 보안 설정 가이드

### 프로덕션 환경 설정

#### 1. IP 화이트리스트 활성화

```bash
# .env 파일
ADMIN_IP_WHITELIST=192.168.1.100,10.0.0.0/8
```

**권장 사항**:
- 관리자 IP만 허용
- VPN IP 범위 포함
- 로컬호스트 포함 (필요 시)

#### 2. Rate Limiting 조정

```bash
# .env 파일
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPS=10
RATE_LIMIT_BURST=20
```

**프로덕션 권장값**:
- 일반 API: 5-10 RPS
- 관리자 API: 2-5 RPS
- 메트릭스: 10-20 RPS

#### 3. CORS 설정

```bash
# .env 파일
ALLOWED_ORIGINS=https://www.darc.kr,https://darc.kr
```

**주의**: 프로덕션에서는 `*` 사용 금지

#### 4. HTTPS 강제

리버스 프록시(Nginx/Envoy)에서 HTTPS 설정:

```nginx
server {
    listen 443 ssl http2;
    server_name api.darc.kr;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:18443;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 보안 모니터링

### 로그 확인

```bash
# IP 화이트리스트 차단 로그
sudo journalctl -u limen.service | grep "IP not in whitelist"

# Rate Limit 차단 로그
sudo journalctl -u limen.service | grep "Rate limit exceeded"
```

### 메트릭스 확인

```bash
# Rate Limit 메트릭스
curl http://localhost:18443/api/metrics | grep rate_limit
```

---

## 보안 체크리스트

### 배포 전 확인사항

- [ ] IP 화이트리스트 설정 (프로덕션)
- [ ] Rate Limiting 활성화 및 조정
- [ ] CORS 허용 오리진 제한
- [ ] HTTPS 설정 및 인증서 유효성 확인
- [ ] JWT Secret 변경 (기본값 사용 금지)
- [ ] 관리자 비밀번호 변경
- [ ] 데이터베이스 비밀번호 강화
- [ ] 보안 스캔 통과 확인

### 정기 점검사항

- [ ] 의존성 취약점 스캔 (주 1회)
- [ ] 보안 로그 검토 (일 1회)
- [ ] Rate Limit 통계 확인 (주 1회)
- [ ] IP 화이트리스트 검토 (월 1회)
- [ ] 보안 헤더 확인 (월 1회)

---

## 문제 해결

### IP 화이트리스트 차단

**증상**: 관리자 엔드포인트 접근 불가

**해결**:
1. 현재 IP 확인
2. `ADMIN_IP_WHITELIST`에 추가
3. 서비스 재시작

```bash
# 현재 IP 확인
curl ifconfig.me

# 환경 변수 업데이트
export ADMIN_IP_WHITELIST=YOUR_IP_HERE

# 서비스 재시작
sudo systemctl restart limen.service
```

### Rate Limit 초과

**증상**: `429 Too Many Requests` 응답

**해결**:
1. 요청 빈도 확인
2. Rate Limit 설정 조정 (필요 시)
3. Burst 크기 증가

```bash
# Rate Limit 설정 확인
sudo systemctl show limen.service | grep RATE_LIMIT

# 설정 변경
export RATE_LIMIT_RPS=20
export RATE_LIMIT_BURST=40
sudo systemctl restart limen.service
```

---

## 관련 문서

- [운영 가이드](../operations-guide.md)
- [성능 최적화](../../03-deployment/performance/optimization.md)
- [CI/CD 설정](../../03-deployment/ci-cd/setup.md)

---

**태그**: `#보안` `#강화` `#IP-화이트리스트` `#Rate-Limiting` `#보안-스캔`

**마지막 업데이트**: 2024-12-23

