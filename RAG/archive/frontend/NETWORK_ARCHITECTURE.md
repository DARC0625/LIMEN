# 네트워크 아키텍처 및 프록시 라우팅

## 서버 구성

### 물리적 서버 분리
- **프론트엔드 서버**: `10.0.0.10` (현재 서버)
  - Next.js 프론트엔드 (포트 9444)
  - darc.kr 웹사이트 (포트 9445)
  - Envoy 프록시 (포트 80, 443)
  - Next.js Middleware (런타임 프록시)

- **백엔드 서버**: `10.0.0.100` (별도 서버)
  - LIMEN 백엔드 API (포트 18443)
  - Agent 서비스 (포트 9000)

### 내부망 연결
- 프론트엔드 서버와 백엔드 서버는 내부망(10.0.0.0/24)으로 연결됨
- 외부 클라이언트는 Envoy 프록시를 통해 접근

## 프록시 라우팅 흐름

### 1. 외부 클라이언트 → Envoy 프록시
```
클라이언트 (인터넷)
  ↓ HTTPS/HTTP
Envoy 프록시 (10.0.0.10:80/443)
```

### 2. Envoy → 프론트엔드/백엔드 라우팅

#### 프론트엔드 요청 (같은 서버)
```
Envoy (10.0.0.10)
  ↓ localhost/127.0.0.1
Next.js 프론트엔드 (127.0.0.1:9444)
darc.kr (127.0.0.1:9445)
```

#### 백엔드 API 요청 (다른 서버)
```
Envoy (10.0.0.10)
  ↓ 내부망 (10.0.0.100)
백엔드 서버 (10.0.0.100:18443)
Agent 서버 (10.0.0.100:9000)
```

### 3. Next.js Middleware → 백엔드 (런타임 프록시)
```
클라이언트 요청
  ↓
Next.js Middleware (10.0.0.10)
  ↓ 내부망 (10.0.0.100)
백엔드 서버 (10.0.0.100:18443)
```

## IP 주소 설정 규칙

### ✅ 올바른 설정

#### Envoy 설정 (`envoy.yaml`)
```yaml
# 프론트엔드 클러스터 (같은 서버)
limen_cluster:
  address: 127.0.0.1  # ✅ localhost 사용
  port: 9444

darc_cluster:
  address: 127.0.0.1  # ✅ localhost 사용
  port: 9445

# 백엔드 클러스터 (다른 서버)
backend_cluster:
  address: 10.0.0.100  # ✅ 내부망 IP 사용
  port: 18443

agent_cluster:
  address: 10.0.0.100  # ✅ 내부망 IP 사용
  port: 9000
```

#### Next.js Middleware (`middleware.ts`)
```typescript
// 백엔드 호스트 (다른 서버)
const backendHost = '10.0.0.100';  // ✅ 내부망 IP 사용
const backendPort = '18443';

// Agent 호스트 (다른 서버)
const agentHost = '10.0.0.100';  // ✅ 내부망 IP 사용
const agentPort = '9000';
```

#### 프론트엔드 API 클라이언트
```typescript
// 상대 경로 사용 (Next.js Middleware가 프록시)
const apiUrl = '/api';  // ✅ 상대 경로 사용
```

### ❌ 잘못된 설정 (피해야 할 것)

1. **백엔드 클러스터에 localhost 사용**
   ```yaml
   backend_cluster:
     address: 127.0.0.1  # ❌ 백엔드는 다른 서버
   ```

2. **프론트엔드 클러스터에 내부망 IP 사용**
   ```yaml
   limen_cluster:
     address: 10.0.0.10  # ❌ 같은 서버이므로 localhost 사용
   ```

3. **절대 URL에 localhost 사용**
   ```typescript
   const apiUrl = 'http://localhost:18443/api';  # ❌
   const apiUrl = 'http://127.0.0.1:18443/api';  # ❌
   ```

## 라우팅 경로별 IP 선택

### `/api/*` 경로
- **Envoy**: `10.0.0.100:18443` (내부망)
- **Middleware**: `10.0.0.100:18443` (내부망)

### `/ws/*` 경로 (WebSocket)
- **Envoy**: `10.0.0.100:18443` (내부망)
- **host_rewrite**: `10.0.0.100` (명시적 설정)

### `/agent/*` 경로
- **Envoy**: `10.0.0.100:9000` (내부망)
- **Middleware**: `10.0.0.100:9000` (내부망)

### `/_next/*` 경로 (정적 파일)
- **Envoy**: `127.0.0.1:9444` (같은 서버)
- **Middleware**: Next.js가 직접 처리 (프록시 안 함)

### `/` 경로 (프론트엔드)
- **Envoy**: `127.0.0.1:9444` (같은 서버)
- **Middleware**: Next.js가 직접 처리

## 환경 변수 설정

### 프론트엔드 서버 (10.0.0.10)
```bash
# .env.production
BACKEND_HOST=10.0.0.100
BACKEND_PORT=18443
AGENT_HOST=10.0.0.100
AGENT_PORT=9000
```

### Envoy 설정
- 환경 변수 불필요 (하드코딩된 IP 사용)
- 프론트엔드 클러스터: `127.0.0.1`
- 백엔드 클러스터: `10.0.0.100`

## 확인 사항

### 1. Envoy가 올바른 IP로 연결하는지 확인
```bash
# Envoy 로그 확인
sudo journalctl -u envoy -f | grep "backend_cluster"
```

### 2. Middleware가 올바른 IP로 연결하는지 확인
```bash
# Next.js 로그 확인
pm2 logs limen-frontend | grep "Proxy"
```

### 3. 네트워크 연결 테스트
```bash
# 프론트엔드 서버에서 백엔드 연결 테스트
curl -v http://10.0.0.100:18443/api/health

# 프론트엔드 서버에서 Agent 연결 테스트
curl -v http://10.0.0.100:9000/health
```

## 문제 해결

### "Connection refused" 에러
- 백엔드 서버가 실행 중인지 확인
- 방화벽이 내부망 통신을 허용하는지 확인
- IP 주소가 올바른지 확인

### "Host not found" 에러
- DNS 해석 문제 (내부망에서는 IP 직접 사용 권장)
- `/etc/hosts` 파일 확인

### "Timeout" 에러
- 네트워크 연결 확인
- 백엔드 서버 응답 시간 확인
- Envoy/Middleware 타임아웃 설정 확인




