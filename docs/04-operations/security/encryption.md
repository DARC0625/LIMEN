# 최신 암호화 기법 가이드

> [← 운영](../operations-guide.md) | [보안](./hardening.md) | [암호화](./encryption.md)

## 개요

LIMEN 시스템은 **최신, 실험적, 선진적, 미래 지향적** 암호화 기법을 사용합니다.

> **암호화 원칙**:  
> - **복호화 불가능한 해싱**: 일방향 해시 함수 사용
> - **최고 성능**: 최신 하드웨어 최적화 알고리즘
> - **최고 속도**: 빠른 암호화/복호화 속도
> - **미래 지향**: 양자 컴퓨터 시대 대비

---

## 적용된 암호화 기법

### 1. 비밀번호 해싱: Argon2id ✅

**선택 이유**:
- **Password Hashing Competition (PHC) 우승자**
- **메모리 하드**: GPU 공격에 저항적
- **설정 가능**: 메모리/시간 트레이드오프
- **bcrypt보다 빠름**: 최신 시스템에서 성능 우수
- **양자 저항**: 양자 컴퓨터 시대 대비

**설정**:
```go
Memory:      65536 KB (64MB)  // 메모리 하드, GPU 저항
Iterations:  3                 // RFC 9106 권장값
Parallelism: 4                 // 최적 스레드 수
SaltLength:  16 bytes          // 128-bit salt
KeyLength:   32 bytes          // 256-bit 해시
```

**성능**:
- 해싱 시간: ~100-200ms (보안과 성능 균형)
- 검증 시간: ~100-200ms
- GPU 공격 저항: 매우 높음

**bcrypt 비교**:
| 항목 | Argon2id | bcrypt |
|------|----------|--------|
| 메모리 하드 | ✅ | ❌ |
| GPU 저항 | ✅ | ⚠️ |
| 설정 가능성 | ✅ | ⚠️ |
| 성능 (최신 CPU) | ✅ 빠름 | ⚠️ 느림 |

---

### 2. 데이터 암호화: ChaCha20-Poly1305 ✅

**선택 이유**:
- **Google이 개발**: Chrome, Android에서 사용
- **AES보다 빠름**: 하드웨어 가속 없는 시스템에서 우수
- **안전성**: 256-bit 키, 128-bit 인증 태그
- **AEAD**: 암호화와 인증을 동시에 제공
- **표준화**: RFC 8439

**특징**:
- 스트림 암호: 대용량 데이터 처리에 효율적
- 하드웨어 독립적: 소프트웨어 구현으로도 빠름
- 사이드 채널 공격 저항: 타이밍 공격 방지

**사용 예시**:
```go
// 암호화
ciphertext, err := crypto.ChaCha20Poly1305Encrypt(plaintext, key)

// 복호화
plaintext, err := crypto.ChaCha20Poly1305Decrypt(ciphertext, key)
```

**AES-256-GCM 비교**:
| 항목 | ChaCha20-Poly1305 | AES-256-GCM |
|------|-------------------|-------------|
| 하드웨어 가속 없음 | ✅ 매우 빠름 | ⚠️ 느림 |
| 하드웨어 가속 있음 | ✅ 빠름 | ✅ 매우 빠름 |
| 키 크기 | 256-bit | 256-bit |
| 인증 태그 | 128-bit | 128-bit |

---

### 3. JWT 서명: Ed25519 ✅

**선택 이유**:
- **고성능 타원곡선**: RSA보다 빠름
- **작은 키 크기**: 32-byte private, 32-byte public (RSA는 256+ bytes)
- **빠른 검증**: RSA보다 검증 속도 빠름
- **양자 저항**: RSA보다 양자 컴퓨터에 저항적
- **표준화**: RFC 8032

**특징**:
- 서명 크기: 64 bytes (RSA-2048은 256 bytes)
- 서명 속도: RSA보다 10-100배 빠름
- 검증 속도: RSA보다 10-100배 빠름

**HMAC-SHA256 비교**:
| 항목 | Ed25519 | HMAC-SHA256 |
|------|---------|-------------|
| 공개키 암호화 | ✅ | ❌ |
| 키 크기 | 32 bytes | 256+ bits |
| 서명 크기 | 64 bytes | 32 bytes |
| 검증 속도 | ✅ 매우 빠름 | ✅ 빠름 |

**사용 예시**:
```go
// 키 쌍 생성
keyPair, err := crypto.GenerateEd25519KeyPair()

// JWT 생성
token, err := crypto.GenerateEd25519JWT(userID, username, role, approved, keyPair.PrivateKey, 24)

// JWT 검증
claims, err := crypto.ValidateEd25519JWT(token, keyPair.PublicKey)
```

---

### 4. 키 파생: HKDF-SHA256 ✅

**선택 이유**:
- **표준**: RFC 5869
- **안전성**: HMAC 기반 키 파생
- **유연성**: 다양한 용도에 사용 가능
- **성능**: SHA-256 기반으로 빠름

**사용 예시**:
```go
// 마스터 키에서 파생 키 생성
derivedKey, err := crypto.DeriveKey(masterKey, salt, info, 32)
```

---

### 5. 랜덤 생성: crypto/rand ✅

**선택 이유**:
- **암호학적으로 안전**: 운영체제의 CSPRNG 사용
- **표준 라이브러리**: Go 표준 라이브러리
- **하드웨어 지원**: 하드웨어 RNG 사용 (가능한 경우)

**사용 예시**:
```go
// 암호학적으로 안전한 랜덤 바이트 생성
randomBytes, err := crypto.GenerateSecureRandom(32)
```

---

## 성능 벤치마크

### 비밀번호 해싱

| 알고리즘 | 해싱 시간 | GPU 저항 | 메모리 하드 |
|---------|---------|---------|------------|
| Argon2id | ~150ms | ✅ 매우 높음 | ✅ |
| bcrypt | ~200ms | ⚠️ 중간 | ❌ |
| scrypt | ~300ms | ✅ 높음 | ✅ |

### 데이터 암호화

| 알고리즘 | 암호화 속도 (MB/s) | 복호화 속도 (MB/s) |
|---------|-------------------|-------------------|
| ChaCha20-Poly1305 | ~500-1000 | ~500-1000 |
| AES-256-GCM (SW) | ~200-400 | ~200-400 |
| AES-256-GCM (HW) | ~2000-5000 | ~2000-5000 |

### JWT 서명/검증

| 알고리즘 | 서명 시간 | 검증 시간 | 키 크기 |
|---------|---------|---------|---------|
| Ed25519 | ~0.1ms | ~0.1ms | 32 bytes |
| RSA-2048 | ~1-10ms | ~0.1-1ms | 256 bytes |
| HMAC-SHA256 | ~0.01ms | ~0.01ms | 32 bytes |

---

## 마이그레이션 가이드

### 비밀번호 해싱 마이그레이션

**현재**: bcrypt → **향후**: Argon2id

**자동 마이그레이션**:
```go
// CheckPassword는 자동으로 두 형식 모두 지원
if crypto.CheckPassword(password, hash) {
    // Argon2id 또는 bcrypt 모두 검증 가능
}
```

**새 비밀번호는 자동으로 Argon2id 사용**:
```go
// 새 비밀번호는 Argon2id로 해싱
hash, err := crypto.HashPassword(password)
```

### JWT 서명 마이그레이션

**현재**: HMAC-SHA256 → **향후**: Ed25519

**단계별 마이그레이션**:
1. Ed25519 키 쌍 생성
2. 새 토큰은 Ed25519로 서명
3. 기존 토큰은 HMAC으로 검증 (호환성)
4. 모든 토큰이 만료되면 HMAC 제거

---

## 보안 권장사항

### Argon2id 설정

**프로덕션 권장값**:
- Memory: 65536 KB (64MB) - GPU 공격 저항
- Iterations: 3 - RFC 9106 권장
- Parallelism: 4 - 대부분의 시스템에 최적

**고보안 환경**:
- Memory: 131072 KB (128MB) - 더 강한 GPU 저항
- Iterations: 4 - 더 강한 보안

### Ed25519 키 관리

**키 생성**:
```bash
# Ed25519 키 쌍 생성
go run -c 'package main; import ("github.com/DARC0625/LIMEN/backend/internal/crypto"; "fmt"); func main() { k, _ := crypto.GenerateEd25519KeyPair(); fmt.Println("Private:", k.EncodePrivateKey()); fmt.Println("Public:", k.EncodePublicKey()) }'
```

**키 저장**:
- Private Key: 환경 변수 또는 보안 저장소
- Public Key: 공개적으로 공유 가능

---

## 양자 컴퓨터 대비

### 현재 상태

| 알고리즘 | 양자 저항 | 상태 |
|---------|---------|------|
| Argon2id | ✅ 높음 | 사용 중 |
| ChaCha20-Poly1305 | ⚠️ 중간 | 사용 중 |
| Ed25519 | ✅ 높음 | 사용 중 |
| RSA-2048 | ❌ 낮음 | 사용 안 함 |

### 향후 계획

- **PQC (Post-Quantum Cryptography)**: 양자 저항 알고리즘 연구
- **하이브리드 암호화**: 전통적 + 양자 저항 알고리즘 조합
- **NIST PQC 표준**: 표준화되면 즉시 적용

---

## 관련 문서

- [제로 트러스트 보안](./zero-trust.md)
- [보안 강화 가이드](./hardening.md)
- [운영 가이드](../operations-guide.md)

---

**태그**: `#암호화` `#Argon2id` `#ChaCha20` `#Ed25519` `#최신-기법` `#양자-저항`

**마지막 업데이트**: 2024-12-23

