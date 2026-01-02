# 자동 동기화 가이드

## 개요

LIMEN 프로젝트는 Git 푸시를 트리거로 사용하여 프론트엔드와 백엔드 서버가 자동으로 동기화됩니다.

## 동기화 방식

### 1. GitHub Actions (권장)

**트리거**: `main` 브랜치에 푸시

**프로세스**:
1. GitHub Actions가 푸시 감지
2. 백엔드 서버에 SSH 접속
3. `git pull`로 최신 코드 가져오기
4. RAG 인덱싱 실행
5. 서비스 재시작 (선택적)
6. 프론트엔드 서버에도 동일하게 수행

**워크플로우 파일**: `.github/workflows/auto-sync.yml`

### 2. 로컬 Post-push Hook

**트리거**: 로컬에서 `git push` 실행

**프로세스**:
1. 푸시 완료 후 `post-push` hook 실행
2. 로컬 RAG 인덱싱 실행
3. GitHub Actions 트리거 안내

**Hook 파일**: `.git/hooks/post-push`

## 설정 방법

### 1. GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions

**필수 Secrets:**

#### 백엔드 서버
- `BACKEND_HOST`: 백엔드 서버 IP 또는 도메인
- `BACKEND_USER`: SSH 사용자명 (예: `darc0`)
- `BACKEND_SSH_KEY`: SSH 개인 키 (전체 내용)
- `BACKEND_SSH_PORT`: SSH 포트 (기본: 22, 선택사항)

#### 프론트엔드 서버
- `FRONTEND_HOST`: 프론트엔드 서버 IP 또는 도메인
- `FRONTEND_USER`: SSH 사용자명
- `FRONTEND_SSH_KEY`: SSH 개인 키 (전체 내용)
- `FRONTEND_SSH_PORT`: SSH 포트 (기본: 22, 선택사항)

### 2. SSH 키 설정

#### SSH 키 생성 (없는 경우)

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions@limen"
```

#### 서버에 공개 키 추가

```bash
# 백엔드 서버에서
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 프론트엔드 서버에서도 동일하게 수행
```

#### GitHub Secrets에 개인 키 추가

```bash
# 개인 키 내용 복사
cat ~/.ssh/id_rsa

# GitHub Secrets → BACKEND_SSH_KEY에 전체 내용 붙여넣기
# GitHub Secrets → FRONTEND_SSH_KEY에 전체 내용 붙여넣기
```

### 3. 워크플로우 파일 확인

`.github/workflows/auto-sync.yml` 파일의 서버 경로를 확인하고 필요시 수정:

```yaml
# 백엔드 서버 경로
cd /home/darc0/LIMEN

# 프론트엔드 서버 경로
cd /home/darc/LIMEN
```

### 4. 설정 스크립트 실행

```bash
./scripts/setup-auto-sync.sh
```

## 사용법

### 자동 동기화

```bash
# 일반적인 푸시
git add .
git commit -m "변경 내용"
git push origin main

# → 자동으로 GitHub Actions가 트리거되어 서버 동기화 수행
```

### 수동 동기화 (GitHub Actions)

1. GitHub 저장소 → Actions 탭
2. "Auto Sync to Servers" 워크플로우 선택
3. "Run workflow" 클릭
4. 브랜치 선택 후 "Run workflow" 실행

## 동기화 프로세스 상세

### 백엔드 서버 동기화

```bash
# 1. Git pull
cd /home/darc0/LIMEN
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. RAG 인덱싱
./scripts/rag-index.sh --auto

# 3. 서비스 재시작 (선택적)
cd backend
pm2 restart limen --update-env
```

### 프론트엔드 서버 동기화

```bash
# 1. Git pull
cd /path/to/LIMEN
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. RAG 인덱싱
./scripts/rag-index.sh --auto

# 3. 서비스 재시작 (선택적)
cd frontend
pm2 restart limen-frontend --update-env
```

## 문제 해결

### GitHub Actions 실패

**원인**: SSH 연결 실패

**해결**:
1. GitHub Secrets 확인
2. SSH 키가 서버에 추가되었는지 확인
3. 서버 방화벽에서 SSH 포트 허용 확인

### 동기화가 실행되지 않음

**원인**: 워크플로우 트리거 조건 불일치

**해결**:
1. `main` 브랜치에 푸시했는지 확인
2. GitHub Actions 탭에서 워크플로우 실행 상태 확인
3. `.github/workflows/auto-sync.yml` 파일 확인

### 서비스 재시작 실패

**원인**: PM2 프로세스 이름 불일치

**해결**:
1. 서버에서 실제 PM2 프로세스 이름 확인:
   ```bash
   pm2 list
   ```
2. `auto-sync.yml`의 프로세스 이름 수정

## 보안 고려사항

### SSH 키 관리

- **절대 공개하지 않음**: SSH 개인 키는 절대 공개 저장소에 커밋하지 않음
- **GitHub Secrets 사용**: SSH 키는 반드시 GitHub Secrets에 저장
- **키 로테이션**: 정기적으로 SSH 키 교체 권장

### 서버 접근 제한

- **IP 화이트리스트**: 가능하면 GitHub Actions IP 범위만 허용
- **SSH 키 기반 인증**: 패스워드 인증 비활성화
- **최소 권한 원칙**: 필요한 최소한의 권한만 부여

## 모니터링

### GitHub Actions 로그

1. GitHub 저장소 → Actions 탭
2. 최근 워크플로우 실행 클릭
3. 각 단계의 로그 확인

### 서버 로그

```bash
# 백엔드 서버
cd /home/darc0/LIMEN
pm2 logs limen

# 프론트엔드 서버
cd /path/to/LIMEN
pm2 logs limen-frontend
```

## 관련 문서

- [RAG 워크플로우 가이드](./rag-workflow.md)
- [배포 가이드](./deployment-guide.md)
- [서비스 가이드](./service.md)

---

**마지막 업데이트**: 2025-01-02
