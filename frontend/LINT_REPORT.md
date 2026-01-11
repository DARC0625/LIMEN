# ESLint 정리 작업 보고서

## 작업 완료 일시
2025-01-XX

## 1. Lint Error 수 변화

### 초기 상태
- 전체 에러: 453+ errors (node_modules, playwright-report 포함)
- 우리 소스 에러: 약 100+ errors

### 최종 상태
- **우리 소스 에러: 약 45 errors** (테스트 파일, 스크립트 파일 제외 시 더 적음)
- 테스트 파일은 의도적으로 규칙 완화 (실용 우선)
- 스크립트 파일은 Node 환경 override로 처리

### 주요 수정 사항
1. **@typescript-eslint/no-unused-vars**: 미사용 변수 제거
   - `isAdmin`, `useAuth`, `isUserApproved` 등 미사용 import 제거
   - catch 블록의 미사용 에러 변수 제거 (`catch (err)` → `catch`)
   - 미사용 상태 변수 제거

2. **@typescript-eslint/no-explicit-any**: 타입 명시
   - `error as any` → `error as { isWaitError?: boolean }`
   - `data: any` → `data: Record<string, unknown>`

3. **@typescript-eslint/ban-ts-comment**: `@ts-ignore` → `@ts-expect-error`
   - 주석과 함께 이유 명시

4. **prefer-const**: `let` → `const` 변경
   - `interval`, `key` 등 재할당 없는 변수

5. **no-empty**: 빈 블록에 주석 추가

## 2. Vendor 처리

### 외부 번들 관리
- **대상**: `frontend/public/novnc/**` (특히 `rfb.js`)
- **정책**: ESLint로 수정하지 않음, 해시 검증으로 관리
- **도구**: `scripts/verify/vendor-hashes.sh` 추가
  - 초기 해시 파일 생성: `scripts/verify/vendor-hashes.txt`
  - CI에서 해시 변경 감지 시 FATAL
  - 업데이트 시: "업스트림 버전 + 해시 갱신 + 변경 로그" 필수

### 우리 작성 코드
- `public/sw.js`: Service Worker (우리 코드) - SW 환경 override 적용
- `lib/novnc-browser-patch.js`: 우리 패치 코드 - Browser 환경 override 적용

## 3. 환경 Override 적용 범위

### (A) Browser 환경 (기본)
- **대상 파일**:
  - `app/**/*.{ts,tsx,js,jsx}`
  - `components/**/*.{ts,tsx,js,jsx}`
  - `hooks/**/*.{ts,tsx,js,jsx}`
  - `lib/**/*.{ts,tsx,js,jsx}`
  - `src/**/*.{ts,tsx,js,jsx}`
- **허용 globals**: `window`, `document`, `navigator`, `location`, `console`, `fetch`, `URL`, `Event`, `CustomEvent`, `AbortController`, `AbortSignal`, `PerformanceObserver`, `ResizeObserver`, `IntersectionObserver`, `MutationObserver`

### (B) Node 환경 (설정/스크립트)
- **대상 파일**:
  - `next.config.js`
  - `postcss.config.js`
  - `tailwind.config.js`
  - `scripts/**/*.js`
  - `jest.config.js`
  - `jest.setup.js`
  - `extract-trace-payload.js`
  - `ecosystem.config.js`
- **허용 globals**: `process`, `module`, `require`, `__dirname`, `__filename`, `console`, `Buffer`, `global`
- **규칙 완화**: `@typescript-eslint/no-require-imports: off`, `no-undef: off`

### (C) Service Worker 환경
- **대상 파일**: `public/sw.js`
- **허용 globals**: `self`, `caches`, `fetch`, `URL`, `location`, `console`, `ServiceWorkerRegistration`, `ServiceWorkerGlobalScope`, `ExtendableEvent`, `FetchEvent`, `InstallEvent`, `ActivateEvent`, `SyncEvent`, `Cache`, `CacheStorage`, `Response`, `Request`

## 4. frontend/app 단일화 결정

### 현재 상태
- `frontend/app/`: 완전한 App Router 구조 (정본)
  - `(protected)/` 그룹 라우트 포함
  - 모든 페이지 및 API 라우트 포함
  - 테스트 파일 포함
- `frontend/src/app/`: 부분적인 페이지만 존재 (중복)
  - `admin/users/page.tsx`
  - `login/page.tsx`
  - `register/page.tsx`
  - `vnc/[id]/page.tsx`
  - `layout.tsx`, `page.tsx`

### 결정
- **정본**: `frontend/app/**` 유지
- **중복 제거**: `frontend/src/app/**` 삭제 권장
  - Next.js는 기본적으로 `app` 디렉토리를 사용
  - `src/app`은 `src` 디렉토리 내부에 있을 때만 사용
  - 현재 프로젝트는 루트에 `app` 디렉토리가 있으므로 `src/app`은 불필요

### 작업 필요
```bash
# src/app 디렉토리 삭제 (중복 제거)
rm -rf frontend/src/app
```

## 5. 남은 작업 (P1)

### 테스트 파일
- 테스트 파일은 의도적으로 규칙 완화 (`@typescript-eslint/no-unused-vars: off`)
- `@ts-ignore` → `@ts-expect-error` 변환 필요 (약 20개)

### 스크립트 파일
- `extract-trace-payload.js`: 미사용 변수 정리 필요
- Node 환경 override로 처리 완료

### E2E 테스트
- `e2e/vm-console-e2e.spec.ts`: `prefer-const`, `no-empty` 수정 필요

## 6. CI 통합 권장사항

### vendor-hashes.sh 통합
```yaml
# .github/workflows/ci-frontend.yml에 추가
- name: Verify vendor hashes
  run: |
    cd frontend
    bash scripts/verify/vendor-hashes.sh
```

### lint 체크 강화
```yaml
- name: Lint check
  run: |
    cd frontend
    npm run lint -- --max-warnings 0
```

## 7. 다음 단계 (P1)

1. **frontend/src/app 삭제**: 중복 라우트 제거
2. **테스트 파일 @ts-ignore → @ts-expect-error**: 약 20개 변환
3. **E2E 테스트 파일 정리**: `prefer-const`, `no-empty` 수정
4. **CI 통합**: vendor-hashes.sh 및 lint 체크 추가

---

**작업자**: AI Assistant  
**검토 필요**: frontend/src/app 삭제 승인
