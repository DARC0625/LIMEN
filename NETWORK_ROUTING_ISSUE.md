# 네트워크 라우팅 문제 분석 및 해결 방법

## 문제 상황

WSL2에서 외부 인터넷 연결이 안 되는 문제가 발생했습니다.

## 원인 분석

### 네트워크 인터페이스 상태
- **eth0**: `10.0.0.100/24` - 미러 모드용 (Windows 호스트와 통신)
- **eth1**: `222.113.30.138/25` - 실제 외부 인터넷 연결용
- **eth0 게이트웨이**: `10.0.0.1` - 연결 안 됨 (Destination Host Unreachable)
- **eth1 게이트웨이**: `222.113.30.129` - 정상 작동

### 라우팅 테이블 문제
```
default via 10.0.0.1 dev eth0 proto static    ← 이게 우선순위가 높아서 먼저 선택됨 (하지만 연결 안 됨)
default via 222.113.30.129 dev eth1 proto kernel metric 25  ← 실제 인터넷 게이트웨이 (우선순위 낮음)
```

### 확인 결과
- `eth1`로 직접 통신 시: ✅ 정상 작동 (8.8.8.8 ping 성공)
- 기본 라우팅 사용 시: ❌ 실패 (10.0.0.1로 가려고 시도)

## 해결 방법

### 방법 1: 문제가 되는 라우트 제거 (권장)

```bash
# 문제가 되는 static 라우트 제거
sudo ip route del default via 10.0.0.1 dev eth0

# 확인
ip route show
ping -c 2 8.8.8.8
```

### 방법 2: 라우팅 우선순위 조정

```bash
# eth0의 metric을 높여서 우선순위 낮추기
sudo ip route del default via 10.0.0.1 dev eth0
sudo ip route add default via 10.0.0.1 dev eth0 metric 1000

# 또는 eth1의 metric을 낮춰서 우선순위 높이기
sudo ip route del default via 222.113.30.129 dev eth1
sudo ip route add default via 222.113.30.129 dev eth1 metric 10
```

### 방법 3: 영구적 해결 (WSL2 재시작 후에도 유지)

WSL2는 재시작 시 라우팅이 재설정되므로, `/etc/wsl.conf`에 설정을 추가하거나 스크립트로 자동화해야 합니다.

#### 스크립트 생성 (`/home/darc0/fix-routing.sh`):
```bash
#!/bin/bash
# 문제가 되는 라우트 제거
ip route del default via 10.0.0.1 dev eth0 2>/dev/null

# 확인
if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    echo "✅ 인터넷 연결 정상"
else
    echo "❌ 인터넷 연결 실패"
fi
```

#### 자동 실행 설정:
```bash
# ~/.bashrc에 추가
echo 'if [ -f ~/fix-routing.sh ]; then ~/fix-routing.sh; fi' >> ~/.bashrc
```

## 왜 이런 문제가 발생했나?

미러 모드(`networkingMode=mirrored`)가 활성화되면서:
1. WSL2가 Windows 호스트의 네트워크를 미러링하려고 시도
2. `eth0`에 static 라우트가 추가됨 (`10.0.0.1` 게이트웨이)
3. 하지만 이 게이트웨이는 실제로는 작동하지 않음
4. 실제 외부 인터넷은 `eth1`을 통해야 하는데, 라우팅 우선순위 때문에 `eth0`이 선택됨

## 임시 해결책

현재는 `eth1`을 직접 지정하여 인터넷을 사용할 수 있습니다:
```bash
# eth1을 통해 curl 실행
curl --interface eth1 https://www.google.com

# 또는 환경변수로 설정
export HTTP_PROXY=""
export HTTPS_PROXY=""
```

## 권장 사항

1. **즉시 해결**: `sudo ip route del default via 10.0.0.1 dev eth0` 실행
2. **영구 해결**: 위의 스크립트를 만들어서 자동 실행
3. **근본 해결**: WSL2 미러 모드 설정을 조정하거나, Windows 호스트의 네트워크 설정 확인

