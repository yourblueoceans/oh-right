import { useEffect, useState } from 'react';
import { acceptDisclaimerAgain, clearMyGroup } from '../../data/repo';
import { DisclaimerCheck, DisclaimerText } from '../components/Common';
import { navigate } from '../router';

export function Loading({ text = 'Loading…' }: { text?: string }) {
  // If loading hangs (seen in chat apps' built-in browsers), don't leave a blank-looking page.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="page center">
      <p className="muted">{text}</p>
      {slow && (
        <div data-testid="loading-slow">
          <p>This is taking longer than usual. Check your connection, then reload.</p>
          <p className="muted small">If you opened this from a chat app, open the link in Safari or Chrome instead.</p>
          <button className="btn btn-secondary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      )}
    </main>
  );
}

/** Spec: a sticker opened on a device that isn't in the care group shows nothing about the medicine. */
export function MembersOnly() {
  return (
    <main className="page center" data-testid="members-only">
      <h1>Oh Right!</h1>
      <p className="lead">This sticker only works for members of its care group.</p>
      <p className="muted">
        If you are a member, open your invite link in this browser first, then tap the sticker again.
      </p>
      <button className="btn btn-secondary" onClick={() => navigate('/')}>
        Go to start
      </button>
    </main>
  );
}

export function ReAccept() {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <main className="page">
      <h1>Please review</h1>
      <p className="lead">Our notice has changed. Please read it and agree to keep using Oh Right!</p>
      <DisclaimerText />
      <DisclaimerCheck checked={ok} onChange={setOk} />
      <button
        className="btn btn-primary"
        disabled={!ok || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await acceptDisclaimerAgain();
          } finally {
            setBusy(false);
          }
        }}
      >
        Continue
      </button>
    </main>
  );
}

export function Removed() {
  return (
    <main className="page center" data-testid="removed">
      <h1>You're no longer in this care group</h1>
      <p className="muted">A manager may have removed you, or the group was closed.</p>
      <button
        className="btn btn-primary"
        onClick={async () => {
          await clearMyGroup();
          navigate('/', { replace: true });
        }}
      >
        Start over
      </button>
    </main>
  );
}
