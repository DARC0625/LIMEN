# LIMEN 자동 동기화 가이드

## 개요

LIMEN 프로젝트는 AI 작업 완료 시 자동으로 커밋하고 푸시하며, 백엔드와 프론트엔드 서버의 문서를 최신화하는 자동화 시스템을 구축했습니다.

## 시스템 구성

### 1. 자동 커밋 및 푸시

**스크립트**: `scripts/auto-commit-push.sh`

AI가 작업을 완료할 때마다 자동으로:
- 변경사항을 Git에 커밋
- 원격 저장소로 푸시
- 문서 동기화 트리거
- RAG 인덱싱 트리거

#### 사용 방법

```bash
# 수동 실행
./scripts/auto-commit-push.sh

# 또는 AI 작업 완료 시 자동 실행
# (AI가 작업 완료 시 자동으로 호출)
```

#### 커밋 메시지 형식

자동 생성되는 커밋 메시지:
```
🤖 AI 작업 완료 - 문서 업데이트 - 코드 변경

변경된 파일: 5개
주요 변경: RAG/markdown-guide.md scripts/validate-markdown.sh ...

자동 커밋: 2025-01-02 22:30:00
```

### 2. RAG 인덱싱 시스템

**스크립트**: `scripts/rag-index.sh`

문서를 벡터 데이터베이스에 인덱싱하여 RAG(Retrieval-Augmented Generation) 시스템을 구축합니다.

#### 기능

- **문서 청크 분할**: 마크다운 문서를 의미 있는 단위로 분할
- **메타데이터 추출**: 제목, 카테고리, 수정일 등 추출
- **벡터 임베딩**: 향후 LLM API 연동으로 벡터 임베딩 생성
- **검색 기능**: 문서 검색 및 관련성 검색

#### 사용 방법

```bash
# 전체 문서 인덱싱
./scripts/rag-index.sh all

# 변경된 문서만 인덱싱
./scripts/rag-index.sh changed

# 문서 검색
./scripts/rag-index.sh search "VM 생성"

# 자동 모드 (변경된 문서만)
./scripts/rag-index.sh --auto
```

#### 인덱스 저장 위치

- 인덱스 파일: `.rag/index.json`
- 벡터 DB: `.rag/vectors/`

### 3. 문서 동기화

#### 백엔드 서버 동기화

백엔드 서버에 문서 동기화 API가 구현되어 있어야 합니다:

```go
// 예시: backend/internal/handlers/docs.go
POST /api/RAG/sync
{
  "source": "git",
  "branch": "main"
}
```

환경 변수 설정:
```bash
export BACKEND_SYNC_URL="https://backend.limen.kr"
```

#### 프론트엔드 서버 동기화

프론트엔드 서버에도 동일한 API가 필요합니다:

```bash
export FRONTEND_SYNC_URL="https://frontend.limen.kr"
```

## 설정 방법

### 1. 환경 변수 설정

`.env` 파일에 추가:

```bash
# 문서 동기화 URL
BACKEND_SYNC_URL=https://backend.limen.kr
FRONTEND_SYNC_URL=https://frontend.limen.kr

# RAG 설정
RAG_ENABLED=true
RAG_API_KEY=your-api-key  # 향후 LLM API 키
```

### 2. Git Hooks 설정

Git hooks는 이미 설정되어 있습니다:
- `.git/hooks/post-commit`: 커밋 후 자동 인덱싱

### 3. CI/CD 통합 (선택사항)

GitHub Actions 예시:

```yaml
name: Auto Sync Docs

on:
  push:
    paths:
      - 'RAG/**'
      - '*.md'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: RAG 인덱싱
        run: ./scripts/rag-index.sh changed
      - name: 문서 동기화
        run: ./scripts/auto-commit-push.sh
```

## 향후 개선 사항

### 1. 벡터 임베딩 통합

현재는 메타데이터만 저장하지만, 향후 다음을 통합할 예정:
- OpenAI Embeddings API
- 또는 로컬 임베딩 모델 (sentence-transformers)

### 2. 실시간 동기화

- WebSocket을 통한 실시간 문서 업데이트
- 서버 간 자동 동기화

### 3. 검색 기능 강화

- 의미 기반 검색 (벡터 유사도)
- 하이브리드 검색 (키워드 + 벡터)
- 관련 문서 추천

### 4. 문서 버전 관리

- 문서 변경 이력 추적
- 버전별 인덱싱
- 롤백 기능

## 문제 해결

### 커밋이 자동으로 되지 않는 경우

1. Git 저장소 확인:
```bash
git status
```

2. 스크립트 실행 권한 확인:
```bash
chmod +x scripts/auto-commit-push.sh
```

3. 수동 실행:
```bash
./scripts/auto-commit-push.sh
```

### RAG 인덱싱 실패

1. 인덱스 디렉토리 확인:
```bash
ls -la .rag/
```

2. 전체 재인덱싱:
```bash
./scripts/rag-index.sh all
```

### 문서 동기화 실패

1. 환경 변수 확인:
```bash
echo $BACKEND_SYNC_URL
echo $FRONTEND_SYNC_URL
```

2. API 엔드포인트 확인:
```bash
curl -X POST "$BACKEND_SYNC_URL/api/RAG/sync" \
  -H "Content-Type: application/json" \
  -d '{"source":"git","branch":"main"}'
```

## 관련 문서

- [마크다운 작성 가이드](../markdown-guide.md)
- [서비스 가이드](./service.md)
- [운영 가이드](./operations-guide.md)

---

**마지막 업데이트**: 2025-01-02

