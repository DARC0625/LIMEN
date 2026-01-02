#!/bin/bash

# 프론트엔드 서버용 RAG 시스템 자동 설정 스크립트
# 백엔드 서버와 동일한 RAG 워크플로우를 프론트엔드 서버에 설정합니다.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/..")"

cd "$REPO_ROOT"

echo "🚀 프론트엔드 서버 RAG 시스템 설정 시작..."
echo "📁 리포지토리 루트: $REPO_ROOT"
echo ""

# 1. RAG 폴더 구조 생성
echo "1️⃣ RAG 폴더 구조 생성 중..."
mkdir -p RAG/{01-architecture,02-development,03-deployment,04-operations,05-frontend,99-archive}
mkdir -p RAG/05-frontend/{components,hooks,lib,app}

# RAG README 생성
cat > RAG/README.md << 'EOF'
# RAG (Retrieval-Augmented Generation) 시스템

이 디렉토리는 LIMEN 프로젝트의 문서를 RAG 시스템에서 사용하기 위해 구조화된 형태로 저장합니다.

## 📁 구조

- `01-architecture/` - 아키텍처 문서
- `02-development/` - 개발 가이드
- `03-deployment/` - 배포 가이드
- `04-operations/` - 운영 가이드
- `05-frontend/` - 프론트엔드 관련 문서
- `99-archive/` - 아카이브 문서

## 🔄 업데이트 방법

### 자동 업데이트 (권장)
```bash
# 커밋 전 자동 업데이트 (pre-commit hook)
git commit -m "..."

# 커밋 후 자동 인덱싱 (post-commit hook)
# 자동으로 RAG 시스템에 인덱싱됩니다
```

### 수동 업데이트
```bash
# 변경사항 기록
./scripts/record-changes-to-rag.sh --auto

# 또는 특정 파일만
./scripts/record-changes-to-rag.sh docs/development/FRONTEND_DEVELOPMENT.md
```

## 📚 사용 방법

### 작업 전 확인
```bash
./scripts/check-rag-before-work.sh
```

### 워크플로우 가이드
```bash
./scripts/workflow-guide.sh
```

## 🔍 검증

```bash
# RAG 구조 검증
./scripts/verify-rag-structure.sh
```

---

**최종 업데이트**: $(date +%Y-%m-%d)
EOF

echo "✅ RAG 폴더 구조 생성 완료"

# 2. Git hooks 설정
echo ""
echo "2️⃣ Git hooks 설정 중..."

# Pre-commit hook
if [ -f .git/hooks/pre-commit ]; then
  if ! grep -q "RAG" .git/hooks/pre-commit; then
    cat >> .git/hooks/pre-commit << 'HOOK_EOF'

# RAG 문서 업데이트 체크
if [ -f scripts/check-rag-before-work.sh ]; then
  ./scripts/check-rag-before-work.sh
fi
HOOK_EOF
    echo "  ✅ Pre-commit hook에 RAG 체크 추가"
  else
    echo "  ℹ️  Pre-commit hook에 이미 RAG 체크가 있습니다"
  fi
else
  cat > .git/hooks/pre-commit << 'HOOK_EOF'
#!/bin/bash

# RAG 문서 업데이트 체크
if [ -f scripts/check-rag-before-work.sh ]; then
  ./scripts/check-rag-before-work.sh
fi
HOOK_EOF
  chmod +x .git/hooks/pre-commit
  echo "  ✅ Pre-commit hook 생성 완료"
fi

# Post-commit hook
if [ -f .git/hooks/post-commit ]; then
  if ! grep -q "RAG" .git/hooks/post-commit; then
    cat >> .git/hooks/post-commit << 'HOOK_EOF'

# RAG 자동 인덱싱
if [ -f scripts/record-changes-to-rag.sh ]; then
  ./scripts/record-changes-to-rag.sh --auto
fi
HOOK_EOF
    echo "  ✅ Post-commit hook에 RAG 인덱싱 추가"
  else
    echo "  ℹ️  Post-commit hook에 이미 RAG 인덱싱이 있습니다"
  fi
else
  cat > .git/hooks/post-commit << 'HOOK_EOF'
#!/bin/bash

# RAG 자동 인덱싱
if [ -f scripts/record-changes-to-rag.sh ]; then
  ./scripts/record-changes-to-rag.sh --auto
fi
HOOK_EOF
  chmod +x .git/hooks/post-commit
  echo "  ✅ Post-commit hook 생성 완료"
fi

# 3. RAG 스크립트 확인 및 권한 설정
echo ""
echo "3️⃣ RAG 스크립트 확인 중..."

REQUIRED_SCRIPTS=(
  "scripts/check-rag-before-work.sh"
  "scripts/record-changes-to-rag.sh"
  "scripts/workflow-guide.sh"
  "scripts/verify-rag-structure.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    chmod +x "$script"
    echo "  ✅ $script 확인 및 권한 설정 완료"
  else
    echo "  ⚠️  $script 없음 (백엔드에서 복사 필요)"
  fi
done

# 4. RAG 폴더 동기화 (Git에서 최신 버전 가져오기)
echo ""
echo "4️⃣ RAG 폴더 동기화 중..."

# RAG 폴더가 Git에 추적되고 있는지 확인
if git ls-files --error-unmatch RAG/ > /dev/null 2>&1; then
  echo "  📥 Git에서 최신 RAG 폴더 가져오기..."
  git fetch origin main
  git checkout origin/main -- RAG/ 2>/dev/null || {
    echo "  ⚠️  RAG 폴더가 원격에 없습니다. 초기 설정을 진행합니다."
    # 초기 RAG 구조 생성은 이미 1단계에서 완료됨
  }
  echo "  ✅ RAG 폴더 동기화 완료"
else
  echo "  ⚠️  RAG 폴더가 Git에 추적되지 않습니다."
  echo "  💡 RAG 폴더를 Git에 추가하세요: git add RAG/"
fi

# 5. 프론트엔드 관련 문서를 RAG에 복사 (로컬 개발용)
echo ""
echo "5️⃣ 프론트엔드 문서를 RAG에 복사 중 (로컬 개발용)..."

if [ -d "docs/05-frontend" ]; then
  cp -r docs/05-frontend/* RAG/05-frontend/ 2>/dev/null || true
  echo "  ✅ 프론트엔드 문서 복사 완료"
fi

if [ -d "docs/development" ]; then
  mkdir -p RAG/02-development
  cp docs/development/*.md RAG/02-development/ 2>/dev/null || true
  echo "  ✅ 개발 가이드 복사 완료"
fi

if [ -d "docs/components" ]; then
  mkdir -p RAG/05-frontend/components
  cp docs/components/*.md RAG/05-frontend/components/ 2>/dev/null || true
  echo "  ✅ 컴포넌트 문서 복사 완료"
fi

echo ""
echo "  ⚠️  중요: RAG 폴더의 변경사항은 반드시 커밋하여"
echo "     프론트엔드와 백엔드 서버 간 동기화를 유지하세요!"

# 6. 검증
echo ""
echo "6️⃣ RAG 구조 검증 중..."

if [ -d "RAG" ] && [ -f "RAG/README.md" ]; then
  echo "  ✅ RAG 디렉토리 구조 확인"
  
  # 디렉토리 구조 출력
  echo ""
  echo "📊 RAG 디렉토리 구조:"
  tree -L 2 RAG/ 2>/dev/null || find RAG -type d -maxdepth 2 | sort | sed 's|^|  |'
else
  echo "  ❌ RAG 디렉토리 구조 오류"
  exit 1
fi

echo ""
echo "✅ 프론트엔드 서버 RAG 시스템 설정 완료!"
echo ""
echo "📋 다음 단계:"
echo "  1. RAG 시스템에 문서 인덱싱: ./scripts/record-changes-to-rag.sh --auto"
echo "  2. 작업 전 확인: ./scripts/check-rag-before-work.sh"
echo "  3. 워크플로우 가이드: ./scripts/workflow-guide.sh"
echo ""
echo "📚 가이드: docs/04-operations/frontend-rag-setup.md"

