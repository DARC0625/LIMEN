# SSH 키 설정 가이드

## ✅ 생성된 SSH 키

SSH 키가 생성되었습니다:
```
~/.ssh/id_ed25519_github
~/.ssh/id_ed25519_github.pub
```

## 🔑 GitHub에 SSH 키 등록

### 1. 공개 키 확인
```bash
cat ~/.ssh/id_ed25519_github.pub
```

출력 예시:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH+PbnOCrORKX2IznOIzVzfU+4VcOtL+v1Y4MiiSIXhW darc@limen
```

### 2. GitHub에 키 등록
1. GitHub에 로그인
2. Settings → SSH and GPG keys
3. "New SSH key" 클릭
4. Title: "LIMEN Server" (또는 원하는 이름)
5. Key: 위에서 복사한 공개 키 붙여넣기
6. "Add SSH key" 클릭

### 3. SSH 연결 테스트
```bash
ssh -T git@github.com
```

성공 메시지:
```
Hi darc0625! You've successfully authenticated, but GitHub does not provide shell access.
```

### 4. GitHub 호스트 키 확인
첫 연결 시 호스트 키 확인 프롬프트가 나타나면 `yes` 입력

## 🚀 푸시 실행

SSH 키 등록 후:
```bash
cd /home/darc/LIMEN
git push -u origin main
```

## 🔄 대안: Personal Access Token 사용

SSH 키 대신 Personal Access Token을 사용할 수도 있습니다:

```bash
cd /home/darc/LIMEN

# HTTPS로 변경
git remote set-url origin https://github.com/darc0625/limen.git

# 푸시 (토큰 입력)
git push -u origin main
# Username: darc0625
# Password: [Personal Access Token]
```

### Personal Access Token 생성 방법
1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. "Generate new token" 클릭
4. 권한 선택: `repo` (전체 권한)
5. 토큰 생성 및 복사

---

**작성일**: 2025-01-14

