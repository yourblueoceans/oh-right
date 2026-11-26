/**
 * In-app browsers (KakaoTalk, LINE, Instagram, Facebook, NAVER…) open links in a limited web view.
 * On iPhone these often can't keep the app's local storage reliably, and they keep a separate
 * sign-in from Safari, so we send people to their real browser.
 */
export type InAppBrowser = 'kakaotalk' | 'line' | 'instagram' | 'facebook' | 'naver' | 'other';

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/\bLine\//i.test(ua)) return 'line';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
  if (/NAVER\(inapp/i.test(ua)) return 'naver';
  return null;
}

/** A URL that asks the in-app browser to reopen the page in the phone's default browser, if it has one. */
export function externalOpenUrl(kind: InAppBrowser, href: string): string | null {
  if (kind === 'kakaotalk') return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  if (kind === 'line') {
    const u = new URL(href);
    u.searchParams.set('openExternalBrowser', '1');
    return u.toString();
  }
  return null;
}

export function isIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}
