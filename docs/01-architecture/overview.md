# LIMEN 아키텍처 개요

> [← 홈](../00-home.md) | [아키텍처](./) | [개요](./overview.md) | [시스템 설계](./system-design.md)

## 프로젝트 구조

```
LIMEN/
├── backend/              # Go 백엔드
│   ├── cmd/server/      # 서버 진입점
│   ├── internal/         # 내부 패키지
│   │   ├── handlers/     # HTTP 핸들러
│   │   ├── middleware/  # 미들웨어
│   │   ├── models/       # 데이터 모델
│   │   ├── vm/          # VM 관리 서비스
│   │   ├── auth/        # 인증/인가
│   │   ├── alerting/    # 알림 시스템 (임시)
│   │   └── router/      # 라우팅
│   ├── agent/           # Rust 에이전트
│   └── tests/           # 테스트
├── docs/                # 문서 (위키)
├── scripts/             # 스크립트
├── infra/               # 인프라 설정
└── database/            # 데이터 저장소
    ├── iso/             # ISO 이미지
    └── vms/             # VM 디스크 이미지
```

## 주요 컴포넌트

### Backend (Go)
- **역할**: 메인 API 서버
- **포트**: 18443
- **기능**: VM 관리, 사용자 인증, API 제공
- **기술**: Go 1.24, Gorilla Mux, GORM, JWT

### Agent (Rust)
- **역할**: 시스템 메트릭스 수집
- **포트**: 9000
- **기능**: CPU/메모리/디스크 모니터링
- **기술**: Rust, Axum, sysinfo

### Database (PostgreSQL)
- **역할**: 데이터 저장
- **포트**: 5432
- **기능**: VM 정보, 사용자 정보, 할당량 관리
- **기술**: PostgreSQL 15+, GORM

### Libvirt
- **역할**: 가상화 관리
- **URI**: `qemu:///system`
- **기능**: VM 생성/삭제/제어, 스냅샷 관리
- **기술**: libvirt-go, KVM/QEMU

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

## 설계 원칙

1. **분리된 아키텍처**: 프론트엔드와 백엔드 완전 분리
2. **마이크로서비스 준비**: 향후 확장 가능한 구조
3. **보안 우선**: JWT 인증, CORS 제한, 보안 헤더
4. **성능 최적화**: 연결 풀링, 캐싱, 비동기 처리

## 관련 문서

- [시스템 설계](./system-design.md)
- [로드맵](./roadmap.md)
- [컴포넌트 상세](./components/)
- [디자인 패턴](./design-patterns/)
- [개발 시작하기](../02-development/getting-started.md)

---

**태그**: `#아키텍처` `#개요` `#프로젝트-구조` `#컴포넌트`

**카테고리**: 아키텍처 > 개요

**마지막 업데이트**: 2024-12-23
