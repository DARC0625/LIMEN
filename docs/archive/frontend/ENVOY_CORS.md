# Envoy CORS 헤더 전달 확인

## 현재 설정

### Envoy 설정 (`/home/darc/LIMEN/frontend/envoy.yaml`)
- ✅ CORS 필터 없음 (백엔드에서 CORS 처리)
- ✅ Router 필터만 사용 (백엔드 응답 헤더 그대로 전달)
- ✅ `/api/` 경로는 백엔드로 직접 프록시

### 백엔드 CORS 헤더
백엔드에서 설정하는 CORS 헤더:
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token`
- `Access-Control-Allow-Origin: {origin}`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

### Envoy 동작
Envoy Router 필터는 기본적으로 백엔드 응답 헤더를 그대로 전달합니다.
- CORS 필터가 없으면 백엔드 헤더가 그대로 전달됨
- `suppress_envoy_headers` 옵션은 존재하지 않음 (제거됨)

## 확인 방법

### 1. 브라우저 개발자 도구
1. Network 탭에서 API 요청 확인
2. Response Headers에서 CORS 헤더 확인:
   - `Access-Control-Allow-Headers`에 `X-CSRF-Token` 포함 여부

### 2. curl 테스트
```bash
# OPTIONS 요청 (Preflight)
curl -v -X OPTIONS \
  -H "Origin: https://limen.kr" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization,X-CSRF-Token" \
  https://limen.kr/api/auth/login

# 실제 요청
curl -v -X POST \
  -H "Origin: https://limen.kr" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -H "X-CSRF-Token: {csrf_token}" \
  -d '{"username":"test","password":"test"}' \
  https://limen.kr/api/auth/login
```

### 3. Envoy 로그 확인
```bash
# Envoy 로그 확인
sudo journalctl -u envoy -f
# 또는
tail -f /var/log/envoy.log
```

## 문제 해결

### CORS 헤더가 전달되지 않는 경우
1. **백엔드 확인**: 백엔드에서 CORS 헤더를 제대로 설정하는지 확인
2. **Envoy 재시작**: 설정 변경 후 Envoy 재시작
   ```bash
   sudo systemctl restart envoy
   # 또는
   /home/darc/LIMEN/scripts/restart-envoy.sh
   ```
3. **프론트엔드 middleware 확인**: Next.js middleware에서 CORS 헤더를 전달하는지 확인

### Envoy CORS 필터 추가 (비권장)
백엔드에서 CORS를 처리하므로 Envoy에 CORS 필터를 추가할 필요는 없습니다.
만약 추가한다면:
```yaml
http_filters:
  - name: envoy.filters.http.cors
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.Cors
      # 백엔드 헤더와 충돌할 수 있음
```

## 현재 상태
- ✅ Envoy 설정 검증 완료
- ✅ CORS 필터 없음 (백엔드에서 처리)
- ✅ Router 필터만 사용 (헤더 그대로 전달)
- ✅ `/api/` 경로는 백엔드로 직접 프록시

## 다음 단계
1. Envoy 재시작
2. 브라우저에서 실제 응답 헤더 확인
3. 프론트엔드 middleware 로그 확인




