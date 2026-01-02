# 🔄 LIMEN 개발 워크플로우 가이드

## 📋 개요

이 문서는 LIMEN 프론트엔드와 백엔드를 GitHub 리포지토리에서 최신 버전으로 동기화하고 개발하는 방법을 설명합니다.

## 🎯 리포지토리 구조

```
DARC0625/LIMEN/
├── backend/              # 백엔드 코드
├── frontend/             # 프론트엔드 코드
├── docs/                 # 통합 문서
│   ├── development/      # 개발 가이드
│   ├── components/       # 컴포넌트 문서
│   └── ...
└── .github/workflows/    # CI/CD 파이프라인
```

## 🔄 프론트엔드 개발 워크플로우

### 1. 최신 버전 가져오기

```bash
# 리포지토리 루트로 이동
cd /home/darc/LIMEN

# 최신 변경사항 가져오기
git pull origin main

# 또는 특정 브랜치에서 작업하는 경우
git checkout -b feature/your-feature
git pull origin main
```

### 2. 프론트엔드 개발

```bash
# 프론트엔드 디렉토리로 이동
cd /home/darc/LIMEN/frontend

# 의존성 설치 (필요한 경우)
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

### 3. 변경사항 커밋 및 푸시

```bash
# 리포지토리 루트로 이동
cd /home/darc/LIMEN

# 변경사항 확인
git status

# 프론트엔드 변경사항만 스테이징
git add frontend/

# 커밋
git commit -m "feat(frontend): Add new feature"

# 푸시
git push origin main
```

## 📚 문서 참고 방법

### 1. 로컬 문서 확인

```bash
# 개발 가이드
cat /home/darc/LIMEN/docs/development/FRONTEND_DEVELOPMENT.md

# 컴포넌트 문서
cat /home/darc/LIMEN/docs/components/FRONTEND_COMPONENTS.md

# 업그레이드 요약
cat /home/darc/LIMEN/docs/development/UPGRADE_SUMMARY.md
```

### 2. GitHub에서 문서 확인

- **개발 가이드**: https://github.com/DARC0625/LIMEN/blob/main/docs/development/FRONTEND_DEVELOPMENT.md
- **컴포넌트 문서**: https://github.com/DARC0625/LIMEN/blob/main/docs/components/FRONTEND_COMPONENTS.md
- **업그레이드 요약**: https://github.com/DARC0625/LIMEN/blob/main/docs/development/UPGRADE_SUMMARY.md

### 3. 문서 업데이트

```bash
# 문서 수정 후
cd /home/darc/LIMEN
git add docs/
git commit -m "docs: Update frontend development guide"
git push origin main
```

## 🔀 브랜치 전략

### 메인 브랜치
- `main`: 프로덕션 준비 코드
- 항상 최신 안정 버전 유지

### 기능 브랜치
```bash
# 새 기능 개발
git checkout -b feature/new-feature
# 개발 후
git push origin feature/new-feature
# Pull Request 생성
```

## 🚀 CI/CD 파이프라인

### 자동 빌드 및 배포

- **프론트엔드 변경 시**: `.github/workflows/frontend.yml` 자동 실행
- **백엔드 변경 시**: `.github/workflows/backend.yml` 자동 실행
- **문서 변경 시**: `.github/workflows/docs.yml` 자동 실행

### Path-based 트리거링

```yaml
# frontend.yml 예시
on:
  push:
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend.yml'
```

## 📝 일일 개발 워크플로우

### 아침: 최신 버전 가져오기

```bash
cd /home/darc/LIMEN
git pull origin main
cd frontend
npm install  # 의존성 변경 시
npm run dev
```

### 개발 중: 문서 참고

```bash
# 필요한 문서 확인
cat docs/development/FRONTEND_DEVELOPMENT.md
cat docs/components/FRONTEND_COMPONENTS.md
```

### 저녁: 변경사항 푸시

```bash
cd /home/darc/LIMEN
git add frontend/
git commit -m "feat(frontend): Description"
git push origin main
```

## 🔍 변경사항 확인

### 최신 커밋 확인

```bash
cd /home/darc/LIMEN
git log --oneline -10
```

### 프론트엔드 변경사항만 확인

```bash
cd /home/darc/LIMEN
git log --oneline -- frontend/
```

### 원격과 로컬 차이 확인

```bash
cd /home/darc/LIMEN
git fetch origin
git log HEAD..origin/main --oneline
```

## ⚠️ 주의사항

### 1. 항상 최신 버전 유지
- 개발 시작 전 `git pull` 실행
- 충돌 발생 시 신중하게 해결

### 2. 문서 동기화
- 문서 변경 시 `docs/` 디렉토리도 함께 커밋
- 다른 개발자와 문서 공유

### 3. 커밋 메시지 규칙
- `feat(frontend):` - 새 기능
- `fix(frontend):` - 버그 수정
- `docs:` - 문서 업데이트
- `refactor(frontend):` - 리팩토링

## 🎯 요약

✅ **프론트엔드 코드**: `/home/darc/LIMEN/frontend/`에서 GitHub와 동기화  
✅ **문서**: `/home/darc/LIMEN/docs/`에서 참고 및 업데이트  
✅ **최신 버전**: `git pull origin main`으로 항상 최신 상태 유지  
✅ **CI/CD**: 자동 빌드 및 배포 파이프라인 작동 중

---

**리포지토리**: https://github.com/DARC0625/LIMEN  
**최종 업데이트**: 2025-01-14

