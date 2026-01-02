# WSL Mirror Mode 설정 가이드

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [WSL Mirror Mode 설정 가이드](./MIRROR_MODE_SETUP.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 개요

WSL Mirror Mode를 활성화하면 포트포워딩 없이 Windows와 WSL이 동일한 네트워크 인터페이스를 공유합니다.

## 설정 단계

### 1. WSL Mirror Mode 활성화

**`C:\Users\<username>\.wslconfig` 파일 수정:**
```ini
[wsl2]
networkingMode=mirrored
```

**WSL 재시작:**
```powershell
wsl --shutdown
wsl
```

### 2. 포트포워딩 규칙 제거

미러 모드에서는 포트포워딩이 필요 없습니다. Windows PowerShell (관리자 권한)에서 실행:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\darc0\projects\LIMEN\scripts\remove-portforward.ps1"
```

또는 수동으로:
```powershell
netsh interface portproxy delete v4tov4 listenport=18443 listenaddress=10.0.0.100
netsh interface portproxy delete v4tov4 listenport=9000 listenaddress=10.0.0.100
```

### 3. 백엔드 서비스 재시작

WSL에서 실행:
```bash
sudo systemctl stop limen-backend
sudo systemctl start limen-backend
sudo systemctl status limen-backend
```

### 4. 연결 테스트

Windows PowerShell에서 실행:
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\darc0\projects\LIMEN\scripts\test-mirror-mode.ps1"
```

### 5. 프론트엔드 설정 업데이트

프론트엔드에서 백엔드 주소를 `10.0.0.100:18443`로 직접 사용할 수 있습니다.

## 문제 해결

### 포트가 이미 사용 중인 경우

1. Windows에서 포트포워딩 제거 확인:
   ```powershell
   netsh interface portproxy show all
   ```

2. WSL에서 포트 사용 확인:
   ```bash
   ss -tuln | grep 18443
   ```

3. 백엔드 프로세스 확인:
   ```bash
   ps aux | grep server
   ```

### 연결이 안 되는 경우

1. Windows 방화벽 확인:
   ```powershell
   Get-NetFirewallRule -DisplayName "LIMEN*"
   ```

2. WSL IP 확인:
   ```bash
   hostname -I
   ```

3. 백엔드 바인딩 확인:
   - `.env` 파일에서 `BIND_ADDRESS=0.0.0.0` 확인
   - 백엔드가 모든 인터페이스에 바인딩되어야 함

## 장점

- 포트포워딩 불필요
- 더 간단한 네트워크 구성
- 직접적인 IP 접근 가능
- 성능 향상


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#네트워크-인프라` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 네트워크/인프라

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
