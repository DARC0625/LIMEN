# VM 콘솔 "Unknown Reason" 문제 해결

## 문제 증상

VM 생성 후 콘솔(VNC)을 열었을 때 "unknown reason"으로 계속 안 켜지는 문제

## 원인 분석

1. **VM 생성 후 상태 동기화 지연**
   - VM이 libvirt에서 생성되고 시작되지만, 상태 동기화가 완료되기 전에 VNC 연결을 시도
   - 상태가 `stopped`로 남아있어 VNC 연결 실패

2. **VNC 연결 시 VM 실행 상태 확인 부족**
   - VNC 연결 시 VM이 실행 중이 아니면 에러만 반환하고 VM을 시작하지 않음
   - 사용자가 수동으로 VM을 시작해야 함

## 해결 방법

### 1. VM 생성 후 상태 동기화 개선

**파일**: `backend/internal/handlers/api.go`

**변경 사항**:
- VM 생성 후 2초 대기하여 VM이 완전히 시작되도록 함
- 상태 확인 후 실행 중이 아니면 자동으로 시작 시도
- 시작 후 다시 상태 확인하여 정확한 상태 반영

```go
// Create VM in libvirt using UUID for disk path
if err := h.VMService.CreateVM(req.Name, req.Memory, req.CPU, req.OSType, newVM.UUID); err != nil {
    // ... error handling
}

// Wait a moment for VM to fully start
time.Sleep(2 * time.Second)

// Sync actual status from libvirt (VM should be running now)
actualStatus, err := h.VMService.GetVMStatusFromLibvirt(req.Name)
if err == nil {
    newVM.Status = actualStatus
    // If VM is not running, try to start it
    if actualStatus != models.VMStatusRunning {
        logger.Log.Warn("VM created but not running, attempting to start", zap.String("vm_name", req.Name))
        if startErr := h.VMService.StartVM(req.Name); startErr != nil {
            logger.Log.Error("Failed to start VM after creation", zap.Error(startErr), zap.String("vm_name", req.Name))
        } else {
            // Wait a moment for VM to start
            time.Sleep(1 * time.Second)
            // Re-check status
            if updatedStatus, err := h.VMService.GetVMStatusFromLibvirt(req.Name); err == nil {
                newVM.Status = updatedStatus
            }
        }
    }
    h.DB.Save(&newVM)
}
```

### 2. VNC 연결 시 자동 VM 시작

**파일**: `backend/internal/handlers/api.go`

**변경 사항**:
- VNC 연결 시 VM이 실행 중이 아니면 자동으로 시작 시도
- 시작 후 2초 대기하여 VNC가 초기화되도록 함
- 시작 실패 시 명확한 에러 메시지 반환

```go
// Check if VM is running, if not try to start it
if vmRec.Status != models.VMStatusRunning {
    logger.Log.Info("VM is not running, attempting to start for VNC connection",
        zap.String("vm_name", vmRec.Name),
        zap.String("vm_uuid", vmRec.UUID),
        zap.String("status", string(vmRec.Status)),
        zap.Uint("user_id", claims.UserID),
        zap.String("username", claims.Username))
    
    // Try to start the VM
    if err := h.VMService.StartVM(vmRec.Name); err != nil {
        logger.Log.Error("Failed to start VM for VNC connection",
            zap.Error(err),
            zap.String("vm_name", vmRec.Name),
            zap.Uint("user_id", claims.UserID))
        ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"error":"Failed to start VM","code":"VM_START_FAILED","status":"%s","details":"%v"}`, vmRec.Status, err)))
        return
    }
    
    // Wait for VM to start and VNC to initialize
    time.Sleep(2 * time.Second)
    
    // Re-check status
    if updatedStatus, err := h.VMService.GetVMStatusFromLibvirt(vmRec.Name); err == nil {
        vmRec.Status = updatedStatus
        h.DB.Save(&vmRec)
    }
    
    // If still not running, return error
    if vmRec.Status != models.VMStatusRunning {
        logger.Log.Warn("VM failed to start after attempt",
            zap.String("vm_name", vmRec.Name),
            zap.String("status", string(vmRec.Status)),
            zap.Uint("user_id", claims.UserID))
        ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"error":"VM is not running","code":"VM_NOT_RUNNING","status":"%s","message":"VM failed to start"}`, vmRec.Status)))
        return
    }
    
    logger.Log.Info("VM started successfully for VNC connection",
        zap.String("vm_name", vmRec.Name),
        zap.Uint("user_id", claims.UserID))
}
```

## 테스트 방법

1. **VM 생성 테스트**:
   ```bash
   # VM 생성
   curl -X POST http://localhost:18443/api/vms \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "name": "test-vm",
       "cpu": 2,
       "memory": 2048,
       "os_type": "ubuntu"
     }'
   
   # VM 상태 확인 (running이어야 함)
   curl http://localhost:18443/api/vms \
     -H "Authorization: Bearer <token>"
   ```

2. **VNC 연결 테스트**:
   - 프론트엔드에서 VM 콘솔 열기
   - VM이 자동으로 시작되어야 함
   - VNC 연결이 정상적으로 이루어져야 함

## 추가 확인 사항

1. **libvirt 연결 상태**:
   ```bash
   virsh list --all
   ```

2. **VM 로그 확인**:
   ```bash
   # 백엔드 로그에서 VM 관련 로그 확인
   tail -f /var/log/limen/*.log | grep -i "vm\|vnc"
   ```

3. **VNC 포트 확인**:
   ```bash
   virsh vncdisplay <vm-name>
   ```

## 예상 결과

- VM 생성 후 자동으로 `running` 상태가 됨
- VNC 연결 시 VM이 실행 중이 아니면 자동으로 시작됨
- "unknown reason" 에러가 발생하지 않음

## 롤백 방법

문제가 발생하면 이전 버전으로 롤백:
```bash
cd /home/darc0/projects/LIMEN/backend
git checkout HEAD -- internal/handlers/api.go
go build ./cmd/server
```








