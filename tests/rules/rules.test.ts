/**
 * Security rules tests (run against the Firestore emulator: `npm run test:rules`).
 * Each test maps to a permission in docs/spec.md "권한 규칙" / acceptance criteria.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  doc,
  getDoc,
  getDocs,
  collection,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;
const GID = 'g1';
const MCODE = 'mgrcode12345';
const HCODE = 'hlpcode12345';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ohright-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const db = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

function caregiver(name: string, groupId: string) {
  return { display_name: name, disclaimer_version: '2026-11-26', disclaimer_accepted_at: serverTimestamp(), group_id: groupId };
}

async function createGroup(uid = 'mom') {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(d, 'caregivers', uid), caregiver('Mom', GID));
  b.set(doc(d, 'groups', GID), {
    name: "Mia's care team",
    helper_invites_enabled: false,
    manager_count: 1,
    created_by: uid,
    created_at: serverTimestamp(),
  });
  b.set(doc(d, 'groups', GID, 'members', uid), { caregiver_id: uid, display_name: 'Mom', role: 'manager', joined_at: serverTimestamp() });
  b.set(doc(d, 'groups', GID, 'private', 'invites'), { manager_invite_code: MCODE, helper_invite_code: null });
  b.set(doc(d, 'invites', MCODE), { group_id: GID, group_name: "Mia's care team", role: 'manager', created_by: uid, created_at: serverTimestamp() });
  await b.commit();
}

function joinBatch(uid: string, name: string, code: string, role: 'manager' | 'helper', bumpCount = role === 'manager', gid = GID) {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(d, 'caregivers', uid), caregiver(name, gid));
  b.set(doc(d, 'groups', gid, 'joins', uid), { invite_code: code });
  b.set(doc(d, 'groups', gid, 'members', uid), { caregiver_id: uid, display_name: name, role, joined_at: serverTimestamp() });
  if (bumpCount) b.update(doc(d, 'groups', gid), { manager_count: increment(1) });
  return b;
}

async function enableHelpers() {
  const d = db('mom');
  const b = writeBatch(d);
  b.update(doc(d, 'groups', GID), { helper_invites_enabled: true });
  b.set(doc(d, 'groups', GID, 'private', 'invites'), { helper_invite_code: HCODE }, { merge: true });
  b.set(doc(d, 'invites', HCODE), { group_id: GID, group_name: 'x', role: 'helper', created_by: 'mom', created_at: serverTimestamp() });
  await b.commit();
}

async function seedPatientMed() {
  const d = db('mom');
  await setDoc(doc(d, 'groups', GID, 'patients', 'mia'), { group_id: GID, display_name: 'Mia', created_at: serverTimestamp() });
  await setDoc(doc(d, 'groups', GID, 'medications', 'amox'), {
    group_id: GID,
    patient_id: 'mia',
    name: 'Amoxicillin',
    dose_amount: 250,
    dose_unit: 'mg',
    interval_hours: 8,
    max_doses_per_day: 3,
    plan_note: '',
    archived: false,
  });
}

function dose(uid: string, id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    group_id: GID,
    patient_id: 'mia',
    medication_id: 'amox',
    medication_name: 'Amoxicillin',
    caregiver_id: uid,
    caregiver_name: uid,
    dose_amount: 250,
    dose_unit: 'mg',
    given_at: Timestamp.now(),
    received_at: serverTimestamp(),
    source: 'button',
    sticker_id: null,
    status: 'given',
    undone_at: null,
    undone_by: null,
    undone_by_name: null,
    notices_shown: [],
    ...extra,
  };
}

const undo = (name: string, uid: string) => ({ status: 'undone', undone_at: serverTimestamp(), undone_by: uid, undone_by_name: name });

async function fullFamily() {
  await createGroup();
  await joinBatch('dad', 'Dad', MCODE, 'manager').commit();
  await enableHelpers();
  await joinBatch('grandma', 'Grandma', HCODE, 'helper').commit();
  await seedPatientMed();
}

describe('group creation and consent', () => {
  it('creator can create a group with themselves as the first manager', async () => {
    await assertSucceeds(createGroup());
  });

  it('cannot create a group claiming 2 managers or someone else as creator', async () => {
    const d = db('mom');
    const b = writeBatch(d);
    b.set(doc(d, 'groups', GID), { name: 'x', helper_invites_enabled: false, manager_count: 1, created_by: 'dad', created_at: serverTimestamp() });
    b.set(doc(d, 'groups', GID, 'members', 'mom'), { caregiver_id: 'mom', display_name: 'Mom', role: 'manager', joined_at: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('caregiver consent must record the server time (AC8c)', async () => {
    const d = db('mom');
    await assertFails(setDoc(doc(d, 'caregivers', 'mom'), { display_name: 'Mom', disclaimer_version: 'v', disclaimer_accepted_at: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(doc(d, 'caregivers', 'mom'), { display_name: 'Mom', disclaimer_accepted_at: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(d, 'caregivers', 'mom'), caregiver('Mom', GID)));
    await assertFails(getDoc(doc(db('dad'), 'caregivers', 'mom')));
  });
});

describe('manager invites (max 2)', () => {
  it('second manager can join with the invite', async () => {
    await createGroup();
    await assertSucceeds(joinBatch('dad', 'Dad', MCODE, 'manager').commit());
  });

  it('joining as manager without bumping the counter is refused', async () => {
    await createGroup();
    await assertFails(joinBatch('dad', 'Dad', MCODE, 'manager', false).commit());
  });

  it('a third manager cannot join once 2 managers exist (AC8d)', async () => {
    await createGroup();
    await joinBatch('dad', 'Dad', MCODE, 'manager').commit();
    await assertFails(joinBatch('aunt', 'Aunt', MCODE, 'manager').commit());
  });

  it('a wrong invite code is refused, and invites cannot be listed', async () => {
    await createGroup();
    await assertFails(joinBatch('dad', 'Dad', 'wrongcode1234', 'manager').commit());
    await assertFails(getDocs(collection(db('dad'), 'invites')));
    await assertSucceeds(getDoc(doc(db('dad'), 'invites', MCODE)));
  });

  it('cannot join as manager using a helper invite', async () => {
    await createGroup();
    await enableHelpers();
    await assertFails(joinBatch('sitter', 'Sitter', HCODE, 'manager').commit());
  });
});

describe('helper invites (premium switch)', () => {
  it('helper invite cannot be created while the switch is off (AC8g)', async () => {
    await createGroup();
    const d = db('mom');
    await assertFails(setDoc(doc(d, 'invites', HCODE), { group_id: GID, group_name: 'x', role: 'helper', created_by: 'mom', created_at: serverTimestamp() }));
  });

  it('helper can join only while the switch is on', async () => {
    await createGroup();
    await enableHelpers();
    const d = db('mom');
    await updateDoc(doc(d, 'groups', GID), { helper_invites_enabled: false });
    await assertFails(joinBatch('grandma', 'Grandma', HCODE, 'helper').commit());
    await updateDoc(doc(d, 'groups', GID), { helper_invites_enabled: true });
    await assertSucceeds(joinBatch('grandma', 'Grandma', HCODE, 'helper').commit());
  });

  it('a helper cannot create invites or flip the switch', async () => {
    await fullFamily();
    const g = db('grandma');
    await assertFails(updateDoc(doc(g, 'groups', GID), { helper_invites_enabled: false }));
    await assertFails(setDoc(doc(g, 'invites', 'helpercode999'), { group_id: GID, group_name: 'x', role: 'helper' }));
  });
});

describe('reading data', () => {
  it('members (managers and helpers) can read; outsiders cannot (AC12)', async () => {
    await fullFamily();
    await assertSucceeds(getDoc(doc(db('grandma'), 'groups', GID, 'medications', 'amox')));
    await assertSucceeds(getDocs(collection(db('dad'), 'groups', GID, 'doses')));
    await assertFails(getDoc(doc(db('stranger'), 'groups', GID)));
    await assertFails(getDocs(collection(db('stranger'), 'groups', GID, 'doses')));
    await assertFails(getDoc(doc(anon(), 'groups', GID, 'patients', 'mia')));
  });

  it('stickers resolve for members only (AC12)', async () => {
    await fullFamily();
    await assertSucceeds(setDoc(doc(db('mom'), 'stickers', 'k3f9x2m8qa'), { group_id: GID, medication_id: 'amox', patient_id: 'mia', label: 'Fridge', created_at: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db('grandma'), 'stickers', 'k3f9x2m8qa')));
    await assertSucceeds(getDocs(query(collection(db('dad'), 'stickers'), where('group_id', '==', GID))));
    await assertFails(getDoc(doc(db('stranger'), 'stickers', 'k3f9x2m8qa')));
    await assertFails(getDoc(doc(db('stranger'), 'stickers', 'doesnotexist')));
    await assertFails(getDocs(collection(db('stranger'), 'stickers')));
  });
});

describe('editing the plan', () => {
  it('managers can add/edit children and medicines; helpers cannot', async () => {
    await fullFamily();
    const med = { group_id: GID, patient_id: 'mia', name: 'Tylenol', dose_amount: 5, dose_unit: 'mL', interval_hours: null, max_doses_per_day: null, plan_note: '', archived: false };
    await assertSucceeds(setDoc(doc(db('dad'), 'groups', GID, 'medications', 'tyl'), med));
    await assertFails(setDoc(doc(db('grandma'), 'groups', GID, 'medications', 'tyl2'), med));
    await assertFails(updateDoc(doc(db('grandma'), 'groups', GID, 'medications', 'amox'), { dose_amount: 500 }));
    await assertFails(setDoc(doc(db('grandma'), 'groups', GID, 'patients', 'leo'), { group_id: GID, display_name: 'Leo' }));
    await assertFails(setDoc(doc(db('grandma'), 'stickers', 'abcdefghjk'), { group_id: GID, medication_id: 'amox', label: '' }));
  });

  it('medicine fields are validated (no hidden defaults needed, bad units refused)', async () => {
    await fullFamily();
    const base = { group_id: GID, patient_id: 'mia', name: 'X', dose_amount: 5, dose_unit: 'mL', interval_hours: null, max_doses_per_day: null, plan_note: '', archived: false };
    await assertFails(setDoc(doc(db('mom'), 'groups', GID, 'medications', 'a'), { ...base, dose_unit: 'spoon' }));
    await assertFails(setDoc(doc(db('mom'), 'groups', GID, 'medications', 'b'), { ...base, dose_amount: 0 }));
    await assertFails(setDoc(doc(db('mom'), 'groups', GID, 'medications', 'c'), { ...base, max_doses_per_day: 2.5 }));
    await assertFails(setDoc(doc(db('mom'), 'groups', GID, 'medications', 'd'), { ...base, patient_id: 'ghost' }));
  });
});

describe('dose events', () => {
  it('managers and helpers can record as themselves (AC8e)', async () => {
    await fullFamily();
    await assertSucceeds(setDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1'), dose('dad', 'd1')));
    await assertSucceeds(setDoc(doc(db('grandma'), 'groups', GID, 'doses', 'd2'), dose('grandma', 'd2', { source: 'nfc', sticker_id: 'k3f9x2m8qa' })));
  });

  it('nobody can record in someone else’s name, outsiders cannot record at all', async () => {
    await fullFamily();
    await assertFails(setDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1'), dose('mom', 'd1')));
    await assertFails(setDoc(doc(db('stranger'), 'groups', GID, 'doses', 'd2'), dose('stranger', 'd2')));
  });

  it('record must be well-formed: id = doc id, server receive time, status given', async () => {
    await fullFamily();
    const d = db('dad');
    await assertFails(setDoc(doc(d, 'groups', GID, 'doses', 'd1'), dose('dad', 'other')));
    await assertFails(setDoc(doc(d, 'groups', GID, 'doses', 'd2'), dose('dad', 'd2', { received_at: Timestamp.now() })));
    await assertFails(setDoc(doc(d, 'groups', GID, 'doses', 'd3'), dose('dad', 'd3', { status: 'undone' })));
    await assertFails(setDoc(doc(d, 'groups', GID, 'doses', 'd4'), dose('dad', 'd4', { source: 'magic' })));
    await assertFails(setDoc(doc(d, 'groups', GID, 'doses', 'd5'), dose('dad', 'd5', { medication_id: 'ghost' })));
  });

  it('re-sending the same record id keeps one record (S4 / AC8b)', async () => {
    await fullFamily();
    const d = db('dad');
    const payload = dose('dad', 'd1');
    await assertSucceeds(setDoc(doc(d, 'groups', GID, 'doses', 'd1'), payload));
    await assertSucceeds(setDoc(doc(d, 'groups', GID, 'doses', 'd1'), payload));
    let size = -1;
    await env.withSecurityRulesDisabled(async (c) => {
      size = (await getDocs(collection(c.firestore() as unknown as Firestore, 'groups', GID, 'doses'))).size;
    });
    if (size !== 1) throw new Error(`expected 1 dose, got ${size}`);
  });

  it('a manager can undo anyone’s record, leaving a trace (AC8f)', async () => {
    await fullFamily();
    await setDoc(doc(db('grandma'), 'groups', GID, 'doses', 'd1'), dose('grandma', 'd1'));
    await assertSucceeds(updateDoc(doc(db('mom'), 'groups', GID, 'doses', 'd1'), undo('Mom', 'mom')));
    // Cannot be "re-given" or undone twice.
    await assertFails(updateDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1'), { status: 'given' }));
    await assertFails(updateDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1'), undo('Dad', 'dad')));
  });

  it('undo must name the person undoing and cannot change the record itself', async () => {
    await fullFamily();
    await setDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1'), dose('dad', 'd1'));
    await assertFails(updateDoc(doc(db('mom'), 'groups', GID, 'doses', 'd1'), undo('Dad', 'dad')));
    await assertFails(updateDoc(doc(db('mom'), 'groups', GID, 'doses', 'd1'), { ...undo('Mom', 'mom'), dose_amount: 1 }));
  });

  it('a helper cannot undo or edit, even their own record (AC8e)', async () => {
    await fullFamily();
    await setDoc(doc(db('grandma'), 'groups', GID, 'doses', 'd1'), dose('grandma', 'd1'));
    await assertFails(updateDoc(doc(db('grandma'), 'groups', GID, 'doses', 'd1'), undo('Grandma', 'grandma')));
    await assertFails(updateDoc(doc(db('grandma'), 'groups', GID, 'doses', 'd1'), { dose_amount: 125 }));
  });

  it('nobody can delete a record', async () => {
    await fullFamily();
    await setDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1'), dose('dad', 'd1'));
    await assertFails(deleteDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1')));
    await assertFails(deleteDoc(doc(db('mom'), 'groups', GID, 'doses', 'd1')));
  });
});

describe('leaving and removing (Q14)', () => {
  it('a manager cannot remove the other manager', async () => {
    await fullFamily();
    await assertFails(deleteDoc(doc(db('mom'), 'groups', GID, 'members', 'dad')));
    const d = db('mom');
    const b = writeBatch(d);
    b.delete(doc(d, 'groups', GID, 'members', 'dad'));
    b.update(doc(d, 'groups', GID), { manager_count: increment(-1) });
    await assertFails(b.commit());
  });

  it('a manager can remove a helper; a helper cannot remove anyone', async () => {
    await fullFamily();
    await assertFails(deleteDoc(doc(db('grandma'), 'groups', GID, 'members', 'dad')));
    await assertSucceeds(deleteDoc(doc(db('mom'), 'groups', GID, 'members', 'grandma')));
    await assertFails(getDoc(doc(db('grandma'), 'groups', GID)));
  });

  it('anyone can leave; a leaving manager frees a slot, and their records stay (AC8h)', async () => {
    await fullFamily();
    await setDoc(doc(db('dad'), 'groups', GID, 'doses', 'd1'), dose('dad', 'd1'));
    await assertSucceeds(deleteDoc(doc(db('grandma'), 'groups', GID, 'members', 'grandma')));
    // Manager leaving without decrementing the counter is refused.
    await assertFails(deleteDoc(doc(db('dad'), 'groups', GID, 'members', 'dad')));
    const d = db('dad');
    const b = writeBatch(d);
    b.delete(doc(d, 'groups', GID, 'members', 'dad'));
    b.update(doc(d, 'groups', GID), { manager_count: increment(-1) });
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(db('mom'), 'groups', GID, 'doses', 'd1')));
    // The freed slot can be used by a new manager.
    await assertSucceeds(joinBatch('aunt', 'Aunt', MCODE, 'manager').commit());
  });

  it('nobody can fake the manager counter', async () => {
    await createGroup();
    await assertFails(updateDoc(doc(db('mom'), 'groups', GID), { manager_count: 0 }));
    await assertFails(updateDoc(doc(db('stranger'), 'groups', GID), { manager_count: increment(1) }));
  });
});

describe('invite codes stay away from helpers (review fix)', () => {
  it('helpers cannot read current invite codes or join receipts; managers can', async () => {
    await fullFamily();
    await assertFails(getDoc(doc(db('grandma'), 'groups', GID, 'private', 'invites')));
    await assertFails(getDoc(doc(db('grandma'), 'groups', GID, 'joins', 'dad')));
    await assertFails(getDocs(collection(db('grandma'), 'groups', GID, 'joins')));
    await assertSucceeds(getDoc(doc(db('dad'), 'groups', GID, 'private', 'invites')));
    const g = await getDoc(doc(db('grandma'), 'groups', GID));
    if (JSON.stringify(g.data()).includes(MCODE)) throw new Error('group doc leaks the manager code');
    const members = await getDocs(collection(db('grandma'), 'groups', GID, 'members'));
    if (JSON.stringify(members.docs.map((m) => m.data())).includes(MCODE)) throw new Error('members leak the manager code');
  });

  it('codes cannot be put back on readable documents', async () => {
    await fullFamily();
    await assertFails(updateDoc(doc(db('mom'), 'groups', GID), { manager_invite_code: MCODE }));
    const d = db('aunt');
    const b = writeBatch(d);
    b.set(doc(d, 'groups', 'g2'), { name: 'x', helper_invites_enabled: false, manager_count: 1, created_by: 'aunt', created_at: serverTimestamp(), manager_invite_code: 'abc' });
    b.set(doc(d, 'groups', 'g2', 'members', 'aunt'), { caregiver_id: 'aunt', display_name: 'Aunt', role: 'manager', joined_at: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('helpers cannot write invite codes', async () => {
    await fullFamily();
    await assertFails(setDoc(doc(db('grandma'), 'groups', GID, 'private', 'invites'), { manager_invite_code: 'newcode12345' }));
  });

  it('joining without a matching join receipt is refused', async () => {
    await createGroup();
    const d = db('dad');
    const b = writeBatch(d);
    b.set(doc(d, 'groups', GID, 'members', 'dad'), { caregiver_id: 'dad', display_name: 'Dad', role: 'manager', joined_at: serverTimestamp() });
    b.update(doc(d, 'groups', GID), { manager_count: increment(1) });
    await assertFails(b.commit());
  });
});

describe('switching groups (review fix)', () => {
  it('joining another group can release the old membership and manager slot in one batch', async () => {
    await createGroup('mom');
    await joinBatch('dad', 'Dad', MCODE, 'manager').commit();
    // A second group made by someone else, with its own invite.
    const z = db('zoe');
    const zb = writeBatch(z);
    zb.set(doc(z, 'groups', 'g2'), { name: 'Leo', helper_invites_enabled: false, manager_count: 1, created_by: 'zoe', created_at: serverTimestamp() });
    zb.set(doc(z, 'groups', 'g2', 'members', 'zoe'), { caregiver_id: 'zoe', display_name: 'Zoe', role: 'manager', joined_at: serverTimestamp() });
    zb.set(doc(z, 'invites', 'zoecode12345'), { group_id: 'g2', group_name: 'Leo', role: 'manager', created_by: 'zoe', created_at: serverTimestamp() });
    await zb.commit();

    const d = db('dad');
    const b = writeBatch(d);
    b.set(doc(d, 'caregivers', 'dad'), caregiver('Dad', 'g2'));
    b.set(doc(d, 'groups', 'g2', 'joins', 'dad'), { invite_code: 'zoecode12345' });
    b.set(doc(d, 'groups', 'g2', 'members', 'dad'), { caregiver_id: 'dad', display_name: 'Dad', role: 'manager', joined_at: serverTimestamp() });
    b.update(doc(d, 'groups', 'g2'), { manager_count: increment(1) });
    b.delete(doc(d, 'groups', GID, 'members', 'dad'));
    b.delete(doc(d, 'groups', GID, 'joins', 'dad'));
    b.update(doc(d, 'groups', GID), { manager_count: increment(-1) });
    await assertSucceeds(b.commit());
    // Dad's old slot in Mia's group is free again.
    await assertSucceeds(joinBatch('aunt', 'Aunt', MCODE, 'manager').commit());
  });
});
