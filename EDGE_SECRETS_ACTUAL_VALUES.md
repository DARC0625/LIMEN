# Edge Secrets 실제 값 (대표님용)

## 🎯 GitHub Secrets 설정 값

**위치**: Settings → Environments → `prod-edge` → Environment secrets

### 1. PROD_EDGE_SSH_HOST
**값**: `10.0.0.10`

**출처**: RAG 문서 `04-operations/github-secrets-setup.md` (프론트엔드 서버 IP)

### 2. PROD_EDGE_SSH_USER
**값**: `darc`

**출처**: RAG 문서 `04-operations/github-secrets-setup.md` (프론트엔드 서버 사용자명)

### 3. PROD_EDGE_SSH_KEY
**값**: `limen_edge_deploy_key` 개인키 파일 **전체 내용**

**생성 방법** (대표님 PC에서):
```bash
ssh-keygen -t ed25519 -a 64 -f ./limen_edge_deploy_key -C "limen-prod-edge-deploy" -N ""
cat ./limen_edge_deploy_key
```

**출력 형식**:
- `-----BEGIN OPENSSH PRIVATE KEY-----`로 시작
- 여러 줄의 base64 인코딩된 키 데이터
- `-----END OPENSSH PRIVATE KEY-----`로 끝
- **이 전체 내용(모든 줄 포함)을 복사**하여 GitHub Secret에 붙여넣기

**⚠️ 중요**: `-----BEGIN~-----END` 포함 **모든 줄**을 복사해야 합니다.

---

## 🖥️ 서버에 공개키 등록 (운영자)

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

**출력 형식**: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... limen-prod-edge-deploy`

이 한 줄 전체를 `<limen_edge_deploy_key.pub 내용 한 줄 전체>` 부분에 넣으세요.

---

## ✅ SSH 접속 테스트 (대표님 PC)

**필수**: SSH 접속이 성공해야 내일 배포가 성공합니다.

```bash
ssh -i ./limen_edge_deploy_key darc@10.0.0.10
```

**성공 시**: 서버 프롬프트가 나타남 → `exit`로 종료  
**실패 시**: 에러 메시지 1줄만 공유해주시면 원인 파악 가능

---

## 📊 설정 요약

| 항목 | 값 | 상태 |
|------|-----|------|
| **PROD_EDGE_SSH_HOST** | `10.0.0.10` | ⏳ 설정 필요 |
| **PROD_EDGE_SSH_USER** | `darc` | ⏳ 설정 필요 |
| **PROD_EDGE_SSH_KEY** | `limen_edge_deploy_key` 전체 | ⏳ 생성 후 설정 필요 |

---

## 🔗 참고 문서

- **RAG 출처**: `RAG/04-operations/github-secrets-setup.md`
- **상세 가이드**: https://github.com/DARC0625/LIMEN/blob/main/EDGE_SSH_SETUP_GUIDE.md
- **빠른 참조**: https://github.com/DARC0625/LIMEN/blob/main/EDGE_SSH_QUICK_REFERENCE.md
