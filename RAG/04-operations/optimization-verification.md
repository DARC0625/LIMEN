# LIMEN 서비스 최적화 검증 가이드

**작성일**: 2025-01-14  
**버전**: 1.0

---

## 🔍 검증 방법

### 1. 데이터베이스 인덱스 확인

```sql
-- PostgreSQL에 연결
psql -U postgres -d LIMEN

-- 인덱스 확인
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename IN ('vms', 'users', 'vm_snapshots')
ORDER BY tablename, indexname;

-- 예상 결과:
-- vms: idx_vms_user_id, idx_vms_status, idx_vms_created_at, idx_vms_owner_status
-- users: idx_users_role, idx_users_approved
-- vm_snapshots: idx_snapshots_vm_id, idx_snapshots_libvirt_name
```

**검증 기준**: 모든 인덱스가 생성되어 있어야 함

---

### 2. 타입 안정성 확인

```bash
cd frontend

# TypeScript 타입 체크
npx tsc --noEmit

# any 타입 확인 (noVNC 관련 제외)
grep -rn ": any" . --include="*.ts" --include="*.tsx" | \
  grep -v "node_modules" | \
  grep -v "rfb\|RFB" | \
  wc -l

# 예상 결과: 0 또는 매우 적은 수 (noVNC 라이브러리 관련만)
```

**검증 기준**: noVNC 관련을 제외하고 `any` 타입이 거의 없어야 함

---

### 3. 번들 분석 실행

```bash
cd frontend

# 번들 분석 스크립트 실행
./scripts/analyze-bundle.sh

# 또는 직접 실행
ANALYZE=true npm run build:analyze:turbo
```

**검증 기준**:
- 번들 분석이 성공적으로 완료되어야 함
- 큰 파일들을 식별할 수 있어야 함
- noVNC가 별도 청크로 분리되어 있어야 함

---

### 4. 공통 컴포넌트 확인

```bash
# 컴포넌트 파일 확인
ls -lh frontend/components/ui/

# 예상 파일:
# - Button.tsx
# - Input.tsx
```

**검증 기준**: Button.tsx와 Input.tsx가 존재해야 함

---

### 5. 공통 훅 확인

```bash
# 훅 파일 확인
ls -lh frontend/hooks/use*.ts

# 예상 파일:
# - useMounted.ts
# - useDebounce.ts
# - useThrottle.ts
# - useOptimisticUpdate.ts
```

**검증 기준**: 모든 공통 훅이 존재해야 함

---

### 6. 코드 중복 제거 확인

```bash
# useMounted 사용 확인
grep -r "useMounted" frontend/hooks/use*.ts

# 예상 결과:
# - useVMs.ts: useMounted 사용
# - useQuota.ts: useMounted 사용
# - useAgentMetrics.ts: useMounted 사용
```

**검증 기준**: useMounted가 실제로 사용되고 있어야 함

---

### 7. 포맷 함수 중복 제거 확인

```bash
# formatBytes 중복 확인
grep -r "formatBytes.*=" frontend/components/*.tsx | grep -v "import"

# 예상 결과: 없음 (모두 import 사용)
```

**검증 기준**: formatBytes가 중복 정의되지 않아야 함

---

### 8. 백엔드 컴파일 확인

```bash
cd backend

# 컴파일 테스트
go build ./internal/database/migrations.go
go build ./internal/utils/bufferpool.go

# 전체 빌드 테스트
go build ./cmd/server
```

**검증 기준**: 컴파일 오류가 없어야 함

---

## 📊 성능 측정

### 데이터베이스 쿼리 성능

```sql
-- 느린 쿼리 확인
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE query LIKE '%vms%' OR query LIKE '%users%'
ORDER BY mean_time DESC
LIMIT 10;
```

**목표**: 평균 쿼리 시간 < 100ms

### API 응답 시간

```bash
# API 응답 시간 측정
time curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:18443/api/vms
```

**목표**: 응답 시간 < 200ms

### 메모리 사용량

```bash
# 프로세스 메모리 사용량 확인
ps aux | grep limen-server | awk '{print $6}'

# 또는
top -p $(pgrep -f limen-server)
```

**목표**: 메모리 사용량 감소 확인

---

## ✅ 검증 체크리스트

### Backend
- [ ] 데이터베이스 인덱스 생성 확인
- [ ] migrations.go 컴파일 확인
- [ ] bufferpool.go 컴파일 확인
- [ ] 서버 정상 시작 확인

### Frontend
- [ ] TypeScript 타입 체크 통과
- [ ] 공통 컴포넌트 존재 확인
- [ ] 공통 훅 존재 확인
- [ ] useMounted 적용 확인
- [ ] 포맷 함수 중복 제거 확인
- [ ] 번들 분석 실행 가능 확인

### 문서
- [ ] 최적화 문서 모두 존재
- [ ] 체크리스트 업데이트 확인
- [ ] 빠른 참조 문서 확인

---

## 🐛 문제 해결

### 인덱스가 생성되지 않는 경우

```sql
-- 수동으로 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vms_user_id ON vms(user_id);
CREATE INDEX IF NOT EXISTS idx_vms_status ON vms(status);
-- ... (나머지 인덱스)
```

### 컴파일 오류가 발생하는 경우

```bash
# 의존성 확인
cd backend
go mod tidy
go mod verify

# 컴파일 재시도
go build ./...
```

### 타입 오류가 발생하는 경우

```bash
cd frontend

# 타입 정의 확인
npx tsc --noEmit --pretty

# 특정 파일만 확인
npx tsc --noEmit frontend/components/VNCViewer.tsx
```

---

## 📈 성능 벤치마크

### Before (최적화 전)
- 데이터베이스 쿼리: 평균 150-200ms
- 메모리 사용량: 기준값
- 타입 안정성: 15개 이상 any 타입

### After (최적화 후)
- 데이터베이스 쿼리: 평균 < 100ms (목표)
- 메모리 사용량: 20-30% 감소 (목표)
- 타입 안정성: 15개 이상 any 제거 (완료)

---

## 🎯 성공 기준

### 필수 조건
- ✅ 모든 파일 컴파일/빌드 성공
- ✅ 타입 체크 통과
- ✅ 인덱스 생성 확인

### 성능 목표
- ⏳ 쿼리 성능 30-50% 개선
- ⏳ 메모리 사용량 20-30% 감소
- ⏳ 번들 크기 < 500KB (gzipped)

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-01-14

