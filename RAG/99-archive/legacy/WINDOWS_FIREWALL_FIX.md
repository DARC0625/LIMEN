# Windows 방화벽 설정 가이드

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [Windows 방화벽 설정 가이드](./WINDOWS_FIREWALL_FIX.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 문제
프론트엔드에서 `10.0.0.100:18443`로 접근할 수 없습니다.
포트포워딩은 설정되어 있지만, Windows 방화벽이 연결을 차단하고 있습니다.

## 해결 방법

### 방법 1: PowerShell 스크립트 실행 (권장)

**Windows PowerShell을 관리자 권한으로 실행**하고 다음 명령 실행:

```powershell
cd C:\Users\YourUsername\projects\LIMEN
.\scripts\windows-firewall-setup.ps1
```

또는 직접 명령어 실행:

```powershell
# Backend 포트 18443
New-NetFirewallRule -DisplayName "LIMEN Backend 18443" `
    -Direction Inbound `
    -LocalPort 18443 `
    -Protocol TCP `
    -Action Allow `
    -Profile Any

# Agent 포트 9000
New-NetFirewallRule -DisplayName "LIMEN Agent 9000" `
    -Direction Inbound `
    -LocalPort 9000 `
    -Protocol TCP `
    -Action Allow `
    -Profile Any
```

### 방법 2: Windows 방화벽 GUI에서 설정

1. **Windows 보안** → **방화벽 및 네트워크 보호** 열기
2. **고급 설정** 클릭
3. **인바운드 규칙** → **새 규칙** 클릭
4. **포트** 선택 → **다음**
5. **TCP** 선택, **특정 로컬 포트**: `18443` 입력 → **다음**
6. **연결 허용** 선택 → **다음**
7. 모든 프로필 체크 → **다음**
8. 이름: `LIMEN Backend 18443` → **마침**
9. 동일한 방법으로 `9000` 포트도 추가

### 방법 3: netsh 명령어 (대안)

```cmd
netsh advfirewall firewall add rule name="LIMEN Backend 18443" dir=in action=allow protocol=TCP localport=18443
netsh advfirewall firewall add rule name="LIMEN Agent 9000" dir=in action=allow protocol=TCP localport=9000
```

## 확인

### 포트포워딩 확인
```powershell
netsh interface portproxy show all
```

예상 출력:
```
ipv4 수신 대기:             ipv4에 연결:
주소            포트        주소            포트
--------------- ----------  --------------- ----------
10.0.0.100      18443       172.19.242.230  18443
10.0.0.100      9000        172.19.242.230  9000
```

### 방화벽 규칙 확인
```powershell
Get-NetFirewallRule -DisplayName "LIMEN*" | Format-Table DisplayName, Enabled, Direction, Action
```

### 프론트엔드에서 테스트
```bash
curl http://10.0.0.100:18443/api/health
```

## 문제 해결

### 여전히 연결이 안 되면

1. **Windows 방화벽이 활성화되어 있는지 확인**
   ```powershell
   Get-NetFirewallProfile | Format-Table Name, Enabled
   ```

2. **포트포워딩이 제대로 작동하는지 확인**
   - Windows에서 `curl http://127.0.0.1:18443/api/health` 테스트
   - WSL에서 `curl http://172.19.242.230:18443/api/health` 테스트

3. **백엔드 서버가 실행 중인지 확인**
   ```bash
   # WSL에서
   sudo systemctl status limen-backend
   ```

4. **네트워크 어댑터 확인**
   - Windows에서 `ipconfig` 실행
   - `10.0.0.100` IP가 올바른 어댑터에 할당되어 있는지 확인

## 최종 체크리스트

- [ ] Windows 방화벽 인바운드 규칙 추가 (18443, 9000)
- [ ] 포트포워딩 설정 확인
- [ ] 백엔드 서버 실행 중
- [ ] 프론트엔드에서 연결 테스트 성공


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#문제-해결` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 문제 해결

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
