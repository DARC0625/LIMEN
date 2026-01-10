# LIMEN Release Readiness P0 (Backend+Agent) — Metrics/Alerts/Restore

**작성일**: 2026-01-03 23:21:00  
**담당자**: Backend AI  
**버전**: Release Readiness P0 (증거 기반 마감)

---

## B3-4: Quota 거부 메트릭 추가

**항목ID**: B3-4  
**상태**: ✅ PASS

**증거**:
- 메트릭 정의: `backend/internal/metrics/metrics.go:199-206`
  ```go
  VMQuotaDeniedTotal = promauto.NewCounterVec(
      prometheus.CounterOpts{
          Name: "vm_quota_denied_total",
          Help: "Total number of VM creation requests denied due to quota limits",
      },
      []string{"resource", "user_id"},
  )
  ```

- 메트릭 증가 로직: `backend/internal/handlers/api.go:340-345`
  ```go
  if quotaErr, ok := err.(*models.QuotaError); ok {
      metrics.VMQuotaDeniedTotal.WithLabelValues(quotaErr.Resource, fmt.Sprintf("%d", userID)).Inc()
      errors.WriteBadRequest(w, quotaErr.Error(), nil)
  }
  ```

**코드 위치**: 
- `backend/internal/metrics/metrics.go:199-206`
- `backend/internal/handlers/api.go:328-336, 340-345, 362-368`

---

## B5-2: Alerts 4종 최소 구현

**항목ID**: B5-2  
**상태**: ⚠️ PARTIAL

### (a) Prometheus Rules 파일

**상태**: ✅ PASS

**증거**:
- 알림 규칙 파일: `backend/config/prometheus-alerts.yaml`
- 4종 알림 규칙 포함:
  1. High5xxErrorRate (API 5xx 급증)
  2. HighAuthFailureRate (로그인 실패 급증)
  3. HighConsoleSessionCount (콘솔 세션 수 급증)
  4. HighHostCPUUsage / HighHostMemoryUsage / HighHostDiskUsage (호스트 자원 부족)

**코드 위치**: `backend/config/prometheus-alerts.yaml`

### (b) Alertmanager 설정/연결

**상태**: ✅ PASS

**증거**:
- Alertmanager 설정 파일: `backend/config/alertmanager.yml`
- Webhook 수신자 구성:
  - `default`: 기본 알림 수신자
  - `critical-alerts`: Critical 알림 (5xx, 호스트 자원 부족)
  - `warning-alerts`: Warning 알림 (로그인 실패, 세션 급증)
  - `info-alerts`: Info 알림 (쿼터 거부)
- 라우팅 규칙 및 억제 규칙 포함

**코드 위치**: `backend/config/alertmanager.yml`

**설정 방법**:
```bash
# Alertmanager 실행 (예시)
alertmanager --config.file=/home/darc0/LIMEN/backend/config/alertmanager.yml \
  --storage.path=/var/lib/alertmanager \
  --web.listen-address=:9093
```

### (c) 실제 발송 테스트 증거

**상태**: ⚠️ PARTIAL (테스트 스크립트 준비 완료, 실제 실행 필요)

**증거**:
- 테스트 스크립트: `backend/scripts/test-alert.sh`
- 스크립트 기능:
  - 메트릭 엔드포인트 확인
  - 호스트 메트릭 확인
  - 쿼터 거부 메트릭 확인
  - 인증 실패 메트릭 확인
  - 콘솔 세션 메트릭 확인
  - 인증 실패 트리거 테스트

**실행 방법**:
```bash
cd /home/darc0/LIMEN/backend
./scripts/test-alert.sh
```

**비고**: 
- 실제 Alertmanager와 Prometheus가 실행 중이어야 알림 발송 테스트 가능
- 현재는 테스트 스크립트와 설정 파일만 준비 완료
- 실제 환경에서 다음 순서로 테스트 필요:
  1. Prometheus가 `/api/metrics` 스크랩하도록 설정
  2. Alertmanager 실행 및 Prometheus와 연결
  3. 알림 규칙 트리거 (예: 인증 실패 10회 연속)
  4. Alertmanager UI에서 알림 확인 (http://localhost:9093)
  5. Webhook 수신 확인

**코드 위치**: 
- `backend/config/prometheus-alerts.yaml`
- `backend/config/alertmanager.yml`
- `backend/scripts/test-alert.sh`

---

## Host 리소스 알림 (Host saturation)

**항목ID**: Host 리소스 메트릭 수집  
**상태**: ✅ PASS

**증거**:
- 호스트 메트릭 수집 로직: `backend/internal/metrics/host.go`
  - CPU 사용률 수집 (30초 간격)
  - Memory 사용률 수집
  - Disk 사용률 수집
  - gopsutil/v3 라이브러리 사용

- 메트릭 정의: `backend/internal/metrics/metrics.go:223-245`
  ```go
  HostCPUUsage = promauto.NewGauge(...)
  HostMemoryUsage = promauto.NewGauge(...)
  HostDiskUsage = promauto.NewGauge(...)
  ```

- 메트릭 수집 시작: `backend/cmd/server/main.go:162-164`
  ```go
  metrics.StartHostMetricsCollection(logger.Log)
  ```

**테스트 방법**:
```bash
# 1. 백엔드 서버 실행 후 30초 대기 (메트릭 수집 간격)

# 2. 메트릭 확인
curl http://localhost:18443/api/metrics | grep "^host_"

# 예상 출력:
# host_cpu_usage_percent 15.5
# host_memory_usage_percent 45.2
# host_disk_usage_percent 62.8
```

**코드 위치**: 
- `backend/internal/metrics/host.go`
- `backend/internal/metrics/metrics.go:223-245`
- `backend/cmd/server/main.go:162-164`

---

## B6-2: Restore drill 1회 실행 증빙

**항목ID**: B6-2  
**상태**: ⚠️ PARTIAL (스크립트 준비 완료, 실제 실행 필요)

**증거**:
- 백업 스크립트: `backend/scripts/backup.sh`
  - PostgreSQL 데이터베이스 백업 (pg_dump)
  - 설정 파일 백업 (.env, config.yaml)
  - 메타데이터 CSV 내보내기 (vms, users, vm_snapshots, audit_logs)
  - 압축 아카이브 생성

- 복구 스크립트: `backend/scripts/restore.sh`
  - 백업 파일 추출
  - 데이터베이스 복구 (사용자 확인 필요)
  - 설정 파일 복구 (선택적)

**실행 절차** (staging 환경):
```bash
# 1. 백업 생성
cd /home/darc0/LIMEN/backend
./scripts/backup.sh
# 출력: /home/darc0/LIMEN/backups/limen_backup_YYYYMMDD_HHMMSS.tar.gz

# 2. DB 초기화 (⚠️ staging 환경에서만!)
# 주의: 프로덕션 환경에서는 절대 실행하지 마세요
psql $DATABASE_URL <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
EOF

# 3. 복구 실행
./scripts/restore.sh /home/darc0/LIMEN/backups/limen_backup_YYYYMMDD_HHMMSS.tar.gz
# "yes" 입력하여 확인

# 4. 검증
# 4-1. Health check
curl http://localhost:18443/api/health
# 예상: {"status":"ok","db":"connected",...}

# 4-2. Login
curl -X POST http://localhost:18443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
# 예상: {"access_token":"...","expires_in":900}

# 4-3. VM 목록 조회
TOKEN="위에서 받은 access_token"
curl http://localhost:18443/api/vms \
  -H "Authorization: Bearer $TOKEN"
# 예상: VM 목록 JSON

# 4-4. Console 접속 (가능하면)
# 브라우저에서 VM 콘솔 접속 테스트
```

**비고**: 
- 실제 staging 환경에서 restore drill 실행 필요
- 현재는 스크립트 준비만 완료
- 실행 후 다음 증거 수집 필요:
  - restore 로그 (스크린샷 또는 텍스트)
  - /api/health 응답 (JSON)
  - login 응답 (JSON, 토큰 마스킹)
  - VM list 응답 (JSON)
  - Console 접속 화면/로그 (가능하면)

**코드 위치**: 
- `backend/scripts/backup.sh`
- `backend/scripts/restore.sh`

---

## (권장) Active Sessions 메트릭 추가

**항목ID**: (권장)  
**상태**: ✅ PASS

**증거**:
- 메트릭 정의: `backend/internal/metrics/metrics.go:216-221`
  ```go
  ConsoleActiveSessions = promauto.NewGauge(
      prometheus.GaugeOpts{
          Name: "console_active_sessions",
          Help: "Current number of active console sessions",
      },
  )
  ```

- 메트릭 업데이트:
  - 세션 생성 시: `backend/internal/session/manager.go:117`
  - 세션 종료 시: `backend/internal/session/manager.go:180`
  - 세션 만료 시: `backend/internal/session/manager.go:275`

**코드 위치**: 
- `backend/internal/metrics/metrics.go:216-221`
- `backend/internal/session/manager.go:117, 180, 275`

---

## 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| B3-4: Quota 거부 메트릭 | ✅ PASS | 구현 완료 |
| B5-2 (a): Prometheus Rules | ✅ PASS | 규칙 파일 준비 완료 |
| B5-2 (b): Alertmanager 설정 | ✅ PASS | 설정 파일 준비 완료 |
| B5-2 (c): 실제 발송 테스트 | ⚠️ PARTIAL | 테스트 스크립트 준비, 실제 실행 필요 |
| Host 리소스 메트릭 수집 | ✅ PASS | gopsutil 사용, 30초 간격 수집 |
| B6-2: Restore drill | ⚠️ PARTIAL | 스크립트 준비 완료, 실제 실행 필요 |
| Active Sessions 메트릭 | ✅ PASS | 구현 완료 |

---

## 다음 단계

1. **Alert 테스트 완료**:
   - Prometheus + Alertmanager 환경 구성
   - 실제 알림 트리거 및 발송 테스트
   - Webhook 수신 확인 및 스크린샷

2. **Restore drill 실행**:
   - Staging 환경에서 백업 생성
   - DB 초기화 및 복구 실행
   - 검증 단계별 증거 수집

3. **호스트 메트릭 검증**:
   - `/api/metrics`에서 `host_*` 메트릭 확인
   - 메트릭 값이 실제로 업데이트되는지 확인

---

**참고**: 
- 모든 코드 변경사항은 커밋 및 푸시 완료
- 실제 테스트 환경에서 추가 검증 필요
- Alertmanager와 Prometheus는 별도 설치 및 구성 필요




