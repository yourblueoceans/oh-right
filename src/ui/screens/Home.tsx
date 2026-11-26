import { useState } from 'react';
import type { DoseEvent, Medication } from '../../domain/types';
import { concurrentNotice, dedupeEvents, lastDose, nextPerPlan } from '../../domain/notices';
import { formatAgo, formatClock, startOfLocalDay } from '../../domain/time';
import { undoDose } from '../../data/repo';
import type { AppCtx } from '../App';
import { ConfirmDose } from '../components/ConfirmDose';
import { Header, OfflineBanner } from '../components/Common';
import { useNow } from '../hooks';
import { navigate } from '../router';

const sourceLabel = { button: 'Button', nfc: 'NFC', qr: 'QR' } as const;

export function Home({ ctx }: { ctx: AppCtx }) {
  const now = useNow();
  const [confirming, setConfirming] = useState<Medication | null>(null);
  const { snap } = ctx;
  const doses = dedupeEvents(snap.doses);
  const meds = snap.medications.filter((m) => !m.archived);

  return (
    <main className="page">
      <Header
        title={snap.group!.name}
        conn={ctx.conn}
        right={
          <button className="icon-btn" aria-label="Settings" onClick={() => navigate('/settings')} data-testid="open-settings">
            ⚙
          </button>
        }
      />
      <OfflineBanner conn={ctx.conn} />

      {meds.length === 0 && (
        <section className="empty">
          <p>No medicines yet.</p>
          {ctx.isManager ? (
            <button className="btn btn-primary" onClick={() => navigate(snap.patients.length ? '/settings' : '/setup')}>
              Add a medicine
            </button>
          ) : (
            <p className="muted">A manager can add medicines in Settings.</p>
          )}
        </section>
      )}

      {snap.patients.map((p) => {
        const pm = meds.filter((m) => m.patient_id === p.id);
        if (!pm.length) return null;
        return (
          <section key={p.id} className="patient">
            <h2 className="patient-name">{p.display_name}</h2>
            {pm.map((m) => (
              <MedCard key={m.id} med={m} doses={doses} now={now} myId={ctx.user.uid} onLog={() => setConfirming(m)} />
            ))}
          </section>
        );
      })}

      <Timeline ctx={ctx} doses={doses} now={now} />

      {confirming && (
        <ConfirmDose ctx={ctx} medication={confirming} source="button" stickerId={null} onDone={() => setConfirming(null)} />
      )}
    </main>
  );
}

function MedCard({ med, doses, now, myId, onLog }: { med: Medication; doses: DoseEvent[]; now: number; myId: string; onLog: () => void }) {
  const last = lastDose(doses, med.id);
  const next = nextPerPlan(med, doses);
  const together = concurrentNotice(doses, med.id, myId, now);
  return (
    <article className="card" data-testid={`med-card-${med.name}`}>
      <div className="card-head">
        <h3>{med.name}</h3>
        <span className="dose-chip">
          {med.dose_amount} {med.dose_unit}
        </span>
      </div>
      <p className="card-last" data-testid="card-last">
        {last ? (
          <>
            Last: <strong>{last.caregiver_name}</strong> · {formatAgo(last.givenAtMs, now)} ({formatClock(last.givenAtMs)})
          </>
        ) : (
          'No doses logged yet'
        )}
      </p>
      <p className="muted small">
        {med.interval_hours == null && med.max_doses_per_day == null
          ? 'No schedule set'
          : next
            ? `Next per your plan: ${formatClock(next)}`
            : med.interval_hours != null
              ? `Your plan: every ${med.interval_hours} h`
              : `Your plan: up to ${med.max_doses_per_day} a day`}
      </p>
      {together && (
        <p className="notice" data-kind="also_logged" data-testid="card-also-logged">
          {together}
        </p>
      )}
      <button className="btn btn-primary btn-lg" onClick={onLog} data-testid="log-dose">
        Log a dose
      </button>
    </article>
  );
}

function Timeline({ ctx, doses, now }: { ctx: AppCtx; doses: DoseEvent[]; now: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const today = doses.filter((d) => d.givenAtMs >= startOfLocalDay(now));
  const offline = ctx.conn === 'offline';

  return (
    <section className="timeline">
      <h2>Today</h2>
      {today.length === 0 && <p className="muted">Nothing logged today.</p>}
      <ul data-testid="timeline">
        {today.map((d) => {
          const canUndo = ctx.isManager && d.status === 'given';
          return (
            <li
              key={d.id}
              className={`tl-item ${d.status === 'undone' ? 'undone' : ''}`}
              data-testid="timeline-item"
              data-dose-id={d.id}
              data-status={d.status}
              data-source={d.source}
              onClick={() => canUndo && setOpen(open === d.id ? null : d.id)}
              onContextMenu={(e) => {
                // Long-press on phones opens the context menu: use it to reveal Undo.
                if (canUndo) {
                  e.preventDefault();
                  setOpen(d.id);
                }
              }}
            >
              <div className="tl-main">
                <span className="tl-text">
                  {formatClock(d.givenAtMs)} · {d.medication_name} {d.dose_amount} {d.dose_unit} · {d.caregiver_name} ·{' '}
                  {sourceLabel[d.source] ?? d.source}
                </span>
                {d.pending && (
                  <span className="tag tag-pending" data-testid="pending-tag">
                    {offline ? 'Waiting to send' : 'Sending'}
                  </span>
                )}
              </div>
              {d.status === 'undone' && (
                <span className="tl-undone" data-testid="undone-by">
                  Undone by {d.undone_by_name ?? 'someone'}
                </span>
              )}
              {open === d.id && canUndo && (
                <div className="tl-actions">
                  <button
                    className="btn btn-danger-soft"
                    onClick={(e) => {
                      e.stopPropagation();
                      undoDose(ctx.snap.group!.id, d.id, ctx.me.display_name, console.error);
                      setOpen(null);
                    }}
                    data-testid="undo-item"
                  >
                    Undo this record
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
