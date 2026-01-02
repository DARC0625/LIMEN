# LIMEN 인프라 설정

이 폴더는 LIMEN 프로젝트의 인프라 및 배포 관련 설정을 관리합니다.

## 폴더 구조

```
infra/
├── docker/              # Docker 관련 설정
│   ├── docker-compose.yml      # 프로덕션 Docker Compose
│   ├── docker-compose.dev.yml  # 개발용 Docker Compose
│   └── .dockerignore           # Docker 빌드 제외 파일
└── README.md            # 이 파일
```

## Docker 설정

### 프로덕션 배포
```bash
cd infra/docker
docker-compose up -d
```

### 개발 환경
```bash
cd infra/docker
docker-compose -f docker-compose.dev.yml up -d
```

## 파일 설명

### docker-compose.yml
프로덕션 환경용 Docker Compose 설정:
- PostgreSQL 데이터베이스
- LIMEN 백엔드 서비스
- LIMEN 에이전트

### docker-compose.dev.yml
개발 환경용 Docker Compose 설정:
- 개발 모드 설정
- 디버깅 옵션
- 핫 리로드

### .dockerignore
Docker 빌드 시 제외할 파일 목록:
- Git 파일
- 로그 파일
- 빌드 아티팩트
- 불필요한 의존성

## 관련 문서

- [배포 가이드](../RAG/04-operations/deployment-guide.md)
- [Docker 배포](../RAG/03-deployment/docker/deployment.md)
