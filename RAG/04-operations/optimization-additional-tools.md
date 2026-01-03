# 추가 최적화 도구 및 유틸리티

**작성일**: 2025-01-14  
**상태**: ✅ 추가 도구 생성 완료

---

## 📊 생성된 추가 도구

### 1. 성능 측정 스크립트

**파일**: `scripts/measure-performance.sh`

**기능**:
- API 응답 시간 측정 (5회 평균)
- 데이터베이스 쿼리 성능 확인
- 데이터베이스 인덱스 확인

**사용법**:
```bash
./scripts/measure-performance.sh
```

**측정 항목**:
- `/api/health` 응답 시간
- `/api/vms` 응답 시간
- `/api/auth/session` 응답 시간
- 느린 쿼리 Top 10
- 생성된 인덱스 목록

---

### 2. 유효성 검사 유틸리티

**파일**: `frontend/lib/utils/validation.ts`

**함수**:
- `isValidEmail(email: string)` - 이메일 유효성 검사
- `isValidUsername(username: string)` - 사용자 이름 유효성 검사
- `isValidPassword(password: string)` - 비밀번호 유효성 검사
- `isValidUUID(uuid: string)` - UUID 유효성 검사
- `isValidURL(url: string)` - URL 유효성 검사
- `isInRange(value: number, min: number, max: number)` - 숫자 범위 검사
- `isEmpty(value: unknown)` - 빈 값 체크
- `isValidLength(str: string, min: number, max: number)` - 문자열 길이 검사

**사용 예시**:
```typescript
import { isValidEmail, isValidPassword } from '../lib/utils/validation';

if (isValidEmail(email)) {
  // 이메일이 유효함
}

if (isValidPassword(password)) {
  // 비밀번호가 유효함
}
```

---

### 3. 날짜/시간 포맷팅 확장

**파일**: `frontend/lib/utils/format.ts` (확장)

**추가된 함수**:
- `formatRelativeTime(date: Date | string)` - 상대 시간 포맷팅 ("2분 전", "1시간 전")
- `formatDateSimple(date: Date | string)` - 간단한 날짜 형식 ("2024-01-14")
- `formatTimeSimple(date: Date | string)` - 간단한 시간 형식 ("14:30")

**사용 예시**:
```typescript
import { formatRelativeTime, formatDateSimple } from '../lib/utils/format';

const relativeTime = formatRelativeTime(new Date()); // "방금 전"
const simpleDate = formatDateSimple(new Date()); // "2024-01-14"
```

---

## 🎯 사용 가이드

### 성능 측정 실행

1. **서버가 실행 중인지 확인**
   ```bash
   curl http://localhost:18443/api/health
   ```

2. **성능 측정 실행**
   ```bash
   cd /home/darc0/LIMEN
   ./scripts/measure-performance.sh
   ```

3. **결과 확인**
   - API 응답 시간 평균값 확인
   - 느린 쿼리 확인 (pg_stat_statements 활성화 필요)
   - 인덱스 생성 여부 확인

---

### 유효성 검사 사용

```typescript
import { 
  isValidEmail, 
  isValidUsername, 
  isValidPassword 
} from '../lib/utils/validation';

// 폼 유효성 검사
const validateForm = (email: string, username: string, password: string) => {
  const errors: string[] = [];
  
  if (!isValidEmail(email)) {
    errors.push('유효한 이메일 주소를 입력하세요.');
  }
  
  if (!isValidUsername(username)) {
    errors.push('사용자 이름은 3-20자의 영문, 숫자, 언더스코어, 하이픈만 사용 가능합니다.');
  }
  
  if (!isValidPassword(password)) {
    errors.push('비밀번호는 최소 8자 이상이며, 영문, 숫자, 특수문자 중 2가지 이상을 포함해야 합니다.');
  }
  
  return errors;
};
```

---

## 📈 성능 목표

### API 응답 시간
- Health Check: < 50ms
- VM 목록: < 200ms
- 세션 확인: < 100ms

### 데이터베이스 쿼리
- 평균 쿼리 시간: < 100ms
- 느린 쿼리: 없음

---

## ✅ 검증 체크리스트

- [x] 성능 측정 스크립트 생성
- [x] 유효성 검사 유틸리티 생성
- [x] 날짜/시간 포맷팅 확장
- [x] 사용 가이드 작성

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-01-14

