# RAG 워크플로우 가이드

## 개요

LIMEN 프로젝트에서는 **모든 작업이 RAG 문서를 기반으로 수행**되어야 합니다.
RAG는 단순한 문서 저장소가 아니라, 프로젝트의 **단일 진실 공급원(Single Source of Truth)**입니다.

## 핵심 원칙

### 1. 작업 전 RAG 확인 (필수)
모든 작업을 시작하기 전에 반드시 관련 RAG 문서를 확인해야 합니다.

```bash
./scripts/check-rag-before-work.sh
```

### 2. 변경사항 RAG 기록 (필수)
모든 코드, 설정, 문서 변경은 반드시 RAG에 기록되어야 합니다.

```bash
# 자동 기록 (Git 변경사항 감지)
./scripts/record-changes-to-rag.sh --auto

# 수동 기록
./scripts/record-changes-to-rag.sh -t api -f backend/handlers/vm.go "VM 생성 API 수정"
```

### 3. 커밋 전 RAG 검증 (자동)
Git pre-commit hook이 자동으로 RAG 검증을 수행합니다.

- 코드 변경이 있으면 RAG 문서 업데이트 확인
- RAG 문서가 업데이트되지 않으면 커밋 차단
- 긴급 상황에서만 `--no-verify` 사용 (최소화)

## 작업 워크플로우

### 표준 워크플로우

```bash
# 1. 작업 시작 전 RAG 확인
./scripts/check-rag-before-work.sh

# 2. 작업 수행
# ... 코드/설정 변경 ...

# 3. 변경사항 RAG에 기록
./scripts/record-changes-to-rag.sh --auto

# 4. 필요시 상세 문서 작성
# RAG/01-architecture/ 또는 관련 폴더에 문서 추가

# 5. 커밋 (자동 검증)
git add .
git commit -m "변경 내용"

# 6. RAG 인덱싱 (자동 - post-commit hook)
```

### 빠른 참조

```bash
# 워크플로우 가이드 보기
./scripts/workflow-guide.sh
```

## RAG 구조

```
RAG/
├── README.md                    # RAG 개요
├── CHANGELOG.md                 # 모든 변경사항 기록
├── 01-architecture/            # 아키텍처 문서
├── 02-development/              # 개발 가이드
├── 03-api/                      # API 문서
├── 04-operations/               # 운영/배포 문서
│   ├── rag-workflow.md         # 이 문서
│   ├── deployment-guide.md     # 배포 가이드
│   └── ...
└── 05-frontend/                 # 프론트엔드 문서
```

## 변경사항 기록 규칙

### 기록해야 할 변경사항

1. **코드 변경**
   - 새로운 기능 추가
   - 기존 기능 수정
   - 버그 수정
   - 리팩토링

2. **설정 변경**
   - 환경 변수 변경
   - 설정 파일 수정
   - 인프라 설정 변경

3. **스크립트 변경**
   - 배포 스크립트 수정
   - 유틸리티 스크립트 추가/수정

4. **문서 변경**
   - RAG 문서 업데이트
   - README 수정

### 기록 형식

```bash
# 자동 기록 (권장)
./scripts/record-changes-to-rag.sh --auto

# 수동 기록
./scripts/record-changes-to-rag.sh \
  -t api \
  -f backend/internal/handlers/vm.go \
  "VM 생성 API에 검증 로직 추가"
```

### 변경 유형

- `architecture`: 아키텍처 변경
- `development`: 개발/코드 변경
- `api`: API 변경
- `operations`: 운영/배포 변경
- `frontend`: 프론트엔드 변경
- `config`: 설정 변경

## Git Hooks

### Pre-commit Hook

**위치**: `.git/hooks/pre-commit`

**기능**:
- 코드 변경 시 RAG 문서 업데이트 확인
- RAG 문서 업데이트 없으면 커밋 차단
- RAG 문서 변경 시 자동 인덱싱

**우회 방법** (긴급 상황만):
```bash
git commit --no-verify
```

### Post-commit Hook

**위치**: `.git/hooks/post-commit`

**기능**:
- 커밋 후 자동 RAG 인덱싱
- 벡터 데이터베이스 업데이트

## RAG 검색 및 확인

### 작업 전 확인

```bash
./scripts/check-rag-before-work.sh
```

이 스크립트는:
- RAG 폴더 구조 확인
- 최근 변경된 문서 표시
- 작업 유형별 관련 문서 안내

### RAG 인덱싱

```bash
./scripts/rag-index.sh
```

인덱싱은:
- 모든 RAG 문서를 벡터화
- 검색 가능한 인덱스 생성
- AI 모델이 참조할 수 있도록 준비

## 문제 해결

### Pre-commit Hook이 커밋을 차단함

**원인**: 코드 변경이 있지만 RAG 문서가 업데이트되지 않음

**해결**:
1. 변경사항을 RAG에 기록:
   ```bash
   ./scripts/record-changes-to-rag.sh --auto
   ```
2. 필요시 상세 문서 작성
3. 다시 커밋 시도

### RAG 인덱싱 실패

**원인**: 스크립트 오류 또는 권한 문제

**해결**:
```bash
# 수동 인덱싱
./scripts/rag-index.sh

# 권한 확인
chmod +x scripts/rag-index.sh
```

### 변경사항 기록 스크립트 오류

**원인**: 필수 파라미터 누락

**해결**:
```bash
# 도움말 확인
./scripts/record-changes-to-rag.sh --help

# 올바른 형식으로 실행
./scripts/record-changes-to-rag.sh -t <유형> -f <파일> "<설명>"
```

## 모범 사례

### ✅ 권장 사항

1. **작업 전 항상 RAG 확인**
   - 관련 문서를 먼저 읽고 이해
   - 기존 패턴과 일관성 유지

2. **변경사항 즉시 기록**
   - 작업 중간에도 기록
   - 커밋 전에 반드시 기록

3. **상세한 설명 작성**
   - 무엇을 변경했는지
   - 왜 변경했는지
   - 어떻게 변경했는지

4. **문서화 우선**
   - 복잡한 변경은 상세 문서 작성
   - 다른 개발자가 이해할 수 있도록

### ❌ 피해야 할 것

1. **RAG 확인 없이 작업 시작**
   - 기존 패턴을 모르고 중복 작업
   - 일관성 없는 코드 작성

2. **변경사항 기록 생략**
   - 나중에 기록하려다 깜빡
   - 커밋만 하고 기록 안 함

3. **--no-verify 남용**
   - RAG 검증을 우회하는 습관
   - 긴급 상황이 아닌데도 사용

4. **불명확한 기록**
   - "수정함", "변경함" 같은 모호한 설명
   - 파일명만 기록하고 내용 없음

## 자동화

### CI/CD 통합

GitHub Actions나 다른 CI/CD 시스템에서도 RAG 검증을 수행할 수 있습니다:

```yaml
# .github/workflows/rag-verify.yml
- name: RAG 검증
  run: |
    ./scripts/check-rag-before-work.sh
    git diff --cached --name-only | grep -E '\.(go|ts|js)$' && \
      git diff --cached --name-only | grep -q "^RAG/" || \
      (echo "코드 변경이 있지만 RAG 문서가 업데이트되지 않았습니다" && exit 1)
```

## 관련 문서

- [배포 가이드](./deployment-guide.md)
- [서비스 가이드](./service.md)
- [보안 가이드](./security/deployment-security.md)

---

**마지막 업데이트**: 2025-01-02


