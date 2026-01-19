# P0 작업 상태 보고서

## ✅ P0-4: 파일명/참조 경로 정합성 점검 (완료)

### 검증 결과: ✅ **모든 경로 정합성 확인 완료**

#### 1. 실제 파일명
- ✅ **파일명**: `.github/workflows/_reusable_build_image.yml` (언더스코어 포함)
- ✅ **존재 확인**: 파일 존재함

#### 2. release_edge.yml 호출 경로
- ✅ **호출 경로**: `uses: ./.github/workflows/_reusable_build_image.yml` (11줄)
- ✅ **정합성**: 실제 파일명과 **정확히 일치**

#### 3. deploy-edge.sh 경로
- ✅ **docker-compose.yml 경로**: `/opt/limen/edge/docker-compose.yml` (20줄)
- ✅ **헬스체크 URL**: `http://127.0.0.1:3000/healthz` (95줄)

#### 4. Dockerfile 포트
- ✅ **포트**: `EXPOSE 3000` (Dockerfile 48줄)
- ✅ **헬스체크**: `http://localhost:3000/healthz` (Dockerfile 56줄)

### 결론

**✅ 모든 파일명과 참조 경로가 정합성 있게 일치합니다.**
**수정 불필요**

---

## 📋 대표님 작업 체크리스트

### P0-1: GitHub Environment/Secrets (즉시)

**작업 위치**: Repository → Settings → Environments

**작업 내용**:
1. **"New environment"** 클릭
2. Environment name: `prod-edge` 입력
3. **"Configure environment"** 클릭

**Secrets 추가** (Repository → Settings → Secrets and variables → Actions):
1. **"New repository secret"** 클릭
2. 아래 3개 생성 (이름 정확히 일치):

| Secret 이름 | 설명 | 예시 |
|------------|------|------|
| `PROD_EDGE_SSH_HOST` | Edge 서버 호스트명/IP | `edge.example.com` 또는 IP |
| `PROD_EDGE_SSH_USER` | SSH 사용자명 | `deploy` |
| `PROD_EDGE_SSH_KEY` | SSH 개인키 전체 텍스트 | `-----BEGIN OPENSSH PRIVATE KEY----- ... -----END OPENSSH PRIVATE KEY-----` |

**⚠️ 중요**: Secret 이름이 정확히 위 3개와 일치해야 합니다 (대소문자 구분).

### P0-2: Branch Protection (즉시)

**작업 위치**: Repository → Settings → Branches → Branch protection rules

**작업 내용**:
1. main 브랜치에 룰 추가/수정
2. **"Require status checks to pass before merging"** 체크
3. **"Require branches to be up to date before merging"** 체크
4. Status checks에서 다음을 **Required**로 지정:
   - ✅ `Edge Lint` (pr_edge.yml에서 생성)
   - ✅ `Edge TypeCheck` (pr_edge.yml에서 생성)
   - ✅ `Edge Test` (pr_edge.yml에서 생성)
5. (가능하면) **"Include administrators"** 체크 (예외 제거)

---

## 🖥️ 운영자(Edge 서버) 작업 체크리스트

### P0-3: 서버 준비 (즉시)

**아래 명령을 "줄바꿈 포함" 그대로 실행**:

```bash
sudo mkdir -p /opt/limen/edge
sudo chown -R $USER:$USER /opt/limen/edge

docker --version
docker compose version

ls -la /opt/limen/edge
ls -la /opt/limen/edge/docker-compose.yml
```

**docker-compose.yml 생성** (`/opt/limen/edge/docker-compose.yml`):

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

**⚠️ 중요 확인사항**:
- ✅ docker-compose.yml은 **반드시** `/opt/limen/edge/docker-compose.yml`에 있어야 함
- ✅ healthz 체크 URL: `http://127.0.0.1:3000/healthz`
- ✅ compose가 로컬에서 **3000 포트를 실제로 리슨**하는지 확인 필요

---

## 🚀 Edge 에이전트 작업 (2026-01-20)

### P0-5: 리허설 실행

**실행 일시**: 2026-01-20

#### 1. 태그 생성/푸시
```bash
git tag edge-v0.1.0-rc1
git push origin edge-v0.1.0-rc1
```

#### 2. Release 워크플로 확인
- GitHub Actions → **"Release Edge"** 워크플로 실행 확인
- Job Summary에서 **GHCR digest 획득** (`sha256:...`)

#### 3. Deploy 워크플로 실행
- GitHub Actions → **"Deploy Edge Production"** → **"Run workflow"**
- 입력값: `image_digest` = 위에서 획득한 digest (예: `sha256:abc123...`)

#### 4. 배포 후 확인
서버에서 실행:
```bash
curl -fsS http://127.0.0.1:3000/healthz
```

**예상 응답**:
```json
{"status":"ok","timestamp":"2025-01-XX..."}
```

#### 5. 롤백 테스트 (선택, 운영 시간 고려)
- healthz 실패 상황 1회 유도
- 자동 롤백 실제 동작 확인

---

## 📊 최종 상태 요약

### ✅ 완료
- ✅ P0-4: 파일명/참조 경로 정합성 점검 완료 (수정 불필요)

### ⏳ 대기 중
- ⏳ P0-1: GitHub Environment/Secrets (대표님)
- ⏳ P0-2: Branch Protection (대표님)
- ⏳ P0-3: 서버 준비 (운영자)
- ⏳ P0-5: 리허설 실행 (2026-01-20)

---

## 🔗 참고 링크

- **워크플로 파일**: https://github.com/DARC0625/LIMEN/tree/main/.github/workflows
- **배포 스크립트**: https://github.com/DARC0625/LIMEN/blob/main/scripts/deploy/edge/deploy-edge.sh
- **검증 보고서**: https://github.com/DARC0625/LIMEN/blob/main/P0_VERIFICATION_REPORT.md
