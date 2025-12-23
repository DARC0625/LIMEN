# 🚀 LIMEN 배포 가이드 - 포트 4000 사용

> [← 홈](../../00-home.md) | [아카이브](../) | [Legacy 기록](./) | [🚀 LIMEN 배포 가이드 - 포트 4000 사용](./DEPLOY_PORT_4000.md)

## ⚠️ 참고사항

이 문서는 과거 프로젝트 기록입니다. 현재 LIMEN 프로젝트는 위키 형식으로 재구성되었으며, 이 문서는 참고용으로 보관됩니다.

---

## 📋 상황
- **www.darc.kr**: 이미 다른 서비스 실행 중
- **LIMEN 프론트엔드**: 포트 4000 사용
- **백엔드**: 10.0.0.10:8080 (내부망)
- **접속 URL**: `http://www.darc.kr:4000` 또는 `https://www.darc.kr:4000`

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

---

## 2️⃣ www.darc.kr 서버에 파일 업로드

### 업로드할 파일들:
- `.next/` 폴더 전체
- `public/` 폴더 전체
- `package.json`
- `.env.production` (또는 서버에서 생성)

### 업로드 위치:
```
/var/www/limen/  (또는 원하는 경로)
```

---

## 3️⃣ www.darc.kr 서버에서 설정

### 3.1 환경 변수 설정

```bash
cd /var/www/limen
cat > .env.production << 'EOF'
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.10:8080
NEXT_PUBLIC_API_URL=http://10.0.0.10:8080/api
NEXT_PUBLIC_AGENT_URL=http://10.0.0.10:9000
EOF
```

### 3.2 의존성 설치

```bash
npm install --production
```

### 3.3 방화벽 설정

```bash
# 포트 4000 열기
sudo ufw allow 4000/tcp
# 또는
sudo iptables -A INPUT -p tcp --dport 4000 -j ACCEPT
```

---

## 4️⃣ 프론트엔드 서버 실행

### 방법 1: 직접 실행
```bash
cd /var/www/limen
npm start
```

### 방법 2: PM2 사용 (권장)
```bash
cd /var/www/limen
pm2 start npm --name "limen-frontend" -- start
pm2 save
pm2 startup  # 시스템 재시작 시 자동 시작
```

### 방법 3: systemd 서비스
```bash
# /etc/systemd/system/limen-frontend.service 생성
sudo nano /etc/systemd/system/limen-frontend.service
```

서비스 파일 내용:
```ini
[Unit]
Description=LIMEN Frontend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/limen
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

서비스 활성화:
```bash
sudo systemctl daemon-reload
sudo systemctl enable limen-frontend
sudo systemctl start limen-frontend
sudo systemctl status limen-frontend
```

---

## 5️⃣ 백엔드 CORS 설정 (10.0.0.10 서버)

`backend/.env` 파일에 추가:

```env
ALLOWED_ORIGINS=http://www.darc.kr:4000,https://www.darc.kr:4000,http://localhost:4000
```

또는 환경 변수로:
```bash
export ALLOWED_ORIGINS="http://www.darc.kr:4000,https://www.darc.kr:4000"
```

백엔드 재시작:
```bash
cd /home/darc0/projects/LIMEN/backend
./server
# 또는 systemd 서비스 재시작
```

---

## 6️⃣ 네트워크 연결 확인

### 6.1 www.darc.kr → 10.0.0.10 연결 확인
```bash
# www.darc.kr 서버에서
ping 10.0.0.10
curl http://10.0.0.10:8080/api/health
```

### 6.2 방화벽 확인 (10.0.0.10 서버)
```bash
# 10.0.0.10 서버에서 www.darc.kr의 IP에서 접근 허용
sudo ufw allow from [www.darc.kr의_IP] to any port 8080
sudo ufw allow from [www.darc.kr의_IP] to any port 9000
```

---

## 7️⃣ 접속 확인

브라우저에서 접속:
```
http://www.darc.kr:4000
```

또는 HTTPS 사용 시:
```
https://www.darc.kr:4000
```

---

## 🔧 문제 해결

### CORS 오류
- 백엔드 CORS 설정 확인 (`ALLOWED_ORIGINS`)
- 브라우저 콘솔에서 오류 메시지 확인

### WebSocket 연결 실패
- 브라우저에서 직접 10.0.0.10:8080으로 연결 시도
- 방화벽 규칙 확인
- 백엔드 WebSocket 로그 확인

### 포트 접근 불가
- 방화벽 규칙 확인
- 포트 리스닝 확인: `netstat -tuln | grep 4000`
- 서비스 실행 상태 확인

---

## 📝 체크리스트

- [ ] 프론트엔드 빌드 완료
- [ ] www.darc.kr 서버에 파일 업로드
- [ ] 환경 변수 설정 (`.env.production`)
- [ ] 의존성 설치 (`npm install --production`)
- [ ] 방화벽 포트 4000 열기
- [ ] 프론트엔드 서버 실행 (포트 4000)
- [ ] 백엔드 CORS 설정 (www.darc.kr:4000 허용)
- [ ] 네트워크 연결 확인 (www.darc.kr → 10.0.0.10)
- [ ] 브라우저에서 접속 테스트

---

## 🚀 빠른 배포 명령어

```bash
# 1. 빌드
cd /home/darc0/projects/LIMEN && ./deploy.sh

# 2. www.darc.kr 서버에서
cd /var/www/limen
npm install --production
pm2 start npm --name "limen-frontend" -- start

# 3. 10.0.0.10 서버에서 (백엔드 CORS 설정)
# backend/.env에 ALLOWED_ORIGINS 추가 후 재시작
```

---

**접속 URL**: `http://www.darc.kr:4000` 또는 `https://www.darc.kr:4000`


---

## 관련 문서

- [Legacy 기록](./)

---

**태그**: `#아카이브` `#Legacy` `#배포` `#과거-기록`

**카테고리**: 아카이브 > Legacy 기록 > 배포

**상태**: 과거 기록

**마지막 업데이트**: 2024-12-23
