# 프론트엔드 서버 RAG 시스템 설정 가이드

## 개요

프론트엔드 서버에서도 백엔드와 동일한 RAG 워크플로우를 사용할 수 있도록 설정하는 가이드입니다.

## 전제 조건

1. **리포지토리 연결**: 프론트엔드 서버가 LIMEN 리포지토리에 연결되어 있어야 합니다.
2. **Git 설치**: Git이 설치되어 있어야 합니다.
3. **Bash**: Bash 쉘을 사용할 수 있어야 합니다.

## 설정 방법

### 방법 1: 자동 설정 스크립트 (권장)

```bash
# 리포지토리 루트에서 실행
cd /path/to/LIMEN
./scripts/setup-rag-for-frontend.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
- RAG 폴더 구조 생성
- Git hooks 설정 (pre-commit, post-commit)
- RAG 스크립트 확인 및 권한 설정
- RAG README 생성

### 방법 2: 수동 설정

#### 1. RAG 폴더 구조 생성

```bash
cd /path/to/LIMEN
mkdir -p RAG/{01-architecture,02-development,03-api,04-operations,05-frontend,99-archive}
mkdir -p RAG/{vectors,index,embeddings}
```

#### 2. Git Hooks 설정

리포지토리에서 Git hooks를 복사하거나, 백엔드 서버와 동일한 hooks를 설정합니다.

```bash
# 리포지토리에 hooks가 있다면
cp -r .git/hooks/* .git/hooks/

# 또는 백엔드 서버에서 hooks 복사
scp backend-server:/path/to/LIMEN/.git/hooks/* .git/hooks/
chmod +x .git/hooks/pre-commit .git/hooks/post-commit
```

#### 3. RAG 스크립트 확인

필요한 스크립트가 있는지 확인:

```bash
ls -la scripts/check-rag-before-work.sh
ls -la scripts/record-changes-to-rag.sh
ls -la scripts/workflow-guide.sh
ls -la scripts/rag-index.sh
```

없다면 리포지토리에서 가져오거나 백엔드 서버에서 복사:

```bash
# 리포지토리에서 pull
git pull origin main

# 또는 백엔드 서버에서 복사
scp backend-server:/path/to/LIMEN/scripts/*.sh scripts/
chmod +x scripts/*.sh
```

## 설정 확인

### 1. RAG 폴더 확인

```bash
ls -la RAG/
```

다음 구조가 있어야 합니다:
```
RAG/
├── README.md
├── 01-architecture/
├── 02-development/
├── 03-api/
├── 04-operations/
├── 05-frontend/
├── 99-archive/
├── vectors/
├── index/
└── embeddings/
```

### 2. Git Hooks 확인

```bash
ls -la .git/hooks/pre-commit
ls -la .git/hooks/post-commit
```

두 파일이 실행 가능해야 합니다.

### 3. 스크립트 확인

```bash
./scripts/check-rag-before-work.sh
./scripts/workflow-guide.sh
```

정상적으로 실행되어야 합니다.

## 사용법

### 표준 워크플로우

프론트엔드 서버에서도 백엔드와 동일한 워크플로우를 사용합니다:

```bash
# 1. 작업 시작 전 RAG 확인 (필수)
./scripts/check-rag-before-work.sh

# 2. 작업 수행
# ... 코드/설정 변경 ...

# 3. 변경사항 RAG에 기록 (필수)
./scripts/record-changes-to-rag.sh --auto

# 4. 필요시 상세 문서 작성
# RAG/05-frontend/ 또는 관련 폴더에 문서 추가

# 5. 커밋 (자동 검증)
git add .
git commit -m "변경 내용"
# → pre-commit hook이 자동으로 RAG 검증

# 6. RAG 인덱싱 (자동 - post-commit hook)
# → 커밋 후 자동 실행
```

### 프론트엔드 특화

프론트엔드 변경사항은 주로 다음 폴더에 기록됩니다:

- **RAG/05-frontend/**: 프론트엔드 관련 문서
- **RAG/02-development/**: 개발 가이드 (프론트엔드 포함)
- **RAG/03-api/**: API 클라이언트 관련

## 프론트엔드 변경사항 기록 예시

### 컴포넌트 추가

```bash
./scripts/record-changes-to-rag.sh \
  -t frontend \
  -f frontend/src/components/NewComponent.tsx \
  "새로운 컴포넌트 추가: 사용자 프로필 카드"
```

### API 클라이언트 수정

```bash
./scripts/record-changes-to-rag.sh \
  -t api \
  -f frontend/src/lib/api-client.ts \
  "API 클라이언트에 에러 핸들링 개선"
```

### 설정 변경

```bash
./scripts/record-changes-to-rag.sh \
  -t config \
  -f frontend/next.config.js \
  "Next.js 설정에 이미지 최적화 옵션 추가"
```

## 문제 해결

### Git Hook이 작동하지 않음

**원인**: Hook 파일에 실행 권한이 없음

**해결**:
```bash
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit
```

### RAG 스크립트를 찾을 수 없음

**원인**: 스크립트가 리포지토리에 없음

**해결**:
```bash
# 리포지토리에서 pull
git pull origin main

# 또는 백엔드 서버에서 복사
scp backend-server:/path/to/LIMEN/scripts/*.sh scripts/
chmod +x scripts/*.sh
```

### Pre-commit Hook이 커밋을 차단함

**원인**: 코드 변경이 있지만 RAG 문서가 업데이트되지 않음

**해결**:
```bash
# 변경사항 기록
./scripts/record-changes-to-rag.sh --auto

# 다시 커밋
git commit -m "변경 내용"
```

## 백엔드와의 동기화

### RAG 문서 동기화

프론트엔드와 백엔드는 동일한 RAG 폴더를 공유합니다:

```bash
# 리포지토리에서 최신 RAG 가져오기
git pull origin main

# RAG 인덱싱 업데이트
./scripts/rag-index.sh
```

### 변경사항 공유

프론트엔드와 백엔드의 변경사항은 모두 `RAG/CHANGELOG.md`에 기록되며, 리포지토리를 통해 공유됩니다.

## 관련 문서

- [RAG 워크플로우 가이드](./rag-workflow.md)
- [배포 가이드](./deployment-guide.md)
- [서비스 가이드](./service.md)

---

**마지막 업데이트**: 2025-01-02




