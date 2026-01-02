# GitHub Secrets 설정 가이드

## 1. GitHub 저장소 접속

1. GitHub에서 `DARC0625/LIMEN` 저장소로 이동
2. **Settings** 탭 클릭
3. 왼쪽 사이드바에서 **Secrets and variables** → **Actions** 클릭
4. **New repository secret** 버튼 클릭

## 2. 필요한 Secrets 목록

### 백엔드 서버 Secrets

#### BACKEND_HOST
- **Name**: `BACKEND_HOST`
- **Value**: 백엔드 서버 IP 주소 또는 도메인
  - 예: `10.0.0.10` 또는 `backend.limen.local`

#### BACKEND_USER
- **Name**: `BACKEND_USER`
- **Value**: 백엔드 서버 SSH 사용자명
  - 예: `darc0` 또는 `darc`

#### BACKEND_SSH_KEY
- **Name**: `BACKEND_SSH_KEY`
- **Value**: 백엔드 서버의 SSH 개인키 전체 내용
  - 백엔드 서버에서 실행: `cat ~/.ssh/id_rsa` 또는 `cat ~/.ssh/id_ed25519`
  - **전체 내용을 복사** (-----BEGIN ... END----- 포함)

#### BACKEND_SSH_PORT (선택사항)
- **Name**: `BACKEND_SSH_PORT`
- **Value**: SSH 포트 번호 (기본값: 22)
  - 예: `22`

### 프론트엔드 서버 Secrets

#### FRONTEND_HOST
- **Name**: `FRONTEND_HOST`
- **Value**: 프론트엔드 서버 IP 주소 또는 도메인
  - 예: `10.0.0.10` 또는 `frontend.limen.local`

#### FRONTEND_USER
- **Name**: `FRONTEND_USER`
- **Value**: 프론트엔드 서버 SSH 사용자명
  - 예: `darc`

#### FRONTEND_SSH_KEY
- **Name**: `FRONTEND_SSH_KEY`
- **Value**: 프론트엔드 서버의 SSH 개인키 전체 내용
  - 프론트엔드 서버에서 실행: `cat ~/.ssh/id_ed25519_github`
  - **전체 내용을 복사** (-----BEGIN ... END----- 포함)

#### FRONTEND_SSH_PORT (선택사항)
- **Name**: `FRONTEND_SSH_PORT`
- **Value**: SSH 포트 번호 (기본값: 22)
  - 예: `22`

## 3. SSH 키 확인 방법

### 프론트엔드 서버에서:
```bash
# SSH 키 확인
ls -la ~/.ssh/

# 개인키 내용 확인 (GitHub Secrets에 복사)
cat ~/.ssh/id_ed25519_github
```

### 백엔드 서버에서:
```bash
# SSH 키 확인
ls -la ~/.ssh/

# 개인키 내용 확인 (GitHub Secrets에 복사)
cat ~/.ssh/id_rsa
# 또는
cat ~/.ssh/id_ed25519
```

## 4. SSH 키가 없는 경우

### 새 SSH 키 생성:
```bash
# 프론트엔드 서버에서
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "github-actions-frontend"

# 백엔드 서버에서
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "github-actions-backend"
```

### GitHub에 공개키 등록 (Deploy key):
1. 공개키 확인: `cat ~/.ssh/id_ed25519_github.pub`
2. GitHub 저장소 → Settings → Deploy keys → Add deploy key
3. 공개키 내용 붙여넣기
4. "Allow write access" 체크 (필요한 경우)

## 5. 설정 확인

모든 Secrets를 설정한 후:

1. GitHub Actions 탭으로 이동
2. `deploy-backend.yml` 또는 `deploy-frontend.yml` 워크플로우 실행
3. 로그에서 SSH 연결 및 git pull 성공 여부 확인

## 6. 문제 해결

### SSH 연결 실패:
- `BACKEND_HOST` / `FRONTEND_HOST` 확인
- `BACKEND_USER` / `FRONTEND_USER` 확인
- SSH 키 형식 확인 (전체 내용, 줄바꿈 포함)

### Git fetch 실패:
- 서버의 `~/.ssh/authorized_keys`에 GitHub Actions 공개키 추가
- 또는 Deploy key로 GitHub에 공개키 등록

### 권한 오류:
- 서버 경로 확인: `/home/darc0/LIMEN` (백엔드), `/home/darc/LIMEN` (프론트엔드)
- 디렉토리 권한 확인: `ls -la /home/darc0/LIMEN`

