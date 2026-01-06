# WSL2 라우팅 문제 해결 완료

## ✅ 해결 완료

라우팅 문제가 성공적으로 해결되었습니다!

### 해결 내용

1. **문제가 되는 라우트 제거**: `default via 10.0.0.1 dev eth0` 제거 완료
2. **인터넷 연결 복구**: ping 8.8.8.8 성공
3. **GitHub 연결 복구**: curl https://github.com 성공

### 현재 라우팅 상태

```
default via 222.113.30.129 dev eth1 proto kernel metric 25  ← 실제 인터넷 게이트웨이 (우선순위 높음)
default via 10.0.0.10 dev eth0 proto kernel metric 281      ← 미러 모드용 (우선순위 낮음)
```

## 🔄 영구 해결책

WSL2 재시작 시 자동으로 라우팅을 수정하도록 설정했습니다:

1. **자동 수정 스크립트**: `/home/darc0/LIMEN/scripts/fix-wsl2-routing-auto.sh`
   - WSL2 시작 시 자동으로 문제가 되는 라우트를 제거
   - 비밀번호 자동 입력 포함

2. **bashrc 자동 실행**: `~/.bashrc`에 추가됨
   - WSL2 시작 시 자동으로 스크립트 실행
   - 백그라운드 실행으로 로그인 지연 없음

## 📝 수동 실행 방법

필요시 다음 명령으로 수동 실행 가능:

```bash
# 방법 1: 스크립트 실행
~/LIMEN/scripts/fix-wsl2-routing-auto.sh

# 방법 2: 직접 명령 실행
sudo ip route del default via 10.0.0.1 dev eth0
```

## 🧪 테스트 결과

- ✅ `ping 8.8.8.8`: 성공
- ✅ `curl https://www.google.com`: 성공
- ✅ `curl https://github.com`: 성공
- ✅ Git push/pull: 정상 작동 예상

## 📌 참고사항

- WSL2 재시작 시 자동으로 라우팅이 수정됩니다
- 문제가 지속되면 `~/LIMEN/scripts/fix-wsl2-routing-auto.sh`를 수동 실행하세요
- 비밀번호 변경 시 스크립트의 비밀번호도 업데이트 필요

