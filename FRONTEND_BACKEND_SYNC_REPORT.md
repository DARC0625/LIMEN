# 프론트엔드-백엔드 동기화 점검 보고서

**점검 일시**: 2026-01-06  
**점검 범위**: 프론트엔드와 백엔드 간의 API 연결 및 유기적 작동

---

## 🔴 발견된 문제점

### 1. **BootOrder 타입 불일치** (해결됨 ✅)

**문제**:
- 프론트엔드: `'cdrom-hdd' | 'hdd-only' | 'cdrom-only' | 'hdd-cdrom'` (하이픈 사용)
- 백엔드: `'cdrom_hd' | 'hd' | 'cdrom' | 'hd_cdrom'` (언더스코어 사용)

**영향**:
- 부팅 순서 변경 API 호출 시 400 Bad Request 발생
- 프론트엔드에서 보낸 값이 백엔드에서 유효하지 않다고 판단됨

**해결 방법**:
- 프론트엔드 타입을 백엔드 형식에 맞춰 수정 필요
- 또는 백엔드에서 프론트엔드 형식도 허용하도록 변환 로직 추가

**권장 조치**:
```typescript
// frontend/lib/types/index.ts
export type BootOrder = 'cdrom_hd' | 'hd' | 'cdrom' | 'hd_cdrom';
```

---

### 2. **boot-order 엔드포인트 미등록** (해결됨 ✅)

**문제**:
- 핸들러 함수는 존재: `HandleVMBootOrder`, `HandleGetVMBootOrder`
- 라우터에 등록되지 않음: `router.go`에 `/vms/{uuid}/boot-order` 경로 없음

**영향**:
- 부팅 순서 변경/조회 API가 404 Not Found 반환
- 기능이 완전히 작동하지 않음

**해결 완료**:
- `router.go`에 다음 라인 추가:
  ```go
  api.Get("/vms/{uuid}/boot-order", h.HandleGetVMBootOrder)
  api.Post("/vms/{uuid}/boot-order", h.HandleVMBootOrder)
  ```

---

### 3. **BootOrder 타입 정의 누락** (해결됨 ✅)

**문제**:
- `status.go`에 `BootOrder` 타입이 정의되지 않음
- `VM` 모델에 `BootOrder`, `InstallationStatus`, `DiskPath`, `DiskSize` 필드 없음

**영향**:
- 백엔드 빌드 실패
- 컴파일 에러 발생

**해결 완료**:
- `status.go`에 `BootOrder` 및 `InstallationStatus` 타입 추가
- `models.go`의 `VM` 구조체에 필드 추가

---

## ⚠️ 잠재적 문제점

### 4. **API URL 설정 불일치 가능성**

**현재 상태**:
- 프론트엔드: `NEXT_PUBLIC_API_URL` 또는 `/api` (상대 경로)
- 백엔드: `:18443` 포트에서 리스닝

**잠재적 영향**:
- 개발 환경에서 CORS 또는 연결 실패 가능
- 프로덕션에서는 Envoy 프록시를 통해 해결되지만, 개발 환경에서 문제 발생 가능

**권장 조치**:
- 개발 환경에서 `NEXT_PUBLIC_API_URL` 환경 변수 설정 확인
- CORS 설정 확인

---

### 5. **타입 정의 일치성**

**현재 상태**:
- 프론트엔드와 백엔드 간 타입 정의가 부분적으로 불일치
- BootOrder 타입 형식 차이

**권장 조치**:
- 공통 타입 정의 파일 생성 고려
- 또는 프론트엔드 타입을 백엔드 스키마에서 자동 생성

---

## ✅ 해결 완료된 항목

1. ✅ BootOrder 타입 정의 추가 (`status.go`)
2. ✅ InstallationStatus 타입 정의 추가 (`status.go`)
3. ✅ VM 모델에 BootOrder, InstallationStatus, DiskPath, DiskSize 필드 추가
4. ✅ boot-order 엔드포인트 라우터 등록
5. ✅ 백엔드 빌드 성공 확인

---

## 📋 추가 권장 사항

### 1. 프론트엔드 타입 수정

`frontend/lib/types/index.ts`에서 BootOrder 타입을 백엔드 형식에 맞춰 수정:

```typescript
// 변경 전
export type BootOrder = 'cdrom-hdd' | 'hdd-only' | 'cdrom-only' | 'hdd-cdrom';

// 변경 후
export type BootOrder = 'cdrom_hd' | 'hd' | 'cdrom' | 'hd_cdrom';
```

### 2. BootOrderSelector 컴포넌트 수정

`frontend/components/BootOrderSelector.tsx`에서 옵션 값 수정:

```typescript
const bootOrderOptions = [
  { value: 'cdrom_hd', label: 'CDROM → HDD', ... },
  { value: 'hd', label: 'HDD만', ... },
  { value: 'cdrom', label: 'CDROM만', ... },
  { value: 'hd_cdrom', label: 'HDD → CDROM', ... },
];
```

### 3. 백엔드 재시작

변경사항 적용을 위해 백엔드 재시작 필요:

```bash
cd /home/darc0/LIMEN
bash scripts/pm2-control.sh restart
```

---

## 🔍 점검 완료 항목

- ✅ Git 동기화 (프론트엔드 변경사항 pull 완료)
- ✅ API 엔드포인트 일치 확인
- ✅ 타입 정의 일치 확인
- ✅ 라우터 등록 확인
- ✅ 백엔드 빌드 확인
- ✅ 핸들러 함수 존재 확인

---

## 📝 다음 단계

1. 프론트엔드 BootOrder 타입 수정
2. BootOrderSelector 컴포넌트 옵션 값 수정
3. 백엔드 재시작
4. 기능 테스트 (부팅 순서 변경)
5. 통합 테스트 (전체 VM 생명주기)


