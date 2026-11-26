import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  addPatient,
  createSticker,
  deleteSticker,
  leaveGroup,
  regenerateManagerInvite,
  removeHelper,
  saveMedication,
  setHelperInvites,
  updateMyName,
} from '../../data/repo';
import { clock } from '../../data/clock';
import { MAX_MANAGERS } from '../../config';
import { p95 } from '../../domain/notices';
import type { Medication, Sticker } from '../../domain/types';
import type { AppCtx } from '../App';
import { DisclaimerText, Field, Header } from '../components/Common';
import { MedicationForm } from '../components/MedicationForm';
import { navigate } from '../router';

export function stickerUrl(id: string, via: 'nfc' | 'qr'): string {
  return `${location.origin}/t/${id}?via=${via}`;
}

function inviteUrl(code: string): string {
  return `${location.origin}/join/${code}`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyRow({ value, testId }: { value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-row">
      <input readOnly value={value} onFocus={(e) => e.target.select()} data-testid={testId} />
      <button
        className="btn btn-secondary btn-sm"
        onClick={async () => {
          setCopied(await copy(value));
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {'share' in navigator && (
        <button className="btn btn-secondary btn-sm" onClick={() => navigator.share({ url: value }).catch(() => {})}>
          Share
        </button>
      )}
    </div>
  );
}

export function Settings({ ctx }: { ctx: AppCtx }) {
  const { snap, isManager } = ctx;
  const group = snap.group!;
  const [error, setError] = useState<string | null>(null);
  const run = (f: () => Promise<unknown>) => () => {
    setError(null);
    f().catch((e) => {
      console.error(e);
      setError("That didn't work. Check your connection and try again.");
    });
  };

  return (
    <main className="page">
      <Header title="Settings" back="/home" conn={ctx.conn} />
      {error && <p className="error">{error}</p>}

      <MyName ctx={ctx} />

      <section className="section">
        <h2>Members</h2>
        <ul className="list" data-testid="members">
          {snap.members.map((m) => (
            <li key={m.caregiver_id} className="list-row">
              <span>
                {m.display_name}
                {m.caregiver_id === ctx.user.uid && ' (you)'}
              </span>
              <span className="role">{m.role === 'manager' ? 'Manager' : 'Helper'}</span>
              {isManager && m.role === 'helper' && m.caregiver_id !== ctx.user.uid && (
                <button className="btn btn-ghost btn-sm" onClick={run(() => removeHelper(group.id, m.caregiver_id))}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isManager && (
        <section className="section">
          <h2>Invite a manager</h2>
          {group.manager_count < MAX_MANAGERS && group.manager_invite_code ? (
            <>
              <p className="muted small">
                Send this link to the other person who manages care. Up to {MAX_MANAGERS} managers per group.
              </p>
              <CopyRow value={inviteUrl(group.manager_invite_code)} testId="manager-invite" />
              <button className="btn btn-ghost btn-sm" onClick={run(() => regenerateManagerInvite(group))}>
                Make a new link (old one stops working)
              </button>
            </>
          ) : (
            <p className="muted" data-testid="managers-full">
              This group has {MAX_MANAGERS} managers, the maximum.
            </p>
          )}
        </section>
      )}

      {isManager && (
        <section className="section">
          <h2>
            Invite helpers <span className="premium">Premium</span>
          </h2>
          <p className="muted small">Helpers (like a grandparent or sitter) can log doses but can't undo or edit.</p>
          <label className="switch">
            <input
              type="checkbox"
              checked={group.helper_invites_enabled}
              onChange={(e) => run(() => setHelperInvites(group, e.target.checked))()}
              data-testid="helper-switch"
            />
            <span>Helper invites (free while testing)</span>
          </label>
          {group.helper_invites_enabled && group.helper_invite_code && (
            <CopyRow value={inviteUrl(group.helper_invite_code)} testId="helper-invite" />
          )}
        </section>
      )}

      <Medicines ctx={ctx} />
      <Stickers ctx={ctx} />

      <section className="section">
        <h2>About Oh Right!</h2>
        <DisclaimerText />
      </section>

      <section className="section">
        <button
          className="btn btn-ghost"
          data-testid="leave"
          onClick={run(async () => {
            if (!confirmLeave()) return;
            await leaveGroup(group.id, ctx.me.role);
            navigate('/', { replace: true });
          })}
        >
          Leave this care group
        </button>
        <p className="muted small">Your past records stay in the log with your name.</p>
      </section>

      <DebugPanel ctx={ctx} />
    </main>
  );
}

function confirmLeave(): boolean {
  // eslint-disable-next-line no-alert
  return window.confirm('Leave this care group? You will need a new invite to come back.');
}

function MyName({ ctx }: { ctx: AppCtx }) {
  const [name, setName] = useState(ctx.me.display_name);
  const [saved, setSaved] = useState(false);
  const t = name.trim();
  return (
    <section className="section">
      <h2>Your name</h2>
      <div className="copy-row">
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn btn-secondary btn-sm"
          disabled={!t || t === ctx.me.display_name}
          onClick={async () => {
            await updateMyName(ctx.snap.group!.id, t);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </section>
  );
}

function Medicines({ ctx }: { ctx: AppCtx }) {
  const { snap, isManager } = ctx;
  const gid = snap.group!.id;
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [childName, setChildName] = useState('');
  const [addingChild, setAddingChild] = useState(false);

  return (
    <section className="section">
      <h2>Children & medicines</h2>
      {snap.patients.map((p) => (
        <div key={p.id} className="subsection">
          <h3>{p.display_name}</h3>
          <ul className="list">
            {snap.medications
              .filter((m) => m.patient_id === p.id)
              .map((m) => (
                <li key={m.id} className={`list-row ${m.archived ? 'archived' : ''}`}>
                  {editing === m.id ? (
                    <MedicationForm
                      initial={m}
                      fixedPatientId={p.id}
                      submitLabel="Save"
                      onSubmit={async (input) => {
                        await saveMedication(gid, input, m.id);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <span>
                        {m.name} · {m.dose_amount} {m.dose_unit}
                        <span className="muted small">
                          {' '}
                          {m.interval_hours != null ? `every ${m.interval_hours} h` : ''}
                          {m.max_doses_per_day != null ? ` · up to ${m.max_doses_per_day}/day` : ''}
                          {m.archived ? ' · hidden' : ''}
                        </span>
                      </span>
                      {isManager && (
                        <span className="row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(m.id)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => saveMedication(gid, { ...stripId(m), archived: !m.archived }, m.id)}
                          >
                            {m.archived ? 'Show' : 'Hide'}
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
      {isManager && editing === 'new' && (
        <MedicationForm
          patients={snap.patients}
          fixedPatientId={snap.patients.length === 1 ? snap.patients[0].id : undefined}
          submitLabel="Add medicine"
          onSubmit={async (input) => {
            await saveMedication(gid, input);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {isManager && editing !== 'new' && snap.patients.length > 0 && (
        <button className="btn btn-secondary" onClick={() => setEditing('new')} data-testid="add-med">
          Add a medicine
        </button>
      )}
      {isManager &&
        (addingChild ? (
          <div className="copy-row">
            <input value={childName} maxLength={30} placeholder="Child's name" onChange={(e) => setChildName(e.target.value)} />
            <button
              className="btn btn-secondary btn-sm"
              disabled={!childName.trim()}
              onClick={async () => {
                await addPatient(gid, childName.trim());
                setChildName('');
                setAddingChild(false);
              }}
            >
              Add
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setAddingChild(true)}>
            Add a child
          </button>
        ))}
    </section>
  );
}

function stripId(m: Medication) {
  const { id: _id, ...rest } = m;
  return rest;
}

function Stickers({ ctx }: { ctx: AppCtx }) {
  const { snap, isManager } = ctx;
  const gid = snap.group!.id;
  const meds = snap.medications.filter((m) => !m.archived);
  const [medId, setMedId] = useState('');
  const [label, setLabel] = useState('');
  const [showing, setShowing] = useState<Sticker | null>(null);
  const medName = (id: string) => snap.medications.find((m) => m.id === id)?.name ?? 'Removed medicine';

  return (
    <section className="section">
      <h2>Stickers</h2>
      <p className="muted small">Each sticker opens one medicine. Write the NFC link to the tag and print the QR on its front.</p>
      <ul className="list" data-testid="stickers">
        {snap.stickers.map((s) => (
          <li key={s.id} className="list-row">
            <span>
              {medName(s.medication_id)}
              {s.label ? ` · ${s.label}` : ''}
            </span>
            <span className="row-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowing(s)} data-testid="show-sticker">
                QR & link
              </button>
              {isManager && (
                <button className="btn btn-ghost btn-sm" onClick={() => deleteSticker(s.id)}>
                  Delete
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {isManager && meds.length > 0 && (
        <div className="form">
          <div className="row">
            <Field label="Medicine">
              <select value={medId} onChange={(e) => setMedId(e.target.value)} data-testid="sticker-med">
                <option value="">Choose…</option>
                {meds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Where it goes" hint="Optional, e.g. Fridge">
              <input value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} />
            </Field>
          </div>
          <button
            className="btn btn-secondary"
            disabled={!medId}
            data-testid="add-sticker"
            onClick={async () => {
              const med = meds.find((m) => m.id === medId)!;
              const id = await createSticker(gid, med, label.trim());
              setLabel('');
              setShowing({ id, group_id: gid, medication_id: med.id, label: label.trim() });
            }}
          >
            Add sticker
          </button>
        </div>
      )}
      {showing && <StickerSheet sticker={showing} medName={medName(showing.medication_id)} onClose={() => setShowing(null)} />}
    </section>
  );
}

function StickerSheet({ sticker, medName, onClose }: { sticker: Sticker; medName: string; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const qrUrl = stickerUrl(sticker.id, 'qr');
  useEffect(() => {
    QRCode.toDataURL(qrUrl, { margin: 1, width: 480, errorCorrectionLevel: 'M' }).then(setQr, console.error);
  }, [qrUrl]);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet print-area" data-testid="sticker-sheet">
        <h2 className="sheet-title">{medName}</h2>
        {qr && <img className="qr" src={qr} alt={`QR code for ${medName}`} />}
        <Field label="QR link (printed)">
          <CopyRow value={qrUrl} testId="sticker-qr-url" />
        </Field>
        <Field label="NFC link (write this to the tag)" hint="Use a free app like NFC Tools: Write → Add a record → URL.">
          <CopyRow value={stickerUrl(sticker.id, 'nfc')} testId="sticker-nfc-url" />
        </Field>
        <div className="sheet-row no-print">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DebugPanel({ ctx }: { ctx: AppCtx }) {
  const secs = ctx.latency.map((s) => s.seconds);
  const p = p95(secs);
  return (
    <details className="debug" data-testid="debug">
      <summary>Debug</summary>
      <p className="small">
        Records from others that arrived on this screen (seconds from their tap to here). p95:{' '}
        <strong data-testid="p95">{p == null ? '–' : p.toFixed(2)}</strong>
      </p>
      <ol className="small mono">
        {ctx.latency.map((s) => (
          <li key={s.doseId}>
            {s.who}: {s.seconds.toFixed(2)} s
          </li>
        ))}
      </ol>
      <p className="small mono">
        clock offset: {clock.measuredOffset == null ? 'not measured' : `${Math.round(clock.measuredOffset)} ms`}
        <br />
        user: {ctx.user.uid}
        <br />
        group: {ctx.snap.group!.id}
        <br />
        connection: {ctx.conn}
      </p>
    </details>
  );
}
