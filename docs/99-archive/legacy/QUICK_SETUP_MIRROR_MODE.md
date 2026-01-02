# WSL 미러 모드 빠른 설정 가이드

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [WSL 미러 모드 빠른 설정 가이드](./QUICK_SETUP_MIRROR_MODE.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 🎯 목표

프론트엔드에서 Windows IP(10.0.0.100)로 직접 접근 가능하게 설정

## ✅ 단계별 설정

### 1단계: Windows에서 `.wslconfig` 파일 생성

`C:\Users\<사용자명>\.wslconfig` 파일 생성/수정:

```ini
[wsl2]
networkingMode=mirrored
```

또는 PowerShell 스크립트 실행:
```powershell
.\scripts\setup_wsl_mirror_mode.ps1
```

### 2단계: WSL 재시작

```powershell
wsl --shutdown
wsl
```

### 3단계: 백엔드 바인딩 주소 변경 (선택사항)

미러 모드에서는 `0.0.0.0`에 바인딩하거나 현재 설정 유지:

```bash
# WSL에서
cd /home/darc0/projects/LIMEN/backend

# 옵션 1: 0.0.0.0에 바인딩 (모든 인터페이스)
echo "BIND_ADDRESS=0.0.0.0" >> .env

# 옵션 2: 현재 설정 유지 (10.0.0.110)
# 이미 *:18443으로 리스닝 중이므로 변경 불필요
```

### 4단계: 백엔드 서버 재시작

```bash
sudo systemctl restart limen-backend
```

### 5단계: 프론트엔드 설정

프론트엔드 서버(`10.0.0.10`)에서:

```bash
# .env.production
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
NEXT_PUBLIC_API_URL=http://10.0.0.100:18443/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.100:9000
```

### 6단계: 연결 테스트

```bash
# 프론트엔드에서
curl http://10.0.0.100:18443/api/health
```

## ✅ 완료!

이제 프론트엔드에서 Windows IP(10.0.0.100)로 직접 접근할 수 있습니다.

## 🔧 문제 해결

### 미러 모드가 작동하지 않는 경우

1. **WSL 버전 확인:**
   ```powershell
   wsl --version
   # WSL 2.0.0 이상 필요
   ```

2. **Windows 방화벽 확인:**
   ```powershell
   New-NetFirewallRule -DisplayName "LIMEN Backend" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow
   ```

3. **백엔드를 0.0.0.0에 바인딩:**
   ```bash
   # WSL에서
   echo "BIND_ADDRESS=0.0.0.0" > /home/darc0/projects/LIMEN/backend/.env
   sudo systemctl restart limen-backend
   ```


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#네트워크-인프라` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 네트워크/인프라

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
