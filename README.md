# LIMEN

**Cross the limen.**

웹 기반 가상 머신(VM) 관리 플랫폼. 로컬 환경의 제약을 넘어 웹을 통해 강력한 계산 능력과 개발 환경을 제공합니다.

[![CI/CD](https://github.com/DARC0625/LIMEN/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/DARC0625/LIMEN/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🌉 LIMEN이란?

**LIMEN**은 라틴어로 **문지방, 경계, 임계점**을 의미합니다. 

학술적으로 **Liminal State(리미널 상태)**는:
- 기존 정체성에서 벗어났지만 새로운 정체성에는 아직 도달하지 않은 상태
- 가장 창의적이고 변화가 일어나는 순간
- 기존 질서가 잠시 무력화되는 지점
- 규칙이 사라지고 재정의가 가능한 구간

LIMEN은 **로컬 PC의 성능과 환경 제약을 웹 기반 VM으로 넘어가는 통과 지점**을 제공합니다. 현실에서 가상으로, 제약에서 자유로움으로.

## 🎯 주요 기능

- ✅ **VM 생성/삭제/제어** - libvirt/KVM을 통한 완전한 가상화 관리
- ✅ **웹 기반 VNC 콘솔** - noVNC를 통한 브라우저에서 직접 VM 접근
- ✅ **실시간 상태 모니터링** - WebSocket 기반 즉각적인 상태 업데이트
- ✅ **동적 리소스 조정** - 실행 중인 VM의 CPU/Memory 실시간 변경
- ✅ **에이전트 기반 메트릭** - Rust 에이전트로 정확한 리소스 모니터링
- ✅ **ISO 기반 OS 설치** - 다양한 OS 이미지 지원 (Ubuntu, Kali, Windows 등)
- ✅ **사용자 관리 시스템** - JWT 기반 인증 및 역할 기반 접근 제어
- ✅ **VM 스냅샷 관리** - libvirt 스냅샷을 통한 상태 저장/복원
- ✅ **리소스 할당량 관리** - 사용자별 VM/CPU/Memory 제한
- ✅ **UUID 기반 식별** - 순차적 ID 대신 고유 식별자 사용

## 🏗 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Next.js    │  │   noVNC      │  │  WebSocket   │    │
│  │   Frontend   │  │   Console    │  │  (Real-time) │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          │ HTTP/REST        │ VNC WebSocket    │ VM Status WS
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼────────────┐
│         ▼                  ▼                  ▼            │
│  ┌────────────────────────────────────────────────────┐   │
│  │           Go Backend (Gorilla Mux)                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │
│  │  │   REST   │  │  WebSocket│  │   JWT    │         │   │
│  │  │   API    │  │ Broadcaster│  │  Auth   │         │   │
│  │  └────┬─────┘  └─────┬────┘  └─────┬────┘         │   │
│  └───────┼───────────────┼─────────────┼──────────────┘   │
│          │               │             │                   │
│          ▼               │             ▼                   │
│  ┌──────────────┐        │    ┌──────────────┐            │
│  │  PostgreSQL  │        │    │   GORM ORM   │            │
│  │   Database   │        │    │              │            │
│  └──────────────┘        │    └──────────────┘            │
│                          │                                 │
│                          ▼                                 │
│                  ┌──────────────┐                         │
│                  │   libvirt-go  │                         │
│                  │   (KVM/QEMU) │                         │
│                  └───────┬───────┘                         │
└──────────────────────────┼────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Virtual Machines│
                  │  ┌─────────────┐ │
                  │  │ Rust Agent │ │ ← 메트릭 수집
                  │  └─────────────┘ │
                  └─────────────────┘
```

## 🛠 기술 스택 및 혁신적 활용

### Frontend: Next.js 16 + React 19

**선택 이유:**
- **서버 사이드 렌더링 (SSR)**: 초기 로딩 속도 최적화
- **React Server Components**: 서버와 클라이언트 컴포넌트의 효율적 분리
- **App Router**: 최신 라우팅 시스템으로 성능 향상

**혁신적 활용:**
- **Optimistic Updates**: VM 생성/수정 시 즉각적인 UI 반영으로 사용자 경험 향상
- **startTransition API**: 비동기 상태 업데이트로 UI 블로킹 방지
- **Custom Hooks**: `useVMWebSocket`으로 WebSocket 연결을 컴포넌트와 분리
- **Context API**: Toast 알림 시스템을 전역 상태로 관리

### Backend: Go 1.24

**선택 이유:**
- **높은 성능**: C 수준의 성능으로 VM 관리 작업 처리
- **동시성**: Goroutine을 통한 효율적인 동시 처리
- **타입 안정성**: 컴파일 타임 타입 체크
- **빠른 컴파일**: 즉각적인 피드백 루프

**혁신적 활용:**
- **Goroutine 기반 WebSocket Broadcaster**: 수천 개의 동시 연결 처리
- **Channel 기반 메시지 큐**: 안전한 동시성 제어
- **Context 패턴**: 요청별 타임아웃 및 취소 처리
- **Middleware Chain**: 인증, 권한, 로깅을 체인으로 구성

### 가상화: KVM + libvirt

**선택 이유:**
- **네이티브 성능**: 하드웨어 가상화로 거의 네이티브 수준의 성능
- **다양한 OS 지원**: Linux, Windows, BSD 등 광범위한 OS 지원
- **엔터프라이즈급 안정성**: 프로덕션 환경에서 검증된 기술

**혁신적 활용:**
- **동적 리소스 조정**: 실행 중인 VM의 vCPU/Memory 실시간 변경
- **XML 기반 도메인 정의**: 유연하고 확장 가능한 VM 설정
- **스냅샷 관리**: ATOMIC 스냅샷으로 데이터 일관성 보장
- **상태 동기화**: libvirt와 DB 간 자동 상태 동기화

### 실시간 통신: WebSocket (Gorilla WebSocket)

**선택 이유:**
- **양방향 통신**: 서버에서 클라이언트로 푸시 가능
- **낮은 오버헤드**: HTTP 오버헤드 없이 효율적 통신
- **자동 재연결**: 네트워크 장애 시 자동 복구

**혁신적 활용:**
- **Broadcast 패턴**: 한 VM 변경 시 모든 연결된 클라이언트에 즉시 전파
- **JWT 인증**: WebSocket 연결에도 JWT 토큰으로 보안 유지
- **Throttling/Debouncing**: 과도한 업데이트 방지로 성능 최적화
- **Connection Pooling**: 효율적인 연결 관리

### 데이터베이스: PostgreSQL + GORM

**선택 이유:**
- **ACID 보장**: 트랜잭션 무결성 보장
- **복잡한 쿼리**: JOIN, 서브쿼리 등 복잡한 데이터 조회
- **확장성**: 대용량 데이터 처리 가능

**혁신적 활용:**
- **UUID 기반 식별**: 순차적 ID 대신 고유 식별자로 보안 강화
- **Soft Delete**: GORM의 DeletedAt으로 데이터 복구 가능
- **BeforeCreate Hooks**: 자동 UUID 생성 및 검증
- **트랜잭션 관리**: VM 생성 시 여러 테이블 동시 업데이트

### 에이전트: Rust

**선택 이유:**
- **메모리 안전성**: 컴파일 타임 메모리 안전 보장
- **높은 성능**: C/C++ 수준의 성능
- **작은 바이너리**: VM 내부 실행에 최적화

**혁신적 활용:**
- **VM 내부 메트릭 수집**: 게스트 OS 레벨에서 정확한 리소스 모니터링
- **에이전트-호스트 통신**: VM 내부에서 호스트로 메트릭 전송
- **경량 설계**: 최소한의 리소스로 최대 성능

### 콘솔 접근: noVNC

**선택 이유:**
- **웹 기반**: 별도 클라이언트 설치 불필요
- **WebSocket 지원**: 실시간 화면 전송
- **크로스 플랫폼**: 모든 브라우저에서 동작

**혁신적 활용:**
- **자동 리사이즈**: 브라우저 창 크기에 맞춰 자동 조정
- **키보드/마우스 이벤트**: 네이티브 VNC와 동일한 경험
- **Throttling**: 리사이즈 이벤트 최적화로 성능 향상

### 인증/인가: JWT (JSON Web Token)

**선택 이유:**
- **Stateless**: 서버에 세션 저장 불필요
- **확장성**: 마이크로서비스 아키텍처에 적합
- **표준화**: 널리 사용되는 표준

**혁신적 활용:**
- **Role-Based Access Control (RBAC)**: Admin/User 역할 기반 접근 제어
- **Approval System**: 신규 사용자 승인 시스템
- **Token Claims**: 사용자 ID, 역할, 승인 상태를 토큰에 포함
- **Middleware Chain**: 인증 → 권한 → 비즈니스 로직 순차 처리

### UI/UX: Tailwind CSS

**선택 이유:**
- **유틸리티 퍼스트**: 빠른 스타일링
- **반응형 디자인**: 모바일부터 데스크톱까지
- **일관성**: 디자인 시스템 자동 적용

**혁신적 활용:**
- **컴포넌트 기반 디자인**: 재사용 가능한 UI 컴포넌트
- **다크 모드 제거**: 일관된 라이트 테마로 사용성 향상
- **애니메이션**: Toast 알림, 카루셀 등 부드러운 전환 효과
- **호버 인터랙션**: VM 카드에서 액션 버튼 표시

## 🚀 성능 최적화 기법

### 1. **Optimistic Updates**
VM 생성/수정 시 서버 응답을 기다리지 않고 즉시 UI 업데이트

### 2. **WebSocket Throttling**
과도한 상태 업데이트를 방지하여 네트워크 및 CPU 부하 감소

### 3. **React startTransition**
비동기 상태 업데이트를 낮은 우선순위로 처리하여 UI 반응성 유지

### 4. **Connection Pooling**
WebSocket 연결을 효율적으로 관리하여 메모리 사용량 최적화

### 5. **Debouncing/Throttling**
리사이즈 이벤트, 폴링 요청 등을 제한하여 불필요한 작업 감소

### 6. **Lazy Loading**
필요한 컴포넌트만 로드하여 초기 번들 크기 감소

## 🔒 보안 아키텍처

### 다층 보안 구조

1. **인증 레이어 (JWT)**
   - 토큰 기반 인증
   - 만료 시간 관리
   - 토큰 검증 미들웨어

2. **권한 레이어 (RBAC)**
   - 역할 기반 접근 제어
   - Admin/User 권한 분리
   - 승인 시스템

3. **리소스 제한**
   - 사용자별 할당량 관리
   - VM/CPU/Memory 제한
   - 시스템 전체 리소스 보호

4. **입력 검증**
   - 서버 사이드 검증
   - SQL Injection 방지 (GORM)
   - XSS 방지 (React 자동 이스케이프)

## 📁 프로젝트 구조

```
LIMEN/
├── frontend/              # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/          # App Router 페이지
│   │   ├── components/   # React 컴포넌트
│   │   ├── hooks/        # Custom React Hooks
│   │   └── lib/          # 유틸리티 및 API 클라이언트
│   └── package.json
├── backend/               # Go 백엔드
│   ├── cmd/server/       # 서버 진입점
│   ├── internal/
│   │   ├── handlers/    # HTTP 핸들러
│   │   ├── middleware/  # 미들웨어 (인증, 권한)
│   │   ├── models/       # 데이터 모델 (GORM)
│   │   ├── vm/          # VM 관리 서비스
│   │   ├── auth/        # JWT 인증
│   │   └── router/      # 라우팅 설정
│   ├── agent/           # Rust 에이전트
│   └── go.mod
├── database/             # 데이터베이스 관련
│   ├── iso/             # ISO 이미지 저장
│   └── vms/             # VM 디스크 이미지
├── docs/                 # 프로젝트 문서
├── infra/                # 인프라 및 배포
│   ├── docker-compose.yaml
│   └── .dockerignore
└── .github/              # GitHub Actions CI/CD
    └── workflows/
```

## 🚀 빠른 시작

### 필수 요구사항

- **Go 1.24+** - 백엔드 빌드
- **Node.js 18+** - 프론트엔드 빌드
- **Rust** - 에이전트 빌드
- **PostgreSQL 15+** - 데이터베이스
- **libvirt** - KVM 가상화
- **sudo 권한** - libvirt 접근

### 설치 및 실행

1. **리포지토리 클론**
   ```bash
   git clone https://github.com/DARC0625/LIMEN.git
   cd LIMEN
   ```

2. **의존성 설치**
   ```bash
   make setup
   ```

3. **환경 변수 설정**
   ```bash
   # Backend
   cp backend/env.example backend/.env
   # .env 파일 편집

   # Frontend
   cp frontend/.env.example frontend/.env.local
   # .env.local 파일 편집
   ```

4. **데이터베이스 설정**
   ```bash
   createdb limen
   ```

5. **빌드**
   ```bash
   make build-all
   ```

6. **실행**
   ```bash
   # Backend
   make dev-backend

   # Frontend (별도 터미널)
   make dev-frontend
   ```

## 📝 사용 가능한 명령어

```bash
make help              # 도움말
make build-backend      # 백엔드 빌드
make build-frontend     # 프론트엔드 빌드
make build-agent        # 에이전트 빌드
make build-all          # 전체 빌드
make clean              # 빌드 아티팩트 정리
make clean-logs         # 로그 파일 정리
make dev-backend        # 백엔드 개발 모드
make dev-frontend       # 프론트엔드 개발 모드
make setup              # 초기 설정
make check-env          # 환경 변수 확인
```

## 🔧 설정

### Backend 환경 변수

`backend/env.example`을 참조하여 `backend/.env` 파일을 생성하세요.

**주요 설정:**
- `PORT`: HTTP 서버 포트 (기본: 8080)
- `DB_*`: PostgreSQL 연결 정보
- `LIBVIRT_URI`: libvirt URI (기본: `qemu:///system`)
- `JWT_SECRET`: JWT 토큰 시크릿 (강력한 값 사용 필수)
- `RATE_LIMIT_RPS`: Rate limiting 설정

### Frontend 환경 변수

`frontend/.env.example`을 참조하여 `frontend/.env.local` 파일을 생성하세요.

**주요 설정:**
- `NEXT_PUBLIC_API_URL`: 백엔드 API URL
- `NEXT_PUBLIC_WS_URL`: WebSocket URL
- `NEXT_PUBLIC_VNC_URL`: VNC WebSocket URL

## 📦 배포

### Frontend 별도 배포

Frontend는 별도 서버로 배포 가능합니다:

```bash
cd frontend
npm run build
# .next/ 디렉토리를 배포 서버로 복사
```

환경 변수로 백엔드 URL을 설정하세요.

### Backend 배포

```bash
cd backend
go build -o limen-server ./cmd/server
# limen-server 바이너리 배포
```

### Docker 배포

```bash
cd infra
docker-compose up -d
```

## 🔒 보안

- 환경 변수 파일 (`.env`)은 절대 커밋하지 마세요
- 프로덕션에서는 강력한 `JWT_SECRET` 사용
- libvirt 접근 권한 적절히 설정
- 방화벽 규칙 설정
- Rate limiting 활성화

## 📚 문서

모든 문서는 [`docs/`](./docs/) 폴더에 정리되어 있습니다.

### 📖 시작하기
- [문서 인덱스](./docs/INDEX.md) ⭐ - 모든 문서의 목차
- [프로젝트 구조](./docs/PROJECT_STRUCTURE.md) - 프로젝트 디렉토리 구조

### 🔧 개발 가이드
- [API 문서](./backend/docs/API_DOCUMENTATION.md) - Backend API 상세 문서
- [테스트 가이드](./backend/docs/TESTING.md) - 테스트 실행 방법

**전체 문서 목록**: [docs/README.md](./docs/README.md) 또는 [docs/INDEX.md](./docs/INDEX.md) 참조

## 🐛 문제 해결

### libvirt 권한 오류
```bash
sudo usermod -a -G libvirt $USER
# 재로그인 필요
```

### 포트 충돌
환경 변수에서 포트를 변경하세요.

### 데이터베이스 연결 오류
PostgreSQL이 실행 중인지 확인하고 연결 정보를 확인하세요.

## 🤝 기여

기여 가이드는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참조하세요.

1. 이슈 생성
2. 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 커밋 (`git commit -m 'Add amazing feature'`)
4. 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 📄 라이선스

[라이선스 정보 추가]

## 🔗 링크

- **GitHub**: https://github.com/DARC0625/LIMEN
- **문서**: [docs/](./docs/)
- **이슈**: [Issues](https://github.com/DARC0625/LIMEN/issues)
- **Pull Requests**: [Pull Requests](https://github.com/DARC0625/LIMEN/pulls)

## 🌟 주요 혁신 포인트

### 1. **웹 기반 완전한 VM 관리**
로컬 환경 제약 없이 브라우저에서 모든 VM 작업 수행

### 2. **실시간 동기화**
WebSocket을 통한 즉각적인 상태 업데이트로 여러 사용자 간 일관성 유지

### 3. **동적 리소스 조정**
실행 중인 VM의 리소스를 중단 없이 변경

### 4. **에이전트 기반 정확한 모니터링**
VM 내부에서 직접 메트릭 수집으로 정확한 리소스 사용량 파악

### 5. **UUID 기반 식별**
순차적 ID 대신 고유 식별자로 보안 및 확장성 향상

### 6. **역할 기반 접근 제어**
세밀한 권한 관리로 엔터프라이즈급 보안

---

**Cross the limen. Break the boundaries.**
