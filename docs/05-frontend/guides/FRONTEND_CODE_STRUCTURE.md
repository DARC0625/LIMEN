# 프론트엔드 코드 구조

> [← 홈](../../00-home.md) | [프론트엔드](../) | [가이드](./) | [코드 구조](./FRONTEND_CODE_STRUCTURE.md)

## ⚠️ 참고사항

이 문서는 과거 프론트엔드 개발 시 작성된 가이드입니다. 현재 LIMEN 프로젝트는 프론트엔드가 제거된 백엔드 전용 구조입니다. 향후 프론트엔드 재구축 시 참고용으로 보관됩니다.

---

## 프로젝트 구조

```
frontend/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx     # 메인 페이지
│   │   ├── login/       # 로그인 페이지
│   │   └── vms/         # VM 관리 페이지
│   ├── components/      # React 컴포넌트
│   │   ├── VMList.tsx
│   │   ├── VMCard.tsx
│   │   └── VNCConsole.tsx
│   ├── lib/             # 유틸리티
│   │   ├── api.ts       # API 클라이언트
│   │   └── auth.ts      # 인증 로직
│   ├── hooks/           # Custom Hooks
│   │   ├── useVMs.ts
│   │   └── useAuth.ts
│   └── types/           # TypeScript 타입
│       └── index.ts
├── public/              # 정적 파일
└── package.json
```

---

## 주요 컴포넌트

### VMList

VM 목록을 표시하는 컴포넌트입니다.

### VMCard

개별 VM 정보를 표시하는 카드 컴포넌트입니다.

### VNCConsole

VNC 콘솔을 표시하는 컴포넌트입니다.

---

## 관련 문서

- [프론트엔드 개발자 가이드](./FRONTEND_DEVELOPER_GUIDE.md)
- [재구축 가이드](./FRONTEND_RECONSTRUCTION_GUIDE.md)

---

**태그**: `#프론트엔드` `#코드-구조` `#과거-기록`

**카테고리**: 프론트엔드 > 가이드 > 코드 구조

**상태**: 과거 기록 (프론트엔드 제거됨)

**마지막 업데이트**: 2024-12-23
