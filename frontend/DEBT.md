# 기술 부채 목록 (Technical Debt)

이 문서는 LIMEN 프론트엔드 프로젝트의 기술 부채를 추적합니다.
각 항목은 파일 경로, 문제 설명, 조치 방안, 우선순위를 포함합니다.

## 우선순위
- **P0**: 즉시 해결 필요 (보안/안정성)
- **P1**: 단기 해결 필요 (품질/성능)
- **P2**: 중기 해결 필요 (유지보수성)
- **P3**: 장기 개선 (최적화)

---

## A. 코드 품질 및 구조

### A1. E2E 테스트 코드 격리 미완료
- **파일**: `e2e/vm-console-e2e.spec.ts`
- **문제**: E2E 전용 헤더(`X-Limen-E2E`)가 하드코딩되어 있음
- **조치**: `src/featureflags/e2e.ts`로 이동 완료, 빌드 타임 플래그 연동 필요
- **우선순위**: P1

### A2. 품질 게이트 미구현
- **파일**: `package.json`
- **문제**: lint/typecheck/build/test를 한 번에 실행하는 스크립트 없음
- **조치**: `pnpm quality-gate` 스크립트 추가 필요
- **우선순위**: P1

### A3. BroadcastChannel Edge Runtime 경고
- **파일**: `components/AuthGuard.tsx:194`, `lib/security.ts:88`
- **문제**: Edge Runtime에서 BroadcastChannel 사용 시 경고 발생
- **조치**: Edge Runtime 사용 페이지에서 제외하거나 폴백 구현
- **우선순위**: P2

### A4. 미들웨어 deprecation 경고
- **파일**: `middleware.ts`
- **문제**: Next.js 16에서 "middleware" 파일 convention이 deprecated됨
- **조치**: "proxy"로 마이그레이션 검토
- **우선순위**: P2

---

## B. 보안 및 데이터 관리

### B1. console.log에 토큰 정보 노출 가능성
- **파일**: `middleware.ts:246,256`, `lib/api/client.ts:98,99`
- **문제**: 디버그 로그에 토큰 관련 정보가 포함될 수 있음
- **조치**: 프로덕션 빌드에서 console.log 제거 또는 토큰 마스킹
- **우선순위**: P0

### B2. localStorage 직접 접근 다수
- **파일**: `hooks/useVMs.ts:324-347`, `components/LoginForm.tsx:143-171`
- **문제**: tokenManager를 통하지 않고 localStorage 직접 접근
- **조치**: 모든 localStorage 접근을 tokenManager로 통합
- **우선순위**: P1

### B3. sessionStorage 사용 일관성 부족
- **파일**: `lib/tokenManager.ts:49-56`
- **문제**: CSRF 토큰만 sessionStorage 사용, 다른 곳과 혼용
- **조치**: 스토리지 전략 문서화 및 통일
- **우선순위**: P2

---

## C. 성능 및 최적화

### C1. VNCViewer 번들 크기
- **파일**: `components/VNCViewer.tsx`
- **문제**: noVNC 라이브러리로 인한 큰 번들 크기
- **조치**: 이미 dynamic import 적용됨, 추가 최적화 검토
- **우선순위**: P2

### C2. React Query 캐시 최적화 부족
- **파일**: `hooks/useVMs.ts`
- **문제**: 불필요한 re-fetch 및 캐시 무효화
- **조치**: 캐시 전략 최적화 및 staleTime 조정
- **우선순위**: P2

### C3. 불필요한 re-render
- **파일**: `app/(protected)/dashboard/page.tsx`
- **문제**: VM 목록 업데이트 시 전체 컴포넌트 re-render
- **조치**: React.memo 및 useMemo 적용
- **우선순위**: P2

---

## D. 네트워크 및 API

### D1. console 엔드포인트 호출 중복 가능성
- **파일**: `components/VNCViewer.tsx:418`
- **문제**: `/api/vms/{uuid}/console` 호출이 여러 곳에서 발생할 수 있음
- **조치**: 단일 함수로 통합 확인 필요
- **우선순위**: P1

### D2. 에러 처리 UX 불일치
- **파일**: `lib/api/client.ts`, `components/VNCViewer.tsx`
- **문제**: 401/403/5xx 에러 처리 방식이 컴포넌트마다 다름
- **조치**: 통일된 에러 처리 유틸리티 함수 생성
- **우선순위**: P1

### D3. 타임아웃 설정 미문서화
- **파일**: `lib/api/client.ts`, `envoy.yaml`
- **문제**: API 타임아웃 값이 코드에 하드코딩되어 있고 문서화되지 않음
- **조치**: `timeouts.md` 문서 작성 및 설정 통일
- **우선순위**: P1

---

## E. 라우팅 및 네비게이션

### E1. 콘솔 경로 리다이렉트 완료
- **파일**: `app/console/[uuid]/page.tsx`
- **문제**: 이미 `/vnc/{uuid}`로 리다이렉트 구현됨
- **조치**: 완료됨, 문서화 필요
- **우선순위**: P3

### E2. 라우트 정의 분산
- **파일**: `app/**/page.tsx` 다수
- **문제**: 라우트 구조가 파일 시스템에만 의존
- **조치**: 라우트 매핑 문서화
- **우선순위**: P3

---

## F. 테스트 및 품질

### F1. E2E 테스트 타임아웃 하드코딩
- **파일**: `e2e/vm-console-e2e.spec.ts:8`
- **문제**: 60초 타임아웃이 하드코딩됨
- **조치**: 환경 변수로 설정 가능하게 변경
- **우선순위**: P2

### F2. 테스트 커버리지 미달
- **파일**: 전체
- **문제**: 일부 컴포넌트 테스트 커버리지 부족
- **조치**: 커버리지 목표 설정 및 점진적 개선
- **우선순위**: P2

### F3. Playwright 테스트 격리 부족
- **파일**: `e2e/vm-console-e2e.spec.ts`
- **문제**: 테스트 간 상태 공유 가능성
- **조치**: 각 테스트 전 VM 정리 로직 추가
- **우선순위**: P1

---

## G. 문서화

### G1. API 엔드포인트 문서화 부족
- **파일**: 전체
- **문제**: API 엔드포인트 사용법이 코드에만 존재
- **조치**: API 문서 생성 (OpenAPI/Swagger 고려)
- **우선순위**: P2

### G2. 컴포넌트 문서화 부족
- **파일**: `components/**/*.tsx`
- **문제**: Props 및 사용법 문서화 부족
- **조치**: JSDoc 주석 추가
- **우선순위**: P3

### G3. 환경 변수 문서화 부족
- **파일**: `.env.example` (없음)
- **문제**: 필요한 환경 변수 목록이 문서화되지 않음
- **조치**: `.env.example` 파일 생성
- **우선순위**: P1

---

## H. Envoy/Edge 설정

### H1. 타임아웃 설정 미문서화
- **파일**: `envoy.yaml`
- **문제**: WS idle/stream duration, API timeout 등이 문서화되지 않음
- **조치**: `timeouts.md` 문서 작성
- **우선순위**: P1

### H2. 레이트리밋 정책 미정의
- **파일**: `envoy.yaml`
- **문제**: request body size, header size, rate limit 정책이 명시되지 않음
- **조치**: 문서화 및 설정 고정
- **우선순위**: P1

### H3. WebSocket 업그레이드 로깅 부족
- **파일**: `envoy.yaml`
- **문제**: WS 연결 실패 시 디버깅 정보 부족
- **조치**: 액세스 로그에 WS 관련 정보 추가
- **우선순위**: P2

---

## I. 빌드 및 배포

### I1. 빌드 스크립트 복잡도
- **파일**: `package.json:7`
- **문제**: 빌드 스크립트가 여러 명령을 체인으로 실행
- **조치**: 빌드 스크립트 분리 및 단계별 실행 가능하게 변경
- **우선순위**: P2

### I2. 번들 분석 자동화 부족
- **파일**: `package.json:9-10`
- **문제**: 번들 크기 모니터링이 수동
- **조치**: CI에서 번들 크기 체크 자동화
- **우선순위**: P2

---

## J. 타입 안정성

### J1. any 타입 사용
- **파일**: 여러 파일
- **문제**: 타입 안정성을 위해 any 사용 최소화 필요
- **조치**: 점진적으로 any를 구체 타입으로 교체
- **우선순위**: P2

### J2. 타입 가드 부족
- **파일**: `lib/types.ts`
- **문제**: 런타임 타입 검증 부족
- **조치**: Zod 등으로 런타임 타입 검증 추가
- **우선순위**: P2

---

## 통계
- **총 항목**: 25개
- **P0**: 1개
- **P1**: 9개
- **P2**: 13개
- **P3**: 2개

---

## 업데이트 이력
- 2026-01-10: 초기 작성
