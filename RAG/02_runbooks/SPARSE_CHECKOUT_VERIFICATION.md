# Sparse-Checkout Allowlist 재검증 결과

본 문서는 Edge/Backend 서버의 sparse-checkout allowlist가 정책 문서(`RAG/00_repo_structure_policy.md`)와 일치하는지 검증한 결과입니다.

검증 일시: 2025-01-10
검증 스크립트: `scripts/verify-sparse-checkout.sh`

---

## ✅ Backend 서버 sparse-checkout (정답)

```bash
git sparse-checkout set \
  backend \
  config \
  infra \
  scripts \
  RAG
```

### 포함 ✅
- `backend/` - 백엔드 코드 (API, Auth, RBAC, libvirt)
- `config/` - 공통 설정
- `infra/` - 운영/배포 스크립트
- `scripts/` - sync, gate, 운영 자동화
- `RAG/` - 문서 (필수)

### 제외 ❌
- `frontend/` - Edge 서버 전용
- `apps/edge/` - Edge 서버 전용
- `.github/` - CI 전용
- `.vscode/` - DEV 전용

### 검증 결과
- ✅ `scripts/setup-backend-sparse-checkout.sh` - 정책 일치
- ✅ `scripts/setup-backend-server.sh` - 정책 일치
- **정책 100% 일치**

---

## 📝 Edge 서버 sparse-checkout (예상)

```bash
git sparse-checkout set \
  frontend \
  config \
  infra \
  scripts \
  RAG
```

### 포함 ✅
- `frontend/` - 프론트엔드 코드 (Next.js, noVNC)
- `config/` - 공통 설정
- `infra/` - 운영/배포 스크립트
- `scripts/` - sync, gate, 운영 자동화
- `RAG/` - 문서 (필수)

### 제외 ❌
- `backend/` - Backend 서버 전용
- `.github/` - CI 전용
- `.vscode/` - DEV 전용

### 검증 결과
- ⚠️ Edge 서버 스크립트 아직 미구현

---

## 정책 기준

정책 문서: `RAG/00_repo_structure_policy.md`

### Backend 서버 전용 (BACKEND ONLY)
- `backend/` - API, Auth, RBAC, libvirt 제어

### Edge 서버 전용 (EDGE ONLY)
- `frontend/` - Next.js UI, noVNC UI, 브라우저 코드

### 공통 폴더 (EDGE + BACKEND)
- `RAG/` - 문서 단일 진실 (Docs = RAG)
- `config/` - 공통 설정 (Envoy 포함)
- `infra/` - 배포/운영 스크립트
- `scripts/` - sync, gate, 운영 자동화

### 서버 배포 금지 (DEV / CI ONLY)
- `.github/` - GitHub Actions, CI 설정
- `.vscode/` - 개발 환경 설정

---

## 검증 방법

```bash
bash scripts/verify-sparse-checkout.sh
```

이 스크립트는:
1. 정책 문서 기준으로 allowlist를 정의
2. 실제 스크립트의 sparse-checkout 설정을 검증
3. 일치 여부를 보고

---

## 결론

✅ **Backend 서버의 sparse-checkout 설정은 정책과 100% 일치합니다.**

- 모든 필수 폴더 포함
- 모든 금지 폴더 제외
- 정책 문서와 코드가 일치
