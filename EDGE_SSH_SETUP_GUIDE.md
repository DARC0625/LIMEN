# Edge 배포용 SSH 키 설정 가이드

## 📋 작업 개요

Edge 배포를 위한 전용 SSH 키를 생성하고, 서버에 등록한 후 GitHub Secrets에 설정합니다.

---

## 🔑 P0-1: Edge 배포용 SSH 키 새로 발급 (대표님 PC)

**대표님 PC(또는 관리 PC)에서 실행:**

```bash
# 1) 새 키 생성 (edge deploy 전용)
ssh-keygen -t ed25519 -a 64 -f ./limen_edge_deploy_key -C "limen-prod-edge-deploy" -N ""

# 2) 생성물 확인
ls -la ./limen_edge_deploy_key*
# - limen_edge_deploy_key      (개인키)  -> GitHub secret에 넣을 값
# - limen_edge_deploy_key.pub  (공개키)  -> 서버 authorized_keys에 넣을 값
```

**생성된 파일**:
- `limen_edge_deploy_key` (개인키) - GitHub Secret `PROD_EDGE_SSH_KEY`에 넣을 값
- `limen_edge_deploy_key.pub` (공개키) - 서버 `~/.ssh/authorized_keys`에 넣을 값

**개인키 파일 내용 확인**:
```bash
cat ./limen_edge_deploy_key
```

**출력 예시**:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
(여러 줄)
...
-----END OPENSSH PRIVATE KEY-----
```

**⚠️ 중요**: 이 전체 내용(-----BEGIN~-----END 포함)을 복사하여 GitHub Secret에 넣어야 합니다.

---

## 🖥️ P0-2: Edge 서버에 공개키 등록 (운영자)

**Edge 서버에서 배포 유저(예: ubuntu 또는 deploy)로 접속 후:**

```bash
# 디렉토리 생성 및 권한 설정
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 공개키 추가 (limen_edge_deploy_key.pub 내용을 한 줄 전체로 추가)
cat >> ~/.ssh/authorized_keys <<'EOF'
<여기에 limen_edge_deploy_key.pub 내용 한 줄 전체>
EOF

# 권한 설정
chmod 600 ~/.ssh/authorized_keys

# 확인
cat ~/.ssh/authorized_keys | grep limen-prod-edge-deploy
```

**공개키 파일 내용 확인** (대표님 PC에서):
```bash
cat ./limen_edge_deploy_key.pub
```

**출력 예시**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... limen-prod-edge-deploy
```

**⚠️ 중요**: 이 한 줄 전체를 `<여기에 limen_edge_deploy_key.pub 내용 한 줄 전체>` 부분에 넣어야 합니다.

**테스트** (대표님 PC에서):
```bash
# 서버 접속 테스트
ssh -i ./limen_edge_deploy_key <PROD_EDGE_SSH_USER>@<PROD_EDGE_SSH_HOST>
```

---

## 🔐 P0-3: GitHub prod-edge Environment secrets 설정 (대표님)

**설정 위치**: 
1. GitHub 저장소 → **Settings** → **Environments**
2. `prod-edge` 환경 선택 (없으면 생성)
3. **"Environment secrets"** 섹션
4. **"Add secret"** 클릭

### Secret 1: PROD_EDGE_SSH_HOST

- **Name**: `PROD_EDGE_SSH_HOST`
- **Value**: Edge 서버 IP 또는 도메인
  - 예: `1.2.3.4`
  - 예: `edge.example.com`

### Secret 2: PROD_EDGE_SSH_USER

- **Name**: `PROD_EDGE_SSH_USER`
- **Value**: SSH 접속 계정명
  - 예: `ubuntu`
  - 예: `deploy`

### Secret 3: PROD_EDGE_SSH_KEY

- **Name**: `PROD_EDGE_SSH_KEY`
- **Value**: `limen_edge_deploy_key` 개인키 파일 **전체 내용**
  - `-----BEGIN OPENSSH PRIVATE KEY-----` 부터
  - `-----END OPENSSH PRIVATE KEY-----` 까지
  - **모든 줄 포함** (줄바꿈 포함)

**개인키 파일 내용 복사 방법**:
```bash
# 대표님 PC에서
cat ./limen_edge_deploy_key | pbcopy  # macOS
# 또는
cat ./limen_edge_deploy_key | xclip -selection clipboard  # Linux
# 또는
cat ./limen_edge_deploy_key  # 출력된 내용을 수동으로 복사
```

**⚠️ 중요**: 
- 개인키 파일 전체 내용을 복사해야 합니다
- 줄바꿈도 포함되어야 합니다
- `-----BEGIN~-----END` 포함 전체입니다

---

## 🧹 P0-4: 기존 키 정리 (옵션, 권고)

**목적**: 혼선 방지

**작업**:
1. Edge deploy가 정상 동작 확인 후
2. `FRONTEND_SSH_KEY` (레포 시크릿) 제거 또는 "deprecated"로 이름 변경

**⚠️ 주의**: Edge deploy 정상 동작 확인 **전**에는 제거하지 마세요.

---

## ✅ 검증 체크리스트

### 대표님 작업
- [ ] SSH 키 생성 완료 (`limen_edge_deploy_key`, `limen_edge_deploy_key.pub`)
- [ ] 개인키 파일 내용 확인
- [ ] 공개키 파일 내용 확인
- [ ] GitHub Environment `prod-edge` 생성
- [ ] `PROD_EDGE_SSH_HOST` Secret 추가
- [ ] `PROD_EDGE_SSH_USER` Secret 추가
- [ ] `PROD_EDGE_SSH_KEY` Secret 추가 (개인키 전체 내용)

### 운영자 작업
- [ ] Edge 서버에 배포 유저로 접속
- [ ] `~/.ssh` 디렉토리 생성 및 권한 설정
- [ ] 공개키를 `authorized_keys`에 추가
- [ ] 권한 설정 (`chmod 600 ~/.ssh/authorized_keys`)
- [ ] 공개키 등록 확인

### 테스트
- [ ] 대표님 PC에서 SSH 접속 테스트 성공
- [ ] GitHub Actions에서 Deploy 워크플로 실행 가능 (Secret 접근 확인)

---

## 🔗 참고

- **워크플로 파일**: https://github.com/DARC0625/LIMEN/blob/main/.github/workflows/deploy_edge_prod.yml
- **배포 스크립트**: https://github.com/DARC0625/LIMEN/blob/main/scripts/deploy/edge/deploy-edge.sh
- **sudo 비밀번호**: `0625` (서버 작업 시 필요)

---

## 📝 다음 단계

SSH 키 설정 완료 후:
1. GitHub Secrets 설정 확인
2. SSH 접속 테스트
3. P0-5 리허설 실행 (2026-01-20)
