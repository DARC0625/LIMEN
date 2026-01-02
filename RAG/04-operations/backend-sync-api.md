# 백엔드 문서 동기화 API 구현 가이드

## 개요

백엔드 서버에 문서 동기화 API를 구현하여 AI 작업 완료 시 자동으로 문서를 최신화할 수 있습니다.

## API 엔드포인트

### 1. 문서 동기화

**POST** `/api/RAG/sync`

문서를 Git 저장소에서 동기화합니다.

#### 요청 본문

```json
{
  "source": "git",
  "branch": "main"
}
```

#### 응답

```json
{
  "status": "success",
  "message": "Documents synced successfully",
  "time": 1704211200
}
```

### 2. 문서 상태 조회

**GET** `/api/RAG/status`

현재 동기화된 문서의 상태를 조회합니다.

#### 응답

```json
{
  "doc_count": 95,
  "last_modified": 1704211200,
  "docs_dir": "/home/darc0/LIMEN/docs"
}
```

## 구현 예시

### Go (Gorilla Mux)

```go
// router.go
router.HandleFunc("/api/RAG/sync", handlers.SyncDocsHandler).Methods("POST")
router.HandleFunc("/api/RAG/status", handlers.GetDocsStatusHandler).Methods("GET")
```

### 환경 변수

```bash
# .env
DOCS_DIR=/home/darc0/LIMEN/docs
GIT_REPO_PATH=/home/darc0/LIMEN
RAG_INDEX_SCRIPT=/home/darc0/LIMEN/scripts/rag-index.sh
DOCS_SOURCE_DIR=/home/darc0/LIMEN/docs
```

## 보안 고려사항

1. **인증**: API에 인증 토큰 추가 권장
2. **권한**: 문서 동기화는 관리자만 가능하도록
3. **검증**: 요청 소스 검증 (Git webhook 등)

## 테스트

```bash
# 문서 동기화 테스트
curl -X POST http://localhost:18443/api/RAG/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"source":"git","branch":"main"}'

# 문서 상태 조회
curl http://localhost:18443/api/RAG/status
```

## 관련 파일

- 구현 예시: `backend/internal/handlers/docs_sync.go.example`
- 자동화 가이드: `RAG/04-operations/auto-sync-guide.md`

