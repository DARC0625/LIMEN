# 번들 분석 노트

> **LIMEN 프론트엔드 번들 분석 시 주의사항 및 해결 방법**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [성능](./) > 번들 분석 노트

---

## ⚠️ 알려진 문제

### @novnc/novnc의 top-level await

**문제:**
- `@novnc/novnc` 라이브러리가 top-level await를 사용
- Webpack 빌드에서 오류 발생

**해결 방법:**
- `next.config.js`에 Webpack 설정 추가
- VNCViewer는 이미 동적 import로 처리되어 실제 사용에는 문제 없음

**설정:**
```javascript
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
  }
  return config;
},
```

---

## 📊 생성된 리포트

### 리포트 파일

- `.next/analyze/nodejs.html` (269K)
  - Node.js 서버 번들 분석
  - 서버 사이드 코드 분석

- `.next/analyze/edge.html` (366K)
  - Edge 런타임 번들 분석
  - Edge 함수 번들 분석

### 확인 방법

1. 브라우저에서 HTML 파일 열기
2. 번들 크기 시각화 확인
3. 큰 의존성 식별

---

## 🔧 빌드 설정

### Webpack 빌드 사용

Next.js 16.1.1은 기본적으로 Turbopack을 사용하므로, 번들 분석을 위해 Webpack 빌드를 사용해야 합니다:

```bash
npm run build:analyze
# --webpack 플래그가 package.json에 추가됨
```

### Turbopack 분석기 (향후)

Next.js의 새로운 Turbopack 분석기를 사용할 수도 있습니다:

```bash
next experimental-analyze
```

---

## 📈 분석 결과 활용

### 확인 사항

1. **큰 의존성**
   - 번들에서 큰 비중을 차지하는 라이브러리
   - 동적 import 적용 가능 여부

2. **중복 코드**
   - 여러 번들에 포함된 코드
   - 공통 코드 분리 필요 여부

3. **최적화 포인트**
   - 추가 코드 스플리팅 가능 영역
   - 불필요한 의존성 제거

---

## 관련 문서

- [번들 분석 가이드](./bundle-analysis-guide.md)
- [번들 분석 결과](./bundle-analysis-results.md)
- [번들 최적화](./bundle.md)

---

**태그**: `#번들분석` `#문제해결` `#노트`

**카테고리**: 문서 > 프론트엔드 > 성능 > 번들 분석 노트

**마지막 업데이트**: 2024-12-14








