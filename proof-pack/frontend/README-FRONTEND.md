# 프론트엔드 검증 상세 가이드

## 개요

이 문서는 LIMEN 프론트엔드 검증을 위한 상세 가이드를 제공합니다.

---

## 검증 항목 상세 설명

### F1. Beta Access 거부 시 에러 메시지 표시

**검증 방법**:
1. 승인되지 않은 사용자로 로그인 시도
2. `/waiting` 페이지로 리다이렉트 확인
3. 에러 메시지 표시 확인

**코드 위치**:
- `frontend/lib/utils/errorMessages.ts:18-29`
- `frontend/components/ErrorDisplay.tsx`
- `frontend/app/(protected)/waiting/page.tsx`

**스크린샷**: `screenshots/F1-beta-access-error.png`

---

### F2. 세션 타임아웃 알림

**검증 방법**:
1. 로그인 후 10분간 활동 없음
2. 세션 만료 알림 확인
3. 재로그인 버튼 동작 확인

**코드 위치**:
- `frontend/components/AuthGuard.tsx:18-19`
- `frontend/lib/utils/errorMessages.ts:51-75`

**스크린샷**: `screenshots/F2-session-timeout.png`

---

### F3. Rate Limit 초과 시 재시도 안내

**검증 방법**:
1. 짧은 시간에 많은 요청 전송
2. HTTP 429 응답 확인
3. 재시도 안내 메시지 확인

**코드 위치**:
- `frontend/lib/utils/errorMessages.ts:76-100`

**스크린샷**: `screenshots/F3-rate-limit.png`

**참고**: 현재는 서버 과부하 메시지로 대체됨. HTTP 429 전용 메시지 추가 권장.

---

### F4. 쿼터 초과 시 한도 정보 표시

**검증 방법**:
1. VM 생성 시 쿼터 초과 시도
2. 에러 메시지 확인
3. QuotaDisplay 컴포넌트에서 현재 사용량 확인

**코드 위치**:
- `frontend/lib/utils/errorMessages.ts:32-49`
- `frontend/components/QuotaDisplay.tsx`

**스크린샷**: `screenshots/F4-quota-exceeded.png`

---

### F5. 버전 정보 화면 표시

**검증 방법**:
1. 모든 페이지 하단 확인
2. 버전, 커밋 해시, 빌드 시간 표시 확인
3. 링크 동작 확인 (서비스 상태, 문서)

**코드 위치**:
- `frontend/components/VersionInfo.tsx`
- `frontend/app/layout.tsx:335`
- `frontend/app/(protected)/layout.tsx`

**스크린샷**: `screenshots/F5-version-info.png`

---

### F6. 보안 헤더 브라우저 확인

**검증 방법**:
1. 브라우저 개발자 도구 열기
2. Network 탭에서 요청 선택
3. Response Headers 확인

**예상 헤더**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy: ...`

**스크린샷**: `screenshots/F6-security-headers.png`

**참고**: 보안 헤더는 주로 백엔드에서 설정됨. 백엔드 검증 문서 참고.

---

## 스크린샷 촬영 가이드

### 필수 스크린샷
1. **F1-beta-access-error.png**: 초대 대기 화면
2. **F2-session-timeout.png**: 세션 만료 알림
3. **F3-rate-limit.png**: Rate limit 오류 (또는 서버 과부하 메시지)
4. **F4-quota-exceeded.png**: 쿼터 초과 에러 메시지
5. **F5-version-info.png**: 버전 정보 표시 (페이지 하단)
6. **F6-security-headers.png**: 브라우저 개발자 도구 Response Headers

### 스크린샷 저장 위치
```
proof-pack/frontend/screenshots/
```

---

## 관련 문서

- [프론트엔드 검증 문서](./PROOF-PACK-FRONTEND.md)
- [빠른 시작 가이드](../QUICK-START-FRONTEND.md)
- [백엔드 검증 문서](../backend/PROOF-PACK-BACKEND.md)

---

**작성일**: 2025-01-15

