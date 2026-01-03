# 프론트엔드 재구축 가이드

> [← 홈](../../00-home.md) | [프론트엔드](../) | [가이드](./) | [재구축 가이드](./FRONTEND_RECONSTRUCTION_GUIDE.md)

## ⚠️ 참고사항

이 문서는 과거 프론트엔드 개발 시 작성된 가이드입니다. 현재 LIMEN 프로젝트는 프론트엔드가 제거된 백엔드 전용 구조입니다. 향후 프론트엔드 재구축 시 참고용으로 보관됩니다.

---

## 개요

이 문서는 LIMEN 프론트엔드를 재구축하기 위한 단계별 가이드를 제공합니다.

---

## 재구축 단계

### 1. 프로젝트 초기화

```bash
npx create-next-app@latest limen-frontend
cd limen-frontend
```

### 2. 의존성 설치

```bash
npm install axios
npm install @tanstack/react-query
npm install zustand
```

### 3. 환경 변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:18443
NEXT_PUBLIC_API_URL=http://localhost:18443/api
NEXT_PUBLIC_AGENT_URL=http://localhost:9000
```

### 4. API 클라이언트 설정

`lib/api.ts` 파일 생성:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 5. 인증 시스템 구현

`lib/auth.ts` 파일 생성:

```typescript
export async function login(username: string, password: string) {
  const response = await api.post('/auth/login', {
    username,
    password,
  });
  localStorage.setItem('auth_token', response.data.token);
  return response.data;
}

export function logout() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}
```

### 6. VM 관리 기능 구현

`hooks/useVMs.ts` 파일 생성:

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useVMs() {
  return useQuery({
    queryKey: ['vms'],
    queryFn: async () => {
      const response = await api.get('/vms');
      return response.data;
    },
  });
}
```

---

## 주요 기능

### 1. VM 목록 조회

```typescript
const { data: vms, isLoading } = useVMs();
```

### 2. VM 생성

```typescript
const createVM = async (vmData: VMData) => {
  await api.post('/vms', vmData);
};
```

### 3. VM 액션

```typescript
const startVM = async (vmId: number) => {
  await api.post(`/vms/${vmId}/action`, { action: 'start' });
};
```

### 4. WebSocket 연결

```typescript
const ws = new WebSocket(
  `ws://localhost:18443/ws/vm-status?vm_id=${vmId}&token=${token}`
);
```

---

## 관련 문서

- [프론트엔드 개발자 가이드](./FRONTEND_DEVELOPER_GUIDE.md)
- [배포 전략](./FRONTEND_DEPLOYMENT_STRATEGY.md)
- [API 레퍼런스](../../02-development/api/reference.md)

---

**태그**: `#프론트엔드` `#재구축` `#가이드` `#과거-기록`

**카테고리**: 프론트엔드 > 가이드 > 재구축 가이드

**상태**: 과거 기록 (프론트엔드 제거됨)

**마지막 업데이트**: 2024-12-23
