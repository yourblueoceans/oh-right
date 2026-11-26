import { useEffect, useState } from 'react';
import { joinGroup, lookupInvite, type InviteInfo } from '../../data/repo';
import type { Caregiver } from '../../domain/types';
import { DisclaimerCheck, DisclaimerText, Field } from '../components/Common';
import { Loading } from './Misc';
import { navigate } from '../router';

export function Join({
  code,
  caregiver,
  currentGroupName,
}: {
  code: string;
  caregiver: Caregiver | null;
  currentGroupName: string | null;
}) {
  const [invite, setInvite] = useState<InviteInfo | null | undefined>(undefined);
  const [ok, setOk] = useState(false);
  const [name, setName] = useState(caregiver?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lookupInvite(code).then(setInvite, () => setInvite(null));
  }, [code]);

  if (invite === undefined) return <Loading />;

  if (caregiver?.group_id && invite && caregiver.group_id === invite.group_id) {
    return (
      <main className="page center">
        <h1>You're already in this group</h1>
        <button className="btn btn-primary" onClick={() => navigate('/home', { replace: true })}>
          Open Oh Right!
        </button>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="page center" data-testid="invite-invalid">
        <h1>This invite link doesn't work</h1>
        <p className="muted">It may have been replaced with a new one. Ask the person who sent it for a new link.</p>
      </main>
    );
  }

  const trimmed = name.trim();
  const roleText =
    invite.role === 'manager'
      ? 'You will join as a manager. Managers can set up medicines and undo records.'
      : 'You will join as a helper. Helpers can log doses and see the log.';

  async function join() {
    if (!invite) return;
    setBusy(true);
    setError(null);
    try {
      const r = await joinGroup({ invite, displayName: trimmed, caregiverExists: !!caregiver });
      if (r === 'ok') navigate('/home', { replace: true });
      else if (r === 'full')
        setError('This care group already has 2 managers, the maximum. Ask them to invite you as a helper instead.');
      else setError("This invite link doesn't work anymore. Ask for a new one.");
    } catch (e) {
      console.error(e);
      setError("Couldn't join. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Join {invite.group_name}</h1>
      <p className="lead">{roleText}</p>
      {caregiver?.group_id && (
        <p className="banner banner-warn">
          You're already in {currentGroupName ?? 'another care group'} on this phone. Joining will switch you to this one.
        </p>
      )}
      <DisclaimerText />
      <DisclaimerCheck checked={ok} onChange={setOk} />
      <Field label="Your name" hint="This is what others in the group will see.">
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Your name" data-testid="name-input" />
      </Field>
      {error && (
        <p className="error" data-testid="join-error">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={!ok || !trimmed || busy} onClick={join} data-testid="join">
        Join
      </button>
    </main>
  );
}
