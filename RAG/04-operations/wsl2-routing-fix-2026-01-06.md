# WSL2 라우팅 문제 해결 (2026-01-06)

## 개요

WSL2 미러 모드 활성화 후 외부 인터넷 연결이 안 되는 문제를 해결하고, 백엔드 IP 주소(10.0.0.100) 고정을 보장했습니다.

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
default via 10.0.0.1 dev eth0 proto static    ← 우선순위 높음 (하지만 연결 안 됨)
default via 222.113.30.129 dev eth1 proto kernel metric 25  ← 실제 인터넷 게이트웨이 (우선순위 낮음)
```

### 확인 결과
- `eth1`로 직접 통신 시: ✅ 정상 작동 (8.8.8.8 ping 성공)
- 기본 라우팅 사용 시: ❌ 실패 (10.0.0.1로 가려고 시도)

## 해결 방법

### 1. 문제가 되는 라우트 제거
```bash
sudo ip route del default via 10.0.0.1 dev eth0
```

### 2. 자동 수정 스크립트 생성
**파일**: `scripts/fix-wsl2-routing-auto.sh`

```bash
#!/bin/bash
# WSL2 라우팅 문제 자동 수정 스크립트
# 중요: eth0의 IP 주소(10.0.0.100)는 절대 변경하지 않음

# 문제가 되는 default route만 제거
BAD_ROUTE=$(ip route show | grep "default via 10.0.0.1 dev eth0" || true)
if [ -n "$BAD_ROUTE" ]; then
    echo '0625' | sudo -S ip route del default via 10.0.0.1 dev eth0 2>/dev/null
    
    # eth0의 IP 주소가 여전히 10.0.0.100인지 확인
    ETH0_IP_AFTER=$(ip addr show eth0 | grep "inet 10.0.0.100" || true)
    if [ -z "$ETH0_IP_AFTER" ]; then
        echo "❌ 오류: eth0의 IP 주소가 10.0.0.100이 아닙니다!"
        exit 1
    fi
fi
```

### 3. 자동 실행 설정
`~/.bashrc`에 추가:
```bash
if [ -f ~/LIMEN/scripts/fix-wsl2-routing-auto.sh ]; then 
    ~/LIMEN/scripts/fix-wsl2-routing-auto.sh >/dev/null 2>&1
fi
```

## 백엔드 IP 주소 보호

### 중요 사항
**백엔드 주소는 10.0.0.100으로 절대 변경되지 않습니다.**

### 보장 사항
1. **eth0의 IP 주소는 절대 변경되지 않음**
   - 라우팅 스크립트는 default route만 제거
   - eth0의 IP 주소는 WSL2가 자동으로 관리

2. **로컬 네트워크 라우팅은 유지됨**
   - `10.0.0.0/24` 네트워크는 여전히 eth0를 통해 라우팅
   - 프론트엔드(10.0.0.10) ↔ 백엔드(10.0.0.100) 통신 정상

3. **백엔드 서비스는 계속 10.0.0.100에서 실행**
   - PM2로 실행 중인 백엔드는 IP 주소 변경 없이 계속 작동
   - 포트 18443은 모든 인터페이스에 바인딩되어 있음

### 스크립트 보호 기능
- ✅ eth0의 IP 주소가 10.0.0.100인지 확인
- ✅ 로컬 네트워크 라우팅이 유지되는지 확인
- ✅ default route만 제거 (로컬 네트워크는 건드리지 않음)

## 왜 이런 문제가 발생했나?

미러 모드(`networkingMode=mirrored`)가 활성화되면서:
1. WSL2가 Windows 호스트의 네트워크를 미러링하려고 시도
2. `eth0`에 static 라우트가 추가됨 (`10.0.0.1` 게이트웨이)
3. 하지만 이 게이트웨이는 실제로는 작동하지 않음
4. 실제 외부 인터넷은 `eth1`을 통해야 하는데, 라우팅 우선순위 때문에 `eth0`이 선택됨

## 해결 결과

- ✅ 인터넷 연결 정상 (ping 8.8.8.8 성공)
- ✅ GitHub 연결 정상
- ✅ 백엔드 IP 주소 10.0.0.100 유지
- ✅ 프론트엔드-백엔드 통신 정상

## 관련 파일

- `scripts/fix-wsl2-routing-auto.sh` - 자동 수정 스크립트
- `~/.bashrc` - 자동 실행 설정
- `/mnt/c/Users/darc0/.wslconfig` - WSL2 설정 (networkingMode=mirrored)

## 커밋 정보

- 커밋: `d17d020` - "fix: VM start/stop 액션 DB 저장 누락 수정 및 WSL2 라우팅 자동 수정 스크립트 추가"
- 날짜: 2026-01-06



