#!/bin/bash
# 로그인 성공 시 Set-Cookie 헤더 확인 테스트

echo "=== 로그인 테스트 (Set-Cookie 헤더 확인) ==="
echo ""

# 실제 admin 비밀번호로 로그인 시도
echo "1. 로그인 요청 (Origin: https://limen.kr)"
curl -X POST "http://localhost:18443/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://limen.kr" \
  -d '{"username":"admin","password":"admin"}' \
  -v 2>&1 | grep -E "(< HTTP|Set-Cookie|Access-Control)" | head -20

echo ""
echo "=== 로그인 성공 시 Set-Cookie 헤더 확인 ==="
echo "성공 시 다음 헤더가 있어야 합니다:"
echo "  - Set-Cookie: refresh_token=..."
echo "  - Set-Cookie: csrf_token=..."
echo "  - Access-Control-Allow-Credentials: true"
echo "  - Access-Control-Allow-Origin: https://limen.kr"
echo ""
echo "프론트엔드에서 확인할 사항:"
echo "  1. fetch/axios 요청에 credentials: 'include' 옵션 사용"
echo "  2. 브라우저 개발자 도구 → Network → Response Headers에서 Set-Cookie 확인"
echo "  3. Application → Cookies에서 refresh_token, csrf_token 확인"


