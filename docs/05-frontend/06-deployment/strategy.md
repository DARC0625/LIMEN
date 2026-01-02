# 프론트엔드 배포 전략

> **LIMEN 프론트엔드 배포 방법 및 전략**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [배포](./) > 배포 전략

---

## 📋 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [배포 옵션](#배포-옵션)
3. [현재 배포 방식](#현재-배포-방식)
4. [환경 변수 설정](#환경-변수-설정)
5. [빌드 및 배포](#빌드-및-배포)
6. [모니터링](#모니터링)

---

## 아키텍처 개요

### 현재 구조

```
┌─────────────────┐
│   Frontend      │  Next.js (Port: 9443)
│   (Next.js)     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Reverse Proxy  │  Envoy/Nginx
│   (HTTPS)       │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Backend (Go)   │  Port: 18443
│  CORS Enabled   │
└─────────────────┘
```

### 분리된 아키텍처의 장점

1. **독립적 배포**: 프론트엔드와 백엔드를 독립적으로 배포 및 업데이트 가능
2. **스케일링**: 각 컴포넌트를 독립적으로 스케일링 가능
3. **CDN 활용**: 정적 자산을 CDN에 배포하여 성능 향상
4. **다중 프론트엔드**: 모바일 앱, 관리자 대시보드 등 다양한 클라이언트 지원 가능

---

## 배포 옵션

### 옵션 1: 정적 사이트 호스팅 (권장)

**장점:**
- 최고의 성능 (CDN 활용)
- 낮은 운영 비용
- 자동 스케일링
- 높은 가용성

**단점:**
- SSR 제한적 (현재는 동적 렌더링 사용)
- 서버 사이드 기능 제한

**적용 가능한 서비스:**
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

### 옵션 2: Node.js 서버 (현재 방식)

**장점:**
- 완전한 SSR 지원
- API Routes 활용 가능
- 동적 렌더링 지원

**단점:**
- 서버 운영 필요
- 스케일링 복잡

**현재 설정:**
- PM2로 프로세스 관리
- Port: 9443
- HTTPS 지원

### 옵션 3: Docker 컨테이너

**장점:**
- 일관된 환경
- 쉬운 배포
- 확장성

**단점:**
- 컨테이너 관리 필요

---

## 현재 배포 방식

### PM2 프로세스 관리

```bash
# 빌드
cd /home/darc/LIMEN/frontend
npm run build

# PM2로 시작
pm2 start npm --name limen-frontend -- start

# 재시작
pm2 restart limen-frontend

# 상태 확인
pm2 status

# 로그 확인
pm2 logs limen-frontend
```

### PM2 설정 파일

`ecosystem.config.js` (선택):

```javascript
module.exports = {
  apps: [{
    name: 'limen-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/home/darc/LIMEN/frontend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 9443
    }
  }]
};
```

---

## 환경 변수 설정

### 프로덕션 환경 (`.env.production`)

```env
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
NEXT_PUBLIC_API_URL=http://10.0.0.100:18443/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.100:9000
```

### 개발 환경 (`.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_AGENT_URL=http://localhost:9000
```

### 환경 변수 사용

```typescript
// Next.js에서 환경 변수 접근
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
```

**중요:** `NEXT_PUBLIC_` 접두사가 있는 변수만 클라이언트에서 접근 가능합니다.

---

## 빌드 및 배포

### 1. 빌드

```bash
cd /home/darc/LIMEN/frontend
npm run build
```

### 2. 프로덕션 서버 실행

```bash
# 직접 실행
npm run start

# PM2로 실행
pm2 start npm --name limen-frontend -- start
```

### 3. 배포 스크립트

```bash
#!/bin/bash
# deploy.sh

cd /home/darc/LIMEN/frontend

# 의존성 설치
npm install

# 빌드
npm run build

# PM2 재시작
pm2 restart limen-frontend

echo "Deployment completed!"
```

---

## 모니터링

### PM2 모니터링

```bash
# 프로세스 상태
pm2 status

# 리소스 사용량
pm2 monit

# 로그 확인
pm2 logs limen-frontend

# 메트릭
pm2 describe limen-frontend
```

### Next.js 빌드 분석

```bash
# 번들 분석
npm run build:analyze
```

---

## 관련 문서

- [프론트엔드 개요](../00-overview.md)
- [Envoy 설정](./envoy.md)
- [PM2 설정](./pm2.md)
- [운영 가이드](../../04-operations/)

---

**태그**: `#배포` `#PM2` `#Next.js` `#프로덕션`

**카테고리**: 문서 > 프론트엔드 > 배포 > 배포 전략

**마지막 업데이트**: 2024-12-14








