# WSL2 네트워크 설정 가이드 - 10.0.0.100 고정 IP

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [WSL2 네트워크 설정 가이드 - 10.0.0.100 고정 IP](./WSL_NETWORK_SETUP.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

WSL2가 직접 `10.0.0.100` IP를 사용하도록 설정하는 방법입니다.

## 문제점

WSL2는 기본적으로 NAT 네트워크를 사용하므로:
- WSL 내부 IP는 동적으로 할당됨 (예: 172.x.x.x)
- Windows 호스트 IP와는 별개
- 포트 바인딩 시 충돌 가능

## 해결 방법

### 방법 1: WSL2 브리지 모드 설정 (권장)

WSL2를 브리지 모드로 설정하여 Windows 호스트와 동일한 네트워크 세그먼트에 연결합니다.

#### 1. Windows에서 PowerShell 관리자 권한으로 실행

```powershell
# WSL2 네트워크 어댑터 확인
Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*WSL*"}

# WSL2 브리지 모드 설정
# 참고: WSL2는 기본적으로 Hyper-V 가상 스위치를 사용하므로
# 직접 브리지 모드는 제한적입니다.
```

#### 2. WSL2 고정 IP 설정 (대안)

WSL2 내부에서 고정 IP를 설정하고, Windows에서 포트 포워딩을 설정합니다.

**WSL2 내부 설정:**

```bash
# /etc/netplan/01-wsl2-static.yaml 생성
sudo nano /etc/netplan/01-wsl2-static.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses:
        - 10.0.0.100/24
      routes:
        - to: default
          via: 10.0.0.1
      nameservers:
        addresses:
          - 10.0.0.5
          - 8.8.8.8
```

```bash
# 적용
sudo netplan apply
```

**Windows에서 포트 포워딩 설정:**

```powershell
# PowerShell 관리자 권한으로 실행
# WSL2 IP 확인 (동적이므로 스크립트 필요)
$wslIP = (wsl hostname -I).Trim()

# 포트 포워딩 설정 (18443 포트)
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
```

### 방법 2: Windows 호스트 IP 사용 (현재 방식)

Windows 호스트가 이미 `10.0.0.100`으로 설정되어 있다면, WSL에서 Windows 호스트를 통해 접근합니다.

**장점:**
- 설정이 간단함
- Windows 방화벽 규칙 재사용 가능

**단점:**
- WSL 내부에서 직접 IP 바인딩 불가
- 포트 포워딩 필요

### 방법 3: WSL2 네트워크 모드 변경 (고급)

WSL2의 네트워크 모드를 변경하려면 `.wslconfig` 파일을 수정합니다.

**Windows에서 `%USERPROFILE%\.wslconfig` 생성:**

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=true
firewall=true
autoProxy=true
```

이 설정은 WSL2를 Windows 호스트와 동일한 네트워크 스택을 공유하도록 합니다.

## 권장 설정 (현재 환경)

현재 Windows 호스트가 이미 `10.0.0.100`으로 설정되어 있으므로, 다음 방법을 권장합니다:

### 1. WSL2에서 Windows 호스트 IP로 바인딩

백엔드 서버를 `0.0.0.0`으로 바인딩하면 WSL 내부와 Windows 호스트 모두에서 접근 가능합니다.

```bash
# backend/.env
BIND_ADDRESS=0.0.0.0
PORT=18443
```

### 2. Windows 방화벽 규칙 설정

Windows 방화벽에서 WSL2로의 포트 포워딩을 허용합니다.

```powershell
# PowerShell 관리자 권한
New-NetFirewallRule -DisplayName "LIMEN Backend" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow
```

### 3. WSL2 내부 IP 확인 및 포트 포워딩

```powershell
# WSL2 IP 확인
wsl hostname -I

# 포트 포워딩 (WSL2 IP가 동적으로 변경되므로 스크립트 필요)
$wslIP = (wsl hostname -I).Trim()
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
```

## 자동화 스크립트

### Windows PowerShell 스크립트

`scripts/wsl-port-forward.ps1` 생성:

```powershell
# WSL2 포트 포워딩 자동 설정
$wslIP = (wsl hostname -I).Trim()
$port = 18443

Write-Host "WSL2 IP: $wslIP"
Write-Host "Setting up port forwarding: 10.0.0.100:$port -> $wslIP:$port"

# 기존 규칙 삭제
netsh interface portproxy delete v4tov4 listenport=$port listenaddress=10.0.0.100 2>$null

# 새 규칙 추가
netsh interface portproxy add v4tov4 listenport=$port listenaddress=10.0.0.100 connectport=$port connectaddress=$wslIP

Write-Host "Port forwarding configured successfully"
```

### WSL2 시작 시 자동 실행

Windows 작업 스케줄러에 등록하거나, WSL2 시작 스크립트에 포함:

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
if [ -z "$WSL_PORT_FORWARDED" ]; then
    export WSL_PORT_FORWARDED=1
    # Windows에서 포트 포워딩 설정 (PowerShell 실행)
    powershell.exe -File /mnt/c/path/to/wsl-port-forward.ps1
fi
```

## 문제 해결

### WSL이 꺼지는 문제

포트 바인딩 시 WSL이 종료되는 경우:

1. **포트 충돌 확인:**
   ```bash
   ss -tuln | grep 18443
   ```

2. **권한 문제 확인:**
   ```bash
   # 포트 1024 이하는 sudo 필요
   # 18443은 1024 이상이므로 일반 사용자로 실행 가능
   ```

3. **네트워크 인터페이스 확인:**
   ```bash
   ip addr show
   ```

4. **WSL 로그 확인:**
   ```powershell
   # Windows PowerShell
   Get-EventLog -LogName Application -Source "WSL" -Newest 10
   ```

### IP 할당 실패

```bash
# 네트워크 인터페이스 재시작
sudo ip link set eth0 down
sudo ip link set eth0 up

# 또는 netplan 재적용
sudo netplan apply
```

## 참고

- [WSL2 네트워크 문서](https://docs.microsoft.com/en-us/windows/wsl/networking)
- [WSL2 고급 설정](https://docs.microsoft.com/en-us/windows/wsl/wsl-config)


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#네트워크-인프라` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 네트워크/인프라

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
