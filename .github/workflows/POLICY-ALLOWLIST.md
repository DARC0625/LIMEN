# GitHub Actions Workflow Policy Allowlist

## 현재 허용된 워크플로 파일

다음 워크플로 파일들이 repo policy에서 허용되어 있습니다:

1. `ci-frontend.yml` - PR Gate (Lint, Test, Build, E2E Hermetic)
2. `nightly-e2e.yml` - Nightly Cross-Browser + Integration Sweep

## Policy 업데이트 필요 시

`nightly-e2e.yml`이 policy allowlist에 추가되어야 합니다.

### 업데이트 방법

1. Repository Settings → Actions → General
2. Workflow permissions 섹션에서 "Allow specific actions and reusable workflows" 확인
3. 또는 Organization/Repository level policy에서 allowlist 업데이트

### 우회 방법 (권장하지 않음)

만약 policy 업데이트가 불가능한 경우:
- 파일명을 기존 허용된 네이밍으로 변경 (예: `ci-nightly-e2e.yml`)
- 하지만 정석은 allowlist 갱신입니다.

## 참고

- PR Gate는 항상 실행되어야 하므로 `ci-frontend.yml`은 필수 허용
- Nightly는 정기 스윕이므로 `nightly-e2e.yml`도 허용 필요
