# 프론트엔드-백엔드 연결 문제 해결 보고서

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [연결 문제 해결](./CONNECTION_FIX_REPORT.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 프론트엔드가 제거된 백엔드 전용 구조입니다. 이 문서는 참고용으로 보관됩니다.

---

## 🔍 문제 분석

프론트엔드(10.0.0.10)에서 백엔드(10.0.0.110:18443)로의 연결이 실패하는 문제가 발생했습니다.

### 발견된 문제
- `ping: Destination Host Unreachable`
- `포트 연결: No route to host`
- `ARP 테이블: 10.0.0.110이 <incomplete>`

---

## ✅ 해결 조치

### 1. 방화벽 규칙 추가

```bash
# 백엔드 서버에서 실행
sudo ufw allow from 10.0.0.10 to 10.0.0.110 port 18443 proto tcp
sudo ufw allow from 10.0.0.10 proto icmp  # ping 허용
```

### 2. 네트워크 설정 확인

네트워크 인터페이스 및 라우팅 테이블 확인

---

## 관련 문서

- [네트워크 설정](./NETWORK_SETUP.md)
- [방화벽 설정](./FIREWALL_SETUP.md)
- [문제 해결](./TROUBLESHOOTING_CONNECTION.md)

---

**태그**: `#아카이브` `#Legacy` `#문제-해결` `#연결` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 문제 해결

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
