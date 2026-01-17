/**
 * Location 포트 인터페이스
 * 브라우저 window.location 의존성을 추상화
 * 
 * 정석 원칙: core 로직은 LocationPort 인터페이스에만 의존하고,
 * 실제 구현(window.location/memory)은 adapter에서 주입받음
 */
export interface LocationPort {
  getPathname(): string;
  redirect(url: string): void;
}
