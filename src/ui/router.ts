import { useEffect, useState } from 'react';

export type Route =
  | { name: 'root' }
  | { name: 'join'; code: string }
  | { name: 'setup' }
  | { name: 'home' }
  | { name: 'sticker'; id: string }
  | { name: 'settings' };

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'join' && parts[1]) return { name: 'join', code: decodeURIComponent(parts[1]) };
  if (parts[0] === 't' && parts[1]) return { name: 'sticker', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'setup') return { name: 'setup' };
  if (parts[0] === 'home') return { name: 'home' };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'root' };
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): { route: Route; search: string } {
  const [loc, setLoc] = useState(() => ({ path: location.pathname, search: location.search }));
  useEffect(() => {
    const on = () => setLoc({ path: location.pathname, search: location.search });
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return { route: parseRoute(loc.path), search: loc.search };
}
