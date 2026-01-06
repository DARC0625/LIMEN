#!/bin/bash
# LIMEN 프론트엔드 서버용 RAG 시스템 설정 스크립트
# 프론트엔드 서버에서 실행하여 백엔드와 동일한 RAG 워크플로우 구축

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAG_DIR="$PROJECT_ROOT/RAG"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}🚀 LIMEN 프론트엔드 서버용 RAG 시스템 설정${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. RAG 폴더 확인
echo -e "${CYAN}1️⃣  RAG 폴더 확인${NC}"
if [ ! -d "$RAG_DIR" ]; then
    echo -e "${YELLOW}⚠️  RAG 폴더가 없습니다. 생성 중...${NC}"
    mkdir -p "$RAG_DIR"/{01-architecture,02-development,03-api,04-operations,05-frontend,99-archive}
    mkdir -p "$RAG_DIR"/{vectors,index,embeddings}
    echo -e "${GREEN}✅ RAG 폴더 생성 완료${NC}"
else
    echo -e "${GREEN}✅ RAG 폴더 존재${NC}"
fi
echo ""

# 2. Git Hooks 설정
echo -e "${CYAN}2️⃣  Git Hooks 설정${NC}"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

# Pre-commit hook
if [ ! -f "$HOOKS_DIR/pre-commit" ] || ! grep -q "RAG 문서 검증" "$HOOKS_DIR/pre-commit" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Pre-commit hook 설정 중...${NC}"
    cat > "$HOOKS_DIR/pre-commit" << 'HOOK_EOF'
#!/bin/bash
# LIMEN Pre-commit Hook
# RAG 문서 확인 및 업데이트 강제

set -e

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
RAG_DIR="$PROJECT_ROOT/RAG"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 RAG 문서 검증 및 업데이트 확인${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. RAG 폴더 존재 확인
if [ ! -d "$RAG_DIR" ]; then
    echo -e "${RED}❌ 오류: RAG 폴더가 존재하지 않습니다!${NC}"
    echo -e "${YELLOW}   RAG 폴더는 필수입니다. 생성하세요: mkdir -p $RAG_DIR${NC}"
    exit 1
fi

# 2. 변경된 파일 확인
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$CHANGED_FILES" ]; then
    echo -e "${GREEN}✅ 변경된 파일 없음${NC}"
    exit 0
fi

echo -e "${BLUE}📝 변경된 파일:${NC}"
echo "$CHANGED_FILES" | sed 's/^/   - /'
echo ""

# 3. 코드 변경사항이 있는지 확인
CODE_CHANGES=$(echo "$CHANGED_FILES" | grep -E '\.(ts|tsx|js|jsx|py|rs|go)$' || true)
CONFIG_CHANGES=$(echo "$CHANGED_FILES" | grep -E '\.(json|yaml|yml|toml|env|config)$' || true)
SCRIPT_CHANGES=$(echo "$CHANGED_FILES" | grep -E '\.(sh|bash)$' || true)

HAS_CODE_CHANGES=false
if [ -n "$CODE_CHANGES" ] || [ -n "$CONFIG_CHANGES" ] || [ -n "$SCRIPT_CHANGES" ]; then
    HAS_CODE_CHANGES=true
fi

# 4. RAG 문서 변경 확인
RAG_CHANGES=$(echo "$CHANGED_FILES" | grep "^RAG/" || true)

# 5. 코드 변경이 있으면 RAG 문서 업데이트 확인
if [ "$HAS_CODE_CHANGES" = true ] && [ -z "$RAG_CHANGES" ]; then
    echo -e "${YELLOW}⚠️  경고: 코드/설정/스크립트가 변경되었지만 RAG 문서가 업데이트되지 않았습니다!${NC}"
    echo ""
    echo -e "${YELLOW}📋 변경된 항목:${NC}"
    [ -n "$CODE_CHANGES" ] && echo "$CODE_CHANGES" | sed 's/^/   - 코드: /'
    [ -n "$CONFIG_CHANGES" ] && echo "$CONFIG_CHANGES" | sed 's/^/   - 설정: /'
    [ -n "$SCRIPT_CHANGES" ] && echo "$SCRIPT_CHANGES" | sed 's/^/   - 스크립트: /'
    echo ""
    echo -e "${YELLOW}💡 다음 중 하나를 수행하세요:${NC}"
    echo "   1. RAG 문서를 업데이트하세요:"
    echo "      - $RAG_DIR/01-architecture/ (아키텍처 변경 시)"
    echo "      - $RAG_DIR/02-development/ (개발 가이드 변경 시)"
    echo "      - $RAG_DIR/03-api/ (API 변경 시)"
    echo "      - $RAG_DIR/04-operations/ (운영 변경 시)"
    echo "      - $RAG_DIR/05-frontend/ (프론트엔드 변경 시)"
    echo ""
    echo "   2. 변경사항이 문서화가 필요 없다면 다음 명령으로 스킵:"
    echo "      git commit --no-verify"
    echo ""
    echo -e "${RED}❌ 커밋이 차단되었습니다. RAG 문서를 업데이트하거나 --no-verify로 스킵하세요.${NC}"
    exit 1
fi

# 6. RAG 문서가 변경되었으면 인덱싱 확인
if [ -n "$RAG_CHANGES" ]; then
    echo -e "${GREEN}✅ RAG 문서가 업데이트되었습니다${NC}"
    echo ""
    echo -e "${BLUE}🔄 RAG 인덱싱 실행 중...${NC}"
    
    if [ -f "$PROJECT_ROOT/scripts/rag-index.sh" ]; then
        "$PROJECT_ROOT/scripts/rag-index.sh" || {
            echo -e "${YELLOW}⚠️  RAG 인덱싱 실패 (계속 진행)${NC}"
        }
    else
        echo -e "${YELLOW}⚠️  rag-index.sh 스크립트를 찾을 수 없습니다${NC}"
    fi
fi

# 7. RAG README 확인
if [ ! -f "$RAG_DIR/README.md" ]; then
    echo -e "${YELLOW}⚠️  경고: RAG/README.md가 없습니다${NC}"
fi

echo ""
echo -e "${GREEN}✅ RAG 검증 완료${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

exit 0
HOOK_EOF
    chmod +x "$HOOKS_DIR/pre-commit"
    echo -e "${GREEN}✅ Pre-commit hook 설정 완료${NC}"
else
    echo -e "${GREEN}✅ Pre-commit hook 이미 설정됨${NC}"
fi

# Post-commit hook
if [ ! -f "$HOOKS_DIR/post-commit" ] || ! grep -q "RAG 인덱싱" "$HOOKS_DIR/post-commit" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Post-commit hook 설정 중...${NC}"
    cat > "$HOOKS_DIR/post-commit" << 'HOOK_EOF'
#!/bin/bash
# LIMEN Post-commit Hook
# 커밋 후 자동으로 RAG 인덱싱 실행

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
RAG_DIR="$PROJECT_ROOT/RAG"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# RAG 인덱싱 스크립트 실행
if [ -f "$PROJECT_ROOT/scripts/rag-index.sh" ]; then
    echo ""
    echo -e "${BLUE}🔄 RAG 인덱싱 실행 중...${NC}"
    "$PROJECT_ROOT/scripts/rag-index.sh" --auto || {
        echo -e "${YELLOW}⚠️  RAG 인덱싱 실패 (수동 실행 가능)${NC}"
    }
    echo -e "${GREEN}✅ RAG 인덱싱 완료${NC}"
fi

exit 0
HOOK_EOF
    chmod +x "$HOOKS_DIR/post-commit"
    echo -e "${GREEN}✅ Post-commit hook 설정 완료${NC}"
else
    echo -e "${GREEN}✅ Post-commit hook 이미 설정됨${NC}"
fi
echo ""

# 3. RAG 스크립트 확인
echo -e "${CYAN}3️⃣  RAG 스크립트 확인${NC}"
SCRIPTS=(
    "check-rag-before-work.sh"
    "record-changes-to-rag.sh"
    "workflow-guide.sh"
    "rag-index.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$PROJECT_ROOT/scripts/$script" ]; then
        chmod +x "$PROJECT_ROOT/scripts/$script" 2>/dev/null || true
        echo -e "${GREEN}   ✅ $script${NC}"
    else
        echo -e "${YELLOW}   ⚠️  $script 없음 (리포지토리에서 가져와야 함)${NC}"
    fi
done
echo ""

# 4. RAG README 확인
echo -e "${CYAN}4️⃣  RAG 문서 확인${NC}"
if [ ! -f "$RAG_DIR/README.md" ]; then
    echo -e "${YELLOW}⚠️  RAG/README.md가 없습니다. 생성 중...${NC}"
    cat > "$RAG_DIR/README.md" << 'README_EOF'
# LIMEN RAG (Retrieval-Augmented Generation)

LIMEN 프로젝트의 단일 진실 공급원(Single Source of Truth)입니다.

## 구조

```
RAG/
├── README.md              # 이 파일
├── CHANGELOG.md           # 모든 변경사항 기록
├── 01-architecture/       # 아키텍처 문서
├── 02-development/        # 개발 가이드
├── 03-api/                # API 문서
├── 04-operations/         # 운영/배포 문서
├── 05-frontend/           # 프론트엔드 문서
├── 99-archive/            # 아카이브
├── vectors/               # 벡터 데이터베이스
├── index/                 # 인덱스 파일
└── embeddings/            # 임베딩 데이터
```

## 사용법

### 작업 전 RAG 확인
```bash
./scripts/check-rag-before-work.sh
```

### 변경사항 기록
```bash
./scripts/record-changes-to-rag.sh --auto
```

### 워크플로우 가이드
```bash
./scripts/workflow-guide.sh
```

## 관련 문서

- [RAG 워크플로우 가이드](./04-operations/rag-workflow.md)
README_EOF
    echo -e "${GREEN}✅ RAG/README.md 생성 완료${NC}"
else
    echo -e "${GREEN}✅ RAG/README.md 존재${NC}"
fi
echo ""

# 5. 최종 확인
echo -e "${CYAN}5️⃣  설정 완료 확인${NC}"
echo ""
echo -e "${GREEN}✅ RAG 시스템 설정 완료!${NC}"
echo ""
echo -e "${BOLD}📚 다음 단계:${NC}"
echo "   1. RAG 워크플로우 가이드 확인:"
echo "      ${CYAN}cat RAG/04-operations/rag-workflow.md${NC}"
echo ""
echo "   2. 작업 전 RAG 확인:"
echo "      ${CYAN}./scripts/check-rag-before-work.sh${NC}"
echo ""
echo "   3. 워크플로우 가이드:"
echo "      ${CYAN}./scripts/workflow-guide.sh${NC}"
echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}🎉 프론트엔드 서버 RAG 시스템 준비 완료!${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"





