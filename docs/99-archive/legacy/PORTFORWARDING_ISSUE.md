# Port Forwarding Issue Analysis

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [Port Forwarding Issue Analysis](./PORTFORWARDING_ISSUE.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## Problem
Windows에서 `10.0.0.100:18443`로 접근 시 타임아웃 발생

## Diagnostic Results

### ✅ Working
- Port forwarding configured: `10.0.0.100:18443 → 172.19.242.230:18443`
- Firewall rules: Active (but duplicated)
- Port listening: `::1:18443` (IPv6 localhost)

### ❌ Not Working
- Windows local access: `127.0.0.1:18443` - Timeout
- Windows port forwarding: `10.0.0.100:18443` - Timeout

## Root Cause Analysis

1. **Port forwarding is IPv4, but Windows shows IPv6 listening**
   - Windows shows `::1:18443` (IPv6) listening
   - Port forwarding is configured for IPv4
   - This mismatch may cause issues

2. **Backend is running in WSL, not on Windows**
   - `127.0.0.1:18443` won't work from Windows because backend is in WSL
   - Need to use port forwarding or direct WSL IP

3. **Port forwarding may not be working correctly**
   - Even though configured, connection times out
   - May need to reset or check Windows firewall

## Solution

### Step 1: Run Fix Script
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\darc0\projects\LIMEN\scripts\fix-portforward.ps1"
```

### Step 2: Manual Fix (if script doesn't work)

#### A. Reset Port Forwarding
```powershell
# Get WSL IP
$wslIP = (wsl hostname -I).Trim().Split()[0]

# Delete old rules
netsh interface portproxy delete v4tov4 listenport=18443 listenaddress=10.0.0.100
netsh interface portproxy delete v4tov4 listenport=9000 listenaddress=10.0.0.100

# Add new rules
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
netsh interface portproxy add v4tov4 listenport=9000 listenaddress=10.0.0.100 connectport=9000 connectaddress=$wslIP
```

#### B. Clean Up Firewall Rules
```powershell
# Remove duplicates
Remove-NetFirewallRule -DisplayName "LIMEN Backend" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LIMEN Agent" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LIMEN Backend 18443" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LIMEN Agent 9000" -ErrorAction SilentlyContinue

# Add clean rules
New-NetFirewallRule -DisplayName "LIMEN Backend 18443" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "LIMEN Agent 9000" -Direction Inbound -LocalPort 9000 -Protocol TCP -Action Allow -Profile Any
```

#### C. Test Direct WSL IP Access
```powershell
# Test if Windows can reach WSL directly
$wslIP = (wsl hostname -I).Trim().Split()[0]
Invoke-WebRequest -Uri "http://$wslIP:18443/api/health" -UseBasicParsing
```

If this works but port forwarding doesn't, the issue is with port forwarding configuration.

#### D. Test Port Forwarding
```powershell
Invoke-WebRequest -Uri "http://10.0.0.100:18443/api/health" -UseBasicParsing
```

## Alternative Solution: Use WSL Mirror Mode

If port forwarding continues to fail, use WSL mirror mode:

1. Edit `C:\Users\YourUsername\.wslconfig`:
```ini
[wsl2]
networkingMode=mirrored
```

2. Restart WSL:
```powershell
wsl --shutdown
wsl
```

3. Update frontend to use `10.0.0.100:18443` directly (no port forwarding needed)

## Verification

After fixing, verify:

1. **From Windows:**
   ```powershell
   Invoke-WebRequest -Uri "http://10.0.0.100:18443/api/health" -UseBasicParsing
   ```

2. **From Frontend:**
   ```bash
   curl http://10.0.0.100:18443/api/health
   ```

3. **From WSL:**
   ```bash
   curl http://127.0.0.1:18443/api/health
   ```

## Expected Results

- ✅ Windows → `10.0.0.100:18443`: Success
- ✅ Frontend → `10.0.0.100:18443`: Success
- ✅ WSL → `127.0.0.1:18443`: Success


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#설정` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 설정

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
