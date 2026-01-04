/**
 * 포맷팅 유틸리티 함수 테스트
 */

import {
  formatBytes,
  formatDate,
  formatNumber,
  formatPercent,
  formatDuration,
  formatDateKR,
  formatRelativeTime,
  formatDateSimple,
  formatTimeSimple,
} from '../format';

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('should handle custom decimals', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB');
    expect(formatBytes(1536, 2)).toBe('1.5 KB');
    expect(formatBytes(1536, 3)).toBe('1.5 KB');
  });

  it('should handle negative decimals', () => {
    expect(formatBytes(1024, -1)).toBe('1 KB');
  });

  it('should handle fractional bytes', () => {
    expect(formatBytes(512, 2)).toBe('512 Bytes');
    expect(formatBytes(1.5, 2)).toBe('1.5 Bytes');
  });

  it('should handle very large numbers', () => {
    const pb = 1024 * 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(pb)).toContain('PB');
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should format recent dates correctly', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    expect(formatDate(oneMinuteAgo)).toContain('minute');
    expect(formatDate(oneHourAgo)).toContain('hour');
    expect(formatDate(oneDayAgo)).toContain('day');
  });

  it('should format "Just now" for very recent dates', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const justNow = new Date(now.getTime() - 30 * 1000);
    expect(formatDate(justNow)).toBe('Just now');
  });

  it('should format dates older than 7 days', () => {
    const oldDate = new Date('2024-01-01T12:00:00Z');
    const result = formatDate(oldDate);
    expect(result).toMatch(/January|Jan/); // 영어 로케일
  });

  it('should handle string dates', () => {
    const dateString = '2024-01-15T11:00:00Z';
    const result = formatDate(dateString);
    expect(result).toContain('hour');
  });

  it('should handle Date objects', () => {
    const date = new Date('2024-01-15T11:00:00Z');
    const result = formatDate(date);
    expect(result).toContain('hour');
  });

  it('should handle invalid dates', () => {
    expect(formatDate('invalid')).toBe('Invalid Date');
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });

  it('should handle plural forms correctly', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    expect(formatDate(twoMinutesAgo)).toContain('minutes');
    expect(formatDate(twoHoursAgo)).toContain('hours');
    expect(formatDate(twoDaysAgo)).toContain('days');
  });
});

describe('formatNumber', () => {
  it('should format numbers with thousand separators', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(123)).toBe('123');
  });
});

describe('formatPercent', () => {
  it('should format percentages correctly', () => {
    expect(formatPercent(50, 100)).toBe('50.0%');
    expect(formatPercent(1, 3)).toBe('33.3%');
    expect(formatPercent(0, 0)).toBe('0%');
  });
});

describe('formatDuration', () => {
  it('should format durations correctly', () => {
    expect(formatDuration(30)).toBe('30초');
    expect(formatDuration(90)).toBe('1분 30초');
    expect(formatDuration(60)).toBe('1분');
    expect(formatDuration(3660)).toBe('1시간 1분');
  });

  it('should handle zero seconds', () => {
    expect(formatDuration(0)).toBe('0초');
  });

  it('should handle minutes without seconds', () => {
    expect(formatDuration(120)).toBe('2분');
    expect(formatDuration(180)).toBe('3분');
  });

  it('should handle hours without minutes', () => {
    expect(formatDuration(3600)).toBe('1시간');
    expect(formatDuration(7200)).toBe('2시간');
  });

  it('should handle hours with minutes', () => {
    expect(formatDuration(3660)).toBe('1시간 1분');
    expect(formatDuration(7320)).toBe('2시간 2분');
  });

  it('should handle very large durations', () => {
    const largeDuration = 86400; // 24시간
    expect(formatDuration(largeDuration)).toContain('시간');
  });
});

describe('formatDateKR', () => {
  it('should format dates in Korean locale', () => {
    const result = formatDateKR('2024-01-15T12:00:00Z');
    expect(result).toMatch(/\d{4}/); // Contains year
    expect(result).not.toBe('-');
  });

  it('should handle empty strings', () => {
    expect(formatDateKR('')).toBe('-');
    expect(formatDateKR(null as any)).toBe('-');
  });

  it('should handle invalid dates', () => {
    // Invalid dates might return the original string or a formatted version
    const result = formatDateKR('invalid');
    expect(typeof result).toBe('string');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should format relative times correctly', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    expect(formatRelativeTime(oneMinuteAgo)).toBe('1분 전');
    expect(formatRelativeTime(oneHourAgo)).toBe('1시간 전');
    expect(formatRelativeTime(oneDayAgo)).toBe('1일 전');
  });

  it('should format "방금 전" for very recent times', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const justNow = new Date(now.getTime() - 30 * 1000);
    expect(formatRelativeTime(justNow)).toBe('방금 전');
  });

  it('should format dates older than 7 days', () => {
    const oldDate = new Date('2024-01-01T12:00:00Z');
    const result = formatRelativeTime(oldDate);
    // 7일 이상이면 formatDateKR이 호출됨
    expect(result).not.toBe('-');
  });

  it('should handle string dates', () => {
    const dateString = '2024-01-15T11:00:00Z';
    const result = formatRelativeTime(dateString);
    expect(result).toContain('시간 전');
  });

  it('should handle empty values', () => {
    expect(formatRelativeTime('')).toBe('-');
    expect(formatRelativeTime(null as any)).toBe('-');
  });
});

describe('formatDateSimple', () => {
  it('should format dates in simple format', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    expect(formatDateSimple(date)).toBe('2024-01-15');
    expect(formatDateSimple('2024-01-15T12:00:00Z')).toBe('2024-01-15');
  });

  it('should handle single digit months and days', () => {
    const date = new Date('2024-01-05T12:00:00Z');
    expect(formatDateSimple(date)).toBe('2024-01-05');
  });

  it('should handle empty values', () => {
    expect(formatDateSimple('')).toBe('-');
    expect(formatDateSimple(null as any)).toBe('-');
  });
});

describe('formatTimeSimple', () => {
  it('should format times in simple format', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    expect(formatTimeSimple(date)).toBe('14:30');
    expect(formatTimeSimple('2024-01-15T14:30:00Z')).toBe('14:30');
  });

  it('should handle single digit hours and minutes', () => {
    const date = new Date('2024-01-15T09:05:00Z');
    expect(formatTimeSimple(date)).toBe('09:05');
  });

  it('should handle midnight', () => {
    const date = new Date('2024-01-15T00:00:00Z');
    expect(formatTimeSimple(date)).toBe('00:00');
  });

  it('should handle empty values', () => {
    expect(formatTimeSimple('')).toBe('-');
    expect(formatTimeSimple(null as any)).toBe('-');
  });
});

