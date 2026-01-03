# LIMEN 설정 파일

이 폴더는 LIMEN 프로젝트의 설정 파일들을 관리합니다.

## 폴더 구조

```
config/
├── deploy/              # 배포 관련 설정
│   └── .deployignore    # 배포 시 제외할 파일 목록
├── lint/                # 린트 설정
│   └── .markdownlint.json  # 마크다운 린트 규칙
├── .editorconfig        # 에디터 설정
├── .server-spec.json    # 서버 하드웨어 스펙
└── README.md            # 이 파일
```

## 파일 설명

### 배포 설정
- `.deployignore`: 배포 시 제외할 파일/폴더 목록

### 린트 설정
- `.markdownlint.json`: 마크다운 파일 린트 규칙

### 에디터 설정
- `.editorconfig`: 에디터 공통 설정 (들여쓰기, 인코딩 등)

### 서버 스펙
- `.server-spec.json`: 서버 하드웨어 사양 정보

## 사용 방법

### 배포 시
배포 스크립트가 자동으로 `.deployignore`를 참조합니다.

### 린트 실행
```bash
# 마크다운 린트 (markdownlint 설치 필요)
markdownlint RAG/**/*.md --config config/lint/.markdownlint.json
```

### 에디터 설정
대부분의 에디터가 자동으로 `.editorconfig`를 인식합니다.

## 관련 문서

- [배포 가이드](../RAG/04-operations/deployment-guide.md)
- [보안 가이드](../RAG/04-operations/security/deployment-security.md)


