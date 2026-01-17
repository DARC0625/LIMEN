/**
 * 브라우저 BroadcastChannel Adapter
 * BroadcastChannel을 BroadcastPort 인터페이스로 래핑
 */
import { BroadcastPort } from '../ports/broadcastPort';

export function createBrowserBroadcastPort(channelName: string = 'auth_channel'): BroadcastPort | undefined {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return undefined;
  }

  const channel = new BroadcastChannel(channelName);
  return {
    postAuthEvent: (payload) => {
      channel.postMessage(payload);
    },
    close: () => {
      channel.close();
    },
  };
}
