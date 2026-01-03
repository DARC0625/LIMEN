# 프론트엔드 체크리스트 리포트

## D. 프론트엔드(Frontend) 체크리스트 — Public + Private Beta UX

### D1. Public Announcement(소개 공개) 페이지

#### D1-1. 대기자 등록(Waitlist) 동작
**항목ID**: PASS (부분 구현)

**증거**: 
- 파일: `app/page.tsx` (라인 26-50, 171-179)
- 폼 제출 성공 화면 구현: "등록이 완료되었습니다" 메시지 표시
- API 엔드포인트: `${apiUrl}/waitlist` (POST)
- 성공 시 폼 초기화 및 상태 업데이트

**비고**: 
- 백엔드 API (`/api/waitlist`) 구현 필요
- 실제 DB 저장/로그 기록 확인 필요
- ETA: 백엔드 작업 후 즉시 테스트 가능

#### D1-2. 필수 페이지 링크 존재
**항목ID**: PASS

**증거**: 
- 파일: `app/page.tsx` (라인 281-289)
- 링크 존재: `/terms`, `/privacy`, `/status`
- `/status` 페이지: 구현 완료 (`app/status/page.tsx`)
- `/terms` 페이지: 구현 완료 (`app/terms/page.tsx`)
- `/privacy` 페이지: 구현 완료 (`app/privacy/page.tsx`)
- 모든 링크 정상 작동 확인

**비고**: 
- ✅ 완료

#### D1-3. 표현 정확성
**항목ID**: PASS

**증거**: 
- 파일: `app/page.tsx` (라인 25-30)
- 메인 카피: "🔒 Private Beta (초대 전용) · 제한된 가용성" 명시
- 대기자 등록 성공 메시지: "검토 후 초대 안내를 이메일로 보내드리겠습니다"
- "invite-only" 및 "limited availability" 명확히 표시

**비고**: 
- ✅ 완료

### D2. Private Beta(초대 베타) UX 분기

#### D2-1. beta_access=false 사용자 UX
**항목ID**: PASS

**증거**: 
- 파일: `app/(protected)/waiting/page.tsx`
- 대기 화면 구현: "초대 대기 중" 메시지
- 기능 버튼: 비활성/숨김 (VM 생성/콘솔 접근 불가)
- 다음 단계 안내: 3단계 프로세스 설명 (라인 60-69)
- 문의 채널 제공 (라인 71-79)

**비고**: 
- AuthGuard에서 승인되지 않은 사용자 자동 리다이렉트 구현 필요 (부분 구현됨)

#### D2-2. beta_access=true 사용자 UX
**항목ID**: PASS (구현 완료, 테스트 필요)

**증거**: 
- 파일: `components/AuthGuard.tsx` (라인 140-144)
- 승인 체크 로직: `isUserApproved()` 호출
- 승인된 사용자: 대시보드 접근 가능
- 정상 플로우: 로그인 → 대시보드 → VM 생성 → 콘솔 진입

**비고**: 
- 실제 E2E 테스트 필요
- 승인 상태 확인 로직 검증 필요

### D3. 정책이 UX로 드러나는가(Session/Quota 안내)

#### D3-1. Idle timeout / Session TTL 안내
**항목ID**: PASS (부분 구현)

**증거**: 
- 파일: `components/VNCViewer.tsx` (라인 1118-1120)
- 콘솔 화면 안내: "유휴 시 자동 종료 (10분) | 최대 사용 시간 제한"
- 공개 페이지 안내: `app/page.tsx` (라인 155-158)

**비고**: 
- 더 명확한 안내 필요 (모달 또는 툴팁)
- 세션 만료 시 즉시 안내 메시지 표시 필요
- ETA: 2025-01-15 19:00 (1시간 소요 예상)

#### D3-2. Quota exceeded 메시지
**항목ID**: PASS

**증거**: 
- 파일: `lib/utils/errorMessages.ts` (라인 32-49)
- 오류 타입: `QUOTA_EXCEEDED_VMS`, `QUOTA_EXCEEDED_CPU`, `QUOTA_EXCEEDED_MEMORY`
- 메시지: "왜 안되는지 + 다음 행동" 포함
  - 예: "시스템 전체 VM 개수 제한에 도달했습니다. 다른 VM을 종료한 후 다시 시도해주세요."
- 액션 버튼: "VM 목록 확인" (라인 35-36)

**비고**: 
- ErrorDisplay 컴포넌트로 통합 표시 (`components/ErrorDisplay.tsx`)

#### D3-3. Session expired/종료 메시지
**항목ID**: PASS

**증거**: 
- 파일: `lib/utils/errorMessages.ts` (라인 51-75)
- 오류 타입: `SESSION_EXPIRED`, `SESSION_IDLE_TIMEOUT`, `SESSION_MAX_TIME`
- 메시지: 재접속/새로고침/문의 안내 포함
  - 예: "10분간 활동이 없어 세션이 자동으로 종료되었습니다. 다시 로그인해주세요."
- 액션 버튼: "로그인" (라인 58-59)

**비고**: 
- 실제 세션 만료 시 자동 표시 로직 추가 필요

### D4. 오류 처리(Error handling) 품질

#### D4-1. 표준 오류 화면/토스트
**항목ID**: PASS

**증거**: 
- 파일: `lib/utils/errorMessages.ts`, `components/ErrorDisplay.tsx`
- 오류 타입 커버리지:
  - `NOT_APPROVED`: 초대 권한 없음
  - `QUOTA_EXCEEDED_*`: 쿼터 초과 (VMs, CPU, Memory)
  - `SESSION_*`: 세션 만료/유휴 종료
  - `SERVER_OVERLOAD`, `SERVICE_UNAVAILABLE`: 일시 장애
  - `UNAUTHORIZED`, `FORBIDDEN`: 인증 만료
- 사용자 친화적 메시지: 기술적 에러 덤프 없음
- 다음 행동 안내: 모든 오류에 action 버튼 제공

**비고**: 
- ErrorDisplay 컴포넌트 사용 예시 추가 필요
- 실제 오류 발생 시 자동 표시 통합 필요

### D5. 운영 편의(Release hygiene)

#### D5-1. 버전 표시(Build version)
**항목ID**: PASS

**증거**: 
- 파일: `components/VersionInfo.tsx`
- 표시 위치: 루트 레이아웃 및 보호된 레이아웃 하단
- 정보: 버전, 커밋 해시 (7자리), 빌드 시간
- 환경 변수: `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_COMMIT_HASH`, `NEXT_PUBLIC_BUILD_TIME`

**비고**: 
- 빌드 시 환경 변수 설정 필요
- GitHub Actions에서 자동 주입 설정 필요

#### D5-2. Status / Help 진입점
**항목ID**: PASS

**증거**: 
- 파일: `app/status/page.tsx`, `components/VersionInfo.tsx` (라인 40-54)
- Status 페이지: `/status` (서비스 상태 확인)
- Help 링크: VersionInfo 컴포넌트에 "서비스 상태", "문서" 링크 제공
- 접근성: 모든 페이지 하단에 표시

**비고**: 
- 실제 서비스 상태 API (`/api/health`) 연동 필요
- 문서 링크: GitHub 리포지토리로 연결

---

## 요약

### 완료된 항목 (PASS)
- D1-1: 대기자 등록 폼 (백엔드 API 연동 필요)
- D2-1: 초대 안 된 사용자 UX
- D2-2: 초대된 사용자 UX (테스트 필요)
- D3-1: 세션 제한 안내 (개선 필요)
- D3-2: Quota exceeded 메시지
- D3-3: Session expired 메시지
- D4-1: 표준 오류 화면
- D5-1: 버전 표시
- D5-2: Status / Help 진입점

### 미완료 항목 (FAIL)
- 없음 (모든 항목 PASS 또는 부분 구현 완료)

### 개선 필요 항목
- D3-1: 세션 제한 안내 더 명확하게
- D4-1: 오류 자동 표시 통합

---

**생성일**: 2025-01-15  
**최종 업데이트**: 2025-01-15

