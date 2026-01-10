# VM Start/Stop 버그 수정 (2026-01-06)

## 개요

VM start/stop 액션 시 DB 저장 누락 및 프론트엔드 상태 동기화 문제를 해결했습니다.

## 발견된 문제점

### 1. 백엔드 문제: DB 저장 누락
- **위치**: `backend/internal/handlers/api.go` - `VMActionStop` 케이스
- **문제**: VM 중지 후 일부 경로에서 DB 저장이 누락되어 새로고침 시 상태가 반영되지 않음
- **영향**: 
  - VM을 중지해도 DB에 상태가 저장되지 않아 새로고침 시 이전 상태로 표시됨
  - VNC에서 VM이 꺼져 있어도 프론트엔드에서는 여전히 "Running"으로 표시될 수 있음

### 2. 프론트엔드 문제: 상태 동기화 누락
- **위치**: `frontend/hooks/useVMs.ts` - `onSettled` 콜백
- **문제**: start/stop 액션 후 `invalidateQueries`를 호출하지 않아 새로고침 시 최신 상태를 가져오지 못함
- **영향**:
  - 서버 응답은 성공했지만, 새로고침 시 최신 상태를 가져오지 못함
  - WebSocket이 작동하지 않을 경우 상태가 영구적으로 동기화되지 않음

### 3. libvirt 동기화 문제
- **문제**: DB에는 VM이 있지만 libvirt에는 없는 경우 에러 처리 부족
- **영향**: "Internal server error" 반환으로 사용자에게 명확하지 않음

## 수정 내용

### 백엔드 수정 (`backend/internal/handlers/api.go`)

#### 1. VM Stop 액션 - 모든 경로에서 DB 저장 보장
```go
// 모든 VM stop 경로에서 DB 저장 추가
vmRec.Status = models.VMStatusStopped
actionSuccess = true
logger.Log.Info("VM stopped", zap.String("vm_name", vmRec.Name))
audit.LogVMStop(r.Context(), userID, vmRec.UUID, true)
// Save VM status to DB before broadcasting (always save)
if err := h.DB.Save(&vmRec).Error; err != nil {
    logger.Log.Error("Failed to save VM status after stop", zap.Error(err), zap.String("vm_name", vmRec.Name))
    // Continue anyway - status update is more important than DB save failure
} else {
    logger.Log.Info("VM status saved to DB", zap.String("vm_name", vmRec.Name), zap.String("status", string(vmRec.Status)))
}
// Broadcast VM update via WebSocket
h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
logger.Log.Info("VM status broadcasted via WebSocket", zap.String("vm_name", vmRec.Name), zap.String("status", string(vmRec.Status)))
```

#### 2. VM Start 액션 - libvirt 동기화 개선
```go
// libvirt에 VM이 없을 때 명확한 에러 처리
if err := h.VMService.StartVM(vmRec.Name); err != nil {
    errStr := err.Error()
    if strings.Contains(errStr, "Domain not found") || strings.Contains(errStr, "VM not found") {
        // DB 상태를 Stopped로 업데이트하고 명확한 에러 반환
        vmRec.Status = models.VMStatusStopped
        h.DB.Save(&vmRec)
        h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)
        errors.WriteError(w, http.StatusNotFound, "VM not found in libvirt. Please recreate the VM.", err)
        return
    }
    // 기타 에러는 기존대로 처리
    errors.WriteInternalError(w, err, h.Config.Env == "development")
    return
}
```

#### 3. VM Start 액션 - 이미 실행 중일 때 DB 동기화
- `service.go`의 `StartVM` 함수에서 이미 실행 중인 VM도 DB 상태를 동기화하도록 수정

### 프론트엔드 수정 (`frontend/hooks/useVMs.ts`)

#### start/stop 액션 후 상태 동기화 추가
```typescript
} else if (variables.action === 'start' || variables.action === 'stop') {
  // start/stop 액션: 서버 응답을 신뢰하되, 적절한 타이밍에 invalidateQueries 호출
  setTimeout(() => {
    queueMicrotask(() => {
      startTransition(() => {
        // 서버 응답 후 1초 지연하여 invalidateQueries 호출
        // 이렇게 하면 서버가 DB에 상태를 저장하고 WebSocket으로 브로드캐스트한 후에
        // 최신 상태를 가져올 수 있음
        queryClient.invalidateQueries({ queryKey: ['vms'] });
        queryClient.invalidateQueries({ queryKey: ['quota'] });
      });
    });
  }, 1000); // 1초 지연
}
```

## 수정 효과

### 해결된 문제
1. ✅ VM 중지 후 DB에 상태가 저장되어 새로고침 시 정확한 상태 표시
2. ✅ 프론트엔드에서 start/stop 액션 후 적절한 타이밍에 상태 동기화
3. ✅ VNC에서 VM이 꺼져 있어도 프론트엔드에서 정확한 상태 표시
4. ✅ libvirt에 VM이 없을 때 명확한 에러 메시지 반환

### 개선 사항
1. 모든 VM 액션 경로에서 DB 저장 및 WebSocket 브로드캐스트 보장
2. 로깅 강화로 디버깅 용이성 향상
3. 프론트엔드와 백엔드 간 상태 동기화 신뢰성 향상

## 관련 파일

- `backend/internal/handlers/api.go` - VM 액션 핸들러
- `backend/internal/vm/service.go` - VM 서비스 로직
- `frontend/hooks/useVMs.ts` - VM 상태 관리 훅

## 커밋 정보

- 커밋: `d17d020` - "fix: VM start/stop 액션 DB 저장 누락 수정 및 WSL2 라우팅 자동 수정 스크립트 추가"
- 날짜: 2026-01-06



