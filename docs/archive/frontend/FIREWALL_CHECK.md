# 방화벽 설정 확인 가이드

## 프론트엔드 서버 방화벽 확인

### 필요한 포트

#### 인바운드 (Inbound)
- **포트 80 (HTTP)**: Envoy 프록시 - 외부 사용자 접근
- **포트 443 (HTTPS)**: Envoy 프록시 - 외부 사용자 접근
- **포트 9444**: Next.js 프론트엔드 - Envoy가 localhost로 접근
- **포트 9445**: darc.kr - Envoy가 localhost로 접근

#### 아웃바운드 (Outbound)
- **포트 18443**: 백엔드 API (10.0.0.100:18443) - 내부망 통신
- **포트 9000**: Agent 서비스 (10.0.0.100:9000) - 내부망 통신

### 확인 명령어

```bash
# 방화벽 상태 확인
sudo ufw status verbose
# 또는
sudo iptables -L -n -v
# 또는
sudo firewall-cmd --list-all

# 리스닝 포트 확인
sudo netstat -tuln | grep LISTEN
# 또는
ss -tuln | grep LISTEN

# 내부망 통신 테스트
ping 10.0.0.100
curl -v http://10.0.0.100:18443/api/health
curl -v http://10.0.0.100:9000/health

# 라우팅 확인
ip route get 10.0.0.100
```

## 백엔드 서버 방화벽 확인

### 필요한 포트

#### 인바운드 (Inbound)
- **포트 18443**: LIMEN 백엔드 API - 프론트엔드(10.0.0.10)에서 접근
- **포트 9000**: Agent 서비스 - 프론트엔드(10.0.0.10)에서 접근

#### 아웃바운드 (Outbound)
- 모든 아웃바운드 통신 허용 (일반적으로)

### 확인 명령어

```bash
# 방화벽 상태 확인
sudo ufw status verbose
# 또는
sudo iptables -L -n -v

# 리스닝 포트 확인
sudo netstat -tuln | grep -E "18443|9000"
# 또는
ss -tuln | grep -E "18443|9000"

# 내부망 통신 테스트
ping 10.0.0.10
```

## 권장 방화벽 설정

### 프론트엔드 서버 (UFW 예시)

```bash
# 기본 정책
sudo ufw default deny incoming
sudo ufw default allow outgoing

# HTTP/HTTPS 허용
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 내부망 통신 허용 (10.0.0.0/24)
sudo ufw allow from 10.0.0.0/24 to any port 18443
sudo ufw allow from 10.0.0.0/24 to any port 9000

# SSH 허용 (관리용)
sudo ufw allow 22/tcp

# 방화벽 활성화
sudo ufw enable
```

### 프론트엔드 서버 (iptables 예시)

```bash
# 내부망에서 백엔드로의 아웃바운드 허용
sudo iptables -A OUTPUT -d 10.0.0.100 -p tcp --dport 18443 -j ACCEPT
sudo iptables -A OUTPUT -d 10.0.0.100 -p tcp --dport 9000 -j ACCEPT

# 외부에서 HTTP/HTTPS 인바운드 허용
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 내부망에서 인바운드 허용
sudo iptables -A INPUT -s 10.0.0.0/24 -j ACCEPT
```

### 백엔드 서버 (UFW 예시)

```bash
# 기본 정책
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 내부망에서 API 포트 접근 허용
sudo ufw allow from 10.0.0.0/24 to any port 18443
sudo ufw allow from 10.0.0.0/24 to any port 9000

# SSH 허용 (관리용)
sudo ufw allow 22/tcp

# 방화벽 활성화
sudo ufw enable
```

## 문제 해결

### 내부망 통신이 안 되는 경우

1. **방화벽 규칙 확인**
   ```bash
   sudo iptables -L -n -v | grep 10.0.0
   ```

2. **라우팅 확인**
   ```bash
   ip route get 10.0.0.100
   ```

3. **네트워크 인터페이스 확인**
   ```bash
   ip addr show | grep 10.0.0
   ```

4. **연결 테스트**
   ```bash
   telnet 10.0.0.100 18443
   # 또는
   nc -zv 10.0.0.100 18443
   ```

### 포트가 열려있지 않은 경우

1. **리스닝 포트 확인**
   ```bash
   sudo netstat -tuln | grep LISTEN
   ```

2. **방화벽 규칙 추가**
   ```bash
   sudo ufw allow 18443/tcp
   # 또는
   sudo iptables -A INPUT -p tcp --dport 18443 -j ACCEPT
   ```

## 중요 사항

1. **내부망 통신은 반드시 허용해야 함**
   - 프론트엔드(10.0.0.10) → 백엔드(10.0.0.100:18443)
   - 프론트엔드(10.0.0.10) → 백엔드(10.0.0.100:9000)

2. **외부 접근은 Envoy를 통해서만**
   - 포트 80, 443만 외부에 노출
   - 내부 서비스(9444, 9445)는 localhost만 허용

3. **보안 고려사항**
   - SSH는 특정 IP에서만 접근 허용 권장
   - 불필요한 포트는 닫기
   - 정기적인 방화벽 규칙 점검




