# Backend Supply Chain 설정 체크리스트 (Edge와 동일 방식)

## 📋 개요

Backend도 Edge와 동일한 A급 supply chain 파이프라인을 구축합니다.

---

## 🔄 Edge와 동일한 작업

### 1. 워크플로 파일 생성

Edge와 동일한 구조로 Backend용 워크플로 생성:

- [ ] `.github/workflows/pr_backend.yml` (PR 게이트)
- [ ] `.github/workflows/release_backend.yml` (릴리즈)
- [ ] `.github/workflows/deploy_backend_prod.yml` (배포)

**참고**: `_reusable_build_image.yml`은 공통으로 사용 가능

### 2. GitHub Environment 생성

- [ ] Environment: `prod-backend` 생성

### 3. GitHub Secrets 설정

- [ ] `PROD_BACKEND_SSH_HOST` - Backend 서버 IP/도메인
- [ ] `PROD_BACKEND_SSH_USER` - SSH 계정명
- [ ] `PROD_BACKEND_SSH_KEY` - SSH 개인키 전체 내용

### 4. SSH 키 생성 및 등록

- [ ] Backend 배포용 SSH 키 생성 (`limen_backend_deploy_key`)
- [ ] Backend 서버에 공개키 등록
- [ ] SSH 접속 테스트 성공

### 5. 서버 준비

- [ ] `/opt/limen/backend/` 디렉토리 생성
- [ ] `/opt/limen/backend/docker-compose.yml` 준비
- [ ] Docker Compose 설치 확인

### 6. 배포 스크립트

- [ ] `scripts/deploy/backend/deploy-backend.sh` 생성
- [ ] 태그 배포 거부 로직 포함
- [ ] 자동 롤백 기능 포함
- [ ] 헬스체크 포함

### 7. 헬스체크 엔드포인트

- [ ] Backend 헬스체크 엔드포인트 확인/생성
- [ ] 경로: `/api/health` 또는 `/healthz`

### 8. 리허설 실행

- [ ] `backend-v0.1.0-rc1` 태그 생성 및 푸시
- [ ] Release 워크플로 실행 확인
- [ ] Deploy 워크플로 실행 확인
- [ ] healthz 확인

---

## 🔗 Edge 참고 문서

- **Edge 설정 가이드**: https://github.com/DARC0625/LIMEN/blob/main/EDGE_SSH_SETUP_GUIDE.md
- **Edge 리허설 런북**: https://github.com/DARC0625/LIMEN/blob/main/EDGE_REHEARSAL_RUNBOOK.md
- **Edge 배포 스크립트**: https://github.com/DARC0625/LIMEN/blob/main/scripts/deploy/edge/deploy-edge.sh

---

## 📊 진행 상황

- [ ] 워크플로 파일 생성
- [ ] Environment/Secrets 설정
- [ ] SSH 키 설정
- [ ] 서버 준비
- [ ] 배포 스크립트 생성
- [ ] 리허설 실행
