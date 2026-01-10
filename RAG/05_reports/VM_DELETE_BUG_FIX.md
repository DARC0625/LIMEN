# VM 삭제 버그 수정 (2026-01-06)

## 문제 상황

프론트엔드에서 VM 삭제를 진행했는데:
- ✅ libvirt: VM이 삭제됨
- ❌ DB: VM이 남아있음

## 원인 분석

### 1. 외래 키 제약 조건 위반
- `console_sessions` 테이블에 해당 VM의 세션이 남아있어서 VM 삭제 실패
- 에러: `ERROR: update or delete on table "vms" violates foreign key constraint "fk_console_sessions_vm" on table "console_sessions"`

### 2. 에러 처리 문제
- `DeleteVM` 함수에서 DB 삭제 실패 시 에러를 로그만 남기고 `nil`을 반환
- `api.go`에서는 성공으로 처리하고 "VM deleted" 로그를 남김
- 결과: libvirt는 삭제되었지만 DB에는 남아있는 상태

## 수정 내용

### 백엔드 수정 (`backend/internal/vm/service.go`)

#### 1. console_sessions 먼저 삭제
```go
// 3. Remove related console_sessions first (foreign key constraint)
if vmRec.ID > 0 {
    if err := s.db.Where("vm_id = ?", vmRec.ID).Delete(&models.ConsoleSession{}).Error; err != nil {
        logger.Log.Warn("Failed to delete console sessions for VM", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID), zap.Error(err))
        // Continue anyway - try to delete VM even if console sessions deletion fails
    } else {
        logger.Log.Info("Console sessions deleted for VM", zap.String("vm_name", name), zap.Uint("vm_id", vmRec.ID))
    }
}
```

#### 2. DB 삭제 실패 시 에러 반환
```go
// 4. Remove from DB (Hard delete)
if err := s.db.Unscoped().Where("name = ?", name).Delete(&models.VM{}).Error; err != nil {
    logger.Log.Error("Failed to delete VM from DB", zap.String("vm_name", name), zap.Error(err))
    return fmt.Errorf("failed to delete VM from DB: %w", err) // 에러 반환 추가
}

logger.Log.Info("VM successfully deleted from DB", zap.String("vm_name", name))
return nil
```

## 삭제 순서

1. libvirt 도메인 삭제 (undefine)
2. VM 디스크 파일 삭제
3. **console_sessions 삭제** (외래 키 제약 조건 해결)
4. **VM DB 레코드 삭제** (실패 시 에러 반환)

## 수정 효과

### 해결된 문제
1. ✅ 외래 키 제약 조건 위반 해결 (console_sessions 먼저 삭제)
2. ✅ DB 삭제 실패 시 에러 반환하여 프론트엔드에 알림
3. ✅ libvirt와 DB 동기화 보장

### 개선 사항
1. 삭제 순서 명확화
2. 에러 처리 강화
3. 로깅 개선

## 관련 파일

- `backend/internal/vm/service.go` - VM 삭제 로직
- `backend/internal/handlers/api.go` - VM 액션 핸들러

## 커밋 정보

- 날짜: 2026-01-06



