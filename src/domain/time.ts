const MIN = 60_000;
const HOUR = 60 * MIN;

/** Spec S9: only correct for clock skew when the device is off by 2 minutes or more. */
export const SKEW_THRESHOLD_MS = 2 * MIN;

export function effectiveOffset(measuredOffsetMs: number | null): number {
  if (measuredOffsetMs == null) return 0;
  return Math.abs(measuredOffsetMs) >= SKEW_THRESHOLD_MS ? measuredOffsetMs : 0;
}

/** "9:02 PM" in the device's local time zone. */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "just now", "12 min ago", "3 h 50 min ago", "2 days ago". */
export function formatAgo(thenMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - thenMs);
  if (diff < MIN) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < 24 * HOUR) {
    const h = Math.floor(diff / HOUR);
    const m = Math.floor((diff % HOUR) / MIN);
    return m ? `${h} h ${m} min ago` : `${h} h ago`;
  }
  const d = Math.floor(diff / (24 * HOUR));
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Duration without "ago", e.g. "3 h 50 min", "50 min". */
export function formatDuration(diffMs: number): string {
  const diff = Math.max(0, diffMs);
  if (diff < MIN) return 'less than 1 min';
  const h = Math.floor(diff / HOUR);
  const m = Math.floor((diff % HOUR) / MIN);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Local midnight of the day containing `ms` (spec: "a day" = device local midnight [guess]). */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameLocalDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}

/** Big "time since" display: [["2","h"],["10","m"]] + " ago"; null under a minute. */
export function elapsedParts(diffMs: number): Array<[string, string]> | null {
  const diff = Math.max(0, diffMs);
  if (diff < MIN) return null;
  if (diff >= 48 * HOUR) return [[String(Math.floor(diff / (24 * HOUR))), 'd']];
  const h = Math.floor(diff / HOUR);
  const m = Math.floor((diff % HOUR) / MIN);
  if (!h) return [[String(m), 'm']];
  return m ? [[String(h), 'h'], [String(m), 'm']] : [[String(h), 'h']];
}

/** "You and Dad", "You, Dad and Grandma". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
