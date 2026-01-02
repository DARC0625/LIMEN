#!/bin/bash
# CSS 파일 이름 불일치 문제 자동 해결 스크립트

# 스크립트 위치 기준으로 상대 경로 계산
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/.."
PORT=9444
MAX_RETRIES=10
RETRY_DELAY=2

echo "🔗 CSS 파일 링크 자동 생성 중..."

# 서버가 시작될 때까지 대기
for i in $(seq 1 $MAX_RETRIES); do
  if curl -s http://localhost:$PORT > /dev/null 2>&1; then
    break
  fi
  sleep $RETRY_DELAY
done

# HTML에서 참조하는 CSS 파일 이름 찾기
HTML_CSS=$(curl -s http://localhost:$PORT | grep -o 'href="[^"]*\.css[^"]*"' | head -1 | sed 's/href="\/_next\/static\/chunks\///' | sed 's/"//')

if [ -z "$HTML_CSS" ]; then
  echo "⚠️ HTML에서 CSS 파일 이름을 찾을 수 없습니다."
  exit 1
fi

# 실제 CSS 파일 찾기
ACTUAL_CSS=$(find "$FRONTEND_DIR/.next/static/chunks" -name "*.css" -type f -exec basename {} \; | head -1)

if [ -z "$ACTUAL_CSS" ]; then
  echo "⚠️ 실제 CSS 파일을 찾을 수 없습니다."
  exit 1
fi

# 파일 이름이 다르면 심볼릭 링크 생성
if [ "$HTML_CSS" != "$ACTUAL_CSS" ]; then
  cd "$FRONTEND_DIR/.next/static/chunks"
  rm -f "$HTML_CSS" 2>/dev/null
  ln -sf "$ACTUAL_CSS" "$HTML_CSS" && echo "✅ CSS 심볼릭 링크 생성: $HTML_CSS -> $ACTUAL_CSS" || echo "❌ CSS 심볼릭 링크 생성 실패"
  cd - > /dev/null
else
  echo "ℹ️ CSS 파일 이름이 일치합니다: $ACTUAL_CSS"
fi

