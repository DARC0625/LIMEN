/**
 * Clock 포트 인터페이스
 * Date.now() 의존성을 추상화 (테스트에서 시간 제어 가능)
 * 
 * 정석 원칙: core 로직은 ClockPort 인터페이스에만 의존하고,
 * 실제 구현(Date.now()/mock)은 adapter에서 주입받음
 * 
 * 이렇게 하면 테스트에서 시간을 제어하여 만료/타이밍 로직을 결정적으로 테스트 가능
 */
export interface ClockPort {
  now(): number;
}
