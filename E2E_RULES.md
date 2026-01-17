# E2E 테스트 필수 규칙

## 🔒 2. Hermetic E2E 필수 규칙 (위반 시 리젝)

### 환경 독립성

#### ❌ 절대 금지 사항
- `BASE_URL`, `ADMIN_USER`, `ADMIN_PASS` 같은 환경 변수 요구 금지
- `page.goto()` 원칙적으로 금지

#### ✅ 네트워크 모킹 필수
```typescript
// 모든 네트워크 요청은 반드시 모킹
await page.route('**/*', route => {
  // mockResponse 반환
});
```

### 스토리지 접근

#### ✅ localStorage 접근 규칙
localStorage 접근은 반드시 `page.addInitScript()` 또는 `context.addInitScript()` 사용:

```typescript
await context.addInitScript(() => {
  localStorage.setItem('key', 'value');
});
```

#### ❌ 금지 사항
- cross-origin 상태에서 localStorage 접근 금지
- blank page 상태에서 localStorage 접근 금지

### 브라우저 중립성

#### ✅ 작성 기준
- **Chromium 기준으로 작성**
- Firefox/WebKit은 Nightly에서 검증

#### ✅ 특정 브라우저 workaround 처리
특정 브라우저 workaround는 `@browser-only` 태그로 격리:

```typescript
// @browser-only: firefox
if (browserName === 'firefox') {
  // Firefox 전용 workaround
}
```

---

## 🌐 3. Nightly Cross-Browser 정책 (장기 안정성)

### 반드시 검증할 것
- ✅ Chromium
- ✅ Firefox
- ✅ WebKit

### 검증 항목
- token-refresh
- session 유지
- race-condition
- UI 상호작용 최소 시나리오

### 🚨 실패 처리

#### ❌ 절대 금지
- merge 차단 금지

#### ✅ 필수 조치
- 아티팩트 + trace + 영상 필수 저장
- 48시간 내 이슈화

---

## 📐 4. 테스트 코드 품질 규약 (교과서 기준)

### 테스트는 "행동"만 검증

#### ✅ 올바른 접근
- 사용자/브라우저 관점 결과만 검증
- DOM 상태, 사용자 액션 결과 검증

#### ❌ 금지 패턴
- 내부 구현 의존
- 상태 구조 의존
- 컴포넌트 내부 state 직접 접근

### 금지 패턴

#### ❌ 동일 scope 변수 재선언
```typescript
// ❌ 잘못된 예
let result;
result = await page.textContent('.element');
result = await page.textContent('.another'); // 재선언 금지

// ✅ 올바른 예
const firstResult = await page.textContent('.element');
const secondResult = await page.textContent('.another');
```

#### ❌ 테스트 간 상태 공유
```typescript
// ❌ 잘못된 예
let sharedState = {};

test('test 1', () => {
  sharedState.value = 'test'; // 상태 공유 금지
});

// ✅ 올바른 예
test('test 1', async ({ page }) => {
  // 각 테스트는 독립적이어야 함
});
```

#### ❌ 암묵적 타이밍 의존 (waitForTimeout)
```typescript
// ❌ 잘못된 예
await page.waitForTimeout(5000); // 금지

// ✅ 올바른 예
await page.waitForSelector('.element', { state: 'visible' });
await page.waitForResponse(response => response.url().includes('/api'));
await page.waitForFunction(() => {
  return localStorage.getItem('key') === null;
}, { timeout: 5000 });
```

---

## 🧱 5. CI / Workflow 규칙 (미래 대비)

### Workflow 파일 정책

#### `ci-frontend.yml`
- **용도**: PR Gate 전용
- 빠른 피드백을 위한 필수 테스트만 실행
- 실패 시 merge 차단

#### `nightly-e2e.yml`
- **용도**: Nightly 전용
- Cross-browser 검증 (Chromium, Firefox, WebKit)
- 전체 E2E 테스트 스위트 실행
- **실패 시 merge 차단하지 않음**

### Repo policy
- 허용 목록 명시 (우회 금지)

### 조건문 작성 규칙

#### ❌ 잘못된 예
```yaml
# if: 에서 env, secrets 직접 비교 금지
if: ${{ env.BRANCH == 'main' }}
if: ${{ secrets.ADMIN_PASS }}
if: ${{ github.event_name == 'workflow_dispatch' && inputs.run_integration == 'true' }}
```

#### ✅ 올바른 예
```yaml
# 반드시 step-level run에서 체크
- name: Check condition
  run: |
    if [ "${{ github.event.inputs.run_integration }}" != "true" ]; then
      echo "Skipping..."
      exit 0
    fi
```

---

## 📝 체크리스트

PR 제출 전 확인:

- [ ] `BASE_URL`, `ADMIN_USER`, `ADMIN_PASS` 같은 환경 변수 사용하지 않음 (Hermetic 테스트)
- [ ] `page.goto()` 사용하지 않음
- [ ] 모든 네트워크 요청 모킹 (`page.route()` 또는 `context.route()`)
- [ ] localStorage 접근은 `context.addInitScript()` 또는 `page.addInitScript()` 사용
- [ ] cross-origin/blank page에서 localStorage 접근하지 않음
- [ ] Chromium 기준으로 작성됨
- [ ] 특정 브라우저 workaround는 `@browser-only` 태그 사용
- [ ] 테스트는 행동만 검증 (내부 구현 의존 없음)
- [ ] 동일 scope 변수 재선언 없음
- [ ] 테스트 간 상태 공유 없음
- [ ] `waitForTimeout` 사용하지 않음 (명시적 대기 사용)
- [ ] CI 워크플로우 조건문은 step-level run에서 체크
- [ ] Nightly 실패 시 merge 차단하지 않음
