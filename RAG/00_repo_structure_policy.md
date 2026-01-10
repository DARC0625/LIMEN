# LIMEN Repository Structure & Server Boundary Policy

본 문서는 LIMEN monorepo의 **폴더 구조와 서버 소속 경계**를 명확히 정의하고,
이를 **사람이 아닌 코드(게이트/동기화 스크립트)**로 강제하기 위한
공식 정책 문서이다.

이 문서는 RAG에 저장되며, Edge/Backend 모든 서버에서 공통 참조된다.

---

## 1. 기본 원칙 (Non-Negotiable)

1. LIMEN은 **단일 Monorepo**를 사용한다.
2. **RAG = Docs** 이며, 모든 문서는 RAG 하위에만 존재한다.
3. Edge 서버와 Backend 서버는 **서로의 코드를 절대 보유하지 않는다.**
4. 이 정책은 문서로만 존재하지 않고, **sync 스크립트의 게이트로 집행된다.**

---

## 2. 서버 역할 정의

### Edge Server (Frontend / Boundary Node)
- 외부 트래픽 진입점
- 구성 요소:
  - Next.js Frontend
  - Envoy Reverse Proxy
- 특징:
  - 외부 노출
  - WebSocket(VNC) 종단
  - 보안/차단/제어의 1차 경계

### Backend Server (Internal Control Plane)
- 내부 API 및 가상화 제어
- 구성 요소:
  - API / Auth / RBAC
  - libvirt / KVM 제어
- 특징:
  - 내부 네트워크 전용
  - Edge 서버를 통해서만 접근 가능

---

## 3. 폴더별 서버 소속 정책

### 3.1 Edge 서버 전용 (EDGE ONLY)

| Folder | Description | Policy |
|------|------------|--------|
| `frontend/` | Next.js UI, noVNC UI, 브라우저 코드 | Backend 서버에 존재 ❌ |

---

### 3.2 Backend 서버 전용 (BACKEND ONLY)

| Folder | Description | Policy |
|------|------------|--------|
| `backend/` | API, Auth, RBAC, libvirt 제어 | Edge 서버에 존재 ❌ |

---

### 3.3 공통 폴더 (EDGE + BACKEND)

| Folder | Description | Policy |
|------|------------|--------|
| `RAG/` | 📌 문서 단일 진실 (Docs = RAG) | 반드시 양쪽 존재 |
| `config/` | 공통 설정 (Envoy 포함) | 허용 |
| `infra/` | 배포/운영 스크립트 | 허용 |
| `scripts/` | sync, gate, 운영 자동화 | 허용 |

---

### 3.4 서버 배포 금지 (DEV / CI ONLY)

| Folder | Description | Policy |
|------|------------|--------|
| `.github/` | GitHub Actions, CI 설정 | 서버 배포 ❌ |
| `.vscode/` | 개발 환경 설정 | 서버 배포 ❌ |

---

## 4. 구조 금지 규칙 (Hard Fail)

다음 조건 중 하나라도 만족하면 **즉시 실패(FATAL)** 해야 한다.

1. Edge 서버에 `backend/` 폴더가 존재하는 경우
2. Backend 서버에 `frontend/` 또는 `apps/edge/` 폴더가 존재하는 경우
3. 레포 루트에 `src/` 폴더가 존재하는 경우  
   - 모든 코드는 `frontend/src` 또는 `backend/src` 하위에만 존재해야 한다.

위 규칙은 **sync 스크립트 및 게이트 코드로 강제**된다.

---

## 5. 집행 방식

- 본 정책은 다음 위치의 코드에 의해 집행된다:
  - `scripts/sync-edge.sh`
  - `scripts/sync-backend.sh`
- 정책 위반 시:
  - 로그에 `[FATAL][POLICY]` 메시지 출력
  - 즉시 동기화 중단
  - 서비스 재시작 금지

---

## 6. 정책 변경 절차

1. 본 문서(RAG)를 먼저 수정한다.
2. 그에 맞춰 sync/gate 스크립트를 수정한다.
3. 문서와 코드가 불일치하는 상태는 **허용되지 않는다.**

---

## 7. 요약

- LIMEN은 **구조를 문서가 아니라 코드로 강제하는 시스템**이다.
- 이 문서는 그 구조의 **최종 기준선(Source of Truth)** 이다.
