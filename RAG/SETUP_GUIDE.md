# LIMEN 서버 설정 가이드

## 서버 정보

- **서버 IP**: `10.0.0.10`
- **도메인**: `limen.kr`, `www.limen.kr`
- **LIMEN 프론트엔드 포트**: `9444`
- **DARC 웹사이트 포트**: `9443`

## DNS 설정

도메인 등록 기관에서 다음 A 레코드를 설정하세요:

```
limen.kr.    A    10.0.0.10
www.limen.kr. A    10.0.0.10
```

DNS 전파는 보통 몇 분에서 몇 시간이 걸릴 수 있습니다. 확인:

```bash
dig limen.kr +short
dig www.limen.kr +short
```

## 인증서 발급 및 Envoy 설정

### 1. 설정 상태 확인

```bash
cd /home/darc/LIMEN
./scripts/check-envoy-setup.sh
```

### 2. TLS 인증서 발급

DNS 설정이 완료되고 전파된 후:

```bash
cd /home/darc/LIMEN
./scripts/setup-limen-certificate.sh
```

이 스크립트는:
- Envoy를 자동으로 중지
- Let's Encrypt 인증서 발급
- Envoy를 자동으로 재시작

### 3. Envoy 재시작 (필요한 경우)

```bash
cd /home/darc/LIMEN
./scripts/restart-envoy.sh
```

## LIMEN 프론트엔드 실행

### 개발 환경

```bash
cd /home/darc/LIMEN/frontend
npm run dev
```

### 프로덕션 환경

```bash
cd /home/darc/LIMEN/frontend
npm run build
npm run start
```

또는 PM2 사용:

```bash
cd /home/darc/LIMEN/frontend
pm2 start npm --name "limen-frontend" -- start
pm2 save
```

## 접속 테스트

### HTTP 테스트

```bash
curl -H "Host: limen.kr" http://localhost/
curl -H "Host: www.limen.kr" http://localhost/
```

### HTTPS 테스트 (인증서 발급 후)

```bash
curl -H "Host: limen.kr" https://localhost/ --insecure
curl -H "Host: www.limen.kr" https://localhost/ --insecure
```

### 브라우저 테스트

- HTTP: `http://limen.kr`
- HTTPS: `https://limen.kr` (인증서 발급 후)

## 문제 해결

### 인증서 발급 실패

1. DNS 설정 확인:
   ```bash
   dig limen.kr +short
   ```

2. 포트 80, 443이 열려있는지 확인:
   ```bash
   sudo netstat -tlnp | grep -E ':(80|443)'
   ```

3. 방화벽 확인:
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

### Envoy 시작 실패

1. 설정 파일 검증:
   ```bash
   envoy --config-path /home/darc/LIMEN/frontend/envoy.yaml --mode validate
   ```

2. 로그 확인:
   ```bash
   sudo journalctl -u envoy -f  # systemd 사용 시
   # 또는
   tail -f /var/log/envoy.log  # 직접 실행 시
   ```

3. 포트 충돌 확인:
   ```bash
   sudo lsof -i :80
   sudo lsof -i :443
   ```

### LIMEN 프론트엔드 접속 불가

1. 프론트엔드가 실행 중인지 확인:
   ```bash
   netstat -tlnp | grep 9444
   ```

2. 프론트엔드 로그 확인:
   ```bash
   pm2 logs limen-frontend  # PM2 사용 시
   ```

3. Envoy 클러스터 상태 확인:
   - 관리 인터페이스: `http://127.0.0.1:9901`
   - 클러스터 상태: `http://127.0.0.1:9901/clusters`

## 유용한 명령어

### Envoy 관리

```bash
# 상태 확인
sudo systemctl status envoy

# 시작
sudo systemctl start envoy

# 중지
sudo systemctl stop envoy

# 재시작
sudo systemctl restart envoy

# 로그 확인
sudo journalctl -u envoy -f
```

### 인증서 갱신

Let's Encrypt 인증서는 90일마다 갱신해야 합니다:

```bash
sudo certbot renew
sudo systemctl restart envoy
```

자동 갱신 설정 (cron):

```bash
sudo crontab -e
# 다음 줄 추가:
0 3 * * * certbot renew --quiet && systemctl restart envoy
```

## 참고

- Envoy 설정 파일: `/home/darc/LIMEN/frontend/envoy.yaml`
- 인증서 위치: `/etc/letsencrypt/live/limen.kr/`
- LIMEN 프론트엔드: `/home/darc/LIMEN/frontend/`
- 스크립트 디렉토리: `/home/darc/LIMEN/scripts/`








