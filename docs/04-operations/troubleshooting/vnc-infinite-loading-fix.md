# VNC 무한 로딩 문제 해결

## 문제 증상

VM 콘솔(VNC) 연결 시 "Status: Connecting..." 상태에서 무한 로딩

## 원인 분석

1. **상태 메시지 부재**: WebSocket 연결 후 진행 상황을 클라이언트에 알리지 않음
2. **에러 메시지 형식 불일치**: 에러 메시지가 일관되지 않은 형식으로 전송
3. **타임아웃 부재**: WebSocket 메시지 전송 시 타임아웃이 없어 실패 시 무한 대기
4. **진행 상황 미표시**: 각 단계(VM 상태 확인, VNC 포트 가져오기, VNC 서버 연결)의 진행 상황을 알 수 없음

## 해결 방법

### 1. 초기 연결 상태 메시지 추가

WebSocket 연결 직후 초기 상태 메시지를 전송하여 연결이 성공했음을 알림:

```go
// Send initial connection status
ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
if err := ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"status","message":"Connected, checking VM status..."}`)); err != nil {
    logger.Log.Warn("Failed to send initial status", zap.Error(err))
    return
}
ws.SetWriteDeadline(time.Time{}) // Clear deadline
```

### 2. 각 단계별 상태 메시지 추가

VM 상태 확인, VNC 포트 가져오기, VNC 서버 연결 등 각 단계마다 상태 메시지 전송:

```go
// Send status update
ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"status","message":"Getting VNC port..."}`))
ws.SetWriteDeadline(time.Time{})

// ... VNC port retrieval ...

ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"status","message":"Connecting to VNC server on port %s..."}`, vncPort)))
ws.SetWriteDeadline(time.Time{})
```

### 3. 에러 메시지 형식 통일

모든 에러 메시지를 `{"type":"error",...}` 형식으로 통일:

```go
ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"error","error":"Failed to get VNC port","code":"VNC_PORT_ERROR","details":"%v","message":"VNC port not available yet. Please wait a moment and try again."}`, err)))
ws.SetWriteDeadline(time.Time{})
```

### 4. WriteDeadline 설정

모든 WebSocket 메시지 전송 시 WriteDeadline을 설정하여 타임아웃 방지:

```go
ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
ws.WriteMessage(websocket.TextMessage, message)
ws.SetWriteDeadline(time.Time{}) // Clear deadline after successful send
```

## 변경된 파일

- `backend/internal/handlers/api.go`
  - `HandleVNC()` 함수 전체 개선
  - 초기 연결 상태 메시지 추가
  - 각 단계별 상태 메시지 추가
  - 에러 메시지 형식 통일
  - WriteDeadline 설정 추가

## 메시지 형식

### 상태 메시지
```json
{
  "type": "status",
  "message": "Connected, checking VM status..."
}
```

### 에러 메시지
```json
{
  "type": "error",
  "error": "Failed to get VNC port",
  "code": "VNC_PORT_ERROR",
  "details": "...",
  "message": "VNC port not available yet. Please wait a moment and try again."
}
```

## 적용 방법

1. **백엔드 재시작**:
   ```bash
   cd /home/darc0/projects/LIMEN/backend
   go build ./cmd/server
   # 서버 재시작
   ```

2. **프론트엔드 업데이트** (선택사항):
   - 상태 메시지를 받아서 UI에 표시
   - 에러 메시지를 받아서 사용자에게 알림

## 예상 결과

- WebSocket 연결 후 즉시 상태 메시지 수신
- 각 단계의 진행 상황을 실시간으로 확인 가능
- 에러 발생 시 명확한 에러 메시지 수신
- 무한 로딩 없이 연결 성공 또는 명확한 에러 표시

## 테스트 방법

1. VM 생성
2. 콘솔 열기
3. 브라우저 개발자 도구에서 WebSocket 메시지 확인:
   - `{"type":"status","message":"Connected, checking VM status..."}`
   - `{"type":"status","message":"Getting VNC port..."}`
   - `{"type":"status","message":"Connecting to VNC server on port 5900..."}`
   - `{"type":"status","message":"VNC connection established, starting proxy..."}`
   - 또는 에러 메시지

## 문제가 지속되는 경우

1. 백엔드 로그 확인:
   ```bash
   tail -f /var/log/limen/*.log | grep -i "vnc"
   ```

2. WebSocket 연결 확인:
   - 브라우저 개발자 도구 → Network → WS 탭
   - WebSocket 메시지 확인

3. VNC 포트 확인:
   ```bash
   virsh vncdisplay <vm-name>
   ```

4. VNC 서버 연결 테스트:
   ```bash
   telnet localhost 5900
   ```





