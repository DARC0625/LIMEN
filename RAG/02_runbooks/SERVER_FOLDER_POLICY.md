# 서버별 폴더 정책

## Backend 서버 전용 (내부 API / libvirt)

| 폴더 | 서버 | 설명 | 정책 |
|------|------|------|------|
| `backend/` | **BACKEND ONLY** | API, Auth, RBAC, libvirt 제어 | Edge에 있으면 ❌ |
| `config/` | EDGE + BACK | 공통 설정 | 허용 |
| `infra/` | EDGE + BACK | 운영/배포 | 허용 |
| `scripts/` | EDGE + BACK | sync, gate | 허용 |
| `RAG/` | EDGE + BACK (필수) | 📌 문서 = RAG | 반드시 양쪽 |

## 공통 / 개발 편의 (서버 무관, 로컬/CI 전용)

| 폴더 | 서버 | 설명 | 정책 |
|------|------|------|------|
| `.github/` | **CI ONLY** | GitHub Actions | 서버 배포 ❌ |
| `.vscode/` | **DEV ONLY** | 개발 환경 | 서버 배포 ❌ |
| `.deployignore` | TOOLING | 배포 제어 | 허용 |
| `.gitattributes` | TOOLING | Git 설정 | 허용 |
| `.gitignore` | TOOLING | Git 설정 | 허용 |
| `.markdownlint.json` | TOOLING | 문서 린트 | 허용 |
| `README.md` | RAG ENTRY | 진입 문서 | 허용 |

⚠️ **정책 고정**: `.github/`, `.vscode/`는 서버에 절대 올라가면 안 됨 (sparse-checkout에 포함시키지 말 것)

## Sparse Checkout 설정

### Backend 서버
```bash
git sparse-checkout set backend config infra scripts RAG
```

### Edge 서버
```bash
# Edge 서버는 backend/ 제외
git sparse-checkout set config infra scripts RAG
```

## 게이트 체크

### Backend 서버 sync 스크립트
- ✅ `backend/` 폴더가 반드시 존재해야 함
- ❌ `apps/edge/` 폴더가 있으면 실패
- ❌ `frontend/` 폴더가 있으면 실패
- ❌ 루트 `src/` 폴더가 있으면 실패
- ❌ 루트 `.md` 파일이 있으면 실패 (README.md 제외)
- ❌ `.github/` 폴더가 있으면 실패 (CI 전용)
- ❌ `.vscode/` 폴더가 있으면 실패 (DEV 전용)

### Edge 서버 sync 스크립트
- ❌ `backend/` 폴더가 있으면 실패
- ✅ `RAG/` 폴더가 반드시 존재해야 함

## 정책 코드

- `POLICY:BACKEND` - Backend 서버 필수 폴더 체크
- `POLICY:EDGE` - Edge 코드 금지
- `POLICY:D0` - RAG 문서 정책
- `POLICY:D1` - src 분리 정책
- `POLICY:CI` - CI 전용 폴더 금지 (`.github/`)
- `POLICY:DEV` - DEV 전용 폴더 금지 (`.vscode/`)
