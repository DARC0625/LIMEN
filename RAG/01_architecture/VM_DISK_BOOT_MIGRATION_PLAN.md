# VM 디스크 부팅 마이그레이션 계획

## 📋 개요

현재 시스템은 ISO 설치 이미지로 VM을 부팅하여 운영체제를 설치하는 방식입니다. 이를 **설치 완료 후 각 VM이 자신의 가상 디스크(qcow2)로 부팅하여 운영체제를 사용하고 파일을 저장/읽을 수 있는 방식**으로 전환합니다.

---

## 🔍 현재 시스템 분석

### 현재 아키텍처

1. **VM 생성 시:**
   - 빈 qcow2 디스크 생성 (20GB, UUID 기반)
   - ISO 파일을 CDROM으로 마운트
   - 부팅 순서: CDROM 우선 → HDD
   - VM 시작 시 ISO로 부팅하여 설치 진행

2. **현재 문제점:**
   - 설치 완료 후에도 계속 ISO로 부팅 시도
   - 사용자가 수동으로 ISO를 분리해야 함
   - 각 VM의 데이터가 디스크에 영구 저장되지 않음
   - 설치 상태 추적 불가

3. **기술 스택:**
   - **libvirt**: VM 라이프사이클 관리
   - **qemu-img**: 가상 디스크 생성/관리
   - **qcow2**: 가상 디스크 포맷 (스냅샷, 스파스 지원)
   - **Go**: 백엔드 언어
   - **GORM**: ORM (데이터베이스)

---

## 🎯 목표 아키텍처

### 최종 상태

1. **VM 생성 시:**
   - 빈 qcow2 디스크 생성
   - ISO를 CDROM으로 마운트 (선택사항)
   - 기본 부팅 순서: CDROM 우선 → HDD
   - VM 시작 → 사용자가 선택한 부팅 방식으로 부팅

2. **사용자 선택 가능한 부팅 방식:**
   - **ISO 부팅**: CDROM에서 부팅 (설치/복구용)
   - **디스크 부팅**: HDD에서 부팅 (일반 사용)
   - **부팅 순서 변경**: 언제든지 변경 가능

3. **유연한 ISO 관리:**
   - 설치 완료 후에도 ISO 마운트/분리 가능
   - 재설치, 복구, 추가 소프트웨어 설치 등에 활용
   - 사용자가 필요할 때마다 ISO 선택 가능

4. **일반 사용 시:**
   - VM이 자신의 qcow2 디스크로 부팅
   - 운영체제 사용 및 파일 저장/읽기
   - 데이터 영구 저장

---

## 🏗️ 상세 구현 계획

### Phase 1: 데이터베이스 스키마 확장

#### 1.1 VM 모델 확장

```go
type VM struct {
    // 기존 필드...
    
    // 새 필드 추가
    InstallationStatus InstallationStatus `gorm:"type:varchar(20);default:'NotInstalled'" json:"installation_status"`
    // NotInstalled: 설치 전
    // Installing: 설치 중
    // Installed: 설치 완료
    // InstallationFailed: 설치 실패
    
    DiskPath string `gorm:"type:varchar(512)" json:"disk_path"` // qcow2 디스크 경로
    DiskSize int    `gorm:"default:20" json:"disk_size"`        // 디스크 크기 (GB)
    
    // 부팅 설정 (사용자가 선택 가능)
    BootOrder BootOrder `gorm:"type:varchar(20);default:'cdrom_hd'" json:"boot_order"`
    // cdrom_hd: CDROM 우선, 그 다음 HDD
    // hd: HDD만
    // cdrom: CDROM만
    // hd_cdrom: HDD 우선, 그 다음 CDROM
    
    CurrentBootDevice string `gorm:"type:varchar(20)" json:"current_boot_device"` // 현재 부팅 장치
}
```

#### 1.2 InstallationStatus 타입 추가

```go
type InstallationStatus string

const (
    InstallationStatusNotInstalled InstallationStatus = "NotInstalled"
    InstallationStatusInstalling   InstallationStatus = "Installing"
    InstallationStatusInstalled    InstallationStatus = "Installed"
    InstallationStatusFailed      InstallationStatus = "InstallationFailed"
)
```

#### 1.3 BootOrder 타입 추가

```go
type BootOrder string

const (
    BootOrderCDROMHD   BootOrder = "cdrom_hd"   // CDROM 우선, HDD 다음
    BootOrderHD        BootOrder = "hd"          // HDD만
    BootOrderCDROM     BootOrder = "cdrom"       // CDROM만
    BootOrderHDCDROM   BootOrder = "hd_cdrom"    // HDD 우선, CDROM 다음
)

func (b BootOrder) IsValid() bool {
    switch b {
    case BootOrderCDROMHD, BootOrderHD, BootOrderCDROM, BootOrderHDCDROM:
        return true
    }
    return false
}
```

#### 1.4 마이그레이션 스크립트

- 기존 VM들의 `InstallationStatus`를 `NotInstalled`로 설정
- `BootOrder`를 `cdrom_hd`로 설정 (기본값)
- `DiskPath`를 기존 UUID 기반 경로로 설정

---

### Phase 2: VM 생성 로직 개선

#### 2.1 CreateVM 함수 수정

**변경사항:**
- VM 생성 시 `InstallationStatus = NotInstalled` 설정
- `BootFromDisk = false` 설정
- `DiskPath` 저장
- 부팅 순서: CDROM → HDD (기존과 동일)

**코드 위치:** `backend/internal/vm/service.go:CreateVM()`

---

### Phase 3: 부팅 순서 관리 및 ISO 선택

#### 3.1 부팅 순서 변경 함수

```go
func (s *VMService) SetBootOrder(name string, bootOrder BootOrder) error {
    // 1. 부팅 순서 유효성 검사
    // 2. libvirt XML 수정
    // 3. DB 업데이트
    // 4. VM 재시작 (선택사항, 사용자 선택)
}
```

**부팅 순서 옵션:**
- `cdrom_hd`: CDROM 우선, HDD 다음 (설치용)
- `hd`: HDD만 (일반 사용)
- `cdrom`: CDROM만 (ISO 전용 부팅)
- `hd_cdrom`: HDD 우선, CDROM 다음 (복구용)

#### 3.2 ISO 선택 및 마운트

**사용자가 언제든지 ISO를 선택하고 마운트할 수 있어야 함:**
- 설치 완료 후에도 ISO 마운트 가능
- 재설치, 복구, 추가 소프트웨어 설치 등에 활용
- 여러 ISO 파일 중 선택 가능

#### 3.3 설치 완료 감지 (선택사항)

**옵션 1: 사용자 수동 확인**
- 사용자가 설치 완료를 API로 알림
- `POST /api/vms/{uuid}/complete-installation`
- 부팅 순서는 자동으로 변경하지 않음 (사용자가 선택)

**옵션 2: 자동 감지 (향후 구현)**
- VM 내부에서 설치 완료 신호 전송
- libvirt QEMU Guest Agent 사용

**초기 구현: 옵션 1 선택, 부팅 순서는 사용자가 직접 변경**

---

### Phase 4: VM 시작 로직 개선

#### 4.1 StartVM 함수 수정

**로직:**
```go
func (s *VMService) StartVM(name string) error {
    // 1. VM 정보 조회 (BootOrder, 현재 ISO 마운트 상태)
    
    // 2. 부팅 순서에 따라 libvirt XML 확인/수정
    switch vm.BootOrder {
    case BootOrderCDROMHD:
        // CDROM 우선, HDD 다음
        // ISO가 마운트되어 있지 않으면 경고 (선택사항)
    case BootOrderHD:
        // HDD만 부팅
        // ISO 마운트 여부와 관계없이 HDD로 부팅
    case BootOrderCDROM:
        // CDROM만 부팅
        // ISO가 마운트되어 있지 않으면 에러
    case BootOrderHDCDROM:
        // HDD 우선, CDROM 다음
    }
    
    // 3. libvirt 도메인 시작
}
```

**중요:** 
- 부팅 순서는 사용자가 설정한 대로 유지
- ISO 마운트/분리는 부팅 순서와 독립적
- 사용자가 원하는 조합으로 설정 가능

**코드 위치:** `backend/internal/vm/service.go:StartVM()`

---

### Phase 5: ISO 관리 개선

#### 5.1 ISO 마운트/분리 (기존 함수 개선)

**AttachMedia 함수:**
- 설치 상태와 관계없이 언제든지 ISO 마운트 가능
- 여러 ISO 파일 중 선택 가능
- 사용자가 원하는 ISO를 선택하여 마운트

**DetachMedia 함수:**
- 언제든지 ISO 분리 가능
- 부팅 순서와 독립적으로 작동

#### 5.2 ISO 선택 UI/API

**사용자가 ISO를 선택할 수 있는 방법:**
- 사용 가능한 ISO 목록 조회
- 원하는 ISO 선택하여 마운트
- 현재 마운트된 ISO 확인

---

### Phase 6: 디스크 관리

#### 6.1 디스크 크기 확장

```go
func (s *VMService) ResizeDisk(name string, newSizeGB int) error {
    // qemu-img resize
    // VM 내부에서 파티션 확장 필요 (guest agent 또는 사용자 수동)
}
```

#### 6.2 디스크 정보 조회

```go
func (s *VMService) GetDiskInfo(name string) (*DiskInfo, error) {
    // qemu-img info
    // 실제 사용량, 가상 크기 등
}
```

---

## 🔧 기술적 세부사항

### libvirt XML 수정

#### 부팅 순서별 XML 예시

**cdrom_hd (CDROM 우선, HDD 다음)**
```xml
<os>
  <type arch='x86_64' machine='pc-q35-7.2'>hvm</type>
  <boot dev='cdrom'/>
  <boot dev='hd'/>
</os>
```

**hd (HDD만)**
```xml
<os>
  <type arch='x86_64' machine='pc-q35-7.2'>hvm</type>
  <boot dev='hd'/>
</os>
```

**cdrom (CDROM만)**
```xml
<os>
  <type arch='x86_64' machine='pc-q35-7.2'>hvm</type>
  <boot dev='cdrom'/>
</os>
```

**hd_cdrom (HDD 우선, CDROM 다음)**
```xml
<os>
  <type arch='x86_64' machine='pc-q35-7.2'>hvm</type>
  <boot dev='hd'/>
  <boot dev='cdrom'/>
</os>
```

**동적 변경:**
- 사용자가 부팅 순서를 변경하면 libvirt XML을 실시간으로 수정
- VM이 실행 중이면 재시작 필요 (선택사항)

### qcow2 디스크 포맷

- **스파스 디스크**: 실제 사용량만 물리적 공간 차지
- **스냅샷 지원**: VM 스냅샷 기능 활용 가능
- **성능**: virtio 드라이버 사용 (현재 구현됨)

---

## 📊 API 변경사항

### 새로운 엔드포인트

1. **부팅 순서 변경** ⭐ 핵심 기능
   ```
   POST /api/vms/{uuid}/boot-order
   Body: { "boot_order": "hd" | "cdrom_hd" | "cdrom" | "hd_cdrom" }
   ```

2. **부팅 순서 조회**
   ```
   GET /api/vms/{uuid}/boot-order
   ```

3. **ISO 선택 및 마운트** ⭐ 핵심 기능
   ```
   POST /api/vms/{uuid}/media/attach
   Body: { "iso_path": "/path/to/iso" }
   ```
   - 사용 가능한 ISO 목록에서 선택 가능
   - 설치 상태와 관계없이 언제든지 마운트 가능

4. **ISO 분리**
   ```
   POST /api/vms/{uuid}/media/detach
   ```
   - 언제든지 ISO 분리 가능

5. **설치 완료 알림 (선택사항)**
   ```
   POST /api/vms/{uuid}/complete-installation
   ```
   - 부팅 순서는 자동 변경하지 않음 (사용자가 직접 설정)

6. **설치 상태 조회**
   ```
   GET /api/vms/{uuid}/installation-status
   ```

7. **디스크 정보 조회**
   ```
   GET /api/vms/{uuid}/disk
   ```

8. **디스크 크기 확장**
   ```
   POST /api/vms/{uuid}/disk/resize
   Body: { "size_gb": 50 }
   ```

### 기존 엔드포인트 변경

1. **VM 조회 (GET /api/vms)**
   - `installation_status` 필드 추가
   - `boot_order` 필드 추가 (핵심)
   - `current_boot_device` 필드 추가
   - `disk_path` 필드 추가
   - `disk_size` 필드 추가
   - `current_media` 필드 추가 (현재 마운트된 ISO)

2. **VM 시작 (POST /api/vms/{uuid}/action)**
   - 사용자가 설정한 `boot_order`에 따라 부팅
   - ISO 마운트 상태 확인 및 경고 (필요시)

3. **ISO 마운트 (POST /api/vms/{uuid}/media)**
   - 기존 함수 개선: 설치 상태와 관계없이 마운트 가능
   - ISO 선택 기능 추가

---

## 🗄️ 데이터베이스 마이그레이션

### 마이그레이션 스크립트

```sql
-- 1. InstallationStatus 컬럼 추가
ALTER TABLE vms ADD COLUMN installation_status VARCHAR(20) DEFAULT 'NotInstalled';

-- 2. BootFromDisk 컬럼 추가
ALTER TABLE vms ADD COLUMN boot_from_disk BOOLEAN DEFAULT FALSE;

-- 3. DiskPath 컬럼 추가
ALTER TABLE vms ADD COLUMN disk_path VARCHAR(512);

-- 4. DiskSize 컬럼 추가
ALTER TABLE vms ADD COLUMN disk_size INTEGER DEFAULT 20;

-- 5. 기존 VM들의 DiskPath 설정
UPDATE vms SET disk_path = CONCAT('/path/to/vm/', uuid, '.qcow2') WHERE disk_path IS NULL;

-- 6. 인덱스 추가 (선택사항)
CREATE INDEX idx_vm_installation_status ON vms(installation_status);
CREATE INDEX idx_vm_boot_from_disk ON vms(boot_from_disk);
```

---

## 🧪 테스트 계획

### 단위 테스트

1. **CompleteInstallation 테스트**
   - 설치 완료 시 ISO 분리 확인
   - 부팅 순서 변경 확인
   - 상태 업데이트 확인

2. **StartVM 테스트**
   - 설치 전 VM: ISO 부팅 확인
   - 설치 후 VM: 디스크 부팅 확인

3. **SetBootOrder 테스트**
   - XML 수정 정확성 확인

### 통합 테스트

1. **전체 플로우 테스트**
   - VM 생성 → ISO 부팅 → 설치 완료 알림 → 디스크 부팅

2. **재시작 테스트**
   - 설치 완료 후 VM 재시작 시 디스크로 부팅 확인

3. **데이터 영구성 테스트**
   - 파일 저장 → VM 재시작 → 파일 확인

---

## 🚀 구현 단계

### Step 1: 데이터베이스 스키마 확장 (1일)
- [ ] InstallationStatus 타입 추가
- [ ] VM 모델 필드 추가
- [ ] 마이그레이션 스크립트 작성
- [ ] 마이그레이션 실행

### Step 2: 부팅 순서 관리 구현 (2일)
- [ ] BootOrder 타입 정의
- [ ] SetBootOrder 함수 작성
- [ ] libvirt XML 부팅 순서 수정 로직
- [ ] API 엔드포인트 추가 (POST /api/vms/{uuid}/boot-order)
- [ ] 단위 테스트 작성

### Step 3: StartVM 로직 개선 (2일)
- [ ] StartVM 함수 수정
- [ ] BootOrder에 따른 부팅 방식 처리
- [ ] ISO 마운트 상태 확인 및 검증
- [ ] 테스트 작성

### Step 4: ISO 선택 기능 구현 (2일)
- [ ] ISO 목록 조회 API 개선
- [ ] ISO 선택 및 마운트 UI/API
- [ ] 설치 상태와 관계없이 ISO 마운트 허용
- [ ] 현재 마운트된 ISO 표시

### Step 5: API 및 프론트엔드 연동 (2일)
- [ ] API 문서 업데이트
- [ ] 프론트엔드 부팅 순서 선택 UI 추가 ⭐
- [ ] 프론트엔드 ISO 선택 UI 추가 ⭐
- [ ] VM 상태 표시 개선 (부팅 순서, ISO 상태)

### Step 6: 테스트 및 버그 수정 (2일)
- [ ] 통합 테스트
- [ ] 사용자 시나리오 테스트 (ISO 선택, 부팅 순서 변경)
- [ ] 버그 수정
- [ ] 문서화

**총 예상 기간: 11일**

---

## ⚠️ 주의사항 및 리스크

### 주의사항

1. **기존 VM 호환성**
   - 기존 VM들은 `NotInstalled` 상태로 시작
   - `BootOrder`는 `cdrom_hd`로 설정 (기본값)

2. **부팅 순서와 ISO 마운트 상태**
   - 부팅 순서가 `cdrom` 또는 `cdrom_hd`인데 ISO가 마운트되지 않으면 부팅 실패 가능
   - 사용자에게 경고 메시지 표시
   - 또는 ISO 마운트를 자동으로 확인하고 필요시 마운트

3. **사용자 선택의 자유도**
   - 사용자가 원하는 조합으로 설정 가능
   - 예: 설치 완료 후에도 ISO 마운트하여 추가 소프트웨어 설치
   - 예: 디스크 부팅 중에도 필요시 ISO로 부팅하여 복구

4. **디스크 공간 관리**
   - qcow2 스파스 디스크이지만 모니터링 필요
   - 디스크 풀 관리 정책 수립

### 리스크

1. **부팅 순서 변경 실패**
   - libvirt XML 수정 실패 시 VM 부팅 불가
   - 롤백 메커니즘 필요
   - 변경 전 백업 권장

2. **ISO 마운트 상태 불일치**
   - 부팅 순서와 ISO 마운트 상태가 맞지 않으면 부팅 실패
   - 검증 로직 필요

3. **사용자 실수**
   - 잘못된 부팅 순서 설정으로 데이터 손실 가능
   - 확인 메시지 및 경고 필요

4. **데이터 손실**
   - 디스크 파일 손상 시 데이터 복구 불가
   - 백업 정책 수립 필요

---

## 📝 향후 개선사항

1. **부팅 순서 프리셋**
   - 자주 사용하는 부팅 순서 조합을 프리셋으로 저장
   - 원클릭으로 부팅 순서 변경

2. **자동 설치 완료 감지**
   - QEMU Guest Agent 활용
   - 설치 완료 시 부팅 순서 자동 변경 제안 (사용자 확인 후)

3. **디스크 스냅샷 통합**
   - 설치 완료 시점 스냅샷 자동 생성
   - 롤백 기능 제공

4. **템플릿 시스템**
   - 설치 완료된 VM을 템플릿으로 저장
   - 새 VM 생성 시 템플릿에서 복제

5. **디스크 마이그레이션**
   - VM 간 디스크 이동
   - 백업/복원 기능

6. **부팅 순서 검증 강화**
   - ISO 마운트 상태와 부팅 순서 자동 검증
   - 경고 및 자동 수정 제안

---

## 📚 참고 자료

- [libvirt Domain XML](https://libvirt.org/formatdomain.html)
- [QEMU qcow2 Format](https://www.qemu.org/docs/master/system/images.html#disk-image-file-formats)
- [QEMU Guest Agent](https://wiki.qemu.org/Features/GuestAgent)

---

## ✅ 체크리스트

### Phase 1: 데이터베이스
- [ ] InstallationStatus 타입 정의
- [ ] VM 모델 필드 추가
- [ ] 마이그레이션 스크립트 작성
- [ ] 마이그레이션 실행

### Phase 2: 백엔드 로직
- [ ] SetBootOrder 함수 ⭐ 핵심
- [ ] StartVM 로직 개선 (BootOrder 기반)
- [ ] ISO 선택 및 마운트 개선 (설치 상태 무관)
- [ ] 부팅 순서 검증 로직

### Phase 3: API
- [ ] POST /api/vms/{uuid}/boot-order ⭐ 핵심
- [ ] GET /api/vms/{uuid}/boot-order
- [ ] POST /api/vms/{uuid}/media/attach (개선: ISO 선택 기능)
- [ ] POST /api/vms/{uuid}/media/detach
- [ ] GET /api/vms/{uuid}/installation-status
- [ ] GET /api/vms/{uuid}/disk
- [ ] POST /api/vms/{uuid}/disk/resize

### Phase 4: 테스트
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] E2E 테스트

### Phase 5: 문서화
- [ ] API 문서 업데이트
- [ ] 사용자 가이드 작성
- [ ] 개발자 문서 업데이트

