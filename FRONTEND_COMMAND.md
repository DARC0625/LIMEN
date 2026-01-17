# FRONTEND 명령: "Core/Browser 경계 복원 + 테스트 2트랙 정착" (정석/장기 플랜)

## 0) 지금 테스트가 갑자기 40~80개씩 터진 "진짜 이유"

1. **core 테스트(node 환경)** 에서 돌아가던 모듈이, 최근 변경으로 **`window`, `location`, `BroadcastChannel`, `Storage`** 같은 브라우저 전용 API에 기대기 시작함.
2. 그동안은 우연히(jsdom/글로벌 mock/테스트 순서) 통과하던 것이, E2E harness/테스트 환경/번들링 변경으로 **결정적으로 드러남**.
3. 즉, "테스트가 갑자기 이상해진 게 아니라" **아키텍처 경계가 흐려진 게 테스트로 폭로된 것**.

→ 결론: **복구(rollback)가 아니라, 경계를 명시적으로 고쳐야 함.** 이게 너가 말한 "근본 정석"이다.

---

## 1) 왜 예전에 Jest(Node)랑 DOM(jsdom)을 나눴고, 지금 왜 다시 섞이는 듯 보이냐?

### 예전 분리 이유(정석)

* **Node 환경(core test)**: 빠름/결정적/브라우저 API 없어도 돌아가는 "순수 로직" 검증
* **jsdom(UI test)**: DOM 이벤트/렌더링/브라우저 유사 API가 필요한 것만 검증

### 지금 "다시 합치는 듯 보이는" 이유(실은 합치면 안 됨)

* core 영역 코드가 브라우저 API를 직접 만지기 시작하면서, 사람들이 "jsdom으로 돌리면 되잖아"로 도망가려 함.
* 하지만 그건 **장기적으로 독**임: core가 브라우저에 종속되면, 테스트/번들/SSR/런타임 전부 취약해진다.

→ 정답: **합치는 게 아니라, 'Port/Adapter'로 분리해서 core는 node에서도 100% 돌아가게 유지**.

---

## 2) 실행 지시: Port/Adapter 패턴으로 브라우저 의존성 "봉인"

### (A) Port 인터페이스 추가 (새 파일)

#### `lib/ports/storagePort.ts`

```typescript
/**
 * Storage 포트 인터페이스
 * 브라우저 localStorage/sessionStorage 의존성을 추상화
 */
export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

export interface SessionStoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}
```

#### `lib/ports/locationPort.ts`

```typescript
/**
 * Location 포트 인터페이스
 * 브라우저 window.location 의존성을 추상화
 */
export interface LocationPort {
  getPathname(): string;
  redirect(url: string): void;
}
```

#### `lib/ports/broadcastPort.ts`

```typescript
/**
 * Broadcast 포트 인터페이스
 * 브라우저 BroadcastChannel 의존성을 추상화
 */
export interface BroadcastPort {
  postAuthEvent(payload: { type: string; reason?: string; action?: string }): void;
  close(): void;
}
```

#### `lib/ports/clockPort.ts` (선택, 권장)

```typescript
/**
 * Clock 포트 인터페이스
 * Date.now() 의존성을 추상화 (테스트에서 시간 제어 가능)
 */
export interface ClockPort {
  now(): number;
}
```

### (B) Adapter 구현체 추가

#### `lib/adapters/browserStoragePort.ts`

```typescript
import { StoragePort } from '../ports/storagePort';

export function createBrowserStoragePort(storage: Storage): StoragePort {
  return {
    get: (key: string) => storage.getItem(key),
    set: (key: string, value: string) => storage.setItem(key, value),
    remove: (key: string) => storage.removeItem(key),
    clear: () => storage.clear(),
  };
}

export const browserLocalStoragePort = typeof window !== 'undefined'
  ? createBrowserStoragePort(window.localStorage)
  : null;

export const browserSessionStoragePort = typeof window !== 'undefined'
  ? createBrowserStoragePort(window.sessionStorage)
  : null;
```

#### `lib/adapters/browserBroadcastPort.ts`

```typescript
import { BroadcastPort } from '../ports/broadcastPort';

export function createBrowserBroadcastPort(channelName: string = 'auth_channel'): BroadcastPort | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  const channel = new BroadcastChannel(channelName);
  return {
    postAuthEvent: (payload) => {
      channel.postMessage(payload);
    },
    close: () => {
      channel.close();
    },
  };
}
```

#### `lib/adapters/browserLocationPort.ts`

```typescript
import { LocationPort } from '../ports/locationPort';

export function createBrowserLocationPort(): LocationPort | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return {
    getPathname: () => window.location.pathname,
    redirect: (url: string) => {
      window.location.href = url;
    },
  };
}
```

#### `lib/adapters/memoryStoragePort.ts` (테스트용)

```typescript
import { StoragePort } from '../ports/storagePort';

export function createMemoryStoragePort(): StoragePort {
  const storage = new Map<string, string>();
  return {
    get: (key: string) => storage.get(key) || null,
    set: (key: string, value: string) => storage.set(key, value),
    remove: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  };
}
```

#### `lib/adapters/noopBroadcastPort.ts` (테스트용)

```typescript
import { BroadcastPort } from '../ports/broadcastPort';

export function createNoopBroadcastPort(): BroadcastPort {
  return {
    postAuthEvent: () => {
      // no-op
    },
    close: () => {
      // no-op
    },
  };
}
```

#### `lib/adapters/memoryLocationPort.ts` (테스트용)

```typescript
import { LocationPort } from '../ports/locationPort';

export function createMemoryLocationPort(initialPathname: string = '/'): LocationPort {
  let pathname = initialPathname;
  let redirectUrl: string | null = null;

  return {
    getPathname: () => pathname,
    redirect: (url: string) => {
      redirectUrl = url;
      // 테스트에서 redirect 호출 여부 확인 가능
    },
    // 테스트용 헬퍼
    getRedirectUrl: () => redirectUrl,
    setPathname: (p: string) => { pathname = p; },
  };
}
```

### (C) tokenManager/security 리팩터링 원칙 (정석)

#### `lib/tokenManager.ts` 리팩터링

**현재 문제**:
```typescript
// ❌ 직접 localStorage/sessionStorage 접근
localStorage.removeItem('refresh_token');
sessionStorage.removeItem('csrf_token');
```

**정석 해결**:
```typescript
// ✅ Port 주입
export class TokenManager {
  constructor(
    private storage: StoragePort,
    private sessionStorage: SessionStoragePort,
    private clock: ClockPort = { now: () => Date.now() }
  ) {}

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    
    this.storage.remove('refresh_token');
    this.storage.remove('token_expires_at');
    this.sessionStorage.remove('csrf_token');
    
    this.csrfToken = null;
  }
}

// 팩토리 함수
export function createTokenManager(
  storage?: StoragePort,
  sessionStorage?: SessionStoragePort,
  clock?: ClockPort
): TokenManager {
  const defaultStorage = storage ?? (typeof window !== 'undefined' 
    ? createBrowserStoragePort(window.localStorage)
    : createMemoryStoragePort());
  
  const defaultSessionStorage = sessionStorage ?? (typeof window !== 'undefined'
    ? createBrowserStoragePort(window.sessionStorage)
    : createMemoryStoragePort());
  
  const defaultClock = clock ?? { now: () => Date.now() };
  
  return new TokenManager(defaultStorage, defaultSessionStorage, defaultClock);
}

// 기존 호환성 유지 (싱글톤)
export const tokenManager = typeof window !== 'undefined'
  ? createTokenManager()
  : createTokenManager(createMemoryStoragePort(), createMemoryStoragePort());
```

#### `lib/security.ts` 리팩터링

**현재 문제**:
```typescript
// ❌ 직접 window.location/BroadcastChannel 접근
if (typeof window === 'undefined') return;
logger.warn('[Security Log] Logout event detected:', {
  pathname: window.location.pathname,
});
const channel = new BroadcastChannel('auth_channel');
```

**정석 해결**:
```typescript
// ✅ Port 주입
export function forceLogout(
  reason: string = '보안상의 이유로 로그아웃되었습니다.',
  options?: {
    location?: LocationPort;
    broadcast?: BroadcastPort;
    logger?: LoggerPort;
  }
): { action: 'LOGOUT'; reason: string; pathname?: string } {
  const location = options?.location;
  const broadcast = options?.broadcast;
  const logger = options?.logger ?? consoleLogger;
  
  const pathname = location?.getPathname() ?? '/';
  
  logger.warn('[Security Log] Logout event detected:', {
    reason,
    pathname,
    timestamp: new Date().toISOString(),
  });
  
  // Broadcast는 실행하지 않고, 결과에 포함
  if (broadcast) {
    broadcast.postAuthEvent({
      type: 'AUTH_EVENT',
      reason,
      action: 'log',
    });
    broadcast.close();
  }
  
  // Redirect는 실행하지 않고, 결과에 포함
  // 실제 redirect는 브라우저 레이어에서 수행
  return {
    action: 'LOGOUT',
    reason,
    pathname,
  };
}

// 브라우저용 래퍼 (기존 호환성 유지)
export function forceLogoutBrowser(reason?: string): void {
  const result = forceLogout(reason, {
    location: typeof window !== 'undefined' ? createBrowserLocationPort() : null,
    broadcast: typeof window !== 'undefined' ? createBrowserBroadcastPort() : null,
  });
  
  // 브라우저 레이어에서 redirect 수행
  if (result.pathname && typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
```

**중요 규칙**:
* core 함수는 "리다이렉트 실행" 대신
  **`{ action: 'LOGOUT', reason }` 같은 결과를 반환**하고,
  실제 redirect/broadcast는 **브라우저 레이어에서 수행**.

이렇게 해야 E2E/Jest/SSR/Node 전부에서 흔들리지 않는다.

---

## 3) Jest 설정: "합치지 말고, 프로젝트 2개로 공식 분리" (정석)

### 목표

* core 테스트: `testEnvironment: node`
* UI/브라우저 의존 테스트: `testEnvironment: jsdom`

### 실행 지시

#### `jest.core.config.ts` (새 파일)

```typescript
import type { Config } from 'jest';

const config: Config = {
  displayName: 'core',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '\\.ui\\.test\\.ts$', // UI 테스트는 제외
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    '!lib/**/*.d.ts',
    '!lib/**/*.test.{ts,tsx}',
  ],
};

export default config;
```

#### `jest.ui.config.ts` (새 파일)

```typescript
import type { Config } from 'jest';

const config: Config = {
  displayName: 'ui',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.ui.test.ts',
    '**/__tests__/**/*.ui.test.tsx',
    '**/app/**/__tests__/**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/*.test.{ts,tsx}',
  ],
};

export default config;
```

#### `jest.config.ts` (수정)

```typescript
import type { Config } from 'jest';
import coreConfig from './jest.core.config';
import uiConfig from './jest.ui.config';

const config: Config = {
  projects: [coreConfig, uiConfig],
};

export default config;
```

#### `package.json` 스크립트 업데이트

```json
{
  "scripts": {
    "test": "jest",
    "test:core": "jest --selectProjects core",
    "test:ui": "jest --selectProjects ui",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 테스트 파일 분류 규칙

* `lib/**/__tests__/**/*.test.ts` → core (node 환경)
* `lib/**/__tests__/**/*.ui.test.ts` → ui (jsdom 환경, 브라우저 API 의존)
* `app/**/__tests__/**/*.test.tsx` → ui (jsdom 환경)

### 지금 보이는 대표 에러들의 "정석 처리"

* `window is not defined`
  → 테스트를 jsdom으로 보내는 게 아니라, **해당 코드가 core에서 window를 쓰는지부터 제거**.
* `Storage is not defined`
  → StoragePort로 바꾸면 사라짐. (Storage.prototype mock 같은 방식은 장기적으로 취약)
* BroadcastChannel 관련 실패
  → `globalThis.BroadcastChannel` mock vs `window.BroadcastChannel` 섞임 문제.
  → BroadcastPort로 바꾸면 테스트는 port mock 1개로 끝.

---

## 4) E2E(PR Gate) 정석 원칙: "멈추지 않고, 원인을 남기고, hermetic 유지"

### (A) runS4/runS3 계약

* **절대 throw / 절대 무한대기 금지**
* 항상 `{ ok: true } | { ok: false, reason, diag }` 로 종료
* 내부 비동기는 반드시 `withTimeout`로 감싸서 **CI에서 멈출 수 없게**.

**현재 상태**: ✅ 이미 `withTimeout` 적용됨

### (B) 지금 S4가 흔들리는 핵심 포인트(정석 관점)

* refresh가 "안 나간다/0회다/상태가 null이다"는 건
  1. 토큰이 만료로 인식되지 않았거나
  2. refresh URL 매칭/route 설정이 틀렸거나
  3. refresh 로직이 core에서 조기 리턴하거나(예: refreshToken 없음으로 판단)

**정석 해결**:
* TokenManager에 '테스트 훅'이 아니라 'Port'로 상태를 주입
* "만료 상태"를 100% 결정적으로 만들기

**E2E harness 개선**:
```typescript
// ✅ Port 기반으로 상태 주입
const storagePort = createMemoryStoragePort();
const sessionStoragePort = createMemoryStoragePort();
const clockPort = { now: () => Date.now() - 1000 }; // 확실히 만료

const testTokenManager = createTokenManager(storagePort, sessionStoragePort, clockPort);
testTokenManager.setRefreshToken('test-refresh-token');
// expiresAt은 clockPort.now() 기준으로 자동 계산됨
```

이렇게 하면 route/fulfill 최소화하고, 상태는 Port로 100% 제어 가능.

---

## 5) 커밋 플랜(정석, 되돌림 없이 앞으로)

### 커밋 1: Port 인터페이스 추가
- `lib/ports/storagePort.ts`
- `lib/ports/locationPort.ts`
- `lib/ports/broadcastPort.ts`
- `lib/ports/clockPort.ts` (선택)

### 커밋 2: Adapter 구현체 추가
- `lib/adapters/browserStoragePort.ts`
- `lib/adapters/browserBroadcastPort.ts`
- `lib/adapters/browserLocationPort.ts`
- `lib/adapters/memoryStoragePort.ts`
- `lib/adapters/noopBroadcastPort.ts`
- `lib/adapters/memoryLocationPort.ts`

### 커밋 3: tokenManager 리팩터링
- `lib/tokenManager.ts`: Port 주입 방식으로 변경
- `createTokenManager()` 팩토리 함수 추가
- 기존 `tokenManager` 싱글톤은 브라우저용 래퍼로 유지

### 커밋 4: security 리팩터링
- `lib/security.ts`: Port 주입 방식으로 변경
- `forceLogout()`는 결과 객체 반환 (redirect 실행 안 함)
- `forceLogoutBrowser()` 래퍼 추가 (기존 호환성 유지)

### 커밋 5: Jest 프로젝트 분리
- `jest.core.config.ts` 생성
- `jest.ui.config.ts` 생성
- `jest.config.ts`를 projects로 변경
- `package.json` 스크립트 업데이트

### 커밋 6: 테스트 파일 분류/수정
- `lib/**/__tests__/**/*.test.ts` 확인 및 수정
- 브라우저 의존 테스트는 `*.ui.test.ts`로 rename
- Port mock 기반으로 테스트 수정

### 커밋 7: E2E harness Port 기반으로 개선
- `e2e/harness-entry.ts`: Port 기반 상태 주입
- `e2e/token-refresh.spec.ts`: Port 기반 토큰 설정

### 커밋 8: ESLint 규칙 추가 (선택, 권장)
- `lib/**`에서 `window|document|localStorage|sessionStorage|BroadcastChannel` 직접 사용 금지

---

## 6) 체크리스트

### Phase 1: Port/Adapter 추가 (기능 영향 없음)
- [ ] `lib/ports/storagePort.ts` 생성
- [ ] `lib/ports/locationPort.ts` 생성
- [ ] `lib/ports/broadcastPort.ts` 생성
- [ ] `lib/ports/clockPort.ts` 생성 (선택)
- [ ] `lib/adapters/browserStoragePort.ts` 생성
- [ ] `lib/adapters/browserBroadcastPort.ts` 생성
- [ ] `lib/adapters/browserLocationPort.ts` 생성
- [ ] `lib/adapters/memoryStoragePort.ts` 생성
- [ ] `lib/adapters/noopBroadcastPort.ts` 생성
- [ ] `lib/adapters/memoryLocationPort.ts` 생성

### Phase 2: Core 리팩터링
- [ ] `lib/tokenManager.ts`: Port 주입 방식으로 변경
- [ ] `lib/security.ts`: Port 주입 방식으로 변경
- [ ] 기존 호환성 유지 (브라우저용 래퍼 함수)

### Phase 3: Jest 분리
- [ ] `jest.core.config.ts` 생성
- [ ] `jest.ui.config.ts` 생성
- [ ] `jest.config.ts` projects로 변경
- [ ] `package.json` 스크립트 업데이트

### Phase 4: 테스트 수정
- [ ] `lib/**/__tests__/**/*.test.ts` Port mock 기반으로 수정
- [ ] 브라우저 의존 테스트 `*.ui.test.ts`로 rename
- [ ] 모든 core 테스트가 node 환경에서 통과 확인

### Phase 5: E2E 개선
- [ ] `e2e/harness-entry.ts`: Port 기반 상태 주입
- [ ] `e2e/token-refresh.spec.ts`: Port 기반 토큰 설정
- [ ] CI에서 30초 timeout 재발 방지 확인

### Phase 6: Lint 규칙 (선택)
- [ ] ESLint 규칙 추가: `lib/**`에서 브라우저 API 직접 사용 금지

---

## 7) 검증 기준

### Core 테스트 (node 환경)
- ✅ `lib/**/__tests__/**/*.test.ts` 모두 node 환경에서 통과
- ✅ `window`, `localStorage`, `BroadcastChannel` 직접 사용 없음
- ✅ Port mock으로 모든 의존성 제어 가능

### UI 테스트 (jsdom 환경)
- ✅ `app/**/__tests__/**/*.test.tsx` 모두 jsdom 환경에서 통과
- ✅ `lib/**/__tests__/**/*.ui.test.ts` 모두 jsdom 환경에서 통과

### E2E 테스트
- ✅ CI에서 30초 timeout 재발 없음
- ✅ `runS4/runS3` 항상 결과 객체 반환 (무한대기 없음)
- ✅ Port 기반으로 상태 100% 제어 가능

---

## 8) 주의사항

1. **응급처치 금지**: jsdom으로 전체를 합쳐서 통과시키는 것은 금지
2. **기존 호환성 유지**: 브라우저용 래퍼 함수로 기존 코드 동작 유지
3. **점진적 마이그레이션**: 한 번에 모든 것을 바꾸지 말고, 단계적으로 진행
4. **테스트 우선**: 리팩터링 전에 테스트가 Port mock으로 동작하는지 확인

---

## 9) 예상 소요 시간

- Phase 1 (Port/Adapter 추가): 2-3시간
- Phase 2 (Core 리팩터링): 4-6시간
- Phase 3 (Jest 분리): 1-2시간
- Phase 4 (테스트 수정): 4-6시간
- Phase 5 (E2E 개선): 2-3시간
- Phase 6 (Lint 규칙): 1시간

**총 예상 시간**: 14-21시간 (2-3일)

---

## 10) 롤백 계획

각 Phase는 독립적으로 커밋되므로, 문제 발생 시 해당 Phase만 롤백 가능.

---

## 최종 "명령" 요약

* "jsdom으로 덮어서 통과" 금지. **core에서 window/localStorage/BroadcastChannel 직접 접근 제거**가 1순위.
* Port/Adapter로 **경계를 코드로 고정**하고, Jest는 **core(node)/ui(jsdom) 2프로젝트**로 공식 분리.
* E2E PR Gate는 **멈추지 않는 계약(runS4/runS3) + 결정적 상태 주입(ports)** 으로 안정화.
