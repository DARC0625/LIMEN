# 브라우저 호환성 진단 가이드

## 개요

이 문서는 Chromium, Firefox, WebKit에서의 프론트엔드 호환성을 자동으로 진단하는 방법을 설명합니다.

## 설치

```bash
cd /home/darc/LIMEN/frontend

# Playwright 설치
npm install -D @playwright/test

# 브라우저 설치 (최초 1회)
npm run test:compatibility:install
```

## 실행 방법

### 기본 실행 (모든 브라우저)

```bash
# 로컬 개발 서버 대상
npm run test:compatibility

# 베타 URL 대상
BASE_URL="https://limen.kr" npm run test:compatibility
```

### 특정 브라우저만 테스트

```bash
# Chromium만
BASE_URL="https://limen.kr" npm run test:compatibility -- --project=chromium

# Firefox만
BASE_URL="https://limen.kr" npm run test:compatibility -- --project=firefox

# WebKit만
BASE_URL="https://limen.kr" npm run test:compatibility -- --project=webkit
```

### Trace 파일 생성 (실패 시 재현 증거)

```bash
BASE_URL="https://limen.kr" npm run test:compatibility -- --trace on --retries=0
```

## 테스트 시나리오

테스트는 다음 3가지를 확인합니다:

1. **페이지 접속 성공 여부**
   - 루트 페이지(`/`) 로드
   - 페이지 타이틀 확인

2. **API 호출 성공 여부**
   - `/api/health` 호출 확인
   - `/api/me` 호출 확인 (로그인 후)

3. **콘솔 연결 버튼 클릭 후 WS 연결 시도 여부**
   - VNC 콘솔 버튼 클릭
   - WebSocket 연결 시도 감지

## 결과 확인

### 콘솔 출력

각 브라우저별로 다음 정보가 출력됩니다:

```
[chromium] ====== 진단 결과 요약 ======
[chromium] 페이지 접속: ✅
[chromium] Health API: ✅
[chromium] /api/me: ✅
[chromium] 콘솔 버튼: ✅
[chromium] 에러 개수: 0
[chromium] 네트워크 요청 개수: 45
```

### HTML 리포트

```bash
# 테스트 실행 후
npx playwright show-report
```

### Trace 파일

실패한 테스트의 trace 파일은 `test-results/` 디렉토리에 저장됩니다.

## 환경 변수

- `BASE_URL`: 테스트 대상 URL (기본값: `http://localhost:9444`)
- `TEST_USERNAME`: 테스트 계정 사용자명 (기본값: `test`)
- `TEST_PASSWORD`: 테스트 계정 비밀번호 (기본값: `test`)

## DoD (Definition of Done)

각 엔진별로 다음을 확인:

- ✅ (1) 페이지 접속 성공 여부
- ✅ (2) API 호출(health/me 등) 성공 여부
- ✅ (3) 콘솔 버튼 클릭 후 WS 연결 시도 여부

모든 항목이 CLI 로그 + trace 파일로 남아야 합니다.

## 문제 해결

### 브라우저가 설치되지 않음

```bash
npm run test:compatibility:install
```

### 타임아웃 오류

환경 변수로 타임아웃을 늘릴 수 있습니다:

```bash
PLAYWRIGHT_TIMEOUT=60000 BASE_URL="https://limen.kr" npm run test:compatibility
```

### 로그인 실패

테스트 계정 정보를 환경 변수로 지정:

```bash
TEST_USERNAME="your-username" TEST_PASSWORD="your-password" BASE_URL="https://limen.kr" npm run test:compatibility
```
