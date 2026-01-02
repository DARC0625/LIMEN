# ISO 파일 참조 확인 가이드

## 현재 상태

### ✅ 정상 동작 확인

1. **DB 등록 상태**
   - 4개의 ISO 파일이 DB에 등록되어 있음
   - `os_type`과 경로가 올바르게 매핑됨

2. **실제 파일 존재**
   - `ubuntu-desktop.iso`: 6.0G ✓
   - `ubuntu-server.iso`: 3.1G ✓
   - `kali.iso`: 4.5G ✓
   - `windows.iso`: 파일 없음 ✗

3. **코드 로직**
   - `EnsureISO(osType)`: DB에서 `os_type`으로 ISO 경로 조회 ✓
   - 파일 존재 확인: `os.Stat()` 사용 ✓
   - libvirt XML 생성: ISO 경로가 CDROM 디바이스에 포함됨 ✓
   - 부팅 순서: CDROM 우선, 하드 디스크 다음 ✓

## ISO 파일 참조 흐름

```
1. VM 생성 요청
   ↓
2. os_type 전달 (예: "ubuntu-desktop")
   ↓
3. EnsureISO(osType) 호출
   ↓
4. DB 조회: SELECT * FROM vm_images WHERE os_type = 'ubuntu-desktop'
   ↓
5. 경로 확인: os.Stat("/home/darc0/projects/LIMEN/database/iso/ubuntu-desktop.iso")
   ↓
6. CreateVM에서 libvirt XML 생성
   ↓
7. CDROM 디바이스에 ISO 경로 포함
   <disk type='file' device='cdrom'>
     <source file='/home/darc0/projects/LIMEN/database/iso/ubuntu-desktop.iso'/>
   </disk>
   ↓
8. 부팅 순서 설정
   <boot dev='cdrom'/>
   <boot dev='hd'/>
   ↓
9. VM 시작 시 ISO에서 부팅
```

## 확인된 ISO 파일

| OS Type | DB 경로 | 실제 파일 | 상태 |
|---------|---------|----------|------|
| ubuntu-desktop | `/home/darc0/projects/LIMEN/database/iso/ubuntu-desktop.iso` | 6.0G | ✅ |
| ubuntu-server | `/home/darc0/projects/LIMEN/database/iso/ubuntu-server.iso` | 3.1G | ✅ |
| kali | `/home/darc0/projects/LIMEN/database/iso/kali.iso` | 4.5G | ✅ |
| windows | `/home/darc0/projects/LIMEN/database/iso/windows.iso` | 없음 | ❌ |

## 문제가 있는 경우

### Windows ISO 파일 없음

DB에는 등록되어 있지만 실제 파일이 없습니다. Windows VM을 생성하려면:
1. Windows ISO 파일을 `/home/darc0/projects/LIMEN/database/iso/windows.iso`에 업로드
2. 또는 DB에서 Windows ISO 레코드 삭제

## 코드 확인

### EnsureISO 함수 (`backend/internal/vm/service.go`)

```go
func (s *VMService) EnsureISO(osType string) (string, error) {
    var image models.VMImage
    if err := s.db.Where("os_type = ?", osType).First(&image).Error; err != nil {
        return "", fmt.Errorf("image not found for os type: %s", osType)
    }

    imagePath := image.Path

    // 경로 보정 로직
    if strings.Contains(imagePath, "/home/darc0/projects/") && 
       !strings.Contains(imagePath, "/home/darc0/projects/LIMEN") {
        imagePath = strings.Replace(imagePath, "/home/darc0/projects/", 
                                    "/home/darc0/projects/LIMEN/", 1)
        image.Path = imagePath
        s.db.Save(&image)
    }

    // 파일 존재 확인
    if _, err := os.Stat(imagePath); err == nil {
        return imagePath, nil
    }

    return "", fmt.Errorf("iso file not found at %s. please upload it manually", imagePath)
}
```

### CreateVM에서 ISO 사용 (`backend/internal/vm/service.go`)

```go
// 2. Ensure ISO exists (Using DB lookup)
isoPath, err := s.EnsureISO(osType)
if err != nil {
    return fmt.Errorf("failed to ensure iso: %v", err)
}

// 3. Define VM with CDROM boot enabled
vmXML := fmt.Sprintf(`
<domain type='kvm'>
  ...
  <os>
    <boot dev='cdrom'/>
    <boot dev='hd'/>
  </os>
  ...
  <devices>
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='%s'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
    </disk>
  </devices>
</domain>
`, ..., isoPath)
```

## 테스트 방법

### 1. ISO 파일 존재 확인

```bash
cd /home/darc0/projects/LIMEN
ls -lh database/iso/*.iso
```

### 2. DB 등록 확인

```bash
PGPASSWORD=0625 psql -h localhost -U postgres -d limen \
  -c "SELECT os_type, path FROM vm_images;"
```

### 3. VM 생성 테스트

```bash
# Ubuntu Desktop VM 생성
curl -X POST http://localhost:18443/api/vms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "test-ubuntu",
    "cpu": 2,
    "memory": 2048,
    "os_type": "ubuntu-desktop"
  }'
```

### 4. libvirt XML 확인

```bash
virsh dumpxml <vm-name> | grep -A 5 "device='cdrom'"
```

## 결론

✅ **ISO 파일 참조는 올바르게 작동하고 있습니다.**

- DB에서 `os_type`으로 ISO 경로를 조회
- 실제 파일 존재 확인
- libvirt XML에 올바르게 포함
- CDROM 디바이스로 마운트
- 부팅 순서가 CDROM 우선으로 설정

**주의사항**: Windows ISO 파일이 DB에는 등록되어 있지만 실제 파일이 없으므로, Windows VM을 생성하려면 ISO 파일을 업로드해야 합니다.




