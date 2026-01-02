# 연결 타임아웃 빠른 해결 방법

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [연결 타임아웃 빠른 해결 방법](./QUICK_FIX_TIMEOUT.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 문제
프론트엔드에서 `curl http://10.0.0.100:18443/api/health` 실행 시 타임아웃 발생

## 원인
WSL2는 기본적으로 NAT 네트워크를 사용하므로, 외부에서 WSL 내부 IP로 직접 접근할 수 없습니다.
포트포워딩을 설정했지만 Windows 방화벽이 차단하고 있을 가능성이 높습니다.

## 빠른 해결 방법

### 방법 1: Windows 방화벽 규칙 추가 (가장 중요!)

**Windows PowerShell (관리자 권한)**에서 실행:

```powershell
# 즉시 실행
New-NetFirewallRule -DisplayName "LIMEN Backend 18443" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "LIMEN Agent 9000" -Direction Inbound -LocalPort 9000 -Protocol TCP -Action Allow -Profile Any
```

### 방법 2: Windows 방화벽 일시적으로 비활성화 (테스트용)

**주의: 보안상 위험하므로 테스트 후 다시 활성화하세요!**

```powershell
# 비활성화 (테스트용)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# 테스트 후 다시 활성화
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

### 방법 3: 포트포워딩 재설정

```powershell
# 기존 규칙 삭제
netsh interface portproxy delete v4tov4 listenport=18443 listenaddress=10.0.0.100
netsh interface portproxy delete v4tov4 listenport=9000 listenaddress=10.0.0.100

# WSL IP 확인
$wslIP = (wsl hostname -I).Trim().Split()[0]
Write-Host "WSL IP: $wslIP"

# 포트포워딩 재설정
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
netsh interface portproxy add v4tov4 listenport=9000 listenaddress=10.0.0.100 connectport=9000 connectaddress=$wslIP

# 확인
netsh interface portproxy show all
```

## 확인 방법

### Windows에서 테스트
```powershell
# Windows PowerShell에서
Test-NetConnection -ComputerName 10.0.0.100 -Port 18443
```

### 프론트엔드에서 빠른 테스트
```bash
# 타임아웃을 2초로 제한
curl --max-time 2 http://10.0.0.100:18443/api/health
```

## 근본 해결책

### WSL 미러 모드 사용 (영구 해결)

Windows의 `.wslconfig` 파일에 추가:

```ini
[wsl2]
networkingMode=mirrored
```

위치: `C:\Users\YourUsername\.wslconfig`

설정 후 WSL 재시작:
```powershell
wsl --shutdown
wsl
```

이렇게 하면 WSL이 Windows와 동일한 네트워크 인터페이스를 사용하여 직접 접근이 가능합니다.

## 체크리스트

- [ ] Windows 방화벽 인바운드 규칙 추가 (18443, 9000)
- [ ] 포트포워딩 재설정
- [ ] Windows에서 연결 테스트
- [ ] 프론트엔드에서 연결 테스트
- [ ] (선택) WSL 미러 모드 설정


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#문제-해결` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 문제 해결

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
