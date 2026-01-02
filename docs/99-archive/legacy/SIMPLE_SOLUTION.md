# 가장 간단한 해결 방법

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [가장 간단한 해결 방법](./SIMPLE_SOLUTION.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 💡 아이디어

백엔드는 WSL에서 실행하되, 프론트엔드에서는 **Windows IP(10.0.0.100)**로 접근!

WSL은 Windows 호스트의 네트워크를 공유하므로, Windows IP로 접근하면 자동으로 WSL로 라우팅됩니다.

## ✅ 설정 방법

### 백엔드 (WSL)
- 현재 설정 그대로 유지
- `BIND_ADDRESS=0.0.0.0` (모든 인터페이스)
- 포트: `18443`

### 프론트엔드
```bash
# .env.production
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
NEXT_PUBLIC_API_URL=http://10.0.0.100:18443/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.100:9000
```

## 🔧 Windows에서 포트포워딩 설정 (필요시)

만약 Windows IP로 직접 접근이 안 되면, Windows에서 포트포워딩 설정:

```powershell
# Windows PowerShell (관리자 권한)
$wslIP = (wsl hostname -I).Trim().Split()[0]
netsh interface portproxy add v4tov4 listenport=18443 listenaddress=10.0.0.100 connectport=18443 connectaddress=$wslIP
New-NetFirewallRule -DisplayName "LIMEN Backend" -Direction Inbound -LocalPort 18443 -Protocol TCP -Action Allow
```

## ✅ 완료!

이제 프론트엔드에서 `http://10.0.0.100:18443`으로 접근하면 됩니다!

## 📋 체크리스트

- [x] 백엔드: `BIND_ADDRESS=0.0.0.0` 설정 완료
- [ ] 프론트엔드: `NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443` 설정
- [ ] Windows 포트포워딩 설정 (필요시)
- [ ] 프론트엔드에서 연결 테스트


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#문제-해결` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 문제 해결

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
