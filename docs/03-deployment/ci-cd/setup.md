# CI/CD 파이프라인 구축 가이드

> [← 홈](../00-home.md) | [배포](../) | [CI/CD](./) | [설정](./setup.md)

## 개요

LIMEN 프로젝트의 CI/CD 파이프라인은 GitHub Actions를 사용하여 자동화된 빌드, 테스트, 코드 품질 검사, 보안 스캔을 수행합니다.

---

## 워크플로우 구조

### 1. CI Pipeline (`ci.yml`)

모든 PR과 main/develop 브랜치 푸시 시 실행됩니다.

#### 작업 (Jobs)

**Backend (Go)**
- 코드 체크아웃
- Go 환경 설정 (1.24)
- 의존성 캐싱
- golangci-lint 실행
- 코드 포맷 검사 (gofmt)
- 테스트 실행 (race detector 포함)
- 커버리지 리포트 생성
- 빌드 실행
- 아티팩트 업로드

**Agent (Rust)**
- 코드 체크아웃
- Rust 환경 설정 (stable)
- 의존성 캐싱
- 코드 포맷 검사 (cargo fmt)
- Clippy 린터 실행
- 테스트 실행
- 릴리스 빌드
- 아티팩트 업로드

**Integration Tests**
- PostgreSQL 서비스 시작
- 통합 테스트 실행
- main 브랜치 푸시 시에만 실행

**Security Scan**
- Trivy 취약점 스캔
- Go 보안 검사 (gosec)
- GitHub Security 탭에 결과 업로드

**Code Quality Report**
- 빌드 아티팩트 다운로드
- 바이너리 크기 체크
- GitHub Actions Summary에 리포트 생성

### 2. Release Pipeline (`release.yml`)

태그 푸시 또는 수동 트리거 시 실행됩니다.

#### 기능
- 버전 추출 (태그 또는 입력)
- 최적화된 빌드
- 릴리스 아카이브 생성 (tar.gz)
- SHA256 체크섬 생성
- GitHub Release 생성
- 릴리스 노트 자동 생성

#### 사용 방법

**태그로 릴리스:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**수동 릴리스:**
1. GitHub Actions → Release 워크플로우 선택
2. "Run workflow" 클릭
3. 버전 입력 (예: v1.0.0)
4. 실행

### 3. Dependency Review (`dependency-review.yml`)

PR 생성 시 의존성 변경사항을 검토합니다.

- 새로운 의존성 추가 시 알림
- 취약점이 있는 의존성 차단
- 심각도: moderate 이상 차단

### 4. CodeQL Analysis (`codeql.yml`)

코드 보안 분석을 수행합니다.

- Go 및 JavaScript 코드 분석
- 주간 자동 스캔 (매주 일요일)
- PR 및 main/develop 브랜치 푸시 시 실행

---

## 로컬에서 CI 테스트

### Go 백엔드

```bash
cd backend

# 포맷 검사
gofmt -s -d .

# 포맷 자동 수정
gofmt -s -w .

# 린터 실행
golangci-lint run

# 테스트 실행
go test -v -race ./...

# 커버리지
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Rust 에이전트

```bash
cd backend/agent

# 포맷 검사
cargo fmt -- --check

# 포맷 자동 수정
cargo fmt

# Clippy 실행
cargo clippy -- -D warnings

# 테스트 실행
cargo test --verbose

# 릴리스 빌드
cargo build --release
```

---

## 코드 품질 기준

### Go

**golangci-lint 설정** (`backend/.golangci.yml`)

주요 체크:
- `errcheck`: 에러 처리 확인
- `gocritic`: 코드 품질 검사
- `gocyclo`: 복잡도 검사 (15 이상 경고)
- `govet`: Go 컴파일러 검사
- `gosec`: 보안 검사
- `staticcheck`: 정적 분석

**포맷 규칙:**
- `gofmt -s` 사용
- 최대 라인 길이: 140자

### Rust

**Clippy 규칙:**
- 모든 경고를 에러로 처리 (`-D warnings`)
- 성능 관련 체크 활성화
- 스타일 체크 활성화

**포맷 규칙:**
- `cargo fmt` 사용
- CI에서 자동 검사

---

## 커버리지 목표

현재 목표: **80% 이상**

### 커버리지 확인

```bash
# Go
cd backend
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out

# Rust
cd backend/agent
cargo tarpaulin --out Html
```

### 커버리지 리포트

- Codecov에 자동 업로드 (설정 시)
- GitHub Actions Summary에 표시
- PR 코멘트에 자동 표시 (Codecov 봇)

---

## 보안 스캔

### Trivy

모든 파일 시스템 스캔:
- 의존성 취약점
- 설정 파일 검사
- Docker 이미지 스캔 (있는 경우)

### Gosec

Go 보안 검사:
- SQL Injection
- Command Injection
- 파일 시스템 접근
- 암호화 사용

### CodeQL

정적 코드 분석:
- 보안 취약점 패턴
- 코드 스멜 탐지
- 잠재적 버그

---

## 아티팩트 관리

### 빌드 아티팩트

- **보관 기간**: 7일
- **위치**: GitHub Actions Artifacts
- **용도**: 배포 및 테스트

### 릴리스 아티팩트

- **보관 기간**: 90일
- **형식**: tar.gz + SHA256 체크섬
- **위치**: GitHub Releases

---

## GitHub Actions 설정

### 필수 Secrets

현재는 필요 없지만, 향후 추가 가능:

- `CODECOV_TOKEN`: Codecov 업로드용 (선택)
- `DOCKER_HUB_TOKEN`: Docker 이미지 푸시용 (선택)

### 권한 설정

워크플로우 파일에 필요한 권한:
- `contents: read` - 코드 읽기
- `contents: write` - 릴리스 생성
- `security-events: write` - 보안 이벤트 업로드

---

## 문제 해결

### CI 실패 원인

1. **테스트 실패**
   - 로컬에서 테스트 실행하여 재현
   - 로그 확인

2. **린터 실패**
   - 로컬에서 린터 실행
   - 자동 수정 가능한 경우 자동 수정

3. **빌드 실패**
   - 의존성 문제 확인
   - Go/Rust 버전 확인

4. **보안 스캔 실패**
   - 취약점 리포트 확인
   - 의존성 업데이트

### 로그 확인

GitHub Actions에서:
1. 실패한 워크플로우 클릭
2. 실패한 Job 클릭
3. 실패한 Step 로그 확인

### 로컬 재현

```bash
# CI 환경과 동일한 환경 구성
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  golang:1.24 \
  bash

# 또는 Rust
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  rust:stable \
  bash
```

---

## 최적화 팁

### 캐싱 활용

- Go 모듈 캐시
- Rust 의존성 캐시
- 빌드 아티팩트 재사용

### 병렬 실행

- Backend와 Agent는 병렬 실행
- 독립적인 작업은 `needs` 없이 실행

### 조건부 실행

- Integration 테스트는 main 브랜치에만
- Release는 태그/수동 트리거만

---

## 향후 개선 사항

- [ ] Docker 이미지 빌드 및 푸시
- [ ] 자동 배포 (프로덕션 환경)
- [ ] 성능 벤치마크 통합
- [ ] E2E 테스트 자동화
- [ ] 멀티 아키텍처 빌드 (ARM64 등)
- [ ] 자동 버전 관리 (semantic-release)

---

## 관련 문서

- [Docker 배포](../docker/deployment.md)
- [개발 시작하기](../../02-development/getting-started.md)
- [기여 가이드](../../02-development/contributing.md)

---

**태그**: `#배포` `#CI/CD` `#GitHub-Actions` `#자동화` `#테스트`

**카테고리**: 배포 > CI/CD > 설정

**마지막 업데이트**: 2024-12-23
