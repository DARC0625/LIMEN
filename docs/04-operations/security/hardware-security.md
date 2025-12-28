# 하드웨어 기반 보안 최적화

> [← 운영](../operations-guide.md) | [보안](./hardening.md) | [하드웨어 보안](./hardware-security.md)

## 개요

LIMEN 시스템은 **서버 하드웨어 스펙을 자동으로 감지**하고, 이를 바탕으로 **최적의 보안 설정을 자동으로 적용**합니다.

> **하드웨어 기반 보안 원칙**:  
> - 하드웨어 스펙을 세밀하게 파악
> - 하드웨어 보안 기능 활용
> - 스펙 변경 시 자동 재최적화
> - 하드웨어 레벨 보안까지 고려

---

## 하드웨어 스펙 수집

### 자동 감지 항목

#### CPU 정보
- 모델명 및 벤더
- 코어 수 및 스레드 수
- 클럭 속도
- 캐시 크기 (L1, L2, L3)
- CPU 플래그 (보안 기능 포함)

#### 보안 기능 감지
- **AES-NI**: 하드웨어 AES 암호화 가속
- **AVX/AVX2**: 벡터 연산 가속
- **SHA-NI**: 하드웨어 SHA 해싱 가속
- **RDRAND/RDSEED**: 하드웨어 랜덤 생성기
- **SMEP/SMAP**: 커널 보안 기능
- **Intel TXT**: 신뢰 실행 기술

#### 메모리 정보
- 총 메모리 용량
- 사용 가능한 메모리
- 스왑 메모리

#### 디스크 정보
- 디스크 크기 및 타입
- 파일시스템
- 마운트 포인트

#### 네트워크 정보
- 네트워크 인터페이스
- IP 주소
- MAC 주소

#### 시스템 보안 기능
- **TPM**: Trusted Platform Module
- **Secure Boot**: UEFI Secure Boot
- **SELinux/AppArmor**: 강제 접근 제어
- **ASLR**: Address Space Layout Randomization

---

## 하드웨어 기반 보안 최적화

### 1. Argon2id 최적화

**메모리 설정**:
- 사용 가능한 메모리의 25% 이하 사용
- 최소 8MB, 최대 64MB
- 하드웨어에 따라 자동 조정

**예시**:
```go
// 고메모리 시스템 (192GB RAM)
Memory: 65536 KB (64MB)  // 최대 설정

// 중간 메모리 시스템 (16GB RAM)
Memory: 32768 KB (32MB)  // 중간 설정

// 저메모리 시스템 (4GB RAM)
Memory: 8192 KB (8MB)    // 최소 설정
```

**병렬성 설정**:
- CPU 코어 수에 따라 자동 조정
- 최대 4 스레드 (Argon2id 최적값)

**반복 횟수**:
- CPU 성능에 따라 조정
- 고성능 CPU: 3회 (기본값)
- 저성능 CPU: 2회

### 2. 암호화 알고리즘 선택

**AES 하드웨어 가속 있음**:
- 알고리즘: **AES-256-GCM**
- 하드웨어 가속: 활성화
- 성능: 매우 빠름

**AES 하드웨어 가속 없음**:
- 알고리즘: **ChaCha20-Poly1305**
- 하드웨어 가속: 비활성화
- 성능: 빠름 (소프트웨어 구현)

### 3. 하드웨어 RNG 사용

**RDRAND/RDSEED 사용 가능**:
- 하드웨어 랜덤 생성기 사용
- 더 빠르고 안전한 랜덤 생성

**하드웨어 RNG 없음**:
- 소프트웨어 RNG 사용 (`crypto/rand`)
- 여전히 암호학적으로 안전

---

## 스펙 변경 감지

### 자동 모니터링

**모니터링 주기**: 5분마다 자동 확인

**변경 감지**:
- CPU 변경 감지
- 메모리 변경 감지
- 디스크 변경 감지
- 네트워크 변경 감지

**자동 조치**:
- 하드웨어 스펙 재수집
- 보안 설정 재최적화
- 변경 사항 로깅

---

## 현재 서버 스펙 (예시)

### 감지된 하드웨어

```json
{
  "hostname": "server01",
  "architecture": "x86_64",
  "cpu": {
    "model": "13th Gen Intel(R) Core(TM) i9-13900K",
    "cores": 16,
    "threads": 32,
    "frequency_mhz": 2995.199,
    "has_aes": true,
    "has_avx2": true,
    "has_sha": true,
    "has_rdrand": true,
    "has_rdseed": true,
    "has_smep": true,
    "has_smap": true
  },
  "memory": {
    "total_gb": 192.0,
    "available_gb": 183.0
  },
  "security": {
    "tpm": false,
    "secure_boot": false,
    "has_aes_accel": true,
    "has_sha_accel": true
  }
}
```

### 최적화된 보안 설정

```json
{
  "argon2id_config": {
    "memory_kb": 65536,
    "iterations": 3,
    "parallelism": 4
  },
  "preferred_encryption": "aes-gcm",
  "use_hardware_rng": true,
  "enable_hardware_accel": true
}
```

---

## 하드웨어 보안 검증

### 자동 검증 항목

시스템 시작 시 다음 항목들을 자동으로 검증합니다:

- [ ] 하드웨어 RNG 사용 가능 여부
- [ ] AES 하드웨어 가속 사용 가능 여부
- [ ] TPM 사용 가능 여부
- [ ] Secure Boot 활성화 여부
- [ ] SMEP/SMAP 활성화 여부
- [ ] ASLR 활성화 여부

### 경고 메시지

하드웨어 보안 기능이 부족한 경우 경고 메시지가 표시됩니다:

```
WARN: No hardware RNG available - using software RNG
WARN: TPM not detected - hardware-backed security features unavailable
WARN: Secure Boot not enabled - boot security reduced
```

---

## 스펙 파일 위치

하드웨어 스펙은 다음 위치에 저장됩니다:

```
/home/darc0/projects/LIMEN/.server-spec.json
```

**형식**: JSON

**업데이트**: 서버 시작 시 및 5분마다 자동 업데이트

---

## 수동 스펙 업데이트

필요한 경우 수동으로 스펙을 업데이트할 수 있습니다:

```bash
# 서버 재시작 시 자동 업데이트
sudo systemctl restart limen.service

# 또는 API를 통해 확인 (향후 구현)
curl http://localhost:18443/api/hardware/spec
```

---

## 하드웨어 보안 권장사항

### 프로덕션 환경

#### 필수 하드웨어 기능
- ✅ AES-NI (AES 하드웨어 가속)
- ✅ RDRAND/RDSEED (하드웨어 RNG)
- ✅ SMEP/SMAP (커널 보안)
- ✅ TPM 2.0 (신뢰 플랫폼 모듈)
- ✅ Secure Boot (UEFI Secure Boot)

#### 권장 하드웨어 기능
- ✅ Intel TXT (신뢰 실행 기술)
- ✅ SELinux/AppArmor (강제 접근 제어)
- ✅ ASLR 활성화 (메모리 보안)

---

## 성능 영향

### 하드웨어 가속 사용 시

| 작업 | 소프트웨어 | 하드웨어 가속 | 개선율 |
|------|-----------|--------------|--------|
| AES 암호화 | 200 MB/s | 2000+ MB/s | **10배** |
| SHA 해싱 | 500 MB/s | 2000+ MB/s | **4배** |
| 랜덤 생성 | 50 MB/s | 500+ MB/s | **10배** |

### Argon2id 최적화

| 메모리 설정 | 해싱 시간 | GPU 저항 |
|------------|---------|---------|
| 8MB | ~50ms | 낮음 |
| 32MB | ~100ms | 중간 |
| 64MB | ~150ms | 높음 |

---

## 관련 문서

- [암호화 기법](./encryption.md)
- [제로 트러스트 보안](./zero-trust.md)
- [보안 강화 가이드](./hardening.md)

---

**태그**: `#하드웨어-보안` `#스펙-감지` `#자동-최적화` `#하드웨어-가속`

**마지막 업데이트**: 2024-12-23





