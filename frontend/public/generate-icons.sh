#!/bin/bash
# 간단한 아이콘 생성 스크립트 (실제로는 디자인된 아이콘이 필요)
# 임시로 SVG를 PNG로 변환하는 방법 (ImageMagick 필요)

# 192x192 아이콘
convert -size 192x192 xc:black -gravity center -pointsize 72 -fill white -annotate +0+0 "L" icon-192.png 2>/dev/null || echo "ImageMagick이 설치되지 않았습니다. 아이콘 파일을 수동으로 생성해주세요."

# 512x512 아이콘
convert -size 512x512 xc:black -gravity center -pointsize 192 -fill white -annotate +0+0 "L" icon-512.png 2>/dev/null || echo "ImageMagick이 설치되지 않았습니다. 아이콘 파일을 수동으로 생성해주세요."

echo "아이콘 생성 완료 (또는 ImageMagick이 필요합니다)"
