# LIMEN Frontend Proof Pack 제출서 - 2026-01-12

**제출일**: 2026-01-12  
**Commit Hash**: `007b043590f9f35a45522284b43e25aca42abf75`  
**담당**: Frontend  
**검증자**: Backend AI (Frontend 검증은 Frontend 담당자 필요)

---

## 프론트엔드 Proof Pack 체크리스트

> **참고**: 이 문서는 백엔드 생존성 작업에 대한 Proof Pack입니다.  
> 프론트엔드 관련 검증 항목은 프론트엔드 담당자가 별도로 작성해야 합니다.

### 프론트엔드에서 확인해야 할 항목 (예시)

1. **버전 표시**: 화면 하단에 버전 정보 표시
2. **에러 처리**: Beta access 거부 시 사용자에게 명확한 메시지 표시
3. **세션 관리**: 콘솔 세션 타임아웃 시 사용자 알림
4. **Rate Limit 처리**: 429 응답 시 재시도 안내
5. **보안 헤더**: 브라우저 콘솔에서 보안 헤더 확인

---

## 프론트엔드 관련 백엔드 API 응답 예시

### Beta Access 거부 응답
```json
{
  "code": 403,
  "message": "Beta access required to create VMs. Please contact administrator.",
  "error_code": "FORBIDDEN"
}
```

### 세션 제한 초과 응답
```json
{
  "type": "error",
  "error": "maximum concurrent sessions (2) reached",
  "code": "SESSION_CREATE_FAILED"
}
```

### Rate Limit 초과 응답
```json
{
  "code": 429,
  "message": "VM creation rate limit exceeded. Please wait 25s before creating another VM.",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

### 쿼터 초과 응답
```json
{
  "code": 400,
  "message": "quota exceeded for VMs: current 3 + requested 1 > limit 3",
  "error_code": "QUOTA_EXCEEDED"
}
```

---

## 프론트엔드 담당자 작업 가이드

### 1. 에러 메시지 표시
- Beta access 거부: "베타 접근 권한이 필요합니다. 관리자에게 문의하세요."
- 세션 제한: "최대 동시 접속 수(2개)에 도달했습니다."
- Rate Limit: "요청이 너무 빠릅니다. X초 후 다시 시도해주세요."
- 쿼터 초과: "VM 생성 한도에 도달했습니다. (현재: X/최대: Y)"

### 2. 세션 타임아웃 알림
- 유휴 타임아웃: "15분간 활동이 없어 세션이 종료됩니다."
- 최대 시간: "세션 최대 시간(4시간)에 도달했습니다."

### 3. 버전 정보 표시
- 화면 하단 또는 설정 페이지에 버전 정보 표시
- Git commit hash 또는 빌드 번호 표시

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-12  
**참고**: 프론트엔드 검증 항목은 프론트엔드 담당자가 별도로 작성해야 합니다.





