# LIMEN RAG (Retrieval-Augmented Generation) 공통 지식 저장소

## 개요

이 폴더는 프론트엔드와 백엔드가 공통으로 사용하는 RAG 시스템의 지식 저장소입니다.
**모든 문서가 이 RAG/ 폴더에 직접 저장되어** 두 서버가 동일한 지식을 공유합니다.

## 폴더 구조

```
RAG/
├── *.md                  # 문서 파일들 (직접 저장)
├── 01-architecture/      # 아키텍처 문서
├── 02-development/       # 개발 가이드
├── 03-deployment/        # 배포 가이드
├── 04-operations/        # 운영 가이드
├── 05-frontend/          # 프론트엔드 문서
├── 99-archive/           # 아카이브
├── vectors/              # 벡터 임베딩 데이터
├── index/                # 인덱스 파일 (메타데이터, 검색 인덱스)
├── embeddings/           # 임베딩 모델 캐시
└── README.md             # 이 파일
```

**중요**: `docs/` 폴더는 더 이상 존재하지 않습니다. 모든 문서는 `RAG/` 폴더에 직접 저장됩니다.

## 사용 방법

### 프론트엔드에서 접근

```javascript
// 프론트엔드에서 RAG 폴더 접근
const ragPath = process.env.NEXT_PUBLIC_RAG_PATH || '/home/darc0/LIMEN/RAG';
const docs = await fs.readdir(ragPath);
```

### 백엔드에서 접근

```go
// 백엔드에서 RAG 폴더 접근
ragPath := os.Getenv("RAG_PATH")
if ragPath == "" {
    ragPath = "/home/darc0/LIMEN/RAG"
}
docs, err := os.ReadDir(ragPath)
```

## 문서 관리

**모든 문서는 `RAG/` 폴더에 직접 저장됩니다.**

- 문서 작성/수정: `RAG/` 폴더에서 직접 작업
- Git 관리: `RAG/` 폴더의 문서가 Git에 포함됨 (vectors, index, embeddings 제외)
- 동기화: 더 이상 필요 없음 (단일 위치)

## 인덱싱

RAG 인덱싱은 이 폴더의 문서를 기반으로 수행됩니다.

```bash
# RAG 인덱싱
./scripts/rag-index.sh all
```

## 환경 변수

```bash
# 공통 RAG 경로
export RAG_PATH=/home/darc0/LIMEN/RAG

# 프론트엔드에서 사용
export NEXT_PUBLIC_RAG_PATH=/home/darc0/LIMEN/RAG

# 백엔드에서 사용
export RAG_PATH=/home/darc0/LIMEN/RAG
```

## 주의사항

- **문서는 `RAG/` 폴더에서 직접 관리합니다**
- 벡터 데이터(`vectors/`, `index/`, `embeddings/`)는 자동으로 생성되므로 수동 수정 금지
- 프론트엔드와 백엔드가 동일한 `RAG/` 폴더를 공유합니다
- `docs/` 폴더는 더 이상 존재하지 않습니다

## 문서 구조

### 🏠 [홈](./00-home.md)
프로젝트 개요 및 빠른 시작 가이드

### 🏗️ [아키텍처](./01-architecture/)
- [시스템 개요](./01-architecture/overview.md)
- [시스템 설계](./01-architecture/system-design.md)
- [네트워크 보안](./01-architecture/network-security.md)
- [로드맵](./01-architecture/roadmap.md)

### 💻 [개발 가이드](./02-development/)
- [시작하기](./02-development/getting-started.md)
- [API 문서](./02-development/api-documentation.md)
- [기여 가이드](./02-development/contributing.md)
- [로깅 품질](./02-development/logging-quality.md)

### 🚀 [배포 가이드](./03-deployment/)
- [Docker 배포](./03-deployment/docker/deployment.md)
- [CI/CD 설정](./03-deployment/ci-cd/setup.md)
- [성능 최적화](./03-deployment/performance/optimization.md)

### 🔧 [운영 가이드](./04-operations/)
- [운영 가이드](./04-operations/operations-guide.md)
- [서비스 가이드](./04-operations/service.md) ⭐
- [백엔드 헬스 체크](./04-operations/backend-health-check.md)
- [에이전트 서비스](./04-operations/agent-service.md)
- [VM 미디어 관리](./04-operations/vm-media-management.md)
- [프록시 수정 가이드](./04-operations/proxy-fix-guide.md)
- [최적화](./04-operations/optimization.md)
- [공통 RAG 폴더](./04-operations/rag-common-folder.md)
- [자동 동기화 가이드](./04-operations/auto-sync-guide.md)

#### 📊 [보고서](./04-operations/reports/)
- [최적화 요약](./04-operations/reports/optimization-summary.md)
- [딥 최적화 리포트](./04-operations/reports/deep-optimization-report.md)

#### 🔍 [문제 해결](./04-operations/troubleshooting/)
- [일반적인 문제](./04-operations/troubleshooting/common-issues.md)
- [FAQ](./04-operations/troubleshooting/faq.md)
- [쿠키 디버깅 가이드](./04-operations/troubleshooting/cookie-debug-guide.md)
- [VM 콘솔 수정](./04-operations/troubleshooting/vm-console-fix.md)
- [VNC 무한 로딩 수정](./04-operations/troubleshooting/vnc-infinite-loading-fix.md)
- [ISO 파일 검증](./04-operations/troubleshooting/iso-file-verification.md)
- [백엔드 Envoy 연결](./04-operations/troubleshooting/backend-envoy-connectivity.md)

#### 🔒 [보안](./04-operations/security/)
- [하드웨어 보안](./04-operations/security/hardware-security.md)
- [암호화](./04-operations/security/encryption.md)
- [보안 강화](./04-operations/security/hardening.md)
- [제로 트러스트](./04-operations/security/zero-trust.md)

### 🎨 [프론트엔드](./05-frontend/)
- [프론트엔드 오류](./05-frontend/frontend-errors.md)
- [VNC 뷰어 수정](./05-frontend/vnc-viewer-fixes.md)
- [프론트엔드 UUID 마이그레이션](./05-frontend/frontend-uuid-migration.md)
- [프론트엔드 가이드](./05-frontend/guides/)

### 📦 [아카이브](./99-archive/)
레거시 문서 및 구버전 문서

---

**마지막 업데이트**: 2025-01-02
