# LIMEN 서비스 보안 강화 계획

**작성일**: 2025-01-14  
**버전**: 1.0  
**상태**: 실행 계획

---

## 📋 목차

1. [현재 보안 상태 분석](#현재-보안-상태-분석)
2. [인증 및 인가 강화](#인증-및-인가-강화)
3. [입력 검증 강화](#입력-검증-강화)
4. [네트워크 보안](#네트워크-보안)
5. [데이터 보안](#데이터-보안)
6. [로깅 및 모니터링](#로깅-및-모니터링)
7. [컴플라이언스](#컴플라이언스)

---

## 현재 보안 상태 분석

### 현재 구현된 보안 기능

#### ✅ 구현 완료
1. **JWT 기반 인증**
   - 토큰 기반 인증
   - 만료 시간 관리
   - 토큰 검증 미들웨어

2. **역할 기반 접근 제어 (RBAC)**
   - Admin/User 역할 분리
   - 승인 시스템
   - 토큰 Claims에 역할 포함

3. **입력 검증**
   - 서버 사이드 검증
   - SQL Injection 방지 (GORM)
   - XSS 방지 (React 자동 이스케이프)

4. **리소스 제한**
   - 사용자별 할당량 관리
   - VM/CPU/Memory 제한

### ⚠️ 개선 필요 영역

1. **토큰 관리**
   - Refresh Token 미구현
   - 토큰 저장 방식 개선 필요

2. **보안 헤더**
   - CSP 미완전 구현
   - 보안 헤더 부족

3. **Rate Limiting**
   - 기본 Rate Limiting만 구현
   - 세분화된 제한 필요

4. **로깅**
   - 보안 이벤트 로깅 부족
   - 감사 로그 미구현

---

## 인증 및 인가 강화

### 1. JWT 토큰 개선

#### 현재 상태
- Access Token만 사용
- 토큰 갱신 메커니즘 없음
- 토큰 저장: LocalStorage (보안 취약)

#### 실행 계획

##### 1.1 Refresh Token 도입
```go
// internal/auth/auth.go
type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int    `json:"expires_in"`
}

func GenerateTokenPair(userID string, role string) (*TokenPair, error) {
    // Access Token (단기: 15분)
    accessToken, err := generateAccessToken(userID, role, 15*time.Minute)
    if err != nil {
        return nil, err
    }
    
    // Refresh Token (장기: 7일)
    refreshToken, err := generateRefreshToken(userID, 7*24*time.Hour)
    if err != nil {
        return nil, err
    }
    
    // Refresh Token을 데이터베이스에 저장
    if err := saveRefreshToken(userID, refreshToken); err != nil {
        return nil, err
    }
    
    return &TokenPair{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        ExpiresIn:    900, // 15분
    }, nil
}
```

##### 1.2 Refresh Token 엔드포인트
```go
// internal/handlers/auth.go
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
    var req struct {
        RefreshToken string `json:"refresh_token"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }
    
    // Refresh Token 검증
    claims, err := validateRefreshToken(req.RefreshToken)
    if err != nil {
        http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
        return
    }
    
    // 새로운 Access Token 발급
    tokenPair, err := GenerateTokenPair(claims.UserID, claims.Role)
    if err != nil {
        http.Error(w, "Token generation failed", http.StatusInternalServerError)
        return
    }
    
    json.NewEncoder(w).Encode(tokenPair)
}
```

##### 1.3 토큰 저장 보안 강화
```typescript
// frontend/lib/auth.ts
// Before: LocalStorage
localStorage.setItem('token', token);

// After: HttpOnly Cookie
// 백엔드에서 Set-Cookie 헤더로 설정
// 프론트엔드에서는 직접 접근 불가
```

```go
// 백엔드에서 HttpOnly Cookie 설정
func setAuthCookie(w http.ResponseWriter, token string) {
    http.SetCookie(w, &http.Cookie{
        Name:     "access_token",
        Value:    token,
        HttpOnly: true,
        Secure:   true, // HTTPS만
        SameSite: http.SameSiteStrictMode,
        MaxAge:   900, // 15분
        Path:     "/",
    })
}
```

**예상 효과**:
- XSS 공격으로부터 토큰 보호
- 토큰 탈취 위험 감소

### 2. 다중 인증 (MFA)

#### 실행 계획

##### 2.1 TOTP 지원
```go
// internal/auth/mfa.go
import "github.com/pquerna/otp"
import "github.com/pquerna/otp/totp"

func GenerateTOTPSecret(userID string) (string, error) {
    key, err := totp.Generate(totp.GenerateOpts{
        Issuer:      "LIMEN",
        AccountName: userID,
    })
    if err != nil {
        return "", err
    }
    
    // Secret을 데이터베이스에 저장
    saveTOTPSecret(userID, key.Secret())
    
    return key.URL(), nil
}

func ValidateTOTP(userID string, token string) bool {
    secret := getTOTPSecret(userID)
    return totp.Validate(token, secret)
}
```

##### 2.2 MFA 활성화 엔드포인트
```go
// POST /api/auth/mfa/enable
func (h *AuthHandler) EnableMFA(w http.ResponseWriter, r *http.Request) {
    userID := getUserIDFromContext(r.Context())
    
    qrCodeURL, err := GenerateTOTPSecret(userID)
    if err != nil {
        http.Error(w, "Failed to generate MFA", http.StatusInternalServerError)
        return
    }
    
    json.NewEncoder(w).Encode(map[string]string{
        "qr_code_url": qrCodeURL,
    })
}
```

##### 2.3 로그인 시 MFA 검증
```go
// POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    // ... 기존 인증 로직 ...
    
    // MFA 활성화 여부 확인
    if user.MFAEnabled {
        // MFA 토큰 요청
        json.NewEncoder(w).Encode(map[string]interface{}{
            "requires_mfa": true,
            "message":      "MFA token required",
        })
        return
    }
    
    // 일반 토큰 발급
    tokenPair, _ := GenerateTokenPair(user.ID, user.Role)
    json.NewEncoder(w).Encode(tokenPair)
}
```

**예상 효과**:
- 계정 보안 강화
- 무단 접근 방지

### 3. 세션 관리 개선

#### 실행 계획

##### 3.1 세션 타임아웃
```go
// 세션 타임아웃 설정
const (
    SessionTimeout     = 15 * time.Minute
    RefreshTokenExpiry = 7 * 24 * time.Hour
)
```

##### 3.2 동시 세션 제한
```go
// 사용자당 최대 세션 수 제한
const MaxSessionsPerUser = 5

func createSession(userID string) error {
    sessions := getActiveSessions(userID)
    if len(sessions) >= MaxSessionsPerUser {
        // 가장 오래된 세션 제거
        removeOldestSession(userID)
    }
    
    return createNewSession(userID)
}
```

##### 3.3 세션 무효화
```go
// 로그아웃 시 모든 세션 무효화
func (h *AuthHandler) LogoutAll(w http.ResponseWriter, r *http.Request) {
    userID := getUserIDFromContext(r.Context())
    
    // 모든 Refresh Token 삭제
    deleteAllRefreshTokens(userID)
    
    // 쿠키 삭제
    http.SetCookie(w, &http.Cookie{
        Name:     "access_token",
        Value:    "",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteStrictMode,
        MaxAge:   -1,
        Path:     "/",
    })
    
    w.WriteHeader(http.StatusOK)
}
```

---

## 입력 검증 강화

### 1. 프론트엔드 검증

#### 실행 계획

##### 1.1 Zod 스키마 정의
```typescript
// frontend/lib/validation.ts
import { z } from 'zod';

export const VMCreateSchema = z.object({
  name: z.string()
    .min(1, '이름은 필수입니다')
    .max(100, '이름은 100자 이하여야 합니다')
    .regex(/^[a-zA-Z0-9_-]+$/, '영문, 숫자, _, - 만 사용 가능합니다'),
  cpu: z.number()
    .int('CPU는 정수여야 합니다')
    .min(1, 'CPU는 최소 1개 이상이어야 합니다')
    .max(32, 'CPU는 최대 32개까지 가능합니다'),
  memory: z.number()
    .int('메모리는 정수여야 합니다')
    .min(512, '메모리는 최소 512MB 이상이어야 합니다')
    .max(65536, '메모리는 최대 65536MB까지 가능합니다'),
  disk: z.number()
    .int('디스크는 정수여야 합니다')
    .min(10, '디스크는 최소 10GB 이상이어야 합니다')
    .max(1000, '디스크는 최대 1000GB까지 가능합니다'),
});

export type VMCreateInput = z.infer<typeof VMCreateSchema>;
```

##### 1.2 폼 검증 통합
```typescript
// components/VMCreateForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { VMCreateSchema, VMCreateInput } from '@/lib/validation';

export function VMCreateForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VMCreateInput>({
    resolver: zodResolver(VMCreateSchema),
  });
  
  // ...
}
```

### 2. 백엔드 검증

#### 실행 계획

##### 2.1 입력 검증 미들웨어
```go
// internal/middleware/validation.go
func ValidateRequest(schema interface{}) middleware.Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            var req interface{}
            if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                http.Error(w, "Invalid request body", http.StatusBadRequest)
                return
            }
            
            if err := validateStruct(req, schema); err != nil {
                http.Error(w, err.Error(), http.StatusBadRequest)
                return
            }
            
            // 검증된 요청을 컨텍스트에 저장
            ctx := context.WithValue(r.Context(), "validated_request", req)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

##### 2.2 SQL Injection 방지
```go
// GORM 사용으로 자동 방지
// 추가 검증: 파라미터화된 쿼리 사용
db.Where("user_id = ?", userID).Find(&vms)

// 위험: 직접 문자열 삽입 금지
// db.Where("user_id = " + userID) // 절대 사용 금지
```

##### 2.3 XSS 방지
```go
// HTML 이스케이프
import "html"

func sanitizeInput(input string) string {
    return html.EscapeString(input)
}

// JSON 응답 시 자동 이스케이프 (기본 동작)
json.NewEncoder(w).Encode(data)
```

### 3. Rate Limiting 세분화

#### 실행 계획

##### 3.1 엔드포인트별 Rate Limiting
```go
// internal/middleware/ratelimit.go
type RateLimitConfig struct {
    RequestsPerMinute int
    Burst             int
}

var rateLimitConfigs = map[string]RateLimitConfig{
    "/api/auth/login": {
        RequestsPerMinute: 5,  // 로그인: 5회/분
        Burst:             2,
    },
    "/api/vms": {
        RequestsPerMinute: 60, // 일반 API: 60회/분
        Burst:             10,
    },
    "/api/vms/:id/start": {
        RequestsPerMinute: 10, // VM 시작: 10회/분
        Burst:             3,
    },
}

func RateLimitMiddleware() middleware.Middleware {
    limiters := make(map[string]*rate.Limiter)
    
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            path := r.URL.Path
            config, exists := rateLimitConfigs[path]
            if !exists {
                config = rateLimitConfigs["default"]
            }
            
            limiter, exists := limiters[path]
            if !exists {
                limiter = rate.NewLimiter(
                    rate.Limit(config.RequestsPerMinute/60.0),
                    config.Burst,
                )
                limiters[path] = limiter
            }
            
            if !limiter.Allow() {
                http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
                return
            }
            
            next.ServeHTTP(w, r)
        })
    }
}
```

##### 3.2 IP 기반 Rate Limiting
```go
// IP별 Rate Limiting
func IPRateLimitMiddleware() middleware.Middleware {
    limiters := make(map[string]*rate.Limiter)
    mu := sync.RWMutex{}
    
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := getClientIP(r)
            
            mu.RLock()
            limiter, exists := limiters[ip]
            mu.RUnlock()
            
            if !exists {
                mu.Lock()
                limiter = rate.NewLimiter(rate.Limit(100/60.0), 10)
                limiters[ip] = limiter
                mu.Unlock()
            }
            
            if !limiter.Allow() {
                http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
                return
            }
            
            next.ServeHTTP(w, r)
        })
    }
}
```

---

## 네트워크 보안

### 1. 보안 헤더

#### 실행 계획

##### 1.1 보안 헤더 미들웨어
```go
// internal/middleware/security.go
func SecurityHeadersMiddleware() middleware.Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // X-Content-Type-Options
            w.Header().Set("X-Content-Type-Options", "nosniff")
            
            // X-Frame-Options
            w.Header().Set("X-Frame-Options", "DENY")
            
            // X-XSS-Protection
            w.Header().Set("X-XSS-Protection", "1; mode=block")
            
            // Strict-Transport-Security (HSTS)
            w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
            
            // Content-Security-Policy
            csp := strings.Join([]string{
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // noVNC 필요
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self' ws: wss:",
                "frame-src 'self'",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "upgrade-insecure-requests",
            }, "; ")
            w.Header().Set("Content-Security-Policy", csp)
            
            // Referrer-Policy
            w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
            
            // Permissions-Policy
            w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
            
            next.ServeHTTP(w, r)
        })
    }
}
```

##### 1.2 CORS 정책 최적화
```go
// internal/middleware/cors.go
func CORSMiddleware() middleware.Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            origin := r.Header.Get("Origin")
            
            // 허용된 Origin 확인
            allowedOrigins := []string{
                "https://limen.example.com",
                "https://app.limen.example.com",
            }
            
            allowed := false
            for _, allowedOrigin := range allowedOrigins {
                if origin == allowedOrigin {
                    allowed = true
                    break
                }
            }
            
            if allowed {
                w.Header().Set("Access-Control-Allow-Origin", origin)
                w.Header().Set("Access-Control-Allow-Credentials", "true")
                w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
                w.Header().Set("Access-Control-Max-Age", "3600")
            }
            
            if r.Method == "OPTIONS" {
                w.WriteHeader(http.StatusOK)
                return
            }
            
            next.ServeHTTP(w, r)
        })
    }
}
```

### 2. TLS/SSL 강화

#### 실행 계획

##### 2.1 TLS 설정 최적화
```go
// TLS 설정
tlsConfig := &tls.Config{
    MinVersion:               tls.VersionTLS13, // TLS 1.3 최소
    PreferServerCipherSuites: true,
    CipherSuites: []uint16{
        tls.TLS_AES_128_GCM_SHA256,
        tls.TLS_AES_256_GCM_SHA384,
        tls.TLS_CHACHA20_POLY1305_SHA256,
    },
    CurvePreferences: []tls.CurveID{
        tls.CurveP256,
        tls.CurveP384,
        tls.X25519,
    },
}
```

##### 2.2 인증서 관리
- Let's Encrypt 자동 갱신
- 인증서 만료 모니터링
- 인증서 체인 검증

---

## 데이터 보안

### 1. 암호화

#### 실행 계획

##### 1.1 민감 데이터 암호화
```go
// internal/crypto/encryption.go
// 이미 구현된 Argon2id 활용
// 추가: 데이터베이스 필드 암호화

func EncryptField(data string) (string, error) {
    key := getEncryptionKey()
    block, err := aes.NewCipher(key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, []byte(data), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}
```

##### 1.2 전송 중 암호화
- HTTPS 강제
- TLS 1.3 사용
- Perfect Forward Secrecy

### 2. 데이터 마스킹

#### 실행 계획

##### 2.1 로그에서 민감 정보 마스킹
```go
// internal/logger/logger.go
func maskSensitiveData(data interface{}) interface{} {
    // JWT 토큰 마스킹
    if str, ok := data.(string); ok {
        if strings.HasPrefix(str, "eyJ") {
            return str[:20] + "..."
        }
    }
    
    // 비밀번호 마스킹
    if m, ok := data.(map[string]interface{}); ok {
        if password, exists := m["password"]; exists {
            m["password"] = "***"
        }
    }
    
    return data
}
```

---

## 로깅 및 모니터링

### 1. 보안 이벤트 로깅

#### 실행 계획

##### 1.1 보안 이벤트 정의
```go
// internal/security/events.go
type SecurityEvent struct {
    Type      string    `json:"type"`
    UserID    string    `json:"user_id"`
    IP        string    `json:"ip"`
    UserAgent string    `json:"user_agent"`
    Timestamp time.Time `json:"timestamp"`
    Details   map[string]interface{} `json:"details"`
}

const (
    EventTypeLoginSuccess     = "login_success"
    EventTypeLoginFailure     = "login_failure"
    EventTypeTokenRefresh     = "token_refresh"
    EventTypeUnauthorized     = "unauthorized_access"
    EventTypeRateLimitExceeded = "rate_limit_exceeded"
    EventTypeSuspiciousActivity = "suspicious_activity"
)
```

##### 1.2 보안 이벤트 로깅
```go
// internal/security/logger.go
func LogSecurityEvent(event SecurityEvent) {
    logger.Log.Warn("Security event",
        zap.String("type", event.Type),
        zap.String("user_id", event.UserID),
        zap.String("ip", event.IP),
        zap.String("user_agent", event.UserAgent),
        zap.Time("timestamp", event.Timestamp),
        zap.Any("details", event.Details),
    )
    
    // 별도 보안 로그 파일에 기록
    securityLogFile.Write(event)
}
```

### 2. 침입 탐지

#### 실행 계획

##### 2.1 의심스러운 활동 탐지
```go
// internal/security/detection.go
func DetectSuspiciousActivity(userID string, ip string) bool {
    // 짧은 시간 내 다수의 실패한 로그인 시도
    failedAttempts := getFailedLoginAttempts(userID, ip, 5*time.Minute)
    if failedAttempts > 5 {
        LogSecurityEvent(SecurityEvent{
            Type:   EventTypeSuspiciousActivity,
            UserID: userID,
            IP:     ip,
            Details: map[string]interface{}{
                "reason": "multiple_failed_logins",
                "count":  failedAttempts,
            },
        })
        return true
    }
    
    // 비정상적인 IP에서의 접근
    if isUnusualIP(userID, ip) {
        LogSecurityEvent(SecurityEvent{
            Type:   EventTypeSuspiciousActivity,
            UserID: userID,
            IP:     ip,
            Details: map[string]interface{}{
                "reason": "unusual_ip",
            },
        })
        return true
    }
    
    return false
}
```

##### 2.2 자동 차단
```go
// 의심스러운 활동 감지 시 자동 차단
func HandleSuspiciousActivity(userID string, ip string) {
    // IP 차단
    blockIP(ip, 1*time.Hour)
    
    // 사용자 계정 일시 정지
    suspendUser(userID, 1*time.Hour)
    
    // 관리자에게 알림
    notifyAdmin(userID, ip)
}
```

---

## 컴플라이언스

### 1. GDPR 준수 (필요 시)

#### 실행 계획

##### 1.1 데이터 보호
- 사용자 데이터 암호화
- 데이터 보존 정책
- 데이터 삭제 요청 처리

##### 1.2 개인정보 처리 방침
- 개인정보 수집 목적 명시
- 사용자 동의 관리
- 데이터 접근 권한 관리

### 2. 보안 감사

#### 실행 계획

##### 2.1 정기 보안 감사
- 분기별 보안 감사
- 취약점 스캔
- 침투 테스트 (선택사항)

##### 2.2 보안 체크리스트
- [ ] 모든 엔드포인트 인증 확인
- [ ] 입력 검증 확인
- [ ] SQL Injection 방지 확인
- [ ] XSS 방지 확인
- [ ] CSRF 방지 확인
- [ ] 보안 헤더 확인
- [ ] Rate Limiting 확인
- [ ] 로깅 확인

---

## 실행 일정

### Week 1-2: 인증 및 인가 강화
- [ ] Refresh Token 구현
- [ ] HttpOnly Cookie 적용
- [ ] MFA 기본 구조

### Week 3-4: 입력 검증 및 Rate Limiting
- [ ] Zod 스키마 정의
- [ ] Rate Limiting 세분화
- [ ] 입력 검증 강화

### Week 5-6: 네트워크 보안 및 로깅
- [ ] 보안 헤더 추가
- [ ] 보안 이벤트 로깅
- [ ] 침입 탐지

---

## 성공 지표

### 보안 지표
- **보안 취약점**: 0 (중요/치명적)
- **인증 실패율**: 모니터링
- **비정상 접근 시도**: 로깅 및 알림
- **보안 이벤트 응답 시간**: < 1분

---

**작성자**: AI Assistant  
**검토 필요**: 보안팀 리뷰  
**업데이트 주기**: 월 1회 또는 보안 이슈 발생 시

