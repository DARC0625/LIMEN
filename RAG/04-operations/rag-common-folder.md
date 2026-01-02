# LIMEN 공통 RAG 폴더 가이드

## 개요

LIMEN 프로젝트는 프론트엔드와 백엔드가 공통으로 사용하는 `RAG/` 폴더를 통해 모든 지식을 공유합니다.
이 폴더에는 문서, 벡터 임베딩, 인덱스가 저장되어 두 서버가 동일한 지식 기반을 사용합니다.

## 폴더 구조

```
LIMEN/
└── RAG/                    # 공통 RAG 폴더 (문서 폴더)
    ├── 01-architecture/    # 아키텍처 문서
    ├── 02-development/     # 개발 가이드
    ├── 03-api/             # API 문서
    ├── 04-operations/      # 운영/배포 문서
    ├── 05-frontend/        # 프론트엔드 문서
    ├── 99-archive/         # 아카이브
    ├── vectors/            # 벡터 임베딩 데이터
    ├── index/              # 인덱스 파일
    ├── embeddings/         # 임베딩 모델 캐시
    └── README.md           # RAG 폴더 설명
```

## 동기화 시스템

### 자동 동기화

AI 작업 완료 시 자동으로:
1. `RAG/` 폴더의 문서 인덱싱 수행
2. 벡터 임베딩 생성
3. 백엔드/프론트엔드 서버에 동기화

### 수동 동기화

```bash
# 전체 문서 동기화
./scripts/sync-rag-docs.sh all

# 변경된 문서만 동기화
./scripts/sync-rag-docs.sh changed

# 동기화 상태 확인
./scripts/sync-rag-docs.sh status
```

## 환경 변수 설정

### 백엔드

```bash
# .env 파일
RAG_PATH=/home/darc0/LIMEN/RAG
```

### 프론트엔드

```bash
# .env.local 파일
NEXT_PUBLIC_RAG_PATH=/home/darc0/LIMEN/RAG
```

## 사용 방법

### 백엔드에서 사용

```go
import "limen/internal/rag"

// RAG 클라이언트 생성
client := rag.NewRAGClient()

// 문서 검색
documents, err := client.SearchDocuments("VM 생성", 10)

// 문서 가져오기
doc, err := client.GetDocument("04-operations/service.md")

// 문서 목록
docs, err := client.ListDocuments("04-operations")
```

### 프론트엔드에서 사용

```typescript
import { ragClient } from '@/lib/rag-client';

// 문서 검색
const documents = await ragClient.searchDocuments('VM 생성', 10);

// 문서 가져오기
const doc = await ragClient.getDocument('04-operations/service.md');

// 문서 목록
const docs = await ragClient.listDocuments('04-operations');
```

## API 엔드포인트

백엔드에서 제공하는 RAG API:

### 문서 검색

**POST** `/api/rag/search`

```json
{
  "query": "VM 생성",
  "limit": 10
}
```

### 문서 가져오기

**GET** `/api/rag/document?path=04-operations/service.md`

### 문서 목록

**GET** `/api/rag/documents?category=04-operations`

## 동기화 플로우

```
1. AI 작업 완료
   ↓
2. auto-commit-push.sh 실행
   ↓
3. Git 커밋 및 푸시
   ↓
4. rag-index.sh 실행 (RAG/ 인덱싱)
   ↓
5. 백엔드/프론트엔드에서 RAG/ 폴더 사용
```

## 주의사항

1. **문서 위치**: 모든 문서는 `RAG/` 폴더에 직접 저장됩니다. `RAG/docs/` 같은 서브폴더는 없습니다.

2. **벡터 데이터**: `RAG/vectors/`와 `RAG/index/`는 자동 생성되므로 수동 수정하지 마세요.

3. **문서 확인**: 문서를 수정한 후 `sync-rag-docs.sh status`로 문서 상태를 확인하세요.

4. **Git 관리**: `RAG/` 폴더의 문서는 Git에 포함되지만, `RAG/vectors/`와 `RAG/index/`는 `.gitignore`에 포함됩니다.

## 문제 해결

### 문서가 동기화되지 않는 경우

```bash
# 전체 재동기화
./scripts/sync-rag-docs.sh all

# 상태 확인
./scripts/sync-rag-docs.sh status
```

### RAG 경로 오류

```bash
# 환경 변수 확인
echo $RAG_PATH
echo $NEXT_PUBLIC_RAG_PATH

# 기본값: /home/darc0/LIMEN/RAG
```

### 인덱싱 실패

```bash
# 전체 재인덱싱
./scripts/rag-index.sh all
```

## 관련 문서

- [자동 동기화 가이드](./auto-sync-guide.md)
- [RAG 인덱싱](./rag-indexing.md)
- [서비스 가이드](./service.md)

---

**마지막 업데이트**: 2025-01-02

