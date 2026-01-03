# LIMEN 배포 보안 가이드

## 개요

LIMEN 프로젝트는 보안을 위해 각 서버가 자신의 코드만 배포하도록 설계되었습니다.
프론트엔드 서버에는 백엔드 코드가 포함되지 않고, 백엔드 서버에는 프론트엔드 코드가 포함되지 않습니다.

## 보안 원칙

### 1. 코드 분리 원칙

- **백엔드 서버**: 백엔드 코드 + RAG 문서만 포함
- **프론트엔드 서버**: 프론트엔드 코드 + RAG 문서만 포함
- **RAG 문서**: 두 서버 모두 공유 (문서는 보안 위협이 아님)

### 2. 보안 위협

다음과 같은 경우 보안 위협이 됩니다:

#### 백엔드 서버에 프론트엔드 코드 포함
- 프론트엔드 소스 코드 노출
- 프론트엔드 설정 파일 노출
- 불필요한 의존성 증가

#### 프론트엔드 서버에 백엔드 코드 포함
- 백엔드 비즈니스 로직 노출
- 데이터베이스 스키마 노출
- 인증/인가 로직 노출
- 환경 변수 및 시크릿 노출 위험

## 배포 스크립트

### 백엔드 서버 배포

```bash
# 백엔드 배포 디렉토리 생성
./scripts/deploy-backend.sh

# 배포 패키지 생성
./scripts/deploy-backend.sh --package
```

**포함되는 내용:**
- ✅ `backend/` 폴더 전체
- ✅ `RAG/` 문서 (vectors, index, embeddings 제외)
- ✅ 백엔드 관련 스크립트
- ✅ docker-compose.yml
- ❌ `frontend/` 폴더 (제외)
- ❌ 프론트엔드 관련 파일 (제외)

### 프론트엔드 서버 배포

```bash
# 프론트엔드 배포 디렉토리 생성
./scripts/deploy-frontend.sh

# 배포 패키지 생성
./scripts/deploy-frontend.sh --package
```

**포함되는 내용:**
- ✅ `frontend/` 폴더 전체
- ✅ `RAG/` 문서 (vectors, index, embeddings 제외)
- ✅ 프론트엔드 관련 설정
- ❌ `backend/` 폴더 (제외)
- ❌ 백엔드 관련 파일 (제외)

## 보안 검증

배포 스크립트는 자동으로 보안 검증을 수행합니다:

### 백엔드 배포 검증
- 프론트엔드 코드 포함 여부 확인
- 프론트엔드 설정 파일 포함 여부 확인

### 프론트엔드 배포 검증
- 백엔드 코드 포함 여부 확인
- 백엔드 관련 파일 포함 여부 확인

검증 실패 시 배포가 중단됩니다.

## 배포 프로세스

### 1. 개발 환경 (리포지토리)
```
LIMEN/
├── backend/          # 백엔드 코드
├── frontend/         # 프론트엔드 코드
├── RAG/              # 공유 문서
└── ...
```

### 2. 백엔드 서버 배포
```
deploy-backend/
├── backend/          # 백엔드 코드만
├── RAG/              # 공유 문서
├── scripts/          # 백엔드 스크립트
└── docker-compose.yml
```

### 3. 프론트엔드 서버 배포
```
deploy-frontend/
├── frontend/         # 프론트엔드 코드만
├── RAG/              # 공유 문서
└── ...
```

## 수동 배포 시 주의사항

### ❌ 금지 사항

1. **전체 리포지토리를 서버에 복사**
   ```bash
   # 절대 하지 마세요!
   cp -r LIMEN/ /server/
   ```

2. **Git 클론을 서버에서 직접 수행**
   ```bash
   # 절대 하지 마세요!
   git clone https://github.com/... /server/
   ```

3. **심볼릭 링크 사용**
   ```bash
   # 절대 하지 마세요!
   ln -s /repo/LIMEN /server/limen
   ```

### ✅ 올바른 방법

1. **배포 스크립트 사용**
   ```bash
   ./scripts/deploy-backend.sh --package
   # 생성된 패키지를 서버로 전송
   ```

2. **선택적 복사**
   ```bash
   # 백엔드 서버에만
   cp -r backend/ /server/
   cp -r RAG/ /server/
   ```

3. **Git 서브모듈 또는 스파스 체크아웃**
   ```bash
   # 필요한 부분만 체크아웃
   git sparse-checkout set backend/ RAG/
   ```

## CI/CD 통합

### GitHub Actions 예시

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'RAG/**'

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Create Backend Deployment
        run: ./scripts/deploy-backend.sh --package
      
      - name: Security Check
        run: |
          if [ -d deploy-backend/frontend ]; then
            echo "Security violation: Frontend code in backend deployment"
            exit 1
          fi
      
      - name: Deploy to Server
        # 배포 로직
```

## 모니터링

### 배포 후 검증

```bash
# 백엔드 서버에서
find /server/limen -name "*.js" -o -name "package.json" | head -5
# 결과가 없어야 함 (프론트엔드 파일 없음)

# 프론트엔드 서버에서
find /server/limen -name "*.go" -o -name "go.mod" | head -5
# 결과가 없어야 함 (백엔드 파일 없음)
```

## 문제 해결

### 보안 검증 실패

```bash
# 배포 디렉토리 확인
ls -la deploy-backend/
ls -la deploy-frontend/

# 포함된 파일 확인
find deploy-backend -type f | grep -E "(frontend|\.js|package\.json)"
find deploy-frontend -type f | grep -E "(backend|\.go|go\.mod)"
```

### 수동 정리

```bash
# 백엔드 배포에서 프론트엔드 제거
rm -rf deploy-backend/frontend
find deploy-backend -name "package.json" -delete
find deploy-backend -name "*.js" -delete

# 프론트엔드 배포에서 백엔드 제거
rm -rf deploy-frontend/backend
find deploy-frontend -name "go.mod" -delete
find deploy-frontend -name "*.go" -delete
```

## 관련 문서

- [서비스 가이드](./service.md)
- [보안 강화](./hardening.md)
- [제로 트러스트](./zero-trust.md)

---

**마지막 업데이트**: 2025-01-02


