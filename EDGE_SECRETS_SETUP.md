# Edge Secrets 설정 가이드 (대표님용)

## 🎯 한 줄 요약

**GitHub Settings → Environments → prod-edge → Environment secrets에서 3개 값 입력:**
1. `PROD_EDGE_SSH_HOST` = Edge 서버 IP/도메인
2. `PROD_EDGE_SSH_USER` = SSH 계정명 (예: ubuntu)
3. `PROD_EDGE_SSH_KEY` = 개인키 파일 전체 내용 (BEGIN~END 포함)

**그 다음 로컬에서 `ssh -i ./limen_edge_deploy_key <USER>@<HOST>` 테스트 한 번.**

---

## 📝 상세 설정 절차

### 1. GitHub Environment Secrets 설정

**위치**: Repository → Settings → Environments → `prod-edge` → Environment secrets

#### Secret 1: PROD_EDGE_SSH_HOST

1. **"Add secret"** 클릭 (또는 기존 항목의 연필 아이콘 클릭)
2. **Name**: `PROD_EDGE_SSH_HOST` (정확히 일치)
3. **Value**: Edge 서버 공인 IP 또는 도메인
   - 예: `1.2.3.4`
   - 예: `edge.example.com`
   - 예: `edge.limen.io`
4. **"Add secret"** 또는 **"Update secret"** 클릭

#### Secret 2: PROD_EDGE_SSH_USER

1. **"Add secret"** 클릭
2. **Name**: `PROD_EDGE_SSH_USER` (정확히 일치)
3. **Value**: SSH 접속 계정명
   - 예: `ubuntu`
   - 예: `deploy`
   - 예: `limen`
4. **"Add secret"** 클릭

#### Secret 3: PROD_EDGE_SSH_KEY

1. **"Add secret"** 클릭
2. **Name**: `PROD_EDGE_SSH_KEY` (정확히 일치)
3. **Value**: 개인키 파일 전체 내용
   - 대표님 PC에서 실행: `cat ./limen_edge_deploy_key`
   - 출력된 전체 내용을 복사 (줄바꿈 포함)
   - `-----BEGIN OPENSSH PRIVATE KEY-----` 부터
   - `-----END OPENSSH PRIVATE KEY-----` 까지
   - **모든 줄 포함**
4. **"Add secret"** 클릭

**⚠️ 중요**: 
- 값이 화면에 보이지 않는 것은 정상입니다 (보안상 마스킹됨)
- 저장만 제대로 하면 됩니다

---

## 🖥️ 서버에 공개키 등록 (운영자)

Edge 서버에 배포 유저로 접속 후:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys <<'EOF'
<limen_edge_deploy_key.pub 내용 한 줄 전체>
EOF
chmod 600 ~/.ssh/authorized_keys
```

**공개키 확인** (대표님 PC에서):
```bash
cat ./limen_edge_deploy_key.pub
```

**출력 예시**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... limen-prod-edge-deploy
```

이 한 줄 전체를 `<limen_edge_deploy_key.pub 내용 한 줄 전체>` 부분에 넣으세요.

---

## ✅ 접속 테스트 (대표님 PC)

**필수**: SSH 접속이 성공해야 내일 배포가 성공합니다.

```bash
ssh -i ./limen_edge_deploy_key <PROD_EDGE_SSH_USER>@<PROD_EDGE_SSH_HOST>
```

**예시**:
```bash
ssh -i ./limen_edge_deploy_key ubuntu@1.2.3.4
```

### 성공 시
- 서버 프롬프트가 나타남
- `exit`로 종료
- ✅ **시크릿/서버 키 등록이 정상**이라는 뜻

### 실패 시
- 에러 메시지 1줄만 가져오시면 즉시 원인 파악 가능
- 가능한 원인: 키/권한/계정/방화벽 중 1개

---

## 📊 설정 완료 체크리스트

### 대표님
- [ ] `PROD_EDGE_SSH_HOST` Secret 저장 완료
- [ ] `PROD_EDGE_SSH_USER` Secret 저장 완료
- [ ] `PROD_EDGE_SSH_KEY` Secret 저장 완료 (개인키 전체)
- [ ] SSH 접속 테스트 성공

### 운영자
- [ ] 공개키를 `~/.ssh/authorized_keys`에 추가 완료
- [ ] 권한 설정 완료 (`chmod 600 ~/.ssh/authorized_keys`)

---

## 🔗 참고

- **상세 가이드**: https://github.com/DARC0625/LIMEN/blob/main/EDGE_SSH_SETUP_GUIDE.md
- **빠른 참조**: https://github.com/DARC0625/LIMEN/blob/main/EDGE_SSH_QUICK_REFERENCE.md
