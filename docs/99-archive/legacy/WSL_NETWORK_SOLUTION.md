# WSL 네트워크 연결 문제 해결

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [WSL 네트워크 연결 문제 해결](./WSL_NETWORK_SOLUTION.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 🔍 문제 분석

프론트엔드(10.0.0.10)에서 백엔드(10.0.0.110)로의 연결이 실패하는 문제입니다.

### 증상
- `ping: Destination Host Unreachable`
- `포트 연결: No route to host`
- `ARP 테이블: INCOMPLETE`

### 원인
**WSL2는 기본적으로 NAT 네트워크를 사용**하므로, 다른 호스트에서 WSL 내부 IP로 직접 접근할 수 없습니다.

## ✅ 해결 방법

### 방법 1: Windows 포트포워딩 (권장) ⭐

Windows 호스트(10.0.0.100)를 통해 포트포워딩을 설정합니다.

#### Windows PowerShell에서 실행 (관리자 권한)

```powershell
# WSL IP 확인
$wslIP = (wsl hostname -I).Trim()

# 포트포워딩 설정
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP

# 방화벽 규칙 추가
New-NetFirewallRule -DisplayName "LIMEN Backend WSL" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow
```

또는 자동 스크립트 사용:
```powershell
cd C:\path\to\LIMEN
.\scripts\wsl-windows-port-forward.ps1
```

#### 프론트엔드 설정 변경

프론트엔드 환경 변수를 Windows IP로 변경:
```bash
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
```

### 방법 2: WSL 네트워크 모드 변경 (고급)

WSL2를 미러 모드로 변경하여 직접 접근 가능하게 합니다.

#### Windows에서 `.wslconfig` 파일 생성/수정

`C:\Users\<사용자명>\.wslconfig`:
```ini
[wsl2]
networkingMode=mirrored
```

WSL 재시작:
```powershell
wsl --shutdown
wsl
```

### 방법 3: 프론트엔드에서 Windows IP 직접 사용

Windows 호스트가 10.0.0.100이고 포트포워딩이 설정된 경우:

```bash
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
```

## 🔧 현재 상태 확인

### 백엔드 서버(WSL)에서 확인

```bash
# IP 주소 확인
ip addr show eth0 | grep "inet "

# 포트 리스닝 확인
ss -tuln | grep 18443

# 서버 상태 확인
sudo systemctl status limen-backend
```

### Windows에서 확인

```powershell
# 포트포워딩 확인
netsh interface portproxy show all

# 방화벽 규칙 확인
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*LIMEN*"}
```

## 📋 단계별 해결 가이드

### 1단계: Windows 포트포워딩 설정

```powershell
# 관리자 권한 PowerShell
$wslIP = (wsl hostname -I).Trim()
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
New-NetFirewallRule -DisplayName "LIMEN Backend" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow
```

### 2단계: 프론트엔드 설정 변경

```bash
# .env.production
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
```

### 3단계: 연결 테스트

```bash
# 프론트엔드에서
curl http://10.0.0.100:18443/api/health
```

## ⚠️ 주의사항

1. **WSL IP 변경**: WSL 재시작 시 IP가 변경될 수 있으므로, 포트포워딩 스크립트를 자동화하는 것을 권장합니다.

2. **방화벽**: Windows 방화벽과 WSL 방화벽 모두 확인해야 합니다.

3. **네트워크 모드**: 미러 모드는 실험적 기능이므로 주의가 필요합니다.

## 🔄 자동화 스크립트

Windows 시작 시 자동으로 포트포워딩을 설정하려면:

1. `wsl-port-forward.ps1` 스크립트 생성
2. 작업 스케줄러에 등록
3. Windows 시작 시 실행되도록 설정

## 📞 문제 해결

여전히 연결이 안 되면:

1. **WSL IP 확인:**
   ```bash
   wsl hostname -I
   ```

2. **포트포워딩 확인:**
   ```powershell
   netsh interface portproxy show all
   ```

3. **방화벽 확인:**
   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*LIMEN*"}
   ```

4. **WSL 네트워크 확인:**
   ```bash
   ip route show
   ip addr show eth0
   ```


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#네트워크-인프라` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 네트워크/인프라

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
