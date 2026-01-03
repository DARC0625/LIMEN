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
  });

  it('should handle custom decimals', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB');
    expect(formatBytes(1536, 2)).toBe('1.5 KB');
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

  it('should handle invalid dates', () => {
    expect(formatDate('invalid')).toBe('Invalid Date');
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

    expect(formatRelativeTime(oneMinuteAgo)).toBe('1분 전');
    expect(formatRelativeTime(oneHourAgo)).toBe('1시간 전');
  });

  it('should handle empty values', () => {
    expect(formatRelativeTime('')).toBe('-');
  });
});

describe('formatDateSimple', () => {
  it('should format dates in simple format', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    expect(formatDateSimple(date)).toBe('2024-01-15');
    expect(formatDateSimple('2024-01-15T12:00:00Z')).toBe('2024-01-15');
  });

  it('should handle empty values', () => {
    expect(formatDateSimple('')).toBe('-');
  });
});

describe('formatTimeSimple', () => {
  it('should format times in simple format', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    expect(formatTimeSimple(date)).toBe('14:30');
    expect(formatTimeSimple('2024-01-15T14:30:00Z')).toBe('14:30');
  });

  it('should handle empty values', () => {
    expect(formatTimeSimple('')).toBe('-');
  });
});

