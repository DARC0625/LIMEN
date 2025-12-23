# LIMEN 스크립트

## 주요 스크립트

### `limen-control.sh` - 통합 제어 스크립트 ⭐
모든 LIMEN 서비스를 한번에 제어하는 통합 스크립트입니다.

**사용법:**
```bash
./limen-control.sh {start|stop|restart|status}
```

**기능:**
- `start`: 모든 LIMEN 서비스 시작 (PostgreSQL → Libvirt → Backend → Agent)
- `stop`: 모든 LIMEN 서비스 중지
- `restart`: 모든 LIMEN 서비스 재시작
- `status`: 모든 서비스 상태 확인 (기본값)

**예시:**
```bash
# 서비스 상태 확인
./limen-control.sh status

# 모든 서비스 시작
./limen-control.sh start

# 모든 서비스 중지
./limen-control.sh stop

# 모든 서비스 재시작
./limen-control.sh restart
```

## 기타 스크립트

### `setup_firewall.sh`
방화벽 규칙 설정 스크립트

### `create_systemd_service.sh`
Systemd 서비스 파일 생성 스크립트

### `install_service.sh`
Systemd 서비스 설치 스크립트
