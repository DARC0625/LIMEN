# 번들 분석 결과

> **LIMEN 프론트엔드 번들 크기 분석 결과**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [성능](./) > 번들 분석 결과

---

## 📊 빌드 결과

### 라우트 정보

```
Route (app)
┌ ○ /                    (Static)
├ ○ /_not-found          (Static)
├ ○ /admin/users         (Static)
├ ○ /login               (Static)
├ ○ /offline             (Static)
├ ○ /register            (Static)
└ ƒ /vnc/[id]            (Dynamic)
```

### 렌더링 방식

- **Static (○)**: 정적 사전 렌더링
- **Dynamic (ƒ)**: 서버에서 동적 렌더링

---

## 📦 번들 크기

### 빌드 결과

- **빌드 크기**: 8.0M (`.next` 폴더)
- **주요 청크**:
  - `node_modules_fe693df6._.js`: 251K
  - 기타 청크: 30K ~ 18K

### 최적화 상태

- ✅ 코드 스플리팅 적용됨
- ✅ 동적 import 사용 중
- ✅ Tree shaking 활성화

---

## 🔍 분석 방법

### Webpack 빌드 사용

Next.js 16.1.1은 기본적으로 Turbopack을 사용하므로, 번들 분석을 위해 Webpack 빌드를 사용해야 합니다:

```bash
npm run build:analyze
# package.json에 --webpack 플래그 추가됨
```

### 리포트 확인

빌드가 완료되면:
1. 브라우저가 자동으로 열림
2. `.next/analyze/` 폴더에 HTML 리포트 생성

---

## 📈 최적화 확인

### 적용된 최적화

1. **동적 Import**
   - VNCViewer (948K 제외)
   - SnapshotManager
   - UI 컴포넌트

2. **코드 스플리팅**
   - 라우트별 분리
   - 컴포넌트별 분리

3. **번들 최적화**
   - Tree shaking
   - Console 제거 (프로덕션)

---

## 🎯 다음 단계

1. **리포트 확인**
   - 브라우저에서 상세 분석 확인
   - 큰 의존성 식별

2. **추가 최적화**
   - 큰 모듈 최적화
   - 중복 코드 제거
   - 추가 코드 스플리팅

3. **성능 측정**
   - 실제 로딩 시간 측정
   - Web Vitals 확인

---

## 관련 문서

- [번들 분석 가이드](./bundle-analysis-guide.md)
- [번들 최적화](./bundle.md)
- [성능 최적화](./optimization.md)

---

**태그**: `#번들분석` `#결과` `#성능`

**카테고리**: 문서 > 프론트엔드 > 성능 > 번들 분석 결과

**마지막 업데이트**: 2024-12-14








