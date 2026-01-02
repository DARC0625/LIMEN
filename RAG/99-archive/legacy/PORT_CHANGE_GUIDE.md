# 포트 변경 가이드 (8080 → 18443)

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [포트 변경 가이드 (8080 → 18443)](./PORT_CHANGE_GUIDE.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

LIMEN 백엔드는 보안 강화를 위해 기본 포트를 **8080**에서 **18443**으로 변경했습니다.

## 변경 사항 요약

### 백엔드
- **기본 포트**: `8080` → `18443`
- **설정 파일**: `backend/.env`의 `PORT=18443`
- **코드**: `backend/internal/config/config.go`의 기본값 변경

### 프론트엔드
- **기본 백엔드 URL**: `http://localhost:8080` → `http://localhost:18443`
- **업데이트된 파일**:
  - `frontend/src/lib/api.ts`
  - `frontend/next.config.ts`
  - `frontend/src/components/VNCViewer.tsx`
  - `frontend/src/hooks/useVMWebSocket.ts`

### 방화벽
- **새로운 포트**: `18443` (프론트엔드 10.0.0.10에서만 허용)
- **설정 스크립트**: `scripts/setup_firewall.sh`

## 적용 방법

### 1. 백엔드 서버 재시작

```bash
cd /home/darc0/projects/LIMEN/backend

# 기존 서버 종료
pkill -f './server'

# .env 파일 확인
cat .env | grep PORT

# 서버 재시작
./server > /tmp/limen-backend.log 2>&1 &

# 포트 확인
ss -tuln | grep 18443
```

### 2. 방화벽 설정

백엔드 서버(10.0.0.100)에서 실행:

```bash
cd /home/darc0/projects/LIMEN
./scripts/setup_firewall.sh
```

또는 수동 설정:

```bash
# 프론트엔드에서만 접근 허용
sudo ufw allow from 10.0.0.10 to any port 18443 proto tcp

# 기존 8080 포트 규칙 제거 (있는 경우)
sudo ufw delete allow from 10.0.0.10 to any port 8080 proto tcp
```

### 3. 프론트엔드 환경 변수 업데이트

프론트엔드 서버(10.0.0.10)에서:

```bash
# .env.production 또는 .env.local 파일
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
NEXT_PUBLIC_API_URL=http://10.0.0.100:18443/api
```

### 4. 연결 테스트

```bash
# 백엔드 헬스 체크
curl http://10.0.0.100:18443/api/health

# 프론트엔드에서 테스트
curl http://10.0.0.10/api/health
```

## 포트를 다른 값으로 변경하려면

1. **백엔드 `.env` 파일 수정**:
   ```bash
   PORT=새로운포트번호
   ```

2. **프론트엔드 환경 변수 업데이트**:
   ```bash
   NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:새로운포트번호
   ```

3. **방화벽 규칙 업데이트**:
   ```bash
   # 기존 규칙 삭제
   sudo ufw delete allow from 10.0.0.10 to any port 18443 proto tcp
   
   # 새 규칙 추가
   sudo ufw allow from 10.0.0.10 to any port 새로운포트번호 proto tcp
   ```

4. **백엔드 서버 재시작**

## 보안 고려사항

1. **커스텀 포트 사용**: 잘 알려지지 않은 포트(18443)를 사용하여 포트 스캔 공격을 어렵게 만듭니다.
2. **IP 제한**: 방화벽을 통해 프론트엔드(10.0.0.10)에서만 접근을 허용합니다.
3. **최소 권한 원칙**: 필요한 IP에서만 포트를 열어 공격 표면을 최소화합니다.

## 문제 해결

### 포트가 열리지 않는 경우

```bash
# 방화벽 상태 확인
sudo ufw status numbered

# 포트 리스닝 확인
ss -tuln | grep 18443

# 백엔드 로그 확인
tail -f /tmp/limen-backend.log
```

### 연결이 안 되는 경우

1. **방화벽 규칙 확인**: `sudo ufw status numbered`
2. **백엔드 서버 실행 확인**: `ps aux | grep './server'`
3. **네트워크 연결 확인**: `ping 10.0.0.100`
4. **포트 접근 테스트**: `telnet 10.0.0.100 18443`

## 참고 문서

- [방화벽 설정 가이드](./FIREWALL_SETUP.md)
- [네트워크 설정 가이드](./NETWORK_SETUP.md)
- [프론트엔드 개발자 가이드](./FRONTEND_DEVELOPER_GUIDE.md)


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#설정` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 설정

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
