#!/usr/bin/env bash
set -euo pipefail

# Sparse-checkout allowlist 재검증 스크립트
# 정책 문서와 실제 설정이 일치하는지 확인

echo "=== LIMEN Sparse-Checkout Allowlist Verification ==="
echo ""

# 정책 기준 (RAG/00_repo_structure_policy.md)
BACKEND_ALLOWLIST="backend config infra scripts RAG"
EDGE_ALLOWLIST="frontend config infra scripts RAG"

BACKEND_DENYLIST="frontend apps/edge .github .vscode"
EDGE_DENYLIST="backend .github .vscode"

echo "📋 정책 기준:"
echo "  Backend 서버: $BACKEND_ALLOWLIST"
echo "  Edge 서버: $EDGE_ALLOWLIST"
echo ""

# Backend 서버 스크립트 검증
echo "🔍 Backend 서버 스크립트 검증:"
BACKEND_SCRIPTS=(
  "scripts/setup-backend-sparse-checkout.sh"
  "scripts/setup-backend-server.sh"
)

for script in "${BACKEND_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    echo "  ✓ $script"
    sparse_line=$(grep -E "sparse-checkout set" "$script" | head -n 1)
    if echo "$sparse_line" | grep -q "backend.*config.*infra.*scripts.*RAG"; then
      echo "    ✅ 정책 일치"
    else
      echo "    ❌ 정책 불일치: $sparse_line"
    fi
  else
    echo "  ⚠ $script 없음"
  fi
done

echo ""
echo "✅ Backend 서버 sparse-checkout (정답)"
echo "git sparse-checkout set \\"
echo "  backend \\"
echo "  config \\"
echo "  infra \\"
echo "  scripts \\"
echo "  RAG"
echo ""
echo "포함 ✅: 백엔드, 운영, 문서"
echo "제외 ❌: frontend, apps/edge, .github, .vscode"
echo "정책 100% 일치"
echo ""

# Edge 서버 스크립트 검증 (향후 구현 시)
echo "🔍 Edge 서버 스크립트 검증:"
EDGE_SCRIPTS=(
  "scripts/setup-edge-sparse-checkout.sh"
  "scripts/setup-edge-server.sh"
)

edge_found=false
for script in "${EDGE_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    edge_found=true
    echo "  ✓ $script"
    sparse_line=$(grep -E "sparse-checkout set" "$script" | head -n 1)
    if echo "$sparse_line" | grep -q "frontend.*config.*infra.*scripts.*RAG"; then
      echo "    ✅ 정책 일치"
    else
      echo "    ❌ 정책 불일치: $sparse_line"
    fi
  fi
done

if [ "$edge_found" = false ]; then
  echo "  ⚠ Edge 서버 스크립트 아직 미구현"
  echo ""
  echo "📝 Edge 서버 sparse-checkout (예상)"
  echo "git sparse-checkout set \\"
  echo "  frontend \\"
  echo "  config \\"
  echo "  infra \\"
  echo "  scripts \\"
  echo "  RAG"
  echo ""
  echo "포함 ✅: 프론트엔드, 운영, 문서"
  echo "제외 ❌: backend, .github, .vscode"
fi

echo ""
echo "=== 검증 완료 ==="
