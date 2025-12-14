# LIMEN - 최적화 및 정리 보고서

## 📅 작성일: 2024년

## 🎯 개요
이 문서는 LIMEN의 현재 상태를 정리하고, 최적화 작업 내용을 기록한 중간 세이브 포인트입니다.

---

## ✅ 완료된 주요 기능

### 1. Toast 알림 시스템
- **위치**: `frontend/src/components/Toast.tsx`, `ToastContainer.tsx`
- **기능**: 
  - 성공/에러/정보/경고 타입의 토스트 알림
  - 자동 닫기 (5초)
  - 슬라이드 애니메이션
  - Context API를 통한 전역 관리
- **사용처**: VM 생성/수정/삭제, 스냅샷 관리 등 모든 사용자 액션

### 2. WebSocket 실시간 업데이트
- **위치**: 
  - `frontend/src/hooks/useVMWebSocket.ts`
  - `backend/internal/handlers/websocket.go`
- **기능**:
  - VM 상태 변경 실시간 동기화
  - 자동 재연결 (최대 5회)
  - JWT 토큰 인증
  - 최적화된 콜백 관리 (useRef 사용)
- **성능 최적화**:
  - `startTransition`으로 비긴급 업데이트 처리
  - 깊은 비교를 통한 불필요한 리렌더링 방지
  - Throttling 및 Debouncing 적용

### 3. API 문서화 (Swagger/OpenAPI)
- **위치**: `backend/internal/router/router.go`
- **기능**: 
  - Swagger UI 엔드포인트 (`/swagger/`)
  - OpenAPI 스펙 자동 생성
  - 모든 API 엔드포인트 문서화

### 4. 사용자 권한 관리 (RBAC)
- **위치**: 
  - `backend/internal/models/role.go`
  - `backend/internal/middleware/admin.go`
- **기능**:
  - Admin/User 역할 구분
  - JWT 토큰에 역할 정보 포함
  - Admin 전용 엔드포인트 보호
- **적용**: Quota 업데이트 등 관리자 전용 기능

### 5. VM 상태 동기화
- **위치**: `backend/internal/vm/sync.go`
- **기능**:
  - Libvirt와 데이터베이스 간 VM 상태 동기화
  - VM 내부 종료 감지 및 상태 업데이트
  - 주기적 동기화 작업

---

## 🚀 성능 최적화

### 프론트엔드 최적화

#### 1. 폴링 간격 최적화
- **Health 체크**: 10초
- **Agent Metrics**: 5초
- **VM 목록 (fallback)**: 30초
- **Quota (fallback)**: 20초

#### 2. Throttling & Debouncing
- **Quota 업데이트 throttle**: 1초
- **Quota fetch 최소 간격**: 0.8초
- **vmChanged 이벤트 debounce**: 500ms
- **Quota 업데이트 지연**: 300ms

#### 3. React 최적화 기법
- **`startTransition`**: 비긴급 상태 업데이트를 지연 처리하여 UI 반응성 향상
- **`useCallback`**: 불필요한 함수 재생성 방지
- **`useRef`**: 안정적인 콜백 참조로 무한 재연결 방지
- **깊은 비교**: 실제 데이터 변경 시에만 리렌더링
- **Optimistic Updates**: VM 생성 시 즉시 UI 업데이트

#### 4. VNC 콘솔 최적화
- **문제**: 무한 루프로 인한 프리징
- **해결**:
  - `window.dispatchEvent` 제거 (무한 루프 원인)
  - Resize 이벤트 throttling (200ms)
  - 조건부 DOM 업데이트 (크기 변경 시에만)
  - `useCallback`으로 핸들러 메모이제이션

---

## 🐛 해결된 주요 버그

### 1. NaN 오류 (CPU/Memory 입력)
- **문제**: 빈 입력값으로 인한 NaN 발생
- **해결**: 입력값을 정수로 파싱하고, 빈 값은 0으로 처리
- **위치**: `frontend/src/app/page.tsx` (VM 생성/수정 폼)

### 2. VM 내부 종료 후 상태 미갱신
- **문제**: VM 내부에서 종료 시 UI에 여전히 "Running" 표시
- **해결**: Libvirt와 DB 간 상태 동기화 로직 추가
- **위치**: `backend/internal/vm/sync.go`

### 3. VNC 콘솔 프리징
- **문제**: VNC 콘솔 접속 시 즉시 화면 멈춤
- **원인**: `handleResize` 내부의 `window.dispatchEvent`가 무한 루프 유발
- **해결**: 
  - 무한 루프 원인 제거
  - Throttling 적용
  - 조건부 업데이트

### 4. VM 생성 시 프리징
- **문제**: VM 생성 시 UI 완전 멈춤
- **해결**:
  - Optimistic Updates 구현
  - `startTransition` 적용
  - WebSocket 콜백 최적화
  - Throttling 강화

---

## 📁 주요 파일 구조

### 프론트엔드
```
frontend/src/
├── app/
│   ├── page.tsx              # 메인 대시보드 (최적화 완료)
│   ├── layout.tsx            # ToastProvider 통합
│   └── vnc/[id]/page.tsx     # VNC 콘솔 페이지
├── components/
│   ├── Toast.tsx             # Toast 컴포넌트
│   ├── ToastContainer.tsx    # Toast 관리 (Context API)
│   ├── VNCViewer.tsx         # VNC 뷰어 (최적화 완료)
│   ├── QuotaDisplay.tsx      # Quota 표시 (Throttling 적용)
│   └── SnapshotManager.tsx   # 스냅샷 관리
├── hooks/
│   └── useVMWebSocket.ts     # WebSocket 훅 (최적화 완료)
└── lib/
    └── api.ts                # API 클라이언트
```

### 백엔드
```
backend/
├── cmd/server/main.go        # 서버 진입점
├── internal/
│   ├── handlers/
│   │   ├── api.go            # VM API 핸들러 (WebSocket 브로드캐스트)
│   │   ├── websocket.go      # WebSocket 핸들러
│   │   └── quota.go          # Quota 핸들러 (Admin 권한)
│   ├── middleware/
│   │   ├── auth.go           # JWT 인증 (역할 포함)
│   │   └── admin.go          # Admin 권한 체크
│   ├── models/
│   │   ├── models.go         # User 모델 (Role 필드)
│   │   └── role.go           # Role 타입 정의
│   ├── vm/
│   │   └── sync.go           # VM 상태 동기화
│   └── router/
│       └── router.go         # 라우터 (Swagger 포함)
```

---

## 🔧 최적화 세부 사항

### 1. WebSocket 연결 최적화
```typescript
// useRef를 사용하여 콜백 변경 시 재연결 방지
const onVMUpdateRef = useRef(onVMUpdate);
const onVMListRef = useRef(onVMList);

useEffect(() => {
  onVMUpdateRef.current = onVMUpdate;
  onVMListRef.current = onVMList;
}, [onVMUpdate, onVMList]);
```

### 2. 상태 업데이트 최적화
```typescript
// startTransition으로 비긴급 업데이트 처리
startTransition(() => {
  setVms((prevVms) => {
    // 깊은 비교로 불필요한 리렌더링 방지
    if (JSON.stringify(prevVms[index]) === JSON.stringify(vm)) {
      return prevVms;
    }
    // ...
  });
});
```

### 3. VNC Resize 최적화
```typescript
// Throttling으로 과도한 호출 방지
const handleResize = useCallback(() => {
  const now = Date.now();
  if (now - lastResizeTimeRef.current < 200) {
    // Throttle
    return;
  }
  // 조건부 업데이트
  if (Math.abs(currentWidth - availableWidth) > 1) {
    // DOM 업데이트
  }
}, []);
```

---

## 📊 성능 지표

### 폴링 간격
- Health: 10초
- Agent Metrics: 5초
- VM 목록: 30초 (WebSocket 활성 시 fallback)
- Quota: 20초 (fallback)

### Throttling/Debouncing
- Quota 업데이트: 1초
- Quota fetch: 0.8초
- vmChanged 이벤트: 500ms
- VNC Resize: 200ms

### WebSocket
- 재연결 시도: 최대 5회
- 재연결 지연: 3초

---

## 🎨 UI/UX 개선

### 제거된 기능
- **다크모드**: 모든 `dark:` Tailwind CSS 클래스 제거
- **VNC 모니터링**: 성능 문제로 제거 (호스트 모니터링은 Agent Metrics로 충분)

### 추가된 기능
- **Toast 알림**: 모든 사용자 액션에 대한 피드백
- **실시간 상태 업데이트**: WebSocket을 통한 즉각적인 UI 반영
- **Optimistic Updates**: VM 생성 시 즉시 UI 업데이트

---

## 🔒 보안

### 인증/인가
- JWT 토큰 기반 인증
- 역할 기반 접근 제어 (RBAC)
- WebSocket 연결 시 토큰 검증

### 권한 관리
- Admin: 모든 기능 접근 가능
- User: 제한된 기능만 접근

---

## 📝 코드 품질

### 정리된 항목
- 불필요한 `console.log` 제거 (에러 로깅은 유지)
- 중복 코드 제거
- 주석 개선 및 정리
- 타입 안정성 향상

### 유지된 항목
- 에러 로깅 (`console.error`)
- 개발자 도구를 위한 중요한 로그

---

## 🚧 향후 개선 사항

### 잠재적 최적화
1. **가상화 스크롤링**: VM 목록이 많을 때 성능 향상
2. **코드 스플리팅**: 라우트별 번들 분리
3. **캐싱 전략**: API 응답 캐싱
4. **서비스 워커**: 오프라인 지원

### 기능 확장
1. **VM 템플릿**: 자주 사용하는 VM 설정 저장
2. **리소스 알림**: Quota 임계값 초과 시 알림
3. **사용자 관리 UI**: Admin이 사용자 관리할 수 있는 인터페이스
4. **VM 로그**: VM 생성/삭제/수정 이력

---

## 📚 참고 문서

### 주요 기술 스택
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Go, Gorilla Mux, GORM, Libvirt
- **WebSocket**: Gorilla WebSocket
- **인증**: JWT
- **문서화**: Swagger/OpenAPI

### 의존성
- `@novnc/novnc`: VNC 클라이언트
- `react`: UI 라이브러리
- `libvirt-go`: VM 관리

---

## ✨ 결론

현재 LIMEN는 안정적으로 작동하며, 주요 성능 문제들이 해결되었습니다. 
특히 VNC 콘솔 프리징 문제와 VM 생성 시 프리징 문제가 완전히 해결되어 
사용자 경험이 크게 개선되었습니다.

모든 최적화 작업은 실제 사용 시나리오를 고려하여 균형잡힌 폴링 간격과 
throttling을 적용했습니다.

---

**마지막 업데이트**: 2024년
**상태**: ✅ 안정적 작동 중

