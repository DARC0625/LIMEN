# CORS 헤더 디버깅 가이드

## 문제 상황
백엔드 코드에는 `X-CSRF-Token`이 `Access-Control-Allow-Headers`에 포함되어 있지만, 실제 응답에는 `Content-Type`, `Authorization`만 표시됨.

## 확인 방법

### 1. 브라우저 개발자 도구에서 확인
1. 개발자 도구 열기 (F12)
2. Network 탭 선택
3. API 요청 클릭
4. Headers 탭에서 Response Headers 확인
5. 다음 헤더 확인:
   - `Access-Control-Allow-Credentials`
   - `Access-Control-Allow-Headers`
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`

### 2. 프론트엔드 로그 확인
개발 환경에서 콘솔 로그 확인:
- `[Middleware] CORS header forwarded: ...` - middleware에서 전달하는 CORS 헤더
- `[API Response] corsHeaders` - 클라이언트에서 받은 CORS 헤더

### 3. 프록시(Envoy) 설정 확인
프록시가 CORS 헤더를 수정하거나 제거할 수 있습니다.

**확인 사항:**
1. Envoy 설정 파일에서 CORS 필터 확인
2. `preserve_existing_headers` 옵션 확인
3. CORS 필터가 백엔드 헤더를 덮어쓰는지 확인

**Envoy CORS 필터 예시:**
```yaml
http_filters:
  - name: envoy.filters.http.cors
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.Cors
      # 백엔드 헤더를 보존하려면:
      # allow_origin_string_match 또는 allow_origin 설정 확인
```

### 4. 백엔드 직접 호출 테스트
프록시를 거치지 않고 백엔드에 직접 요청:
```bash
curl -v -H "Origin: https://limen.kr" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization,X-CSRF-Token" \
     -X OPTIONS \
     http://10.0.0.100:18443/api/auth/login
```

응답 헤더에서 `Access-Control-Allow-Headers` 확인:
- `X-CSRF-Token`이 포함되어 있는지 확인

### 5. 프록시를 통한 호출 테스트
프록시를 통한 요청:
```bash
curl -v -H "Origin: https://limen.kr" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization,X-CSRF-Token" \
     -X OPTIONS \
     https://limen.kr/api/auth/login
```

응답 헤더 비교:
- 백엔드 직접 호출과 프록시를 통한 호출의 헤더 차이 확인

## 해결 방법

### 방법 1: Envoy CORS 필터 비활성화
백엔드에서 CORS를 처리하므로 프록시의 CORS 필터를 비활성화:
```yaml
# Envoy 설정에서 CORS 필터 제거 또는 비활성화
```

### 방법 2: Envoy에서 백엔드 헤더 보존
Envoy 설정에서 백엔드 CORS 헤더를 보존하도록 설정:
```yaml
http_filters:
  - name: envoy.filters.http.cors
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.Cors
      # 백엔드 헤더 보존 옵션 확인
```

### 방법 3: 프론트엔드에서 CORS 헤더 확인
현재 구현:
- `middleware.ts`에서 백엔드 CORS 헤더를 명시적으로 전달
- 개발 환경에서 로깅 추가

## 현재 프론트엔드 구현
- ✅ `middleware.ts`에서 CORS 헤더 명시적으로 전달
- ✅ 개발 환경에서 CORS 헤더 로깅
- ✅ `lib/api/client.ts`에서 응답 헤더 로깅

## 다음 단계
1. 브라우저 개발자 도구에서 실제 응답 헤더 확인
2. 프록시(Envoy) 설정 확인
3. 백엔드 직접 호출과 프록시를 통한 호출 비교




