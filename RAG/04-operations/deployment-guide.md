# LIMEN 배포 가이드

## 개요

LIMEN 프로젝트는 보안을 위해 각 서버가 자신의 코드만 배포하도록 설계되었습니다.
리포지토리에는 모든 코드가 있지만, 실제 배포 시에는 각 서버에 해당하는 부분만 포함됩니다.

## 리포지토리 vs 배포

### 백엔드 서버 구조
```
LIMEN/
├── backend/          ✅ (백엔드 코드)
├── RAG/              ✅ (공유 문서)
├── config/           ✅ (설정 파일)
├── infra/            ✅ (인프라 설정)
└── scripts/          ✅ (스크립트)
```

**중요**: 백엔드 서버에는 `frontend/` 폴더가 **물리적으로 존재하지 않습니다**.
이는 보안 요구사항입니다.

### 배포 구조

배포 스크립트는 `/tmp`에 임시 디렉토리를 생성하고, 패키지도 `/tmp`에 생성합니다.
프로젝트 루트는 깔끔하게 유지됩니다.

## 배포 원칙

### 보안 원칙
- **백엔드 서버**: 백엔드 코드 + RAG 문서만
- **프론트엔드 서버**: 프론트엔드 코드 + RAG 문서만
- **코드 분리**: 서로의 코드를 포함하지 않음

### 공유 가능
- **RAG 문서**: 두 서버 모두 공유 (문서는 보안 위협이 아님)

## 배포 방법

### 백엔드 서버 배포

```bash
# 1. 배포 디렉토리 생성 (자동으로 /tmp에 생성)
./scripts/deploy-backend.sh

# 2. 배포 패키지 생성 (자동으로 /tmp에 생성)
./scripts/deploy-backend.sh --package

# 3. 생성된 패키지를 백엔드 서버로 전송
scp /tmp/limen-backend-*.tar.gz user@backend-server:/tmp/

# 4. 백엔드 서버에서 압축 해제 및 배포
ssh user@backend-server
cd /opt/limen
tar -xzf /tmp/limen-backend-*.tar.gz
```

**포함 내용:**
- ✅ `backend/` 폴더
- ✅ `RAG/` 문서
- ✅ `infra/docker/` Docker 설정
- ✅ 백엔드 스크립트
- ❌ `frontend/` 폴더 (제외)
- ❌ 프론트엔드 관련 파일 (제외)

### 프론트엔드 서버 배포

```bash
# 1. 배포 디렉토리 생성 (자동으로 /tmp에 생성)
./scripts/deploy-frontend.sh

# 2. 배포 패키지 생성 (자동으로 /tmp에 생성)
./scripts/deploy-frontend.sh --package

# 3. 생성된 패키지를 프론트엔드 서버로 전송
scp /tmp/limen-frontend-*.tar.gz user@frontend-server:/tmp/

# 4. 프론트엔드 서버에서 압축 해제 및 배포
ssh user@frontend-server
cd /opt/limen
tar -xzf /tmp/limen-frontend-*.tar.gz
```

**포함 내용:**
- ✅ `frontend/` 폴더
- ✅ `RAG/` 문서
- ❌ `backend/` 폴더 (제외)
- ❌ 백엔드 관련 파일 (제외)

## 보안 검증

배포 스크립트는 자동으로 보안 검증을 수행합니다:

```bash
# 백엔드 배포 검증
./scripts/deploy-backend.sh
# ✅ 보안 검증 통과: 프론트엔드 관련 파일이 전혀 포함되지 않았습니다

# 프론트엔드 배포 검증
./scripts/deploy-frontend.sh
# ✅ 보안 검증 통과: 백엔드 관련 파일이 전혀 포함되지 않았습니다
```

## 배포 프로세스

### 1. 백엔드 서버 (리포지토리)
```
LIMEN/
├── backend/          # 백엔드 코드
├── RAG/              # 공유 문서
├── infra/docker/     # Docker 설정
└── scripts/          # 백엔드 스크립트
```

**보안**: `frontend/` 폴더는 물리적으로 존재하지 않습니다.

### 2. 배포 스크립트 실행
```bash
./scripts/deploy-backend.sh --package
```

### 3. 임시 배포 디렉토리 생성 (/tmp)
```
/tmp/limen-deploy-backend-XXXXX/
├── backend/          # 백엔드 코드만
├── RAG/              # 공유 문서
├── infra/docker/     # Docker 설정
└── scripts/          # 백엔드 스크립트
```

### 4. 배포 패키지 생성 (/tmp)
```
/tmp/limen-backend-YYYYMMDD-HHMMSS.tar.gz
```

### 5. 서버 배포
패키지를 서버로 전송하고 압축 해제

## 주의사항

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

3. **프로젝트 루트에 배포 폴더 생성**
   - 배포 스크립트는 자동으로 `/tmp`에 생성합니다
   - 프로젝트 루트는 깔끔하게 유지됩니다

### ✅ 올바른 방법

1. **배포 스크립트 사용**
   ```bash
   ./scripts/deploy-backend.sh --package
   # 패키지는 /tmp에 생성됨
   ```

2. **임시 파일 정리**
   ```bash
   # 배포 후 임시 파일 정리 (선택사항)
   rm -rf /tmp/limen-deploy-*
   rm -f /tmp/limen-*-*.tar.gz
   ```

## 배포 후 확인

### 백엔드 서버에서

```bash
# 프론트엔드 파일이 없는지 확인
find /opt/limen -name "package.json" -o -name "*.js" | grep -v "backend" | head -5
# 결과가 없어야 함

# 백엔드 파일 확인
ls -la /opt/limen/backend/
# backend/ 폴더가 있어야 함
```

### 프론트엔드 서버에서

```bash
# 백엔드 파일이 없는지 확인
find /opt/limen -name "go.mod" -o -name "*.go" | head -5
# 결과가 없어야 함

# 프론트엔드 파일 확인
ls -la /opt/limen/frontend/
# frontend/ 폴더가 있어야 함
```

## 문제 해결

### 보안 검증 실패

```bash
# 배포 디렉토리 확인 (/tmp에 생성됨)
ls -la /tmp/limen-deploy-*/

# 문제 파일 찾기
find /tmp/limen-deploy-backend-* -name "package.json"
find /tmp/limen-deploy-frontend-* -name "go.mod"
```

### 임시 파일 정리

```bash
# 모든 임시 배포 파일 정리
rm -rf /tmp/limen-deploy-*
rm -f /tmp/limen-*-*.tar.gz
```

## 관련 문서

- [배포 보안 가이드](./security/deployment-security.md)
- [서비스 가이드](./service.md)
- [보안 강화](./security/hardening.md)

---

**마지막 업데이트**: 2025-01-02
