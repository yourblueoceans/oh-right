/**
 * Two phones, one care group. Each browser context is a separate phone with its own
 * anonymous sign-in. Runs against the local emulators.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const SYNC_MS = 3_000;

async function phone(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  // page is reassigned when a test closes and reopens the app
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { ctx, page };
}

async function createGroupWithAmox(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('checkbox').check();
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('create-group').click();
  await page.getByTestId('child-name').fill('Mia');
  await page.getByTestId('child-save').click();
  await page.getByTestId('med-name').fill('Amoxicillin');
  await page.getByTestId('med-amount').fill('250');
  await page.getByTestId('med-unit').selectOption('mg');
  await page.getByTestId('med-interval').fill('8');
  await page.getByTestId('med-max').fill('3');
  await page.getByTestId('med-save').click();
  await expect(page.getByTestId('med-card-Amoxicillin')).toBeVisible();
}

async function addTylenolNoPlan(page: Page) {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('add-med').click();
  await page.getByTestId('med-name').fill("Children's Tylenol");
  await page.getByTestId('med-amount').fill('5');
  await page.getByTestId('med-unit').selectOption('mL');
  await page.getByTestId('med-save').click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId("med-card-Children's Tylenol")).toBeVisible();
}

async function inviteLink(page: Page, testId = 'manager-invite'): Promise<string> {
  await page.getByTestId('open-settings').click();
  const url = await page.getByTestId(testId).inputValue();
  await page.getByRole('button', { name: 'Back' }).click();
  return url;
}

async function join(page: Page, url: string, name: string) {
  await page.goto(new URL(url).pathname);
  await page.getByRole('checkbox').check();
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('join').click();
}

/** Log a dose from the home card; returns the tap time (ms). */
async function logFromCard(page: Page, med: string, opts: { dose?: string } = {}) {
  await page.getByTestId(`med-card-${med}`).getByTestId('log-dose').click();
  if (opts.dose) {
    await page.getByTestId('change-dose').click();
    await page.getByTestId('dose-input').fill(opts.dose);
  }
  const t = Date.now();
  await page.getByTestId('mark-given').click();
  return t;
}

const items = (page: Page) => page.getByTestId('timeline-item');

test('two caregivers: invite, 3-second sync both ways, notices, undo, stickers, offline, helper', async ({ browser }) => {
  const mom = await phone(browser);
  const dad = await phone(browser);

  // AC11: Mom creates the group; Dad joins with the link and sees the same medicine.
  await createGroupWithAmox(mom.page, 'Mom');
  const link = await inviteLink(mom.page);
  const joinStart = Date.now();
  await join(dad.page, link, 'Dad');
  await expect(dad.page.getByTestId('med-card-Amoxicillin')).toBeVisible();
  expect(Date.now() - joinStart).toBeLessThan(60_000);

  // AC4 + AC1 both directions: own screen immediately, other screen within 3 s.
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (const [from, to, who] of [
      [dad, mom, 'Dad'],
      [mom, dad, 'Mom'],
    ] as const) {
      const before = await items(to.page).count();
      const t = await logFromCard(from.page, 'Amoxicillin');
      await expect(items(from.page)).toHaveCount(before + 1, { timeout: 300 + 200 /* test overhead */ });
      await expect(items(to.page)).toHaveCount(before + 1, { timeout: SYNC_MS });
      samples.push(Date.now() - t);
      await expect(items(to.page).first()).toContainText(`Amoxicillin 250 mg · ${who} · Button`);
    }
  }
  console.log('sync ms:', samples.join(', '));

  // AC5 / AC7: soft notices from the parent's plan; one tap still records; notices saved.
  await mom.page.getByTestId('med-card-Amoxicillin').getByTestId('log-dose').click();
  const notices = mom.page.getByTestId('notices');
  await expect(notices.locator('[data-kind="too_soon"]')).toContainText('Your plan: every 8 hours.');
  await expect(notices.locator('[data-kind="over_daily"]')).toContainText('This would be dose 7 today. Your plan: up to 3 a day.');
  await expect(notices.locator('[data-kind="also_logged"]')).toContainText('Dad also logged this');
  await mom.page.getByTestId('change-dose').click();
  await mom.page.getByTestId('dose-input').fill('500');
  await expect(notices.locator('[data-kind="dose_differs"]')).toContainText('You entered 500 mg. Your plan: 250 mg.');
  if (process.env.SCREENSHOTS) await mom.page.screenshot({ path: 'test-results/confirm.png' });
  await mom.page.getByTestId('mark-given').click();
  await expect(items(dad.page).first()).toContainText('Amoxicillin 500 mg · Mom', { timeout: SYNC_MS });
  if (process.env.SCREENSHOTS) await dad.page.screenshot({ path: 'test-results/home.png' });

  // AC8a + AC8f: undo from the toast; the other phone shows strike-through "Undone by Mom".
  await mom.page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
  await expect(items(dad.page).first()).toHaveAttribute('data-status', 'undone', { timeout: SYNC_MS });
  await expect(items(dad.page).first().getByTestId('undone-by')).toHaveText('Undone by Mom');

  // Later undo from the timeline (Dad undoes Mom's earlier record).
  const target = items(dad.page).nth(1);
  await target.click();
  await dad.page.getByTestId('undo-item').click();
  await expect(items(mom.page).nth(1).getByTestId('undone-by')).toHaveText('Undone by Dad', { timeout: SYNC_MS });

  // AC6: a medicine with an empty plan never shows interval/daily notices.
  await addTylenolNoPlan(mom.page);
  await expect(dad.page.getByTestId("med-card-Children's Tylenol")).toBeVisible({ timeout: SYNC_MS });
  await expect(dad.page.getByTestId("med-card-Children's Tylenol")).toContainText('No schedule set');
  for (let i = 0; i < 4; i++) {
    await dad.page.getByTestId("med-card-Children's Tylenol").getByTestId('log-dose').click();
    await expect(dad.page.getByTestId('notices')).toHaveCount(0);
    await dad.page.getByTestId('mark-given').click();
  }

  // AC8 (S6): near-simultaneous logs by both → both saved, both cards show also_logged.
  const momCount = await items(mom.page).count();
  await Promise.all([logFromCard(mom.page, "Children's Tylenol"), logFromCard(dad.page, "Children's Tylenol")]);
  await expect(items(mom.page)).toHaveCount(momCount + 2, { timeout: SYNC_MS });
  await expect(items(dad.page)).toHaveCount(momCount + 2, { timeout: SYNC_MS });
  await expect(mom.page.getByTestId("med-card-Children's Tylenol").getByTestId('card-also-logged')).toContainText('Dad also logged this');
  await expect(dad.page.getByTestId("med-card-Children's Tylenol").getByTestId('card-also-logged')).toContainText('Mom also logged this');

  // AC2 / AC3: sticker URL → Confirm (pre-filled) → Mark as given; source saved.
  await mom.page.getByTestId('open-settings').click();
  await mom.page.getByTestId('sticker-med').selectOption({ label: 'Amoxicillin' });
  await mom.page.getByTestId('add-sticker').click();
  const nfcUrl = await mom.page.getByTestId('sticker-nfc-url').inputValue();
  const qrUrl = await mom.page.getByTestId('sticker-qr-url').inputValue();
  expect(nfcUrl).toMatch(/\/t\/[a-z0-9]{10}\?via=nfc$/);
  await mom.page.getByRole('button', { name: 'Close' }).click();
  await mom.page.getByRole('button', { name: 'Back' }).click();

  const u = new URL(nfcUrl);
  await dad.page.goto(u.pathname + u.search);
  await expect(dad.page.getByTestId('confirm-title')).toHaveText('Amoxicillin · 250 mg');
  await dad.page.getByTestId('mark-given').click();
  await expect(items(mom.page).first()).toContainText('Amoxicillin 250 mg · Dad · NFC', { timeout: SYNC_MS });
  await expect(items(mom.page).first()).toHaveAttribute('data-source', 'nfc');

  const q = new URL(qrUrl);
  await mom.page.goto(q.pathname + q.search);
  await mom.page.getByTestId('mark-given').click();
  await expect(items(dad.page).first()).toHaveAttribute('data-source', 'qr', { timeout: SYNC_MS });

  // AC12: a phone outside the group sees nothing about the medicine.
  const stranger = await phone(browser);
  await stranger.page.goto(u.pathname + u.search);
  await expect(stranger.page.getByTestId('members-only')).toBeVisible();
  await expect(stranger.page.getByText('Amoxicillin')).toHaveCount(0);

  // AC8d: a third manager can't join with the old link.
  await stranger.page.goto(new URL(link).pathname);
  await stranger.page.getByRole('checkbox').check();
  await stranger.page.getByTestId('name-input').fill('Aunt');
  await stranger.page.getByTestId('join').click();
  await expect(stranger.page.getByTestId('join-error')).toContainText('already has 2 managers');

  // AC9: Dad offline → "Waiting to send" → back online → Mom gets it with no extra taps.
  await dad.ctx.setOffline(true);
  await expect(dad.page.getByTestId('conn')).toHaveText('Offline');
  const before = await items(mom.page).count();
  await logFromCard(dad.page, 'Amoxicillin');
  await expect(items(dad.page).first().getByTestId('pending-tag')).toHaveText('Waiting to send');
  await mom.page.waitForTimeout(1500);
  await expect(items(mom.page)).toHaveCount(before);
  // Close the app while still offline, then reopen it: the queued record is still on the phone
  // and is sent without any extra taps. (Offline page loads come from the service worker in
  // production builds; the dev server has none, so we reopen after reconnecting.)
  await dad.page.close();
  await dad.ctx.setOffline(false);
  await mom.page.waitForTimeout(1000);
  await expect(items(mom.page)).toHaveCount(before);
  dad.page = await dad.ctx.newPage();
  await dad.page.goto('/home');
  await expect(items(mom.page)).toHaveCount(before + 1, { timeout: 15_000 });
  await expect(items(mom.page).first()).toContainText('Amoxicillin 250 mg · Dad');
  await expect(items(dad.page).first().getByTestId('pending-tag')).toHaveCount(0, { timeout: 15_000 });

  // AC8g / AC8e: helper invites behind the premium switch; helper logs but can't undo.
  await mom.page.goto('/settings');
  await expect(mom.page.getByTestId('helper-invite')).toHaveCount(0);
  await mom.page.getByTestId('helper-switch').click();
  await expect(mom.page.getByTestId('helper-switch')).toBeChecked();
  const helperLink = await mom.page.getByTestId('helper-invite').inputValue();
  await mom.page.getByRole('button', { name: 'Back' }).click();

  const grandma = await phone(browser);
  await join(grandma.page, helperLink, 'Grandma');
  await expect(grandma.page.getByTestId('med-card-Amoxicillin')).toBeVisible();
  await logFromCard(grandma.page, 'Amoxicillin');
  await expect(grandma.page.getByTestId('toast').getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await expect(items(mom.page).first()).toContainText('Grandma', { timeout: SYNC_MS });
  await items(grandma.page).first().click();
  await expect(grandma.page.getByTestId('undo-item')).toHaveCount(0);
  await grandma.page.getByTestId('open-settings').click();
  await expect(grandma.page.getByTestId('add-med')).toHaveCount(0);
  await expect(grandma.page.getByTestId('helper-switch')).toHaveCount(0);

  // S10: the hidden Debug panel shows latency samples.
  await mom.page.getByTestId('open-settings').click();
  await mom.page.getByText('Debug').click();
  await expect(mom.page.getByTestId('p95')).not.toHaveText('–');
  console.log('debug p95 (s):', await mom.page.getByTestId('p95').textContent());
});
