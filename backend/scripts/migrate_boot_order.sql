-- Migration script for VM boot order and installation status
-- Run this script to add new columns to the vms table

-- 1. InstallationStatus 컬럼 추가
ALTER TABLE vms ADD COLUMN IF NOT EXISTS installation_status VARCHAR(20) DEFAULT 'NotInstalled';

-- 2. BootOrder 컬럼 추가
ALTER TABLE vms ADD COLUMN IF NOT EXISTS boot_order VARCHAR(20) DEFAULT 'cdrom_hd';

-- 3. DiskPath 컬럼 추가
ALTER TABLE vms ADD COLUMN IF NOT EXISTS disk_path VARCHAR(512);

-- 4. DiskSize 컬럼 추가
ALTER TABLE vms ADD COLUMN IF NOT EXISTS disk_size INTEGER DEFAULT 20;

-- 5. 기존 VM들의 DiskPath 설정 (UUID 기반)
UPDATE vms 
SET disk_path = CONCAT('/home/darc0/LIMEN/backend/database/vms/', uuid, '.qcow2')
WHERE disk_path IS NULL;

-- 6. 기존 VM들의 기본값 설정
UPDATE vms 
SET installation_status = 'NotInstalled'
WHERE installation_status IS NULL;

UPDATE vms 
SET boot_order = 'cdrom_hd'
WHERE boot_order IS NULL;

UPDATE vms 
SET disk_size = 20
WHERE disk_size IS NULL;

-- 7. 인덱스 추가 (선택사항, 성능 향상)
CREATE INDEX IF NOT EXISTS idx_vm_installation_status ON vms(installation_status);
CREATE INDEX IF NOT EXISTS idx_vm_boot_order ON vms(boot_order);

