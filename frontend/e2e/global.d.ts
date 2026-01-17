/**
 * ✅ E2E 테스트 전용 전역 타입 선언
 * 
 * any를 코드에서 쓰지 말고 타입 시스템에 등록
 */

declare global {
  interface Window {
    // harness entry가 주입하는 함수들
    runS3?: () => Promise<{
      accessToken: string | null;
      refreshToken: string | null;
      expiresAt: string | null;
      refreshCompleted: boolean;
    }>;
    runS4?: () => Promise<{
      sessionCleared: boolean;
      // ✅ redirectToLogin 제거 (location.href 재정의 금지)
      // URL 검증은 Playwright API로: page.waitForURL() 또는 expect(page).toHaveURL()
    }>;

    // tokenManager를 주입해 쓸 때
    __TOKEN_MANAGER?: unknown;

    // harness 상태 플래그 (테스트에서 관측 가능)
    __SESSION_CLEARED?: boolean;
    __REFRESH_COMPLETED?: boolean;
    __REFRESH_CALL_COUNT?: number;
    // ✅ __REDIRECT_TO_LOGIN, __CURRENT_URL 제거 (location.href 재정의 금지)

    // ✅ harness-entry 최상단 비콘 (무조건 찍히는 비콘)
    __HARNESS_LOADED_AT?: number;
    __HARNESS_ERROR?: string | null;
    __HARNESS_READY?: boolean;

    // 필요하면 디버깅 훅
    __E2E__?: {
      runS3?: () => Promise<void> | void;
      runS4?: () => Promise<void> | void;
    };
  }
}

export {};
