# 빠른 개선 가이드

## 1. 환경 변수 사용 (최우선)

### database/db.go 수정
```go
// Before
dsn := "host=localhost user=postgres password=password dbname=project_alpha..."

// After
import "github.com/darc0/limen/backend/internal/config"

cfg := config.Load()
dsn := cfg.DatabaseURL
```

### vm/service.go 수정
```go
// Before
const (
    isoDir = "/home/darc0/projects/LIMEN/database/iso"
    vmDir  = "/home/darc0/projects/LIMEN/database/vms"
)

// After
type VMService struct {
    conn   *libvirt.Connect
    db     *gorm.DB
    isoDir string
    vmDir  string
}

func NewVMService(db *gorm.DB, isoDir, vmDir string) (*VMService, error) {
    // ...
}
```

### config/config.go 확장
```go
type Config struct {
    Port        string
    DatabaseURL string
    LibvirtURI  string
    ISODir      string  // 추가
    VMDir       string  // 추가
    AdminUser   string  // 추가
    AdminPass   string  // 추가
    AllowedOrigins []string  // 추가
}
```

## 2. CORS 개선

### handlers/api.go
```go
func WithCORS(allowedOrigins []string) func(http.HandlerFunc) http.HandlerFunc {
    return func(next http.HandlerFunc) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
            origin := r.Header.Get("Origin")
            if contains(allowedOrigins, origin) {
                w.Header().Set("Access-Control-Allow-Origin", origin)
            }
            // ...
        }
    }
}
```

## 3. 에러 응답 표준화

### internal/errors/errors.go (신규)
```go
package errors

import (
    "encoding/json"
    "net/http"
)

type APIError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
}

func WriteError(w http.ResponseWriter, code int, message string, err error) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    
    apiErr := APIError{
        Code:    code,
        Message: message,
    }
    if err != nil {
        apiErr.Details = err.Error()
        // 로깅은 여기서 처리
    }
    
    json.NewEncoder(w).Encode(apiErr)
}
```

## 4. 로깅 시스템 도입

### go.mod에 추가
```bash
go get go.uber.org/zap
```

### internal/logger/logger.go (신규)
```go
package logger

import (
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

var Log *zap.Logger

func Init(level string) error {
    var zapLevel zapcore.Level
    zapLevel.UnmarshalText([]byte(level))
    
    config := zap.NewProductionConfig()
    config.Level = zap.NewAtomicLevelAt(zapLevel)
    
    var err error
    Log, err = config.Build()
    return err
}
```

## 5. 입력 검증

### internal/validator/validator.go (신규)
```go
package validator

import (
    "errors"
    "fmt"
)

func ValidateVMRequest(name string, cpu, memory int) error {
    if name == "" {
        return errors.New("VM name is required")
    }
    if cpu < 1 || cpu > 32 {
        return fmt.Errorf("CPU must be between 1 and 32, got %d", cpu)
    }
    if memory < 512 || memory > 65536 {
        return fmt.Errorf("Memory must be between 512MB and 64GB, got %dMB", memory)
    }
    return nil
}
```

## 6. 타입 안정성

### internal/models/status.go (신규)
```go
package models

type VMStatus string

const (
    VMStatusRunning  VMStatus = "Running"
    VMStatusStopped  VMStatus = "Stopped"
    VMStatusCreating VMStatus = "Creating"
    VMStatusDeleting VMStatus = "Deleting"
    VMStatusError    VMStatus = "Error"
)

func (s VMStatus) String() string {
    return string(s)
}

func (s VMStatus) IsValid() bool {
    switch s {
    case VMStatusRunning, VMStatusStopped, VMStatusCreating, VMStatusDeleting, VMStatusError:
        return true
    }
    return false
}
```

### models.go 수정
```go
type VM struct {
    // ...
    Status VMStatus `gorm:"type:varchar(20);default:'Stopped'" json:"status"`
    // ...
}
```

