# Docker 배포 가이드

> [← 홈](../00-home.md) | [배포](../) | [Docker](./) | [배포 가이드](./deployment.md) | [빠른 시작](./quick-start.md)

## 개요

LIMEN을 Docker 컨테이너로 배포하는 방법을 설명합니다.

---

## 전제 조건

- **Docker 20.10+**
- **Docker Compose 2.0+**
- **libvirt** - 호스트 시스템에 설치되어 있어야 함 (VM 관리용)

---

## 빠른 시작

### 1. 환경 변수 설정

`.env` 파일 생성:

```bash
cp backend/env.example .env
```

주요 설정:
```bash
# Database
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_NAME=limen

# Security
JWT_SECRET=your-jwt-secret-key
ALLOWED_ORIGINS=https://www.darc.kr,https://darc.kr

# Admin
ADMIN_USER=admin
ADMIN_PASSWORD=your-admin-password

# Server
PORT=18443
BIND_ADDRESS=0.0.0.0

# Libvirt
LIBVIRT_URI=qemu:///system
```

### 2. 디렉토리 생성

```bash
mkdir -p database/vms database/iso
```

### 3. 빌드 및 실행

```bash
# 개발 환경
docker-compose up --build

# 프로덕션 환경
docker-compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
```

---

## 아키텍처

### 서비스 구성

1. **postgres**: PostgreSQL 데이터베이스
2. **backend**: LIMEN 백엔드 서버
3. **agent**: 시스템 메트릭스 수집 에이전트

### 네트워크

- 모든 서비스는 `limen-network` 브리지 네트워크에 연결
- 백엔드는 PostgreSQL에 `postgres:5432`로 연결
- 에이전트는 백엔드에서 `/agent/*`로 프록시됨

---

## Libvirt 통합

### 문제점

libvirt는 호스트 시스템의 하이퍼바이저와 직접 통신해야 합니다.

### 해결 방법

#### 방법 1: 소켓 마운트 (권장)

```yaml
volumes:
  - /var/run/libvirt/libvirt-sock:/var/run/libvirt/libvirt-sock:ro
  - /var/lib/libvirt:/var/lib/libvirt:ro
```

**장점:**
- 간단한 설정
- 호스트 libvirt 그대로 사용

**단점:**
- 호스트와 컨테이너 간 권한 문제 가능
- 보안 고려 필요

#### 방법 2: 호스트 네트워크 모드

```yaml
network_mode: host
```

**장점:**
- 네트워크 격리 없음
- libvirt 접근 용이

**단점:**
- 네트워크 격리 없음 (보안 위험)
- 포트 충돌 가능

#### 방법 3: Privileged 모드

```yaml
privileged: true
cap_add:
  - SYS_ADMIN
```

**주의:** 보안 위험이 있으므로 신중히 사용

### 권한 설정

호스트에서 libvirt 그룹에 사용자 추가:

```bash
sudo usermod -a -G libvirt $USER
```

컨테이너 내부에서도 동일한 그룹 ID 사용:

```dockerfile
RUN addgroup -g 1000 limen && \
    adduser -D -u 1000 -G limen limen
```

---

## 볼륨 마운트

### VM 이미지 및 ISO

```yaml
volumes:
  - ./database/vms:/data/vms:rw
  - ./database/iso:/data/iso:ro
```

- `vms`: VM 디스크 이미지 저장 (읽기/쓰기)
- `iso`: ISO 이미지 저장 (읽기 전용)

### 데이터베이스

```yaml
volumes:
  postgres_data:/var/lib/postgresql/data
```

데이터베이스 데이터는 Docker 볼륨에 저장되어 컨테이너 삭제 시에도 유지됩니다.

---

## 환경별 설정

### 개발 환경

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**특징:**
- 소스 코드 마운트 (핫 리로드 가능)
- 디버그 로그 레벨
- 개발용 포트 노출

### 프로덕션 환경

```bash
docker-compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d
```

**특징:**
- 리소스 제한 설정
- 로그 로테이션
- 자동 재시작
- 프로덕션 로그 레벨

---

## 빌드 최적화

### 멀티 스테이지 빌드

Dockerfile은 멀티 스테이지 빌드를 사용하여 최종 이미지 크기를 최소화합니다:

1. **Builder stage**: 컴파일 및 빌드
2. **Final stage**: 런타임만 포함

### 캐싱 활용

```bash
# 빌드 캐시 활용
docker-compose build --parallel

# 캐시 없이 빌드
docker-compose build --no-cache
```

---

## 헬스 체크

각 서비스는 헬스 체크를 포함합니다:

### Backend

```bash
curl http://localhost:18443/api/health
```

### Agent

```bash
curl http://localhost:9000/health
```

### PostgreSQL

```bash
docker exec limen-postgres pg_isready
```

---

## 로그 관리

### 로그 확인

```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend

# 최근 로그
docker-compose logs --tail=100 backend
```

### 로그 로테이션 (프로덕션)

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

최대 3개 파일, 각 10MB까지 보관

---

## 백업 및 복구

### 데이터베이스 백업

```bash
# 백업
docker exec limen-postgres pg_dump -U postgres limen > backup.sql

# 복구
docker exec -i limen-postgres psql -U postgres limen < backup.sql
```

### 볼륨 백업

```bash
# VM 이미지 백업
tar -czf vms-backup.tar.gz database/vms/

# 복구
tar -xzf vms-backup.tar.gz
```

---

## 문제 해결

### Libvirt 연결 실패

1. **소켓 파일 확인**
```bash
ls -la /var/run/libvirt/libvirt-sock
```

2. **권한 확인**
```bash
groups $USER | grep libvirt
```

3. **libvirt 서비스 확인**
```bash
sudo systemctl status libvirtd
```

### 포트 충돌

```bash
# 포트 사용 확인
sudo lsof -i :18443
sudo lsof -i :5432
```

`.env` 파일에서 포트 변경

### 컨테이너 시작 실패

```bash
# 로그 확인
docker-compose logs backend

# 컨테이너 상태 확인
docker-compose ps

# 재시작
docker-compose restart backend
```

### 데이터베이스 연결 실패

1. PostgreSQL 컨테이너 상태 확인
2. 네트워크 연결 확인
3. 환경 변수 확인 (DATABASE_URL)

---

## 보안 고려사항

### 1. 비밀번호 관리

프로덕션에서는 Docker Secrets 또는 외부 비밀 관리 도구 사용:

```yaml
secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
```

### 2. 네트워크 격리

- 내부 서비스는 브리지 네트워크 사용
- 필요한 포트만 노출
- 방화벽 규칙 설정

### 3. 권한 최소화

- Non-root 사용자로 실행
- 필요한 권한만 부여
- Privileged 모드 피하기

### 4. 이미지 보안

- 정기적으로 베이스 이미지 업데이트
- 취약점 스캔 실행
- 신뢰할 수 있는 이미지만 사용

---

## 성능 최적화

### 리소스 제한

프로덕션 환경에서 리소스 제한 설정:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### 연결 풀링

데이터베이스 연결 풀 설정은 백엔드 코드에서 관리됩니다.

---

## 확장성

### 수평 확장

백엔드 서비스 확장:

```bash
docker-compose up -d --scale backend=3
```

**주의:** libvirt 접근은 단일 인스턴스에서만 가능하므로, VM 관리 기능이 있는 경우 확장에 제한이 있습니다.

### 로드 밸런싱

Nginx나 Traefik 같은 리버스 프록시 사용:

```yaml
# nginx.conf 예시
upstream backend {
    least_conn;
    server backend:18443;
}
```

---

## CI/CD 통합

GitHub Actions에서 Docker 이미지 빌드 및 푸시:

```yaml
- name: Build and push Docker images
  uses: docker/build-push-action@v5
  with:
    context: ./backend
    push: true
    tags: user/app:latest
```

---

## 관련 문서

- [빠른 시작](./quick-start.md)
- [컨테이너화 이점](./benefits.md)
- [운영 가이드](../../04-operations/operations-guide.md)
- [CI/CD 설정](../ci-cd/setup.md)

---

**태그**: `#배포` `#Docker` `#컨테이너` `#Libvirt` `#프로덕션`

**카테고리**: 배포 > Docker > 배포 가이드

**마지막 업데이트**: 2024-12-23
