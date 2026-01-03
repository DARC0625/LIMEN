# 프론트엔드 IP 업데이트

> [← 홈](../../00-home.md) | [프론트엔드](../) | [가이드](./) | [IP 업데이트](./FRONTEND_IP_UPDATE.md)

## ⚠️ 참고사항

이 문서는 과거 프론트엔드 개발 시 작성된 가이드입니다. 현재 LIMEN 프로젝트는 프론트엔드가 제거된 백엔드 전용 구조입니다. 향후 프론트엔드 재구축 시 참고용으로 보관됩니다.

---

## 변경 사항

### 이전 설정

```env
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:8080
```

### 현재 설정

```env
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.110:18443
NEXT_PUBLIC_API_URL=http://10.0.0.110:18443/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.110:9000
```

---

## 업데이트 방법

1. 환경 변수 파일 수정
2. 프론트엔드 재시작
3. 연결 테스트

---

## 관련 문서

- [프론트엔드 개발자 가이드](./FRONTEND_DEVELOPER_GUIDE.md)
- [빠른 설정](./FRONTEND_QUICK_SETUP.md)
- [AI 메시지](./FRONTEND_AI_MESSAGE.md)

---

**태그**: `#프론트엔드` `#IP-업데이트` `#과거-기록`

**카테고리**: 프론트엔드 > 가이드 > IP 업데이트

**상태**: 과거 기록 (프론트엔드 제거됨)

**마지막 업데이트**: 2024-12-23
