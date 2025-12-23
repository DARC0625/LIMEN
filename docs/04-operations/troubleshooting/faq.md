# FAQ

> [← 홈](../../00-home.md) | [운영](../operations-guide.md) | [문제 해결](./) | [FAQ](./faq.md) | [일반 문제](./common-issues.md)

## 자주 묻는 질문

### Q: 서비스가 시작되지 않아요

**A:** 다음을 확인하세요:

1. 포트 충돌 확인
   ```bash
   sudo lsof -i :18443
   sudo lsof -i :9000
   ```

2. 바이너리 존재 확인
   ```bash
   ls -la /home/darc0/projects/LIMEN/backend/server
   ls -la /home/darc0/projects/LIMEN/backend/agent/target/release/agent
   ```

3. 로그 확인
   ```bash
   sudo journalctl -u limen.service -n 50
   ```

자세한 내용은 [일반 문제](./common-issues.md) 참조.

---

### Q: VM을 생성할 수 없어요

**A:** 다음을 확인하세요:

1. libvirt 권한 확인
   ```bash
   groups $USER | grep libvirt
   sudo usermod -a -G libvirt $USER  # 그룹 추가
   ```

2. 디스크 공간 확인
   ```bash
   df -h /home/darc0/projects/LIMEN/database/vms
   ```

3. Libvirt 상태 확인
   ```bash
   sudo systemctl status libvirtd
   virsh list --all
   ```

자세한 내용은 [일반 문제](./common-issues.md) 참조.

---

### Q: 알림이 오지 않아요

**A:** 다음을 확인하세요:

1. 환경 변수 설정 확인
   ```bash
   sudo systemctl show limen.service | grep ALERT
   ```

2. 로그 확인
   ```bash
   sudo journalctl -u limen.service | grep -i alert
   ```

3. 웹훅/이메일 설정 확인
   - URL이 올바른지 확인
   - 네트워크 연결 확인

자세한 내용은 [알림 설정](../alerting/setup.md) 참조.

---

### Q: CORS 에러가 발생해요

**A:** 다음을 확인하세요:

1. 허용된 오리진 확인
   ```bash
   sudo systemctl show limen.service | grep ALLOWED_ORIGINS
   ```

2. 요청 오리진 확인
   - 브라우저 개발자 도구에서 Network 탭 확인
   - `Origin` 헤더 확인

3. 환경 변수 설정
   ```bash
   Environment=ALLOWED_ORIGINS=https://www.darc.kr,https://darc.kr
   ```

자세한 내용은 [일반 문제](./common-issues.md) 참조.

---

### Q: WebSocket 연결이 실패해요

**A:** 다음을 확인하세요:

1. JWT 토큰 확인
   - VNC 연결 시 토큰이 필수입니다
   - 토큰이 유효한지 확인

2. 프록시 설정 확인
   - 리버스 프록시에서 WebSocket 업그레이드 지원 확인
   - `Upgrade` 및 `Connection` 헤더 전달 확인

3. 방화벽 확인
   ```bash
   sudo ufw status
   ```

자세한 내용은 [일반 문제](./common-issues.md) 참조.

---

### Q: 데이터베이스 연결이 실패해요

**A:** 다음을 확인하세요:

1. PostgreSQL 상태 확인
   ```bash
   sudo systemctl status postgresql
   ```

2. 연결 테스트
   ```bash
   psql -h localhost -U postgres -d limen
   ```

3. 환경 변수 확인
   ```bash
   sudo systemctl show limen.service | grep -i db
   ```

자세한 내용은 [일반 문제](./common-issues.md) 참조.

---

### Q: 로그가 너무 많아요

**A:** 로그 로테이션 설정:

```bash
# 로그 크기 확인
sudo journalctl --disk-usage

# 오래된 로그 삭제
sudo journalctl --vacuum-time=7d

# 로그 크기 제한 설정
sudo nano /etc/systemd/journald.conf.d/limen.conf
```

자세한 내용은 [운영 가이드](../operations-guide.md) 참조.

---

### Q: 성능이 느려요

**A:** 다음을 확인하세요:

1. 메모리 사용량 확인
   ```bash
   free -h
   ```

2. CPU 사용률 확인
   ```bash
   top
   ```

3. 디스크 I/O 확인
   ```bash
   iostat -x 1
   ```

자세한 내용은 [일반 문제](./common-issues.md) 참조.

---

## 관련 문서

- [일반 문제](./common-issues.md)
- [운영 가이드](../operations-guide.md)
- [알림 설정](../alerting/setup.md)

---

**태그**: `#운영` `#FAQ` `#문제-해결` `#자주-묻는-질문`

**카테고리**: 운영 > 문제 해결 > FAQ

**마지막 업데이트**: 2024-12-23
