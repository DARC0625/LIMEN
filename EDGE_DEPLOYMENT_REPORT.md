# Edge Supply Chain 파이프라인 배포 보고서

## ✅ 1. PR 머지 완료

**상태**: ✅ **완료**

**머지 커밋**: `dae21a3` (Squash merge)

### 검증 결과

#### ✅ pr_edge.yml 체크
- **Edge Lint**: ✅ PASS (lint 실행)
- **Edge TypeCheck**: ✅ PASS (type-check 실행)
- **Edge Test**: ✅ PASS (test 실행)

#### ✅ deploy_edge_prod.yml Verify Gate 확인
- ✅ **Attestation 검증**: `gh attestation verify "oci://${IMAGE_NAME}@${digest}"` (84줄)
- ✅ **Signature 검증**: `cosign verify` with issuer/identity 제한 (106-109줄)

#### ✅ deploy-edge.sh 태그 거부 확인
- ✅ 15-18줄: `@sha256:` 아닌 입력 즉시 실패
```bash
if [[ "${IMAGE_REF}" != *@sha256:* ]]; then
  echo "FATAL: tag deploy is forbidden. Use digest only."
  exit 1
fi
```

#### ✅ /healthz 엔드포인트 확인
- ✅ `frontend/app/healthz/route.ts` 존재
- ✅ 경로: `/healthz`
- ✅ 응답: `{ status: 'ok', timestamp: '...' }`

### Main 브랜치 파일 확인

모든 파일이 main 브랜치에 반영되었습니다:

1. ✅ `.github/workflows/_reusable_build_image.yml`
   - 링크: https://github.com/DARC0625/LIMEN/blob/main/.github/workflows/_reusable_build_image.yml

2. ✅ `.github/workflows/release_edge.yml`
   - 링크: https://github.com/DARC0625/LIMEN/blob/main/.github/workflows/release_edge.yml

3. ✅ `.github/workflows/deploy_edge_prod.yml`
   - 링크: https://github.com/DARC0625/LIMEN/blob/main/.github/workflows/deploy_edge_prod.yml

4. ✅ `scripts/deploy/edge/deploy-edge.sh`
   - 링크: https://github.com/DARC0625/LIMEN/blob/main/scripts/deploy/edge/deploy-edge.sh

---

## 📋 2. GitHub Environment/Secrets 설정 (대표님께 요청)

### ✅ Secret 이름 확인

워크플로에서 사용하는 Secret 이름과 일치합니다:
- ✅ `PROD_EDGE_SSH_HOST` (121줄)
- ✅ `PROD_EDGE_SSH_USER` (122줄)
- ✅ `PROD_EDGE_SSH_KEY` (115줄)

### 설정 체크리스트

**대표님께 전달할 내용:**

#### Environment 생성
1. GitHub 저장소 → **Settings** → **Environments**
2. **"New environment"** 클릭
3. Environment name: `prod-edge` 입력
4. **"Configure environment"** 클릭

#### Secrets 설정
1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**
2. **"New repository secret"** 클릭하여 아래 3개 생성:

| Secret 이름 | 설명 | 예시 값 |
|------------|------|---------|
| `PROD_EDGE_SSH_HOST` | Edge 서버 호스트명/IP | `edge.example.com` |
| `PROD_EDGE_SSH_USER` | SSH 사용자명 | `deploy` |
| `PROD_EDGE_SSH_KEY` | SSH 개인키 전체 내용 | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |

**⚠️ 중요**: Secret 이름이 정확히 위 3개와 일치해야 합니다.

**설정 완료 여부**: ⏳ 대표님 확인 대기

---

## 🖥️ 3. Edge 서버 준비 (운영자 실행)

### 서버 준비 명령

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

**✅ 경로 확인**: `deploy-edge.sh`는 `/opt/limen/edge/docker-compose.yml`을 사용합니다 (40줄).

**서버 준비 완료 여부**: ⏳ 운영자 확인 대기

---

## 🚀 4. 릴리즈+배포 리허설 (내일 실행)

### 4-1. 릴리즈 태그 생성

```bash
git tag edge-v0.1.0-rc1
git push origin edge-v0.1.0-rc1
```

### 4-2. Release 워크플로 확인

1. GitHub Actions → **"Release Edge"** 워크플로 확인
2. 실행 완료 후 **Job Summary**에서 **Image Digest** 확인
3. 예시: `sha256:abc123def456...`

**예상 실행 링크**: `https://github.com/DARC0625/LIMEN/actions/workflows/release_edge.yml`

**Release 실행 링크**: ⏳ 실행 후 업데이트

**산출 digest**: ⏳ 실행 후 업데이트

### 4-3. Deploy 워크플로 실행

1. GitHub Actions → **"Deploy Edge Production"** 워크플로
2. **"Run workflow"** 클릭
3. `image_digest` 입력: 위에서 확인한 digest (예: `sha256:abc123def456...`)
4. **"Run workflow"** 클릭

**예상 실행 링크**: `https://github.com/DARC0625/LIMEN/actions/workflows/deploy_edge_prod.yml`

**Deploy 실행 링크**: ⏳ 실행 후 업데이트

### 4-4. 배포 성공 확인

서버에서 실행:

```bash
curl -fsS http://127.0.0.1:3000/healthz
```

**예상 응답**:
```json
{"status":"ok","timestamp":"2025-01-XX..."}
```

**healthz 결과**: ⏳ 배포 후 업데이트

### 4-5. 롤백 테스트 (선택)

의도적으로 헬스체크를 실패시켜 롤백이 동작하는지 확인:

1. 서버에서 컨테이너의 헬스체크를 일시적으로 비활성화
2. 새 배포 실행
3. 헬스체크 실패 시 자동 롤백 확인

**롤백 테스트 결과**: ⏳ 테스트 후 업데이트

---

## 🔒 5. 브랜치 보호 설정 (대표님께 요청)

**대표님께 전달할 내용:**

1. GitHub 저장소 → **Settings** → **Branches**
2. **"Add rule"** 또는 기존 main 브랜치 규칙 편집
3. **"Require status checks to pass before merging"** 체크
4. **"Require branches to be up to date before merging"** 체크
5. Status checks에서 다음을 추가:
   - ✅ `Edge Lint` (pr_edge.yml)
   - ✅ `Edge TypeCheck` (pr_edge.yml)
   - ✅ `Edge Test` (pr_edge.yml)

**브랜치 보호 설정 완료 여부**: ⏳ 대표님 확인 대기

---

## 📊 최종 보고 요약

### ✅ 완료된 항목

- ✅ PR 머지 완료 (커밋: `dae21a3`)
- ✅ 모든 파일 main 브랜치 반영 확인
- ✅ Verify gate 검증 완료
- ✅ 태그 거부 로직 확인
- ✅ Health check 엔드포인트 확인

### ⏳ 대기 중인 항목

- ⏳ GitHub Environment/Secrets 설정 (대표님)
- ⏳ Edge 서버 준비 (운영자)
- ⏳ 릴리즈+배포 리허설 (내일)
- ⏳ 브랜치 보호 설정 (대표님)

### 📝 다음 단계

1. **즉시**: 대표님께 Environment/Secrets 설정 요청
2. **즉시**: 운영자에게 서버 준비 명령 전달
3. **내일**: 릴리즈 태그 생성 및 배포 리허설 실행
4. **내일**: 브랜치 보호 설정 요청

---

## 🔗 참고 링크

- **워크플로 파일**: https://github.com/DARC0625/LIMEN/tree/main/.github/workflows
- **배포 스크립트**: https://github.com/DARC0625/LIMEN/blob/main/scripts/deploy/edge/deploy-edge.sh
- **설정 체크리스트**: https://github.com/DARC0625/LIMEN/blob/main/EDGE_SETUP_CHECKLIST.md
