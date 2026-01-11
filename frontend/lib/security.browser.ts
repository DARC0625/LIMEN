// 브라우저 전용 보안 함수들
// Edge 번들에 포함되지 않도록 완전 분리

export function notifyAuthEvent(reason?: string): void {
  const channel = new BroadcastChannel('auth_channel');
  channel.postMessage({ type: 'AUTH_EVENT', reason, action: 'log' });
  channel.close();
}
