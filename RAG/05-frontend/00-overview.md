# LIMEN 프론트엔드 개요

> **Next.js 기반 VM 관리 플랫폼 프론트엔드**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](./README.md) > 개요

---

## 📋 목차

1. [프로젝트 소개](#프로젝트-소개)
2. [기술 스택](#기술-스택)
3. [주요 기능](#주요-기능)
4. [아키텍처](#아키텍처)
5. [빠른 시작](#빠른-시작)
6. [문서 구조](#문서-구조)

---

## 프로젝트 소개

LIMEN 프론트엔드는 **Next.js 16** 기반의 현대적인 웹 애플리케이션으로, 가상 머신(VM) 관리 플랫폼의 사용자 인터페이스를 제공합니다.

### 핵심 특징

- ✅ **동적 렌더링**: 실시간 데이터 업데이트
- ✅ **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- ✅ **다크 모드**: 사용자 선호도 기반 테마
- ✅ **PWA 지원**: 오프라인 기능 및 설치 가능
- ✅ **성능 최적화**: 번들 최적화, 코드 스플리팅
- ✅ **접근성**: WCAG 2.1 준수

---

## 기술 스택

### 핵심 프레임워크

- **Next.js 16.1.1** - React 프레임워크 (App Router)
- **React 19.2.1** - UI 라이브러리
- **TypeScript 5** - 타입 안정성

### 상태 관리 및 데이터 페칭

- **TanStack Query 5.90.12** - 서버 상태 관리
- **React Context API** - 클라이언트 상태 관리

### 스타일링

- **Tailwind CSS 4** - 유틸리티 기반 CSS
- **PostCSS** - CSS 처리

### 기타 라이브러리

- **@novnc/novnc 1.6.0** - VNC 콘솔 뷰어
- **PM2** - 프로세스 관리

---

## 주요 기능

### 1. VM 관리

- VM 생성, 수정, 삭제
- VM 시작/중지/재시작
- 리소스 조정 (CPU, Memory)
- 실시간 상태 업데이트 (WebSocket)

### 2. VNC 콘솔

- 웹 기반 VNC 접속
- noVNC 라이브러리 활용
- 반응형 디스플레이

### 3. 스냅샷 관리

- VM 스냅샷 생성
- 스냅샷 복원
- 스냅샷 삭제

### 4. 사용자 관리 (Admin)

- 사용자 목록 조회
- 사용자 생성/수정/삭제
- 사용자 승인
- 역할 관리

### 5. 할당량 관리

- 시스템 할당량 조회
- 사용량 모니터링
- 할당량 업데이트 (Admin)

---

## 아키텍처

### 전체 구조

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

### 렌더링 방식

- **동적 렌더링**: `export const dynamic = 'force-dynamic'`
- **클라이언트 컴포넌트**: `'use client'` 지시어
- **코드 스플리팅**: 동적 import 활용
- **Streaming SSR**: Suspense 기반 점진적 렌더링

### 데이터 흐름

```
사용자 액션
    ↓
React Query Hook
    ↓
API Client (lib/api.ts)
    ↓
Backend API
    ↓
WebSocket (실시간 업데이트)
    ↓
React Query Cache 업데이트
    ↓
UI 자동 업데이트
```

---

## 빠른 시작

### 1. 개발 환경 설정

```bash
# 의존성 설치
cd /home/darc/LIMEN/frontend
npm install

# 개발 서버 실행
npm run dev
```

### 2. 환경 변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
NEXT_PUBLIC_API_URL=http://10.0.0.100:18443/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.100:9000
```

### 3. 빌드 및 배포

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# PM2로 실행
pm2 start npm --name limen-frontend -- start
```

---

## 문서 구조

### 주요 문서

1. **[아키텍처](./01-architecture/)** - 시스템 설계 및 구조
2. **[개발 가이드](./02-development/)** - 개발 방법 및 가이드
3. **[컴포넌트](./03-components/)** - React 컴포넌트 문서
4. **[Hooks](./04-hooks/)** - Custom React Hooks
5. **[라이브러리](./05-lib/)** - 유틸리티 및 API 클라이언트
6. **[배포](./06-deployment/)** - 배포 전략 및 가이드
7. **[성능](./07-performance/)** - 성능 최적화
8. **[문제 해결](./08-troubleshooting/)** - 트러블슈팅

---

## 관련 문서

- [프론트엔드 문서 홈](./README.md)
- [아키텍처](./01-architecture/)
- [개발 가이드](./02-development/)
- [배포 가이드](./06-deployment/)

---

**태그**: `#프론트엔드` `#Next.js` `#개요` `#시작하기`

**카테고리**: 문서 > 프론트엔드 > 개요

**마지막 업데이트**: 2024-12-14








