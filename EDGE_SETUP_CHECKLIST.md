# Edge Supply Chain 파이프라인 설정 체크리스트

## ✅ 1. PR 머지 완료

- [x] PR 머지 완료
- [x] main 브랜치에 모든 파일 반영 확인

## 📋 2. GitHub Environment/Secrets 설정 (대표님께 요청)

### Environment 생성
1. GitHub 저장소 → Settings → Environments
2. "New environment" 클릭
3. Environment name: `prod-edge` 입력
4. "Configure environment" 클릭
5. (선택) Protection rules 설정 (예: Required reviewers)

### Secrets 설정
1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. "New repository secret" 클릭하여 아래 3개 생성:

#### PROD_EDGE_SSH_HOST
- Name: `PROD_EDGE_SSH_HOST`
- Value: Edge 서버 호스트명 또는 IP (예: `edge.example.com`)

#### PROD_EDGE_SSH_USER
- Name: `PROD_EDGE_SSH_USER`
- Value: SSH 사용자명 (예: `deploy`)

#### PROD_EDGE_SSH_KEY
- Name: `PROD_EDGE_SSH_KEY`
- Value: SSH 개인키 전체 내용 (-----BEGIN OPENSSH PRIVATE KEY----- ... -----END OPENSSH PRIVATE KEY-----)

### Secret 이름 확인
워크플로에서 사용하는 Secret 이름:
- `PROD_EDGE_SSH_HOST` ✅
- `PROD_EDGE_SSH_USER` ✅
- `PROD_EDGE_SSH_KEY` ✅

**위 3개 이름이 정확히 일치하는지 확인하세요.**

## 🖥️ 3. Edge 서버 준비 (운영자 실행)

Edge 서버에서 다음 명령을 실행하세요:

```bash
# 디렉토리 생성 및 권한 설정
sudo mkdir -p /opt/limen/edge
sudo chown -R $USER:$USER /opt/limen/edge

# Docker 확인
docker --version
docker compose version

# 디렉토리 확인
ls -la /opt/limen/edge
```

### docker-compose.yml 생성

`/opt/limen/edge/docker-compose.yml` 파일을 생성하세요:

```yaml
version: '3.8'
services:
  edge:
    image: ${LIMEN_EDGE_IMAGE}
    restart: unless-stopped
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**중요**: `deploy-edge.sh` 스크립트는 `/opt/limen/edge/docker-compose.yml`을 사용합니다.

## 🚀 4. 릴리즈+배포 리허설

### 4-1. 릴리즈 태그 생성 및 푸시

```bash
git tag edge-v0.1.0-rc1
git push origin edge-v0.1.0-rc1
```

### 4-2. Release 워크플로 확인

1. GitHub Actions → "Release Edge" 워크플로 확인
2. 실행 완료 후 Job Summary에서 **Image Digest** 확인
3. 예시: `sha256:abc123def456...`

### 4-3. Deploy 워크플로 실행

1. GitHub Actions → "Deploy Edge Production" 워크플로
2. "Run workflow" 클릭
3. `image_digest` 입력: 위에서 확인한 digest (예: `sha256:abc123def456...`)
4. "Run workflow" 클릭

### 4-4. 배포 성공 확인

서버에서 실행:

```bash
# 헬스체크 확인
curl -fsS http://127.0.0.1:3000/healthz

# 또는
curl -fsS http://localhost:3000/healthz
```

예상 응답:
```json
{"status":"ok","timestamp":"2025-01-XX..."}
```

### 4-5. 롤백 테스트 (선택)

의도적으로 헬스체크를 실패시켜 롤백이 동작하는지 확인:

1. 서버에서 컨테이너의 헬스체크를 일시적으로 비활성화
2. 새 배포 실행
3. 헬스체크 실패 시 자동 롤백 확인

## 🔒 5. 브랜치 보호 설정 (대표님께 요청)

1. GitHub 저장소 → Settings → Branches
2. "Add rule" 또는 기존 main 브랜치 규칙 편집
3. "Require status checks to pass before merging" 체크
4. "Require branches to be up to date before merging" 체크
5. Status checks에서 다음을 추가:
   - `Edge Lint` (pr_edge.yml)
   - `Edge TypeCheck` (pr_edge.yml)
   - `Edge Test` (pr_edge.yml)

## 📊 검증 체크리스트

### PR 검증
- [x] pr_edge.yml 체크 PASS (lint/typecheck/test)
- [x] deploy_edge_prod.yml에 verify gate 존재
  - [x] `gh attestation verify ...`
  - [x] `cosign verify ...`
- [x] deploy-edge.sh가 @sha256: 아닌 입력 거부
- [x] /healthz 엔드포인트 존재

### 파일 존재 확인
- [x] `.github/workflows/_reusable_build_image.yml`
- [x] `.github/workflows/release_edge.yml`
- [x] `.github/workflows/deploy_edge_prod.yml`
- [x] `scripts/deploy/edge/deploy-edge.sh`
