import { useState } from 'react';
import { addPatient, renameGroup, saveMedication } from '../../data/repo';
import type { AppCtx } from '../App';
import { Field, Header } from '../components/Common';
import { MedicationForm } from '../components/MedicationForm';
import { navigate } from '../router';

/** First-time setup: one child + one medicine. More can be added later in Settings. */
export function Setup({ ctx }: { ctx: AppCtx }) {
  const existing = ctx.snap.patients[0];
  const [childName, setChildName] = useState('');
  const [patientId, setPatientId] = useState<string | null>(existing?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  if (!ctx.isManager) {
    navigate('/home', { replace: true });
    return null;
  }

  async function saveChild() {
    setError(null);
    const n = childName.trim();
    if (!n) return setError("Enter your child's first name or a nickname.");
    try {
      const id = await addPatient(ctx.snap.group!.id, n);
      if (ctx.snap.group!.name === 'Our care team') {
        await renameGroup(ctx.snap.group!, `${n}'s care team`);
      }
      setPatientId(id);
    } catch (e) {
      console.error(e);
      setError("Couldn't save. Check your connection and try again.");
    }
  }

  return (
    <main className="page">
      <Header title="Set up" conn={ctx.conn} />
      {!patientId ? (
        <section className="form">
          <h2>Who are you caring for?</h2>
          <Field label="Child's name" hint="A first name or nickname is enough. No full names or birthdays.">
            <input value={childName} maxLength={30} onChange={(e) => setChildName(e.target.value)} placeholder="Name" data-testid="child-name" />
          </Field>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" onClick={saveChild} data-testid="child-save">
            Next
          </button>
        </section>
      ) : (
        <section>
          <h2>Add a medicine</h2>
          <MedicationForm
            fixedPatientId={patientId}
            submitLabel="Save"
            onSubmit={async (input) => {
              await saveMedication(ctx.snap.group!.id, input);
              navigate('/home', { replace: true });
            }}
            onCancel={() => navigate('/home', { replace: true })}
          />
        </section>
      )}
    </main>
  );
}
