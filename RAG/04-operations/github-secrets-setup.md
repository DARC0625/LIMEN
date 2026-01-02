# GitHub Secrets 설정 가이드

**작성일**: 2025-01-02  
**목적**: LIMEN 프로젝트의 자동 배포 및 동기화를 위한 GitHub Secrets 설정

## 📋 개요

GitHub Actions에서 자동 배포 및 서버 동기화를 사용하려면 SSH 키와 서버 정보를 GitHub Secrets에 등록해야 합니다.

## 🔐 필요한 Secrets 목록

### 프론트엔드 서버
- `FRONTEND_HOST`: 프론트엔드 서버 IP 주소
- `FRONTEND_USER`: 프론트엔드 서버 사용자명
- `FRONTEND_SSH_KEY`: 프론트엔드 서버 SSH 개인 키
- `FRONTEND_SSH_PORT`: SSH 포트 (선택, 기본값: 22)

### 백엔드 서버
- `BACKEND_HOST`: 백엔드 서버 IP 주소
- `BACKEND_USER`: 백엔드 서버 사용자명
- `BACKEND_SSH_KEY`: 백엔드 서버 SSH 개인 키
- `BACKEND_SSH_PORT`: SSH 포트 (선택, 기본값: 22)

### 선택적 Secrets
- `FRONTEND_URL`: 프론트엔드 URL (헬스체크용)
- `BACKEND_URL`: 백엔드 URL (헬스체크용)

## 🚀 설정 방법

### 1단계: GitHub 저장소 접속

1. GitHub에서 [DARC0625/LIMEN](https://github.com/DARC0625/LIMEN) 저장소로 이동
2. **Settings** 탭 클릭
3. 왼쪽 사이드바에서 **Secrets and variables** → **Actions** 클릭
4. **New repository secret** 버튼 클릭

### 2단계: 프론트엔드 서버 Secrets 추가

#### FRONTEND_HOST
- **Name**: `FRONTEND_HOST`
- **Value**: `10.0.0.10`
- **Add secret** 클릭

#### FRONTEND_USER
- **Name**: `FRONTEND_USER`
- **Value**: `darc`
- **Add secret** 클릭

#### FRONTEND_SSH_KEY
1. 프론트엔드 서버에 SSH 접속
2. SSH 키 확인:
   ```bash
   cat ~/.ssh/id_ed25519_github
   ```
3. 전체 키 내용 복사 (BEGIN부터 END까지)
4. **Name**: `FRONTEND_SSH_KEY`
5. **Value**: (복사한 키 전체 내용 붙여넣기)
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
   QyNTUxOQAAACB/j25zgqzkSl9iM5ziM1c31PuFXDrS/r9WODIokiF4VgAAAJAXlP/1F5T/
   9QAAAAtzc2gtZWQyNTUxOQAAACB/j25zgqzkSl9iM5ziM1c31PuFXDrS/r9WODIokiF4Vg
   AAAECwK7O/4XHuP0/lkbNbfQcAqlPxwksSISmHPhm9t19m3H+PbnOCrORKX2IznOIzVzfU
   +4VcOtL+v1Y4MiiSIXhWAAAACmRhcmNAbGltZW4BAgM=
   -----END OPENSSH PRIVATE KEY-----
   ```
6. **Add secret** 클릭

#### FRONTEND_SSH_PORT (선택)
- **Name**: `FRONTEND_SSH_PORT`
- **Value**: `22` (또는 사용 중인 포트)
- **Add secret** 클릭

### 3단계: 백엔드 서버 Secrets 추가

#### BACKEND_HOST
1. 백엔드 서버 IP 확인:
   ```bash
   # 백엔드 서버에서 실행
   hostname -I | awk '{print $1}'
   # 또는
   ip addr show | grep "inet " | grep -v 127.0.0.1
   ```
2. **Name**: `BACKEND_HOST`
3. **Value**: 백엔드 서버 IP (예: `10.0.0.11`)
4. **Add secret** 클릭

#### BACKEND_USER
- **Name**: `BACKEND_USER`
- **Value**: `darc0`
- **Add secret** 클릭

#### BACKEND_SSH_KEY
1. 백엔드 서버에 SSH 접속
2. SSH 키 확인:
   ```bash
   cat ~/.ssh/id_ed25519_github
   ```
3. 전체 키 내용 복사 (BEGIN부터 END까지)
4. **Name**: `BACKEND_SSH_KEY`
5. **Value**: (복사한 키 전체 내용 붙여넣기)
6. **Add secret** 클릭

#### BACKEND_SSH_PORT (선택)
- **Name**: `BACKEND_SSH_PORT`
- **Value**: `22` (또는 사용 중인 포트)
- **Add secret** 클릭

### 4단계: 선택적 Secrets 추가

#### FRONTEND_URL (헬스체크용)
- **Name**: `FRONTEND_URL`
- **Value**: `http://10.0.0.10:9444` (또는 실제 프론트엔드 URL)
- **Add secret** 클릭

#### BACKEND_URL (헬스체크용)
- **Name**: `BACKEND_URL`
- **Value**: `http://10.0.0.11:18443` (또는 실제 백엔드 URL)
- **Add secret** 클릭

## ✅ 확인 방법

### 1. Secrets 목록 확인
GitHub 저장소 → Settings → Secrets and variables → Actions에서 다음 Secrets가 모두 등록되어 있는지 확인:
- ✅ FRONTEND_HOST
- ✅ FRONTEND_USER
- ✅ FRONTEND_SSH_KEY
- ✅ BACKEND_HOST
- ✅ BACKEND_USER
- ✅ BACKEND_SSH_KEY

### 2. 자동 동기화 테스트
1. 코드 변경 후 커밋 및 푸시:
   ```bash
   git add .
   git commit -m "test: GitHub Secrets 테스트"
   git push origin main
   ```
2. GitHub Actions에서 워크플로우 실행 확인:
   - GitHub 저장소 → **Actions** 탭
   - `Auto Sync to Servers` 워크플로우 실행 확인
   - `Deploy to Backend Server` 또는 `Deploy to Frontend Server` 실행 확인

### 3. 로그 확인
워크플로우 실행 후 로그에서 다음 메시지 확인:
- ✅ "백엔드 서버 동기화 완료" 또는 "프론트엔드 서버 동기화 완료"
- ❌ 오류 발생 시 Secrets 값 확인 필요

## 🔧 SSH 키 생성 방법 (키가 없는 경우)

### 프론트엔드 서버에서
```bash
# 프론트엔드 서버에 SSH 접속
ssh darc@10.0.0.10

# SSH 키 생성
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "darc@limen-frontend"

# 공개 키를 authorized_keys에 추가 (선택)
cat ~/.ssh/id_ed25519_github.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 개인 키 확인 (GitHub Secrets에 등록할 내용)
cat ~/.ssh/id_ed25519_github
```

### 백엔드 서버에서
```bash
# 백엔드 서버에 SSH 접속
ssh darc0@10.0.0.11

# SSH 키 생성
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "darc0@limen-backend"

# 공개 키를 authorized_keys에 추가 (선택)
cat ~/.ssh/id_ed25519_github.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 개인 키 확인 (GitHub Secrets에 등록할 내용)
cat ~/.ssh/id_ed25519_github
```

## 🔒 보안 주의사항

1. **SSH 키 보안**
   - SSH 개인 키는 절대 공개하지 마세요
   - GitHub Secrets에만 저장하고 로컬에 백업하지 마세요
   - 키가 유출되면 즉시 재생성하세요

2. **접근 제한**
   - SSH 키는 최소 권한으로 설정하세요
   - 필요시 특정 IP에서만 접근 허용하세요

3. **정기적 점검**
   - 주기적으로 Secrets 목록 확인
   - 사용하지 않는 Secrets 삭제
   - 키 로테이션 권장 (6개월마다)

## 🐛 문제 해결

### SSH 연결 실패
```
Error: ssh: connect to host 10.0.0.10 port 22: Connection refused
```
**해결 방법**:
1. 서버가 실행 중인지 확인
2. SSH 서비스가 실행 중인지 확인: `sudo systemctl status ssh`
3. 방화벽 규칙 확인
4. `FRONTEND_SSH_PORT` 또는 `BACKEND_SSH_PORT` 값 확인

### 인증 실패
```
Error: Permission denied (publickey)
```
**해결 방법**:
1. SSH 키가 올바르게 복사되었는지 확인 (줄바꿈 포함)
2. SSH 키 권한 확인: `chmod 600 ~/.ssh/id_ed25519_github`
3. `authorized_keys`에 공개 키가 추가되어 있는지 확인

### 경로 오류
```
Error: /home/darc/LIMEN 디렉토리가 존재하지 않습니다
```
**해결 방법**:
1. 서버에 LIMEN 디렉토리 생성:
   ```bash
   mkdir -p /home/darc/LIMEN
   cd /home/darc/LIMEN
   git init
   git remote add origin https://github.com/DARC0625/LIMEN.git
   ```
2. 또는 워크플로우의 경로를 실제 경로로 수정

## 📚 관련 문서

- [자동 동기화 가이드](./auto-sync-guide.md)
- [배포 가이드](../03-deployment/)
- [운영 가이드](./operations-guide.md)

## 🔄 업데이트 이력

- 2025-01-02: 초기 문서 작성

---

**다음 단계**: Secrets 설정 완료 후 자동 배포 테스트
