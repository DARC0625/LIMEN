# Docker 빠른 시작

> [← 배포](../) | [Docker](./) | [빠른 시작](./quick-start.md) | [상세 가이드](./deployment.md)

## 1분 안에 시작하기

```bash
# 환경 변수 설정
cp backend/env.example .env
# .env 파일 편집

# 실행
docker-compose up -d
```

## 기본 명령어

```bash
# 시작
docker-compose up -d

# 중지
docker-compose stop

# 재시작
docker-compose restart

# 로그 확인
docker-compose logs -f

# 상태 확인
docker-compose ps
```

## 프로덕션 배포

```bash
docker-compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d
```

## 관련 문서

- [Docker 배포 가이드](./deployment.md)
- [컨테이너화 이점](./benefits.md)
- [운영 가이드](../../04-operations/operations-guide.md)

---

**태그**: `#배포` `#Docker` `#빠른-시작`

