# Edge Self-hosted Runner 설치 가이드

## 📋 전제 조건

- 러너를 설치할 머신은 GitHub에 **outbound HTTPS(443)** 가능해야 함
- 내부망에서 **10.0.0.x 대상 서버**에 접근 가능해야 함

## 🎯 러너 설치 위치 결정

### 옵션 A1: 별도 관리 VM (권고)
- **장점**: Edge 서버와 분리, 보안 격리
- **단점**: SSH 설정 필요 (기존 방식 유지)
- **PROD_EDGE_SSH_HOST**: `10.0.0.10` (내부 IP)

### 옵션 A2: Edge 서버 직접
- **장점**: SSH 제거 가능, 공격면 감소
- **단점**: Edge 서버에 러너 프로세스 실행
- **변경**: SSH 스텝 제거, 로컬 실행

---

## 1️⃣ 러너 전용 유저 생성 (권고)

```bash
sudo useradd -m -s /bin/bash limen-runner || true
sudo mkdir -p /opt/limen/runner
sudo chown -R limen-runner:limen-runner /opt/limen/runner
```

## 2️⃣ GitHub에서 러너 등록 토큰 발급

1. **Repo → Settings → Actions → Runners → New self-hosted runner**
2. **OS**: Linux / **Arch**: x64 선택
3. 거기 나오는 커맨드를 그대로 사용 (토큰 포함)

## 3️⃣ 러너 설치/등록

```bash
sudo -iu limen-runner bash -lc '
cd /opt/limen/runner
# ↓ GitHub 화면에 나온 tar.gz 다운로드/압축해제 커맨드 실행
# curl -o actions-runner-linux-x64-*.tar.gz -L ...
# tar xzf ./actions-runner-linux-x64-*.tar.gz

# ↓ GitHub 화면에 나온 configure 커맨드 실행
# ./config.sh --url https://github.com/DARC0625/LIMEN --token XXXXX
'
```

### ⚠️ 라벨 지정 (중요)

`config` 과정에서 라벨을 물으면 **`limen-edge`** 를 반드시 추가.

## 4️⃣ 서비스로 등록 (자동 재시작)

```bash
sudo -iu limen-runner bash -lc '
cd /opt/limen/runner
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
'
```

## ✅ 확인

GitHub → Settings → Actions → Runners에서 **"limen-edge" 러너가 Online**으로 표시되어야 함.

---

## 📝 deploy_edge_prod.yml 수정

**파일**: `.github/workflows/deploy_edge_prod.yml`

### 변경 사항

```yaml
# 기존
runs-on: ubuntu-latest

# 변경 후
runs-on: [self-hosted, limen-edge]
```

### SSH 방식 선택

#### 옵션 1: Edge 서버 직접 (권고 - SSH 제거)

**장점**: 키/SSH 자체 제거 (공격면 감소)

**변경**:
- `scp/ssh` 스텝 제거
- `sudo scripts/deploy/edge/deploy-edge.sh "$IMAGE_REF"` 로컬 실행

#### 옵션 2: 별도 VM (SSH 유지)

**변경 없음**: 기존 SSH 방식 유지
- `PROD_EDGE_SSH_HOST`: `10.0.0.10` (내부 IP)
- `PROD_EDGE_SSH_USER`: `darc`
- `PROD_EDGE_SSH_KEY`: 개인키

---

## 🎯 대표님이 해야 할 일

1. **러너 설치 위치 결정**
   - Edge 서버 직접 (A2) vs 별도 관리 VM (A1, 권고)

2. **운영자에게 러너 설치 지시문 전달**
   - 위 "러너 설치 복붙 지시문" 전달
   - Runner가 GitHub에 **Online**으로 뜨는지 확인

3. **deploy_edge_prod.yml 수정**
   - `runs-on: [self-hosted, limen-edge]`로 변경
   - SSH 방식 선택 (옵션 1 또는 2)

---

## 🚀 러너가 Online 뜨는 순간부터

- `deploy_edge_prod.yml`만 `runs-on: [self-hosted, limen-edge]`로 바꾸면
- 내부망 `10.x` 그대로 배포가 됩니다.
