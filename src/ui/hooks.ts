import { useEffect, useState } from 'react';
import { clock } from '../data/clock';

/** Re-render periodically so "N min ago" stays fresh. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const t = setInterval(() => setNow(clock.now()), intervalMs);
    const vis = () => setNow(clock.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [intervalMs]);
  return now;
}

export type ConnState = 'online' | 'offline' | 'reconnecting';

export function useConnection(fromCache: boolean): ConnState {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!online) return 'offline';
  return fromCache ? 'reconnecting' : 'online';
}
