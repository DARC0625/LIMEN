# 연결 문제 상세 진단 가이드

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [연결 문제 상세 진단 가이드](./TROUBLESHOOTING_CONNECTION.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 현재 상황
- Windows 방화벽 규칙: ✅ 활성화됨
- 포트포워딩: 설정됨
- 연결: ❌ 여전히 실패

## 가능한 원인

### 1. 포트포워딩 설정 불일치
포트포워딩이 WSL IP와 일치하지 않을 수 있습니다.

**확인 방법:**
```powershell
# Windows PowerShell에서
netsh interface portproxy show all
```

**재설정:**
```powershell
# WSL IP 확인
$wslIP = (wsl hostname -I).Trim().Split()[0]
Write-Host "WSL IP: $wslIP"

# 기존 규칙 삭제
netsh interface portproxy delete v4tov4 listenport=18443 listenaddress=10.0.0.100
netsh interface portproxy delete v4tov4 listenport=9000 listenaddress=10.0.0.100

# 새 규칙 추가
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
netsh interface portproxy add v4tov4 listenport=9000 listenaddress=10.0.0.100 connectport=9000 connectaddress=$wslIP
```

### 2. Windows 방화벽 프로필 문제
방화벽 규칙이 특정 프로필에서만 활성화되어 있을 수 있습니다.

**확인:**
```powershell
Get-NetFirewallRule -DisplayName "LIMEN*" | Format-Table DisplayName, Enabled, Profile
```

**모든 프로필에서 허용:**
```powershell
Get-NetFirewallRule -DisplayName "LIMEN*" | Set-NetFirewallRule -Profile Domain,Private,Public
```

### 3. Windows 방화벽 규칙 중복
중복된 규칙이 충돌할 수 있습니다.

**정리:**
```powershell
# 기존 규칙 삭제
Remove-NetFirewallRule -DisplayName "LIMEN Backend"
Remove-NetFirewallRule -DisplayName "LIMEN Agent"
Remove-NetFirewallRule -DisplayName "LIMEN Backend 18443"
Remove-NetFirewallRule -DisplayName "LIMEN Agent 9000"

# 새로 추가 (하나씩만)
New-NetFirewallRule -DisplayName "LIMEN Backend 18443" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "LIMEN Agent 9000" -Direction Inbound -LocalPort 9000 -Protocol TCP -Action Allow -Profile Any
```

### 4. Windows 방화벽 고급 설정 확인
고급 설정에서 차단되어 있을 수 있습니다.

**확인:**
1. Windows 보안 → 방화벽 및 네트워크 보호
2. 고급 설정
3. 인바운드 규칙에서 "LIMEN" 검색
4. 모든 규칙이 "활성화" 상태인지 확인

### 5. 다른 보안 소프트웨어
Windows Defender 외의 보안 소프트웨어가 차단할 수 있습니다.

**확인:**
- Windows Defender 방화벽만 사용 중인지 확인
- 다른 방화벽/보안 소프트웨어가 실행 중인지 확인

### 6. 네트워크 어댑터 바인딩
Windows가 10.0.0.100을 올바른 네트워크 어댑터에 바인딩하지 않을 수 있습니다.

**확인:**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "10.0.0.*" } | Format-Table IPAddress, InterfaceAlias, InterfaceIndex
```

### 7. 백엔드 서버 상태
백엔드가 실제로 실행 중인지 확인.

**WSL에서 확인:**
```bash
sudo systemctl status limen-backend
ss -tuln | grep 18443
curl http://127.0.0.1:18443/api/health
```

## 단계별 해결 방법

### Step 1: 진단 스크립트 실행
```powershell
# Windows PowerShell (관리자 권한)
cd C:\Users\YourUsername\projects\LIMEN
.\scripts\check-portforward.ps1
```

### Step 2: 포트포워딩 재설정
위의 "포트포워딩 설정 불일치" 섹션 참조

### Step 3: 방화벽 규칙 정리 및 재설정
위의 "방화벽 규칙 중복" 섹션 참조

### Step 4: Windows에서 직접 테스트
```powershell
# Windows PowerShell에서
Test-NetConnection -ComputerName 10.0.0.100 -Port 18443
Invoke-WebRequest -Uri "http://10.0.0.100:18443/api/health" -UseBasicParsing
```

### Step 5: 프론트엔드에서 테스트
```bash
# 프론트엔드 서버에서
curl --max-time 2 http://10.0.0.100:18443/api/health
```

## 대안: WSL 미러 모드 사용

포트포워딩 문제를 완전히 우회하려면 WSL 미러 모드를 사용하세요.

**Windows `.wslconfig` 파일:**
```ini
[wsl2]
networkingMode=mirrored
```

위치: `C:\Users\YourUsername\.wslconfig`

설정 후:
```powershell
wsl --shutdown
wsl
```

이렇게 하면 WSL이 Windows와 동일한 네트워크 인터페이스를 사용하여 포트포워딩 없이 직접 접근 가능합니다.


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#문제-해결` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 문제 해결

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
