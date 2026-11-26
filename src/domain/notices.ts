import type { DoseEvent, Medication, NoticeKind } from './types';
import { formatClock, formatDuration, startOfLocalDay, formatAgo } from './time';

/** Technical window for "two people pressed at nearly the same time". Not a dosing rule. */
export const ALSO_LOGGED_WINDOW_MS = 5 * 60_000;

export interface Notice {
  kind: NoticeKind;
  text: string;
}

function fmtDose(amount: number, unit: string): string {
  return `${amount} ${unit}`;
}

function activeFor(events: DoseEvent[], medicationId: string): DoseEvent[] {
  return events
    .filter((e) => e.medication_id === medicationId && e.status === 'given')
    .sort((a, b) => b.givenAtMs - a.givenAtMs);
}

export function lastDose(events: DoseEvent[], medicationId: string): DoseEvent | null {
  return activeFor(events, medicationId)[0] ?? null;
}

export function dosesToday(events: DoseEvent[], medicationId: string, nowMs: number): number {
  const start = startOfLocalDay(nowMs);
  return activeFor(events, medicationId).filter((e) => e.givenAtMs >= start && e.givenAtMs <= nowMs + 60_000).length;
}

/**
 * Soft notices shown on the Confirm screen before a dose is recorded.
 * The app never judges safety: it only compares against the plan the parent typed in.
 * An empty plan (null interval / null max) never produces interval/daily notices.
 */
export function computeNotices(args: {
  medication: Medication;
  events: DoseEvent[];
  nowMs: number;
  myId: string;
  enteredAmount: number;
}): Notice[] {
  const { medication: med, events, nowMs, myId, enteredAmount } = args;
  const notices: Notice[] = [];
  const active = activeFor(events, med.id);
  const last = active[0];

  // also_logged: someone else logged this same medicine within the last 5 minutes.
  const recentOther = active.find((e) => e.caregiver_id !== myId && nowMs - e.givenAtMs < ALSO_LOGGED_WINDOW_MS);
  if (recentOther) {
    notices.push({
      kind: 'also_logged',
      text: `${recentOther.caregiver_name} also logged this ${formatAgo(recentOther.givenAtMs, nowMs)}.`,
    });
  }

  if (med.interval_hours != null && med.interval_hours > 0 && last) {
    const since = nowMs - last.givenAtMs;
    if (since < med.interval_hours * 3_600_000) {
      notices.push({
        kind: 'too_soon',
        text:
          `Heads up: ${last.caregiver_name} logged ${med.name} ${fmtDose(last.dose_amount, last.dose_unit)} ` +
          `at ${formatClock(last.givenAtMs)} (${formatDuration(since)} ago). ` +
          `Your plan: every ${med.interval_hours} ${med.interval_hours === 1 ? 'hour' : 'hours'}.`,
      });
    }
  }

  if (med.max_doses_per_day != null && med.max_doses_per_day > 0) {
    const n = dosesToday(events, med.id, nowMs) + 1;
    if (n > med.max_doses_per_day) {
      notices.push({
        kind: 'over_daily',
        text: `This would be dose ${n} today. Your plan: up to ${med.max_doses_per_day} a day.`,
      });
    }
  }

  if (Number.isFinite(enteredAmount) && enteredAmount !== med.dose_amount) {
    notices.push({
      kind: 'dose_differs',
      text: `You entered ${fmtDose(enteredAmount, med.dose_unit)}. Your plan: ${fmtDose(med.dose_amount, med.dose_unit)}.`,
    });
  }

  return notices;
}

/**
 * Spec S6: after two people log the same medicine within 5 minutes, both screens
 * keep showing it on the medicine card for a while (30 min).
 */
export function concurrentNotice(events: DoseEvent[], medicationId: string, myId: string, nowMs: number): string | null {
  const active = activeFor(events, medicationId).filter((e) => nowMs - e.givenAtMs < 30 * 60_000);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.caregiver_id === b.caregiver_id) continue;
      if (Math.abs(a.givenAtMs - b.givenAtMs) >= ALSO_LOGGED_WINDOW_MS) continue;
      const other = a.caregiver_id === myId ? b : b.caregiver_id === myId ? a : null;
      if (other) return `${other.caregiver_name} also logged this ${formatAgo(other.givenAtMs, nowMs)}.`;
      return `${a.caregiver_name} and ${b.caregiver_name} both logged this within 5 min.`;
    }
  }
  return null;
}

/** "Next per your plan" time for the medicine card, or null when no interval is set. */
export function nextPerPlan(med: Medication, events: DoseEvent[]): number | null {
  if (med.interval_hours == null) return null;
  const last = lastDose(events, med.id);
  if (!last) return null;
  return last.givenAtMs + med.interval_hours * 3_600_000;
}

/** Merge events by id so a re-sent dose never shows twice (S4 / AC8b). */
export function dedupeEvents(events: DoseEvent[]): DoseEvent[] {
  const byId = new Map<string, DoseEvent>();
  for (const e of events) {
    const prev = byId.get(e.id);
    // Prefer the server-confirmed copy over a pending local one.
    if (!prev || (prev.pending && !e.pending)) byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => b.givenAtMs - a.givenAtMs);
}

export function p95(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1);
  return s[idx];
}
