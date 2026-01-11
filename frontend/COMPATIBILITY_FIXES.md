# 브라우저 호환성 수정 사항

## 적용된 수정 사항

### 1. navigator.clipboard 폴리필 적용

**문제**: `navigator.clipboard`는 Firefox 구버전과 Safari 구버전에서 지원되지 않음

**해결**:
- `lib/utils/clipboard.ts` 생성: 폴리필 함수 제공
- `components/VMListSection.tsx`: UUID 복사 버튼에 폴리필 적용
- `app/(protected)/admin/users/page.tsx`: 사용자 UUID 복사에 폴리필 적용

**폴백 메커니즘**:
1. `navigator.clipboard.writeText()` 시도 (최신 브라우저)
2. 실패 시 `document.execCommand('copy')` 사용 (구형 브라우저)

### 2. AbortController 호환성

**상태**: 이미 처리됨
- `lib/api/client.ts`에서 `typeof AbortController !== 'undefined'` 체크 후 사용
- 대부분의 최신 브라우저에서 지원됨

### 3. browserslist 설정

**추가**: `.browserslistrc` 파일 생성
- 최신 2개 버전의 주요 브라우저 지원
- 최소 지원 버전 명시 (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

## 검색 결과

다음 API들은 현재 코드베이스에서 사용되지 않음:
- `crypto.randomUUID()`: 사용되지 않음
- `structuredClone()`: 사용되지 않음
- `ReadableStream`: 사용되지 않음
- `TextEncoder/TextDecoder`: 사용되지 않음

## 체크리스트 점검

### ✅ 완료된 항목

- [x] `navigator.clipboard` 폴리필 적용
- [x] `AbortController` 호환성 확인 (이미 처리됨)
- [x] `browserslist` 설정 추가
- [x] Playwright 호환성 테스트 설정
- [x] 호환성 진단 테스트 작성

### ⚠️ 추가 확인 필요

- [ ] 빌드 산출물에서 ES 타깃 확인
  ```bash
  npm run build && grep -r "=>\|class \|async function" .next/static | head
  ```
- [ ] 프로덕션 빌드에서 폴리필이 제대로 포함되는지 확인

## 다음 단계

1. Playwright 브라우저 설치:
   ```bash
   npm run test:compatibility:install
   ```

2. 호환성 테스트 실행:
   ```bash
   BASE_URL="https://limen.kr" npm run test:compatibility
   ```

3. 결과 확인 및 문제 해결:
   - HTML 리포트: `npx playwright show-report`
   - Trace 파일: `test-results/` 디렉토리
