# 보안 체인 (Security Chain) 가이드

> [← 운영](../operations-guide.md) | [보안](./hardening.md) | [보안 체인](./security-chain.md)

## 개요

LIMEN 시스템은 **보안 체인(Security Chain)** 원칙을 기반으로 설계되었습니다.

> **약한 사슬 원칙 (Weakest Link Principle)**:  
> 보안은 가장 약한 구성 요소만큼만 강합니다.  
> 하드웨어, 소프트웨어, 네트워크, 사용자 - **하나라도 약하면 전체 보안이 무너집니다.**

---

## 보안 체인 구성 요소

### 1. 하드웨어 보안 🔧

**역할**: 물리적 보안 및 하드웨어 레벨 보안 기능

**구성 요소**:
- ✅ TPM (Trusted Platform Module)
- ✅ Secure Boot (UEFI Secure Boot)
- ✅ AES-NI (하드웨어 암호화 가속)
- ✅ 하드웨어 RNG (RDRAND/RDSEED)
- ✅ SMEP/SMAP (커널 보안)
- ✅ Intel TXT (신뢰 실행 기술)

**약한 링크 예시**:
- ❌ TPM 없음 → 하드웨어 기반 키 저장 불가
- ❌ Secure Boot 비활성화 → 부팅 시 악성 코드 주입 가능
- ❌ 하드웨어 RNG 없음 → 소프트웨어 RNG 의존 (느림)

---

### 2. 소프트웨어 보안 💻

**역할**: 애플리케이션 레벨 보안 및 코드 보안

**구성 요소**:
- ✅ 제로 트러스트 원칙
- ✅ 최신 암호화 (Argon2id, ChaCha20, Ed25519)
- ✅ 입력 검증 및 Sanitization
- ✅ 에러 처리 (정보 노출 최소화)
- ✅ 보안 헤더
- ✅ Rate Limiting
- ✅ 의존성 취약점 스캔
- ✅ 코드 품질 검사

**약한 링크 예시**:
- ❌ 입력 검증 누락 → SQL Injection, XSS 공격 가능
- ❌ 에러 메시지 노출 → 시스템 정보 유출
- ❌ 취약한 의존성 → 알려진 취약점 악용 가능

---

### 3. 네트워크 보안 🌐

**역할**: 네트워크 레벨 보안 및 트래픽 보호

**구성 요소**:
- ⏳ 방화벽 (향후 구현)
- ⏳ IPS/IDS (향후 구현)
- ✅ Rate Limiting (애플리케이션 레벨)
- ✅ CORS 제한
- ✅ HTTPS (리버스 프록시)
- ⏳ DNSSEC (향후 구현)

**약한 링크 예시**:
- ❌ 방화벽 없음 → 네트워크 레벨 공격 가능
- ❌ HTTPS 없음 → 트래픽 가로채기 가능
- ❌ CORS 설정 오류 → CSRF 공격 가능

---

### 4. 사용자 보안 👤

**역할**: 사람 요소 - 종종 가장 약한 링크

**구성 요소**:
- ✅ 강력한 비밀번호 정책
- ⏳ MFA (Multi-Factor Authentication) - 향후 구현
- ✅ 세션 관리 (JWT)
- ✅ 접근 제어 (RBAC)
- ✅ 감사 로깅
- ⚠️ 사용자 교육 (정책 기반)
- ⏳ 행동 모니터링 (향후 구현)

**약한 링크 예시**:
- ❌ 약한 비밀번호 → 무차별 대입 공격 성공 가능
- ❌ MFA 없음 → 비밀번호 유출 시 계정 탈취
- ❌ 사용자 교육 부족 → 피싱, 소셜 엔지니어링 공격
- ❌ 행동 모니터링 없음 → 이상 행동 감지 불가

---

## 보안 체인 검증

### 자동 검증

시스템은 다음을 자동으로 검증합니다:

1. **하드웨어 보안**: TPM, Secure Boot, 하드웨어 가속 등
2. **소프트웨어 보안**: 제로 트러스트, 암호화, 입력 검증 등
3. **네트워크 보안**: 방화벽, HTTPS, CORS 등
4. **사용자 보안**: 비밀번호 정책, MFA, 감사 로깅 등

### 검증 주기

- **시작 시**: 서버 시작 시 전체 체인 검증
- **주기적**: 10분마다 자동 재검증
- **변경 시**: 하드웨어/설정 변경 시 즉시 재검증

---

## 약한 링크 감지

### 자동 감지

시스템은 다음을 자동으로 감지합니다:

- **Critical**: 보안 체인을 완전히 무너뜨릴 수 있는 약한 링크
- **High**: 심각한 보안 취약점
- **Medium**: 보안 개선이 필요한 부분
- **Low**: 사소한 보안 이슈

### 약한 링크 예시

```json
{
  "component": "hardware",
  "severity": "critical",
  "issue": "TPM not available",
  "impact": "Hardware-backed security features unavailable",
  "recommendation": "Enable TPM for hardware-backed key storage"
}
```

---

## 보안 체인 상태

### Status: Strong ✅

모든 구성 요소가 강력하고 약한 링크가 없음

**조건**:
- 하드웨어 보안: Strong
- 소프트웨어 보안: Strong
- 네트워크 보안: Strong
- 사용자 보안: Strong

### Status: Moderate ⚠️

일부 구성 요소에 개선이 필요하지만 치명적이지 않음

**조건**:
- 일부 구성 요소가 Moderate
- 약한 링크가 있지만 Critical이 아님

### Status: Weak ❌

치명적인 약한 링크가 존재 - 즉시 조치 필요

**조건**:
- 하나 이상의 구성 요소가 Weak
- Critical 약한 링크 존재

---

## 보안 체인 강화 전략

### 하드웨어 보안 강화

1. **TPM 활성화**
   ```bash
   # TPM 확인
   ls -la /dev/tpm*
   
   # TPM 사용 가능 시 하드웨어 키 저장 활용
   ```

2. **Secure Boot 활성화**
   ```bash
   # UEFI 설정에서 Secure Boot 활성화
   # 부팅 시 악성 코드 주입 방지
   ```

3. **하드웨어 가속 활용**
   - AES-NI: 자동 감지 및 활용
   - 하드웨어 RNG: 자동 사용

### 소프트웨어 보안 강화

1. **제로 트러스트 원칙 준수**
   - 모든 입력 검증
   - 최소 정보 노출
   - 항상 검증

2. **최신 암호화 사용**
   - Argon2id: 비밀번호 해싱
   - ChaCha20-Poly1305: 데이터 암호화
   - Ed25519: JWT 서명

3. **의존성 취약점 관리**
   - CI/CD에서 자동 스캔
   - 정기적 업데이트

### 네트워크 보안 강화

1. **방화벽/IPS 구현** (향후)
   - 스위치 도입
   - 스노트 기반 IPS

2. **HTTPS 강제**
   - 리버스 프록시에서 HTTPS 설정
   - HSTS 활성화

3. **CORS 제한**
   - 허용된 오리진만 설정
   - 프로덕션에서 `*` 사용 금지

### 사용자 보안 강화

1. **강력한 비밀번호 정책**
   - 최소 12자
   - 대소문자, 숫자, 특수문자 필수
   - 일반적인 약한 비밀번호 차단

2. **MFA 구현** (향후)
   - TOTP 기반 2단계 인증
   - 하드웨어 토큰 지원

3. **사용자 교육**
   - 보안 정책 문서화
   - 정기적 보안 교육
   - 피싱 방지 가이드

4. **행동 모니터링** (향후)
   - 이상 로그인 패턴 감지
   - 권한 상승 시도 감지
   - 비정상적인 접근 패턴 감지

---

## 보안 체인 모니터링

### API 엔드포인트

#### GET /api/security/chain
전체 보안 체인 상태 조회

**응답 예시**:
```json
{
  "hardware": {
    "status": "moderate",
    "tpm": false,
    "secure_boot": false,
    "aes_accel": true,
    "hardware_rng": true,
    "issues": ["TPM not available", "Secure Boot not enabled"]
  },
  "software": {
    "status": "strong",
    "zero_trust": true,
    "encryption": true,
    "input_validation": true
  },
  "network": {
    "status": "moderate",
    "firewall": false,
    "ips": false,
    "rate_limiting": true,
    "cors": true,
    "issues": ["Network-level firewall not implemented"]
  },
  "user": {
    "status": "moderate",
    "strong_passwords": true,
    "mfa": false,
    "session_management": true,
    "issues": ["MFA not implemented"]
  },
  "overall": "moderate",
  "weak_links": [...]
}
```

#### GET /api/security/chain/report
보안 체인 리포트 (텍스트 형식)

#### GET /api/security/weakest-link
가장 약한 링크 조회

---

## 보안 체인 체크리스트

### 하드웨어 보안
- [ ] TPM 활성화 및 사용
- [ ] Secure Boot 활성화
- [ ] AES-NI 사용 가능
- [ ] 하드웨어 RNG 사용 가능
- [ ] SMEP/SMAP 활성화

### 소프트웨어 보안
- [x] 제로 트러스트 원칙 적용
- [x] 최신 암호화 사용
- [x] 입력 검증 강화
- [x] 에러 처리 최적화
- [x] 보안 헤더 적용
- [x] Rate Limiting 구현
- [x] 의존성 취약점 스캔

### 네트워크 보안
- [ ] 방화벽 구현 (향후)
- [ ] IPS 구현 (향후)
- [x] Rate Limiting (애플리케이션 레벨)
- [x] CORS 제한
- [ ] HTTPS 강제 (리버스 프록시 설정 필요)

### 사용자 보안
- [x] 강력한 비밀번호 정책
- [ ] MFA 구현 (향후)
- [x] 세션 관리
- [x] 접근 제어
- [x] 감사 로깅
- [ ] 사용자 교육 자료
- [ ] 행동 모니터링 (향후)

---

## 약한 링크 우선순위

### Critical (즉시 조치)

1. **하드웨어 보안 약함**
   - TPM 없음
   - Secure Boot 비활성화

2. **소프트웨어 보안 약함**
   - 입력 검증 누락
   - 취약한 암호화

3. **네트워크 보안 약함**
   - 방화벽 없음
   - HTTPS 없음

4. **사용자 보안 약함**
   - 약한 비밀번호 정책
   - MFA 없음

### High (우선 조치)

1. 하드웨어 가속 미활용
2. 보안 헤더 미적용
3. CORS 설정 오류
4. 감사 로깅 부족

### Medium (개선 권장)

1. 사용자 교육 부족
2. 행동 모니터링 없음
3. DNSSEC 미구현

---

## 보안 체인 강화 로드맵

### Phase 1: 현재 상태 ✅
- 하드웨어 스펙 감지
- 소프트웨어 보안 강화
- 네트워크 보안 (애플리케이션 레벨)
- 사용자 보안 (기본)

### Phase 2: 네트워크 보안 강화 (향후)
- 스위치 도입
- 스노트 기반 IPS
- 네트워크 레벨 방화벽

### Phase 3: 사용자 보안 강화 (향후)
- MFA 구현
- 행동 모니터링
- 사용자 교육 시스템

### Phase 4: 하드웨어 보안 강화 (향후)
- TPM 활용
- Secure Boot 활성화
- 하드웨어 기반 키 저장

---

## 관련 문서

- [하드웨어 보안](./hardware-security.md)
- [제로 트러스트 보안](./zero-trust.md)
- [암호화 기법](./encryption.md)
- [보안 강화 가이드](./hardening.md)

---

**태그**: `#보안-체인` `#약한-사슬` `#종합-보안` `#하드웨어-보안` `#사용자-보안`

**마지막 업데이트**: 2024-12-23











