# Edge 릴리즈+배포 리허설 런북 (2026-01-20)

## 🎯 목표

Edge supply chain 파이프라인의 전체 흐름을 1회 실행하여 검증:
1. 태그 생성 → Release 워크플로 실행
2. GHCR 이미지 digest 획득
3. Deploy 워크플로 실행 (verify gate 통과)
4. 서버 배포 및 healthz 확인

---

## 📋 사전 준비 확인

### 필수 완료 항목
- [x] GitHub Environment `prod-edge` 생성
- [x] Secrets 3개 설정 완료 (`PROD_EDGE_SSH_HOST`, `PROD_EDGE_SSH_USER`, `PROD_EDGE_SSH_KEY`)
- [x] Edge 서버에 공개키 등록 완료
- [x] SSH 접속 테스트 성공
- [x] Edge 서버 `/opt/limen/edge/docker-compose.yml` 준비 완료

---

## 🚀 리허설 실행 절차

### 1. 릴리즈 태그 생성 및 푸시

```bash
# main 브랜치에서
git checkout main
git pull origin main

# 태그 생성
git tag edge-v0.1.0-rc1

# 태그 푸시
git push origin edge-v0.1.0-rc1
```

**예상 결과**: GitHub Actions에서 "Release Edge" 워크플로가 자동 실행됨

---

### 2. Release 워크플로 확인 및 Digest 획득

1. GitHub 저장소 → **Actions** 탭
2. **"Release Edge"** 워크플로 클릭
3. 최신 실행 확인 (태그 푸시로 트리거된 실행)
4. 실행 완료 대기 (약 5-10분)

**확인 사항**:
- ✅ Build job 성공
- ✅ Job Summary에 **Image Digest** 표시됨

**Digest 확인 방법**:
1. 실행 완료 후 **"summary"** job 클릭
2. Job Summary 섹션에서 **"Image Digest"** 확인
3. 예시: `sha256:abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890`

**또는**:
1. GHCR (GitHub Container Registry)에서 확인
2. `ghcr.io/darc0625/limen-edge` 이미지의 최신 digest 확인

**예상 실행 링크**: 
- `https://github.com/DARC0625/LIMEN/actions/workflows/release_edge.yml`

**산출 digest**: ⏳ 실행 후 업데이트
- 예시 형식: `sha256:abc123...`

---

### 3. Deploy 워크플로 실행

1. GitHub 저장소 → **Actions** 탭
2. **"Deploy Edge Production"** 워크플로 클릭
3. **"Run workflow"** 버튼 클릭 (우측 상단)
4. **"Use workflow from"**: `main` 선택
5. **"image_digest"** 입력:
   - 위에서 획득한 digest 전체 입력
   - 예: `sha256:abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890`
6. **"Run workflow"** 클릭

**예상 실행 링크**: 
- `https://github.com/DARC0625/LIMEN/actions/workflows/deploy_edge_prod.yml`

**확인 사항**:
- ✅ Verify attestation 단계 통과
- ✅ Verify signature 단계 통과
- ✅ Deploy via SSH 단계 성공

**Deploy 실행 링크**: ⏳ 실행 후 업데이트

---

### 4. 배포 성공 확인

#### 4-1. 서버에서 헬스체크

Edge 서버에서 실행:

```bash
curl -fsS http://127.0.0.1:3000/healthz
```

**예상 응답**:
```json
{"status":"ok","timestamp":"2025-01-XXT..."}
```

**healthz 결과**: ⏳ 배포 후 업데이트

#### 4-2. 컨테이너 상태 확인

```bash
cd /opt/limen/edge
docker compose ps
docker compose logs edge
```

#### 4-3. 현재 배포된 이미지 확인

```bash
cat /opt/limen/edge/current_image
```

**예상 출력**: `ghcr.io/darc0625/limen-edge@sha256:...`

---

### 5. 롤백 테스트 (선택, 운영 시간 고려)

**목적**: 헬스체크 실패 시 자동 롤백이 실제로 동작하는지 확인

#### 5-1. 의도적으로 헬스체크 실패 유도

**방법 1**: 컨테이너의 헬스체크를 일시적으로 비활성화
```bash
# 서버에서
cd /opt/limen/edge
docker compose stop edge
```

**방법 2**: healthz 엔드포인트를 일시적으로 비활성화 (코드 수정)

#### 5-2. 새 배포 실행

1. Release 워크플로로 새 이미지 생성 (또는 기존 digest 사용)
2. Deploy 워크플로 실행
3. 헬스체크 실패 확인

#### 5-3. 자동 롤백 확인

```bash
# 서버에서
cat /opt/limen/edge/current_image
cat /opt/limen/edge/prev_image
```

**예상 결과**:
- `current_image`가 이전 digest로 복구됨
- 컨테이너가 이전 이미지로 재시작됨

**롤백 테스트 결과**: ⏳ 테스트 후 업데이트

---

## 📊 리허설 결과 기록

### 실행 링크
- **Release 실행 링크**: ⏳ 실행 후 업데이트
- **Deploy 실행 링크**: ⏳ 실행 후 업데이트

### 산출물
- **Image Digest**: ⏳ 실행 후 업데이트
- **Full Image Reference**: `ghcr.io/darc0625/limen-edge@sha256:...`

### 검증 결과
- **SSH 테스트 성공**: ✅ (사전 준비 단계)
- **Deploy 워크플로 SSH 단계 통과**: ⏳ 실행 후 확인
- **healthz 응답**: ⏳ 배포 후 확인
- **롤백 테스트**: ⏳ (선택)

---

## 🔍 문제 해결

### Release 워크플로 실패 시

**가능한 원인**:
1. Dockerfile 빌드 실패
2. GHCR 푸시 실패
3. Attestation/SBOM/Sign 실패

**확인 방법**:
- Actions 로그에서 에러 메시지 확인
- 각 단계별 실패 원인 파악

### Deploy 워크플로 실패 시

**가능한 원인**:
1. Attestation 검증 실패
2. Signature 검증 실패
3. SSH 접속 실패
4. 배포 스크립트 실행 실패

**확인 방법**:
- Actions 로그에서 실패한 단계 확인
- SSH 접속 테스트 재확인
- 서버 로그 확인

### healthz 실패 시

**확인 사항**:
1. 컨테이너가 실행 중인지: `docker compose ps`
2. 포트가 열려있는지: `netstat -tlnp | grep 3000`
3. 애플리케이션 로그: `docker compose logs edge`

---

## 📝 다음 단계

리허설 성공 후:
1. Backend도 동일한 방식으로 설정 (prod-backend 환경)
2. 정식 릴리즈 프로세스 문서화
3. 모니터링 및 알림 설정
