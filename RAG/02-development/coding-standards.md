# LIMEN 코딩 스타일 및 파일 구조 규칙

## 핵심 원칙

**모든 파일은 적절한 폴더에 위치해야 합니다. 루트 폴더는 최소한의 파일만 유지합니다.**

## 파일 구조 규칙

### ✅ 루트 폴더에 허용되는 파일

```
LIMEN/
├── README.md              ✅ (프로젝트 설명)
├── .gitignore             ✅ (Git 설정)
├── .gitattributes         ✅ (Git 설정)
└── [기타 최소한의 설정 파일]
```

### ❌ 루트 폴더에 금지되는 파일

- **스크립트 파일** (`*.sh`, `*.bash`) → `scripts/` 폴더로 이동
- **설정 파일** (`*.json`, `*.yaml`, `*.yml`) → `config/` 폴더로 이동
- **Docker 파일** (`docker-compose.yml`, `.dockerignore`) → `infra/docker/` 폴더로 이동
- **문서 파일** (`*.md`) → `RAG/` 폴더로 이동
- **임시 파일** → 제거 또는 적절한 폴더로 이동

## 폴더별 파일 배치 규칙

### `scripts/` 폴더
**모든 실행 가능한 스크립트는 여기에 위치**

```
scripts/
├── *.sh                   ✅ 모든 쉘 스크립트
├── *.bash                 ✅ 모든 bash 스크립트
└── [기타 실행 스크립트]
```

**규칙:**
- 루트에 `.sh` 파일을 절대 생성하지 않음
- 모든 스크립트는 `scripts/` 폴더에 생성
- 스크립트 이름은 `lowercase-with-hyphens.sh` 형식 사용

### `config/` 폴더
**모든 설정 파일은 여기에 위치**

```
config/
├── .editorconfig          ✅ 에디터 설정
├── .server-spec.json      ✅ 서버 스펙
├── deploy/
│   └── .deployignore      ✅ 배포 설정
└── lint/
    └── .markdownlint.json  ✅ 린트 설정
```

**규칙:**
- 루트에 설정 파일을 절대 생성하지 않음
- 모든 설정 파일은 `config/` 또는 하위 폴더에 생성

### `infra/docker/` 폴더
**모든 Docker 관련 파일은 여기에 위치**

```
infra/docker/
├── docker-compose.yml     ✅ Docker Compose
├── docker-compose.dev.yml ✅ 개발용 Docker Compose
└── .dockerignore          ✅ Docker ignore
```

**규칙:**
- 루트에 Docker 파일을 절대 생성하지 않음
- 모든 Docker 파일은 `infra/docker/` 폴더에 생성

### `RAG/` 폴더
**모든 문서 파일은 여기에 위치**

```
RAG/
├── README.md              ✅ RAG 개요
├── CHANGELOG.md           ✅ 변경 이력
├── 01-architecture/       ✅ 아키텍처 문서
├── 02-development/        ✅ 개발 문서
├── 03-api/                ✅ API 문서
├── 04-operations/         ✅ 운영 문서
└── 05-frontend/           ✅ 프론트엔드 문서
```

**규칙:**
- 루트에 `.md` 파일을 절대 생성하지 않음
- 모든 문서는 `RAG/` 폴더의 적절한 하위 폴더에 생성

## 파일 생성 체크리스트

새 파일을 생성하기 전에 반드시 확인:

- [ ] 이 파일이 루트에 있어야 하는가?
- [ ] 적절한 폴더가 존재하는가?
- [ ] 파일 이름이 규칙에 맞는가? (`lowercase-with-hyphens.ext`)

## 자동 검증

### 스크립트로 검증

```bash
# 루트에 스크립트 파일이 있는지 확인
find . -maxdepth 1 -name "*.sh" -o -name "*.bash"

# 루트에 설정 파일이 있는지 확인
find . -maxdepth 1 -name "*.json" -o -name "*.yaml" -o -name "*.yml"

# 루트에 문서 파일이 있는지 확인
find . -maxdepth 1 -name "*.md" | grep -v "README.md"
```

## 위반 시 조치

1. **즉시 이동**: 파일을 적절한 폴더로 이동
2. **경로 업데이트**: 파일을 참조하는 모든 코드/문서 업데이트
3. **RAG 기록**: 변경사항을 RAG에 기록

## 예시

### ❌ 잘못된 예

```
LIMEN/
├── setup.sh              ❌ 루트에 스크립트
├── config.json           ❌ 루트에 설정 파일
├── docker-compose.yml    ❌ 루트에 Docker 파일
└── guide.md              ❌ 루트에 문서
```

### ✅ 올바른 예

```
LIMEN/
├── README.md             ✅ 루트에 허용
├── scripts/
│   └── setup.sh          ✅ scripts/ 폴더
├── config/
│   └── config.json       ✅ config/ 폴더
├── infra/docker/
│   └── docker-compose.yml ✅ infra/docker/ 폴더
└── RAG/
    └── guide.md          ✅ RAG/ 폴더
```

## 관련 문서

- [RAG 워크플로우 가이드](../04-operations/rag-workflow.md)
- [프로젝트 구조](../01-architecture/system-design.md)

---

**마지막 업데이트**: 2025-01-02







