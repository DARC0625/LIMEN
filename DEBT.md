# 기술부채 목록 (Technical Debt)

이 문서는 LIMEN 프로젝트의 기술부채를 추적합니다. 각 항목은 파일 경로, 문제, 조치, 우선순위를 포함합니다.

## 우선순위
- **P0**: 즉시 조치 필요 (보안/안정성 위험)
- **P1**: 단기 조치 필요 (기능/성능 영향)
- **P2**: 중기 조치 필요 (유지보수성)
- **P3**: 장기 개선 (최적화/리팩토링)

---

## P0 - 즉시 조치 필요

1. **backend/internal/handlers/api.go** - PII(개인정보) 로깅 마스킹 미흡
   - 문제: 토큰, 이메일, Authorization 헤더가 로그에 평문으로 기록됨
   - 조치: 로깅 전 PII 마스킹 유틸리티 추가 및 적용
   - 우선순위: P0 (보안/규정 준수)

2. **backend/internal/vm/service.go** - libvirt 호출 타임아웃/동시성 제한 없음
   - 문제: 동시 다수 VM 생성 시 백엔드 장애 가능성
   - 조치: 타임아웃 설정 및 동시성 제한 큐 구현
   - 우선순위: P0 (안정성)

3. **backend/internal/handlers/api.go** - 인증/권한 체크가 각 핸들러에 분산
   - 문제: 권한 체크 로직이 여러 핸들러에 중복 구현됨
   - 조치: 미들웨어/가드 레이어로 중앙화
   - 우선순위: P0 (보안 일관성)

---

## P1 - 단기 조치 필요

4. **backend/internal/handlers/api.go** - 콘솔 토큰 발급/검증 정책 미표준화
   - 문제: TTL/클레임/issuer/audience/uuid binding이 하드코딩됨
   - 조치: security/tokenPolicy.go에 정책 중앙화
   - 우선순위: P1 (유지보수성)

5. **backend/internal/handlers/api.go** - 에러 응답 포맷 불일치
   - 문제: 토큰 관련 에러 응답 형식이 일관되지 않음
   - 조치: 표준 에러 응답 포맷 정의 및 통일
   - 우선순위: P1 (관측 가능성)

6. **frontend/** - E2E 테스트 플래그가 코드 전반에 분산
   - 문제: X-Limen-E2E 관련 코드가 여러 파일에 흩어져 있음
   - 조치: featureflags 폴더로 모으기 (백엔드는 완료)
   - 우선순위: P1 (코드 품질)

7. **backend/cmd/server/main.go** - 환경 변수 검증 부족
   - 문제: 필수 환경 변수 누락 시 런타임 에러 발생
   - 조치: 시작 시 환경 변수 검증 추가
   - 우선순위: P1 (운영 안정성)

8. **backend/internal/database/db.go** - DB 연결 풀 설정 최적화 필요
   - 문제: 동시 연결 수 제한이 기본값에 의존
   - 조치: 환경 변수로 연결 풀 크기 조정 가능하게
   - 우선순위: P1 (성능)

9. **backend/internal/handlers/api.go** - WebSocket 연결 리소스 정리 미흡
   - 문제: WebSocket 연결 종료 시 리소스 정리 로직 불완전
   - 조치: defer/cleanup 로직 강화
   - 우선순위: P1 (리소스 누수 방지)

10. **frontend/envoy.yaml** - Envoy 설정 중복
    - 문제: HTTP/HTTPS 리스너 설정이 중복됨
    - 조치: 공통 설정 추출 및 재사용
    - 우선순위: P1 (유지보수성)

---

## P2 - 중기 조치 필요

11. **backend/internal/metrics/metrics.go** - 메트릭 초기화 로직 분산
    - 문제: 메트릭 초기화가 여러 곳에서 발생
    - 조치: 단일 초기화 함수로 통합
    - 우선순위: P2 (코드 구조)

12. **backend/internal/handlers/api.go** - VM 생성 로직 복잡도 높음
    - 문제: HandleVMs 함수가 500+ 라인으로 과도하게 길음
    - 조치: VM 생성 로직을 별도 서비스로 분리
    - 우선순위: P2 (가독성)

13. **backend/internal/vm/service.go** - libvirt 에러 처리 일관성 부족
    - 문제: libvirt 에러 메시지가 사용자에게 직접 노출됨
    - 조치: 에러 변환 레이어 추가
    - 우선순위: P2 (사용자 경험)

14. **backend/internal/config/config.go** - 설정 검증 로직 부족
    - 문제: 잘못된 설정값이 런타임에만 발견됨
    - 조치: 시작 시 설정값 검증 추가
    - 우선순위: P2 (운영 안정성)

15. **backend/internal/handlers/api.go** - VNC WebSocket 핸들러 복잡도 높음
    - 문제: HandleVNC 함수가 인증/권한/WebSocket 업그레이드를 모두 처리
    - 조치: 인증/권한을 미들웨어로 분리
    - 우선순위: P2 (단일 책임 원칙)

16. **frontend/** - 프론트엔드 타입 안정성 개선 필요
    - 문제: any 타입 사용이 많음
    - 조치: 엄격한 타입 정의 및 타입 가드 추가
    - 우선순위: P2 (타입 안정성)

17. **backend/internal/handlers/api.go** - 쿼리 파라미터 검증 부족
    - 문제: UUID 형식 검증이 일관되지 않음
    - 조치: 공통 검증 유틸리티 추가
    - 우선순위: P2 (데이터 무결성)

18. **backend/internal/cache/** - 캐시 무효화 전략 미흡
    - 문제: VM 상태 변경 시 관련 캐시 무효화가 불완전
    - 조치: 이벤트 기반 캐시 무효화 구현
    - 우선순위: P2 (데이터 일관성)

---

## P3 - 장기 개선

19. **backend/internal/handlers/api.go** - 로깅 레벨 최적화
    - 문제: 개발/프로덕션 환경별 로깅 레벨 차별화 부족
    - 조치: 환경별 로깅 레벨 설정 및 구조화
    - 우선순위: P3 (관측 가능성)

20. **backend/internal/vm/service.go** - VM 상태 동기화 최적화
    - 문제: libvirt와 DB 간 상태 동기화가 폴링 기반
    - 조치: 이벤트 기반 동기화로 전환
    - 우선순위: P3 (성능)

21. **backend/** - 테스트 커버리지 향상
    - 문제: 핵심 비즈니스 로직 테스트 커버리지 낮음
    - 조치: 단위 테스트 및 통합 테스트 추가
    - 우선순위: P3 (품질 보증)

22. **backend/internal/handlers/api.go** - API 버전 관리
    - 문제: API 버전 관리 전략 없음
    - 조치: /api/v1/, /api/v2/ 등 버전 관리 도입
    - 우선순위: P3 (호환성)

23. **backend/internal/database/** - 마이그레이션 롤백 전략
    - 문제: DB 마이그레이션 롤백 메커니즘 부족
    - 조치: 롤백 가능한 마이그레이션 시스템 구축
    - 우선순위: P3 (운영 안정성)

24. **frontend/** - 번들 크기 최적화
    - 문제: 프론트엔드 번들 크기가 큼
    - 조치: 코드 스플리팅 및 트리 쉐이킹 최적화
    - 우선순위: P3 (성능)

25. **backend/internal/handlers/api.go** - API 문서화 자동화
    - 문제: Swagger 문서가 코드와 불일치 가능성
    - 조치: 코드에서 자동 생성 및 CI에서 검증
    - 우선순위: P3 (문서화)

---

## 완료된 항목

- ✅ **backend/internal/featureflags/** - E2E 테스트 플래그 중앙화 (A1 완료)

---

## 참고
- 이 문서는 정기적으로 업데이트되어야 합니다
- 새로운 기술부채 발견 시 즉시 추가
- 완료된 항목은 "완료된 항목" 섹션으로 이동
