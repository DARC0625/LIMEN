#!/usr/bin/env bash
set -euo pipefail

# src/ 파일을 프론트/백엔드로 분류하는 스크립트

SRC_DIR="/home/darc0/LIMEN/src"
FRONTEND_DIR="/home/darc0/LIMEN/frontend/src"
BACKEND_DIR="/home/darc0/LIMEN/backend/src"
SHARED_DIR="/home/darc0/LIMEN/packages/shared"

# 디렉토리 생성
mkdir -p "$FRONTEND_DIR"
mkdir -p "$BACKEND_DIR"
mkdir -p "$SHARED_DIR"

# 프론트엔드 단서
FRONTEND_KEYWORDS="next react window document novnc playwright fetch pages/app components"
# 백엔드 단서
BACKEND_KEYWORDS="express fastify libvirt pm2 pg db jwt fs child_process qemu"

classify_file() {
    local file="$1"
    local content=$(head -n 20 "$file" 2>/dev/null || echo "")
    local lower_content=$(echo "$content" | tr '[:upper:]' '[:lower:]')
    
    # 프론트엔드 체크
    for keyword in $FRONTEND_KEYWORDS; do
        if echo "$lower_content" | grep -qi "$keyword"; then
            echo "FRONTEND"
            return 0
        fi
    done
    
    # 백엔드 체크
    for keyword in $BACKEND_KEYWORDS; then
        if echo "$lower_content" | grep -qi "$keyword"; then
            echo "BACKEND"
            return 0
        fi
    done
    
    # 파일 확장자 기반 분류
    case "$file" in
        *.tsx|*.jsx|*.css|*.scss)
            echo "FRONTEND"
            ;;
        *.go|*.py|*.sh)
            echo "BACKEND"
            ;;
        *.ts|*.js)
            # .ts/.js는 내용 확인 필요
            if echo "$file" | grep -qiE "(component|page|hook|app)"; then
                echo "FRONTEND"
            elif echo "$file" | grep -qiE "(api|handler|service|middleware)"; then
                echo "BACKEND"
            else
                echo "UNKNOWN"
            fi
            ;;
        *)
            echo "UNKNOWN"
            ;;
    esac
}

# src/ 내 모든 파일 처리
if [ -d "$SRC_DIR" ]; then
    find "$SRC_DIR" -type f | while read -r file; do
        rel_path="${file#$SRC_DIR/}"
        classification=$(classify_file "$file")
        
        case "$classification" in
            FRONTEND)
                target_dir="$FRONTEND_DIR/$(dirname "$rel_path")"
                mkdir -p "$target_dir"
                echo "Moving $rel_path -> frontend/src/"
                git mv "$file" "$FRONTEND_DIR/$rel_path" 2>&1 || mv "$file" "$FRONTEND_DIR/$rel_path"
                ;;
            BACKEND)
                target_dir="$BACKEND_DIR/$(dirname "$rel_path")"
                mkdir -p "$target_dir"
                echo "Moving $rel_path -> backend/src/"
                git mv "$file" "$BACKEND_DIR/$rel_path" 2>&1 || mv "$file" "$BACKEND_DIR/$rel_path"
                ;;
            *)
                echo "Unknown classification for $rel_path, skipping..."
                ;;
        esac
    done
    
    # 빈 디렉토리 정리
    find "$SRC_DIR" -type d -empty -delete 2>/dev/null || true
    
    # src/ 디렉토리가 비어있으면 삭제
    if [ -d "$SRC_DIR" ] && [ -z "$(ls -A "$SRC_DIR" 2>/dev/null)" ]; then
        rmdir "$SRC_DIR" 2>/dev/null || true
    fi
else
    echo "src/ directory not found"
fi

echo "Classification complete!"
