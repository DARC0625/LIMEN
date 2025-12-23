.PHONY: help build-backend build-frontend build-agent clean dev test

help: ## 도움말 표시
	@echo "사용 가능한 명령어:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build-backend: ## 백엔드 빌드
	@echo "Building backend..."
	cd backend && go build -o server ./cmd/server
	@echo "Backend build complete: backend/server"

build-frontend: ## 프론트엔드 빌드
	@echo "Building frontend..."
	cd frontend && npm install && npm run build
	@echo "Frontend build complete: frontend/.next"

build-agent: ## 에이전트 빌드
	@echo "Building agent..."
	cd backend/agent && cargo build --release
	@echo "Agent build complete: backend/agent/target/release/agent"

build-all: build-backend build-frontend build-agent ## 모든 컴포넌트 빌드

clean: ## 빌드 아티팩트 정리
	@echo "Cleaning build artifacts..."
	rm -f backend/server backend/backend
	rm -rf frontend/.next frontend/out frontend/build
	rm -rf backend/agent/target
	@echo "Clean complete"

clean-logs: ## 로그 파일 정리
	@echo "Cleaning log files..."
	find . -name "*.log" -type f -delete
	@echo "Log files cleaned"

dev-backend: ## 백엔드 개발 모드 실행
	@echo "Starting backend in dev mode..."
	cd backend && go run ./cmd/server

dev-frontend: ## 프론트엔드 개발 모드 실행
	@echo "Starting frontend in dev mode..."
	cd frontend && npm run dev

test-backend: ## 백엔드 테스트 실행
	@echo "Running backend tests..."
	cd backend && go test -v ./...

test-backend-race: ## 백엔드 테스트 실행 (race detector)
	@echo "Running backend tests with race detector..."
	cd backend && go test -v -race ./...

test-backend-cover: ## 백엔드 테스트 커버리지
	@echo "Running backend tests with coverage..."
	cd backend && go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html && echo "Coverage report: backend/coverage.html"

test-agent: ## 에이전트 테스트 실행
	@echo "Running agent tests..."
	cd backend/agent && cargo test --verbose

lint-agent: ## 에이전트 린트
	@echo "Linting agent..."
	cd backend/agent && cargo clippy -- -D warnings

format-agent: ## 에이전트 코드 포맷
	@echo "Formatting agent code..."
	cd backend/agent && cargo fmt

format-check-agent: ## 에이전트 코드 포맷 검사
	@echo "Checking agent code format..."
	cd backend/agent && cargo fmt -- --check || (echo "Code is not formatted. Run 'make format-agent'" && exit 1)

ci-local: format-check-backend lint-backend test-backend-race format-check-agent lint-agent test-agent ## CI 로컬 실행
	@echo "✅ All CI checks passed locally!"

lint-backend: ## 백엔드 린트
	@echo "Linting backend..."
	cd backend && golangci-lint run || echo "golangci-lint not installed. Install: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"

lint-backend-fix: ## 백엔드 린트 자동 수정
	@echo "Fixing backend linting issues..."
	cd backend && golangci-lint run --fix || echo "golangci-lint not installed"

format-backend: ## 백엔드 코드 포맷
	@echo "Formatting backend code..."
	cd backend && gofmt -s -w .

format-check-backend: ## 백엔드 코드 포맷 검사
	@echo "Checking backend code format..."
	cd backend && gofmt -s -d . || (echo "Code is not formatted. Run 'make format-backend'" && exit 1)

lint-frontend: ## 프론트엔드 린트
	@echo "Linting frontend..."
	cd frontend && npm run lint

setup: ## 초기 설정 (의존성 설치)
	@echo "Setting up project..."
	cd backend && go mod download
	cd frontend && npm install
	cd backend/agent && cargo fetch
	@echo "Setup complete"

check-env: ## 환경 변수 파일 확인
	@echo "Checking environment files..."
	@test -f backend/.env || echo "⚠️  backend/.env not found (copy from env.example)"
	@test -f frontend/.env.local || echo "⚠️  frontend/.env.local not found (copy from .env.example)"


