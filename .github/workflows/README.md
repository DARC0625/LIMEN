# GitHub Actions Workflows

이 디렉토리는 LIMEN 프로젝트의 CI/CD 파이프라인을 포함합니다.

## Workflows

### CI/CD Pipeline (`ci.yml`)

모든 푸시와 Pull Request에 대해 실행됩니다.

**Jobs:**
- **backend**: Go 백엔드 빌드, 린트, 테스트
- **frontend**: Node.js 프론트엔드 빌드, 린트
- **agent**: Rust 에이전트 빌드
- **security**: 보안 스캔 (Gosec, npm audit)
- **build-all**: 모든 컴포넌트 빌드 확인

### Release (`release.yml`)

태그가 푸시될 때 실행됩니다 (예: `v1.0.0`).

**기능:**
- 백엔드 및 프론트엔드 빌드
- 릴리스 아카이브 생성
- GitHub Release 자동 생성

## 사용 방법

### CI/CD 트리거

```bash
# 일반 푸시
git push origin main

# Pull Request 생성
git checkout -b feature/new-feature
git push origin feature/new-feature
# GitHub에서 Pull Request 생성
```

### 릴리스 생성

```bash
# 태그 생성 및 푸시
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## 환경 변수

GitHub Secrets에 다음 변수를 설정해야 할 수 있습니다:

- `CODECOV_TOKEN`: 코드 커버리지 업로드용 (선택사항)

## 로컬 테스트

GitHub Actions를 로컬에서 테스트하려면 [act](https://github.com/nektos/act)를 사용할 수 있습니다:

```bash
# act 설치 후
act -j backend
act -j frontend
```

