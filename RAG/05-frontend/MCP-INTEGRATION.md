# MCP 서버 통합 가이드

> **LIMEN 프론트엔드 문서를 MCP 서버에서 사용하기 위한 가이드**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](./README.md) > MCP 통합

---

## 📋 개요

이 문서는 LIMEN 프론트엔드 문서를 MCP (Model Context Protocol) 서버에서 활용하기 위한 구조 및 메타데이터를 정의합니다.

---

## 📁 문서 구조

### 계층적 구조

```
docs/05-frontend/
├── 00-overview.md          # 메인 개요
├── 01-architecture/         # 아키텍처 문서
│   └── structure.md
├── 02-development/         # 개발 가이드
│   └── api-integration.md
├── 03-components/          # 컴포넌트 문서
├── 04-hooks/               # Hooks 문서
├── 05-lib/                 # 라이브러리 문서
├── 06-deployment/          # 배포 가이드
│   └── strategy.md
├── 07-performance/         # 성능 최적화
│   └── optimization.md
└── 08-troubleshooting/     # 문제 해결
```

---

## 🏷️ 메타데이터 형식

각 문서는 다음 메타데이터를 포함합니다:

### 필수 메타데이터

```markdown
**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](./README.md) > [카테고리](./) > 문서명

**태그**: `#태그1` `#태그2` `#태그3`

**카테고리**: 문서 > 프론트엔드 > 카테고리 > 문서명

**마지막 업데이트**: YYYY-MM-DD
```

### 선택적 메타데이터

```markdown
**관련 문서**: 
- [문서1](./path1.md)
- [문서2](./path2.md)

**참고 자료**:
- [외부 링크](https://example.com)
```

---

## 🔍 검색 키워드

### 주요 키워드

- `프론트엔드`, `Next.js`, `React`, `TypeScript`
- `API`, `인증`, `WebSocket`, `VNC`
- `배포`, `성능`, `최적화`, `PWA`
- `컴포넌트`, `Hook`, `라이브러리`

### 태그 시스템

각 문서는 관련 태그를 포함합니다:

- **기술 스택**: `#Next.js`, `#React`, `#TypeScript`, `#Tailwind`
- **기능**: `#인증`, `#VM관리`, `#VNC`, `#스냅샷`
- **주제**: `#아키텍처`, `#개발가이드`, `#배포`, `#성능`
- **유형**: `#문서`, `#가이드`, `#API`, `#예제`

---

## 📊 문서 인덱스

### MCP 서버용 인덱스 구조

```json
{
  "frontend": {
    "overview": "00-overview.md",
    "architecture": {
      "structure": "01-architecture/structure.md"
    },
    "development": {
      "api": "02-development/api-integration.md"
    },
    "deployment": {
      "strategy": "06-deployment/strategy.md"
    },
    "performance": {
      "optimization": "07-performance/optimization.md"
    }
  }
}
```

---

## 🔗 문서 간 연결

### 브레드크럼

각 문서 상단에 브레드크럼을 포함하여 계층 구조를 명확히 합니다.

### 관련 문서

각 문서 하단에 관련 문서 링크를 포함합니다.

### 태그 기반 연결

동일한 태그를 가진 문서들은 자동으로 연결됩니다.

---

## 📝 문서 작성 가이드

### 구조

1. **제목**: 명확하고 설명적인 제목
2. **브레드크럼**: 문서 위치 표시
3. **목차**: 문서 구조 개요
4. **본문**: 상세 내용
5. **관련 문서**: 연결된 문서 링크
6. **메타데이터**: 태그, 카테고리, 업데이트 날짜

### 예제

```markdown
# 문서 제목

> **간단한 설명**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [카테고리](./) > 문서명

---

## 📋 목차

1. [섹션 1](#섹션-1)
2. [섹션 2](#섹션-2)

---

## 섹션 1

내용...

---

## 관련 문서

- [관련 문서1](./path1.md)
- [관련 문서2](./path2.md)

---

**태그**: `#태그1` `#태그2`

**카테고리**: 문서 > 프론트엔드 > 카테고리 > 문서명

**마지막 업데이트**: 2024-12-14
```

---

## 🚀 MCP 서버 사용 예제

### 문서 검색

```bash
# 키워드 검색
mcp search "VM 관리"

# 태그 검색
mcp search "#인증"

# 카테고리 검색
mcp search "문서 > 프론트엔드 > 개발가이드"
```

### 문서 조회

```bash
# 특정 문서 조회
mcp get "05-frontend/00-overview.md"

# 관련 문서 찾기
mcp related "API 통합"
```

### 문서 네비게이션

```bash
# 상위 문서
mcp parent "05-frontend/02-development/api-integration.md"

# 하위 문서
mcp children "05-frontend/01-architecture/"
```

---

## 관련 문서

- [프론트엔드 개요](./00-overview.md)
- [프론트엔드 문서 홈](./README.md)
- [위키 홈](../../00-home.md)

---

**태그**: `#MCP` `#서버` `#통합` `#문서시스템`

**카테고리**: 문서 > 프론트엔드 > MCP 통합

**마지막 업데이트**: 2024-12-14








