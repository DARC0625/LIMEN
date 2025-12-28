#!/bin/bash
# ISO 파일 참조 확인 스크립트

set -e

echo "=========================================="
echo "ISO 파일 참조 확인 스크립트"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. ISO 파일 디렉토리 확인
echo "1. ISO 파일 디렉토리 확인"
echo "----------------------------------------"
ISO_DIR="${ISO_DIR:-/home/darc0/projects/LIMEN/isos}"
if [ -d "$ISO_DIR" ]; then
    echo -e "${GREEN}✓ ISO 디렉토리 존재: $ISO_DIR${NC}"
    ISO_COUNT=$(find "$ISO_DIR" -name "*.iso" -type f 2>/dev/null | wc -l)
    echo "  ISO 파일 개수: $ISO_COUNT"
    if [ "$ISO_COUNT" -gt 0 ]; then
        echo "  ISO 파일 목록:"
        find "$ISO_DIR" -name "*.iso" -type f 2>/dev/null | while read iso; do
            SIZE=$(du -h "$iso" | cut -f1)
            echo "    - $(basename "$iso") ($SIZE)"
        done
    else
        echo -e "${YELLOW}⚠ ISO 파일이 없습니다${NC}"
    fi
else
    echo -e "${RED}✗ ISO 디렉토리가 없습니다: $ISO_DIR${NC}"
fi
echo ""

# 2. 환경 변수 확인
echo "2. 환경 변수 확인"
echo "----------------------------------------"
if [ -f ".env" ]; then
    if grep -q "ISO_DIR" .env; then
        ENV_ISO_DIR=$(grep "^ISO_DIR=" .env | cut -d= -f2 | tr -d '"' | tr -d "'")
        echo -e "${GREEN}✓ ISO_DIR 환경 변수: $ENV_ISO_DIR${NC}"
    else
        echo -e "${YELLOW}⚠ ISO_DIR 환경 변수가 설정되지 않았습니다${NC}"
    fi
else
    echo -e "${YELLOW}⚠ .env 파일을 찾을 수 없습니다${NC}"
fi
echo ""

# 3. VM 생성 로직에서 ISO 참조 확인
echo "3. VM 생성 로직 확인"
echo "----------------------------------------"
VM_SERVICE_FILE="backend/internal/vm/service.go"
if [ -f "$VM_SERVICE_FILE" ]; then
    echo -e "${GREEN}✓ VM 서비스 파일 존재${NC}"
    
    # EnsureISO 함수 확인
    if grep -q "func.*EnsureISO" "$VM_SERVICE_FILE"; then
        echo -e "${GREEN}✓ EnsureISO 함수 존재${NC}"
        echo "  ISO 파일 조회 로직:"
        grep -A 5 "func.*EnsureISO" "$VM_SERVICE_FILE" | head -6 | sed 's/^/    /'
    else
        echo -e "${RED}✗ EnsureISO 함수를 찾을 수 없습니다${NC}"
    fi
    
    # CreateVM에서 ISO 사용 확인
    if grep -q "EnsureISO\|isoPath" "$VM_SERVICE_FILE"; then
        echo -e "${GREEN}✓ CreateVM에서 ISO 파일 사용 확인${NC}"
        echo "  ISO 경로 사용 위치:"
        grep -n "isoPath\|EnsureISO" "$VM_SERVICE_FILE" | head -5 | sed 's/^/    /'
    else
        echo -e "${RED}✗ CreateVM에서 ISO 파일 사용을 찾을 수 없습니다${NC}"
    fi
else
    echo -e "${RED}✗ VM 서비스 파일을 찾을 수 없습니다${NC}"
fi
echo ""

# 4. libvirt XML에서 ISO 참조 확인
echo "4. libvirt XML 생성 확인"
echo "----------------------------------------"
if [ -f "$VM_SERVICE_FILE" ]; then
    if grep -q "device='cdrom'" "$VM_SERVICE_FILE"; then
        echo -e "${GREEN}✓ CDROM 디바이스 설정 확인${NC}"
        echo "  CDROM 설정:"
        grep -A 3 "device='cdrom'" "$VM_SERVICE_FILE" | head -4 | sed 's/^/    /'
    else
        echo -e "${RED}✗ CDROM 디바이스 설정을 찾을 수 없습니다${NC}"
    fi
    
    if grep -q "boot dev='cdrom'" "$VM_SERVICE_FILE"; then
        echo -e "${GREEN}✓ CDROM 부팅 설정 확인${NC}"
    else
        echo -e "${YELLOW}⚠ CDROM 부팅 설정을 찾을 수 없습니다${NC}"
    fi
fi
echo ""

# 5. 실제 VM 생성 테스트 (선택적)
echo "5. ISO 파일 경로 검증"
echo "----------------------------------------"
if [ -d "$ISO_DIR" ]; then
    for iso in "$ISO_DIR"/*.iso; do
        if [ -f "$iso" ]; then
            echo -e "${GREEN}✓ $(basename "$iso")${NC}"
            echo "    경로: $iso"
            echo "    크기: $(du -h "$iso" | cut -f1)"
            echo "    읽기 권한: $([ -r "$iso" ] && echo "✓" || echo "✗")"
        fi
    done
else
    echo -e "${YELLOW}⚠ ISO 디렉토리가 없어 검증할 수 없습니다${NC}"
fi
echo ""

# 6. 요약
echo "=========================================="
echo "요약"
echo "=========================================="
echo ""
echo "ISO 파일 참조 흐름:"
echo "  1. VM 생성 요청 → os_type 전달"
echo "  2. EnsureISO(osType) → DB에서 os_type으로 ISO 경로 조회"
echo "  3. 파일 존재 확인 (os.Stat)"
echo "  4. CreateVM → libvirt XML에 ISO 경로 포함"
echo "  5. CDROM 디바이스로 ISO 마운트"
echo ""
echo "확인 사항:"
echo "  - ISO 파일이 실제로 존재하는가?"
echo "  - DB에 os_type과 경로가 올바르게 등록되어 있는가?"
echo "  - libvirt XML에 ISO 경로가 올바르게 포함되는가?"
echo ""










