import type { ReactNode } from 'react';
import { DISCLAIMER_CHECKBOX, DISCLAIMER_TEXT } from '../../config';
import type { ConnState } from '../hooks';
import { navigate } from '../router';

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

export function ConnPill({ conn }: { conn: ConnState }) {
  return (
    <span className={`conn conn-${conn}`} data-testid="conn">
      <span className="dot" aria-hidden />
      {connLabel[conn]}
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
