# 개발 시작하기

> [← 홈](../00-home.md) | [개발](./) | [시작하기](./getting-started.md) | [API 문서](./api/reference.md)

## 전제 조건

- **Go 1.24+** - 백엔드 빌드
- **Rust** - 에이전트 빌드
- **PostgreSQL 15+** - 데이터베이스
- **libvirt** - VM 관리용
- **Docker** (선택) - 컨테이너 배포용

---

## 빠른 시작

### 1. 리포지토리 클론

```bash
git clone https://github.com/DARC0625/LIMEN.git
cd LIMEN
```

### 2. 환경 변수 설정

```bash
# Backend 환경 변수
cp backend/env.example backend/.env
# .env 파일 편집
```

주요 설정:
```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/limen?sslmode=disable
JWT_SECRET=your-secure-secret-key
ALLOWED_ORIGINS=http://localhost:3000
```

### 3. 데이터베이스 설정

```bash
# PostgreSQL 생성
createdb limen

# 또는 Docker 사용
docker-compose up -d postgres
```

### 4. 빌드

```bash
# Backend 빌드
cd backend
go build -o server ./cmd/server

# Agent 빌드
cd agent
cargo build --release
```

### 5. 실행

```bash
# Backend 실행
./backend/server

# Agent 실행 (별도 터미널)
./backend/agent/target/release/agent
```

---

## 개발 환경

### Docker 사용 (권장)

```bash
# 개발 환경 실행
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# 백그라운드 실행
docker-compose up -d
```

**장점**:
- 일관된 환경
- 의존성 자동 설치
- 빠른 시작

### 로컬 개발

```bash
# Backend 개발 모드
make dev-backend

# 테스트 실행
make test-backend

# 린터 실행
make lint-backend
```

---

## 개발 워크플로우

### 1. 기능 개발

```bash
# 브랜치 생성
git checkout -b feature/new-feature

# 코드 작성
# ...

# 테스트 실행
make test-backend

# 커밋
git commit -m "feat: Add new feature"
```

### 2. 코드 품질 확인

```bash
# 포맷 검사
make format-check-backend

# 린터 실행
make lint-backend

# CI 로컬 실행
make ci-local
```

### 3. Pull Request

1. 변경 사항 푸시
2. GitHub에서 PR 생성
3. CI/CD 자동 실행
4. 코드 리뷰 대기

---

## 테스트

### 단위 테스트

```bash
cd backend
go test ./...
```

### 통합 테스트

```bash
# 서버가 실행 중이어야 함
export LIMEN_BASE_URL=http://localhost:18443
go test -tags=integration ./tests/integration
```

### 커버리지

```bash
cd backend
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

---

## 디버깅

### 로그 확인

```bash
# 실시간 로그
sudo journalctl -u limen.service -f

# 최근 로그
sudo journalctl -u limen.service -n 100
```

### 디버그 모드

```bash
# 환경 변수 설정
LOG_LEVEL=debug

# 서버 재시작
sudo systemctl restart limen.service
```

---

## 다음 단계

- [API 레퍼런스](./api/reference.md)
- [테스트 가이드](./testing/)
- [기여 가이드](./contributing.md)
- [CI/CD 설정](../03-deployment/ci-cd/setup.md)

---

## 관련 문서

- [아키텍처 개요](../01-architecture/overview.md)
- [Docker 배포](../03-deployment/docker/deployment.md)
- [운영 가이드](../04-operations/operations-guide.md)

---

**태그**: `#개발` `#시작하기` `#환경-설정` `#빌드` `#실행`

**카테고리**: 개발 > 시작하기

**마지막 업데이트**: 2024-12-23
