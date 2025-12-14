# LIMEN - 프로젝트 구조

## 개요
웹 기반 VM 관리 플랫폼으로, KVM/libvirt를 사용하여 가상 머신을 생성/관리하고 VNC를 통해 콘솔 접근을 제공합니다. 로컬 환경의 제약을 넘어 웹을 통해 강력한 계산 능력과 개발 환경을 제공합니다.

## 디렉토리 구조

```
LIMEN/
├── frontend/              # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/          # Next.js App Router
│   │   ├── components/    # React 컴포넌트
│   │   └── lib/          # 유틸리티 함수
│   ├── public/           # 정적 파일
│   ├── package.json
│   └── .env.example
│
├── backend/              # Go 백엔드
│   ├── cmd/
│   │   └── server/      # 메인 서버 진입점
│   ├── internal/
│   │   ├── config/      # 설정 관리
│   │   ├── database/    # DB 연결 및 마이그레이션
│   │   ├── handlers/    # HTTP 핸들러
│   │   ├── models/      # 데이터 모델 (GORM)
│   │   └── vm/          # VM 서비스 (libvirt 연동)
│   ├── pkg/             # 공용 패키지 (현재 비어있음)
│   ├── agent/           # Rust 에이전트
│   │   ├── src/
│   │   └── Cargo.toml
│   ├── uploads/         # 업로드된 파일 (에이전트 바이너리, 배포 아카이브)
│   ├── go.mod
│   └── env.example
│
├── database/            # 데이터베이스 관련
│   ├── docs/           # DB 문서
│   ├── iso/            # ISO 이미지 저장소
│   └── vms/            # VM 디스크 이미지 저장소
│
├── envoy/              # Envoy 프록시 설정 (현재 미사용)
│
├── .gitignore          # Git 무시 파일
├── .dockerignore       # Docker 빌드 무시 파일
├── docker-compose.yaml # Docker Compose 설정
└── README.md           # 프로젝트 개요

```

## 주요 컴포넌트

### Frontend (Next.js)
- **기술 스택**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **주요 기능**:
  - VM 목록 조회 및 생성
  - VM 상태 모니터링 (CPU, Memory)
  - VNC 콘솔 접근 (noVNC)
  - VM 리소스 편집 (CPU, Memory)
  - 에이전트 상태 확인

### Backend (Go)
- **기술 스택**: Go 1.24, GORM, libvirt-go
- **주요 기능**:
  - RESTful API 제공
  - WebSocket (VNC 프록시)
  - VM 생성/삭제/제어 (libvirt)
  - 데이터베이스 관리 (PostgreSQL)
  - 에이전트 바이너리 서빙

### Agent (Rust)
- **기술 스택**: Rust
- **주요 기능**:
  - VM 내부에서 실행되는 에이전트
  - 시스템 메트릭 수집
  - 헬스체크
  - 백엔드와 통신

### Database
- **PostgreSQL**: 메인 데이터베이스
  - VM 정보 저장
  - OS 이미지 정보 관리
  - 사용자 및 세션 관리

## 환경 변수

### Backend
`backend/env.example` 참조
- `PORT`: HTTP 서버 포트 (기본: 8080)
- `GRPC_PORT`: gRPC 포트 (기본: 9090)
- `DB_*`: PostgreSQL 연결 정보
- `LIBVIRT_URI`: libvirt 연결 URI
- `JWT_SECRET`: JWT 토큰 시크릿

### Frontend
`frontend/.env.example` 참조
- `NEXT_PUBLIC_API_URL`: 백엔드 API URL
- `NEXT_PUBLIC_WS_URL`: WebSocket URL
- `NEXT_PUBLIC_VNC_URL`: VNC WebSocket URL

## 빌드 및 실행

### Backend
```bash
cd backend
go mod download
go build -o server ./cmd/server
./server
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # 개발 모드
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 실행
```

### Agent
```bash
cd backend/agent
cargo build --release
```

## 데이터베이스

### ISO 이미지
- 위치: `database/iso/`
- 지원 형식: `.iso` 파일
- 데이터베이스에 경로 정보 저장

### VM 디스크
- 위치: `database/vms/`
- 형식: QCOW2
- 파일명: `vm_{id}.qcow2`

## 보안 고려사항

1. **환경 변수**: `.env` 파일은 절대 커밋하지 않음
2. **업로드 파일**: `backend/uploads/`는 .gitignore에 포함
3. **로그 파일**: 모든 로그 파일은 .gitignore에 포함
4. **인증**: JWT 기반 인증 (추후 구현)

## 배포

### Frontend 별도 배포
- Frontend는 별도 서버로 배포 가능
- 환경 변수로 백엔드 URL 설정
- 빌드 산출물: `frontend/.next/` 또는 `frontend/out/`

### Backend 배포
- Go 바이너리 (`server`) 배포
- 환경 변수 설정 필요
- libvirt 접근 권한 필요

## 향후 개선 사항

1. **인증/인가**: JWT 기반 사용자 인증
2. **로깅**: 구조화된 로깅 (Zap 등)
3. **모니터링**: Prometheus 메트릭
4. **테스트**: 단위 테스트 및 통합 테스트
5. **CI/CD**: GitHub Actions 파이프라인
6. **문서화**: API 문서 (Swagger/OpenAPI)

