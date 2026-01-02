# 일반적인 문제 해결

> [← 홈](../../00-home.md) | [운영](../operations-guide.md) | [문제 해결](./) | [일반 문제](./common-issues.md) | [FAQ](./faq.md)

## 서비스가 시작되지 않음

### 포트 충돌

```bash
# 포트 사용 확인
sudo lsof -i :18443
sudo lsof -i :9000

# 포트 변경 (.env 파일)
PORT=18444
```

### 권한 문제

```bash
# libvirt 그룹 추가
sudo usermod -a -G libvirt $USER
# 재로그인 필요
```

### 바이너리 없음

```bash
# Backend 빌드 확인
ls -la /home/darc0/projects/LIMEN/backend/server

# Agent 빌드 확인
ls -la /home/darc0/projects/LIMEN/backend/agent/target/release/agent

# 빌드 필요 시
cd /home/darc0/projects/LIMEN/backend
go build -o server ./cmd/server

cd /home/darc0/projects/LIMEN/backend/agent
cargo build --release
```

---

## 데이터베이스 연결 실패

### PostgreSQL 상태 확인

```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# 연결 테스트
psql -h localhost -U postgres -d limen
```

### 환경 변수 확인

```bash
# 환경 변수 확인
sudo systemctl show limen.service | grep -i db

# DATABASE_URL 확인
echo $DATABASE_URL
```

### 데이터베이스 생성

```bash
# 데이터베이스 생성
createdb limen

# 또는 PostgreSQL 접속 후
psql -U postgres
CREATE DATABASE limen;
```

---

## VM 생성 실패

### Libvirt 상태 확인

```bash
# Libvirt 서비스 확인
sudo systemctl status libvirtd

# VM 목록 확인
virsh list --all

# Libvirt 연결 테스트
virsh -c qemu:///system list
```

### 디스크 공간 확인

```bash
# VM 디렉토리 공간 확인
df -h /home/darc0/projects/LIMEN/database/vms

# 디스크 공간 부족 시 정리
# 오래된 VM 이미지 삭제 또는 백업
```

### 권한 확인

```bash
# libvirt 그룹 확인
groups $USER | grep libvirt

# 그룹 추가
sudo usermod -a -G libvirt $USER
# 재로그인 필요
```

### Libvirt 소켓 확인

```bash
# 소켓 파일 확인
ls -la /var/run/libvirt/libvirt-sock

# 권한 확인
sudo chmod 666 /var/run/libvirt/libvirt-sock  # 임시 해결책
```

---

## CORS 에러

### 허용된 오리진 확인

```bash
# 환경 변수 확인
sudo systemctl show limen.service | grep ALLOWED_ORIGINS

# 현재 설정 확인
echo $ALLOWED_ORIGINS
```

### 요청 오리진 확인

브라우저 개발자 도구에서:
1. Network 탭 열기
2. 요청 헤더 확인
3. `Origin` 헤더 확인

### CORS 로그 확인

```bash
# CORS 관련 로그 확인
sudo journalctl -u limen.service | grep -i cors

# 실시간 로그 확인
sudo journalctl -u limen.service -f | grep -i cors
```

### 해결 방법

```bash
# 환경 변수에 오리진 추가
sudo systemctl edit limen.service

# 또는 서비스 파일 직접 수정
sudo nano /etc/systemd/system/limen.service

# Environment=ALLOWED_ORIGINS=https://www.darc.kr,https://darc.kr

# 서비스 재시작
sudo systemctl daemon-reload
sudo systemctl restart limen.service
```

---

## WebSocket 연결 실패

### 토큰 확인

- VNC 연결 시 JWT 토큰이 필수입니다
- 토큰이 유효한지 확인
- 토큰 만료 시간 확인 (기본 24시간)

### 프록시 설정 확인

리버스 프록시에서 WebSocket 업그레이드 지원 확인:

```nginx
# Nginx 예시
location /ws/ {
    proxy_pass http://127.0.0.1:18443;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

### 방화벽 확인

```bash
# 방화벽 상태 확인
sudo ufw status

# 포트 열기 (필요 시)
sudo ufw allow 18443/tcp
```

---

## 성능 문제

### 메모리 부족

```bash
# 메모리 사용량 확인
free -h

# 프로세스별 메모리 사용량
ps aux --sort=-%mem | head -10
```

### CPU 사용률 높음

```bash
# CPU 사용률 확인
top
# 또는
htop

# 프로세스별 CPU 사용량
ps aux --sort=-%cpu | head -10
```

### 디스크 I/O 문제

```bash
# 디스크 사용량 확인
df -h

# I/O 대기 확인
iostat -x 1
```

---

## 로그 문제

### 로그가 너무 많음

```bash
# 로그 크기 확인
sudo journalctl --disk-usage

# 오래된 로그 삭제
sudo journalctl --vacuum-time=7d

# 로그 크기 제한 설정
sudo nano /etc/systemd/journald.conf.d/limen.conf
```

### 로그가 보이지 않음

```bash
# 서비스 상태 확인
sudo systemctl status limen.service

# 로그 확인
sudo journalctl -u limen.service -n 50

# 실시간 로그
sudo journalctl -u limen.service -f
```

---

## 관련 문서

- [FAQ](./faq.md)
- [운영 가이드](../operations-guide.md)
- [모니터링 전략](../monitoring/strategy.md)

---

**태그**: `#운영` `#문제-해결` `#트러블슈팅` `#CORS` `#WebSocket` `#Libvirt`

**카테고리**: 운영 > 문제 해결 > 일반 문제

**마지막 업데이트**: 2024-12-23
