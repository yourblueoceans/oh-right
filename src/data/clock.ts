import { effectiveOffset } from '../domain/time';

/**
 * Server-aligned clock (S9). If this device's clock is 2+ minutes off from the server,
 * times we record and "N min ago" are corrected by the measured difference.
 */
class Clock {
  private measured: number | null = null;

  setMeasuredOffset(ms: number) {
    this.measured = ms;
  }

  get measuredOffset(): number | null {
    return this.measured;
  }

  now(): number {
    return Date.now() + effectiveOffset(this.measured);
  }
}

export const clock = new Clock();
