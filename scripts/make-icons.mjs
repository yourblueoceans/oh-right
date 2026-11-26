// Renders public/icon.svg into the PNG sizes the PWA manifest and iOS need.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const out = (n) => new URL(`../public/${n}`, import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(size, name, pad = 0) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  await page.setContent(`<html><body style="margin:0;background:${pad ? '#2f6f5e' : 'transparent'}">
    <div style="padding:${pad}px;width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: out(name), omitBackground: !pad });
}
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-512-maskable.png', 56);
await render(180, 'apple-touch-icon.png');
await browser.close();
