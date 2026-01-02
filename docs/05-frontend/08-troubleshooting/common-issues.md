# 일반적인 문제 해결

> **LIMEN 프론트엔드 일반적인 문제 및 해결 방법**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [문제 해결](./) > 일반적인 문제

---

## 📋 목차

1. [빌드 문제](#빌드-문제)
2. [런타임 오류](#런타임-오류)
3. [연결 문제](#연결-문제)
4. [성능 문제](#성능-문제)

---

## 빌드 문제

### 문제: 빌드 캐시 오류

**증상:**
```
Failed to load chunk server/chunks/ssr/[turbopack]_runtime.js
```

**해결 방법:**
```bash
# .next 폴더 삭제 후 재빌드
cd /home/darc/LIMEN/frontend
rm -rf .next
npm run build
```

### 문제: TypeScript 오류

**증상:**
```
Type error: Cannot find name 'XXX'
```

**해결 방법:**
1. import 문 확인
2. 타입 정의 확인
3. `tsconfig.json` 설정 확인

---

## 런타임 오류

### 문제: 401 Unauthorized

**증상:**
- API 호출 시 401 에러
- 자동 로그아웃

**해결 방법:**
1. 토큰 만료 확인
2. 토큰 재발급 (재로그인)
3. 백엔드 인증 서버 확인

### 문제: WebSocket 연결 실패

**증상:**
- 실시간 업데이트 작동 안 함
- WebSocket 연결 오류

**해결 방법:**
1. 네트워크 연결 확인
2. 백엔드 WebSocket 서버 확인
3. 토큰 유효성 확인

---

## 연결 문제

### 문제: CORS 오류

**증상:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**해결 방법:**
1. 백엔드 CORS 설정 확인
2. `ALLOWED_ORIGINS` 환경 변수 확인
3. 프록시 설정 확인

---

## 성능 문제

### 문제: 느린 초기 로딩

**해결 방법:**
1. 번들 크기 확인 (`npm run build:analyze`)
2. 코드 스플리팅 확인
3. 네트워크 속도 확인

---

## 관련 문서

- [프론트엔드 개요](../00-overview.md)
- [성능 최적화](../07-performance/optimization.md)
- [배포 가이드](../06-deployment/)

---

**태그**: `#문제해결` `#트러블슈팅` `#오류`

**카테고리**: 문서 > 프론트엔드 > 문제 해결 > 일반적인 문제

**마지막 업데이트**: 2024-12-14








