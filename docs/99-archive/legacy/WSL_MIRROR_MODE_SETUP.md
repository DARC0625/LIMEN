# WSL 미러 모드 설정 (Windows 네트워크 직접 사용)

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [WSL 미러 모드 설정 (Windows 네트워크 직접 사용)](./WSL_MIRROR_MODE_SETUP.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 🎯 목표

WSL을 Windows 네트워크에 직접 연결하여, 프론트엔드에서 Windows IP(10.0.0.100)로 직접 접근 가능하게 합니다.

## ✅ 설정 방법

### 1단계: Windows에서 `.wslconfig` 파일 생성/수정

`C:\Users\<사용자명>\.wslconfig` 파일을 생성하거나 수정:

```ini
[wsl2]
networkingMode=mirrored
```

### 2단계: WSL 재시작

```powershell
# Windows PowerShell에서
wsl --shutdown
wsl
```

### 3단계: 백엔드 바인딩 주소 확인

WSL 재시작 후, 백엔드가 Windows 네트워크에 접근 가능한지 확인:

```bash
# WSL에서
ip addr show eth0
# Windows IP(10.0.0.100)와 같은 네트워크에 있어야 함
```

### 4단계: 백엔드 서버 재시작

```bash
sudo systemctl restart limen-backend
```

### 5단계: 프론트엔드 설정

프론트엔드에서 Windows IP로 접근:

```bash
# .env.production
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
NEXT_PUBLIC_API_URL=http://10.0.0.100:18443/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.100:9000
```

## 🔧 대안: 백엔드를 0.0.0.0에 바인딩

미러 모드가 작동하지 않는 경우, 백엔드를 모든 인터페이스에 바인딩:

```bash
# .env 파일 수정
BIND_ADDRESS=0.0.0.0
```

그리고 Windows 방화벽에서 WSL로의 포트포워딩:

```powershell
$wslIP = (wsl hostname -I).Trim().Split()[0]
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
```

## ⚠️ 주의사항

1. **미러 모드는 실험적 기능**: WSL2의 미러 모드는 아직 실험적이므로 안정성 문제가 있을 수 있습니다.

2. **방화벽 설정**: Windows 방화벽에서 WSL 트래픽을 허용해야 합니다.

3. **네트워크 변경**: 미러 모드로 변경하면 기존 네트워크 설정이 변경될 수 있습니다.

## 📋 확인 방법

```bash
# WSL에서
ip addr show eth0
# Windows와 같은 네트워크에 있는지 확인

# 프론트엔드에서
ping 10.0.0.100
curl http://10.0.0.100:18443/api/health
```

## 🔄 되돌리기

미러 모드를 비활성화하려면:

```ini
# .wslconfig
[wsl2]
# networkingMode=mirrored  # 주석 처리
```

WSL 재시작:
```powershell
wsl --shutdown
wsl
```


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#네트워크-인프라` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 네트워크/인프라

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
