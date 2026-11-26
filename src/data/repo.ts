/**
 * Data access layer. Screens only call these functions, so the backend could be swapped
 * (spec: recordDose / undoDose / subscribeGroup behind a repository).
 */
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  limit,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { DISCLAIMER_VERSION } from '../config';
import { newDoseId, newInviteCode, newStickerId } from '../domain/ids';
import { clock } from './clock';
import type {
  CareGroup,
  Caregiver,
  DoseEvent,
  DoseSource,
  DoseUnit,
  Medication,
  Member,
  NoticeKind,
  Patient,
  Role,
  Sticker,
} from '../domain/types';

// ---------------------------------------------------------------- auth

export function ensureSignedIn(): Promise<User> {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (user) => {
      off();
      if (user) resolve(user);
      else signInAnonymously(auth).then((c) => resolve(c.user), reject);
    });
  });
}

export function myUid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  return u.uid;
}

// ---------------------------------------------------------------- helpers

function tsMs(v: unknown): number | null {
  return v instanceof Timestamp ? v.toMillis() : null;
}

function errCode(e: unknown): string {
  return (e as { code?: string })?.code ?? 'unknown';
}

export function isPermissionDenied(e: unknown): boolean {
  return errCode(e) === 'permission-denied';
}

const caregiverRef = (uid: string) => doc(db, 'caregivers', uid);
const groupRef = (gid: string) => doc(db, 'groups', gid);
const memberRef = (gid: string, uid: string) => doc(db, 'groups', gid, 'members', uid);
const inviteRef = (code: string) => doc(db, 'invites', code);

// ---------------------------------------------------------------- caregiver

export function subscribeCaregiver(uid: string, cb: (c: Caregiver | null) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    caregiverRef(uid),
    { includeMetadataChanges: true },
    (s) => {
      if (!s.exists()) return cb(null);
      const d = s.data();
      cb({
        id: s.id,
        display_name: d.display_name,
        disclaimer_version: d.disclaimer_version,
        group_id: d.group_id ?? null,
        confirmed: !s.metadata.hasPendingWrites,
      });
    },
    onError,
  );
}

function caregiverWrite(displayName: string, isNew: boolean, groupId: string | null) {
  return {
    display_name: displayName,
    disclaimer_version: DISCLAIMER_VERSION,
    disclaimer_accepted_at: serverTimestamp(),
    group_id: groupId,
    ...(isNew ? { created_at: serverTimestamp() } : {}),
  };
}

export async function acceptDisclaimerAgain(): Promise<void> {
  await updateDoc(caregiverRef(myUid()), {
    disclaimer_version: DISCLAIMER_VERSION,
    disclaimer_accepted_at: serverTimestamp(),
  });
}

/** Measure server-vs-device clock difference by round-tripping a server timestamp (S9). */
export async function measureClockOffset(): Promise<void> {
  const uid = myUid();
  const t0 = Date.now();
  await updateDoc(caregiverRef(uid), { clock_ping: serverTimestamp() });
  const t1 = Date.now();
  const s = await getDoc(caregiverRef(uid));
  const server = tsMs(s.get('clock_ping'));
  if (server != null) clock.setMeasuredOffset(server - (t0 + t1) / 2);
}

// ---------------------------------------------------------------- group create / join / leave

export async function createGroup(args: { displayName: string; groupName: string; caregiverExists: boolean }) {
  const uid = myUid();
  const gid = doc(collection(db, 'groups')).id;
  const code = newInviteCode();
  const b = writeBatch(db);
  b.set(caregiverRef(uid), caregiverWrite(args.displayName, !args.caregiverExists, gid), { merge: true });
  b.set(groupRef(gid), {
    name: args.groupName,
    manager_invite_code: code,
    helper_invite_code: null,
    helper_invites_enabled: false,
    manager_count: 1,
    created_by: uid,
    created_at: serverTimestamp(),
  });
  b.set(memberRef(gid, uid), {
    caregiver_id: uid,
    display_name: args.displayName,
    role: 'manager',
    joined_at: serverTimestamp(),
    invite_code: null,
  });
  b.set(inviteRef(code), {
    group_id: gid,
    group_name: args.groupName,
    role: 'manager',
    created_by: uid,
    created_at: serverTimestamp(),
  });
  await b.commit();
  return gid;
}

export interface InviteInfo {
  code: string;
  group_id: string;
  group_name: string;
  role: Role;
}

export async function lookupInvite(code: string): Promise<InviteInfo | null> {
  try {
    const s = await getDoc(inviteRef(code));
    if (!s.exists()) return null;
    const d = s.data();
    return { code, group_id: d.group_id, group_name: d.group_name, role: d.role };
  } catch (e) {
    if (isPermissionDenied(e)) return null;
    throw e;
  }
}

export type JoinResult = 'ok' | 'full' | 'invalid';

export async function joinGroup(args: { invite: InviteInfo; displayName: string; caregiverExists: boolean }): Promise<JoinResult> {
  const uid = myUid();
  const { invite } = args;
  const b = writeBatch(db);
  b.set(caregiverRef(uid), caregiverWrite(args.displayName, !args.caregiverExists, invite.group_id), { merge: true });
  b.set(memberRef(invite.group_id, uid), {
    caregiver_id: uid,
    display_name: args.displayName,
    role: invite.role,
    joined_at: serverTimestamp(),
    invite_code: invite.code,
  });
  if (invite.role === 'manager') b.update(groupRef(invite.group_id), { manager_count: increment(1) });
  try {
    await b.commit();
    return 'ok';
  } catch (e) {
    if (!isPermissionDenied(e)) throw e;
    // Rules refuse a manager join once 2 managers exist, or when the invite was replaced.
    const still = await lookupInvite(invite.code);
    return still && invite.role === 'manager' ? 'full' : 'invalid';
  }
}

export async function leaveGroup(gid: string, role: Role): Promise<void> {
  const uid = myUid();
  const b = writeBatch(db);
  b.delete(memberRef(gid, uid));
  if (role === 'manager') b.update(groupRef(gid), { manager_count: increment(-1) });
  b.update(caregiverRef(uid), { group_id: null });
  await b.commit();
}

/** After being removed from a group, forget it locally so the person can start over. */
export async function clearMyGroup(): Promise<void> {
  await updateDoc(caregiverRef(myUid()), { group_id: null });
}

export async function removeHelper(gid: string, uid: string): Promise<void> {
  await deleteDoc(memberRef(gid, uid));
}

export async function updateMyName(gid: string, name: string): Promise<void> {
  const uid = myUid();
  const b = writeBatch(db);
  b.update(memberRef(gid, uid), { display_name: name });
  b.update(caregiverRef(uid), { display_name: name });
  await b.commit();
}

export async function renameGroup(group: CareGroup, name: string): Promise<void> {
  const b = writeBatch(db);
  b.update(groupRef(group.id), { name });
  // Keep the name shown on the Join screen in sync.
  if (group.manager_invite_code) b.update(inviteRef(group.manager_invite_code), { group_name: name });
  if (group.helper_invite_code) b.update(inviteRef(group.helper_invite_code), { group_name: name });
  await b.commit();
}

export async function regenerateManagerInvite(group: CareGroup): Promise<void> {
  const code = newInviteCode();
  const b = writeBatch(db);
  if (group.manager_invite_code) b.delete(inviteRef(group.manager_invite_code));
  b.set(inviteRef(code), {
    group_id: group.id,
    group_name: group.name,
    role: 'manager',
    created_by: myUid(),
    created_at: serverTimestamp(),
  });
  b.update(groupRef(group.id), { manager_invite_code: code });
  await b.commit();
}

/** Premium switch. In the prototype it just turns helper invites on/off without payment. */
export async function setHelperInvites(group: CareGroup, enabled: boolean): Promise<void> {
  const b = writeBatch(db);
  if (group.helper_invite_code) b.delete(inviteRef(group.helper_invite_code));
  if (enabled) {
    const code = newInviteCode();
    b.update(groupRef(group.id), { helper_invites_enabled: true, helper_invite_code: code });
    b.set(inviteRef(code), {
      group_id: group.id,
      group_name: group.name,
      role: 'helper',
      created_by: myUid(),
      created_at: serverTimestamp(),
    });
  } else {
    b.update(groupRef(group.id), { helper_invites_enabled: false, helper_invite_code: null });
  }
  await b.commit();
}

// ---------------------------------------------------------------- patients / medications / stickers

export async function addPatient(gid: string, name: string): Promise<string> {
  const ref = doc(collection(db, 'groups', gid, 'patients'));
  await setDoc(ref, { group_id: gid, display_name: name, created_at: serverTimestamp() });
  return ref.id;
}

export interface MedicationInput {
  patient_id: string;
  name: string;
  dose_amount: number;
  dose_unit: DoseUnit;
  interval_hours: number | null;
  max_doses_per_day: number | null;
  plan_note: string;
  archived: boolean;
}

export async function saveMedication(gid: string, input: MedicationInput, id?: string): Promise<string> {
  const ref = id ? doc(db, 'groups', gid, 'medications', id) : doc(collection(db, 'groups', gid, 'medications'));
  await setDoc(ref, { ...input, group_id: gid });
  return ref.id;
}

export async function createSticker(gid: string, med: Medication, label: string): Promise<string> {
  const id = newStickerId();
  await setDoc(doc(db, 'stickers', id), {
    group_id: gid,
    medication_id: med.id,
    patient_id: med.patient_id,
    label,
    created_at: serverTimestamp(),
  });
  return id;
}

export async function deleteSticker(id: string): Promise<void> {
  await deleteDoc(doc(db, 'stickers', id));
}

/** Resolve /t/<sticker_id>. Returns null for unknown stickers AND for non-members (same answer). */
export async function getSticker(id: string): Promise<Sticker | null> {
  try {
    const s = await getDoc(doc(db, 'stickers', id));
    if (!s.exists()) return null;
    const d = s.data();
    return { id: s.id, group_id: d.group_id, medication_id: d.medication_id, label: d.label ?? '' };
  } catch (e) {
    if (isPermissionDenied(e)) return null;
    throw e;
  }
}

// ---------------------------------------------------------------- dose events

export interface RecordDoseInput {
  gid: string;
  medication: Medication;
  caregiverName: string;
  doseAmount: number;
  source: DoseSource;
  stickerId: string | null;
  notices: NoticeKind[];
}

/**
 * Optimistic: returns immediately with the event id. The SDK shows it locally at once (S2),
 * keeps it if offline and re-sends on reconnect (S3). The id is the idempotency key (S4).
 */
export function recordDose(input: RecordDoseInput, onError: (e: unknown) => void): string {
  const id = newDoseId();
  const uid = myUid();
  setDoc(doc(db, 'groups', input.gid, 'doses', id), {
    id,
    group_id: input.gid,
    patient_id: input.medication.patient_id,
    medication_id: input.medication.id,
    medication_name: input.medication.name,
    caregiver_id: uid,
    caregiver_name: input.caregiverName,
    dose_amount: input.doseAmount,
    dose_unit: input.medication.dose_unit,
    given_at: Timestamp.fromMillis(clock.now()),
    received_at: serverTimestamp(),
    source: input.source,
    sticker_id: input.stickerId,
    status: 'given',
    undone_at: null,
    undone_by: null,
    undone_by_name: null,
    notices_shown: input.notices,
  }).catch(onError);
  return id;
}

export function undoDose(gid: string, doseId: string, myName: string, onError: (e: unknown) => void): void {
  updateDoc(doc(db, 'groups', gid, 'doses', doseId), {
    status: 'undone',
    undone_at: serverTimestamp(),
    undone_by: myUid(),
    undone_by_name: myName,
  }).catch(onError);
}

// ---------------------------------------------------------------- live group subscription

export interface GroupSnapshot {
  group: CareGroup | null;
  members: Member[];
  patients: Patient[];
  medications: Medication[];
  doses: DoseEvent[];
  stickers: Sticker[];
  /** True while any listener is still showing cached (possibly stale) data. */
  fromCache: boolean;
  loaded: boolean;
  removed: boolean;
}

function toDose(s: QueryDocumentSnapshot<DocumentData>): DoseEvent {
  const d = s.data({ serverTimestamps: 'estimate' });
  return {
    id: s.id,
    patient_id: d.patient_id,
    medication_id: d.medication_id,
    medication_name: d.medication_name ?? '',
    caregiver_id: d.caregiver_id,
    caregiver_name: d.caregiver_name ?? '',
    dose_amount: d.dose_amount,
    dose_unit: d.dose_unit,
    givenAtMs: tsMs(d.given_at) ?? 0,
    receivedAtMs: tsMs(d.received_at),
    source: d.source,
    sticker_id: d.sticker_id ?? null,
    status: d.status,
    undoneAtMs: tsMs(d.undone_at),
    undone_by: d.undone_by ?? null,
    undone_by_name: d.undone_by_name ?? null,
    notices_shown: d.notices_shown ?? [],
    pending: s.metadata.hasPendingWrites,
  };
}

function toGroup(s: DocumentSnapshot<DocumentData>): CareGroup | null {
  if (!s.exists()) return null;
  const d = s.data();
  return {
    id: s.id,
    name: d.name,
    manager_invite_code: d.manager_invite_code ?? null,
    helper_invite_code: d.helper_invite_code ?? null,
    helper_invites_enabled: !!d.helper_invites_enabled,
    manager_count: d.manager_count ?? 0,
    created_by: d.created_by,
  };
}

/** One latency sample: a dose by someone else arrived on this screen (S10). */
export interface LatencySample {
  doseId: string;
  who: string;
  seconds: number;
  atMs: number;
}

export function subscribeGroup(
  gid: string,
  myId: string,
  cb: (s: GroupSnapshot) => void,
  onRemoteDose: (sample: LatencySample) => void,
): () => void {
  const state: GroupSnapshot = {
    group: null,
    members: [],
    patients: [],
    medications: [],
    doses: [],
    stickers: [],
    fromCache: true,
    loaded: false,
    removed: false,
  };
  const cacheFlags: Record<string, boolean> = {};
  const seen = new Set<string>();
  const emit = () => {
    state.fromCache = Object.values(cacheFlags).some(Boolean) || Object.keys(cacheFlags).length < 6;
    cb({ ...state });
  };
  const onErr = (e: unknown) => {
    if (isPermissionDenied(e)) {
      state.removed = true;
      state.loaded = true;
      emit();
    } else console.error(e);
  };
  const opts = { includeMetadataChanges: true };
  const unsubs: Array<() => void> = [];

  unsubs.push(
    onSnapshot(groupRef(gid), opts, (s) => {
      cacheFlags.group = s.metadata.fromCache;
      state.group = toGroup(s);
      state.loaded = true;
      emit();
    }, onErr),
  );
  unsubs.push(
    onSnapshot(collection(db, 'groups', gid, 'members'), opts, (s) => {
      cacheFlags.members = s.metadata.fromCache;
      state.members = s.docs.map((m) => ({
        caregiver_id: m.id,
        display_name: m.get('display_name'),
        role: m.get('role'),
        joinedAtMs: tsMs(m.get('joined_at')),
      }));
      // If my own membership disappeared while online (a manager removed me), show that.
      if (!s.metadata.fromCache && !s.docs.some((m) => m.id === myId)) state.removed = true;
      emit();
    }, onErr),
  );
  unsubs.push(
    onSnapshot(collection(db, 'groups', gid, 'patients'), opts, (s) => {
      cacheFlags.patients = s.metadata.fromCache;
      state.patients = s.docs
        .map((p) => ({ id: p.id, display_name: p.get('display_name') as string, created: tsMs(p.get('created_at')) ?? 0 }))
        .sort((a, b) => a.created - b.created)
        .map(({ id, display_name }) => ({ id, display_name }));
      emit();
    }, onErr),
  );
  unsubs.push(
    onSnapshot(collection(db, 'groups', gid, 'medications'), opts, (s) => {
      cacheFlags.medications = s.metadata.fromCache;
      state.medications = s.docs.map((m) => {
        const d = m.data();
        return {
          id: m.id,
          patient_id: d.patient_id,
          name: d.name,
          dose_amount: d.dose_amount,
          dose_unit: d.dose_unit,
          interval_hours: d.interval_hours ?? null,
          max_doses_per_day: d.max_doses_per_day ?? null,
          plan_note: d.plan_note ?? '',
          archived: !!d.archived,
        };
      });
      emit();
    }, onErr),
  );
  unsubs.push(
    onSnapshot(query(collection(db, 'stickers'), where('group_id', '==', gid)), opts, (s) => {
      cacheFlags.stickers = s.metadata.fromCache;
      state.stickers = s.docs.map((t) => ({
        id: t.id,
        group_id: gid,
        medication_id: t.get('medication_id'),
        label: t.get('label') ?? '',
      }));
      emit();
    }, onErr),
  );

  // Last 48 h is enough for today's timeline and for "every N hours" comparisons.
  let liveSince: boolean = false;
  const since = Timestamp.fromMillis(Date.now() - 48 * 3_600_000);
  unsubs.push(
    onSnapshot(
      query(collection(db, 'groups', gid, 'doses'), where('given_at', '>=', since), orderBy('given_at', 'desc'), limit(500)),
      opts,
      (s) => {
        cacheFlags.doses = s.metadata.fromCache;
        const arrival = clock.now();
        for (const ch of s.docChanges()) {
          const id = ch.doc.id;
          if (ch.type !== 'added' || seen.has(id)) continue;
          seen.add(id);
          const ev = toDose(ch.doc);
          // Only measure records that arrive live from someone else, after the first server sync.
          if (liveSince && !s.metadata.fromCache && ev.caregiver_id !== myId) {
            onRemoteDose({ doseId: id, who: ev.caregiver_name, seconds: (arrival - ev.givenAtMs) / 1000, atMs: arrival });
          }
        }
        if (!s.metadata.fromCache) liveSince = true;
        state.doses = s.docs.map(toDose);
        emit();
      },
      onErr,
    ),
  );

  return () => unsubs.forEach((u) => u());
}
