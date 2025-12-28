# API 문서 자동 생성 가이드

> [← 개발](./getting-started.md) | [API 문서](./api-documentation.md)

## 개요

LIMEN API는 **Swagger/OpenAPI**를 사용하여 자동으로 문서를 생성합니다. 코드 주석에서 직접 문서를 생성하므로 코드와 문서가 항상 동기화됩니다.

> **자동 문서 생성 원칙**:  
> - 코드 주석에서 문서 생성
> - 코드 변경 시 자동 업데이트
> - Swagger UI로 인터랙티브 테스트
> - OpenAPI 3.0 스펙 준수

---

## Swagger 문서 생성

### 자동 생성 스크립트 사용

```bash
# Swagger 문서 생성
./scripts/generate-swagger.sh
```

이 스크립트는 다음을 수행합니다:
1. `swag` 도구 설치 (없는 경우)
2. 코드 주석에서 Swagger 문서 생성
3. `backend/docs/` 디렉토리에 문서 저장

### 수동 생성

```bash
cd backend

# swag 설치 (처음 한 번만)
go install github.com/swaggo/swag/cmd/swag@latest

# 문서 생성
swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal --parseDepth 2
```

---

## Swagger UI 접근

### 로컬 개발 환경

```
http://localhost:18443/swagger
http://localhost:18443/docs
```

### 프로덕션 환경

프로덕션에서는 Swagger UI를 비활성화하거나 인증을 추가하는 것을 권장합니다.

---

## API 엔드포인트 문서화

### 기본 구조

모든 핸들러 함수에 Swagger 어노테이션을 추가합니다:

```go
// @Summary     엔드포인트 요약
// @Description 상세 설명
// @Tags        태그 (Authentication, VM, User 등)
// @Accept      json
// @Produce     json
// @Param       param_name body RequestType true "파라미터 설명"
// @Success     200  {object}  ResponseType  "성공 응답 설명"
// @Failure     400  {object}  map[string]interface{}  "에러 응답 설명"
// @Router      /api/endpoint [method]
func (h *Handler) HandleEndpoint(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
    // ...
}
```

### 예시: 로그인 엔드포인트

```go
// HandleLogin handles user login and returns a JWT token.
// @Summary     User login
// @Description Authenticates a user and returns a JWT token
// @Tags        Authentication
// @Accept      json
// @Produce     json
// @Param       credentials body LoginRequest true "Login credentials"
// @Success     200  {object}  LoginResponse  "Login successful"
// @Failure     400  {object}  map[string]interface{}  "Invalid request"
// @Failure     401  {object}  map[string]interface{}  "Invalid credentials"
// @Failure     403  {object}  map[string]interface{}  "Account locked or not approved"
// @Router      /auth/login [post]
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
    // ...
}
```

---

## Swagger 어노테이션 가이드

### 주요 어노테이션

#### @Summary
엔드포인트의 간단한 요약 (한 줄)

```go
// @Summary     Create a new VM
```

#### @Description
엔드포인트의 상세 설명 (여러 줄 가능)

```go
// @Description Creates a new virtual machine with specified resources.
// @Description The VM will be created in stopped state and requires admin approval.
```

#### @Tags
엔드포인트를 그룹화하는 태그

```go
// @Tags        VM
// @Tags        Admin
```

#### @Accept / @Produce
요청/응답 Content-Type

```go
// @Accept      json
// @Produce     json
```

#### @Param
요청 파라미터 정의

```go
// @Param       id path int true "VM ID"
// @Param       body body CreateVMRequest true "VM creation data"
// @Param       authorization header string true "Bearer token"
```

#### @Success / @Failure
응답 정의

```go
// @Success     200  {object}  VM  "VM created successfully"
// @Success     201  {object}  map[string]interface{}  "VM created"
// @Failure     400  {object}  map[string]interface{}  "Invalid request"
// @Failure     401  {object}  map[string]interface{}  "Unauthorized"
// @Failure     500  {object}  map[string]interface{}  "Internal server error"
```

#### @Router
엔드포인트 경로 및 HTTP 메서드

```go
// @Router      /vms [post]
// @Router      /vms/{id} [get]
// @Router      /vms/{id} [delete]
```

#### @Security
인증 요구사항

```go
// @Security    BearerAuth
```

---

## 모델 정의

### 구조체 문서화

```go
// User represents a system user.
// @Description User account information
type User struct {
    // @Description User unique identifier
    ID       uint   `json:"id" example:"1"`
    
    // @Description Username (3-32 characters)
    Username string `json:"username" example:"admin"`
    
    // @Description User role (admin or user)
    Role     string `json:"role" example:"admin"`
    
    // @Description Account approval status
    Approved bool   `json:"approved" example:"true"`
}
```

---

## CI/CD 통합

### GitHub Actions에서 자동 생성

`.github/workflows/ci.yml`에 추가:

```yaml
- name: Generate Swagger documentation
  run: |
    cd backend
    go install github.com/swaggo/swag/cmd/swag@latest
    swag init -g cmd/server/main.go -o docs
    git diff --exit-code docs/ || (echo "Swagger docs out of sync" && exit 1)
```

---

## 문서화 체크리스트

### 필수 항목
- [x] 모든 공개 API 엔드포인트 문서화
- [x] 요청/응답 모델 정의
- [x] 에러 응답 문서화
- [x] 인증 요구사항 명시

### 권장 항목
- [ ] 예제 요청/응답 추가
- [ ] 태그로 엔드포인트 그룹화
- [ ] 상세 설명 추가
- [ ] 파라미터 유효성 검사 문서화

---

## 문제 해결

### 문서가 생성되지 않는 경우

1. **swag 설치 확인**
   ```bash
   which swag
   go install github.com/swaggo/swag/cmd/swag@latest
   ```

2. **주석 형식 확인**
   - `//` 주석 사용 (블록 주석 아님)
   - 어노테이션은 함수 바로 위에 위치

3. **의존성 확인**
   ```bash
   swag init -g cmd/server/main.go -o docs --parseDependency
   ```

### Swagger UI가 표시되지 않는 경우

1. **문서 파일 확인**
   ```bash
   ls -la backend/docs/
   ```

2. **서버 로그 확인**
   - Swagger 엔드포인트 접근 로그 확인

3. **경로 확인**
   - `/swagger` 또는 `/docs` 접근
   - `/api/swagger/doc.json` 직접 접근

---

## 관련 문서

- [개발 시작 가이드](./getting-started.md)
- [API 엔드포인트](./api-endpoints.md)

---

**태그**: `#API-문서` `#Swagger` `#OpenAPI` `#자동-생성`

**마지막 업데이트**: 2024-12-23







