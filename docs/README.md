# LIMEN 문서

이 디렉토리는 LIMEN 프로젝트의 모든 문서를 중앙에서 관리합니다.

## 📁 문서 구조

### architecture/
시스템 아키텍처 및 설계 문서
- 네트워크 구조
- 데이터베이스 스키마
- 시스템 아키텍처 다이어그램

### api/
API 문서
- REST API 명세
- WebSocket API 명세
- 인증/인가 가이드
- API 변경 이력

### development/
개발 가이드
- 개발 환경 설정
- 코딩 컨벤션
- Git 워크플로우
- 프론트엔드 개발 가이드
- 백엔드 개발 가이드

### components/
컴포넌트 문서
- 프론트엔드 컴포넌트 문서
- UI/UX 가이드
- 컴포넌트 사용 예제

### deployment/
배포 가이드
- 배포 프로세스
- 환경 변수 설정
- 트러블슈팅
- 모니터링 가이드

## 🔄 문서 업데이트 규칙

1. **API 변경 시**: `api/` 디렉토리의 관련 문서 업데이트 필수
2. **컴포넌트 변경 시**: `components/` 디렉토리의 관련 문서 업데이트 필수
3. **아키텍처 변경 시**: `architecture/` 디렉토리의 관련 문서 업데이트 필수
4. **배포 프로세스 변경 시**: `deployment/` 디렉토리의 관련 문서 업데이트 필수

## 📝 문서 작성 가이드

- Markdown 형식 사용
- 코드 예제는 언어별 syntax highlighting 사용
- 다이어그램은 Mermaid 또는 이미지로 제공
- 변경 이력은 각 문서 하단에 기록

## 🔗 관련 링크

- [프론트엔드 개발 가이드](../frontend/DEVELOPMENT.md)
- [백엔드 개발 가이드](../backend/README.md)
- [통합 가이드](./INTEGRATION_GUIDE.md)

