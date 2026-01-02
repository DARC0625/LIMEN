# 🔀 Git Sparse-Checkout 가이드

## 📋 개요

LIMEN 프로젝트는 monorepo 구조이지만, 각 서버에서는 **필요한 파일만** 체크아웃해야 합니다.

- **프론트엔드 서버**: `frontend/`, `docs/`만 체크아웃
- **백엔드 서버**: `backend/`, `docs/`만 체크아웃
- **문서 서버**: `docs/`만 체크아웃 (RAG 시스템)

## 🚀 설정 방법

### 1. 프론트엔드 서버 설정

```bash
# 리포지토리 클론 (빈 디렉토리)
git clone --no-checkout git@github.com:DARC0625/LIMEN.git limen-frontend
cd limen-frontend

# Sparse-checkout 활성화
git sparse-checkout init --cone

# 필요한 디렉토리만 추가
git sparse-checkout set frontend/ docs/ .github/workflows/frontend*.yml .github/workflows/validate-md.yml

# 체크아웃
git checkout main

# 확인
ls -la
# frontend/, docs/, .github/만 보여야 함
```

### 2. 백엔드 서버 설정

```bash
# 리포지토리 클론 (빈 디렉토리)
git clone --no-checkout git@github.com:DARC0625/LIMEN.git limen-backend
cd limen-backend

# Sparse-checkout 활성화
git sparse-checkout init --cone

# 필요한 디렉토리만 추가
git sparse-checkout set backend/ docs/ .github/workflows/backend*.yml .github/workflows/ci.yml .github/workflows/release.yml .github/workflows/validate-md.yml

# 체크아웃
git checkout main

# 확인
ls -la
# backend/, docs/, .github/만 보여야 함
```

### 3. 문서 서버 설정 (RAG)

```bash
# 리포지토리 클론 (빈 디렉토리)
git clone --no-checkout git@github.com:DARC0625/LIMEN.git limen-docs
cd limen-docs

# Sparse-checkout 활성화
git sparse-checkout init --cone

# 문서만 추가
git sparse-checkout set docs/

# 체크아웃
git checkout main

# 확인
ls -la
# docs/만 보여야 함
```

## 🔄 업데이트 방법

### 프론트엔드 서버에서 업데이트

```bash
cd /path/to/limen-frontend

# 최신 변경사항 가져오기
git fetch origin main

# Sparse-checkout 유지하면서 업데이트
git pull origin main

# 확인: frontend/와 docs/만 업데이트됨
```

### 백엔드 서버에서 업데이트

```bash
cd /path/to/limen-backend

# 최신 변경사항 가져오기
git fetch origin main

# Sparse-checkout 유지하면서 업데이트
git pull origin main

# 확인: backend/와 docs/만 업데이트됨
```

## 📝 Sparse-Checkout 관리

### 현재 설정 확인

```bash
git sparse-checkout list
```

### 디렉토리 추가

```bash
# 프론트엔드 서버에 scripts/ 추가
git sparse-checkout add scripts/
```

### 디렉토리 제거

```bash
# 프론트엔드 서버에서 docs/ 제거 (필요시)
git sparse-checkout remove docs/
```

### 전체 체크아웃으로 전환 (임시)

```bash
# 모든 파일 체크아웃 (개발/디버깅용)
git sparse-checkout disable

# 다시 sparse-checkout 활성화
git sparse-checkout init --cone
git sparse-checkout set frontend/ docs/
```

## 🔍 검증 스크립트

### 프론트엔드 서버 검증

```bash
#!/bin/bash
# scripts/verify-frontend-checkout.sh

cd /path/to/limen-frontend

echo "=== 프론트엔드 서버 체크아웃 검증 ==="

# 허용된 디렉토리
ALLOWED_DIRS=("frontend" "docs" ".github")

# 금지된 디렉토리
FORBIDDEN_DIRS=("backend")

# 검증
for dir in "${FORBIDDEN_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "❌ 오류: $dir 디렉토리가 존재합니다!"
    exit 1
  fi
done

echo "✅ 프론트엔드 서버는 올바르게 설정되었습니다."
```

### 백엔드 서버 검증

```bash
#!/bin/bash
# scripts/verify-backend-checkout.sh

cd /path/to/limen-backend

echo "=== 백엔드 서버 체크아웃 검증 ==="

# 금지된 디렉토리
FORBIDDEN_DIRS=("frontend")

# 검증
for dir in "${FORBIDDEN_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "❌ 오류: $dir 디렉토리가 존재합니다!"
    exit 1
  fi
done

echo "✅ 백엔드 서버는 올바르게 설정되었습니다."
```

## 🚀 자동화 스크립트

### 프론트엔드 서버 초기 설정 스크립트

```bash
#!/bin/bash
# scripts/setup-frontend-server.sh

REPO_URL="git@github.com:DARC0625/LIMEN.git"
TARGET_DIR="limen-frontend"

if [ -d "$TARGET_DIR" ]; then
  echo "❌ $TARGET_DIR 디렉토리가 이미 존재합니다."
  exit 1
fi

echo "🚀 프론트엔드 서버 설정 시작..."

# 클론
git clone --no-checkout "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

# Sparse-checkout 설정
git sparse-checkout init --cone
git sparse-checkout set frontend/ docs/ .github/workflows/frontend*.yml .github/workflows/validate-md.yml

# 체크아웃
git checkout main

echo "✅ 프론트엔드 서버 설정 완료!"
echo "📁 위치: $(pwd)"
echo "📋 체크아웃된 디렉토리:"
git sparse-checkout list
```

### 백엔드 서버 초기 설정 스크립트

```bash
#!/bin/bash
# scripts/setup-backend-server.sh

REPO_URL="git@github.com:DARC0625/LIMEN.git"
TARGET_DIR="limen-backend"

if [ -d "$TARGET_DIR" ]; then
  echo "❌ $TARGET_DIR 디렉토리가 이미 존재합니다."
  exit 1
fi

echo "🚀 백엔드 서버 설정 시작..."

# 클론
git clone --no-checkout "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

# Sparse-checkout 설정
git sparse-checkout init --cone
git sparse-checkout set backend/ docs/ .github/workflows/backend*.yml .github/workflows/ci.yml .github/workflows/release.yml .github/workflows/validate-md.yml

# 체크아웃
git checkout main

echo "✅ 백엔드 서버 설정 완료!"
echo "📁 위치: $(pwd)"
echo "📋 체크아웃된 디렉토리:"
git sparse-checkout list
```

## 📚 RAG 시스템 연동

### 문서만 추출

```bash
# 문서 서버에서 문서만 추출
cd /path/to/limen-docs
git pull origin main

# RAG 시스템에 문서 전달
# 예: 문서를 벡터 DB에 인덱싱
```

### 문서 업데이트 감지

```bash
# 문서 변경 감지 후 RAG 업데이트
git log --oneline --since="1 day ago" -- docs/
```

## ⚠️ 주의사항

### 1. CI/CD 파이프라인

GitHub Actions는 전체 리포지토리를 체크아웃하므로 문제없습니다.

### 2. 로컬 개발

로컬 개발 환경에서는 전체 리포지토리를 체크아웃해도 됩니다.

### 3. 문서 동기화

- 프론트엔드 서버: `docs/` 전체 체크아웃 (백엔드 API 참조용)
- 백엔드 서버: `docs/` 전체 체크아웃 (프론트엔드 구조 참조용)
- 문서 서버: `docs/`만 체크아웃 (RAG 시스템용)

## 🔄 마이그레이션 가이드

### 기존 전체 체크아웃 → Sparse-Checkout 전환

```bash
# 1. 현재 상태 백업
cd /path/to/limen
git stash

# 2. Sparse-checkout 활성화
git sparse-checkout init --cone

# 3. 필요한 디렉토리만 설정
git sparse-checkout set frontend/ docs/

# 4. 불필요한 파일 제거 (Git은 추적하지만 워킹 디렉토리에서 제거)
git read-tree -mu HEAD

# 5. 확인
ls -la
```

## 📊 체크아웃 구조 요약

```
프론트엔드 서버:
├── frontend/          ✅
├── docs/              ✅ (백엔드 API 참조용)
└── .github/           ✅ (워크플로우만)

백엔드 서버:
├── backend/           ✅
├── docs/              ✅ (프론트엔드 구조 참조용)
└── .github/           ✅ (워크플로우만)

문서 서버 (RAG):
└── docs/              ✅ (전체 문서)
```

---

**최종 업데이트**: 2025-01-14  
**관련 문서**: [워크플로우 가이드](./WORKFLOW_GUIDE.md)

