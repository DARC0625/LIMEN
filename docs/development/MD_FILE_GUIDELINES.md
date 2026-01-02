# 📝 MD 파일 작성 가이드

## 📋 개요

LIMEN 프로젝트의 모든 MD 파일은 일관된 구조와 위치를 유지해야 합니다.

## 📁 파일 위치 규칙

### 허용된 위치

1. **`docs/`** - 모든 문서는 여기에 위치
   - `docs/development/` - 개발 가이드
   - `docs/components/` - 컴포넌트 문서
   - `docs/archive/` - 아카이브 문서

2. **`.github/`** - GitHub 관련 문서
   - `.github/ISSUE_TEMPLATE/`
   - `.github/workflows/`

3. **루트 `README.md`** - 프로젝트 메인 README만 허용

4. **프로젝트별 `README.md`**
   - `frontend/README.md`
   - `backend/README.md`
   - `scripts/README.md`
   - `infra/README.md`

### 금지된 위치

- 루트 디렉토리 (README.md 제외)
- `frontend/` 루트 (README.md 제외)
- `backend/` 루트 (README.md 제외)
- 기타 프로젝트 루트 디렉토리

## 🌏 언어 규칙

### 한글 작성 필수

**모든 MD 파일은 한글로 작성되어야 합니다.**

### 예외 (영어 허용)

다음 파일들은 영어로 작성 가능:
- `README.md`
- `CHANGELOG.md`
- `LICENSE.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

## 📂 파일 분류 가이드

### 개발 가이드
```
docs/development/
├── FRONTEND_DEVELOPMENT.md
├── WORKFLOW_GUIDE.md
├── AUTOMATION_GUIDE.md
├── frontend/
│   ├── DEVELOPMENT.md
│   ├── UPGRADE_PLAN.md
│   └── UPGRADE_SUMMARY.md
└── backend/
    └── ...
```

### 컴포넌트 문서
```
docs/components/
├── FRONTEND_COMPONENTS.md
└── ...
```

### 아카이브
```
docs/archive/
├── integration/
├── optimization/
└── setup/
```

## ✅ 검증 방법

### 로컬 검증

```bash
# MD 파일 검증 스크립트 실행
node scripts/validate-md-files.js
```

### 자동 검증

1. **Pre-commit Hook**: 커밋 전 자동 검증
2. **GitHub Actions**: PR 생성 시 자동 검증

## 🚫 오류 예시

### ❌ 잘못된 위치

```
❌ /CLEANUP_PLAN.md
❌ /frontend/DEVELOPMENT.md
❌ /backend/docs/API_DOCUMENTATION.md
```

### ✅ 올바른 위치

```
✅ /docs/archive/CLEANUP_PLAN.md
✅ /docs/development/frontend/DEVELOPMENT.md
✅ /docs/02-development/api/backend-api.md
```

## 📝 작성 가이드

### 파일명 규칙

- 대문자 사용 권장: `FRONTEND_DEVELOPMENT.md`
- 하이픈 사용 가능: `frontend-development.md`
- 한글 파일명 가능: `프론트엔드_개발_가이드.md`

### 내용 구조

```markdown
# 제목

## 개요
프로젝트/기능에 대한 간단한 설명

## 주요 내용
...

## 참고
...
```

## 🔧 문제 해결

### MD 파일이 잘못된 위치에 있을 때

1. 파일을 올바른 위치로 이동
2. `git add` 후 커밋
3. 검증 스크립트 재실행

### 한글이 아닌 내용이 있을 때

1. 파일 내용을 한글로 번역
2. 예외 파일인지 확인 (README.md 등)
3. 검증 스크립트 재실행

## 📚 관련 문서

- [개발 가이드](./FRONTEND_DEVELOPMENT.md)
- [워크플로우 가이드](./WORKFLOW_GUIDE.md)
- [자동화 가이드](./AUTOMATION_GUIDE.md)

---

**최종 업데이트**: 2025-01-14  
**검증 스크립트**: `scripts/validate-md-files.js`

