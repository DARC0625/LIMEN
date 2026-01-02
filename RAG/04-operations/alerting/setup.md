# 알림 시스템 설정 가이드

> [← 홈](../../00-home.md) | [운영](../operations-guide.md) | [알림](./) | [설정](./setup.md)

## ⚠️ 중요 공지

**이 알림 시스템은 향후 통합 모니터링 서비스로 마이그레이션될 예정입니다.**

현재는 LIMEN 내부에 구현되어 있으나, 여러 서비스를 통합 관리하는 별도의 모니터링 관제 서비스가 개발되면 해당 서비스로 이동할 예정입니다.

## 개요

LIMEN의 알림 시스템은 에러, 리소스 임계값 초과, VM 상태 변화 등을 실시간으로 알려줍니다.

**현재 상태**: LIMEN 내부 구현 (임시)  
**향후 계획**: 통합 모니터링 서비스로 이동

---

## 기능

### 알림 채널

1. **로그 채널** (항상 활성화)
   - 모든 알림을 로그로 기록
   - journald 또는 로그 파일에 저장

2. **웹훅 채널** (선택)
   - Slack, Discord 등으로 알림 전송
   - HTTP POST 요청으로 JSON 페이로드 전송

3. **이메일 채널** (선택)
   - SMTP를 통한 이메일 알림
   - 여러 수신자 지원

### 알림 규칙

1. **에러 알림**
   - 5xx 서버 에러 발생 시
   - 패닉 발생 시
   - 데이터베이스 연결 실패 시

2. **리소스 임계값 알림**
   - 디스크 사용량 85% 초과 시 경고
   - 디스크 사용량 90% 초과 시 에러
   - 디스크 사용량 95% 초과 시 크리티컬
   - 메모리 사용량 90% 초과 시 경고
   - 메모리 사용량 95% 초과 시 크리티컬

3. **VM 관련 알림** (향후 추가)
   - VM 생성 실패
   - VM 시작 실패
   - VM 리소스 부족

---

## 설정

### 환경 변수

`.env` 파일 또는 환경 변수로 설정:

```bash
# 알림 활성화
ALERTING_ENABLED=true

# 웹훅 설정 (Slack, Discord 등)
# 예시: 실제 웹훅 URL로 교체 필요
# ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# 이메일 설정
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_SMTP_HOST=smtp.gmail.com
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_SMTP_USER=your-email@gmail.com
ALERT_EMAIL_SMTP_PASS=your-app-password
ALERT_EMAIL_FROM=limen@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com,ops@yourdomain.com

# 중복 알림 방지 시간 (분)
ALERT_DEDUP_WINDOW=5
```

### systemd 서비스 설정

`/etc/systemd/system/limen.service`:

```ini
[Service]
Environment=ALERTING_ENABLED=true
# 예시: 실제 웹훅 URL로 교체 필요
Environment=ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Environment=ALERT_DEDUP_WINDOW=5
```

---

## 웹훅 설정 예시

### Slack

1. Slack 워크스페이스에서 Incoming Webhook 앱 추가
2. 웹훅 URL 복사
3. 환경 변수에 설정:

```bash
# 예시: 실제 웹훅 URL로 교체 필요
# ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Slack 포맷팅 (선택):**

Slack의 경우 더 나은 포맷팅을 위해 커스텀 포맷터를 사용할 수 있습니다 (향후 추가).

### Discord

1. Discord 서버 설정 → 연동 → 웹후크
2. 새 웹후크 생성
3. 웹후크 URL 복사
4. 환경 변수에 설정:

```bash
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

---

## 이메일 설정 예시

### Gmail

```bash
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_SMTP_HOST=smtp.gmail.com
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_SMTP_USER=your-email@gmail.com
ALERT_EMAIL_SMTP_PASS=your-app-password  # Gmail 앱 비밀번호 사용
ALERT_EMAIL_FROM=limen@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com
```

**Gmail 앱 비밀번호 생성:**
1. Google 계정 설정 → 보안
2. 2단계 인증 활성화
3. 앱 비밀번호 생성
4. 생성된 비밀번호를 `ALERT_EMAIL_SMTP_PASS`에 설정

### 기타 SMTP 서버

```bash
ALERT_EMAIL_SMTP_HOST=smtp.yourdomain.com
ALERT_EMAIL_SMTP_PORT=587  # 또는 465 (SSL), 25
ALERT_EMAIL_SMTP_USER=your-username
ALERT_EMAIL_SMTP_PASS=your-password
```

---

## 중복 알림 방지

알림 시스템은 중복 알림을 방지합니다:

- **기본 시간 창**: 5분
- **동일한 알림** (제목 + 컴포넌트 기준)은 시간 창 내에서 한 번만 전송
- 시간 창은 `ALERT_DEDUP_WINDOW` 환경 변수로 조정 가능

**예시:**
- 디스크 사용량 알림이 1분마다 발생해도 5분 동안 한 번만 전송
- 패닉 알림은 매번 전송 (중요도가 높음)

---

## 알림 심각도 레벨

- **info**: 정보성 알림
- **warning**: 경고 (리소스 사용량 높음 등)
- **error**: 에러 (서비스 영향 있음)
- **critical**: 크리티컬 (즉시 조치 필요)

---

## 알림 페이로드 형식

### 웹훅 페이로드

```json
{
  "title": "Disk Space Usage High",
  "message": "Disk usage on /data/vms is 87.50%, exceeding threshold of 85.00%",
  "severity": "warning",
  "service": "limen",
  "component": "filesystem",
  "timestamp": "2024-12-23T20:30:00Z",
  "tags": ["disk", "resource"],
  "metadata": {
    "path": "/data/vms",
    "usage_percent": 87.5,
    "threshold": 85.0,
    "total_bytes": 107374182400,
    "available_bytes": 13421772800,
    "used_bytes": 93952409600
  }
}
```

### 이메일 형식

```
Subject: [WARNING] limen - Disk Space Usage High

LIMEN Alert Notification

Title: Disk Space Usage High
Severity: warning
Service: limen
Component: filesystem
Time: 2024-12-23 20:30:00

Message:
Disk usage on /data/vms is 87.50%, exceeding threshold of 85.00%

Tags: disk, resource

Metadata:
  path: /data/vms
  usage_percent: 87.5
  threshold: 85.0
  total_bytes: 107374182400
  available_bytes: 13421772800
  used_bytes: 93952409600
```

---

## 모니터링 규칙 커스터마이징

현재 기본 규칙:

- **디스크 공간**: VM 디렉토리 기준, 85% 경고
- **메모리**: 시스템 전체 기준, 90% 경고

향후 추가 예정:
- CPU 사용률 모니터링
- 네트워크 대역폭 모니터링
- 데이터베이스 연결 풀 모니터링
- VM별 리소스 모니터링

---

## 테스트

### 알림 테스트 (수동)

로그 채널은 항상 활성화되어 있으므로, 서버를 시작하면 알림이 로그에 기록됩니다.

웹훅/이메일 테스트를 위해서는:

1. 환경 변수 설정
2. 서버 재시작
3. 리소스 임계값을 일시적으로 초과시키거나
4. 테스트 알림 API 엔드포인트 호출 (향후 추가 예정)

### 로그 확인

```bash
# 알림 로그 확인
sudo journalctl -u limen.service | grep ALERT

# 특정 심각도만 확인
sudo journalctl -u limen.service | grep "severity=critical"
```

---

## 문제 해결

### 알림이 전송되지 않음

1. **환경 변수 확인**
   ```bash
   sudo systemctl show limen.service | grep ALERT
   ```

2. **로그 확인**
   ```bash
   sudo journalctl -u limen.service | grep -i alert
   ```

3. **웹훅 URL 확인**
   - URL이 올바른지 확인
   - 네트워크 연결 확인

4. **이메일 설정 확인**
   - SMTP 서버 접근 가능한지 확인
   - 인증 정보 확인
   - 방화벽 규칙 확인

### 중복 알림 발생

- `ALERT_DEDUP_WINDOW` 값을 늘려보세요
- 또는 알림 규칙의 체크 간격을 조정

### 알림이 너무 많음

- 임계값을 높게 설정
- 중복 방지 시간 창 늘리기
- 중요하지 않은 알림 필터링 (향후 추가)

---

## 향후 개선 사항

- [ ] Slack/Discord 포맷팅 개선
- [ ] 알림 템플릿 커스터마이징
- [ ] 알림 규칙 동적 설정 (API)
- [ ] 알림 히스토리 저장
- [ ] 알림 대시보드
- [ ] 알림 그룹핑 (같은 유형의 알림 묶기)
- [ ] 알림 에스컬레이션 (반복 알림 시 상위 담당자에게)

---

## 관련 문서

- [운영 가이드](../operations-guide.md)
- [모니터링 전략](../monitoring/strategy.md)
- [로드맵](../../01-architecture/roadmap.md)

---

**태그**: `#운영` `#알림` `#설정` `#웹훅` `#이메일` `#임시-구현`

**카테고리**: 운영 > 알림 > 설정

**마지막 업데이트**: 2024-12-23

**상태**: 임시 구현 (향후 통합 모니터링 서비스로 마이그레이션 예정)
