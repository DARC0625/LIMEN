#!/bin/bash

# RAG 폴더 동기화 스크립트
# 프론트엔드와 백엔드 서버에서 RAG 폴더가 항상 동일한 내용을 유지하도록 합니다.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/..")"

cd "$REPO_ROOT"

echo "🔄 RAG 폴더 동기화 시작..."
echo "📁 리포지토리 루트: $REPO_ROOT"
echo ""

# RAG 폴더 존재 확인
if [ ! -d "RAG" ]; then
  echo "❌ RAG 폴더가 없습니다. 먼저 RAG 시스템을 설정하세요."
  exit 1
fi

# 1. 최신 변경사항 가져오기
echo "1️⃣ 최신 변경사항 가져오기..."
git fetch origin main

# 2. RAG 폴더의 변경사항 확인
echo "2️⃣ RAG 폴더 변경사항 확인..."
RAG_CHANGES=$(git diff --name-only origin/main...HEAD -- RAG/ 2>/dev/null || echo "")
REMOTE_RAG_CHANGES=$(git diff --name-only HEAD...origin/main -- RAG/ 2>/dev/null || echo "")

if [ -n "$RAG_CHANGES" ]; then
  echo "  ⚠️  로컬 RAG 변경사항 발견:"
  echo "$RAG_CHANGES" | sed 's/^/    - /'
  echo ""
fi

if [ -n "$REMOTE_RAG_CHANGES" ]; then
  echo "  ⚠️  원격 RAG 변경사항 발견:"
  echo "$REMOTE_RAG_CHANGES" | sed 's/^/    - /'
  echo ""
fi

# 3. RAG 폴더 동기화
echo "3️⃣ RAG 폴더 동기화 중..."

# 원격 변경사항이 있으면 가져오기
if [ -n "$REMOTE_RAG_CHANGES" ]; then
  echo "  📥 원격 RAG 변경사항 가져오기..."
  git checkout origin/main -- RAG/ 2>/dev/null || {
    echo "  ⚠️  충돌 발생. 수동으로 해결하세요."
    exit 1
  }
  echo "  ✅ 원격 RAG 변경사항 적용 완료"
fi

# 4. RAG 폴더 검증
echo ""
echo "4️⃣ RAG 폴더 검증 중..."

REQUIRED_DIRS=(
  "RAG/01-architecture"
  "RAG/02-development"
  "RAG/03-deployment"
  "RAG/04-operations"
  "RAG/05-frontend"
  "RAG/99-archive"
)

MISSING_DIRS=()
for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    MISSING_DIRS+=("$dir")
  fi
done

if [ ${#MISSING_DIRS[@]} -gt 0 ]; then
  echo "  ⚠️  누락된 디렉토리:"
  for dir in "${MISSING_DIRS[@]}"; do
    echo "    - $dir"
    mkdir -p "$dir"
  done
  echo "  ✅ 누락된 디렉토리 생성 완료"
else
  echo "  ✅ 모든 필수 디렉토리 존재 확인"
fi

# 5. RAG README 확인
if [ ! -f "RAG/README.md" ]; then
  echo "  ⚠️  RAG/README.md 없음. 생성 중..."
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

## 🔄 동기화

RAG 폴더는 프론트엔드와 백엔드 서버에서 항상 동일한 내용을 유지해야 합니다.

### 자동 동기화

```bash
# RAG 폴더 동기화
./scripts/sync-rag-between-servers.sh
```

### 수동 동기화

```bash
# 최신 변경사항 가져오기
git pull origin main

# RAG 폴더만 업데이트
git checkout origin/main -- RAG/
```

## 📚 사용 방법

자세한 내용은 각 서버의 RAG 설정 가이드를 참조하세요:
- 프론트엔드: `docs/04-operations/frontend-rag-setup.md`
- 백엔드: `docs/04-operations/backend-rag-setup.md`

---

**최종 업데이트**: $(date +%Y-%m-%d)
EOF
  echo "  ✅ RAG/README.md 생성 완료"
fi

# 6. 최종 상태 확인
echo ""
echo "5️⃣ 최종 상태 확인..."

RAG_STATUS=$(git status --short RAG/ 2>/dev/null || echo "")
if [ -z "$RAG_STATUS" ]; then
  echo "  ✅ RAG 폴더가 최신 상태입니다"
else
  echo "  ⚠️  RAG 폴더에 변경사항이 있습니다:"
  echo "$RAG_STATUS" | sed 's/^/    /'
  echo ""
  echo "  💡 커밋하여 변경사항을 저장하세요:"
  echo "     git add RAG/"
  echo "     git commit -m 'docs: RAG 폴더 업데이트'"
fi

echo ""
echo "✅ RAG 폴더 동기화 완료!"
echo ""
echo "📋 RAG 폴더 상태:"
echo "  - 위치: $REPO_ROOT/RAG"
echo "  - 최신 커밋: $(git log -1 --format='%h %s' -- RAG/ 2>/dev/null || echo 'N/A')"
echo "  - 파일 수: $(find RAG -type f ! -name '*.md' -o -name '*.md' | wc -l)개"

