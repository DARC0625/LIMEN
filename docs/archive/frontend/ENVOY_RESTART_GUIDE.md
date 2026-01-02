# Envoy 재시작 가이드

## 현재 상황
- Envoy가 12월 28일부터 실행 중 (PID: 845350)
- 설정 변경사항이 적용되지 않음
- `/api/` 경로가 여전히 백엔드로 직접 프록시되고 있을 가능성

## Envoy 재시작 방법

### 방법 1: 프로세스 직접 종료 및 재시작
```bash
# 1. 현재 Envoy 프로세스 확인
ps aux | grep envoy | grep -v grep

# 2. Envoy 프로세스 종료 (root 권한 필요)
sudo kill 845350 845349 845343

# 3. 프로세스가 종료되었는지 확인
ps aux | grep envoy | grep -v grep

# 4. Envoy 재시작
cd /home/darc/LIMEN/frontend
sudo nohup envoy -c envoy.yaml > /tmp/envoy.log 2>&1 &

# 5. Envoy가 시작되었는지 확인
ps aux | grep envoy | grep -v grep
tail -20 /tmp/envoy.log
```

### 방법 2: 재시작 스크립트 사용 (인증서 경로 오류 무시)
```bash
cd /home/darc/LIMEN
# 스크립트를 수정하여 인증서 검증을 건너뛰거나
# 직접 프로세스를 재시작
```

## 재시작 후 확인 사항

### 1. Envoy가 정상 실행 중인지 확인
```bash
ps aux | grep envoy | grep -v grep
curl -I https://limen.kr/api/health
```

### 2. Next.js Middleware 로그 확인
```bash
pm2 logs limen-frontend --lines 50 | grep -E "Proxy.*session|Proxy.*auth"
```

### 3. 브라우저에서 테스트
1. 로그인 시도
2. 개발자 도구 → Network 탭에서 확인:
   - `POST /api/auth/login` 요청
   - `GET /api/auth/session` 요청
   - 각 요청의 `Cookie` 헤더 확인

## 예상 결과

### 재시작 전
- `GET /api/auth/session` 요청이 Next.js middleware 로그에 나타나지 않음
- 브라우저에서 쿠키가 전송되지 않음

### 재시작 후
- `GET /api/auth/session` 요청이 Next.js middleware 로그에 나타남
- Next.js middleware가 쿠키를 백엔드로 전달
- 브라우저에서 쿠키가 전송됨

## 중요 사항

⚠️ **Envoy를 재시작하지 않으면 설정 변경사항이 적용되지 않습니다!**

현재 Envoy 설정 파일(`envoy.yaml`)은 변경되었지만, 실행 중인 Envoy 프로세스는 이전 설정을 사용하고 있습니다.




