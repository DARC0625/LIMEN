# 프론트엔드 Proof Pack 빠른 시작 가이드

## 📍 문서 위치

프론트엔드 Proof Pack 문서는 여기에 있습니다:

```
/home/darc0/LIMEN/proof-pack/frontend/PROOF-PACK-FRONTEND.md
```

## 🚀 시작하기 (3단계)

### 1단계: 문서 열기
```bash
cd /home/darc0/LIMEN
code proof-pack/frontend/PROOF-PACK-FRONTEND.md
```

### 2단계: 템플릿 확인
`PROOF-PACK-FRONTEND.md` 파일을 열어서 기존 템플릿을 확인하세요.

### 3단계: 검증 항목 추가
템플릿을 참고하여 프론트엔드 검증 항목을 추가하세요.

## 📝 작성 형식

각 항목을 다음 형식으로 작성:

```markdown
### 항목명

**항목ID**: F1 - PASS/FAIL/PARTIAL

**증거**:
- 스크린샷: `screenshots/F1-항목명.png`
- 코드 위치: `frontend/lib/api/vm.ts:123`
- 브라우저 콘솔 로그:
  ```
  [로그 내용]
  ```

**비고**: 
- PASS: 구현 완료
- FAIL: 원인 + 수정 계획 + ETA (예: 2026-01-12/15:00)
```

## 📸 스크린샷 저장

스크린샷은 다음 폴더에 저장:
```
proof-pack/frontend/screenshots/
```

## ✅ 확인해야 할 항목

1. Beta access 거부 시 에러 메시지 표시
2. 세션 타임아웃 알림
3. Rate limit 초과 시 재시도 안내
4. 쿼터 초과 시 한도 정보 표시
5. 버전 정보 화면 표시
6. 보안 헤더 브라우저 확인

## 📚 상세 가이드

더 자세한 내용은 다음 파일을 참고하세요:
- `README-FRONTEND.md` - 상세 작성 가이드
- `../backend/PROOF-PACK-BACKEND.md` - 백엔드 API 응답 예시 참고

## ❓ 질문이 있나요?

백엔드 담당자에게 문의하세요.



