# API 클라이언트

> **LIMEN 프론트엔드 API 클라이언트 라이브러리**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [라이브러리](./) > API 클라이언트

---

## 📋 목차

1. [API 클라이언트 개요](#api-클라이언트-개요)
2. [주요 API 그룹](#주요-api-그룹)
3. [사용 예제](#사용-예제)

---

## API 클라이언트 개요

### 위치

`lib/api.ts`

### 주요 기능

- JWT 토큰 관리
- 자동 인증 헤더 추가
- 에러 처리
- TypeScript 타입 정의

---

## 주요 API 그룹

### authAPI

인증 관련 API

```typescript
authAPI.login({ username, password })
authAPI.register({ username, password })
```

### vmAPI

VM 관리 API

```typescript
vmAPI.list()
vmAPI.create({ name, cpu, memory, os_type })
vmAPI.action(id, action, cpu?, memory?)
```

### snapshotAPI

스냅샷 관리 API

```typescript
snapshotAPI.list(vmId)
snapshotAPI.create(vmId, name, description)
snapshotAPI.restore(snapshotId)
snapshotAPI.delete(snapshotId)
```

### quotaAPI

할당량 API

```typescript
quotaAPI.get()
quotaAPI.update({ max_cpu, max_memory })
```

### adminAPI

관리자 API

```typescript
adminAPI.listUsers()
adminAPI.createUser({ username, password, role })
adminAPI.updateUser(id, data)
adminAPI.deleteUser(id)
```

---

## 사용 예제

### 기본 사용

```typescript
import { vmAPI, authAPI } from '../lib/api';

// 로그인
const response = await authAPI.login({
  username: 'admin',
  password: 'password'
});

// VM 목록 조회
const vms = await vmAPI.list();
```

---

## 관련 문서

- [API 통합 가이드](../02-development/api-integration.md)
- [Hooks](../04-hooks/)

---

**태그**: `#API` `#클라이언트` `#라이브러리`

**카테고리**: 문서 > 프론트엔드 > 라이브러리 > API 클라이언트

**마지막 업데이트**: 2024-12-14








