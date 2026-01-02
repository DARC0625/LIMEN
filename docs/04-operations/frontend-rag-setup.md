# 프론트엔드 서버 RAG 시스템 설정 가이드

## 📋 개요

프론트엔드 서버에서도 백엔드 서버와 동일한 RAG (Retrieval-Augmented Generation) 시스템을 사용할 수 있습니다. 이를 통해 AI가 프론트엔드 개발 시 백엔드 API와 문서를 참조할 수 있습니다.

## 🚀 빠른 시작

### 1. 최신 코드 가져오기

```bash
cd /path/to/limen-frontend
git pull origin main
```

### 2. RAG 시스템 자동 설정

```bash
./scripts/setup-rag-for-frontend.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
- ✅ RAG 폴더 구조 생성
- ✅ Git hooks 설정 (pre-commit, post-commit)
- ✅ RAG 스크립트 확인 및 권한 설정
- ✅ 프론트엔드 문서를 RAG에 복사
- ✅ RAG README 생성

## 📁 RAG 구조

```
RAG/
├── 01-architecture/      # 아키텍처 문서
├── 02-development/       # 개발 가이드
├── 03-deployment/       # 배포 가이드
├── 04-operations/       # 운영 가이드
├── 05-frontend/         # 프론트엔드 관련 문서
│   ├── components/      # 컴포넌트 문서
│   ├── hooks/           # Hooks 문서
│   ├── lib/             # 라이브러리 문서
│   └── app/             # App 라우팅 문서
└── 99-archive/          # 아카이브 문서
```

## 🔄 워크플로우

### 작업 전 확인

```bash
./scripts/check-rag-before-work.sh
```

이 스크립트는 다음을 확인합니다:
- RAG 구조가 올바른지
- 최신 문서가 RAG에 반영되었는지
- 필요한 문서가 누락되지 않았는지

### 변경사항 기록

#### 자동 기록 (권장)

Git hooks가 자동으로 처리합니다:
- **Pre-commit**: 코드 변경 시 RAG 문서 업데이트 강제
- **Post-commit**: 커밋 후 자동 RAG 인덱싱

#### 수동 기록

```bash
# 모든 변경사항 자동 기록
./scripts/record-changes-to-rag.sh --auto

# 특정 파일만 기록
./scripts/record-changes-to-rag.sh docs/development/FRONTEND_DEVELOPMENT.md
```

### 워크플로우 가이드

```bash
./scripts/workflow-guide.sh
```

## 📚 문서 관리

### 프론트엔드 문서

프론트엔드 관련 문서는 다음 위치에 있습니다:

- `docs/05-frontend/` - 프론트엔드 개요 및 구조
- `docs/components/` - 컴포넌트 문서
- `docs/development/` - 개발 가이드

이 문서들은 자동으로 `RAG/05-frontend/`에 복사됩니다.

### 백엔드 문서 참조

프론트엔드 서버는 `docs/` 전체를 체크아웃하므로 백엔드 API 문서도 참조할 수 있습니다:

- `docs/02-development/api/` - 백엔드 API 문서
- `docs/04-operations/` - 운영 가이드

## 🔍 검증

### RAG 구조 검증

```bash
./scripts/verify-rag-structure.sh
```

### Git hooks 확인

```bash
# Pre-commit hook 확인
cat .git/hooks/pre-commit

# Post-commit hook 확인
cat .git/hooks/post-commit
```

## ⚙️ 수동 설정 (자동 스크립트 사용 불가 시)

### 1. RAG 폴더 생성

```bash
mkdir -p RAG/{01-architecture,02-development,03-deployment,04-operations,05-frontend,99-archive}
```

### 2. Git hooks 설정

#### Pre-commit hook

```bash
cat >> .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# RAG 문서 업데이트 체크
if [ -f scripts/check-rag-before-work.sh ]; then
  ./scripts/check-rag-before-work.sh
fi
EOF

chmod +x .git/hooks/pre-commit
```

#### Post-commit hook

```bash
cat >> .git/hooks/post-commit << 'EOF'
#!/bin/bash

# RAG 자동 인덱싱
if [ -f scripts/record-changes-to-rag.sh ]; then
  ./scripts/record-changes-to-rag.sh --auto
fi
EOF

chmod +x .git/hooks/post-commit
```

### 3. 문서 복사

```bash
# 프론트엔드 문서 복사
cp -r docs/05-frontend/* RAG/05-frontend/
cp docs/components/*.md RAG/05-frontend/components/
cp docs/development/*.md RAG/02-development/
```

## 🔧 문제 해결

### RAG 스크립트가 없는 경우

백엔드 서버에서 스크립트를 복사하세요:

```bash
# 백엔드 서버에서
scp backend-server:/path/to/limen-backend/scripts/check-rag-before-work.sh scripts/
scp backend-server:/path/to/limen-backend/scripts/record-changes-to-rag.sh scripts/
scp backend-server:/path/to/limen-backend/scripts/workflow-guide.sh scripts/
scp backend-server:/path/to/limen-backend/scripts/verify-rag-structure.sh scripts/

# 권한 설정
chmod +x scripts/*.sh
```

### Git hooks가 작동하지 않는 경우

```bash
# hooks 디렉토리 확인
ls -la .git/hooks/

# hooks 실행 권한 확인
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit

# Git hooks 활성화 확인
git config core.hooksPath .git/hooks
```

### 문서가 RAG에 반영되지 않는 경우

```bash
# 수동으로 문서 복사
./scripts/record-changes-to-rag.sh --auto

# 또는 특정 파일만
./scripts/record-changes-to-rag.sh docs/development/FRONTEND_DEVELOPMENT.md
```

## 📊 상태 확인

### RAG 구조 확인

```bash
tree RAG/ -L 2
# 또는
find RAG -type d | sort
```

### 최근 변경사항 확인

```bash
git log --oneline --since="1 day ago" -- docs/
```

### RAG 인덱싱 상태 확인

```bash
# RAG 디렉토리 최종 수정 시간 확인
stat RAG/
```

## 🎯 사용 예시

### 프론트엔드 개발 시

1. **작업 시작 전**
   ```bash
   ./scripts/check-rag-before-work.sh
   ```

2. **코드 작성**
   - AI가 RAG에서 백엔드 API 문서를 참조하여 개발

3. **커밋**
   ```bash
   git add .
   git commit -m "feat: Add new feature"
   # Post-commit hook이 자동으로 RAG 인덱싱
   ```

### 백엔드 API 변경 시

1. **백엔드 서버에서 변경**
   - API 문서 업데이트
   - 커밋 및 푸시

2. **프론트엔드 서버에서 동기화**
   ```bash
   git pull origin main
   ./scripts/record-changes-to-rag.sh --auto
   ```

## 📚 관련 문서

- [RAG 시스템 개요](../RAG/README.md)
- [백엔드 RAG 설정](./backend-rag-setup.md) (백엔드 서버)
- [워크플로우 가이드](../development/WORKFLOW_GUIDE.md)

---

**최종 업데이트**: 2025-01-14  
**관련 스크립트**: `scripts/setup-rag-for-frontend.sh`

