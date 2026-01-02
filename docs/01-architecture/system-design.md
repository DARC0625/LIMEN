# 시스템 설계

> [← 홈](../00-home.md) | [아키텍처](./overview.md) | [시스템 설계](./system-design.md) | [로드맵](./roadmap.md)

## 아키텍처 다이어그램

```
┌─────────────────┐
│   Client        │
│  (Browser)      │
└──────┬──────────┘
       │ HTTPS
       ▼
┌─────────────────┐
│  Reverse Proxy  │  (Nginx/Envoy)
│   (HTTPS)       │
└──────┬──────────┘
       │ HTTP
       ▼
┌─────────────────┐      ┌──────────────┐
│  Backend (Go)   │◄─────┤  PostgreSQL  │
│   Port: 18443   │      │  Port: 5432  │
└──────┬──────────┘      └──────────────┘
       │
       ├──► /agent/* ──► Agent (Rust) Port: 9000
       │
       └──► Libvirt (qemu:///system)
```

## 기술 스택

### Backend
- **언어**: Go 1.24
- **프레임워크**: Gorilla Mux
- **ORM**: GORM
- **인증**: JWT (golang-jwt/jwt/v5)
- **로깅**: Zap (구조화된 로깅)
- **메트릭스**: Prometheus

### Agent
- **언어**: Rust (stable)
- **프레임워크**: Axum 0.7
- **라이브러리**: sysinfo (시스템 메트릭스)
- **기능**: CPU/메모리/디스크 모니터링

### Database
- **타입**: PostgreSQL 15+
- **ORM**: GORM
- **연결 풀**: 최적화된 설정 (MaxIdleConns: 10, MaxOpenConns: 100)

### 가상화
- **라이브러리**: libvirt-go
- **하이퍼바이저**: KVM/QEMU
- **URI**: `qemu:///system`

### 인프라
- **컨테이너**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **서비스 관리**: systemd

## 설계 원칙

1. **분리된 아키텍처**
   - 프론트엔드와 백엔드 완전 분리
   - API 기반 통신
   - 독립적 배포 가능

2. **마이크로서비스 준비**
   - 각 컴포넌트 독립적 실행
   - 향후 확장 가능한 구조
   - 서비스 간 느슨한 결합

3. **보안 우선**
   - JWT 토큰 인증
   - CORS 제한 (명시적 오리진만 허용)
   - 보안 헤더 자동 적용
   - Rate limiting

4. **성능 최적화**
   - 데이터베이스 연결 풀링
   - HTTP 서버 최적화 (타임아웃 설정)
   - 비동기 처리 (Goroutine)
   - 빌드 최적화 (strip, LTO)

5. **관찰 가능성**
   - 구조화된 로깅 (Zap)
   - Prometheus 메트릭스
   - 요청 추적 (Request ID)
   - 에러 추적

## 네트워크 아키텍처

### 요청 흐름

1. **클라이언트 → 리버스 프록시**
   - HTTPS 연결
   - SSL/TLS 종료
   - 도메인 기반 라우팅

2. **리버스 프록시 → Backend**
   - HTTP 연결
   - 헤더 전달 (X-Forwarded-For, X-Real-IP)
   - WebSocket 업그레이드 지원

3. **Backend → Agent**
   - 내부 HTTP 프록시 (`/agent/*`)
   - 로컬호스트 통신 (127.0.0.1:9000)

4. **Backend → PostgreSQL**
   - 연결 풀을 통한 효율적 연결
   - 트랜잭션 관리

5. **Backend → Libvirt**
   - 소켓 기반 통신 (`/var/run/libvirt/libvirt-sock`)
   - VM 관리 작업

## 데이터 흐름

### VM 생성 프로세스

```
1. API 요청 (POST /api/vms)
   ↓
2. 인증/인가 검증 (JWT)
   ↓
3. 할당량 확인 (DB)
   ↓
4. VM 생성 (Libvirt)
   ↓
5. DB 저장 (GORM)
   ↓
6. 메트릭스 업데이트
   ↓
7. 응답 반환
```

### 메트릭스 수집 프로세스

```
1. Agent가 시스템 메트릭스 수집 (sysinfo)
   ↓
2. HTTP 엔드포인트 제공 (/metrics)
   ↓
3. Backend가 프록시 (/agent/metrics)
   ↓
4. Prometheus가 수집 (향후 통합 모니터링)
```

## 확장성 고려사항

### 수평 확장

- **Backend**: 여러 인스턴스 실행 가능 (단, libvirt 접근은 제한적)
- **Agent**: 무제한 확장 가능
- **Database**: 읽기 전용 복제본 추가 가능

### 수직 확장

- 리소스 제한 설정 (Docker)
- 연결 풀 크기 조정
- 캐시 전략 (향후 Redis 추가)

## 보안 아키텍처

### 다층 보안

1. **네트워크 레이어**
   - 방화벽 규칙
   - 리버스 프록시 (HTTPS 강제)
   - 내부 네트워크 격리

2. **애플리케이션 레이어**
   - JWT 인증
   - CORS 제한
   - Rate limiting
   - 보안 헤더

3. **데이터 레이어**
   - SQL Injection 방지 (GORM)
   - 입력 검증
   - 암호화된 비밀번호 저장

## 관련 문서

- [아키텍처 개요](./overview.md)
- [로드맵](./roadmap.md)
- [컴포넌트 상세](./components/)
- [디자인 패턴](./design-patterns/)
- [배포 가이드](../03-deployment/docker/deployment.md)

---

**태그**: `#아키텍처` `#시스템-설계` `#기술-스택` `#네트워크` `#보안`

**카테고리**: 아키텍처 > 시스템 설계

**마지막 업데이트**: 2024-12-23
