# 통합 모니터링 전략

> [← 홈](../../00-home.md) | [운영](../operations-guide.md) | [모니터링](./) | [전략](./strategy.md)

## 개요

각 서비스마다 개별 모니터링 시스템을 구축하는 대신, 중앙화된 통합 모니터링 서비스를 구축하여 모든 서비스의 상태를 한 곳에서 관리합니다.

---

## 아키텍처 설계

### 목표

```
┌─────────────────────────────────────────────────────────┐
│         통합 모니터링 서비스 (중앙화)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Prometheus  │  │   Grafana    │  │  Alertmanager│  │
│  │   (수집)     │  │  (시각화)    │  │  (알림)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          │ HTTP/API 호출    │                  │
          │                  │                  │
    ┌─────┴──────────────────┴──────────────────┴─────┐
    │                                                  │
    ▼                                                  ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ LIMEN    │  │ Service2 │  │ Service3 │  │ ServiceN │
│ /metrics │  │ /metrics │  │ /metrics │  │ /metrics │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### 특징

1. **중앙화된 수집**: 모든 서비스의 메트릭스를 한 곳에서 수집
2. **API 기반**: 각 서비스는 `/metrics` 엔드포인트 제공
3. **내부망 전용**: 모니터링 서비스는 내부망에서만 접근 가능
4. **확장 가능**: 새로운 서비스 추가 시 설정만 추가하면 됨

---

## 구현 계획

### Phase 1: 각 서비스에 메트릭스 엔드포인트 구현

**LIMEN 백엔드** (이미 구현됨)
- `/api/metrics` - Prometheus 형식 메트릭스
- HTTP 요청 수, 응답 시간, VM 상태 등

**필요한 메트릭스:**
- HTTP 요청 수 및 응답 시간
- VM 상태 (실행 중, 중지됨 등)
- 리소스 사용량 (CPU, Memory)
- 데이터베이스 연결 상태
- 에러 발생 수

### Phase 2: 통합 모니터링 서비스 구축

**구성 요소:**
1. **Prometheus**: 메트릭스 수집 및 저장
2. **Grafana**: 대시보드 및 시각화
3. **Alertmanager**: 알림 관리
4. **Service Discovery**: 자동 서비스 발견 (선택)

**설정 방식:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'limen'
    static_configs:
      - targets: ['limen-api:18443']
    metrics_path: '/api/metrics'
    
  - job_name: 'service2'
    static_configs:
      - targets: ['service2-api:8080']
    metrics_path: '/metrics'
    
  - job_name: 'service3'
    static_configs:
      - targets: ['service3-api:3000']
    metrics_path: '/metrics'
```

### Phase 3: 통합 대시보드

**Grafana 대시보드:**
- 전체 서비스 상태 개요
- 각 서비스별 상세 메트릭스
- 크로스 서비스 비교
- 알림 규칙 및 상태

---

## 보안 고려사항

### 내부망 전용

1. **네트워크 격리**
   - 모니터링 서비스는 내부망에만 바인딩
   - 외부 접근 차단 (방화벽)

2. **인증/인가**
   - Grafana 접근 시 인증 필수
   - Prometheus는 내부 서비스만 접근 가능

3. **메트릭스 엔드포인트 보호**
   - 각 서비스의 `/metrics` 엔드포인트는 내부 IP만 허용
   - 또는 API 키 기반 인증

---

## 서비스별 메트릭스 표준

### 공통 메트릭스

모든 서비스는 다음 메트릭스를 제공해야 합니다:

```prometheus
# HTTP 요청 수
http_requests_total{method, path, status}

# HTTP 응답 시간
http_request_duration_seconds{method, path}

# 서비스 상태
service_up{name="service_name"} 1

# 에러 수
service_errors_total{type}

# 리소스 사용량
service_cpu_usage_percent
service_memory_usage_bytes
```

### 서비스별 특화 메트릭스

**LIMEN:**
```prometheus
vm_total
vm_running
vm_cpu_usage_percent
vm_memory_usage_bytes
libvirt_connection_status
```

**다른 서비스들:**
- 각 서비스의 비즈니스 로직에 맞는 메트릭스

---

## 배포 전략

### 옵션 1: 독립 서버

- 전용 모니터링 서버에 Prometheus + Grafana 설치
- 모든 서비스의 메트릭스를 이 서버로 수집

### 옵션 2: 컨테이너 기반

- Docker Compose로 통합 모니터링 스택 구성
- 각 서비스는 독립적으로 배포, 메트릭스만 수집

### 옵션 3: Kubernetes (향후)

- Prometheus Operator 사용
- ServiceMonitor로 자동 발견

---

## 구현 시점

**별도 통합 모니터링 서비스로 개발 예정**

현재 LIMEN에 구현된 알림 시스템은 임시 구현이며, 향후 통합 모니터링 서비스로 마이그레이션될 예정입니다.

**통합 모니터링 서비스 구성 요소:**
1. **알림 시스템** - 현재 LIMEN 내부 구현 → 통합 서비스로 이동
2. **메트릭스 수집** - Prometheus 기반
3. **시각화** - Grafana 대시보드
4. **알림 관리** - Alertmanager
5. **서비스 발견** - 자동 서비스 등록 및 모니터링

**권장 시점:**
- 서비스가 2-3개 이상일 때 통합 모니터링 서비스 개발 시작
- 각 서비스의 `/metrics` 엔드포인트를 통합 서비스가 수집

---

## 향후 계획

### 단계별 구현

1. **각 서비스에 메트릭스 엔드포인트 구현** (현재 LIMEN 완료)
2. **서비스가 2-3개가 되면 통합 모니터링 구축**
3. **Service Discovery 구현** (자동 서비스 발견)
4. **통합 알림 시스템 구축**
5. **대시보드 템플릿화** (새 서비스 추가 시 빠른 설정)

---

## 관련 문서

- [운영 가이드](../operations-guide.md)
- [알림 설정](../alerting/setup.md)
- [로드맵](../../01-architecture/roadmap.md)

---

**태그**: `#운영` `#모니터링` `#전략` `#Prometheus` `#Grafana` `#통합`

**카테고리**: 운영 > 모니터링 > 전략

**마지막 업데이트**: 2024-12-23

**상태**: 향후 구현 예정
