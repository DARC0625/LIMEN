# LIMEN Proof Pack 문서 관리

**생성일**: 2026-01-12  
**목적**: 2026-01-12 런칭 생존성 작업 검증 문서 관리

---

## 폴더 구조

```
proof-pack/
├── README.md                    # 이 파일 (폴더 구조 및 사용 가이드)
├── STRUCTURE.md                 # 폴더 구조 상세 설명
├── QUICK-START-FRONTEND.md      # 프론트엔드 빠른 시작 가이드
├── PROOF-PACK.md                # 전체 Proof Pack 문서 (상세 버전)
├── PROOF-PACK-SUBMISSION.md     # 전체 Proof Pack 제출서 (통합 버전)
├── backend/
│   ├── PROOF-PACK-BACKEND.md   # 백엔드 Proof Pack 제출서
│   └── screenshots/            # 백엔드 스크린샷 저장 폴더
└── frontend/
    ├── PROOF-PACK-FRONTEND.md  # 프론트엔드 Proof Pack 제출서 (템플릿)
    ├── README-FRONTEND.md      # 프론트엔드 상세 작성 가이드
    └── screenshots/            # 프론트엔드 스크린샷 저장 폴더
```

---

## 문서 설명

### 백엔드 Proof Pack (`backend/PROOF-PACK-BACKEND.md`)
- **담당**: Backend 팀
- **내용**: 백엔드 생존성 작업 검증 항목 (A, B, C 섹션)
- **상태**: 완료 (25/30 항목 PASS, 4개 FAIL, 1개 PARTIAL)

### 프론트엔드 Proof Pack (`frontend/PROOF-PACK-FRONTEND.md`)
- **담당**: Frontend 팀
- **내용**: 프론트엔드 관련 검증 항목 (템플릿)
- **상태**: 프론트엔드 담당자가 작성 필요

---

## 프론트엔드 담당자 가이드

### 1. 문서 위치
프론트엔드 Proof Pack 문서는 다음 경로에 있습니다:
```
/home/darc0/LIMEN/proof-pack/frontend/PROOF-PACK-FRONTEND.md
```

또는 상대 경로:
```
LIMEN/proof-pack/frontend/PROOF-PACK-FRONTEND.md
```

### 2. 문서 작성 방법

#### 2-1. 기존 템플릿 수정
`frontend/PROOF-PACK-FRONTEND.md` 파일을 열어서 프론트엔드 검증 항목을 추가하세요.

#### 2-2. 제출 형식
각 항목을 다음 형식으로 작성하세요:

```markdown
### 항목명

**항목ID**: [항목ID] - PASS/FAIL/PARTIAL

**증거**:
- 스크린샷 링크 또는 파일 경로
- 코드 위치 (파일 경로:라인 번호)
- 로그 일부 또는 명령 출력
- 설정 파일 일부

**비고**: 
- PASS인 경우: 구현 상태 설명
- FAIL인 경우: 원인 + 수정 계획 + ETA (일자/시간)
- PARTIAL인 경우: 현재 상태 + 추가 작업 + ETA
```

#### 2-3. 프론트엔드에서 확인해야 할 항목 예시

1. **UI/UX 검증**
   - Beta access 거부 시 에러 메시지 표시
   - 세션 타임아웃 알림 표시
   - Rate limit 초과 시 재시도 안내
   - 쿼터 초과 시 한도 표시

2. **버전 정보 표시**
   - 화면 하단 또는 설정 페이지에 버전 정보
   - Git commit hash 또는 빌드 번호

3. **에러 처리**
   - API 에러 코드별 적절한 메시지 표시
   - 사용자 친화적인 에러 메시지

4. **보안 헤더 확인**
   - 브라우저 개발자 도구에서 보안 헤더 확인
   - HSTS, X-Content-Type-Options 등

### 3. 증거 수집 방법

#### 3-1. 스크린샷
- 에러 메시지 화면 캡처
- 버전 정보 표시 화면 캡처
- 브라우저 개발자 도구 헤더 캡처

#### 3-2. 코드 위치
```typescript
// 예시: frontend/lib/api/vm.ts:123
export async function createVM(data: CreateVMRequest) {
  // ...
}
```

#### 3-3. 로그/출력
- 브라우저 콘솔 로그
- 네트워크 탭 응답
- API 응답 예시

### 4. 문서 업데이트

#### 4-1. 문서 수정
```bash
cd /home/darc0/LIMEN
vim proof-pack/frontend/PROOF-PACK-FRONTEND.md
# 또는 원하는 에디터 사용
```

#### 4-2. Git 커밋
```bash
cd /home/darc0/LIMEN
git add proof-pack/frontend/PROOF-PACK-FRONTEND.md
git commit -m "docs: 프론트엔드 Proof Pack 작성 완료"
git push
```

### 5. 검증 체크리스트

프론트엔드 담당자가 확인해야 할 항목:

- [ ] Beta access 거부 시 UI 메시지 표시 확인
- [ ] 세션 타임아웃 알림 동작 확인
- [ ] Rate limit 초과 시 재시도 안내 표시
- [ ] 쿼터 초과 시 한도 정보 표시
- [ ] 버전 정보 화면 표시
- [ ] 에러 메시지 사용자 친화적 표시
- [ ] 보안 헤더 브라우저 확인
- [ ] WebSocket 연결 안정성 확인

---

## 백엔드 담당자 가이드

### 1. 문서 위치
백엔드 Proof Pack 문서는 다음 경로에 있습니다:
```
/home/darc0/LIMEN/proof-pack/backend/PROOF-PACK-BACKEND.md
```

### 2. 문서 업데이트
백엔드 작업 완료 시 해당 문서를 업데이트하세요.

```bash
cd /home/darc0/LIMEN
vim proof-pack/backend/PROOF-PACK-BACKEND.md
# FAIL 항목을 PASS로 변경하고 증거 추가
```

### 3. FAIL 항목 수정 후 업데이트
1. 코드 수정 완료
2. 테스트 수행
3. 증거 수집 (로그, 스크린샷 등)
4. 문서의 해당 항목을 FAIL → PASS로 변경
5. 증거 섹션에 테스트 결과 추가
6. Git 커밋

---

## 공통 가이드

### 1. 문서 버전 관리
- 모든 Proof Pack 문서는 Git으로 관리됩니다
- 중요한 업데이트 시 커밋 메시지에 명시하세요

### 2. 증거 보관
- 스크린샷은 `proof-pack/backend/screenshots/` 또는 `proof-pack/frontend/screenshots/` 폴더에 보관
- 로그 파일은 민감정보를 마스킹하여 보관

### 3. 문서 구조 유지
- 제출 형식 유지 (항목ID, 증거, 비고)
- 코드 위치는 상대 경로로 표시
- 민감정보는 마스킹

---

## 연락처

- **Backend 담당**: Backend AI
- **Frontend 담당**: Frontend 팀
- **문서 관리**: 각 팀 담당자

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-12

