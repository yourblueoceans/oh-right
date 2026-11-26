/**
 * A caregiver opens the invite link inside KakaoTalk's built-in browser (iPhone user agent).
 * The page asks them to switch to Safari, and joining still works there.
 */
import { expect, test } from '@playwright/test';

const KAKAO_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0';

test('joining from KakaoTalk in-app browser shows the Safari hint and still works', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto('/');
  await a.getByTestId('start').click();
  await a.getByRole('checkbox').check();
  await a.getByTestId('name-input').fill('Mom');
  await a.getByTestId('create-group').click();
  await a.getByTestId('child-name').fill('Mia');
  await a.getByTestId('child-save').click();
  await a.getByTestId('med-name').fill('Amoxicillin');
  await a.getByTestId('med-amount').fill('250');
  await a.getByTestId('med-unit').selectOption('mg');
  await a.getByTestId('med-save').click();
  await a.getByTestId('open-settings').click();
  const link = await a.getByTestId('manager-invite').inputValue();
  await a.getByRole('button', { name: 'Back' }).click();
  await expect(a.getByTestId('inapp-banner')).toHaveCount(0);

  const bctx = await browser.newContext({ userAgent: KAKAO_IOS });
  const b = await bctx.newPage();
  await b.goto(new URL(link).pathname, { waitUntil: 'commit' });
  await expect(b.getByTestId('inapp-banner')).toContainText('Please open this page in Safari');
  await expect(b.getByRole('link', { name: 'Open in Safari' })).toHaveAttribute('href', /^kakaotalk:\/\/web\/openExternal\?url=/);
  await b.getByRole('checkbox').check();
  await b.getByTestId('name-input').fill('Dad');
  await b.getByTestId('join').click();
  await expect(b.getByTestId('med-card-Amoxicillin')).toBeVisible();
  await b.getByTestId('log-dose').click();
  await b.getByTestId('mark-given').click();
  await expect(a.getByTestId('timeline-item').first()).toContainText('Amoxicillin 250 mg · Dad', { timeout: 3000 });
});
