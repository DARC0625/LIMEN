# 부팅 순서 선택 기능 구현 완료

## ✅ 구현 완료 사항

### Backend

1. **데이터베이스 스키마 확장**
   - `InstallationStatus` 타입 추가 (NotInstalled, Installing, Installed, InstallationFailed)
   - `BootOrder` 타입 추가 (cdrom_hd, hd, cdrom, hd_cdrom)
   - VM 모델에 필드 추가:
     - `installation_status`
     - `boot_order`
     - `disk_path`
     - `disk_size`

2. **VM Service 함수**
   - `SetBootOrder()`: 부팅 순서 변경 함수 구현
   - `updateBootOrder()`: libvirt XML 부팅 순서 수정 로직
   - `CreateVM()`: 기본 부팅 순서 설정 (cdrom_hd)

3. **API 엔드포인트**
   - `POST /api/vms/{uuid}/boot-order`: 부팅 순서 변경
   - `GET /api/vms/{uuid}/boot-order`: 부팅 순서 조회

4. **StartVM 로직 개선**
   - 부팅 순서에 따른 ISO 마운트 상태 검증 (경고)

### Frontend

1. **타입 정의**
   - `BootOrder` 타입 추가
   - `InstallationStatus` 타입 추가
   - VM 인터페이스에 필드 추가

2. **UI 컴포넌트**
   - `BootOrderSelector`: 부팅 순서 선택 컴포넌트
   - 4가지 부팅 옵션 제공:
     - CDROM → HDD (설치용)
     - HDD만 (일반 사용)
     - CDROM만 (ISO 전용)
     - HDD → CDROM (복구용)

3. **통합**
   - VM 편집 모달에 부팅 순서 선택기 추가
   - React Query를 통한 자동 데이터 갱신

## 📋 데이터베이스 마이그레이션

마이그레이션 스크립트가 준비되었습니다:
- 위치: `LIMEN/backend/scripts/migrate_boot_order.sql`

**실행 방법:**
```bash
# 방법 1: psql 직접 실행
psql -h localhost -U postgres -d limen -f LIMEN/backend/scripts/migrate_boot_order.sql

# 방법 2: GORM 자동 마이그레이션 (권장)
# 백엔드가 시작될 때 자동으로 컬럼이 추가됩니다 (기본값 포함)
```

## 🎯 사용 방법

### 프론트엔드에서 부팅 순서 변경

1. VM 목록에서 VM 카드 클릭 (편집 모달 열기)
2. "부팅 순서" 섹션에서 원하는 옵션 선택
3. 선택 즉시 적용됨 (별도 저장 버튼 없음)

### 부팅 순서 옵션 설명

- **CDROM → HDD**: ISO 우선 부팅, 없으면 디스크 부팅 (설치용)
- **HDD만**: 디스크로만 부팅 (일반 사용)
- **CDROM만**: ISO로만 부팅 (ISO 전용)
- **HDD → CDROM**: 디스크 우선, 없으면 ISO 부팅 (복구용)

## ⚠️ 주의사항

1. **데이터베이스 마이그레이션 필요**
   - 기존 VM들은 기본값으로 설정됨 (boot_order: cdrom_hd)
   - 새로 생성되는 VM도 기본값은 cdrom_hd

2. **ISO 마운트 상태**
   - 부팅 순서가 CDROM을 포함하는데 ISO가 마운트되지 않으면 경고만 표시
   - 실제 부팅 시 실패할 수 있음

3. **VM 실행 중 부팅 순서 변경**
   - 실행 중인 VM의 부팅 순서를 변경하면 libvirt 도메인이 재정의됨
   - 다음 부팅 시 새 부팅 순서가 적용됨

## 🔄 다음 단계 (선택사항)

1. **ISO 선택 UI 개선**
   - 현재 ISO 마운트/분리는 기존 API 사용
   - 프론트엔드에서 ISO 선택 UI 개선 가능

2. **설치 완료 감지**
   - 자동 설치 완료 감지 기능 추가 (향후)

3. **부팅 순서 프리셋**
   - 자주 사용하는 조합을 프리셋으로 저장

## 📝 변경된 파일

### Backend
- `internal/models/status.go`: BootOrder, InstallationStatus 타입 추가
- `internal/models/models.go`: VM 모델 필드 추가
- `internal/vm/service.go`: SetBootOrder, updateBootOrder 함수 추가
- `internal/handlers/api.go`: 부팅 순서 변경 API 추가
- `internal/router/router.go`: 라우터에 엔드포인트 추가

### Frontend
- `lib/types/index.ts`: 타입 정의 추가
- `components/BootOrderSelector.tsx`: 새 컴포넌트
- `app/(protected)/dashboard/page.tsx`: 편집 모달에 통합

## ✅ 테스트 체크리스트

- [ ] VM 생성 시 기본 부팅 순서 확인
- [ ] 부팅 순서 변경 API 테스트
- [ ] 프론트엔드에서 부팅 순서 변경 테스트
- [ ] 각 부팅 순서로 VM 부팅 테스트
- [ ] ISO 마운트 상태와 부팅 순서 조합 테스트







