# LIMEN 경로 가이드

## ⚠️ 중요: 올바른 경로

**LIMEN 서비스는 반드시 다음 경로에 설치되어야 합니다:**

```
/home/darc0/LIMEN/
```

## ❌ 잘못된 경로 (절대 사용하지 마세요)

다음 경로들은 **절대 사용하지 마세요**:

- ❌ `/home/darc0/limen/` (소문자 - 혼란의 원인)
- ❌ `/home/darc0/projects/LIMEN/` (오래된 경로)
- ❌ `/home/darc/LIMEN/` (잘못된 사용자명)
- ❌ `/path/to/LIMEN/` (예시 경로)

## ✅ 경로 검증

경로가 올바른지 확인하려면:

```bash
cd /home/darc0/LIMEN
./scripts/validate-paths.sh
```

이 스크립트는 잘못된 경로 참조를 찾아 알려줍니다.

## 📁 표준 디렉토리 구조

```
/home/darc0/LIMEN/
├── backend/              # Go 백엔드 서버
│   ├── cmd/server/       # 서버 진입점
│   ├── internal/         # 내부 패키지
│   ├── agent/            # Rust 에이전트
│   ├── logs/             # 로그 파일
│   └── .env              # 환경 변수
├── frontend/             # Next.js 프론트엔드
├── database/             # 데이터 저장소
│   ├── iso/              # ISO 이미지
│   └── vms/              # VM 디스크 이미지
├── scripts/              # 서비스 관리 스크립트
└── config/               # 설정 파일
```

## 🔧 설정 파일 경로

모든 설정 파일에서 경로를 하드코딩할 때는 다음을 사용하세요:

- **백엔드**: `/home/darc0/LIMEN/backend`
- **프론트엔드**: `/home/darc0/LIMEN/frontend`
- **데이터베이스**: `/home/darc0/LIMEN/database`
- **로그**: `/home/darc0/LIMEN/backend/logs`

## 🚫 중복 폴더 방지

`.gitignore`에 다음이 포함되어 있어 중복 폴더가 생성되지 않습니다:

```
limen/
/home/darc0/limen/
/home/darc0/projects/LIMEN/
```

## 📝 참고

- 모든 경로는 **대문자 LIMEN**을 사용합니다
- 사용자명은 **darc0**입니다 (0 포함)
- 경로에 공백이나 특수문자가 없습니다

