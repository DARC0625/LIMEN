# 백엔드 도메인 변경 조치 사항

## 개요
LIMEN 서비스가 `limen.kr` 및 `www.limen.kr` 도메인으로 이전되었습니다. 
기존 `darc.kr` 도메인과 동일한 IP에서 포트만 다르게 운영됩니다.

## 도메인 구성
- **LIMEN 서비스**: `limen.kr`, `www.limen.kr` → 포트 9444
- **DARC 웹사이트**: `darc.kr`, `www.darc.kr` → 포트 9443
- **백엔드 API**: `10.0.0.100:18443`
- **Agent 서비스**: `10.0.0.100:9000`

## 백엔드에서 조치해야 할 사항

### 1. CORS 설정 업데이트

백엔드 API 서버의 CORS 설정에 새로운 도메인을 추가해야 합니다.

```python
# 예시: Flask/FastAPI CORS 설정
CORS_ORIGINS = [
    "https://limen.kr",
    "https://www.limen.kr",
    "https://darc.kr",
    "https://www.darc.kr",
    "http://localhost:3000",  # 개발 환경
    "http://localhost:9444",  # 개발 환경
]
```

**조치 위치**: 백엔드 CORS 미들웨어/설정 파일

### 2. JWT 토큰 발급 시 도메인 검증

JWT 토큰 발급 시 `iss` (issuer) 또는 `aud` (audience) 클레임에 새 도메인을 포함할 수 있습니다.
(선택 사항 - 현재 구조에서 필수는 아님)

### 3. WebSocket 연결 허용 도메인

WebSocket 서버에서 연결을 허용할 도메인 목록을 업데이트해야 합니다.

```python
# WebSocket 연결 허용 도메인
ALLOWED_ORIGINS = [
    "https://limen.kr",
    "https://www.limen.kr",
    "https://darc.kr",
    "https://www.darc.kr",
    "http://localhost:3000",
    "http://localhost:9444",
]
```

**조치 위치**: WebSocket 서버 설정 파일

### 4. 로그 및 모니터링 도메인 추가

로그 분석, 모니터링 시스템에 새 도메인을 추가하여 트래픽을 구분할 수 있도록 합니다.

**조치 위치**: 로그 수집/분석 시스템 설정

### 5. API 문서 업데이트

API 문서(예: Swagger/OpenAPI)에 새로운 도메인 예시를 추가합니다.

**조치 위치**: API 문서 설정 파일

### 6. 환경 변수 확인

백엔드 환경 변수에서 프론트엔드 URL 참조가 있다면 업데이트합니다.

```bash
# 예시 환경 변수
FRONTEND_URL=https://limen.kr
ALLOWED_ORIGINS=https://limen.kr,https://www.limen.kr,https://darc.kr,https://www.darc.kr
```

**조치 위치**: `.env` 파일 또는 환경 변수 설정

### 7. 세션/쿠키 도메인 설정 (해당 시)

세션이나 쿠키를 사용하는 경우, 도메인 설정을 확인합니다.
(현재 JWT 기반 인증을 사용하므로 해당 없을 수 있음)

### 8. 리다이렉트 URL 검증

OAuth나 외부 인증 연동 시 리다이렉트 URL 화이트리스트에 새 도메인을 추가합니다.

**조치 위치**: OAuth/인증 설정 파일

## Envoy 프록시 설정

Envoy 프록시는 이미 다음과 같이 설정되어 있습니다:

- HTTP/HTTPS 리스너에서 도메인별 라우팅
- `limen.kr`, `www.limen.kr` → LIMEN 프론트엔드 (포트 9444)
- `darc.kr`, `www.darc.kr` → DARC 웹사이트 (포트 9443)
- `/api/`, `/ws/`, `/agent/` 경로는 백엔드/Agent로 프록시

**백엔드 조치 불필요**: Envoy 설정은 프론트엔드에서 관리 중

## 테스트 체크리스트

백엔드 조치 후 다음 사항을 테스트하세요:

- [ ] `https://limen.kr`에서 API 호출 정상 작동
- [ ] `https://limen.kr`에서 WebSocket 연결 정상 작동
- [ ] `https://www.limen.kr`에서 API 호출 정상 작동
- [ ] CORS 에러 없음
- [ ] JWT 토큰 인증 정상 작동
- [ ] 로그에 새 도메인 트래픽 기록 확인

## 우선순위

1. **높음**: CORS 설정 업데이트 (즉시 필요)
2. **높음**: WebSocket 연결 허용 도메인 업데이트 (즉시 필요)
3. **중간**: 로그/모니터링 도메인 추가
4. **낮음**: API 문서 업데이트
5. **낮음**: 환경 변수 업데이트 (해당 시)

## 참고

- 프론트엔드는 이미 새 도메인에 맞게 설정 완료
- Envoy 프록시는 도메인별 라우팅 완료
- TLS 인증서는 `limen.kr`에 대해 발급 완료








