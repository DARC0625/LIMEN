# ESLint 에러 분류 분석

## Phase 0: 에러 분류 (완료)

### 전체 통계
- 총 에러/경고: 179개 (133 errors, 46 warnings)

### 그룹별 분류

#### 그룹 1: 우리 TS/React 소스 에러
**경로**: `frontend/src/**`, `frontend/app/**`, `components/**`, `lib/**`, `hooks/**`
**제외**: 테스트 파일 (`__tests__/**`, `*.test.*`, `*.spec.*`)

**처리 우선순위**: P0 (Phase 1에서 즉시 처리)

**주요 에러 유형**:
- `@typescript-eslint/no-unused-vars`: 사용하지 않는 변수
- `@typescript-eslint/ban-ts-comment`: `@ts-ignore` 사용
- `@typescript-eslint/no-explicit-any`: `any` 타입 사용
- `@typescript-eslint/no-empty`: 빈 블록

#### 그룹 2: 테스트 전용 에러
**경로**: `**/__tests__/**`, `*.test.*`, `*.spec.*`

**처리**: 이미 ESLint 설정에서 규칙 완화됨 (off)
- `@typescript-eslint/no-unused-vars`: off
- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/no-require-imports`: off

**참고**: 테스트 파일은 실용 우선이므로 규칙 완화 유지

#### 그룹 3: Node config/script 에러
**경로**: `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `scripts/**`

**처리 우선순위**: P1 (Phase 2에서 환경 선언)

**필요한 작업**:
- Node.js 환경 글로벌 선언 (`process`, `module`, `require`, `__dirname`, `__filename`)
- `@typescript-eslint/no-require-imports`: off
- `no-undef`: off

#### 그룹 4: 외부/번들 에러
**경로**: `public/novnc/**`, `public/sw.js`, `lib/novnc-browser-patch.js`

**처리 우선순위**: P1 (Phase 3에서 해시 고정/스캔)

**필요한 작업**:
- ESLint에서 제외 (ignores에 추가)
- 해시 고정 + SBOM/스캔 + 버전핀 관리
- 서비스워커는 우리 코드면 환경 선언 후 린트

---

## Phase 1: 우리 소스 100% 고치기 (P0)

### 작업 항목

1. **no-unused-vars**
   - 실제 사용하거나 제거
   - `_` prefix로 무시 표시 (예: `_unused`)

2. **ban-ts-comment**
   - `@ts-ignore` → `@ts-expect-error`로 변경
   - 이유 주석 추가

3. **no-explicit-any**
   - `unknown` + 타입 가드 사용
   - 최소 인터페이스 도입
   - 가이드라인: `RAG/02-development/coding-standards.md` 참고

4. **no-empty**
   - 빈 블록 제거 또는 주석/의도 명시

---

## Phase 2: 환경별 ESLint 컨텍스트 설정 (P1)

### 브라우저 환경
**파일**: `app/**`, `components/**`, `hooks/**`, `lib/**`, `src/**`

**글로벌**: `window`, `document`, `navigator`, `location`, `console`, `fetch`, `URL`, `Event`, `CustomEvent`, `AbortController`, `AbortSignal`, `PerformanceObserver`, `ResizeObserver`, `IntersectionObserver`, `MutationObserver`

### Node 환경
**파일**: `next.config.js`, `postcss.config.js`, `tailwind.config.js`, `scripts/**/*.js`, `jest.config.js`, `jest.setup.js`, `extract-trace-payload.js`, `ecosystem.config.js`

**글로벌**: `process`, `module`, `require`, `__dirname`, `__filename`, `console`, `Buffer`, `global`

**규칙**: `@typescript-eslint/no-require-imports`: off, `no-undef`: off

### 서비스워커 환경
**파일**: `public/sw.js`

**글로벌**: `self`, `caches`, `fetch`, `URL`, `location`, `console`, `ServiceWorkerRegistration`, `ServiceWorkerGlobalScope`, `ExtendableEvent`, `FetchEvent`, `InstallEvent`, `ActivateEvent`, `Cache`, `CacheStorage`, `Response`, `Request`

---

## Phase 3: 외부/번들 관리 (P1)

### novnc 번들
**경로**: `public/novnc/**`

**관리 방법**:
- ESLint에서 제외 (ignores)
- 해시 고정
- SBOM/스캔
- 버전핀

### 서비스워커
**경로**: `public/sw.js`

**관리 방법**:
- 우리 코드면: 환경 선언 후 린트
- 외부면: 해시 고정

### novnc-browser-patch
**경로**: `lib/novnc-browser-patch.js`

**관리 방법**:
- 우리 코드면: 환경 선언 후 린트
- 외부면: 해시 고정

---

**생성일**: 2025-01-10
**다음 단계**: Phase 1 시작 (우리 소스 에러 수정)
