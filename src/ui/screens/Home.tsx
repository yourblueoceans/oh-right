import { useState } from 'react';
import type { DoseEvent, Medication } from '../../domain/types';
import { concurrentNotice, dedupeEvents, dosesToday, lastDose, nextPerPlan } from '../../domain/notices';
import { elapsedParts, formatClock, joinNames, startOfLocalDay } from '../../domain/time';
import { undoDose } from '../../data/repo';
import type { AppCtx } from '../App';
import { ConfirmDose } from '../components/ConfirmDose';
import { ConnPill, GearIcon, OfflineBanner, PersonChip, personIndex } from '../components/Common';
import { useNow } from '../hooks';
import { navigate } from '../router';

const sourceLabel = { button: 'App', nfc: 'Sticker', qr: 'QR code' } as const;

export function Home({ ctx }: { ctx: AppCtx }) {
  const now = useNow();
  const [confirming, setConfirming] = useState<Medication | null>(null);
  const { snap } = ctx;
  const doses = dedupeEvents(snap.doses);
  const meds = snap.medications.filter((m) => !m.archived);
  const withMeds = snap.patients.filter((p) => meds.some((m) => m.patient_id === p.id));
  // One child (the usual case): the child's name is the page title.
  const single = withMeds.length === 1 ? withMeds[0] : null;
  const team = joinNames([
    'You',
    ...snap.members.filter((m) => m.caregiver_id !== ctx.user.uid).map((m) => m.display_name),
  ]);

  return (
    <main className="page">
      <div className="home-top">
        <div>
          <h1 data-testid="home-title">{single ? single.display_name : snap.group!.name}</h1>
          <p className="home-sub">Care team · {team}</p>
        </div>
        <div className="home-actions">
          <ConnPill conn={ctx.conn} />
          <button className="icon-btn" aria-label="Settings" onClick={() => navigate('/settings')} data-testid="open-settings">
            <GearIcon />
          </button>
        </div>
      </div>
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

      {withMeds.map((p) => (
        <section key={p.id} className="patient">
          {!single && <h2 className="patient-name">{p.display_name}</h2>}
          {meds
            .filter((m) => m.patient_id === p.id)
            .map((m) => (
              <MedCard key={m.id} ctx={ctx} med={m} doses={doses} now={now} onLog={() => setConfirming(m)} />
            ))}
        </section>
      ))}

      <Timeline ctx={ctx} doses={doses} now={now} />

      {confirming && (
        <ConfirmDose ctx={ctx} medication={confirming} source="button" stickerId={null} onDone={() => setConfirming(null)} />
      )}
    </main>
  );
}

function BigAgo({ ms }: { ms: number }) {
  const parts = elapsedParts(ms);
  if (!parts) return <span className="ago">Just now</span>;
  return (
    <span className="ago">
      {parts.map(([n, u]) => (
        <span key={u}>
          {n}
          <small>{u}</small>{' '}
        </span>
      ))}
      <small>ago</small>
    </span>
  );
}

function MedCard({ ctx, med, doses, now, onLog }: { ctx: AppCtx; med: Medication; doses: DoseEvent[]; now: number; onLog: () => void }) {
  const last = lastDose(doses, med.id);
  const next = nextPerPlan(med, doses);
  const together = concurrentNotice(doses, med.id, ctx.user.uid, now);
  const noPlan = med.interval_hours == null && med.max_doses_per_day == null;
  // Share of the parent's own interval that has passed. A fact about their plan, not advice.
  const share = last && med.interval_hours ? Math.min(1, (now - last.givenAtMs) / (med.interval_hours * 3_600_000)) : null;

  return (
    <article className="label" data-testid={`med-card-${med.name}`}>
      <div className="label-head">
        <h3 className="label-name">{med.name}</h3>
        <span className="label-dose">
          {med.dose_amount} {med.dose_unit}
        </span>
      </div>
      <div className="label-body">
        <div className="kicker">Last given</div>
        <div className="last-row" data-testid="card-last">
          {last ? (
            <>
              <BigAgo ms={now - last.givenAtMs} />
              <span className="who">
                <PersonChip name={last.caregiver_name} index={personIndex(ctx.snap.members, last.caregiver_id)} />
                {last.caregiver_name} · {formatClock(last.givenAtMs)}
              </span>
            </>
          ) : (
            <span className="ago none">Not yet logged</span>
          )}
        </div>
        <div className="plan">
          {share != null && (
            <div className="track" aria-hidden>
              <div className="fill" style={{ width: `${Math.round(share * 100)}%` }} />
            </div>
          )}
          <div className="plan-txt">
            <span>
              {noPlan
                ? 'No schedule set'
                : med.interval_hours != null
                  ? `Your plan: every ${med.interval_hours} h`
                  : `Your plan: up to ${med.max_doses_per_day} a day`}
            </span>
            {next && <span>Plan time {formatClock(next)}</span>}
            {!next && med.max_doses_per_day != null && <span>Today: {dosesToday(doses, med.id, now)}</span>}
          </div>
        </div>
        {together && (
          <p className="notice" data-kind="also_logged" data-testid="card-also-logged">
            {together}
          </p>
        )}
        <button className="btn btn-primary btn-lg" onClick={onLog} data-testid="log-dose">
          Log a dose
        </button>
      </div>
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
                <span className="tl-time">{formatClock(d.givenAtMs)}</span>
                <span className="tl-what">
                  <PersonChip name={d.caregiver_name} index={personIndex(ctx.snap.members, d.caregiver_id)} />
                  <span className="tl-text">
                    {d.medication_name} {d.dose_amount} {d.dose_unit}
                    <span className="sr-sep"> · </span>
                    {d.caregiver_name}
                  </span>
                </span>
                <span className="tl-src">{sourceLabel[d.source] ?? d.source}</span>
              </div>
              {d.pending && (
                <span className="tag tag-pending" data-testid="pending-tag">
                  {offline ? 'Waiting to send' : 'Sending'}
                </span>
              )}
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
