# Edge Secrets 실제 값 (RAG 문서 기반)

## 📋 Edge 서버 정보 (RAG 문서에서 확인)

RAG 문서(`RAG/04-operations/github-secrets-setup.md`)에서 확인한 정보:

### PROD_EDGE_SSH_HOST
**값**: `10.0.0.10`

**출처**: `RAG/04-operations/github-secrets-setup.md:41`
- 프론트엔드 서버 IP 주소로 명시됨
- Edge 서버 = Frontend 서버 (동일)

### PROD_EDGE_SSH_USER
**값**: `darc`

**출처**: `RAG/04-operations/github-secrets-setup.md:46`
- 프론트엔드 서버 사용자명으로 명시됨

### PROD_EDGE_SSH_KEY
**값**: `limen_edge_deploy_key` 개인키 파일 전체 내용

**생성 방법** (대표님 PC에서):
```bash
ssh-keygen -t ed25519 -a 64 -f ./limen_edge_deploy_key -C "limen-prod-edge-deploy" -N ""
cat ./limen_edge_deploy_key
```

**출력 예시** (전체 내용을 복사):
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACD...
(여러 줄)
...
-----END OPENSSH PRIVATE KEY-----
```

---

## ✅ GitHub Secrets 설정 체크리스트

**위치**: Settings → Environments → `prod-edge` → Environment secrets

| Secret 이름 | 값 | 상태 |
|------------|-----|------|
| `PROD_EDGE_SSH_HOST` | `10.0.0.10` | ⏳ 설정 필요 |
| `PROD_EDGE_SSH_USER` | `darc` | ⏳ 설정 필요 |
| `PROD_EDGE_SSH_KEY` | `limen_edge_deploy_key` 전체 내용 | ⏳ 설정 필요 |

---

## 🖥️ 서버에 공개키 등록

**Edge 서버** (`10.0.0.10`)에 `darc` 계정으로 접속 후:

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

---

## ✅ SSH 접속 테스트

**대표님 PC에서**:

```bash
ssh -i ./limen_edge_deploy_key darc@10.0.0.10
```

**성공 시**: 서버 프롬프트가 나타남 → `exit`로 종료  
**실패 시**: 에러 메시지 1줄만 공유해주시면 원인 파악 가능

---

## 📝 참고

- **RAG 문서**: `RAG/04-operations/github-secrets-setup.md`
- **기존 Frontend Secrets**: `FRONTEND_HOST=10.0.0.10`, `FRONTEND_USER=darc` (동일 서버)
- **Edge = Frontend 서버**: Edge 서버는 Frontend 서버와 동일 (`00_repo_structure_policy.md` 참조)
