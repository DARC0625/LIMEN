# 프론트엔드 검증 문서 (Frontend Proof Pack)

**작성일**: 2025-01-15  
**버전**: 1.0.0  
**상태**: 검증 완료

---

## 개요

이 문서는 LIMEN 프론트엔드의 주요 기능 및 검증 항목에 대한 증거를 제공합니다.

---

## F1. Beta Access 거부 시 에러 메시지 표시

**항목ID**: F1 - PASS

**증거**: 
- 코드 위치: `frontend/lib/utils/errorMessages.ts:18-29`
- 컴포넌트: `frontend/components/ErrorDisplay.tsx`
- 페이지: `frontend/app/(protected)/waiting/page.tsx`

```typescript
// errorMessages.ts
'NOT_APPROVED': {
  title: '초대 대기 중',
  message: '현재 초대 대기 상태입니다. 관리자 검토 후 초대 안내를 이메일로 보내드리겠습니다.',
  action: '대기 상태 확인',
  actionUrl: '/waiting',
},
'NOT_INVITED': {
  title: '초대 권한 없음',
  message: '서비스 이용을 위해서는 초대가 필요합니다. 대기자 등록을 먼저 진행해주세요.',
  action: '대기자 등록',
  actionUrl: '/',
},
```

- AuthGuard 통합: `frontend/components/AuthGuard.tsx:140-144`
  - 승인되지 않은 사용자 자동 리다이렉트: `/waiting` 페이지로 이동
  - 대기 화면에서 명확한 안내 메시지 표시

**비고**: 
- PASS: Beta access 거부 시 사용자 친화적인 에러 메시지 표시 구현 완료
- ErrorDisplay 컴포넌트로 통합 표시
- 다음 행동 안내 포함 (대기 상태 확인, 대기자 등록)

---

## F2. 세션 타임아웃 알림

**항목ID**: F2 - PASS

**증거**: 
- 코드 위치: `frontend/components/AuthGuard.tsx:18-19`
- 세션 타임아웃 설정: `INACTIVE_TIMEOUT_MS = 10 * 60 * 1000` (10분)
- 오류 메시지: `frontend/lib/utils/errorMessages.ts:51-75`

```typescript
// AuthGuard.tsx
const INACTIVE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// errorMessages.ts
'SESSION_IDLE_TIMEOUT': {
  title: '유휴 시간 초과',
  message: '10분간 활동이 없어 세션이 자동으로 종료되었습니다. 다시 로그인해주세요.',
  action: '로그인',
  actionUrl: '/login',
},
```

- VNCViewer 안내: `frontend/components/VNCViewer.tsx:1118-1120`
  - 콘솔 화면에 "💡 유휴 시 자동 종료 (10분) | 최대 사용 시간 제한" 표시

**비고**: 
- PASS: 세션 타임아웃 알림 구현 완료
- 유휴 시간 10분 설정
- 타임아웃 시 명확한 안내 메시지 및 재로그인 버튼 제공
- 개선 권장: 세션 만료 시 즉시 안내 모달 표시 (ETA: 2025-01-15 19:00)

---

## F3. Rate Limit 초과 시 재시도 안내

**항목ID**: F3 - PARTIAL

**증거**: 
- 코드 위치: `frontend/lib/utils/errorMessages.ts:76-100`
- 오류 타입: `SERVER_OVERLOAD`, `SERVICE_UNAVAILABLE`

```typescript
'SERVER_OVERLOAD': {
  title: '서버 과부하',
  message: '현재 서버가 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
  action: '재시도',
},
'SERVICE_UNAVAILABLE': {
  title: '서비스 일시 중단',
  message: '서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.',
  action: '서비스 상태 확인',
  actionUrl: '/status',
},
```

- 네트워크 오류 처리: `frontend/lib/utils/errorMessages.ts:101-107`
  - `NETWORK_ERROR` 타입으로 네트워크 오류 처리

**비고**: 
- PARTIAL: Rate limit 전용 오류 메시지는 없으나, 서버 과부하/일시 장애 메시지로 대체 가능
- 개선 필요: HTTP 429 (Too Many Requests) 전용 오류 메시지 추가
- ETA: 2025-01-15 20:00 (30분 소요 예상)

---

## F4. 쿼터 초과 시 한도 정보 표시

**항목ID**: F4 - PASS

**증거**: 
- 코드 위치: `frontend/lib/utils/errorMessages.ts:32-49`
- 오류 타입: `QUOTA_EXCEEDED_VMS`, `QUOTA_EXCEEDED_CPU`, `QUOTA_EXCEEDED_MEMORY`

```typescript
'QUOTA_EXCEEDED_VMS': {
  title: 'VM 개수 제한 초과',
  message: '시스템 전체 VM 개수 제한에 도달했습니다. 다른 VM을 종료한 후 다시 시도해주세요.',
  action: 'VM 목록 확인',
  actionUrl: '/dashboard',
},
'QUOTA_EXCEEDED_CPU': {
  title: 'CPU 할당량 초과',
  message: '시스템 전체 CPU 할당량을 초과했습니다. 실행 중인 VM의 CPU를 줄이거나 종료한 후 다시 시도해주세요.',
  action: 'VM 목록 확인',
  actionUrl: '/dashboard',
},
'QUOTA_EXCEEDED_MEMORY': {
  title: '메모리 할당량 초과',
  message: '시스템 전체 메모리 할당량을 초과했습니다. 실행 중인 VM의 메모리를 줄이거나 종료한 후 다시 시도해주세요.',
  action: 'VM 목록 확인',
  actionUrl: '/dashboard',
},
```

- QuotaDisplay 컴포넌트: `frontend/components/QuotaDisplay.tsx`
  - 현재 사용량 및 한도 정보 표시
  - API: `/api/quota` 엔드포인트 사용

**비고**: 
- PASS: 쿼터 초과 시 한도 정보 및 다음 행동 안내 제공
- ErrorDisplay 컴포넌트로 통합 표시
- QuotaDisplay 컴포넌트로 현재 사용량 확인 가능

---

## F5. 버전 정보 화면 표시

**항목ID**: F5 - PASS

**증거**: 
- 코드 위치: `frontend/components/VersionInfo.tsx`
- 표시 위치:
  - 루트 레이아웃: `frontend/app/layout.tsx:335`
  - 보호된 레이아웃: `frontend/app/(protected)/layout.tsx`

```typescript
// VersionInfo.tsx
const versionInfo: VersionInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
  commitHash: process.env.NEXT_PUBLIC_COMMIT_HASH || 'unknown',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME,
};

// 표시 형식
v{version} ({commitHash.substring(0, 7)}) {buildTime}
```

- 표시 정보:
  - 버전: `NEXT_PUBLIC_APP_VERSION`
  - 커밋 해시: `NEXT_PUBLIC_COMMIT_HASH` (7자리)
  - 빌드 시간: `NEXT_PUBLIC_BUILD_TIME`
- 추가 링크:
  - "서비스 상태" → `/status`
  - "문서" → `https://github.com/DARC0625/LIMEN`

**비고**: 
- PASS: 버전 정보 화면 표시 구현 완료
- 모든 페이지 하단에 표시
- 이슈 보고 시 버전 식별 가능
- 개선 필요: 빌드 시 환경 변수 자동 주입 설정 (GitHub Actions)

---

## F6. 보안 헤더 브라우저 확인

**항목ID**: F6 - PARTIAL

**증거**: 
- Next.js 설정: `frontend/next.config.js`
- 보안 헤더는 주로 백엔드에서 설정되지만, 프론트엔드에서도 확인 가능

**브라우저 콘솔 확인 방법**:
```javascript
// 브라우저 개발자 도구 > Network 탭 > Response Headers 확인
// 예상 헤더:
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 1; mode=block
// - Strict-Transport-Security: max-age=31536000
// - Content-Security-Policy: ...
```

**비고**: 
- PARTIAL: 보안 헤더는 주로 백엔드에서 설정
- 프론트엔드에서는 브라우저 개발자 도구로 확인 가능
- Next.js의 보안 헤더 설정 확인 필요
- ETA: 백엔드 검증 문서 참고

---

## 요약

### PASS 항목: 4개
- F1: Beta Access 거부 시 에러 메시지 표시 ✅
- F2: 세션 타임아웃 알림 ✅
- F4: 쿼터 초과 시 한도 정보 표시 ✅
- F5: 버전 정보 화면 표시 ✅

### PARTIAL 항목: 2개
- F3: Rate Limit 초과 시 재시도 안내 (서버 과부하 메시지로 대체)
- F6: 보안 헤더 브라우저 확인 (백엔드 설정 확인 필요)

### FAIL 항목: 0개

---

## 관련 문서

- [프론트엔드 체크리스트 리포트](../frontend/CHECKLIST_SUBMISSION.md)
- [백엔드 검증 문서](../backend/PROOF-PACK-BACKEND.md)
- [빠른 시작 가이드](../QUICK-START-FRONTEND.md)

---

**최종 업데이트**: 2025-01-15

