# RAG 워크플로우 가이드

## 📋 개요

LIMEN 프로젝트는 프론트엔드와 백엔드 서버 모두에서 **동일한 RAG 시스템**을 사용합니다. 이를 통해 AI가 각 서버에서 작업할 때 전체 프로젝트의 문서를 참조할 수 있습니다.

## 🎯 핵심 원칙

### 1. RAG 폴더는 항상 동일

```
프론트엔드 서버 RAG/ = 백엔드 서버 RAG/
```

- RAG 폴더는 Git에 추적되어 항상 동기화됩니다
- 프론트엔드와 백엔드 서버 모두 동일한 RAG 내용을 가집니다
- RAG 폴더 변경 시 반드시 커밋하여 동기화를 유지합니다

### 2. 작업 영역은 분리

```
프론트엔드 서버: frontend/ 만 작업
백엔드 서버: backend/ 만 작업
```

- 각 서버는 자신의 코드만 수정합니다
- 다른 서버의 코드는 체크아웃되지 않습니다 (Sparse-checkout)

### 3. AI의 접근 방식

#### 프론트엔드 서버에서 AI 작업 시:
- ✅ **참조 가능**: RAG 폴더의 모든 문서 (백엔드 API, 아키텍처 등)
- ✅ **작업 가능**: `frontend/` 디렉토리만
- ❌ **작업 불가**: `backend/` 디렉토리 (체크아웃 안 됨)

#### 백엔드 서버에서 AI 작업 시:
- ✅ **참조 가능**: RAG 폴더의 모든 문서 (프론트엔드 구조, 컴포넌트 등)
- ✅ **작업 가능**: `backend/` 디렉토리만
- ❌ **작업 불가**: `frontend/` 디렉토리 (체크아웃 안 됨)

## 🔄 RAG 동기화

### 자동 동기화

```bash
# RAG 폴더 동기화 스크립트
./scripts/sync-rag-between-servers.sh
```

이 스크립트는:
1. 원격 RAG 변경사항 확인
2. 로컬 RAG 변경사항 확인
3. 원격 변경사항이 있으면 자동으로 가져오기
4. RAG 구조 검증

### 수동 동기화

```bash
# 최신 변경사항 가져오기
git pull origin main

# RAG 폴더만 업데이트
git checkout origin/main -- RAG/
```

### RAG 변경사항 커밋

```bash
# RAG 폴더 변경 후 반드시 커밋
git add RAG/
git commit -m "docs: RAG 폴더 업데이트"
git push origin main
```

## 📚 RAG 구조

```
RAG/
├── 01-architecture/      # 아키텍처 문서 (프론트+백엔드 공통)
├── 02-development/      # 개발 가이드 (프론트+백엔드 공통)
├── 03-deployment/       # 배포 가이드 (프론트+백엔드 공통)
├── 04-operations/       # 운영 가이드 (프론트+백엔드 공통)
├── 05-frontend/         # 프론트엔드 관련 문서
│   ├── components/      # 컴포넌트 문서
│   ├── hooks/           # Hooks 문서
│   ├── lib/             # 라이브러리 문서
│   └── app/             # App 라우팅 문서
└── 99-archive/          # 아카이브 문서
```

## 🤖 AI 작업 시나리오

### 시나리오 1: 프론트엔드에서 API 연동

**상황**: 프론트엔드에서 새로운 백엔드 API를 호출해야 함

**AI의 접근**:
1. RAG 폴더에서 백엔드 API 문서 참조 (`RAG/02-development/api/`)
2. API 엔드포인트, 요청/응답 형식 확인
3. `frontend/lib/api/`에 API 클라이언트 코드 작성
4. `frontend/components/`에 UI 컴포넌트 작성

**작업 영역**: `frontend/`만 수정

### 시나리오 2: 백엔드에서 프론트엔드 구조 고려

**상황**: 백엔드 API를 변경할 때 프론트엔드 영향도 확인

**AI의 접근**:
1. RAG 폴더에서 프론트엔드 구조 참조 (`RAG/05-frontend/`)
2. 프론트엔드에서 사용하는 API 엔드포인트 확인
3. 호환성을 유지하면서 백엔드 API 수정
4. API 문서 업데이트

**작업 영역**: `backend/`만 수정

### 시나리오 3: 아키텍처 변경

**상황**: 전체 시스템 아키텍처 변경

**AI의 접근**:
1. RAG 폴더에서 아키텍처 문서 참조 (`RAG/01-architecture/`)
2. 프론트엔드와 백엔드 모두 고려하여 설계
3. 각 서버에서 해당 부분만 수정
4. 아키텍처 문서 업데이트 후 RAG에 반영

**작업 영역**: 각 서버에서 자신의 코드만 수정

## 🔍 검증

### RAG 동기화 확인

```bash
# RAG 폴더 상태 확인
./scripts/sync-rag-between-servers.sh

# RAG 구조 검증
./scripts/verify-rag-structure.sh
```

### 서버별 체크아웃 확인

```bash
# 프론트엔드 서버
./scripts/verify-checkout.sh
# → frontend/, docs/, RAG/만 있어야 함

# 백엔드 서버
./scripts/verify-checkout.sh
# → backend/, docs/, RAG/만 있어야 함
```

## ⚠️ 주의사항

### 1. RAG 폴더는 항상 커밋

RAG 폴더의 변경사항은 반드시 커밋하여 프론트엔드와 백엔드 서버 간 동기화를 유지하세요.

```bash
# 잘못된 예
git add frontend/
git commit -m "feat: Add feature"
# RAG 폴더 변경사항이 커밋되지 않음!

# 올바른 예
git add frontend/ RAG/
git commit -m "feat: Add feature and update RAG"
```

### 2. 다른 서버의 코드는 수정하지 않음

프론트엔드 서버에서는 `backend/` 디렉토리가 체크아웃되지 않으므로 수정할 수 없습니다. 백엔드 변경이 필요하면 백엔드 서버에서 작업하세요.

### 3. RAG 폴더 충돌 해결

RAG 폴더에서 충돌이 발생하면:

```bash
# 원격 버전 사용 (일반적으로 권장)
git checkout --theirs RAG/
git add RAG/
git commit -m "docs: Resolve RAG conflicts"

# 또는 로컬 버전 사용
git checkout --ours RAG/
git add RAG/
git commit -m "docs: Resolve RAG conflicts"
```

## 📊 요약

| 항목 | 프론트엔드 서버 | 백엔드 서버 |
|------|----------------|------------|
| **RAG 폴더** | ✅ 동일 | ✅ 동일 |
| **작업 영역** | `frontend/`만 | `backend/`만 |
| **참조 가능** | 전체 문서 | 전체 문서 |
| **수정 가능** | `frontend/`만 | `backend/`만 |

## 🎯 결론

**AI는 백엔드와 완전히 동일한 로직으로 생각하고 참고하고 작성합니다.**
- ✅ RAG 폴더를 통해 전체 프로젝트 문서 참조
- ✅ 아키텍처, API, 구조 등 모든 정보 활용
- ✅ 프론트엔드 서버에서는 `frontend/`만 작업
- ✅ 백엔드 서버에서는 `backend/`만 작업

**단, 각 서버에서는 자신의 코드만 수정합니다.**

---

**최종 업데이트**: 2025-01-14  
**관련 스크립트**: 
- `scripts/sync-rag-between-servers.sh`
- `scripts/setup-rag-for-frontend.sh`
- `scripts/verify-rag-structure.sh`

