/**
 * 메모리 Clock Adapter (테스트용)
 * ClockPort 인터페이스를 구현하지만 시간을 제어 가능
 * 테스트에서 만료/타이밍 로직을 결정적으로 테스트할 때 사용
 */
import { ClockPort } from '../ports/clockPort';

export interface MemoryClockPort extends ClockPort {
  // 테스트용 헬퍼 메서드
  setNow(timestamp: number): void;
  advance(ms: number): void;
}

export function createMemoryClockPort(initialTime: number = Date.now()): MemoryClockPort {
  let currentTime = initialTime;

  return {
    now: () => currentTime,
    // 테스트용 헬퍼
    setNow: (timestamp: number) => { currentTime = timestamp; },
    advance: (ms: number) => { currentTime += ms; },
  };
}
