# 타임아웃 설정 표준표

이 문서는 LIMEN 프론트엔드 및 Envoy 설정의 모든 타임아웃 값을 정리합니다.

## 목차
1. [Envoy 타임아웃 설정](#envoy-타임아웃-설정)
2. [프론트엔드 API 타임아웃](#프론트엔드-api-타임아웃)
3. [WebSocket 타임아웃](#websocket-타임아웃)
4. [테스트 타임아웃](#테스트-타임아웃)
5. [동기화 가이드](#동기화-가이드)

---

## Envoy 타임아웃 설정

### HTTP 요청 타임아웃

| 경로 | 타임아웃 | 설정 파일 | 설명 |
|------|---------|----------|------|
| `/_next/` | 60초 | `envoy.yaml:61` | Next.js 정적 파일 프록시 |
| `/api/` | 60초 | `envoy.yaml:98` | API 프록시 (Next.js middleware 경유) |
| `/agent/` | 60초 | `envoy.yaml:111` | Agent 프록시 |
| `/metrics` | 60초 | `envoy.yaml:123` | 메트릭 엔드포인트 |
| `/health` | 60초 | `envoy.yaml:129` | 헬스체크 엔드포인트 |
| 기본 라우트 | 60초 | `envoy.yaml:142,152` | 기타 모든 요청 |

### WebSocket 타임아웃

| 경로 | Idle Timeout | Max Stream Duration | 설정 파일 | 설명 |
|------|-------------|---------------------|----------|------|
| `/vnc/` | 3600초 (1시간) | 86400초 (24시간) | `envoy.yaml:73-75` | VNC WebSocket 연결 |
| `/ws/` | 3600초 (1시간) | 86400초 (24시간) | `envoy.yaml:85-87` | 일반 WebSocket 연결 |

**설정 근거:**
- **Idle Timeout (1시간)**: VNC 세션이 1시간 동안 비활성 상태면 연결 종료
- **Max Stream Duration (24시간)**: 최대 연결 지속 시간 (장시간 세션 지원)

### Upstream 연결 타임아웃

| 클러스터 | Connect Timeout | 설정 파일 | 설명 |
|----------|----------------|----------|------|
| `limen_cluster` | 5초 | `envoy.yaml:360` | Next.js 프론트엔드 연결 |
| `backend_cluster` | 5초 | `envoy.yaml:385` | 백엔드 API 연결 |
| `agent_cluster` | 5초 | `envoy.yaml:422` | Agent 서비스 연결 |
| `metrics_cluster` | 5초 | `envoy.yaml:456` | 메트릭 서비스 연결 |

### Circuit Breaker 타임아웃

| 클러스터 | Timeout | 설정 파일 | 설명 |
|----------|---------|----------|------|
| `limen_cluster` | 1초 | `envoy.yaml:373` | Circuit breaker timeout |
| `backend_cluster` | 1초 | `envoy.yaml:398` | Circuit breaker timeout |
| `agent_cluster` | 1초 | `envoy.yaml:435` | Circuit breaker timeout |
| `metrics_cluster` | 1초 | `envoy.yaml:469` | Circuit breaker timeout |

---

## 프론트엔드 API 타임아웃

### 기본 타임아웃

| 설정 | 값 | 파일 | 설명 |
|------|-----|------|------|
| `API_CONSTANTS.DEFAULT_TIMEOUT` | 30000ms (30초) | `lib/constants/index.ts:39` | 기본 API 요청 타임아웃 |
| `API_CONSTANTS.RETRY_DELAY` | 1000ms (1초) | `lib/constants/index.ts:43` | 재시도 지연 시간 |
| `API_CONSTANTS.MAX_RETRIES` | 3회 | `lib/constants/index.ts:42` | 최대 재시도 횟수 |

### 특수 엔드포인트 타임아웃

| 엔드포인트 | 타임아웃 | 파일 | 설명 |
|-----------|---------|------|------|
| VM Console (`/api/vms/{uuid}/console`) | 60000ms (60초) | `lib/api/vm.ts:474` | VNC 콘솔 엔드포인트 (기본값보다 긴 타임아웃) |

---

## WebSocket 타임아웃

### noVNC 클라이언트 설정

| 설정 | 값 | 파일 | 설명 |
|------|-----|------|------|
| noVNC 기본 타임아웃 | 브라우저 기본 | `components/VNCViewer.tsx` | 브라우저 WebSocket API 사용 |

**참고:** noVNC는 브라우저의 네이티브 WebSocket API를 사용하므로, 타임아웃은 Envoy 설정에 따라 결정됩니다.

---

## 테스트 타임아웃

### E2E 테스트

| 설정 | 값 | 파일 | 설명 |
|------|-----|------|------|
| 전체 테스트 타임아웃 | 60000ms (60초) | `e2e/vm-console-e2e.spec.ts:8` | Playwright 테스트 전체 타임아웃 |
| VM 생성 대기 | 30000ms (30초) | `e2e/vm-console-e2e.spec.ts` | VM 생성 완료 대기 |
| WebSocket 대기 | 10000ms (10초) | `e2e/vm-console-e2e.spec.ts` | WebSocket 연결 대기 |
| 폼 열림 대기 | 5000ms (5초) | `e2e/vm-console-e2e.spec.ts` | VM 생성 폼 표시 대기 |

### 단위 테스트

| 설정 | 값 | 파일 | 설명 |
|------|-----|------|------|
| Jest 기본 타임아웃 | 5000ms (5초) | `jest.config.js` | Jest 테스트 기본 타임아웃 |

---

## 동기화 가이드

### 타임아웃 값 변경 시 체크리스트

1. **Envoy 설정 변경** (`envoy.yaml`)
   - 해당 경로의 `timeout` 값 수정
   - WebSocket의 경우 `max_stream_duration`도 함께 수정
   - Envoy 재시작 필요: `pm2 restart envoy`

2. **프론트엔드 상수 업데이트** (`lib/api/constants.ts`)
   - `DEFAULT_TIMEOUT` 값이 Envoy의 HTTP 타임아웃과 일치하는지 확인
   - 특수 엔드포인트 타임아웃도 함께 검토

3. **테스트 타임아웃 조정**
   - E2E 테스트 타임아웃이 실제 타임아웃보다 충분히 큰지 확인
   - 일반적으로 테스트 타임아웃 = 실제 타임아웃 + 여유 시간(10-20초)

4. **문서 업데이트**
   - 이 문서(`timeouts.md`)에 변경 사항 반영

### 권장 사항

1. **일관성 유지**
   - HTTP API 타임아웃: 60초 (표준)
   - WebSocket Idle: 3600초 (1시간)
   - WebSocket Max Duration: 86400초 (24시간)

2. **타임아웃 값 선택 기준**
   - **짧은 타임아웃 (5-10초)**: 헬스체크, 메트릭
   - **중간 타임아웃 (60초)**: 일반 API 요청
   - **긴 타임아웃 (3600초+)**: WebSocket, 스트리밍

3. **에러 처리**
   - 타임아웃 발생 시 사용자에게 명확한 메시지 표시
   - 재시도 로직 구현 (최대 3회)

---

## 현재 설정 요약

### HTTP 요청
- **Envoy 기본**: 60초
- **프론트엔드 기본**: 30초 (API_CONSTANTS.DEFAULT_TIMEOUT)
- **WebSocket Idle**: 3600초 (1시간)
- **WebSocket Max Duration**: 86400초 (24시간)

### 연결
- **Upstream Connect**: 5초
- **Circuit Breaker**: 1초

### 테스트
- **E2E 전체**: 60초
- **VM 생성**: 30초
- **WebSocket 연결**: 10초

---

## 업데이트 이력
- 2026-01-10: 초기 작성
