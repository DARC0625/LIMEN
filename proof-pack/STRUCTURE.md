# Proof Pack 폴더 구조

```
proof-pack/
├── README.md                          # 전체 폴더 구조 및 사용 가이드
├── STRUCTURE.md                       # 이 파일 (폴더 구조 상세 설명)
├── QUICK-START-FRONTEND.md            # 프론트엔드 빠른 시작 가이드
│
├── backend/                           # 백엔드 Proof Pack
│   ├── PROOF-PACK-BACKEND.md         # 백엔드 검증 항목 (완료)
│   ├── screenshots/                   # 백엔드 스크린샷 저장 폴더
│   └── .gitkeep                       # Git 폴더 유지
│
└── frontend/                          # 프론트엔드 Proof Pack
    ├── PROOF-PACK-FRONTEND.md        # 프론트엔드 검증 항목 (작성 필요)
    ├── README-FRONTEND.md            # 프론트엔드 상세 작성 가이드
    ├── screenshots/                   # 프론트엔드 스크린샷 저장 폴더
    └── .gitkeep                       # Git 폴더 유지
```

## 파일 설명

### 루트 파일
- **README.md**: 전체 폴더 구조 및 사용 가이드 (백엔드/프론트엔드 공통)
- **STRUCTURE.md**: 폴더 구조 상세 설명 (이 파일)
- **QUICK-START-FRONTEND.md**: 프론트엔드 담당자를 위한 빠른 시작 가이드

### 백엔드 폴더 (`backend/`)
- **PROOF-PACK-BACKEND.md**: 백엔드 검증 항목 (A, B, C 섹션)
  - 상태: 완료 (25/30 PASS, 4개 FAIL, 1개 PARTIAL)
- **screenshots/**: 백엔드 관련 스크린샷 저장 폴더

### 프론트엔드 폴더 (`frontend/`)
- **PROOF-PACK-FRONTEND.md**: 프론트엔드 검증 항목 (템플릿)
  - 상태: 프론트엔드 담당자가 작성 필요
- **README-FRONTEND.md**: 프론트엔드 상세 작성 가이드
  - 작성 방법, 증거 수집 방법, 체크리스트 등 포함
- **screenshots/**: 프론트엔드 관련 스크린샷 저장 폴더

## 사용 방법

### 백엔드 담당자
1. `backend/PROOF-PACK-BACKEND.md` 파일 확인
2. FAIL 항목 수정 후 문서 업데이트
3. 증거 추가 (스크린샷은 `backend/screenshots/`에 저장)

### 프론트엔드 담당자
1. `QUICK-START-FRONTEND.md` 또는 `frontend/README-FRONTEND.md` 읽기
2. `frontend/PROOF-PACK-FRONTEND.md` 파일 열기
3. 템플릿을 참고하여 검증 항목 작성
4. 스크린샷은 `frontend/screenshots/`에 저장

## Git 관리

모든 파일은 Git으로 관리됩니다:
```bash
cd /home/darc0/LIMEN
git add proof-pack/
git commit -m "docs: Proof Pack 문서 업데이트"
git push
```

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-12

