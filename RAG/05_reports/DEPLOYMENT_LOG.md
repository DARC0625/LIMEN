# 배포 로그 (Deployment Log)

## 2026-01-06 19:35:14 - VM 부팅 순서 선택 기능 및 전원 ON/OFF 명령 개선

### 커밋 정보
- **커밋 해시**: `85266af`
- **커밋 메시지**: `feat: VM 부팅 순서 선택 기능 및 전원 ON/OFF 명령 개선`

### 변경 사항

#### 백엔드
1. **VM 시작 시 BootOrder 자동 적용**
   - `backend/internal/vm/service.go`: `StartVM` 함수에서 DB의 `BootOrder` 값을 읽어 libvirt XML에 적용
   - VM 시작 전에 부팅 순서를 설정하여 올바른 디스크/ISO에서 부팅되도록 보장

2. **VM 시작 후 즉시 종료 감지**
   - `StartVM` 함수에서 `dom.Create()` 후 1초 대기하여 VM 상태 재확인
   - VM이 시작 후 즉시 종료되는 경우 더 상세한 에러 메시지 제공

3. **StartVM 케이스에서 DB 상태 저장**
   - `backend/internal/handlers/api.go`: `HandleVMAction`에서 `VMActionStart` 성공 시 `vmRec.Status`를 DB에 저장
   - 프론트엔드와 백엔드 간 상태 동기화 개선

#### 프론트엔드
1. **BootOrderSelector 컴포넌트 추가**
   - `frontend/components/BootOrderSelector.tsx`: 새로운 컴포넌트 생성
   - 4가지 부팅 순서 옵션 제공: `cdrom_hd`, `hd`, `cdrom`, `hd_cdrom`

2. **VNCViewer에 부팅 순서 변경 기능 추가**
   - `frontend/components/VNCViewer.tsx`: Media Management 메뉴에 BootOrderSelector 통합
   - VM 상세 정보를 fetch하여 현재 부팅 순서 표시

3. **useVMs 훅 개선**
   - `frontend/hooks/useVMs.ts`: `start`, `stop`, `restart` 액션 후 `invalidateQueries` 및 `refetchQueries` 호출
   - UI가 서버의 최신 VM 상태를 즉시 반영하도록 개선

4. **React Error #310 해결**
   - `frontend/app/(protected)/admin/users/page.tsx`: `useEffect` cleanup 함수가 항상 반환되도록 수정
   - 조건부 반환으로 인한 Hook 호출 순서 불일치 문제 해결

5. **VNCViewer 경고 메시지 개선**
   - `NEXT_PUBLIC_BACKEND_URL` 경고를 production에서 무시하도록 수정
   - "VM is not running" 메시지 로그 레벨을 `warn`에서 `log`로 변경

### 데이터베이스 마이그레이션
- `backend/scripts/migrate_boot_order.sql`: 새로운 컬럼 추가
  - `installation_status`: 설치 상태
  - `boot_order`: 부팅 순서
  - `disk_path`: 디스크 경로
  - `disk_size`: 디스크 크기

### 배포 상태
- ✅ 로컬 커밋 완료
- ⚠️ GitHub 푸시 대기 중 (네트워크 연결 문제로 인해 나중에 푸시 필요)

### 다음 단계
1. 네트워크 연결 복구 후 GitHub 푸시
2. 백엔드 재시작하여 변경사항 적용
3. 프론트엔드 빌드 및 배포

---

## 이전 배포 기록

### 2026-01-03 - VM 재시작 기능 제거 및 리소스 제한 완화
- VM 재시작 액션 제거
- VM당 최대 메모리 제한(8GB) 제거
- VM 생성 속도 제한 제거
- 사용자 할당량 기본값 증가






