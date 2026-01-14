# E2E 테스트 전략 (2단 레이어)

## 철학

**PR Gate (merge 차단)**와 **플랫폼 커버리지 (광역 테스트)**는 같은 레이어에 두면 CI가 곧 무너집니다.

- **PR Gate**: 안정적 최소세트로 빠르고 신뢰성 높게 실행
- **Nightly/스테이징**: 멀티플랫폼 풀스윕으로 광역 커버리지 확보

## 레이어 구조

### 1. PR Gate (`ci-frontend.yml`)

**목표**: P0 버그(토큰 꼬임 등)를 항상 막는다 (신뢰성 1순위)

- **Hermetic Only**: `token-refresh.spec.ts`만 실행
- **Chromium Only**: 1브라우저로 고정 (빠르고 안정적)
- **실행 시점**: 모든 PR, 모든 push
- **실패 시**: merge 차단

**특징**:
- localhost/webServer 의존 없음 (`about:blank` 사용)
- 완전 모킹 기반 (실서버 의존 제거)
- 0-flake 목표

### 2. Nightly Cross-Browser Sweep (`nightly-e2e.yml`)

**목표**: 멀티플랫폼 정상작동 담보

#### 2-1. Hermetic Cross-Browser

- **Hermetic**: `token-refresh.spec.ts`만 실행
- **3브라우저**: chromium, firefox, webkit 전부 실행
- **실행 시점**: 매일 한국시간 오전 3시 (UTC 18:00) + 수동 실행 가능
- **실패 시**: 리포트만 생성 (merge 차단 안 함)

**특징**:
- `fail-fast: false` (한 브라우저 실패해도 나머지 계속 실행)
- 브라우저별 trace/video 아티팩트 자동 수집
- 브라우저별 차이를 여기서 잡음

#### 2-2. Integration Sweep

- **Integration**: `vm-console-e2e.spec.ts`, `compatibility.spec.ts`
- **실서버 의존**: 실제 백엔드/계정 필요
- **실행 시점**: Nightly (환경변수 설정 시)
- **향후**: Self-hosted runner로 이동 예정

**특징**:
- 환경변수(`ADMIN_USER`, `ADMIN_PASS`, `BASE_URL`) 필요
- 기관망/프록시 조건도 여기서 추가 검증 예정

## 테스트 파일 분류

### Hermetic (PR Gate + Nightly)

- `e2e/token-refresh.spec.ts`
  - 완전 모킹 기반
  - localhost/webServer 의존 없음
  - 실서버 의존 없음

### Integration (Nightly Only)

- `e2e/vm-console-e2e.spec.ts`
  - 실서버 의존 (VM 생성/콘솔 연결)
  - 환경변수 필요

- `e2e/compatibility.spec.ts`
  - 브라우저 호환성 진단
  - 실서버 의존

## 실행 방법

### PR Gate (자동)

모든 PR, 모든 push에서 자동 실행

### Nightly (자동 + 수동)

**자동 실행**:
- 매일 한국시간 오전 3시 (UTC 18:00)

**수동 실행**:
```bash
# GitHub Actions에서 "Nightly E2E (Cross-Browser + Integration)" 워크플로 수동 실행
```

### 로컬 실행

```bash
# Hermetic only (PR Gate와 동일)
npm run test:e2e

# Integration (실서버 필요)
npm run test:e2e:integration

# 전체
npx playwright test
```

## KPI 목표

### PR Gate

- **Flaky Rate**: 0%
- **실행 시간**: < 60초
- **실패 시**: 즉시 merge 차단

### Nightly Cross-Browser

- **Pass Rate**: >= 95% (초기 목표, 점진 상향)
- **브라우저별 결함 해결 리드타임**: < 48h
- **실패 시**: 리포트 생성 (merge 차단 안 함)

### Integration

- **Time-to-first-frame**: < 2s (정상망)
- **기관망 조건**: 측정 후 기준 설정
- **실패 시**: 리포트 생성 (merge 차단 안 함)

## 향후 계획

### Self-Hosted Runner

- Integration job을 self-hosted runner로 이동
- 기관망/프록시 조건 추가 검증
- 내부망 접근 가능한 환경에서 실행

### 기관망 시뮬레이션

- Envoy/WS 타임아웃/keepalive 튜닝 검증
- 프록시/DPI 조건 추가
- 대역폭 제한 시뮬레이션

## 트러블슈팅

### PR Gate 실패

1. 로컬에서 `npm run test:e2e` 실행하여 재현
2. Playwright report 확인
3. trace/video 아티팩트 확인

### Nightly 실패

1. 브라우저별 job 결과 확인
2. trace/video 아티팩트 확인
3. 브라우저별 차이 분석

### Integration 실패

1. 환경변수 확인 (`ADMIN_USER`, `ADMIN_PASS`, `BASE_URL`)
2. 실서버 상태 확인
3. Self-hosted runner 준비 검토
