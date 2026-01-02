# 테스트 가이드

## 테스트 실행

### 모든 테스트 실행
```bash
cd backend
go test ./...
```

### 단위 테스트만 실행
```bash
go test ./internal/validator ./internal/models ./internal/config -v
```

### 통합 테스트 실행
```bash
go test ./cmd/server -v
```

### 커버리지 리포트 생성
```bash
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

## Makefile 사용

```bash
make test              # 모든 테스트
make test-cover        # 커버리지 리포트
make test-unit         # 단위 테스트만
make test-integration  # 통합 테스트만
```

## 테스트 구조

### 단위 테스트
- `internal/validator/validator_test.go`: 입력 검증 테스트
- `internal/models/status_test.go`: 타입 안전한 상수 테스트
- `internal/config/config_test.go`: 설정 로딩 테스트

### 통합 테스트
- `cmd/server/main_test.go`: API 엔드포인트 테스트

## 테스트 환경

### 데이터베이스
- In-memory SQLite 사용
- 테스트 간 완전히 격리됨

### VM 서비스
- libvirt 연결이 필요한 테스트는 스킵될 수 있음
- 실제 VM 생성/삭제는 별도 환경에서 테스트 필요

## 현재 커버리지

- `validator`: 100%
- `models`: 100%
- `config`: 94.1%

## 주의 사항

⚠️ **통합 테스트:**
- libvirt 연결이 실패하면 일부 테스트가 스킵될 수 있습니다
- 실제 VM 조작이 필요한 테스트는 별도 환경에서 실행해야 합니다


