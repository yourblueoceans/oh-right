export type Role = 'manager' | 'helper';
export type DoseUnit = 'mg' | 'mL' | 'tablet' | 'drop';
export const DOSE_UNITS: DoseUnit[] = ['mg', 'mL', 'tablet', 'drop'];
export type DoseSource = 'button' | 'nfc' | 'qr';
export type NoticeKind = 'too_soon' | 'over_daily' | 'dose_differs' | 'also_logged';

export interface Caregiver {
  id: string;
  display_name: string;
  disclaimer_version: string;
  group_id: string | null;
  /** False while a local change (e.g. joining) hasn't reached the server yet. */
  confirmed: boolean;
}

export interface CareGroup {
  id: string;
  name: string;
  manager_invite_code: string | null;
  helper_invite_code: string | null;
  helper_invites_enabled: boolean;
  manager_count: number;
  created_by: string;
}

export interface Member {
  caregiver_id: string;
  display_name: string;
  role: Role;
  joinedAtMs: number | null;
}

export interface Patient {
  id: string;
  display_name: string;
}

export interface Medication {
  id: string;
  patient_id: string;
  name: string;
  dose_amount: number;
  dose_unit: DoseUnit;
  interval_hours: number | null;
  max_doses_per_day: number | null;
  plan_note: string;
  archived: boolean;
}

export interface Sticker {
  id: string;
  group_id: string;
  medication_id: string;
  label: string;
}

/** A dose event as the UI sees it. Times are epoch ms in the server-aligned clock. */
export interface DoseEvent {
  id: string;
  patient_id: string;
  medication_id: string;
  medication_name: string;
  caregiver_id: string;
  caregiver_name: string;
  dose_amount: number;
  dose_unit: DoseUnit;
  givenAtMs: number;
  receivedAtMs: number | null;
  source: DoseSource;
  sticker_id: string | null;
  status: 'given' | 'undone';
  undoneAtMs: number | null;
  undone_by: string | null;
  undone_by_name: string | null;
  notices_shown: NoticeKind[];
  /** Local-only: write not yet confirmed by the server. */
  pending: boolean;
}
