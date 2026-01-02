# 🚀 빠른 배포 가이드

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [🚀 빠른 배포 가이드](./QUICK_DEPLOY.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 1️⃣ 프론트엔드 빌드

```bash
cd /home/darc0/projects/LIMEN
./deploy.sh
```

또는 수동으로:

```bash
cd /home/darc0/projects/LIMEN/frontend
npm install
npm run build
```

## 2️⃣ 백엔드 CORS 설정

10.0.0.10 서버의 `backend/.env` 파일에 추가:

```env
ALLOWED_ORIGINS=https://www.darc.kr,http://www.darc.kr
```

또는 환경 변수로:

```bash
export ALLOWED_ORIGINS="https://www.darc.kr,http://www.darc.kr"
```

## 3️⃣ www.darc.kr에 파일 업로드

빌드된 파일들을 www.darc.kr 웹 루트에 업로드:

- `.next/` 폴더
- `public/` 폴더  
- `package.json`
- `node_modules/` (또는 서버에서 `npm install --production`)

## 4️⃣ Node.js 서버 실행 (www.darc.kr)

www.darc.kr 서버에서:

```bash
cd /path/to/limen/frontend
npm install --production
npm start
```

또는 PM2로:

```bash
pm2 start npm --name "limen-frontend" -- start
```

## 5️⃣ 확인

브라우저에서 `https://www.darc.kr` 접속하여 확인!

---

**상세 가이드**: `docs/DEPLOYMENT.md` 참조


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#배포` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 배포

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
