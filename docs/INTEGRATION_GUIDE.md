# 리포지토리 통합 가이드

## 개요
이 가이드는 프론트엔드와 백엔드를 `darc0625/limen` 리포지토리에 통합하는 방법을 설명합니다.

## 통합 방법

### 방법 1: 자동 스크립트 사용 (권장)
```bash
cd /home/darc/LIMEN
./INTEGRATION_SCRIPT.sh
```

### 방법 2: 수동 통합

#### Step 1: Git 리포지토리 초기화
```bash
cd /home/darc/LIMEN
git init
git remote add origin https://github.com/darc0625/limen.git
```

#### Step 2: 기존 백엔드 코드 가져오기
```bash
# 기존 리포지토리에서 백엔드 코드 가져오기
git fetch origin
git checkout origin/main -- backend/
```

#### Step 3: 문서 통합
```bash
# 문서 디렉토리 생성
mkdir -p docs/{architecture,api,development,components,deployment}

# 프론트엔드 문서 이동
cp frontend/DEVELOPMENT.md docs/development/FRONTEND_DEVELOPMENT.md
cp frontend/docs/COMPONENTS.md docs/components/FRONTEND_COMPONENTS.md
cp frontend/UPGRADE_SUMMARY.md docs/development/UPGRADE_SUMMARY.md
```

#### Step 4: 초기 커밋
```bash
git add .
git commit -m "feat: Integrate frontend and backend into monorepo"
git branch -M main
git push -u origin main
```

## 리포지토리 구조

```
limen/
├── backend/              # 백엔드 코드
│   ├── src/
│   ├── requirements.txt
│   └── README.md
├── frontend/             # 프론트엔드 코드
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── README.md
├── docs/                 # 공유 문서
│   ├── architecture/     # 아키텍처 문서
│   ├── api/             # API 문서
│   ├── development/     # 개발 가이드
│   ├── components/      # 컴포넌트 문서
│   └── deployment/      # 배포 가이드
├── .github/
│   └── workflows/       # CI/CD 파이프라인
├── README.md            # 메인 README
└── .gitignore
```

## CI/CD 파이프라인 설정

### Path-based Triggering
각 프로젝트의 변경사항만 감지하여 해당 프로젝트만 빌드/배포:

```yaml
# .github/workflows/backend.yml
name: Backend CI/CD
on:
  push:
    paths:
      - 'backend/**'
      - '.github/workflows/backend.yml'

# .github/workflows/frontend.yml
name: Frontend CI/CD
on:
  push:
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend.yml'
```

## 실시간 동기화 전략

### 1. 공유 타입 정의
API 타입 정의를 공유하여 프론트엔드와 백엔드 간 타입 일관성 유지:

```
docs/api/
├── types.ts          # 공유 타입 정의
└── schemas/          # API 스키마
```

### 2. 문서 자동 업데이트
- API 변경 시 문서 자동 생성
- 컴포넌트 변경 시 문서 자동 업데이트

### 3. Git Hooks
- Pre-commit: 각 프로젝트별 lint/format 체크
- Post-merge: 필요한 경우 자동 동기화

## 워크플로우

### 개발 워크플로우
1. 기능 브랜치 생성: `git checkout -b feature/xxx`
2. 각 프로젝트에서 독립적으로 개발
3. 변경사항 커밋: `git commit -m "feat: ..."`
4. 푸시: `git push origin feature/xxx`
5. Pull Request 생성

### 배포 워크플로우
- 백엔드 변경 → 백엔드만 빌드/배포
- 프론트엔드 변경 → 프론트엔드만 빌드/배포
- 문서 변경 → 문서만 업데이트

## 문제 해결

### 충돌 해결
기존 백엔드 코드와 충돌이 발생하는 경우:
```bash
git pull origin main --no-rebase
# 충돌 해결
git add .
git commit -m "fix: Resolve merge conflicts"
```

### 서브모듈 사용 (선택사항)
각 프로젝트를 독립 리포지토리로 유지하면서 통합하려면:
```bash
git submodule add <frontend-repo-url> frontend
git submodule add <backend-repo-url> backend
```

---

**작성일**: 2025-01-14
**상태**: 통합 준비 완료

