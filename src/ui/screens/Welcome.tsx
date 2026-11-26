import { useState } from 'react';
import { createGroup } from '../../data/repo';
import type { Caregiver } from '../../domain/types';
import { DisclaimerCheck, DisclaimerText, Field, errorCode } from '../components/Common';
import { navigate } from '../router';

export function Welcome({ caregiver }: { caregiver: Caregiver | null }) {
  const [ok, setOk] = useState(false);
  const [name, setName] = useState(caregiver?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await createGroup({ displayName: trimmed, groupName: 'Our care team', caregiverExists: !!caregiver });
      navigate('/setup', { replace: true });
    } catch (e) {
      console.error(e);
      setError(`Couldn't create the group. Check your connection and try again. (${errorCode(e)})`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1 className="hero">Oh Right!</h1>
      <p className="lead">One shared log so everyone caring for your child knows what medicine was given, when, and by whom.</p>
      <DisclaimerText />
      <DisclaimerCheck checked={ok} onChange={setOk} />
      <Field label="Your name" hint="This is what others in your care group will see. For example, Dad, Grandma or Sam.">
        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="given-name"
          data-testid="name-input"
        />
      </Field>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={!ok || !trimmed || busy} onClick={create} data-testid="create-group">
        Create a care group
      </button>
      <p className="muted small">Got an invite link? Open it on this phone to join instead.</p>
    </main>
  );
}
