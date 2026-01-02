# LIMEN 리포지토리 통합 계획

## 🎯 목표
프론트엔드와 백엔드를 `darc0625/limen` 리포지토리에 통합하여:
- 단일 리포지토리에서 전체 프로젝트 관리
- 각 프로젝트가 필요한 부분만 실시간 동기화
- 공유 문서 중앙 관리
- CI/CD 파이프라인 통합

## 📁 제안하는 리포지토리 구조

```
darc0625/limen/
├── backend/              # 백엔드 코드 (기존)
│   ├── src/
│   ├── requirements.txt
│   └── ...
├── frontend/             # 프론트엔드 코드 (신규)
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── ...
├── docs/                 # 공유 문서
│   ├── architecture/     # 아키텍처 문서
│   ├── api/             # API 문서
│   ├── deployment/      # 배포 가이드
│   ├── development/     # 개발 가이드
│   └── components/      # 컴포넌트 문서
├── .github/
│   └── workflows/       # CI/CD 파이프라인
│       ├── backend.yml
│       ├── frontend.yml
│       └── docs.yml
├── README.md            # 메인 README
└── .gitignore
```

## 🔄 통합 단계

### Step 1: 리포지토리 초기화 및 원격 연결
```bash
cd /home/darc/LIMEN
git init
git remote add origin https://github.com/darc0625/limen.git
```

### Step 2: 백엔드 코드 이동
- 기존 백엔드 코드를 `backend/` 디렉토리로 이동
- 기존 Git 히스토리 유지 (필요시)

### Step 3: 프론트엔드 코드 준비
- 프론트엔드는 이미 `frontend/` 디렉토리에 있음
- 문서 정리 및 통합

### Step 4: 문서 통합
- 프론트엔드 문서 → `docs/development/`
- 컴포넌트 문서 → `docs/components/`
- API 문서 통합 → `docs/api/`
- 아키텍처 문서 → `docs/architecture/`

### Step 5: CI/CD 파이프라인 설정
- 백엔드 파이프라인: `backend/` 변경 감지
- 프론트엔드 파이프라인: `frontend/` 변경 감지
- 문서 파이프라인: `docs/` 변경 감지

## 📝 문서 구조

### docs/architecture/
- 시스템 아키텍처
- 네트워크 구조
- 데이터베이스 스키마

### docs/api/
- REST API 문서
- WebSocket API 문서
- 인증/인가 가이드

### docs/development/
- 개발 환경 설정
- 코딩 컨벤션
- Git 워크플로우

### docs/components/
- 프론트엔드 컴포넌트 문서
- UI/UX 가이드

### docs/deployment/
- 배포 가이드
- 환경 변수 설정
- 트러블슈팅

## 🔧 CI/CD 파이프라인 전략

### Path-based Triggering
```yaml
# backend.yml
on:
  push:
    paths:
      - 'backend/**'
      - '.github/workflows/backend.yml'

# frontend.yml
on:
  push:
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend.yml'
```

### 독립적 빌드 및 배포
- 백엔드 변경 → 백엔드만 빌드/배포
- 프론트엔드 변경 → 프론트엔드만 빌드/배포
- 문서 변경 → 문서만 업데이트

## 🚀 실시간 동기화 전략

### 1. Git Hooks 활용
- Pre-commit: 각 프로젝트별 lint/format 체크
- Post-merge: 필요한 경우 자동 동기화

### 2. 공유 타입 정의
- API 타입 정의를 공유 리포지토리에서 관리
- 각 프로젝트가 필요한 타입만 import

### 3. 문서 자동 동기화
- API 변경 시 문서 자동 업데이트
- 컴포넌트 변경 시 문서 자동 업데이트

## 📋 체크리스트

- [ ] Git 리포지토리 초기화
- [ ] 원격 리포지토리 연결
- [ ] 백엔드 코드 구조 확인
- [ ] 프론트엔드 코드 구조 확인
- [ ] 문서 통합 계획 수립
- [ ] .gitignore 설정
- [ ] CI/CD 파이프라인 작성
- [ ] README.md 업데이트
- [ ] 초기 커밋 및 푸시

---

**작성일**: 2025-01-14
**상태**: 계획 단계

