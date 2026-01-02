# PWA 기능

> **LIMEN 프론트엔드 Progressive Web App 기능**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [성능](./) > PWA

---

## 📋 목차

1. [PWA 개요](#pwa-개요)
2. [Service Worker](#service-worker)
3. [매니페스트](#매니페스트)
4. [오프라인 지원](#오프라인-지원)
5. [설치 기능](#설치-기능)

---

## PWA 개요

LIMEN 프론트엔드는 PWA (Progressive Web App) 기능을 지원합니다.

### 주요 기능

- ✅ 오프라인 지원
- ✅ 홈 화면에 추가 가능
- ✅ 네이티브 앱처럼 실행
- ✅ 빠른 로딩 (캐싱)

---

## Service Worker

### 위치

`public/sw.js`

### 캐싱 전략

- **네트워크 우선**: API 요청
- **캐시 우선**: 정적 리소스 (이미지, 폰트, CSS, JS)

### 등록

```typescript
// components/PWARegister.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## 매니페스트

### 위치

`public/manifest.json`

### 주요 설정

```json
{
  "name": "LIMEN - VM Management Platform",
  "short_name": "LIMEN",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

---

## 오프라인 지원

### 오프라인 페이지

`app/offline/page.tsx`에서 오프라인 상태를 안내합니다.

### 캐싱된 리소스

Service Worker가 다음을 캐싱:
- 정적 페이지
- 이미지 및 폰트
- CSS 및 JavaScript

---

## 설치 기능

### 설치 프롬프트

`components/PWARegister.tsx`가 설치 가능 시 자동으로 버튼을 표시합니다.

### 설치 방법

1. 브라우저에서 "앱 설치" 버튼 클릭
2. 또는 브라우저 메뉴에서 "홈 화면에 추가"

---

## 관련 문서

- [성능 최적화](./optimization.md)
- [캐싱 전략](./caching.md)
- [배포 가이드](../06-deployment/)

---

**태그**: `#PWA` `#오프라인` `#ServiceWorker` `#성능`

**카테고리**: 문서 > 프론트엔드 > 성능 > PWA

**마지막 업데이트**: 2024-12-14








