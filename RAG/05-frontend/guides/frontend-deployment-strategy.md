# 프론트엔드 배포 전략

> [← 홈](../../00-home.md) | [프론트엔드](../) | [가이드](./) | [배포 전략](./FRONTEND_DEPLOYMENT_STRATEGY.md)

## ⚠️ 참고사항

이 문서는 과거 프론트엔드 개발 시 작성된 가이드입니다. 현재 LIMEN 프로젝트는 프론트엔드가 제거된 백엔드 전용 구조입니다. 향후 프론트엔드 재구축 시 참고용으로 보관됩니다.

---

## 개요

LIMEN 백엔드는 완전히 분리된 아키텍처로 설계되어 있어, 프론트엔드를 독립적으로 배포할 수 있습니다. 이 문서는 향후 프론트엔드 재구축 및 배포를 위한 전략을 제시합니다.

---

## 배포 아키텍처

### 분리된 아키텍처

```
┌─────────────┐         ┌─────────────┐
│  Frontend   │ ──────► │   Backend   │
│  (Next.js)  │  API    │    (Go)     │
└─────────────┘         └─────────────┘
```

- 프론트엔드와 백엔드 완전 분리
- API 기반 통신
- 독립적 배포 가능

---

## 배포 옵션

### 옵션 1: 정적 사이트 생성 (SSG)

Next.js를 정적 사이트로 빌드하여 배포:

```bash
npm run build
npm run export
```

**장점:**
- 빠른 로딩 속도
- CDN 배포 가능
- 서버 비용 절감

### 옵션 2: 서버 사이드 렌더링 (SSR)

Next.js 서버로 실행:

```bash
npm run build
npm start
```

**장점:**
- 동적 콘텐츠 지원
- SEO 최적화
- 실시간 데이터 업데이트

### 옵션 3: 컨테이너 배포

Docker를 사용한 컨테이너 배포:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 환경 변수 설정

### 개발 환경

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:18443
NEXT_PUBLIC_API_URL=http://localhost:18443/api
NEXT_PUBLIC_AGENT_URL=http://localhost:9000
```

### 프로덕션 환경

```env
NEXT_PUBLIC_BACKEND_URL=https://api.darc.kr
NEXT_PUBLIC_API_URL=https://api.darc.kr/api
NEXT_PUBLIC_AGENT_URL=https://api.darc.kr/agent
```

---

## CORS 설정

백엔드에서 프론트엔드 도메인을 허용:

```bash
ALLOWED_ORIGINS=https://www.darc.kr,https://darc.kr
```

---

## 리버스 프록시 설정

### Nginx 예시

```nginx
server {
    listen 443 ssl http2;
    server_name www.darc.kr;

    # 프론트엔드
    location / {
        proxy_pass http://localhost:3000;
    }

    # 백엔드 API
    location /api {
        proxy_pass http://localhost:18443;
    }

    # Agent 메트릭스
    location /agent {
        proxy_pass http://localhost:18443;
    }
}
```

---

## CI/CD 파이프라인

### GitHub Actions 예시

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run deploy
```

---

## 관련 문서

- [프론트엔드 개발자 가이드](./FRONTEND_DEVELOPER_GUIDE.md)
- [재구축 가이드](./FRONTEND_RECONSTRUCTION_GUIDE.md)
- [빠른 설정](./FRONTEND_QUICK_SETUP.md)

---

**태그**: `#프론트엔드` `#배포` `#전략` `#과거-기록`

**카테고리**: 프론트엔드 > 가이드 > 배포 전략

**상태**: 과거 기록 (프론트엔드 제거됨)

**마지막 업데이트**: 2024-12-23
