# VM 전체 삭제 작업 (2026-01-06)

## 개요

DB와 libvirt에 있는 모든 VM을 삭제하여 깨끗한 상태로 초기화했습니다.

## 작업 내용

### 1. DB에서 모든 VM 삭제
```sql
DELETE FROM console_sessions;
DELETE FROM vms;
```

**삭제 결과**:
- `console_sessions`: 32개 삭제
- `vms`: 4개 삭제
- 현재 VM 개수: 0

### 2. libvirt에서 모든 도메인 확인
```bash
virsh list --all
```

**결과**: 모든 도메인 삭제 완료 (이미 비어있었음)

## 실행 방법

### 수동 실행
```bash
# DB 삭제
PGPASSWORD=0625 psql -h localhost -U postgres -d limen -c "DELETE FROM console_sessions; DELETE FROM vms;"

# libvirt 확인
virsh list --all
```

### 스크립트 사용
**파일**: `backend/scripts/cleanup_all_vms.go`

```bash
cd backend
go run scripts/cleanup_all_vms.go
```

## 주의사항

1. **외래 키 제약 조건**: `console_sessions`를 먼저 삭제해야 함
2. **영구 삭제**: 이 작업은 되돌릴 수 없음
3. **백업 권장**: 중요한 VM이 있다면 삭제 전 백업 필요

## 작업 후 상태

- ✅ DB: VM 0개
- ✅ libvirt: 도메인 0개
- ✅ 백엔드: 재시작 완료

## 관련 파일

- `backend/scripts/cleanup_all_vms.go` - VM 삭제 스크립트

## 날짜

2026-01-06

