# VM 미디어 관리 API 가이드

## 개요

VM의 ISO/CDROM 미디어를 조회하고 attach/detach하는 API입니다. VM이 실행 중이거나 중지된 상태에서 모두 사용 가능합니다.

## API 엔드포인트

### 1. 현재 연결된 미디어 조회
```
GET /api/vms/{uuid}/media
```

### 2. 미디어 연결/제거
```
POST /api/vms/{uuid}/media
```

### 3. 사용 가능한 ISO 목록 조회
```
GET /api/vms/isos
```

### 인증
- Bearer Token 인증 필요
- 헤더: `Authorization: Bearer <token>`

### 경로 파라미터
- `uuid`: VM의 UUID (형식: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## 요청 형식

### 1. 현재 연결된 미디어 조회 (GET)

VM에 현재 연결된 미디어 정보를 조회합니다.

**요청:**
```http
GET /api/vms/5b5abe76-9092-44cf-b462-351c2e3b4256/media
Authorization: Bearer <token>
```

**성공 응답 (200):**
```json
{
  "vm_uuid": "5b5abe76-9092-44cf-b462-351c2e3b4256",
  "media_path": "/path/to/ubuntu-22.04.iso",
  "attached": true
}
```

미디어가 연결되지 않은 경우:
```json
{
  "vm_uuid": "5b5abe76-9092-44cf-b462-351c2e3b4256",
  "media_path": "",
  "attached": false
}
```

### 2. 사용 가능한 ISO 목록 조회 (GET)

서버에 있는 모든 ISO 파일 목록을 조회합니다.

**요청:**
```http
GET /api/vms/isos
Authorization: Bearer <token>
```

**성공 응답 (200):**
```json
{
  "isos": [
    {
      "name": "ubuntu-22.04.iso",
      "path": "/path/to/iso/ubuntu-22.04.iso",
      "size": 2147483648,
      "modified": "2024-01-15T10:30:00Z"
    },
    {
      "name": "debian-12.iso",
      "path": "/path/to/iso/debian-12.iso",
      "size": 3221225472,
      "modified": "2024-01-20T14:20:00Z"
    }
  ],
  "count": 2
}
```

### 3. 미디어 제거 (Detach)

ISO/CDROM 미디어를 VM에서 제거합니다.

**요청:**
```http
POST /api/vms/5b5abe76-9092-44cf-b462-351c2e3b4256/media
Content-Type: application/json
Authorization: Bearer <token>

{
  "action": "detach"
}
```

**성공 응답 (200):**
```json
{
  "message": "Media detached successfully",
  "vm_uuid": "5b5abe76-9092-44cf-b462-351c2e3b4256"
}
```

### 4. 미디어 연결 (Attach)

ISO 파일을 VM의 CDROM에 연결합니다.

**요청:**
```http
POST /api/vms/5b5abe76-9092-44cf-b462-351c2e3b4256/media
Content-Type: application/json
Authorization: Bearer <token>

{
  "action": "attach",
  "iso_path": "/path/to/ubuntu-22.04.iso"
}
```

**성공 응답 (200):**
```json
{
  "message": "Media attached successfully",
  "vm_uuid": "5b5abe76-9092-44cf-b462-351c2e3b4256",
  "iso_path": "/path/to/ubuntu-22.04.iso"
}
```

## 에러 응답

### 400 Bad Request
```json
{
  "code": 400,
  "message": "Invalid action: invalid_action. Valid actions: attach, detach"
}
```

또는

```json
{
  "code": 400,
  "message": "ISO path is required for attach"
}
```

### 401 Unauthorized
```json
{
  "code": 401,
  "message": "Authentication required"
}
```

### 404 Not Found
```json
{
  "code": 404,
  "message": "VM not found"
}
```

### 500 Internal Server Error
```json
{
  "code": 500,
  "message": "Internal server error",
  "error": "ISO file not found: /path/to/nonexistent.iso"
}
```

## 프론트엔드 사용 예시

### JavaScript/TypeScript (Fetch API)

```typescript
// 현재 연결된 미디어 조회
async function getCurrentMedia(vmUuid: string, token: string) {
  const response = await fetch(`/api/vms/${vmUuid}/media`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get current media');
  }

  return await response.json();
}

// 사용 가능한 ISO 목록 조회
async function listISOs(token: string) {
  const response = await fetch('/api/vms/isos', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to list ISOs');
  }

  return await response.json();
}

// 미디어 제거
async function detachMedia(vmUuid: string, token: string) {
  const response = await fetch(`/api/vms/${vmUuid}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'detach'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to detach media');
  }

  return await response.json();
}

// 미디어 연결
async function attachMedia(vmUuid: string, isoPath: string, token: string) {
  const response = await fetch(`/api/vms/${vmUuid}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'attach',
      iso_path: isoPath
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to attach media');
  }

  return await response.json();
}
```

### Axios 사용 예시

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 인증 토큰 설정
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 미디어 제거
export async function detachMedia(vmUuid: string) {
  const response = await api.post(`/vms/${vmUuid}/media`, {
    action: 'detach'
  });
  return response.data;
}

// 미디어 연결
export async function attachMedia(vmUuid: string, isoPath: string) {
  const response = await api.post(`/vms/${vmUuid}/media`, {
    action: 'attach',
    iso_path: isoPath
  });
  return response.data;
}
```

### React 컴포넌트 예시

```tsx
import { useState, useEffect } from 'react';

function VMMediaControl({ vmUuid }: { vmUuid: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMedia, setCurrentMedia] = useState<string | null>(null);
  const [availableISOs, setAvailableISOs] = useState<any[]>([]);
  const [selectedISO, setSelectedISO] = useState('');

  // 컴포넌트 마운트 시 현재 미디어와 ISO 목록 로드
  useEffect(() => {
    loadCurrentMedia();
    loadISOs();
  }, [vmUuid]);

  const loadCurrentMedia = async () => {
    try {
      const token = localStorage.getItem('token');
      const data = await getCurrentMedia(vmUuid, token!);
      setCurrentMedia(data.attached ? data.media_path : null);
    } catch (err) {
      console.error('Failed to load current media:', err);
    }
  };

  const loadISOs = async () => {
    try {
      const token = localStorage.getItem('token');
      const data = await listISOs(token!);
      setAvailableISOs(data.isos || []);
    } catch (err) {
      console.error('Failed to load ISOs:', err);
    }
  };

  const handleDetach = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/vms/${vmUuid}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'detach' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to detach media');
      }

      const data = await response.json();
      alert(`성공: ${data.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async () => {
    if (!isoPath.trim()) {
      setError('ISO 경로를 입력하세요');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/vms/${vmUuid}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'attach',
          iso_path: isoPath
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to attach media');
      }

      const data = await response.json();
      alert(`성공: ${data.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>미디어 관리</h3>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      
      {/* 현재 연결된 미디어 표시 */}
      <div>
        <h4>현재 연결된 미디어:</h4>
        {currentMedia ? (
          <div>
            <p>{currentMedia}</p>
            <button onClick={handleDetach} disabled={loading}>
              {loading ? '제거 중...' : '미디어 제거'}
            </button>
          </div>
        ) : (
          <p>연결된 미디어가 없습니다.</p>
        )}
      </div>

      {/* ISO 선택 및 연결 */}
      <div>
        <h4>ISO 연결:</h4>
        <select
          value={selectedISO}
          onChange={(e) => setSelectedISO(e.target.value)}
          disabled={loading}
        >
          <option value="">ISO 선택...</option>
          {availableISOs.map((iso) => (
            <option key={iso.path} value={iso.path}>
              {iso.name} ({(iso.size / 1024 / 1024 / 1024).toFixed(2)} GB)
            </option>
          ))}
        </select>
        <button 
          onClick={handleAttach} 
          disabled={loading || !selectedISO}
        >
          {loading ? '연결 중...' : 'ISO 연결'}
        </button>
      </div>
    </div>
  );
}
```

## 주의사항

1. **ISO 파일 경로**: `iso_path`는 서버에서 접근 가능한 절대 경로여야 합니다.
2. **VM 상태**: VM이 실행 중이거나 중지된 상태 모두에서 작동합니다.
3. **CDROM 장치**: VM에 CDROM 장치가 설정되어 있어야 합니다. VM 생성 시 ISO 지원이 활성화되어 있어야 합니다.
4. **파일 존재 확인**: Attach 시 ISO 파일이 존재하는지 확인됩니다. 존재하지 않으면 500 에러가 반환됩니다.
5. **인증**: 모든 요청에 Bearer Token이 필요합니다.

## 백엔드 구현 세부사항

- **핸들러**: `backend/internal/handlers/api.go`의 `HandleVMMedia`
- **서비스**: `backend/internal/vm/service.go`의 `AttachMedia`, `DetachMedia`
- **라우팅**: `backend/internal/router/router.go`의 `/api/vms/{uuid}/media` (POST)

## 테스트

### cURL 예시

```bash
# 미디어 제거
curl -X POST http://localhost:18443/api/vms/5b5abe76-9092-44cf-b462-351c2e3b4256/media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"action":"detach"}'

# 미디어 연결
curl -X POST http://localhost:18443/api/vms/5b5abe76-9092-44cf-b462-351c2e3b4256/media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"action":"attach","iso_path":"/path/to/ubuntu.iso"}'
```

