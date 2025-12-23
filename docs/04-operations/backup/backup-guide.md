# 백업 가이드

> [← 운영](../operations-guide.md) | [백업](./backup-guide.md)

## 개요

LIMEN 시스템의 백업 자동화 스크립트를 사용하여 데이터베이스, VM 이미지, 설정 파일을 안전하게 백업하고 복원할 수 있습니다.

> **백업 원칙**:  
> - 정기적 백업 (일일 권장)
> - 암호화 백업 (민감 정보 보호)
> - 백업 검증 (복원 가능 여부 확인)
> - 자동 정리 (오래된 백업 삭제)

---

## 백업 구성 요소

### 1. 데이터베이스 백업

**백업 대상**:
- PostgreSQL 데이터베이스
- 모든 VM 메타데이터
- 사용자 정보
- 설정 및 권한

**백업 파일 형식**:
- `limen_db_YYYYMMDD_HHMMSS.sql.gz` (압축)
- `limen_db_YYYYMMDD_HHMMSS.sql.gz.enc` (암호화)

**보관 기간**: 30일 (기본값)

### 2. VM 이미지 백업

**백업 대상**:
- VM 디스크 이미지
- ISO 파일
- 스냅샷

**백업 파일 형식**:
- `vm_images_YYYYMMDD_HHMMSS.tar.gz` (압축)
- `vm_images_YYYYMMDD_HHMMSS.tar.gz.enc` (암호화)

**보관 기간**: 30일 (기본값)

### 3. 설정 파일 백업

**백업 대상**:
- 환경 변수 파일 (`.env`)
- 설정 파일
- 서버 스펙 파일
- 스크립트
- 문서

**백업 파일 형식**:
- `config_YYYYMMDD_HHMMSS.tar.gz` (압축)
- `config_YYYYMMDD_HHMMSS.tar.gz.enc` (암호화)

**보관 기간**: 90일 (기본값)

---

## 백업 스크립트 사용법

### 전체 백업

모든 구성 요소를 한 번에 백업:

```bash
# 기본 사용법
./scripts/backup/full_backup.sh

# 암호화 백업
ENCRYPTION_KEY="your-encryption-key" ./scripts/backup/full_backup.sh

# 백업 디렉토리 지정
BACKUP_BASE_DIR="/mnt/backup/limen" ./scripts/backup/full_backup.sh

# 알림 웹훅 설정
NOTIFICATION_WEBHOOK="https://hooks.slack.com/..." ./scripts/backup/full_backup.sh
```

### 개별 백업

#### 데이터베이스 백업

```bash
# 기본 사용법
./scripts/backup/database.sh

# 환경 변수 설정
DB_NAME=limen \
DB_USER=limen \
DB_HOST=localhost \
DB_PORT=5432 \
DB_PASSWORD=your-password \
ENCRYPTION_KEY=your-key \
BACKUP_DIR=/var/backups/limen/database \
RETENTION_DAYS=30 \
./scripts/backup/database.sh
```

#### VM 이미지 백업

```bash
# 기본 사용법
./scripts/backup/vm_images.sh

# 환경 변수 설정
ISO_DIR=/var/lib/libvirt/images \
BACKUP_DIR=/var/backups/limen/vm_images \
ENCRYPTION_KEY=your-key \
RETENTION_DAYS=30 \
COMPRESS=true \
./scripts/backup/vm_images.sh
```

#### 설정 파일 백업

```bash
# 기본 사용법
./scripts/backup/config.sh

# 환경 변수 설정
CONFIG_DIR=/home/darc0/projects/LIMEN \
BACKUP_DIR=/var/backups/limen/config \
ENCRYPTION_KEY=your-key \
RETENTION_DAYS=90 \
./scripts/backup/config.sh
```

---

## 복원 (Restore)

### 데이터베이스 복원

```bash
# 일반 백업 복원
./scripts/backup/restore.sh -t database /var/backups/limen/database/limen_db_20241223_120000.sql.gz

# 암호화 백업 복원
./scripts/backup/restore.sh -t database -d "your-encryption-key" \
  /var/backups/limen/database/limen_db_20241223_120000.sql.gz.enc
```

### VM 이미지 복원

```bash
# 일반 백업 복원
./scripts/backup/restore.sh -t vm_images \
  /var/backups/limen/vm_images/vm_images_20241223_120000.tar.gz

# 암호화 백업 복원
./scripts/backup/restore.sh -t vm_images -d "your-encryption-key" \
  /var/backups/limen/vm_images/vm_images_20241223_120000.tar.gz.enc
```

### 설정 파일 복원

```bash
# 일반 백업 복원
./scripts/backup/restore.sh -t config \
  /var/backups/limen/config/config_20241223_120000.tar.gz

# 암호화 백업 복원
./scripts/backup/restore.sh -t config -d "your-encryption-key" \
  /var/backups/limen/config/config_20241223_120000.tar.gz.enc
```

---

## 자동 백업 설정

### systemd Timer 사용 (권장)

#### 1. 서비스 파일 생성

`/etc/systemd/system/limen-backup.service`:

```ini
[Unit]
Description=LIMEN Backup Service
After=network.target postgresql.service

[Service]
Type=oneshot
User=limen
Group=limen
Environment="BACKUP_BASE_DIR=/var/backups/limen"
Environment="ENCRYPTION_KEY=your-encryption-key"
Environment="DB_PASSWORD=your-db-password"
ExecStart=/home/darc0/projects/LIMEN/scripts/backup/full_backup.sh
StandardOutput=journal
StandardError=journal
```

#### 2. 타이머 파일 생성

`/etc/systemd/system/limen-backup.timer`:

```ini
[Unit]
Description=LIMEN Backup Timer
Requires=limen-backup.service

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

#### 3. 타이머 활성화

```bash
sudo systemctl daemon-reload
sudo systemctl enable limen-backup.timer
sudo systemctl start limen-backup.timer

# 상태 확인
sudo systemctl status limen-backup.timer
sudo systemctl list-timers limen-backup.timer
```

### Cron 사용

```bash
# crontab 편집
crontab -e

# 매일 새벽 2시에 전체 백업 실행
0 2 * * * /home/darc0/projects/LIMEN/scripts/backup/full_backup.sh >> /var/log/limen-backup.log 2>&1

# 매주 일요일 새벽 3시에 전체 백업 + 알림
0 3 * * 0 ENCRYPTION_KEY="your-key" NOTIFICATION_WEBHOOK="https://..." /home/darc0/projects/LIMEN/scripts/backup/full_backup.sh >> /var/log/limen-backup.log 2>&1
```

---

## 백업 암호화

### 암호화 키 생성

```bash
# 강력한 암호화 키 생성 (32 bytes)
openssl rand -base64 32

# 또는 더 긴 키 (64 bytes)
openssl rand -base64 64
```

### 암호화 키 저장

**안전한 저장 방법**:
1. 환경 변수로 설정 (`.env` 파일)
2. 시스템 키링 사용
3. 암호화된 키 파일 사용

**예시**:
```bash
# .env 파일에 추가
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)

# 또는 시스템 환경 변수
export ENCRYPTION_KEY="your-encryption-key"
```

### 암호화된 백업 복원

```bash
# 복원 시 암호화 키 제공
./scripts/backup/restore.sh -t database -d "your-encryption-key" \
  /var/backups/limen/database/limen_db_20241223_120000.sql.gz.enc
```

---

## 백업 검증

### 백업 파일 확인

```bash
# 백업 파일 목록 확인
ls -lh /var/backups/limen/database/
ls -lh /var/backups/limen/vm_images/
ls -lh /var/backups/limen/config/

# 백업 파일 크기 확인
du -sh /var/backups/limen/*/

# 최신 백업 확인
ls -lt /var/backups/limen/database/ | head -5
```

### 백업 무결성 검증

```bash
# 압축 파일 검증
gzip -t /var/backups/limen/database/limen_db_20241223_120000.sql.gz

# 암호화 파일 검증 (복호화 테스트)
echo "your-key" | openssl enc -aes-256-cbc -d -pbkdf2 \
  -in /var/backups/limen/database/limen_db_20241223_120000.sql.gz.enc \
  -out /tmp/test_decrypt.sql.gz -pass stdin && \
  gzip -t /tmp/test_decrypt.sql.gz && \
  rm /tmp/test_decrypt.sql.gz && \
  echo "Backup file is valid"
```

---

## 백업 모니터링

### 로그 확인

```bash
# systemd 로그 확인
sudo journalctl -u limen-backup.service -f

# Cron 로그 확인
tail -f /var/log/limen-backup.log
```

### 알림 설정

백업 완료/실패 시 알림을 받으려면:

```bash
# 웹훅 URL 설정
export NOTIFICATION_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# 백업 실행
./scripts/backup/full_backup.sh
```

---

## 백업 전략 권장사항

### 프로덕션 환경

1. **일일 전체 백업**
   - 매일 새벽 2시
   - 암호화 필수
   - 원격 저장소에 복사

2. **주간 백업 보관**
   - 최근 4주간 보관
   - 월별 백업은 장기 보관

3. **백업 검증**
   - 주 1회 복원 테스트
   - 백업 무결성 확인

4. **원격 백업**
   - 로컬 백업 + 원격 복사
   - 3-2-1 규칙 준수:
     - 3개 복사본
     - 2가지 미디어
     - 1개는 오프사이트

---

## 문제 해결

### 백업 실패 시

1. **디스크 공간 확인**
   ```bash
   df -h /var/backups
   ```

2. **권한 확인**
   ```bash
   ls -la /var/backups/limen/
   ```

3. **데이터베이스 연결 확인**
   ```bash
   psql -h localhost -U limen -d limen -c "SELECT 1;"
   ```

4. **로그 확인**
   ```bash
   sudo journalctl -u limen-backup.service --since "1 hour ago"
   ```

### 복원 실패 시

1. **백업 파일 확인**
   ```bash
   file /var/backups/limen/database/limen_db_*.sql.gz
   ```

2. **암호화 키 확인**
   - 올바른 키 사용 확인
   - 키 형식 확인 (base64)

3. **디스크 공간 확인**
   ```bash
   df -h
   ```

---

## 관련 문서

- [운영 가이드](../operations-guide.md)
- [보안 가이드](../security/hardening.md)
- [재해 복구](./disaster-recovery.md)

---

**태그**: `#백업` `#자동화` `#복원` `#암호화` `#데이터-보호`

**마지막 업데이트**: 2024-12-23

