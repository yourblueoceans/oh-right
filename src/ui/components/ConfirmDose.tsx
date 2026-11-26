import { useMemo, useState } from 'react';
import type { DoseSource, Medication } from '../../domain/types';
import { computeNotices, lastDose } from '../../domain/notices';
import { formatAgo, formatClock } from '../../domain/time';
import { clock } from '../../data/clock';
import { isPermissionDenied, recordDose, undoDose } from '../../data/repo';
import type { AppCtx } from '../App';
import { useNow } from '../hooks';
import { PersonChip, personIndex } from './Common';
import type { NoticeKind } from '../../domain/types';

const noticeTitle: Record<NoticeKind, string> = {
  too_soon: 'Earlier than your plan',
  over_daily: 'More than your daily plan',
  dose_differs: 'Different dose',
  also_logged: 'Someone else logged this too',
};

/**
 * Screen 5 (Confirm). Shared by the home "Log a dose" button and sticker taps.
 * Notices are soft: the "Mark as given" button is always there and one tap records.
 */
export function ConfirmDose({
  ctx,
  medication: med,
  source,
  stickerId,
  onDone,
}: {
  ctx: AppCtx;
  medication: Medication;
  source: DoseSource;
  stickerId: string | null;
  onDone: () => void;
}) {
  const now = useNow(5_000);
  const [editing, setEditing] = useState(false);
  const [amountText, setAmountText] = useState(String(med.dose_amount));
  const amount = Number(amountText);
  const patient = ctx.snap.patients.find((p) => p.id === med.patient_id);
  const myId = ctx.user.uid;

  const notices = useMemo(
    () => computeNotices({ medication: med, events: ctx.snap.doses, nowMs: now, myId, enteredAmount: amount }),
    [med, ctx.snap.doses, now, myId, amount],
  );
  const last = lastDose(ctx.snap.doses, med.id);

  function mark() {
    if (!(amount > 0)) return;
    // Re-check at the exact moment of the tap so the saved notices match what was on screen.
    const shown = computeNotices({ medication: med, events: ctx.snap.doses, nowMs: clock.now(), myId, enteredAmount: amount });
    const gid = ctx.snap.group!.id;
    const id = recordDose(
      {
        gid,
        medication: med,
        caregiverName: ctx.me.display_name,
        doseAmount: amount,
        source,
        stickerId,
        notices: shown.map((n) => n.kind),
      },
      (e) => {
        console.error(e);
        ctx.showToast({
          key: Date.now(),
          text: isPermissionDenied(e) ? "That record wasn't accepted. You may no longer be in this group." : "That record couldn't be saved.",
        });
      },
    );
    ctx.showToast({
      key: Date.now(),
      text: `Recorded · ${med.name} ${amount} ${med.dose_unit}`,
      // Spec [guess]: helpers can't undo, not even their own record.
      onUndo: ctx.isManager ? () => undoDose(gid, id, ctx.me.display_name, console.error) : undefined,
    });
    onDone();
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Confirm dose">
      <div className="sheet" data-testid="confirm">
        <p className="sheet-kicker">{patient?.display_name ?? ''}</p>
        <h2 className="sheet-title" data-testid="confirm-title">
          {editing ? (
            med.name
          ) : (
            <>
              <span className="sheet-name">{med.name}</span>
              <span className="vh"> · </span>
              <span className="sheet-dose">{`${amountText} ${med.dose_unit}`}</span>
            </>
          )}
        </h2>
        {editing && (
          <label className="dose-edit">
            <input
              inputMode="decimal"
              autoFocus
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              aria-label={`Dose in ${med.dose_unit}`}
              data-testid="dose-input"
            />
            <span>{med.dose_unit}</span>
          </label>
        )}
        <p className="sheet-last" data-testid="confirm-last">
          {last ? (
            <>
              <PersonChip name={last.caregiver_name} index={personIndex(ctx.snap.members, last.caregiver_id)} />
              <span>
                Last: {last.caregiver_name} at {formatClock(last.givenAtMs)} ({formatAgo(last.givenAtMs, now)})
              </span>
            </>
          ) : (
            'No doses logged yet.'
          )}
        </p>
        {med.interval_hours == null && med.max_doses_per_day == null && <p className="muted small">No schedule set</p>}

        {notices.length > 0 && (
          <div className="notices" data-testid="notices">
            {notices.map((n) => (
              <p key={n.kind} className="notice" data-kind={n.kind}>
                <span className="notice-title">{noticeTitle[n.kind]}</span>
                {n.text}
              </p>
            ))}
            <p className="notice-foot">Not sure? Ask your doctor or pharmacist.</p>
          </div>
        )}
        {med.plan_note && <p className="muted small">Note: {med.plan_note}</p>}

        <button className="btn btn-primary btn-xl" onClick={mark} disabled={!(amount > 0)} data-testid="mark-given">
          Mark as given
        </button>
        <div className="sheet-row">
          {!editing && (
            <button className="btn btn-ghost" onClick={() => setEditing(true)} data-testid="change-dose">
              Change dose
            </button>
          )}
          <button className="btn btn-ghost" onClick={onDone} data-testid="not-now">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
