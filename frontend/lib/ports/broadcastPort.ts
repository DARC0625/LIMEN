/**
 * Broadcast 포트 인터페이스
 * 브라우저 BroadcastChannel 의존성을 추상화
 * 
 * 정석 원칙: core 로직은 BroadcastPort 인터페이스에만 의존하고,
 * 실제 구현(BroadcastChannel/noop)은 adapter에서 주입받음
 */
export interface BroadcastPort {
  postAuthEvent(payload: { type: string; reason?: string; action?: string }): void;
  close(): void;
}
