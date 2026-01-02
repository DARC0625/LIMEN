# 프록시 쿠키 전송 문제 분석 및 해결

## 현재 아키텍처

```
외부 사용자
  ↓
Envoy (포트 443) - limen.kr
  ↓
Next.js Middleware (포트 9444)
  ↓
백엔드 (10.0.0.100:18443)
```

## 문제점

### 1. 이중 프록시 구조
- **Envoy**: `/api/` 경로를 백엔드로 직접 프록시 (`prefix_rewrite: "/api"`)
- **Next.js Middleware**: `/api/` 경로를 백엔드로 프록시
- **충돌 가능성**: 두 프록시가 모두 `/api/` 경로를 처리하려고 함

### 2. 쿠키 전송 문제
- 브라우저에서 `GET /api/auth/session` 요청에 쿠키가 없음
- 로그인 후 `Set-Cookie` 헤더가 브라우저에 전달되지 않을 수 있음

### 3. 헤더 경로 문제
- Envoy의 `prefix_rewrite: "/api"` 설정이 올바른지 확인 필요
- Next.js middleware의 경로 처리와 충돌할 수 있음

## 해결 방법

### 방법 1: Envoy에서 Next.js로 모든 요청 전달 (권장)

**장점**:
- 단일 프록시 계층 (Next.js middleware만 처리)
- 쿠키 전달이 명확함
- 디버깅이 쉬움

**변경 사항**:
```yaml
# envoy.yaml
# /api/ 경로를 Next.js로 전달 (백엔드로 직접 프록시하지 않음)
- match:
    prefix: "/api/"
  route:
    cluster: limen_cluster  # Next.js로 전달
    timeout: 60s
```

### 방법 2: Next.js Middleware 비활성화, Envoy에서 직접 처리

**장점**:
- Envoy가 직접 백엔드와 통신
- 프록시 계층 감소

**변경 사항**:
- Next.js middleware에서 `/api/` 경로 처리 제거
- Envoy에서만 처리

### 방법 3: 현재 구조 유지 + 쿠키 전달 보장

**현재 구조 유지**:
- Envoy: `/api/` → 백엔드 직접
- Next.js Middleware: `/api/` → 백엔드 직접

**문제점**:
- 두 프록시가 모두 처리하려고 하면 충돌 가능
- 쿠키 전달 경로가 불명확

## 현재 확인 사항

### 1. 실제 요청 경로 확인
브라우저 개발자 도구 → Network 탭에서:
- `GET /api/auth/session` 요청의 실제 경로 확인
- Envoy를 거치는지, Next.js middleware를 거치는지 확인

### 2. 쿠키 설정 확인
로그인 후:
- `POST /api/auth/login` 응답의 `Set-Cookie` 헤더 확인
- 브라우저 `Application` → `Cookies`에서 `refresh_token` 확인

### 3. 프록시 로그 확인
```bash
# Next.js middleware 로그
pm2 logs limen-frontend --lines 100 | grep -i "session\|cookie"

# Envoy 로그 (있는 경우)
journalctl -u envoy -n 100 | grep -i "session\|cookie"
```

## 권장 해결책

### 단계 1: 요청 경로 확인
브라우저 개발자 도구에서 실제 요청 경로 확인

### 단계 2: Envoy 설정 변경 (방법 1 권장)
모든 `/api/` 요청을 Next.js로 전달하도록 변경

### 단계 3: 쿠키 전달 보장
Next.js middleware에서 쿠키 전달 로직 강화

## 디버깅 명령어

### Next.js Middleware 로그 확인
```bash
pm2 logs limen-frontend --lines 200 | grep -E "Proxy|session|cookie|Cookie"
```

### 실제 요청 테스트
```bash
# 로그인 요청
curl -v -X POST https://limen.kr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  -c cookies.txt

# 쿠키 확인
cat cookies.txt

# 세션 확인 (쿠키 포함)
curl -v https://limen.kr/api/auth/session \
  -b cookies.txt \
  -H "Content-Type: application/json"
```

## 다음 단계

1. **요청 경로 확인**: 브라우저에서 실제로 어떤 프록시를 거치는지 확인
2. **Envoy 설정 검토**: `/api/` 경로 처리 방식 확인
3. **쿠키 전달 보장**: 프록시에서 쿠키가 제대로 전달되는지 확인




