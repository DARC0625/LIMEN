# LIMEN 서비스 최적화 빠른 시작 가이드

**작성일**: 2025-01-14  
**버전**: 1.0

---

## 🚀 5분 안에 시작하기

### 1단계: 서버 재시작 (인덱스 자동 생성)

```bash
cd /home/darc0/LIMEN

# 백엔드 재시작
./scripts/start-LIMEN.sh restart

# 또는 systemd 사용 시
sudo systemctl restart limen
```

**결과**: 데이터베이스 인덱스가 자동으로 생성됩니다.

---

### 2단계: 인덱스 생성 확인 (선택사항)

```bash
# PostgreSQL에 연결하여 확인
psql -U postgres -d LIMEN -c "
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('vms', 'users', 'vm_snapshots')
ORDER BY tablename, indexname;
"
```

**예상 결과**: 8개 이상의 인덱스가 표시되어야 합니다.

---

### 3단계: 프론트엔드 타입 체크 (선택사항)

```bash
cd /home/darc0/LIMEN/frontend

# TypeScript 타입 체크
npx tsc --noEmit
```

**예상 결과**: 타입 오류가 없어야 합니다.

---

## ✅ 완료!

이제 LIMEN 서비스가 최적화된 상태로 실행 중입니다.

---

## 📊 최적화 효과 확인

### 자동으로 적용되는 최적화

1. **데이터베이스 인덱스**
   - VM 조회 성능 향상
   - 사용자 조회 성능 향상
   - 스냅샷 조회 성능 향상

2. **메모리 최적화**
   - 버퍼 풀 사용
   - 메모리 할당 감소

3. **타입 안정성**
   - 컴파일 타임 오류 감지 증가
   - 런타임 오류 감소

4. **코드 재사용성**
   - 공통 컴포넌트 사용 가능
   - 공통 훅 사용 가능

---

## 🔍 추가 검증 (선택사항)

### 번들 분석 실행

```bash
cd /home/darc0/LIMEN/frontend
./scripts/analyze-bundle.sh
```

**소요 시간**: 2-5분

### 성능 모니터링

```bash
# API 응답 시간 확인
time curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:18443/api/vms

# 데이터베이스 쿼리 성능 확인
psql -U postgres -d LIMEN -c "
SELECT query, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%vms%' 
ORDER BY mean_time DESC 
LIMIT 5;
"
```

---

## 📚 더 알아보기

- [최적화 빠른 참조](./optimization-quick-reference.md)
- [최적화 검증 가이드](./optimization-verification.md)
- [최적화 완료 보고서](./optimization-completion-report.md)

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-01-14






