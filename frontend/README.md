# LIMEN Frontend

VM Management Platform의 프론트엔드 애플리케이션입니다.

## 기술 스택

- **Framework**: Next.js 16.1.1
- **React**: 19.2.1
- **TypeScript**: 5.x
- **Styling**: TailwindCSS 4
- **State Management**: TanStack Query (React Query)
- **VNC Client**: @novnc/novnc 1.6.0

## 시작하기

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 시작 (포트 9444)
npm run dev
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 서버 시작
npm start
```

## 스크립트

### 통합 관리 스크립트

모든 관리 작업은 `scripts/manage.sh`를 통해 수행할 수 있습니다:

```bash
# 빌드
./scripts/manage.sh build limen      # LIMEN 빌드
./scripts/manage.sh build darc       # DARC 빌드
./scripts/manage.sh build all        # 전체 빌드

# 재시작
./scripts/manage.sh restart limen    # LIMEN 재시작
./scripts/manage.sh restart darc     # DARC 재시작
./scripts/manage.sh restart all      # 전체 재시작

# PM2 관리
./scripts/manage.sh pm2 setup        # PM2 서비스 설정
./scripts/manage.sh pm2 list         # 프로세스 목록
./scripts/manage.sh pm2 logs         # 로그 확인
./scripts/manage.sh pm2 restart limen-frontend  # LIMEN 재시작
./scripts/manage.sh pm2 restart darc.kr         # DARC 재시작

# 빌드 캐시 정리
./scripts/manage.sh clean
```

### NPM 스크립트

```bash
npm run dev              # 개발 서버 시작
npm run build            # 프로덕션 빌드
npm run build:verify     # 빌드 및 검증
npm run build:analyze     # 번들 분석
npm run start            # 프로덕션 서버 시작
npm run lint             # ESLint 실행
npm run manage           # 통합 관리 스크립트 실행
npm run restart          # LIMEN 재시작
npm run restart:all      # 전체 재시작
npm run pm2:setup        # PM2 설정
npm run pm2:logs         # PM2 로그 확인
npm run clean            # 빌드 캐시 정리
```

## 포트 설정

- **LIMEN Frontend**: 9444
- **DARC.KR**: 9445

## 환경 변수

프로덕션 환경에서는 다음 환경 변수를 설정해야 합니다:

```bash
NODE_ENV=production
PORT=9444
NEXT_PUBLIC_BACKEND_URL=http://10.0.0.100:18443
NEXT_PUBLIC_AGENT_URL=http://10.0.0.100:9000
```

## PM2 관리

PM2를 사용하여 프로세스를 관리합니다:

```bash
# PM2 설정 (최초 1회)
npm run pm2:setup

# 프로세스 목록
pm2 list

# 로그 확인
pm2 logs limen-frontend
pm2 logs darc.kr

# 재시작
pm2 restart limen-frontend
pm2 restart darc.kr

# 중지
pm2 stop all

# 시작
pm2 start all

# 설정 저장
pm2 save
```

## 주요 기능

- **VM 관리**: 가상 머신 생성, 시작, 중지, 삭제
- **VNC 콘솔**: 웹 기반 VNC 클라이언트 (noVNC)
- **실시간 상태 업데이트**: WebSocket을 통한 VM 상태 모니터링
- **사용자 관리**: 관리자 페이지에서 사용자 관리
- **리소스 할당량**: CPU, 메모리, 디스크 사용량 모니터링
- **반응형 디자인**: 모바일 및 데스크톱 지원
- **다크 모드**: 라이트/다크 테마 지원

## 문제 해결

### 빌드 파일 누락

```bash
# 빌드 캐시 정리 후 재빌드
npm run clean
npm run build
```

### 포트 충돌

```bash
# 포트를 사용 중인 프로세스 종료
lsof -ti:9444 | xargs kill -9
```

### PM2 프로세스 문제

```bash
# PM2 재설정
npm run pm2:setup
```

## 개발 가이드

### 코드 스타일

- TypeScript 사용
- ESLint 규칙 준수
- 컴포넌트는 함수형 컴포넌트 사용
- React Hooks 활용

### 파일 구조

```
frontend/
├── app/              # Next.js App Router 페이지
├── components/       # React 컴포넌트
├── hooks/           # Custom React Hooks
├── lib/             # 유틸리티 함수
├── scripts/         # 관리 스크립트
└── public/          # 정적 파일
```

## 라이선스

Private






