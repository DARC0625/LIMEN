#!/bin/bash
# 외부 번들 해시 검증 스크립트
# CI에서 vendor 파일 해시가 예기치 않게 바뀌면 FATAL
# 업데이트 시에는 "업스트림 버전 + 해시 갱신 + 변경 로그"를 같이 제출

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENDOR_DIR="$FRONTEND_DIR/public/novnc"
HASH_FILE="$SCRIPT_DIR/vendor-hashes.txt"

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 외부 번들 해시 검증 시작..."

# vendor 디렉토리 확인
if [ ! -d "$VENDOR_DIR" ]; then
  echo -e "${YELLOW}⚠️  경고: $VENDOR_DIR 디렉토리가 없습니다.${NC}"
  exit 0
fi

# 해시 파일이 없으면 생성
if [ ! -f "$HASH_FILE" ]; then
  echo -e "${YELLOW}⚠️  해시 파일이 없습니다. 초기 해시를 생성합니다...${NC}"
  {
    echo "# 외부 번들 해시 파일"
    echo "# 형식: <파일경로> <해시알고리즘> <해시값>"
    echo "# 예: public/novnc/rfb.js sha256 abc123..."
    echo ""
    find "$VENDOR_DIR" -type f -exec sha256sum {} \; | sed "s|$FRONTEND_DIR/||" | sort
  } > "$HASH_FILE"
  echo -e "${GREEN}✅ 초기 해시 파일 생성 완료: $HASH_FILE${NC}"
  echo -e "${YELLOW}⚠️  이 파일을 커밋하고 CI에 추가하세요.${NC}"
  exit 0
fi

# 현재 해시 계산
CURRENT_HASHES=$(mktemp)
trap "rm -f $CURRENT_HASHES" EXIT

find "$VENDOR_DIR" -type f -exec sha256sum {} \; | sed "s|$FRONTEND_DIR/||" | sort > "$CURRENT_HASHES"

# 저장된 해시와 비교
STORED_HASHES=$(mktemp)
trap "rm -f $CURRENT_HASHES $STORED_HASHES" EXIT

# 주석 제거하고 해시만 추출
grep -v '^#' "$HASH_FILE" | grep -v '^$' | awk '{print $1 " " $2}' | sort > "$STORED_HASHES"

# 비교
DIFF_OUTPUT=$(diff -u "$STORED_HASHES" <(awk '{print $1 " " $2}' "$CURRENT_HASHES") || true)

if [ -z "$DIFF_OUTPUT" ]; then
  echo -e "${GREEN}✅ 모든 외부 번들 해시가 일치합니다.${NC}"
  exit 0
else
  echo -e "${RED}❌ FATAL: 외부 번들 해시가 변경되었습니다!${NC}"
  echo ""
  echo "변경 사항:"
  echo "$DIFF_OUTPUT"
  echo ""
  echo -e "${YELLOW}⚠️  외부 번들을 수정했다면:${NC}"
  echo "  1. 업스트림 버전 확인"
  echo "  2. 해시 파일 업데이트: $HASH_FILE"
  echo "  3. 변경 로그 작성"
  echo "  4. PR에 변경 사항 포함"
  echo ""
  echo -e "${RED}⚠️  ESLint로 vendor 파일을 수정하지 마세요!${NC}"
  echo "  외부 번들은 해시/핀/검증으로 관리합니다."
  exit 1
fi
