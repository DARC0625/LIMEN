# 미러 모드 설정 가이드

**중요**: 프론트엔드와 백엔드는 별도 서버이므로 프론트엔드 코드 변경은 불필요합니다.

---

## ✅ 현재 상태

### WSL2 설정 확인
- 파일: `/mnt/c/Users/darc0/.wslconfig`
- 미러 모드: `networkingMode=mirrored` (활성화됨)

---

## 🔄 WSL2 재시작 필요

미러 모드 설정을 적용하려면 **Windows에서 WSL2를 완전히 종료하고 재시작**해야 합니다.

### Windows PowerShell (관리자 권한)에서 실행:

```powershell
# WSL2 완전 종료
wsl --shutdown

# 잠시 대기 (5초 정도)
Start-Sleep -Seconds 5

# WSL2 재시작 (자동으로 시작됨)
wsl
```

---

## 🔍 재시작 후 확인 사항

### 1. IP 주소 확인

WSL2 재시작 후 다음 명령으로 IP 확인:

```bash
# 모든 IP 주소 확인
hostname -I

# eth0 인터페이스 확인
ip addr show eth0
```

**예상 결과**:
- 미러 모드 활성화 시: `10.0.0.100` 또는 Windows 호스트와 동일한 네트워크의 IP

### 2. 백엔드 연결 테스트

```bash
# 백엔드 Health Check
curl http://10.0.0.100:18443/api/health

# 또는 localhost로 테스트
curl http://localhost:18443/api/health
```

**예상 결과**:
```json
{"db":"connected","libvirt":"connected","status":"ok","time":"..."}
```

### 3. 프론트엔드에서 접근 가능 여부 확인

프론트엔드 서버(10.0.0.10)에서 다음 명령 실행:

```bash
# 프론트엔드 서버에서 백엔드 접근 테스트
curl http://10.0.0.100:18443/api/health
```

---

## ⚠️ 문제 해결

### IP가 10.0.0.100이 아닌 경우

1. **미러 모드가 제대로 적용되지 않은 경우**:
   - `.wslconfig` 파일 확인: `networkingMode=mirrored`가 주석 처리되지 않았는지 확인
   - Windows 재부팅 고려

2. **네트워크 인터페이스 확인**:
   ```bash
   ip route show
   ip addr show
   ```

3. **Windows 호스트 IP 확인**:
   - Windows에서 `ipconfig` 실행
   - WSL2가 Windows와 동일한 네트워크를 사용하는지 확인

### 백엔드가 응답하지 않는 경우

1. **백엔드 서비스 상태 확인**:
   ```bash
   pm2 status
   pm2 logs limen --lines 20
   ```

2. **포트 리스닝 확인**:
   ```bash
   ss -tlnp | grep 18443
   ```

3. **방화벽 확인**:
   - Windows 방화벽에서 포트 18443 허용 확인

---

## 📋 체크리스트

- [ ] `.wslconfig`에서 `networkingMode=mirrored` 활성화 확인
- [ ] Windows에서 `wsl --shutdown` 실행
- [ ] WSL2 재시작
- [ ] IP 주소 확인 (`hostname -I`)
- [ ] 백엔드 Health Check 성공 (`curl http://10.0.0.100:18443/api/health`)
- [ ] 프론트엔드에서 백엔드 접근 테스트

---

## 🔗 관련 파일

- `/mnt/c/Users/darc0/.wslconfig` - WSL2 설정 (미러 모드 활성화)
- 백엔드 서비스: PM2로 실행 중 (`pm2 status`로 확인)

---

## 💡 참고사항

- 프론트엔드 코드는 변경할 필요 없음 (별도 서버에서 실행)
- 미러 모드가 활성화되면 WSL2가 Windows 호스트 네트워크를 미러링
- 프론트엔드(10.0.0.10) → 백엔드(10.0.0.100) 연결은 미러 모드 활성화 후 자동으로 작동


