import { useState } from 'react';
import { createGroup } from '../../data/repo';
import type { Caregiver } from '../../domain/types';
import { BrandMark, DisclaimerCheck, DisclaimerText, Field, errorCode } from '../components/Common';
import { navigate } from '../router';

export function Welcome({ caregiver }: { caregiver: Caregiver | null }) {
  const [step, setStep] = useState<'intro' | 'form'>('intro');
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

  if (step === 'intro') {
    return (
      <main className="page welcome">
        <BrandMark />
        <h1>Who gave the last dose?</h1>
        <p className="lead">One shared medicine log for everyone caring for your child. No more texting at 3 AM.</p>
        <ol className="steps">
          <li>
            <span className="step-num">1</span>Tap the sticker on the bottle
          </li>
          <li>
            <span className="step-num">2</span>Check the dose, press once
          </li>
          <li>
            <span className="step-num">3</span>Your partner sees it in seconds
          </li>
        </ol>
        <p className="muted small">Oh Right! is a log, not medical advice. You'll read the full notice on the next step.</p>
        <div className="welcome-cta">
          <button className="btn btn-primary btn-lg" onClick={() => setStep('form')} data-testid="start">
            Start a care team
          </button>
          <p className="muted small">Got an invite link? Open it on this phone to join instead.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="header">
        <button className="icon-btn" aria-label="Back" onClick={() => setStep('intro')}>
          ‹
        </button>
        <span className="header-title">Start a care team</span>
      </header>
      <h1>Before you start</h1>
      <p className="muted">Please read this notice before you start.</p>
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
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary btn-lg" disabled={!ok || !trimmed || busy} onClick={create} data-testid="create-group">
          Create a care team
        </button>
      </div>
    </main>
  );
}
