# 품질 게이트 (Quality Gates)

이 문서는 LIMEN 프론트엔드의 품질 게이트 설정 및 실행 방법을 설명합니다.

## 품질 게이트 명령어

### 전체 품질 게이트 실행
```bash
pnpm quality-gate
```

이 명령어는 다음을 순차적으로 실행합니다:
1. `pnpm lint` - ESLint 검사
2. `pnpm typecheck` - TypeScript 타입 검사
3. `pnpm build` - 프로덕션 빌드
4. `pnpm test` - 단위 테스트

**모든 단계가 통과해야 merge가 가능합니다.**

## 개별 명령어

### Lint
```bash
pnpm lint
```
- ESLint를 사용하여 코드 스타일 및 잠재적 오류 검사
- 최대 경고 50개까지 허용
- 자동 수정: `pnpm lint:fix`

### Type Check
```bash
pnpm typecheck
```
- TypeScript 컴파일러를 사용하여 타입 오류 검사
- 빌드 없이 타입만 검사 (`tsc --noEmit`)

### Build
```bash
pnpm build
```
- 프로덕션 빌드 실행
- Next.js Turbopack 사용
- noVNC 번들 패치 및 CSS 링크 수정 포함

### Test
```bash
pnpm test
```
- Jest를 사용한 단위 테스트 실행
- 커버리지 확인: `pnpm test:coverage`

## CI/CD 통합

### GitHub Actions 예시
```yaml
name: Quality Gate

on: [push, pull_request]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm quality-gate
```

## 품질 기준

### Lint
- ✅ 경고 50개 이하
- ❌ 경고 50개 초과 시 실패

### Type Check
- ✅ 타입 오류 0개
- ❌ 타입 오류 1개 이상 시 실패

### Build
- ✅ 빌드 성공 및 모든 파일 생성
- ❌ 빌드 실패 또는 파일 누락 시 실패

### Test
- ✅ 모든 테스트 통과
- ❌ 테스트 실패 시 실패

## 문제 해결

### Lint 오류 수정
```bash
# 자동 수정 가능한 오류 수정
pnpm lint:fix

# 수동 수정 필요 시
pnpm lint
```

### Type 오류 수정
```bash
# 타입 오류 확인
pnpm typecheck

# 타입 정의 추가 또는 수정
```

### Build 실패 해결
```bash
# 캐시 정리 후 재빌드
rm -rf .next node_modules/.cache
pnpm build
```

### Test 실패 해결
```bash
# 테스트 실행 및 디버깅
pnpm test --verbose

# 특정 테스트만 실행
pnpm test --testNamePattern="test name"
```

## 업데이트 이력
- 2026-01-10: 초기 작성
