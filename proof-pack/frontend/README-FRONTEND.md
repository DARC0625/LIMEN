# 프론트엔드 Proof Pack 작성 가이드

> **프론트엔드 담당자용**: 이 문서는 프론트엔드 Proof Pack을 작성하는 방법을 안내합니다.

---

## 📍 문서 위치

프론트엔드 Proof Pack 문서는 다음 경로에 있습니다:

```
/home/darc0/LIMEN/proof-pack/frontend/PROOF-PACK-FRONTEND.md
```

또는 프로젝트 루트에서:

```
LIMEN/proof-pack/frontend/PROOF-PACK-FRONTEND.md
```

---

## 📝 작성 방법

### 1단계: 문서 열기

```bash
cd /home/darc0/LIMEN
code proof-pack/frontend/PROOF-PACK-FRONTEND.md
# 또는 원하는 에디터 사용
```

### 2단계: 검증 항목 추가

기존 템플릿을 참고하여 프론트엔드 검증 항목을 추가하세요.

**제출 형식**:
```markdown
### 항목명

**항목ID**: [항목ID] - PASS/FAIL/PARTIAL

**증거**:
- 스크린샷: `screenshots/항목명.png`
- 코드 위치: `frontend/lib/api/vm.ts:123`
- 브라우저 콘솔 로그:
  ```
  [로그 내용]
  ```
- API 응답:
  ```json
  {
    "code": 403,
    "message": "..."
  }
  ```

**비고**: 
- PASS: 구현 완료 설명
- FAIL: 원인 + 수정 계획 + ETA (예: 2026-01-12/15:00)
- PARTIAL: 현재 상태 + 추가 작업 + ETA
```

### 3단계: 증거 수집

#### 스크린샷 저장
```bash
# 스크린샷은 다음 폴더에 저장
proof-pack/frontend/screenshots/
```

#### 코드 위치 표시
```typescript
// frontend/lib/api/vm.ts:123
export async function createVM(data: CreateVMRequest) {
  try {
    const response = await api.post('/api/vms', data);
    return response.data;
  } catch (error) {
    // 에러 처리
    if (error.response?.status === 403) {
      // Beta access 거부 처리
    }
  }
}
```

#### 브라우저 개발자 도구
- Network 탭: API 응답 확인
- Console 탭: 에러 로그 확인
- Application 탭: 쿠키/로컬 스토리지 확인

---

## ✅ 검증 체크리스트

프론트엔드에서 확인해야 할 항목:

### 1. 에러 처리
- [ ] Beta access 거부 시 사용자에게 명확한 메시지 표시
- [ ] 세션 제한 초과 시 안내 메시지
- [ ] Rate limit 초과 시 재시도 안내
- [ ] 쿼터 초과 시 한도 정보 표시

### 2. UI/UX
- [ ] 에러 메시지가 사용자 친화적
- [ ] 로딩 상태 표시
- [ ] 성공/실패 피드백

### 3. 버전 정보
- [ ] 화면 하단 또는 설정 페이지에 버전 표시
- [ ] Git commit hash 또는 빌드 번호

### 4. 보안
- [ ] 브라우저에서 보안 헤더 확인
- [ ] HTTPS 강제 (HSTS)

### 5. WebSocket
- [ ] 콘솔 연결 안정성
- [ ] 연결 끊김 시 재연결 처리
- [ ] 타임아웃 알림

---

## 📸 스크린샷 가이드

### 저장 위치
```
proof-pack/frontend/screenshots/
```

### 파일명 규칙
```
[항목ID]-[설명].png
예: F1-beta-access-error.png
예: F2-session-timeout.png
```

### 캡처 항목
1. 에러 메시지 화면
2. 버전 정보 표시 화면
3. 브라우저 개발자 도구 (Network, Console)
4. 보안 헤더 (Response Headers)

---

## 🔍 증거 수집 예시

### 예시 1: Beta Access 거부 처리

**코드 위치**:
```typescript
// frontend/lib/api/vm.ts:50
if (error.response?.status === 403 && error.response?.data?.error_code === 'FORBIDDEN') {
  showError('Beta access required to create VMs. Please contact administrator.');
}
```

**스크린샷**: `screenshots/F1-beta-access-error.png`

**브라우저 콘솔**:
```
POST /api/vms 403 (Forbidden)
Response: {
  "code": 403,
  "message": "Beta access required to create VMs. Please contact administrator.",
  "error_code": "FORBIDDEN"
}
```

### 예시 2: 세션 타임아웃 알림

**코드 위치**:
```typescript
// frontend/components/VNCViewer.tsx:123
useEffect(() => {
  const timer = setTimeout(() => {
    showWarning('세션이 곧 만료됩니다. (15분 유휴)');
  }, 14 * 60 * 1000); // 14분 후 알림
  return () => clearTimeout(timer);
}, []);
```

**스크린샷**: `screenshots/F2-session-timeout.png`

---

## 📋 문서 작성 템플릿

```markdown
# LIMEN Frontend Proof Pack 제출서 - 2026-01-12

**제출일**: 2026-01-12  
**Commit Hash**: `[프론트엔드 commit hash]`  
**담당**: Frontend  
**검증자**: [프론트엔드 담당자명]

---

## F1. Beta Access 거부 에러 처리

**항목ID**: F1 - PASS

**증거**:
- 코드 위치: `frontend/lib/api/vm.ts:50`
- 스크린샷: `screenshots/F1-beta-access-error.png`
- 브라우저 콘솔 로그:
  ```
  POST /api/vms 403 (Forbidden)
  ```

**비고**: Beta access 거부 시 사용자에게 명확한 메시지 표시. 구현 완료.

---

## F2. 세션 타임아웃 알림

**항목ID**: F2 - PASS

**증거**:
- 코드 위치: `frontend/components/VNCViewer.tsx:123`
- 스크린샷: `screenshots/F2-session-timeout.png`

**비고**: 유휴 타임아웃 1분 전 알림 표시. 구현 완료.

---

[추가 항목...]
```

---

## 🚀 문서 제출

### 1. 문서 작성 완료 후

```bash
cd /home/darc0/LIMEN
git add proof-pack/frontend/
git commit -m "docs: 프론트엔드 Proof Pack 작성 완료"
git push
```

### 2. 검토 요청

- 백엔드 담당자에게 검토 요청
- 필요 시 수정 사항 반영

---

## ❓ FAQ

### Q: 스크린샷은 필수인가요?
A: 가능하면 제공하되, 코드 위치와 로그로도 증명 가능합니다.

### Q: FAIL 항목이 있으면 어떻게 하나요?
A: 원인 분석 후 수정 계획과 ETA를 명시하세요.

### Q: 백엔드 API 응답 형식은 어디서 확인하나요?
A: `proof-pack/backend/PROOF-PACK-BACKEND.md`의 "증거" 섹션을 참고하세요.

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-12





