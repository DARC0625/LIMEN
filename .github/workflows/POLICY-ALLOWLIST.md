# GitHub Actions Workflow Policy Allowlist

## ✅ 대원칙

**❌ "정책 때문에 자동화 못함" 금지**

정책은 자동화를 보호하는 장치, 발목 잡는 장치 아님

## 현재 허용된 워크플로 파일

다음 워크플로 파일들이 repo policy에서 허용되어야 합니다:

1. `ci-frontend.yml` - PR Gate (Lint, Test, Build, E2E Hermetic)
2. `ci-backend.yml` - Backend CI
3. `nightly-e2e.yml` - Nightly Cross-Browser + Integration Sweep ✅ **추가됨**
4. `policy-gates.yml` - Repo-level policy enforcement

## Policy 업데이트 방법

### 방법 1: Allowlist에 추가 (정석) ✅ **완료**

1. Repository Settings → Actions → General
2. Workflow permissions 섹션에서 "Allow specific actions and reusable workflows" 확인
3. 또는 Organization/Repository level policy에서 allowlist 업데이트
4. `nightly-e2e.yml` 추가 ✅ **policy-gates.yml에 반영됨**

### 방법 2: 허용 패턴에 맞게 rename (우회, 비권장)

만약 policy 업데이트가 불가능한 경우:
- 파일명을 기존 허용된 네이밍으로 변경 (예: `ci-nightly-e2e.yml`)
- 하지만 정석은 allowlist 갱신입니다.

## 참고

- PR Gate는 항상 실행되어야 하므로 `ci-frontend.yml`은 필수 허용
- Nightly는 정기 스윕이므로 `nightly-e2e.yml`도 허용 필요
- **우회 금지**: 정책은 정면으로 해결
