import { describe, expect, it } from 'vitest';
import { effectiveOffset, formatAgo, formatClock, formatDuration, startOfLocalDay } from './time';
import { parseSource } from './ids';

describe('time', () => {
  it('formats ago', () => {
    const now = 10 * 3_600_000;
    expect(formatAgo(now - 10_000, now)).toBe('just now');
    expect(formatAgo(now - 50 * 60_000, now)).toBe('50 min ago');
    expect(formatAgo(now - (3 * 60 + 50) * 60_000, now)).toBe('3 h 50 min ago');
    expect(formatAgo(now - 2 * 3_600_000, now)).toBe('2 h ago');
    expect(formatAgo(now + 5000, now)).toBe('just now');
  });

  it('formats durations and clock times', () => {
    expect(formatDuration(50 * 60_000)).toBe('50 min');
    expect(formatClock(new Date(2026, 10, 26, 21, 2).getTime())).toMatch(/^9:02\sPM$/);
    expect(formatClock(new Date(2026, 10, 26, 2, 10).getTime())).toMatch(/^2:10\sAM$/);
  });

  it('only corrects clock skew of 2 minutes or more (S9)', () => {
    expect(effectiveOffset(null)).toBe(0);
    expect(effectiveOffset(90_000)).toBe(0);
    expect(effectiveOffset(-119_999)).toBe(0);
    expect(effectiveOffset(120_000)).toBe(120_000);
    expect(effectiveOffset(-300_000)).toBe(-300_000);
  });

  it('local midnight', () => {
    const t = new Date(2026, 10, 26, 3, 0).getTime();
    expect(startOfLocalDay(t)).toBe(new Date(2026, 10, 26).getTime());
  });

  it('sticker source from ?via= (default qr)', () => {
    expect(parseSource('?via=nfc')).toBe('nfc');
    expect(parseSource('?via=qr')).toBe('qr');
    expect(parseSource('')).toBe('qr');
    expect(parseSource('?via=other')).toBe('qr');
  });
});
