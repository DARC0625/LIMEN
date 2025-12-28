# 제로 트러스트 보안 가이드

> [← 운영](../operations-guide.md) | [보안](./hardening.md) | [제로 트러스트](./zero-trust.md)

## 개요

LIMEN 시스템은 **제로 트러스트(Zero Trust)** 원칙을 기반으로 설계되었습니다.

> **제로 트러스트 원칙**:  
> - **Never Trust, Always Verify**: 모든 요청을 검증
> - **Least Privilege**: 최소 권한 원칙
> - **Assume Breach**: 항상 침해를 가정하고 방어
> - **Minimize Information Exposure**: 최소한의 정보만 노출

---

## 핵심 원칙

### 1. 최소한의 정보 노출 (Minimize Information Exposure)

**원칙**: 클라이언트에게 최소한의 정보만 제공

**구현**:

#### 에러 메시지 일반화
```go
// ❌ 나쁜 예: 상세한 에러 정보 노출
errors.WriteInternalError(w, err, true)
// 응답: "Internal server error: database connection failed: connection refused"

// ✅ 좋은 예: 일반적인 에러 메시지만 제공
errors.WriteInternalError(w, err, false)
// 응답: "Internal server error"
```

#### 사용자 열거 방지
```go
// ❌ 나쁜 예: 사용자 존재 여부 노출
if err == gorm.ErrRecordNotFound {
    errors.WriteUnauthorized(w, "User not found")
} else {
    errors.WriteUnauthorized(w, "Invalid password")
}

// ✅ 좋은 예: 동일한 에러 메시지 (사용자 열거 방지)
errors.WriteUnauthorized(w, "Invalid credentials")
```

#### 민감 정보 로깅 방지
```go
// ❌ 나쁜 예: 비밀번호 로깅
logger.Log.Info("Login attempt", zap.String("username", username), zap.String("password", password))

// ✅ 좋은 예: 민감 정보 제거
logger.Log.Info("Login attempt", zap.Bool("password_provided", password != ""))
```

---

### 2. 모든 입력 검증 (Never Trust Input)

**원칙**: 모든 입력을 검증하고 신뢰하지 않음

**구현**:

#### 입력 검증 강화
```go
// 모든 입력 검증
func ValidateVMName(name string) error {
    // 1. Sanitize
    name = security.SanitizeString(name)
    
    // 2. 길이 검증
    if len(name) > 64 {
        return fmt.Errorf("VM name too long")
    }
    
    // 3. 형식 검증 (화이트리스트)
    for _, r := range name {
        if !isValidChar(r) {
            return fmt.Errorf("Invalid character")
        }
    }
    
    // 4. SQL Injection 패턴 검사
    if containsSQLPattern(name) {
        return fmt.Errorf("Invalid input")
    }
    
    return nil
}
```

#### 화이트리스트 접근법
```go
// ✅ 화이트리스트: 허용된 문자만 사용
allowedChars := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"

// ❌ 블랙리스트: 금지된 문자만 차단 (취약함)
```

---

### 3. 최소 권한 원칙 (Least Privilege)

**원칙**: 필요한 최소한의 권한만 부여

**구현**:

#### 역할 기반 접근 제어 (RBAC)
```go
// 사용자 역할 확인
if user.Role != models.RoleAdmin {
    errors.WriteForbidden(w, "Insufficient permissions")
    return
}
```

#### 엔드포인트별 권한 검사
```go
// 모든 보호된 엔드포인트에서 권한 검사
adminMiddleware := middleware.Admin(cfg)
```

---

### 4. 항상 검증 (Always Verify)

**원칙**: 모든 요청을 검증하고 신뢰하지 않음

**구현**:

#### JWT 토큰 검증
```go
// 모든 요청에서 토큰 검증
claims, err := auth.ValidateToken(token, secret)
if err != nil {
    errors.WriteUnauthorized(w, "Invalid token")
    return
}
```

#### 입력 검증
```go
// 모든 입력 검증
if err := validator.ValidateVMName(req.Name); err != nil {
    errors.WriteBadRequest(w, err.Error(), nil)
    return
}
```

---

## 보안 코딩 관행

### 1. SQL Injection 방지

**GORM 사용** (파라미터화된 쿼리):
```go
// ✅ 안전: GORM이 자동으로 파라미터화
h.DB.Where("username = ?", username).First(&user)

// ❌ 위험: 문자열 연결 (사용하지 않음)
// h.DB.Where("username = '" + username + "'")
```

**추가 검증**:
```go
// SQL Injection 패턴 검사
sqlPatterns := []string{"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_", "exec", "union", "select"}
```

### 2. XSS 방지

**HTML 이스케이프**:
```go
import "html"

// 입력 Sanitize
input = html.EscapeString(input)
```

**응답 헤더**:
```go
w.Header().Set("X-Content-Type-Options", "nosniff")
w.Header().Set("Content-Security-Policy", "...")
```

### 3. 경로 탐색 방지

**파일 경로 검증**:
```go
// 안전한 경로 검증
if !security.IsSafePath(filePath) {
    return fmt.Errorf("Unsafe path")
}
```

### 4. 강력한 비밀번호 정책

**비밀번호 검증**:
```go
// 최소 요구사항:
// - 최소 8자
// - 대소문자, 숫자, 특수문자 중 3가지 이상
// - 일반적인 약한 비밀번호 차단
```

---

## 정보 노출 최소화 체크리스트

### 에러 메시지
- [x] 프로덕션에서 상세 에러 정보 제거
- [x] 스택 트레이스 제거
- [x] 데이터베이스 에러 메시지 일반화
- [x] 사용자 열거 방지 (동일한 에러 메시지)

### 로깅
- [x] 비밀번호 로깅 금지
- [x] 토큰 로깅 금지
- [x] 민감 정보 자동 제거
- [x] 로그에서 민감 필드 제거

### 응답
- [x] 불필요한 정보 제거
- [x] 내부 구조 노출 방지
- [x] 버전 정보 제거 (필요 시)

---

## 입력 검증 체크리스트

### 모든 입력 검증
- [x] 길이 검증
- [x] 형식 검증 (화이트리스트)
- [x] SQL Injection 패턴 검사
- [x] XSS 패턴 검사
- [x] 경로 탐색 방지
- [x] Null 바이트 제거
- [x] 제어 문자 검사

### 특수 입력
- [x] 파일 경로 검증
- [x] URL 검증
- [x] JSON 입력 검증
- [x] 숫자 범위 검증

---

## 인증/인가 체크리스트

### JWT 토큰
- [x] 모든 요청에서 토큰 검증
- [x] 토큰 만료 시간 검사
- [x] 서명 검증
- [x] 역할 검증

### 권한 검사
- [x] 엔드포인트별 권한 검사
- [x] 리소스 소유권 확인
- [x] 최소 권한 원칙 적용

---

## 보안 헤더

### 적용된 헤더
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: ...`
- `Strict-Transport-Security: ...`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 네트워크 레벨 보안과의 관계

> **중요**: IP/포트 차단은 네트워크 레벨(방화벽/IPS)에서 처리합니다.  
> 애플리케이션 레벨에서는 제로 트러스트 원칙에 따라 보안 코딩과 취약점 대비에 집중합니다.

### 네트워크 레벨 (방화벽/IPS)
- IP 기반 접근 제어
- 포트 필터링
- DDoS 방어
- 침입 탐지

### 애플리케이션 레벨 (제로 트러스트)
- 입력 검증
- 인증/인가
- 정보 노출 최소화
- 보안 코딩 관행

---

## 관련 문서

- [보안 강화 가이드](./hardening.md)
- [네트워크 레벨 보안](../../01-architecture/network-security.md)
- [운영 가이드](../operations-guide.md)

---

**태그**: `#제로-트러스트` `#보안-코딩` `#정보-노출-최소화` `#입력-검증`

**마지막 업데이트**: 2024-12-23





