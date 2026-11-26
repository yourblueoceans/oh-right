import { useState } from 'react';
import { DOSE_UNITS, type DoseUnit, type Medication, type Patient } from '../../domain/types';
import type { MedicationInput } from '../../data/repo';
import { Field } from './Common';

export const PLAN_GUIDANCE =
  "Enter the dose and schedule exactly as your doctor, pharmacist, or the label tells you. Oh Right! doesn't suggest doses.";

function parseOptNumber(s: string): number | null | 'bad' {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 'bad';
}

/**
 * Every field starts empty: the app never proposes a dose, interval or daily maximum (AC6).
 */
export function MedicationForm({
  initial,
  patients,
  fixedPatientId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Medication;
  patients?: Patient[];
  fixedPatientId?: string;
  submitLabel: string;
  onSubmit: (input: Omit<MedicationInput, 'patient_id'> & { patient_id: string }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [patientId, setPatientId] = useState(initial?.patient_id ?? fixedPatientId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.dose_amount) : '');
  const [unit, setUnit] = useState<DoseUnit | ''>(initial?.dose_unit ?? '');
  const [interval, setInterval] = useState(initial?.interval_hours != null ? String(initial.interval_hours) : '');
  const [maxDay, setMaxDay] = useState(initial?.max_doses_per_day != null ? String(initial.max_doses_per_day) : '');
  const [note, setNote] = useState(initial?.plan_note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    const amt = Number(amount);
    const iv = parseOptNumber(interval);
    const mx = parseOptNumber(maxDay);
    if (!patientId) return setError('Choose who this medicine is for.');
    if (!name.trim()) return setError('Enter the medicine name.');
    if (!(amt > 0)) return setError('Enter the dose amount.');
    if (!unit) return setError('Choose a unit.');
    if (iv === 'bad') return setError('"Every __ hours" must be a number, or leave it empty.');
    if (mx === 'bad' || (mx != null && !Number.isInteger(mx))) return setError('"Up to __ times a day" must be a whole number, or leave it empty.');
    setBusy(true);
    try {
      await onSubmit({
        patient_id: patientId,
        name: name.trim(),
        dose_amount: amt,
        dose_unit: unit,
        interval_hours: iv,
        max_doses_per_day: mx,
        plan_note: note.trim(),
        archived: initial?.archived ?? false,
      });
    } catch (e) {
      console.error(e);
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form" data-testid="med-form">
      <p className="guidance">{PLAN_GUIDANCE}</p>
      {patients && !fixedPatientId && (
        <Field label="For">
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Choose…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Medicine name">
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="As written on the label" data-testid="med-name" />
      </Field>
      <div className="row">
        <Field label="Dose">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="med-amount" />
        </Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value as DoseUnit)} data-testid="med-unit">
            <option value="">Choose…</option>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row">
        <Field label="Every __ hours" hint="Optional">
          <input inputMode="decimal" value={interval} onChange={(e) => setInterval(e.target.value)} data-testid="med-interval" />
        </Field>
        <Field label="Up to __ times a day" hint="Optional">
          <input inputMode="numeric" value={maxDay} onChange={(e) => setMaxDay(e.target.value)} data-testid="med-max" />
        </Field>
      </div>
      <Field label="Note" hint='Optional, e.g. "with food, 10 days". The app does not read this.'>
        <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="btn btn-primary" disabled={busy} onClick={submit} data-testid="med-save">
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
