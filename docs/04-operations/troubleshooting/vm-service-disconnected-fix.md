# VM Service Disconnected 문제 해결

## 문제 증상

대시보드에서 "VM Service: disconnected" 상태로 표시되며, VM 목록이 표시되지 않음

## 원인 분석

1. **VMService 미초기화**: `main.go`에서 Handler를 생성할 때 VMService를 초기화하지 않음
2. **libvirt 연결 부재**: Health Check에서 `h.VMService.IsAlive()`를 호출하지만 VMService가 nil이어서 항상 "disconnected" 반환

## 해결 방법

### 1. VMService 초기화 추가

`main.go`에서 libvirt 연결을 초기화하고 VMService를 생성:

```go
// Initialize VM Service (libvirt connection)
libvirtURI := cfg.LibvirtURI
vmService, err := vm.NewVMService(database.DB, libvirtURI, cfg.ISODir, cfg.VMDir)
if err != nil {
    logger.Log.Warn("Failed to initialize VM service (libvirt connection)", 
        zap.Error(err),
        zap.String("libvirt_uri", libvirtURI),
        zap.String("iso_dir", cfg.ISODir),
        zap.String("vm_dir", cfg.VMDir))
    logger.Log.Info("VM operations will be unavailable until libvirt connection is established")
    vmService = nil // Continue without VM service
} else {
    logger.Log.Info("VM service initialized successfully",
        zap.String("libvirt_uri", libvirtURI))
    defer vmService.Close() // Close libvirt connection on shutdown
}

// Create handlers
h := handlers.NewHandler(database.DB, vmService, cfg)
```

### 2. NewHandler 함수 사용

기존의 직접 구조체 생성 대신 `NewHandler` 함수를 사용하여 VMService와 다른 필드들을 올바르게 초기화:

```go
// Before (잘못된 방법)
h := &handlers.Handler{
    DB: database.DB,
}

// After (올바른 방법)
h := handlers.NewHandler(database.DB, vmService, cfg)
```

### 3. Import 추가

`vm` 패키지를 import:

```go
import (
    // ... other imports
    "github.com/DARC0625/LIMEN/backend/internal/vm"
    // ... other imports
)
```

## 변경된 파일

- `backend/cmd/server/main.go`
  - `vm` 패키지 import 추가
  - VMService 초기화 로직 추가
  - `NewHandler` 함수 사용으로 변경

## 적용 방법

1. **백엔드 재시작**:
   ```bash
   # 1. 현재 서버 종료
   pkill -f './server'
   
   # 2. 새로 빌드 및 실행
   cd /home/darc0/projects/LIMEN/backend
   go build ./cmd/server
   ./server &
   ```

2. **확인**:
   ```bash
   # Health check API 호출
   curl http://localhost:18443/api/health
   
   # 예상 결과:
   # {"status":"ok","time":"...","db":"connected","libvirt":"connected"}
   ```

## 예상 결과

- 대시보드에서 "VM Service: connected" 상태로 표시
- VM 목록이 정상적으로 표시됨
- VM 생성/관리 기능이 정상 작동

## 문제가 지속되는 경우

1. **libvirt 연결 확인**:
   ```bash
   virsh list --all
   ```

2. **libvirt URI 확인**:
   ```bash
   echo $LIBVIRT_URI
   # 기본값: qemu:///system
   ```

3. **권한 확인**:
   ```bash
   # libvirt 그룹에 사용자 추가
   sudo usermod -aG libvirt $USER
   ```

4. **로그 확인**:
   ```bash
   tail -f /var/log/limen/*.log | grep -i "vm service\|libvirt"
   ```









