# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

## [Unreleased]

### Phase 4: 기능 확장 (진행 중)

#### 추가된 기능
- **JWT 인증/인가 시스템**
  - 사용자 로그인 API (`POST /api/auth/login`)
  - 사용자 회원가입 API (`POST /api/auth/register`)
  - JWT 토큰 기반 인증 미들웨어
  - 비밀번호 bcrypt 해싱
  - 공개 엔드포인트 제외한 모든 API 보호

- **Rate Limiting**
  - IP 기반 Rate Limiting 미들웨어
  - 환경 변수로 설정 가능
  - 초당 요청 수 및 버스트 크기 제한

#### 변경된 항목
- Admin 계정 비밀번호가 해싱되어 저장됨
- VM 생성 시 OwnerID가 인증 컨텍스트에서 가져옴
- 미들웨어 체인에 인증 및 Rate Limiting 추가

#### 새로운 파일
- `backend/internal/auth/auth.go` - 인증 로직
- `backend/internal/middleware/auth.go` - 인증 미들웨어
- `backend/internal/middleware/ratelimit.go` - Rate Limiting 미들웨어
- `backend/internal/handlers/auth.go` - 인증 핸들러
- `backend/internal/auth/auth_test.go` - 인증 테스트

#### 문서화
- 모든 MD 파일을 `docs/` 폴더로 정리
- `docs/INDEX.md` - 문서 인덱스 추가
- `docs/PHASE4_PROGRESS.md` - Phase 4 진행 상황 문서

---

## [2024-12-14] - Phase 3 완료

### Phase 3: 테스트 및 문서화

#### 추가된 항목
- 단위 테스트 작성 (validator, models, config)
- 통합 테스트 작성 (API 엔드포인트)
- API 문서화 (OpenAPI 3.0 스펙)
- 테스트 커버리지 확인 도구

#### 생성된 파일
- `backend/internal/validator/validator_test.go`
- `backend/internal/models/status_test.go`
- `backend/internal/config/config_test.go`
- `backend/cmd/server/main_test.go`
- `backend/docs/swagger.yaml`
- `backend/API_DOCUMENTATION.md`
- `backend/TESTING.md`
- `backend/Makefile`

---

## [2024-12-14] - Phase 2 완료

### Phase 2: 코드 품질 개선

#### 추가된 항목
- 라우팅 구조 개선 (gorilla/mux)
- 미들웨어 체인 구축 (CORS, RequestID, Logging, Recovery)
- 입력 검증 미들웨어
- 타입 안정성 개선 (VMStatus, VMAction 상수)

#### 생성된 파일
- `backend/internal/middleware/middleware.go`
- `backend/internal/router/router.go`
- `backend/internal/validator/validator.go`
- `backend/internal/models/status.go`

---

## [2024-12-14] - Phase 1 완료

### Phase 1: 보안 강화

#### 제거된 항목
- 하드코딩된 데이터베이스 연결 정보
- 하드코딩된 파일 경로
- 하드코딩된 admin 비밀번호
- CORS 모든 Origin 허용

#### 추가된 항목
- 환경 변수 기반 설정
- CORS Origin 검증
- WebSocket Origin 검증
- 구조화된 로깅 시스템 (zap)
- 표준화된 에러 핸들링

#### 생성된 파일
- `backend/internal/logger/logger.go`
- `backend/internal/errors/errors.go`

---

## [2024-12-14] - 프로젝트 최적화

### 최적화 및 정리

#### 제거된 항목
- 불필요한 로그 파일 (`*.log`)
- `backend/temp_frontend/` 디렉토리
- 루트의 배포 아카이브 파일

#### 추가된 항목
- `.gitignore` 개선
- `.dockerignore` 추가
- `.editorconfig` 추가
- `Makefile` 추가
- `PROJECT_STRUCTURE.md` 추가
- `CHANGELOG.md` 추가
- `backend/uploads/.gitkeep` 추가
- `backend/pkg/.gitkeep` 추가
- `frontend/.env.example` 추가

#### 개선된 항목
- `README.md` 전면 개선
- 코드 주석 추가
- 프로젝트 구조 표준화
- 문서화 강화

---

## 향후 계획

### 단기 (1-2주)
- [ ] VM 스냅샷 기능
- [ ] 리소스 할당량 관리
- [ ] 더 많은 통합 테스트

### 중기 (1-2개월)
- [ ] 모니터링 메트릭 (Prometheus)
- [ ] 백업/복구 기능
- [ ] 네트워크 관리

### 장기 (3-6개월)
- [ ] Kubernetes 배포
- [ ] CI/CD 파이프라인
- [ ] 로그 집계 시스템
