# 로깅 시스템 가이드

> [← 운영](../operations-guide.md) | [로깅](./logging-guide.md)

## 개요

LIMEN 시스템은 **구조화된 로깅(Structured Logging)**을 사용하여 모든 이벤트를 JSON 형식으로 기록합니다. 로그 로테이션, 분석, 검색 기능을 제공합니다.

> **로깅 원칙**:  
> - 구조화된 로깅 (JSON 형식)
> - 로그 레벨 관리
> - 자동 로그 로테이션
> - 로그 분석 및 집계
> - 에러 추적

---

## 로그 레벨

### 지원 레벨

- **DEBUG**: 상세한 디버깅 정보
- **INFO**: 일반 정보성 메시지
- **WARN**: 경고 메시지
- **ERROR**: 에러 메시지 (스택 트레이스 포함)

### 레벨 설정

환경 변수로 설정:

```bash
export LOG_LEVEL=info  # debug, info, warn, error
```

또는 `.env` 파일:

```ini
LOG_LEVEL=info
```

---

## 로그 로테이션

### 파일 로테이션 활성화

로그 디렉토리를 설정하면 자동으로 파일 로테이션이 활성화됩니다:

```bash
export LOG_DIR=/var/log/limen
```

### 로테이션 설정

**기본 설정**:
- 최대 파일 크기: **100MB**
- 백업 파일 수: **10개**
- 보관 기간: **30일**
- 압축: **활성화**

### 로그 파일 위치

```
/var/log/limen/limen.log          # 현재 로그 파일
/var/log/limen/limen.log.1        # 첫 번째 백업
/var/log/limen/limen.log.2.gz    # 두 번째 백업 (압축)
...
```

---

## 로그 형식

### JSON 형식

모든 로그는 JSON 형식으로 기록됩니다:

```json
{
  "timestamp": "2024-12-23T12:00:00Z",
  "level": "info",
  "message": "User logged in",
  "caller": "handlers/auth.go:42",
  "user_id": 1,
  "username": "admin",
  "ip": "192.168.1.100"
}
```

### 로그 필드

- **timestamp**: ISO8601 형식 타임스탬프
- **level**: 로그 레벨 (debug, info, warn, error)
- **message**: 로그 메시지
- **caller**: 호출 위치 (파일:라인)
- **fields**: 추가 컨텍스트 정보

---

## 로그 분석

### 통계 조회

```bash
# 최근 24시간 통계
curl http://localhost:18443/api/logs/stats

# 최근 7일 통계
curl http://localhost:18443/api/logs/stats?hours=168
```

**응답 예시**:
```json
{
  "total_entries": 15234,
  "error_count": 12,
  "warning_count": 45,
  "info_count": 15100,
  "debug_count": 77,
  "level_distribution": {
    "error": 12,
    "warn": 45,
    "info": 15100,
    "debug": 77
  },
  "top_errors": [
    {
      "message": "Database connection failed",
      "count": 5,
      "first_seen": "2024-12-23T10:00:00Z",
      "last_seen": "2024-12-23T11:30:00Z"
    }
  ],
  "time_range": {
    "start": "2024-12-22T12:00:00Z",
    "end": "2024-12-23T12:00:00Z"
  }
}
```

### 로그 검색

```bash
# 에러 검색
curl "http://localhost:18443/api/logs/search?query=error&hours=24&limit=50"

# 특정 사용자 검색
curl "http://localhost:18443/api/logs/search?query=admin&hours=7&limit=100"
```

**파라미터**:
- `query`: 검색어 (필수)
- `hours`: 검색 기간 (기본: 24시간)
- `limit`: 최대 결과 수 (기본: 100, 최대: 1000)

---

## 로그 관리

### 로그 정리

오래된 로그 파일을 자동으로 정리:

```go
// 30일 이상 된 로그 파일 삭제
logger.CleanupOldLogs("/var/log/limen", 30)
```

### 수동 정리

```bash
# 30일 이상 된 로그 파일 삭제
find /var/log/limen -name "*.log*" -mtime +30 -delete

# 압축된 로그 파일만 삭제
find /var/log/limen -name "*.log.gz" -mtime +30 -delete
```

---

## 로그 모니터링

### 실시간 로그 확인

```bash
# 현재 로그 파일 모니터링
tail -f /var/log/limen/limen.log

# JSON 형식으로 보기
tail -f /var/log/limen/limen.log | jq

# 에러만 필터링
tail -f /var/log/limen/limen.log | jq 'select(.level == "error")'
```

### journald 통합

systemd 서비스로 실행 시 journald에도 로그가 기록됩니다:

```bash
# journald 로그 확인
sudo journalctl -u limen.service -f

# 최근 에러만 확인
sudo journalctl -u limen.service -p err --since "1 hour ago"
```

---

## 로그 분석 도구

### jq를 사용한 분석

```bash
# 에러 통계
cat /var/log/limen/limen.log | jq 'select(.level == "error")' | jq -s 'length'

# 사용자별 로그인 횟수
cat /var/log/limen/limen.log | jq 'select(.message == "User logged in")' | jq -s 'group_by(.username) | map({username: .[0].username, count: length})'

# 시간대별 에러 분포
cat /var/log/limen/limen.log | jq 'select(.level == "error")' | jq -s 'group_by(.timestamp[:13]) | map({time: .[0].timestamp[:13], count: length})'
```

### grep을 사용한 검색

```bash
# 특정 메시지 검색
grep "User logged in" /var/log/limen/limen.log

# 에러만 검색
grep '"level":"error"' /var/log/limen/limen.log

# 특정 IP 검색
grep "192.168.1.100" /var/log/limen/limen.log
```

---

## 로그 보안

### 민감 정보 제거

로그에는 다음 정보가 제거됩니다:
- 비밀번호 (항상 `[REDACTED]`)
- JWT 토큰 (일부만 표시)
- API 키

### 로그 접근 제어

프로덕션 환경에서는 로그 파일에 대한 접근을 제한해야 합니다:

```bash
# 로그 디렉토리 권한 설정
sudo chmod 750 /var/log/limen
sudo chown limen:limen /var/log/limen
```

---

## 로그 백업

### 자동 백업

백업 스크립트에 로그 백업 포함:

```bash
# 로그 백업 (config.sh에 포함)
./scripts/backup/config.sh
```

### 수동 백업

```bash
# 로그 디렉토리 백업
tar -czf limen-logs-$(date +%Y%m%d).tar.gz /var/log/limen/

# 원격 백업
rsync -avz /var/log/limen/ backup-server:/backups/limen/logs/
```

---

## 문제 해결

### 로그가 생성되지 않는 경우

1. **권한 확인**
   ```bash
   ls -la /var/log/limen/
   ```

2. **디렉토리 확인**
   ```bash
   mkdir -p /var/log/limen
   chmod 755 /var/log/limen
   ```

3. **설정 확인**
   ```bash
   echo $LOG_DIR
   ```

### 로그 파일이 너무 큰 경우

1. **로테이션 확인**
   ```bash
   ls -lh /var/log/limen/
   ```

2. **수동 로테이션**
   ```bash
   # 현재 로그 파일 이름 변경
   mv /var/log/limen/limen.log /var/log/limen/limen.log.$(date +%Y%m%d)
   # 서비스 재시작 (자동으로 새 파일 생성)
   sudo systemctl restart limen.service
   ```

---

## 관련 문서

- [운영 가이드](../operations-guide.md)
- [백업 가이드](../backup/backup-guide.md)
- [모니터링 전략](../monitoring/monitoring-strategy.md)

---

**태그**: `#로깅` `#구조화된-로깅` `#로그-로테이션` `#로그-분석`

**마지막 업데이트**: 2024-12-23





