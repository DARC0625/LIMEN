/**
 * No-op Broadcast Adapter (테스트용)
 * BroadcastPort 인터페이스를 구현하지만 실제로는 아무것도 하지 않음
 * Node 환경이나 테스트에서 사용
 */
import { BroadcastPort } from '../ports/broadcastPort';

export function createNoopBroadcastPort(): BroadcastPort {
  return {
    postAuthEvent: () => {
      // no-op: 테스트에서 broadcast 호출 여부만 확인하고 싶을 때 사용
    },
    close: () => {
      // no-op
    },
  };
}
