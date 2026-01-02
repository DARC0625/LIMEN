# 🤖 LIMEN 자동화 가이드

## 📋 개요

LIMEN 프로젝트는 **100% 자동화**를 목표로 다양한 자동화 워크플로우를 구축했습니다. 모든 개발, 테스트, 배포, 모니터링이 자동으로 실행됩니다.

## 🚀 자동화 워크플로우

### 1. 자동 배포 (`frontend-auto-deploy.yml`)

**트리거:**
- `main` 브랜치에 `frontend/` 변경사항 푸시 시
- 수동 실행 가능

**자동 실행 단계:**
1. ✅ 코드 품질 검사 (ESLint, Prettier, TypeScript)
2. 🔒 보안 스캔 (npm audit)
3. 📦 빌드 및 검증
4. 🚀 SSH를 통한 자동 배포
5. 🏥 Health check
6. 🔄 실패 시 자동 롤백
7. 📢 배포 알림

**설정 필요:**
```yaml
Secrets:
  - SSH_PRIVATE_KEY: SSH 개인 키
  - DEPLOY_HOST: 배포 서버 주소
  - DEPLOY_USER: 배포 사용자
  - DEPLOYMENT_URL: 배포 URL
```

### 2. 자동 의존성 업데이트 (`auto-dependency-update.yml`)

**트리거:**
- 매주 월요일 오전 9시 (UTC) 자동 실행
- 수동 실행 가능

**자동 실행:**
- 프론트엔드/백엔드 의존성 체크
- 업데이트 가능한 패키지 발견 시 자동 PR 생성
- 주요 버전 업데이트는 수동 검토 필요

### 3. 자동 릴리스 (`auto-release.yml`)

**트리거:**
- `package.json` 버전 변경 시
- 수동 실행 가능

**자동 실행:**
- 버전 변경 감지
- 변경 로그 자동 생성
- GitHub Release 자동 생성
- 릴리스 알림

### 4. 자동 테스트 (`auto-test.yml`)

**트리거:**
- `main`/`develop` 브랜치 푸시 시
- Pull Request 생성/업데이트 시
- 매일 오전 2시 자동 실행

**자동 실행:**
- 프론트엔드 테스트 (타입 체크, 린트, 빌드)
- 백엔드 테스트
- 테스트 결과 리포트
- 실패 시 알림

### 5. 자동 모니터링 (`auto-monitor.yml`)

**트리거:**
- 매시간 자동 실행
- 수동 실행 가능

**자동 실행:**
- 성능 모니터링 (번들 크기 체크)
- Health check (프론트엔드/백엔드)
- 실패 시 알림

### 6. 자동 병합 (`auto-merge.yml`)

**트리거:**
- Pull Request 생성/업데이트 시

**자동 실행:**
- `auto-merge` 레이블이 있는 PR 자동 병합
- 모든 체크 통과 후 자동 병합
- 병합 커밋 메시지 자동 생성

## 🔧 설정 방법

### 1. GitHub Secrets 설정

리포지토리 Settings → Secrets and variables → Actions에서 다음 Secrets를 설정하세요:

```bash
# 배포 관련
SSH_PRIVATE_KEY          # SSH 개인 키
DEPLOY_HOST             # 배포 서버 주소 (예: limen.local)
DEPLOY_USER             # 배포 사용자 (예: darc)
DEPLOYMENT_URL          # 배포 URL (예: https://limen.local)

# 환경 변수
NEXT_PUBLIC_API_URL     # API URL
FRONTEND_URL            # 프론트엔드 URL
BACKEND_URL             # 백엔드 URL
```

### 2. SSH 키 설정

```bash
# 서버에서 SSH 키 생성
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# 공개 키를 서버의 authorized_keys에 추가
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# 개인 키를 GitHub Secrets에 추가
cat ~/.ssh/github_actions
# → SSH_PRIVATE_KEY에 복사
```

### 3. PM2 설정 (선택사항)

```bash
# 서버에서 PM2 설정
cd /home/darc/LIMEN/frontend
pm2 start npm --name "limen-frontend" -- start
pm2 save
pm2 startup
```

## 📊 자동화 상태 확인

### GitHub Actions에서 확인

1. 리포지토리 → Actions 탭
2. 각 워크플로우의 실행 상태 확인
3. 실패한 워크플로우는 자동으로 알림

### 로컬에서 확인

```bash
# 최근 워크플로우 실행 확인
gh run list

# 특정 워크플로우 로그 확인
gh run view <run-id> --log
```

## 🎯 자동화 활용 예시

### 시나리오 1: 프론트엔드 변경사항 푸시

```bash
# 1. 코드 수정
cd /home/darc/LIMEN/frontend
# ... 코드 수정 ...

# 2. 커밋 및 푸시
cd /home/darc/LIMEN
git add frontend/
git commit -m "feat(frontend): Add new feature"
git push origin main

# 3. 자동 실행:
# ✅ 코드 품질 검사
# ✅ 보안 스캔
# ✅ 빌드 및 검증
# ✅ 자동 배포
# ✅ Health check
# ✅ 배포 알림
```

### 시나리오 2: 의존성 업데이트

```bash
# 자동으로 매주 월요일 실행
# 또는 수동 실행:
gh workflow run auto-dependency-update.yml

# 자동으로:
# ✅ 의존성 체크
# ✅ 업데이트 PR 생성
# ✅ 리뷰 후 병합
```

### 시나리오 3: 버전 업데이트

```bash
# 1. package.json 버전 수정
cd /home/darc/LIMEN/frontend
npm version patch  # 또는 minor, major

# 2. 푸시
git push origin main

# 3. 자동 실행:
# ✅ 버전 변경 감지
# ✅ 변경 로그 생성
# ✅ GitHub Release 생성
# ✅ 릴리스 알림
```

## 🔔 알림 설정 (선택사항)

### Slack 알림

```yaml
# 워크플로우에 추가
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment completed!'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Discord 알림

```yaml
- name: Notify Discord
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
```

### Email 알림

```yaml
- name: Send Email
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: 'Deployment Status'
    to: admin@limen.local
```

## ⚠️ 주의사항

### 1. 자동 배포 주의
- `main` 브랜치에 푸시하면 **즉시 배포**됩니다
- 테스트는 `develop` 브랜치에서 진행하세요

### 2. 자동 병합 주의
- `auto-merge` 레이블은 신중하게 사용하세요
- 중요한 변경사항은 수동 리뷰를 권장합니다

### 3. 롤백 메커니즘
- 배포 실패 시 자동 롤백됩니다
- 수동 롤백이 필요한 경우:
  ```bash
  ssh user@server
  cd /home/darc/LIMEN/frontend
  git reset --hard HEAD~1
  pm2 restart limen-frontend
  ```

## 📈 모니터링 대시보드

### GitHub Actions 대시보드
- https://github.com/DARC0625/LIMEN/actions
- 모든 워크플로우 실행 상태 확인

### 커스텀 대시보드 (선택사항)
- Grafana, Datadog 등과 연동 가능
- 성능 메트릭 수집 및 시각화

## 🎉 요약

✅ **100% 자동화 완료**
- 코드 품질 검사
- 보안 스캔
- 빌드 및 배포
- 테스트 실행
- 의존성 업데이트
- 릴리스 생성
- 모니터링
- 알림

**모든 것이 자동으로 실행됩니다!** 🚀

---

**최종 업데이트**: 2025-01-14  
**리포지토리**: https://github.com/DARC0625/LIMEN

