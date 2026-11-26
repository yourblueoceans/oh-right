import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ensureSignedIn,
  measureClockOffset,
  subscribeCaregiver,
  subscribeGroup,
  type GroupSnapshot,
  type LatencySample,
} from '../data/repo';
import type { Caregiver, Member } from '../domain/types';
import { DISCLAIMER_VERSION } from '../config';
import { navigate, useRoute } from './router';
import { useConnection, type ConnState } from './hooks';
import { Welcome } from './screens/Welcome';
import { Join } from './screens/Join';
import { Setup } from './screens/Setup';
import { Home } from './screens/Home';
import { StickerScreen } from './screens/StickerScreen';
import { Settings } from './screens/Settings';
import { ReAccept, Removed, MembersOnly, Loading } from './screens/Misc';
import { Toast, type ToastState } from './components/Toast';
import { InAppBanner } from './components/Common';

export interface AppCtx {
  user: User;
  caregiver: Caregiver;
  me: Member;
  isManager: boolean;
  snap: GroupSnapshot;
  conn: ConnState;
  latency: LatencySample[];
  showToast: (t: ToastState) => void;
}

export function App() {
  const { route, search } = useRoute();
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [caregiver, setCaregiver] = useState<Caregiver | null | undefined>(undefined);
  const [snap, setSnap] = useState<GroupSnapshot | null>(null);
  const [latency, setLatency] = useState<LatencySample[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const conn = useConnection(snap ? snap.fromCache : true);

  useEffect(() => {
    ensureSignedIn().then(setUser, (e) => setAuthError(String(e?.message ?? e)));
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeCaregiver(user.uid, setCaregiver, (e) => {
      console.error(e);
      setCaregiver(null);
    });
  }, [user]);

  // Only open the group once the server has confirmed we belong to it; otherwise the
  // listeners would be refused for a moment right after creating/joining.
  const [gid, setGid] = useState<string | null>(null);
  useEffect(() => {
    if (caregiver === undefined) return;
    if (!caregiver) return setGid(null);
    if (caregiver.confirmed) setGid(caregiver.group_id);
  }, [caregiver]);

  useEffect(() => {
    setSnap(null);
    if (!user || !gid) return;
    return subscribeGroup(gid, user.uid, setSnap, (s) =>
      setLatency((prev) => [s, ...prev].slice(0, 20)),
    );
  }, [user, gid]);

  // Measure clock skew once we're online with a profile (S9).
  const measured = useRef(false);
  useEffect(() => {
    if (!caregiver || measured.current || conn !== 'online') return;
    measured.current = true;
    measureClockOffset().catch(() => (measured.current = false));
  }, [caregiver, conn]);

  const showToast = useCallback((t: ToastState) => setToast(t), []);

  return (
    <>
      <InAppBanner />
      {renderRoute()}
    </>
  );

  function renderRoute() {
  // ---------- routing ----------
  if (authError) return <Loading text={`Couldn't start: ${authError}. Check your connection and reload.`} />;
  if (!user || caregiver === undefined) return <Loading stage={!user ? 'auth' : 'profile'} />;

  const hasGroup = !!caregiver?.group_id;

  if (route.name === 'join') {
    const myRole = snap?.members.find((m) => m.caregiver_id === user.uid)?.role ?? null;
    return <Join code={route.code} caregiver={caregiver} currentGroupName={snap?.group?.name ?? null} currentRole={myRole} />;
  }

  if (!caregiver || !hasGroup) {
    if (route.name === 'sticker') return <MembersOnly />;
    return <Welcome caregiver={caregiver} />;
  }

  if (caregiver.disclaimer_version !== DISCLAIMER_VERSION) return <ReAccept />;
  if (!snap || !snap.loaded) return <Loading stage={!gid ? 'confirm' : 'group'} />;
  if (snap.removed) return <Removed />;

  const me = snap.members.find((m) => m.caregiver_id === user.uid);
  if (!me || !snap.group) return <Loading stage="member" />;

  const ctx: AppCtx = {
    user,
    caregiver,
    me,
    isManager: me.role === 'manager',
    snap,
    conn,
    latency,
    showToast,
  };

  let screen;
  switch (route.name) {
    case 'sticker':
      screen = <StickerScreen ctx={ctx} stickerId={route.id} search={search} />;
      break;
    case 'setup':
      screen = <Setup ctx={ctx} />;
      break;
    case 'settings':
      screen = <Settings ctx={ctx} />;
      break;
    case 'root':
      queueMicrotask(() => navigate('/home', { replace: true }));
      screen = <Home ctx={ctx} />;
      break;
    default:
      screen = <Home ctx={ctx} />;
  }

  return (
    <>
      {screen}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
  }
}
