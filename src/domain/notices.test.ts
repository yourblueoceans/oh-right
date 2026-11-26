import { describe, expect, it } from 'vitest';
import { computeNotices, concurrentNotice, dedupeEvents, dosesToday, nextPerPlan, p95 } from './notices';
import type { DoseEvent, Medication } from './types';

const H = 3_600_000;
const MIN = 60_000;
// 2026-11-26 15:00 local
const NOW = new Date(2026, 10, 26, 15, 0, 0).getTime();

const amox: Medication = {
  id: 'amox',
  patient_id: 'mia',
  name: 'Amoxicillin',
  dose_amount: 250,
  dose_unit: 'mg',
  interval_hours: 8,
  max_doses_per_day: 3,
  plan_note: '',
  archived: false,
};
const noPlan: Medication = { ...amox, id: 'tyl', name: "Children's Tylenol", dose_amount: 5, dose_unit: 'mL', interval_hours: null, max_doses_per_day: null };

let n = 0;
function ev(p: Partial<DoseEvent> & { givenAtMs: number }): DoseEvent {
  n++;
  return {
    id: `e${n}`,
    patient_id: 'mia',
    medication_id: 'amox',
    medication_name: 'Amoxicillin',
    caregiver_id: 'dad',
    caregiver_name: 'Dad',
    dose_amount: 250,
    dose_unit: 'mg',
    receivedAtMs: null,
    source: 'button',
    sticker_id: null,
    status: 'given',
    undoneAtMs: null,
    undone_by: null,
    undone_by_name: null,
    notices_shown: [],
    pending: false,
    ...p,
  };
}

const kinds = (xs: { kind: string }[]) => xs.map((x) => x.kind).sort();

describe('computeNotices', () => {
  it('shows nothing when the last dose is outside the interval and under the daily max', () => {
    const events = [ev({ givenAtMs: NOW - 9 * H })];
    expect(computeNotices({ medication: amox, events, nowMs: NOW, myId: 'mom', enteredAmount: 250 })).toEqual([]);
  });

  it('too_soon when the parent-entered interval has not passed, with the plan in the text', () => {
    const events = [ev({ givenAtMs: NOW - (3 * H + 50 * MIN) })];
    const r = computeNotices({ medication: amox, events, nowMs: NOW, myId: 'mom', enteredAmount: 250 });
    expect(kinds(r)).toEqual(['too_soon']);
    expect(r[0].text).toContain('Dad logged Amoxicillin 250 mg');
    expect(r[0].text).toContain('3 h 50 min ago');
    expect(r[0].text).toContain('Your plan: every 8 hours.');
  });

  it('over_daily counts only today (local midnight) and ignores undone records', () => {
    const today0 = new Date(2026, 10, 26, 0, 30).getTime();
    const events = [
      ev({ givenAtMs: new Date(2026, 10, 25, 23, 0).getTime() }), // yesterday
      ev({ givenAtMs: today0 }),
      ev({ givenAtMs: today0 + 4 * H }),
      ev({ givenAtMs: today0 + 5 * H, status: 'undone' }),
      ev({ givenAtMs: today0 + 9 * H }), // 9:30 → 5.5 h ago
    ];
    expect(dosesToday(events, 'amox', NOW)).toBe(3);
    const r = computeNotices({ medication: { ...amox, interval_hours: null }, events, nowMs: NOW, myId: 'mom', enteredAmount: 250 });
    expect(kinds(r)).toEqual(['over_daily']);
    expect(r[0].text).toBe('This would be dose 4 today. Your plan: up to 3 a day.');
  });

  it('never shows interval/daily notices when the plan is empty (AC6)', () => {
    const events = Array.from({ length: 10 }, (_, i) => ev({ medication_id: 'tyl', givenAtMs: NOW - (i + 10) * MIN, caregiver_id: 'mom', caregiver_name: 'Mom' }));
    const r = computeNotices({ medication: noPlan, events, nowMs: NOW, myId: 'mom', enteredAmount: 5 });
    expect(r).toEqual([]);
  });

  it('dose_differs when the entered dose is not the plan dose (AC7)', () => {
    const r = computeNotices({ medication: noPlan, events: [], nowMs: NOW, myId: 'mom', enteredAmount: 10 });
    expect(kinds(r)).toEqual(['dose_differs']);
    expect(r[0].text).toBe('You entered 10 mL. Your plan: 5 mL.');
  });

  it('also_logged when another caregiver logged the same medicine within 5 minutes (S6)', () => {
    const events = [ev({ medication_id: 'tyl', givenAtMs: NOW - 1 * MIN, caregiver_id: 'mom', caregiver_name: 'Mom' })];
    const r = computeNotices({ medication: noPlan, events, nowMs: NOW, myId: 'dad', enteredAmount: 5 });
    expect(kinds(r)).toEqual(['also_logged']);
    expect(r[0].text).toBe('Mom also logged this 1 min ago.');
  });

  it('also_logged ignores my own records and records older than 5 minutes', () => {
    const events = [
      ev({ medication_id: 'tyl', givenAtMs: NOW - 1 * MIN, caregiver_id: 'dad' }),
      ev({ medication_id: 'tyl', givenAtMs: NOW - 6 * MIN, caregiver_id: 'mom', caregiver_name: 'Mom' }),
    ];
    expect(computeNotices({ medication: noPlan, events, nowMs: NOW, myId: 'dad', enteredAmount: 5 })).toEqual([]);
  });

  it('wording never judges safety', () => {
    const events = [ev({ givenAtMs: NOW - 1 * MIN, caregiver_id: 'mom', caregiver_name: 'Mom' }), ev({ givenAtMs: NOW - 2 * H }), ev({ givenAtMs: NOW - 4 * H })];
    const r = computeNotices({ medication: amox, events, nowMs: NOW, myId: 'dad', enteredAmount: 500 });
    expect(kinds(r)).toEqual(['also_logged', 'dose_differs', 'over_daily', 'too_soon']);
    for (const x of r) expect(x.text.toLowerCase()).not.toMatch(/unsafe|overdose|do not give|wait until|danger/);
  });
});

describe('concurrentNotice', () => {
  it('both screens see the other person after near-simultaneous logs', () => {
    const events = [
      ev({ givenAtMs: NOW - 2 * MIN, caregiver_id: 'mom', caregiver_name: 'Mom' }),
      ev({ givenAtMs: NOW - 1 * MIN, caregiver_id: 'dad', caregiver_name: 'Dad' }),
    ];
    expect(concurrentNotice(events, 'amox', 'dad', NOW)).toBe('Mom also logged this 2 min ago.');
    expect(concurrentNotice(events, 'amox', 'mom', NOW)).toBe('Dad also logged this 1 min ago.');
    expect(concurrentNotice(events, 'amox', 'grandma', NOW)).toContain('both logged');
  });

  it('is quiet when one of them was undone', () => {
    const events = [
      ev({ givenAtMs: NOW - 2 * MIN, caregiver_id: 'mom', caregiver_name: 'Mom', status: 'undone' }),
      ev({ givenAtMs: NOW - 1 * MIN }),
    ];
    expect(concurrentNotice(events, 'amox', 'dad', NOW)).toBeNull();
  });
});

describe('idempotency & helpers', () => {
  it('dedupeEvents keeps one copy per id and prefers the confirmed one (AC8b)', () => {
    const a = ev({ givenAtMs: NOW - MIN, pending: true });
    const b = { ...a, pending: false };
    const c = ev({ givenAtMs: NOW });
    const r = dedupeEvents([a, c, b, a]);
    expect(r.map((x) => x.id)).toEqual([c.id, a.id]);
    expect(r[1].pending).toBe(false);
  });

  it('nextPerPlan only exists with an interval', () => {
    const events = [ev({ givenAtMs: NOW - H })];
    expect(nextPerPlan(amox, events)).toBe(NOW + 7 * H);
    expect(nextPerPlan({ ...amox, interval_hours: null }, events)).toBeNull();
  });

  it('p95', () => {
    expect(p95([])).toBeNull();
    expect(p95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
  });
});
