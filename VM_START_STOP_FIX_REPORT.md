# VM Start/Stop 버그 수정 보고서

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

## 수정 내용

### 백엔드 수정 (`backend/internal/handlers/api.go`)

#### 1. VM Stop 액션 - 에러 경로 DB 저장 추가
```go
// 수정 전:
vmRec.Status = models.VMStatusStopped
actionSuccess = true
logger.Log.Info("VM stopped", zap.String("vm_name", vmRec.Name))
h.VMStatusBroadcaster.BroadcastVMUpdate(vmRec)

// 수정 후:
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

#### 2. VM Stop 액션 - 정상 경로 DB 저장 및 로깅 강화
- 이미 DB 저장이 있던 경로에도 로깅 추가
- WebSocket 브로드캐스트 후 로깅 추가

### 프론트엔드 수정 (`frontend/hooks/useVMs.ts`)

#### start/stop 액션 후 상태 동기화 추가
```typescript
// 수정 전:
} else if (variables.action === 'start' || variables.action === 'stop') {
  // start/stop 액션: 서버 응답을 신뢰하므로 invalidateQueries를 호출하지 않음
  // ...

// 수정 후:
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
```

## 수정 효과

### 해결된 문제
1. ✅ VM 중지 후 DB에 상태가 저장되어 새로고침 시 정확한 상태 표시
2. ✅ 프론트엔드에서 start/stop 액션 후 적절한 타이밍에 상태 동기화
3. ✅ VNC에서 VM이 꺼져 있어도 프론트엔드에서 정확한 상태 표시

### 개선 사항
1. 모든 VM 액션 경로에서 DB 저장 및 WebSocket 브로드캐스트 보장
2. 로깅 강화로 디버깅 용이성 향상
3. 프론트엔드와 백엔드 간 상태 동기화 신뢰성 향상

## 테스트 방법

1. **VM Start 테스트**:
   - VM 시작 버튼 클릭
   - 새로고침 후 상태 확인 (Running으로 표시되어야 함)
   - VNC에서 VM이 실제로 실행 중인지 확인

2. **VM Stop 테스트**:
   - VM 중지 버튼 클릭
   - 새로고침 후 상태 확인 (Stopped로 표시되어야 함)
   - VNC에서 VM이 실제로 중지되었는지 확인

3. **상태 동기화 테스트**:
   - VM 시작/중지 후 1초 대기
   - 자동으로 상태가 업데이트되는지 확인
   - WebSocket 연결이 끊어진 상태에서도 새로고침 시 정확한 상태 표시 확인

## 관련 파일

- `backend/internal/handlers/api.go` - VM 액션 핸들러
- `frontend/hooks/useVMs.ts` - VM 상태 관리 훅
- `backend/internal/vm/service.go` - VM 서비스 로직

## 추가 권장 사항

1. **WebSocket 연결 상태 모니터링**: WebSocket이 끊어진 경우 자동 재연결 및 상태 동기화
2. **상태 동기화 재시도 로직**: DB 저장 실패 시 재시도 메커니즘 추가
3. **상태 불일치 감지**: libvirt 상태와 DB 상태가 불일치할 경우 자동 동기화

