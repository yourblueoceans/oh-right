import { test, expect } from '@playwright/test';
// Screenshots for design review: OUT=/some/dir npm run test:e2e -- e2e/zz-capture.spec.ts
const OUT = process.env.OUT ?? '';
test.skip(!OUT, 'set OUT to save screenshots');
for (const scheme of ['light', 'dark'] as const) {
test(`capture ${scheme}`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const shot = (n: string) => page.screenshot({ path: `${OUT}/${scheme}-${n}.png` });
  await page.goto('/');
  await expect(page.getByTestId('start')).toBeVisible();
  await shot('1-welcome');
  await page.getByTestId('start').click();
  await shot('1b-consent');
  await page.getByRole('checkbox').check();
  await page.getByTestId('name-input').fill('Mom');
  await page.getByTestId('create-group').click();
  await page.getByTestId('child-name').fill('Mia');
  await shot('2-setup');
  await page.getByTestId('child-save').click();
  await page.getByTestId('med-name').fill('Amoxicillin');
  await page.getByTestId('med-amount').fill('250');
  await page.getByTestId('med-unit').selectOption('mg');
  await page.getByTestId('med-interval').fill('8');
  await page.getByTestId('med-max').fill('3');
  await shot('3-medform');
  await page.getByTestId('med-save').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('add-med').click();
  await page.getByTestId('med-name').fill("Children's Tylenol");
  await page.getByTestId('med-amount').fill('5');
  await page.getByTestId('med-unit').selectOption('mL');
  await page.getByTestId('med-interval').fill('6');
  await page.getByTestId('med-save').click();
  await shot('6-settings');
  await page.getByRole('button', { name: 'Back' }).click();
  await shot('4a-home-empty');
  await page.getByTestId('med-card-Amoxicillin').getByTestId('log-dose').click();
  await page.getByTestId('mark-given').click();
  await page.waitForTimeout(500);
  await shot('4b-home-toast');
  await page.waitForTimeout(11000);
  await page.getByTestId('med-card-Amoxicillin').getByTestId('log-dose').click();
  await page.waitForTimeout(400);
  await shot('5-confirm-notice');
  await ctx.close();
});
}
