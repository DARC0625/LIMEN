# 프론트엔드 빠른 설정 가이드

> [← 홈](../../00-home.md) | [프론트엔드](../) | [가이드](./) | [빠른 설정](./FRONTEND_QUICK_SETUP.md)

## ⚠️ 참고사항

이 문서는 과거 프론트엔드 개발 시 작성된 가이드입니다. 현재 LIMEN 프로젝트는 프론트엔드가 제거된 백엔드 전용 구조입니다. 향후 프론트엔드 재구축 시 참고용으로 보관됩니다.

---

## 🚀 빠른 시작

### 1. 환경 변수 설정

프론트엔드 서버에서:

```bash
# .env.production 파일 생성/수정
cat > .env.production << EOF
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.110:18443
NEXT_PUBLIC_API_URL=http://10.0.0.110:18443/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.110:9000
EOF
```

### 2. 연결 테스트

```bash
# 백엔드 연결 확인
curl http://10.0.0.110:18443/api/health

# 정상 응답 예시:
# {"status":"ok","db":"connected","libvirt":"connected",...}
```

### 3. 프론트엔드 재시작

```bash
# 빌드 및 시작
npm run build
npm start

# 또는 PM2 사용
pm2 restart limen-frontend
```

---

## ✅ 완료!

이제 프론트엔드가 백엔드와 직접 통신합니다.

---

## 📝 참고

- **네트워크**: 프론트엔드 → 백엔드 직접 연결
- **포트**: 18443 (커스텀 포트)
- **방화벽**: 설정 필요

---

## 관련 문서

- [프론트엔드 개발자 가이드](./FRONTEND_DEVELOPER_GUIDE.md)
- [네트워크 설정](./FRONTEND_NETWORK_SETUP.md)
- [배포 전략](./FRONTEND_DEPLOYMENT_STRATEGY.md)

---

**태그**: `#프론트엔드` `#빠른-설정` `#환경-변수` `#과거-기록`

**카테고리**: 프론트엔드 > 가이드 > 빠른 설정

**상태**: 과거 기록 (프론트엔드 제거됨)

**마지막 업데이트**: 2024-12-23
