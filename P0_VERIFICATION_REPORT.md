# P0 작업 검증 보고서

## ✅ P0-4: 파일명/참조 경로 정합성 점검 (완료)

### 검증 결과

#### 1. 실제 파일명 확인
- ✅ **파일명**: `.github/workflows/_reusable_build_image.yml` (언더스코어 포함)
- ✅ **존재 확인**: 파일 존재함

#### 2. release_edge.yml 호출 경로 확인
- ✅ **호출 경로**: `uses: ./.github/workflows/_reusable_build_image.yml` (11줄)
- ✅ **정합성**: 실제 파일명과 일치함

#### 3. deploy-edge.sh 경로 확인
- ✅ **docker-compose.yml 경로**: `/opt/limen/edge/docker-compose.yml` (40줄)
- ✅ **헬스체크 URL**: `http://127.0.0.1:3000/healthz` (95줄)

#### 4. Dockerfile 포트 확인
- ✅ **포트**: `EXPOSE 3000` (Dockerfile 48줄)
- ✅ **헬스체크**: `http://localhost:3000/healthz` (Dockerfile 52줄)

### 결론

**✅ 모든 파일명과 참조 경로가 정합성 있게 일치합니다.**
**수정 불필요**

---

## 📋 P0-1, P0-2, P0-3: 대표님/운영자 작업 체크리스트

### P0-1: GitHub Environment/Secrets (대표님)

**상태**: ⏳ 대표님 확인 대기

**작업 내용**:
1. Repository → Settings → Environments → New environment
2. 이름: `prod-edge`
3. Secrets 3개 추가:
   - `PROD_EDGE_SSH_HOST`
   - `PROD_EDGE_SSH_USER`
   - `PROD_EDGE_SSH_KEY` (개인키 전체 텍스트)

### P0-2: Branch Protection (대표님)

**상태**: ⏳ 대표님 확인 대기

**작업 내용**:
1. Repository → Settings → Branches → Branch protection rules
2. main에 룰 추가/수정:
   - "Require status checks to pass before merging" 체크
   - pr_edge.yml에서 생성되는 체크를 Required로 지정:
     - `Edge Lint`
     - `Edge TypeCheck`
     - `Edge Test`
   - (가능하면) "Include administrators"도 켜기

### P0-3: 서버 준비 (운영자)

**상태**: ⏳ 운영자 확인 대기

**작업 내용** (줄바꿈 포함 그대로 실행):

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

**중요 확인사항**:
- ✅ docker-compose.yml은 반드시 `/opt/limen/edge/docker-compose.yml`에 있어야 함
- ✅ healthz 체크 URL: `http://127.0.0.1:3000/healthz`
- ✅ compose가 로컬에서 3000 포트를 실제로 리슨하는지 확인 필요

---

## 🚀 P0-5: 리허설 실행 (2026-01-20 예정)

**상태**: ⏳ 2026-01-20 실행 예정

### 실행 절차

#### 1. 태그 생성/푸시
```bash
git tag edge-v0.1.0-rc1
git push origin edge-v0.1.0-rc1
```

#### 2. Release 워크플로 확인
- GitHub Actions → "Release Edge" 워크플로 실행 확인
- Job Summary에서 GHCR digest 획득 (`sha256:...`)

#### 3. Deploy 워크플로 실행
- GitHub Actions → "Deploy Edge Production" → "Run workflow"
- 입력값: `image_digest` = 위에서 획득한 digest

#### 4. 배포 후 확인
```bash
curl -fsS http://127.0.0.1:3000/healthz
```

#### 5. 롤백 테스트 (선택, 운영 시간 고려)
- healthz 실패 상황 1회 유도
- 자동 롤백 실제 동작 확인

---

## 📊 최종 상태

### ✅ 완료
- ✅ P0-4: 파일명/참조 경로 정합성 점검 완료 (수정 불필요)

### ⏳ 대기
- ⏳ P0-1: GitHub Environment/Secrets (대표님)
- ⏳ P0-2: Branch Protection (대표님)
- ⏳ P0-3: 서버 준비 (운영자)
- ⏳ P0-5: 리허설 실행 (2026-01-20)
