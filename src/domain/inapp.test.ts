import { describe, expect, it } from 'vitest';
import { detectInAppBrowser, externalOpenUrl } from './inapp';

const kakaoIOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0';
const safari =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

describe('in-app browser detection', () => {
  it('detects KakaoTalk and builds its open-external link', () => {
    expect(detectInAppBrowser(kakaoIOS)).toBe('kakaotalk');
    expect(externalOpenUrl('kakaotalk', 'https://heyohright.web.app/join/abc')).toBe(
      'kakaotalk://web/openExternal?url=https%3A%2F%2Fheyohright.web.app%2Fjoin%2Fabc',
    );
  });
  it('leaves Safari alone', () => {
    expect(detectInAppBrowser(safari)).toBeNull();
  });
  it('LINE gets openExternalBrowser=1', () => {
    expect(externalOpenUrl('line', 'https://x.app/join/abc')).toBe('https://x.app/join/abc?openExternalBrowser=1');
  });
});
