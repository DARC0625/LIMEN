/**
 * 브라우저 Clock Adapter
 * Date.now()를 ClockPort 인터페이스로 래핑
 */
import { ClockPort } from '../ports/clockPort';

export function createBrowserClockPort(): ClockPort {
  return {
    now: () => Date.now(),
  };
}
