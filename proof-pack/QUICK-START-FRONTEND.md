# 프론트엔드 검증 빠른 시작 가이드

## 3단계 시작 방법

### 1단계: 빠른 시작 가이드 읽기
```bash
cat /home/darc/LIMEN/proof-pack/QUICK-START-FRONTEND.md
```

### 2단계: 문서 열기
```bash
cd /home/darc/LIMEN
code proof-pack/frontend/PROOF-PACK-FRONTEND.md
# 또는 원하는 에디터 사용
```

### 3단계: 템플릿 참고하여 작성
- 기존 템플릿 확인: `proof-pack/frontend/PROOF-PACK-FRONTEND.md`
- 프론트엔드 검증 항목 추가
- 스크린샷은 `proof-pack/frontend/screenshots/`에 저장

---

## 확인해야 할 항목

### 필수 검증 항목
1. **Beta access 거부 시 에러 메시지 표시**
   - 파일: `frontend/lib/utils/errorMessages.ts`
   - 컴포넌트: `frontend/components/ErrorDisplay.tsx`
   - 페이지: `frontend/app/(protected)/waiting/page.tsx`

2. **세션 타임아웃 알림**
   - 파일: `frontend/components/AuthGuard.tsx`
   - 설정: `INACTIVE_TIMEOUT_MS = 10 * 60 * 1000` (10분)

3. **Rate limit 초과 시 재시도 안내**
   - 파일: `frontend/lib/utils/errorMessages.ts`
   - 오류 타입: `SERVER_OVERLOAD`, `SERVICE_UNAVAILABLE`

4. **쿼터 초과 시 한도 정보 표시**
   - 파일: `frontend/lib/utils/errorMessages.ts`
   - 컴포넌트: `frontend/components/QuotaDisplay.tsx`

5. **버전 정보 화면 표시**
   - 파일: `frontend/components/VersionInfo.tsx`
   - 표시 위치: 모든 페이지 하단

6. **보안 헤더 브라우저 확인**
   - 브라우저 개발자 도구 > Network 탭 > Response Headers 확인

---

## 작성 형식

### 항목명
**항목ID**: F1 - PASS/FAIL/PARTIAL

**증거**:
- 스크린샷: `screenshots/F1-항목명.png`
- 코드 위치: `frontend/lib/api/vm.ts:123`
- 브라우저 콘솔 로그: [로그 내용]

**비고**:
- PASS: 구현 완료 설명
- FAIL: 원인 + 수정 계획 + ETA (2025-01-15/15:00)

---

## 상세 가이드

- 빠른 시작: `proof-pack/QUICK-START-FRONTEND.md` (이 문서)
- 상세 가이드: `proof-pack/frontend/README-FRONTEND.md`
- 백엔드 API 참고: `proof-pack/backend/PROOF-PACK-BACKEND.md`

---

## 스크린샷 저장 위치

모든 스크린샷은 다음 위치에 저장:
```
proof-pack/frontend/screenshots/
```

파일 명명 규칙:
- `F1-beta-access-error.png`
- `F2-session-timeout.png`
- `F3-rate-limit.png`
- `F4-quota-exceeded.png`
- `F5-version-info.png`
- `F6-security-headers.png`

---

**작성일**: 2025-01-15

