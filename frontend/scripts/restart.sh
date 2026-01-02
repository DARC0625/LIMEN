#!/bin/bash
# LIMEN Frontend 안전한 재시작 스크립트

set -e  # 에러 발생 시 즉시 종료

# 스크립트 위치 기준으로 상대 경로 계산
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/.."
PORT=9444
LOG_FILE="/tmp/nextjs-prod.log"

echo "🔄 LIMEN Frontend 재시작 시작..."

# 1. 포트를 사용 중인 모든 프로세스 종료
echo "📌 포트 $PORT 정리 중..."
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -9 -f "next.*$PORT" 2>/dev/null || true
sleep 2

# 2. .next 디렉토리 삭제 (깨끗한 빌드)
echo "🧹 이전 빌드 파일 삭제 중..."
cd "$FRONTEND_DIR"
rm -rf .next
echo "✅ 삭제 완료"

# 3. 새로 빌드
echo "🔨 새로 빌드 중..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 빌드 실패!"
  exit 1
fi

# 4. 빌드 파일 검증
echo "🔍 빌드 파일 검증 중..."
CHUNK_COUNT=$(find .next/static/chunks -name "*.js" 2>/dev/null | wc -l)
if [ "$CHUNK_COUNT" -eq 0 ]; then
  echo "❌ 빌드 파일이 없습니다!"
  exit 1
fi
echo "✅ 빌드 파일 검증 완료: $CHUNK_COUNT 개 파일"

# 4-1. CSS 파일 이름 불일치 문제 해결 (임시방편)
echo "🔗 CSS 파일 심볼릭 링크 생성 중..."
CSS_FILES=$(find .next/static/chunks -name "*.css" -type f 2>/dev/null)
if [ -n "$CSS_FILES" ]; then
  # 실제 CSS 파일 찾기
  ACTUAL_CSS=$(find .next/static/chunks -name "*.css" -type f -exec basename {} \; | head -1)
  
  # HTML에서 참조하는 CSS 파일 이름 찾기 (여러 위치에서 시도)
  HTML_CSS=$(grep -r "href=\"/_next/static/chunks/.*\.css\"" .next/server 2>/dev/null | grep -o 'href="[^"]*\.css[^"]*"' | sed 's/href="\/_next\/static\/chunks\///' | sed 's/"//' | head -1)
  
  # HTML에서 찾지 못하면 빌드 매니페스트에서 찾기
  if [ -z "$HTML_CSS" ]; then
    HTML_CSS=$(grep -r "\.css" .next/BUILD_ID 2>/dev/null | head -1 || echo "")
  fi
  
  # 그래도 없으면 서버를 시작한 후 HTML에서 직접 확인
  if [ -z "$HTML_CSS" ] && [ -n "$ACTUAL_CSS" ]; then
    echo "⚠️ HTML에서 CSS 파일 이름을 찾지 못했습니다. 서버 시작 후 자동으로 확인합니다."
    # 서버 시작 후 확인하는 함수를 별도로 실행
  fi
  
  if [ -n "$HTML_CSS" ] && [ -n "$ACTUAL_CSS" ] && [ "$HTML_CSS" != "$ACTUAL_CSS" ]; then
    cd .next/static/chunks
    rm -f "$HTML_CSS" 2>/dev/null  # 기존 링크 제거
    ln -sf "$ACTUAL_CSS" "$HTML_CSS" 2>/dev/null && echo "✅ CSS 심볼릭 링크 생성: $HTML_CSS -> $ACTUAL_CSS" || echo "⚠️ CSS 심볼릭 링크 생성 실패"
    cd - > /dev/null
  elif [ -n "$ACTUAL_CSS" ]; then
    echo "ℹ️ CSS 파일 이름이 일치합니다: $ACTUAL_CSS"
  fi
fi

# 5. 서버 시작 (포트 9444 명시적 설정)
echo "🚀 서버 시작 중 (포트 9444)..."
export PORT=9444
npm start > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# 6. 서버 시작 확인 (최대 10초 대기)
echo "⏳ 서버 시작 대기 중..."
for i in {1..10}; do
  sleep 1
  if curl -s http://localhost:$PORT > /dev/null 2>&1; then
    echo "✅ 서버 시작 완료 (PID: $SERVER_PID)"
    echo "📋 로그 파일: $LOG_FILE"
    
    # 6-1. CSS 파일 링크 자동 생성 (서버 시작 후)
    echo "🔗 CSS 파일 링크 자동 생성 중..."
    sleep 2  # 서버가 완전히 준비될 때까지 대기
    "$FRONTEND_DIR/scripts/fix-css-links.sh" || echo "⚠️ CSS 링크 생성 실패 (수동으로 확인 필요)"
    
    exit 0
  fi
done

echo "❌ 서버 시작 실패 (10초 타임아웃)"
echo "📋 마지막 로그:"
tail -20 "$LOG_FILE"
exit 1
