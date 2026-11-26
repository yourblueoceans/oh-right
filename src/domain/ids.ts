import { customAlphabet } from 'nanoid';

// No look-alike characters (0/o, 1/l/i) so codes are easy to read aloud or type.
const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';

/** Sticker slug that goes into the URL: 10 chars ≈ 49 bits, not guessable. */
export const newStickerId = customAlphabet(alphabet, 10);
/** Invite code: 12 chars ≈ 59 bits. */
export const newInviteCode = customAlphabet(alphabet, 12);

/** Idempotency key for a dose event, generated on the device. */
export function newDoseId(): string {
  return crypto.randomUUID();
}

export function parseSource(search: string): 'nfc' | 'qr' {
  const via = new URLSearchParams(search).get('via');
  return via === 'nfc' ? 'nfc' : 'qr';
}
