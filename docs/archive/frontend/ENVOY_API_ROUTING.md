# Envoy API 라우팅 설정

## 현재 구조

### limen.kr (LIMEN 서비스)
- **API 경로**: `/api/` → `limen_cluster` (Next.js middleware를 통해 백엔드로)
- **WebSocket 경로**: `/ws/` → `backend_cluster` (백엔드로 직접)
- **Agent 경로**: `/agent/` → `agent_cluster` (Agent로 직접)
- **정적 파일**: `/_next/` → `limen_cluster` (Next.js)
- **기타**: `/` → `limen_cluster` (Next.js)

### darc.kr (정적 웹사이트)
- **정적 파일**: `/_next/` → `darc_cluster` (DARC Next.js)
- **기타**: `/` → `darc_cluster` (DARC Next.js)
- **API 없음**: darc.kr은 백엔드가 없고 정적 페이지만 제공

## 쿠키 전달 흐름

### limen.kr API 요청
```
브라우저
  ↓ (쿠키 포함)
Envoy (포트 443)
  ↓ (/api/ 경로)
limen_cluster (Next.js, 포트 9444)
  ↓ (Next.js middleware가 쿠키 추출 및 전달)
백엔드 (10.0.0.100:18443)
  ↓ (Set-Cookie 헤더)
Next.js middleware
  ↓ (Set-Cookie 헤더 전달)
Envoy
  ↓ (Set-Cookie 헤더 전달)
브라우저 (쿠키 저장)
```

## 중요 사항

1. **limen.kr만 API 사용**: darc.kr은 정적 페이지만 제공하므로 API 경로가 없음
2. **Next.js middleware 필수**: limen.kr의 모든 `/api/` 요청은 Next.js middleware를 거쳐야 쿠키가 제대로 전달됨
3. **WebSocket은 직접 연결**: `/ws/` 경로는 백엔드로 직접 연결 (Next.js middleware 거치지 않음)




