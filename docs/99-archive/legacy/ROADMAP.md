# LIMEN 프로젝트 발전 로드맵

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [로드맵](./ROADMAP.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 최신 로드맵은 [아키텍처 로드맵](../../01-architecture/roadmap.md)을 참조하세요.

---

## 🎯 현재 상태

### ✅ 완료된 기능

- VM 생성/삭제/제어 (libvirt/KVM)
- 웹 기반 VNC 콘솔 (noVNC)
- 실시간 상태 모니터링 (WebSocket)
- 동적 리소스 조정 (CPU/Memory)
- 에이전트 기반 메트릭 수집 (Rust)
- ISO 기반 OS 설치
- 사용자 관리 시스템 (JWT 인증)
- VM 스냅샷 관리
- 리소스 할당량 관리
- UUID 기반 식별

---

## 📊 기술 스택

- **Frontend**: Next.js 16 + React 19
- **Backend**: Go 1.24 + Gorilla Mux
- **Database**: PostgreSQL + GORM

---

## 관련 문서

- [아키텍처 로드맵](../../01-architecture/roadmap.md)
- [향후 개선 사항](./FUTURE_IMPROVEMENTS.md)

---

**태그**: `#아카이브` `#Legacy` `#로드맵` `#계획` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 계획

**상태**: 과거 기록 (최신 로드맵 참조 권장)

**마지막 업데이트**: 2024-12-23
