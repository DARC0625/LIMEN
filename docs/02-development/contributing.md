# 기여 가이드

> [← 홈](../00-home.md) | [개발](../getting-started.md) | [기여하기](./contributing.md)

LIMEN에 기여해주셔서 감사합니다! 이 문서는 기여 방법을 안내합니다.

---

## 기여 방법

### 1. 이슈 확인

먼저 기존 이슈를 확인하여 중복을 방지하세요.

- [GitHub Issues](https://github.com/DARC0625/LIMEN/issues)

### 2. 브랜치 생성

새로운 기능이나 버그 수정을 위한 브랜치를 생성하세요.

```bash
git checkout -b feature/amazing-feature
# 또는
git checkout -b fix/bug-description
```

### 3. 코드 작성

명확하고 읽기 쉬운 코드를 작성하세요.

- **Go**: `gofmt`를 사용하여 코드를 포맷팅
- **Rust**: `cargo fmt`를 사용하여 코드를 포맷팅
- **커밋 메시지**: 명확하고 간결한 커밋 메시지 작성

### 4. 테스트

변경 사항에 대한 테스트를 작성하고 실행하세요.

```bash
# Go 테스트
cd backend
go test ./...

# Rust 테스트
cd backend/agent
cargo test

# CI 로컬 실행
make ci-local
```

### 5. Pull Request

변경 사항을 설명하는 PR을 생성하세요.

---

## 코딩 스타일

### Go

- `gofmt -s` 사용
- `golangci-lint` 규칙 준수
- 최대 라인 길이: 140자

### Rust

- `cargo fmt` 사용
- `cargo clippy` 경고 없음 (`-D warnings`)
- 표준 Rust 스타일 가이드 준수

---

## Pull Request 프로세스

1. **PR 템플릿 작성**
   - 변경 사항 설명
   - 테스트 결과
   - 관련 이슈 번호

2. **모든 테스트 통과 확인**
   - CI/CD 파이프라인 통과
   - 로컬 테스트 통과

3. **코드 리뷰 피드백에 응답**
   - 리뷰어의 피드백 반영
   - 질문에 답변

4. **변경 사항 승인 후 머지**

---

## 커밋 메시지 규칙

### 형식

```
<type>: <subject>

<body>

<footer>
```

### Type

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경

### 예시

```
feat: Add VM snapshot restore functionality

- Implement snapshot restore API endpoint
- Add restore validation logic
- Update API documentation

Closes #123
```

---

## 개발 환경 설정

1. 리포지토리 클론
2. 환경 변수 설정 (`backend/.env`)
3. 의존성 설치
4. 테스트 실행

자세한 내용은 [개발 시작하기](./getting-started.md) 참조.

---

## 질문이 있으신가요?

- 이슈를 생성하거나 기존 이슈에 댓글을 남겨주세요
- [GitHub Discussions](https://github.com/DARC0625/LIMEN/discussions) 활용

---

## 관련 문서

- [개발 시작하기](./getting-started.md)
- [API 레퍼런스](./api/reference.md)
- [테스트 가이드](./testing/)
- [CI/CD 설정](../03-deployment/ci-cd/setup.md)

---

**태그**: `#개발` `#기여` `#가이드` `#커밋` `#PR`

**카테고리**: 개발 > 기여

**마지막 업데이트**: 2024-12-23
