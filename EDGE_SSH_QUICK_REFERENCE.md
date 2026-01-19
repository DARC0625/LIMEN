# Edge SSH 설정 빠른 참조

## 🔑 대표님: SSH 키 생성 (1분)

```bash
ssh-keygen -t ed25519 -a 64 -f ./limen_edge_deploy_key -C "limen-prod-edge-deploy" -N ""
cat ./limen_edge_deploy_key  # 개인키 전체 내용 복사
cat ./limen_edge_deploy_key.pub  # 공개키 한 줄 복사
```

## 🖥️ 운영자: 서버에 공개키 등록 (1분)

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys <<'EOF'
<limen_edge_deploy_key.pub 내용 한 줄 전체>
EOF
chmod 600 ~/.ssh/authorized_keys
```

## 🔐 대표님: GitHub Secrets 설정 (2분)

**Settings → Environments → prod-edge → Environment secrets**

| Secret 이름 | 값 |
|------------|-----|
| `PROD_EDGE_SSH_HOST` | Edge 서버 IP/도메인 |
| `PROD_EDGE_SSH_USER` | SSH 계정명 (예: ubuntu) |
| `PROD_EDGE_SSH_KEY` | `limen_edge_deploy_key` **전체 내용** (BEGIN~END 포함) |

## ✅ 테스트

```bash
# 대표님 PC에서
ssh -i ./limen_edge_deploy_key <USER>@<HOST>
```
