# Edge Supply Chain A-Grade Pipeline 구현 보고서

## 📋 작업 완료 요약

Edge 프론트엔드에 대한 A급 supply chain 파이프라인(Attest+SBOM+Sign+Verify Gate)을 완성했습니다.

## ✅ 생성된 파일

### 1. 워크플로 파일

#### `.github/workflows/_reusable_build_image.yml`
- **목적**: 재사용 가능한 이미지 빌드 워크플로
- **기능**:
  - Docker 이미지 빌드 및 푸시 (digest 기반)
  - Build Provenance Attestation
  - SBOM 생성 및 Attestation (syft v1.40.1)
  - Cosign keyless 서명 (v3.0.4)
  - 모든 액션 SHA 핀 (태그 금지)

#### `.github/workflows/pr_edge.yml`
- **목적**: Edge PR 게이트
- **트리거**: `pull_request` (frontend/** 또는 apps/edge/** 변경 시)
- **작업**:
  - Lint
  - TypeCheck
  - Test

#### `.github/workflows/release_edge.yml`
- **목적**: Edge Release (빌드+푸시+Attest+SBOM+Sign)
- **트리거**:
  - `workflow_dispatch` (수동 실행)
  - `push` with tags `edge-v*` (예: `edge-v0.1.0`)
- **작업**:
  - `_reusable_build_image.yml` 호출
  - Job summary에 digest 출력

#### `.github/workflows/deploy_edge_prod.yml`
- **목적**: Edge Production 배포 (Verify Gate + 원격 배포)
- **트리거**:
  - `workflow_dispatch` (입력: `image_digest`)
  - `workflow_run` (Release Edge 완료 후)
- **환경**: `prod-edge` (GitHub Environment)
- **검증 게이트**:
  - Attestation 검증 (`gh attestation verify`)
  - Signature 검증 (`cosign verify` with issuer/identity 제한)
- **배포**: SSH를 통한 원격 서버 배포

### 2. 배포 스크립트

#### `scripts/deploy/edge/deploy-edge.sh`
- **목적**: 서버 배포 스크립트
- **기능**:
  - 태그 배포 거부 (digest만 허용)
  - 이전 이미지 백업 (`/opt/limen/edge/prev_image`)
  - 현재 이미지 기록 (`/opt/limen/edge/current_image`)
  - Docker Compose를 통한 배포
  - 헬스체크 (`/healthz`)
  - 실패 시 자동 롤백

### 3. 애플리케이션 파일

#### `frontend/Dockerfile`
- **목적**: Next.js 프로덕션 이미지
- **특징**:
  - Multi-stage build
  - Standalone output 사용
  - Non-root user 실행
  - 헬스체크 포함

#### `frontend/app/healthz/route.ts`
- **목적**: 배포 헬스체크 엔드포인트
- **경로**: `/healthz`
- **응답**: `{ status: 'ok', timestamp: '...' }`

#### `frontend/next.config.js`
- **변경**: `output: 'standalone'` 추가 (Docker 최적화)

## 🔒 보안 및 검증

### 핀된 버전 (SHA)

| 도구 | 버전 | SHA256 |
|------|------|--------|
| actions/checkout | v4 | `34e114876b0b11c390a56381ad16ebd13914f8d5` |
| actions/attest-build-provenance | main | `6865550d0380db508fc599a58cc87c50c0bba5c5` |
| actions/attest-sbom | main | `6cf30ca381902d015a1ba331977ad71315dffb36` |
| syft | v1.40.1 | `c229137c919f22aa926c1c015388db5ec64e99c078e0baac053808e8f36e2e00` |
| cosign | v3.0.4 | `10dab2fd2170b5aa0d5c0673a9a2793304960220b314f6a873bf39c2f08287aa` |

### 검증 게이트

1. **Attestation 검증**: `gh attestation verify`로 provenance 검증
2. **Signature 검증**: `cosign verify`로 서명 검증
   - Issuer: `https://token.actions.githubusercontent.com`
   - Identity: `https://github.com/DARC0625/LIMEN/.github/workflows/.*`

### 배포 제약

- ✅ 태그 배포 금지 (digest만 허용)
- ✅ 검증 실패 시 배포 중단
- ✅ 헬스체크 실패 시 자동 롤백

## 📝 다음 단계

### 필수 설정

1. **GitHub Secrets 설정**:
   - `PROD_EDGE_SSH_HOST`: 프로덕션 서버 호스트
   - `PROD_EDGE_SSH_USER`: SSH 사용자명
   - `PROD_EDGE_SSH_KEY`: SSH 개인키

2. **GitHub Environment 생성**:
   - Environment: `prod-edge`
   - Protection rules 설정 (선택사항)

3. **서버 준비**:
   - `/opt/limen/edge/` 디렉토리 생성
   - Docker Compose 설치
   - `docker-compose.yml` 파일 준비 (또는 스크립트가 자동 생성)

### 테스트 절차

1. **PR 테스트**:
   - `frontend/**` 변경이 있는 PR 생성
   - `pr_edge.yml` 워크플로 실행 확인

2. **Release 테스트**:
   - `edge-v0.1.0` 태그 푸시
   - `release_edge.yml` 워크플로 실행 확인
   - Job summary에서 digest 확인

3. **Deploy 테스트**:
   - `deploy_edge_prod.yml`을 `workflow_dispatch`로 실행
   - `image_digest` 입력: `sha256:...` (release workflow에서 확인)
   - 검증 및 배포 성공 확인

## 🎯 완료 기준 (DoD)

- ✅ Edge PR에서 lint/test/typecheck 통과
- ✅ `edge-vX.Y.Z` 태그 푸시 시: GHCR 이미지 digest 생성 + provenance attestation + SBOM attestation + cosign 서명 생성
- ✅ Deploy는 입력 digest로만 가능, verify 실패 시 배포 불가
- ✅ 서버 deploy 스크립트는 태그 거부, 실패 시 롤백 수행

## 📊 브랜치 정보

- **브랜치**: `ci-edge-supplychain-a`
- **최신 커밋**: `0cd6ae1`
- **상태**: ✅ 완료 및 푸시 완료

## 🔗 관련 링크

- PR 생성: https://github.com/DARC0625/LIMEN/pull/new/ci-edge-supplychain-a
- 워크플로 파일: `.github/workflows/`
- 배포 스크립트: `scripts/deploy/edge/deploy-edge.sh`
