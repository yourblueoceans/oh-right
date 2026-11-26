import type { ReactNode } from 'react';
import { DISCLAIMER_CHECKBOX, DISCLAIMER_TEXT } from '../../config';
import type { ConnState } from '../hooks';
import type { Member } from '../../domain/types';
import { navigate } from '../router';
import { inAppBrowser } from '../../data/firebase';
import { externalOpenUrl, isIOS } from '../../domain/inapp';

/** Shown when the page was opened inside a chat app's browser (e.g. KakaoTalk). */
export function InAppBanner() {
  if (!inAppBrowser) return null;
  const target = externalOpenUrl(inAppBrowser, location.href);
  const browser = isIOS(navigator.userAgent) ? 'Safari' : 'Chrome';
  return (
    <div className="banner banner-warn inapp" data-testid="inapp-banner">
      <p>
        <strong>Please open this page in {browser}.</strong> Oh Right! may not work inside a chat app's browser.
        Use the menu (⋯) and choose "Open in {browser}", or copy the link and paste it into {browser}.
      </p>
      {target && (
        <a className="btn btn-secondary btn-sm" href={target}>
          Open in {browser}
        </a>
      )}
    </div>
  );
}

/** Short error code to show with a failure message, so a screenshot tells us what went wrong. */
export function errorCode(e: unknown): string {
  const c = (e as { code?: string })?.code;
  const name = (e as { name?: string })?.name;
  return c ?? name ?? 'unknown';
}

export function DisclaimerText() {
  return (
    <div className="disclaimer" data-testid="disclaimer">
      {DISCLAIMER_TEXT.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function DisclaimerCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{DISCLAIMER_CHECKBOX}</span>
    </label>
  );
}

const connLabel: Record<ConnState, string> = {
  online: 'Online',
  offline: 'Offline',
  reconnecting: 'Reconnecting',
};

/** Only shown when something is wrong: "Online" all the time is noise. */
export function ConnPill({ conn }: { conn: ConnState }) {
  if (conn === 'online') return null;
  return (
    <span className={`conn conn-${conn}`} data-testid="conn" role="status">
      <span className="dot" aria-hidden />
      {connLabel[conn]}
    </span>
  );
}

/** Each caregiver gets a steady color, in the order they joined, so "who" reads at a glance. */
export function personIndex(members: Member[], caregiverId: string): number {
  const order = [...members].sort((a, b) => (a.joinedAtMs ?? 0) - (b.joinedAtMs ?? 0));
  const i = order.findIndex((m) => m.caregiver_id === caregiverId);
  if (i >= 0) return i % 6;
  let h = 0;
  for (const c of caregiverId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 6;
}

export function PersonChip({ name, index }: { name: string; index: number }) {
  return (
    <span className={`chip chip-${index}`} aria-hidden>
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="brandmark">
      <svg viewBox="0 0 26 26" aria-hidden>
        <rect x="1" y="1" width="24" height="24" rx="7" fill="currentColor" />
        <path d="M7.5 13.5l3.5 3.5 7.5-8" stroke="var(--bg)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Oh Right!
    </span>
  );
}

export function Header({ title, conn, back, right }: { title: string; conn?: ConnState; back?: string; right?: ReactNode }) {
  return (
    <header className="header">
      {back ? (
        <button className="icon-btn" aria-label="Back" onClick={() => navigate(back)}>
          ‹
        </button>
      ) : (
        <span className="brand">Oh Right!</span>
      )}
      <span className="header-title">{title}</span>
      <span className="header-right">
        {conn && <ConnPill conn={conn} />}
        {right}
      </span>
    </header>
  );
}

export function OfflineBanner({ conn }: { conn: ConnState }) {
  if (conn !== 'offline') return null;
  return (
    <div className="banner banner-offline" data-testid="offline-banner">
      You're offline. Records from others may not show yet. Yours will send automatically when you're back online.
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
