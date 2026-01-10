#!/bin/bash
# LIMEN 서비스 성능 측정 스크립트
# API 응답 시간, 데이터베이스 쿼리 성능 등을 측정

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}📊 LIMEN 서비스 성능 측정${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# API URL 설정
API_URL="${API_URL:-http://localhost:18443}"
ENDPOINTS=(
  "/api/health"
  "/api/vms"
  "/api/auth/session"
)

echo -e "${CYAN}1️⃣  API 응답 시간 측정${NC}"
echo ""

for endpoint in "${ENDPOINTS[@]}"; do
  echo -e "${BLUE}측정 중: ${endpoint}${NC}"
  
  # 5회 측정하여 평균 계산
  total_time=0
  for i in {1..5}; do
    start_time=$(date +%s%N)
    response=$(curl -s -w "\n%{http_code}" -o /dev/null "${API_URL}${endpoint}" 2>/dev/null || echo "000")
    end_time=$(date +%s%N)
    
    http_code=$(echo "$response" | tail -n1)
    duration=$(( (end_time - start_time) / 1000000 )) # 밀리초로 변환
    
    if [ "$http_code" != "000" ] && [ "$http_code" -lt 500 ]; then
      total_time=$((total_time + duration))
      echo -e "  시도 ${i}: ${duration}ms (HTTP ${http_code})"
    else
      echo -e "  ${RED}시도 ${i}: 실패 (HTTP ${http_code})${NC}"
    fi
  done
  
  avg_time=$((total_time / 5))
  echo -e "${GREEN}  평균 응답 시간: ${avg_time}ms${NC}"
  echo ""
done

echo -e "${CYAN}2️⃣  데이터베이스 쿼리 성능 확인${NC}"
echo ""

if command -v psql &> /dev/null; then
  echo -e "${BLUE}PostgreSQL 쿼리 성능 확인${NC}"
  
  # 느린 쿼리 확인 (pg_stat_statements 활성화 필요)
  if psql -U postgres -d LIMEN -c "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements';" 2>/dev/null | grep -q "1"; then
    echo -e "${GREEN}  pg_stat_statements 활성화됨${NC}"
    echo ""
    echo -e "${BLUE}  느린 쿼리 Top 10:${NC}"
    psql -U postgres -d LIMEN -c "
      SELECT 
        query,
        calls,
        mean_time::numeric(10,2) as avg_time_ms,
        max_time::numeric(10,2) as max_time_ms
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat_statements%'
      ORDER BY mean_time DESC
      LIMIT 10;
    " 2>/dev/null || echo -e "${YELLOW}  쿼리 실행 실패 (권한 확인 필요)${NC}"
  else
    echo -e "${YELLOW}  pg_stat_statements가 활성화되지 않았습니다.${NC}"
    echo -e "${YELLOW}  활성화하려면: CREATE EXTENSION pg_stat_statements;${NC}"
  fi
else
  echo -e "${YELLOW}  psql이 설치되지 않았습니다.${NC}"
fi

echo ""
echo -e "${CYAN}3️⃣  데이터베이스 인덱스 확인${NC}"
echo ""

if command -v psql &> /dev/null; then
  echo -e "${BLUE}생성된 인덱스 목록:${NC}"
  psql -U postgres -d LIMEN -c "
    SELECT 
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename IN ('vms', 'users', 'vm_snapshots', 'vm_images')
    ORDER BY tablename, indexname;
  " 2>/dev/null || echo -e "${YELLOW}  쿼리 실행 실패 (권한 확인 필요)${NC}"
else
  echo -e "${YELLOW}  psql이 설치되지 않았습니다.${NC}"
fi

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}🎉 성능 측정 완료!${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""






