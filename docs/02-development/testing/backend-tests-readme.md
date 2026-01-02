# 테스트 모음

- 단위 테스트: `go test ./...`
- 통합 테스트: `go test -tags=integration ./tests/integration` (서버가 실행 중이어야 함)

## 통합 테스트 실행 방법

1. LIMEN 서버가 실행 중이어야 합니다.
   - 예: `docker-compose up` 또는 `systemctl start limen.service`

2. 기본 엔드포인트를 환경 변수로 지정합니다.
   ```bash
   export LIMEN_BASE_URL=http://localhost:18443
   go test -tags=integration ./tests/integration
   ```

> `LIMEN_BASE_URL`가 설정되지 않으면 테스트는 자동으로 건너뜁니다.
