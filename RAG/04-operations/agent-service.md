# Agent 서비스 관리 가이드

## 개요

Agent 서비스는 시스템 메트릭스(CPU, 메모리 등)를 수집하고 HTTP API로 제공하는 Rust 기반 서비스입니다.

## 서비스 정보

- **포트**: 9000
- **바인딩 주소**: 0.0.0.0 (모든 인터페이스)
- **실행 파일**: `/home/darc0/LIMEN/backend/agent/target/release/agent`
- **로그 파일**: `/home/darc0/LIMEN/backend/agent/agent.log`

## 시작 방법

### 수동 시작
```bash
cd /home/darc0/LIMEN/backend/agent
./target/release/agent > agent.log 2>&1 &
```

### systemd 서비스로 시작 (권장)
```bash
# 서비스 파일 복사
sudo cp /home/darc0/LIMEN/scripts/limen.service /etc/systemd/system/

# 서비스 활성화 및 시작
sudo systemctl enable limen.service
sudo systemctl start limen.service

# 상태 확인
sudo systemctl status limen.service
```

## 상태 확인

### 서비스 실행 확인
```bash
# 프로세스 확인
ps aux | grep 'target/release/agent' | grep -v grep

# 포트 확인
lsof -ti:9000
# 또는
netstat -tlnp | grep 9000
```

### Health Check
```bash
curl http://localhost:9000/health
```

### Metrics 확인
```bash
curl http://localhost:9000/metrics
```

**예상 응답:**
```json
{
  "cpu_usage": 0.88756484,
  "total_memory": 202362593280,
  "used_memory": 20664700928,
  "free_memory": 181697892352,
  "cpu_cores": 32
}
```

## 백엔드 프록시를 통한 접근

백엔드는 `/agent/*` 경로로 Agent 서비스를 프록시합니다:

```bash
# 백엔드를 통한 Agent 메트릭스 접근
curl http://localhost:18443/agent/metrics
```

## 중지 방법

### 수동 중지
```bash
pkill -f 'target/release/agent'
```

### systemd 서비스로 중지
```bash
sudo systemctl stop limen.service
```

## 재시작 방법

### 수동 재시작
```bash
pkill -f 'target/release/agent'
cd /home/darc0/LIMEN/backend/agent
./target/release/agent > agent.log 2>&1 &
```

### systemd 서비스로 재시작
```bash
sudo systemctl restart limen.service
```

## 로그 확인

```bash
# 실시간 로그 확인
tail -f /home/darc0/LIMEN/backend/agent/agent.log

# 최근 로그 확인
tail -50 /home/darc0/LIMEN/backend/agent/agent.log
```

## 문제 해결

### Agent 서비스가 시작되지 않는 경우

1. **포트 충돌 확인**
   ```bash
   lsof -ti:9000
   # 다른 프로세스가 사용 중이면 종료
   ```

2. **실행 파일 확인**
   ```bash
   ls -la /home/darc0/LIMEN/backend/agent/target/release/agent
   ```

3. **빌드 확인**
   ```bash
   cd /home/darc0/LIMEN/backend/agent
   cargo build --release
   ```

### Agent 서비스가 응답하지 않는 경우

1. **프로세스 확인**
   ```bash
   ps aux | grep agent | grep -v grep
   ```

2. **포트 리스닝 확인**
   ```bash
   netstat -tlnp | grep 9000
   ```

3. **로그 확인**
   ```bash
   tail -50 /home/darc0/LIMEN/backend/agent/agent.log
   ```

### 백엔드 프록시가 작동하지 않는 경우

1. **백엔드 서버 상태 확인**
   ```bash
   curl http://localhost:18443/api/health
   ```

2. **백엔드 로그 확인**
   ```bash
   tail -50 /home/darc0/LIMEN/backend/server.log | grep agent
   ```

## 자동 시작 설정

### systemd 서비스 사용 (권장)

`/home/darc0/LIMEN/scripts/limen.service` 파일이 백엔드와 Agent를 함께 관리합니다:

```bash
# 서비스 파일 복사
sudo cp /home/darc0/LIMEN/scripts/limen.service /etc/systemd/system/

# 서비스 활성화 (부팅 시 자동 시작)
sudo systemctl enable limen.service

# 서비스 시작
sudo systemctl start limen.service
```

## 관련 문서

- [백엔드 상태 점검](./backend-health-check.md)
- [시스템 아키텍처](../../RAG/01-architecture/system-design.md)










