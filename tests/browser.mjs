// Use an externally installed Playwright; the game has no runtime dependencies.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.GAME_URL || 'http://localhost:4173';
await page.clock.install();
await page.goto(base);
assert.equal(await page.locator('body').evaluate(e => e.scrollWidth <= innerWidth), true);
await page.screenshot({ path: '/tmp/roll-mobile.png', fullPage: true });
await page.click('#start');
assert.equal(await page.locator('#drawing').isVisible(), true, 'no countdown or second confirmation');
await page.screenshot({ path: '/tmp/roll-drawing.png', fullPage: true });
async function draw(ry = 1, radius = .25) {
  await page.locator('#drawing').evaluate((canvas, args) => {
    const [ry, fraction] = args, r = canvas.getBoundingClientRect();
    const radius = Math.min(r.width, r.height) * fraction, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const fire = (type, i) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 42, isPrimary: true, pointerType: 'touch', bubbles: true,
      clientX: cx + radius * Math.cos(i / 100 * Math.PI * 2),
      clientY: cy + radius * ry * Math.sin(i / 100 * Math.PI * 2),
    }));
    canvas.setPointerCapture = () => {};
    fire('pointerdown', 0);
    for (let i = 1; i <= 100; i++) fire('pointermove', i);
    fire('pointerup', 100);
  }, [ry, radius]);
}
await draw(1, .05);
assert.equal(await page.locator('#draw-panel').isVisible(), true, 'tiny circles can be retried');
assert.match(await page.locator('#feedback').innerText(), /大一点/);
await draw(.78);
assert.equal(await page.locator('#roll-stage').isVisible(), true, 'one drawing automatically generates model');
await page.clock.runFor(2200);
assert.ok(Number(await page.locator('#distance').innerText()) > 0, 'automatic travel with no further input');
await page.screenshot({ path: '/tmp/roll-motion.png', fullPage: true });
await page.clock.fastForward(16000);
assert.equal(await page.locator('#result').isVisible(), true, 'automatic result with no further input');
const firstDistance = Number(await page.locator('#result-distance').innerText());
assert.ok(firstDistance > 40 && firstDistance < 2000);
assert.match(await page.locator('#ranking-note').innerText(), /全国排名尚未开放/);
await page.screenshot({ path: '/tmp/roll-result.png', fullPage: true });
const modelDownload = page.waitForEvent('download'); await page.click('#download-model');
assert.equal((await modelDownload).suggestedFilename(), '我的月亮.obj');
await page.click('#poster-open');
await page.locator('#poster-image').waitFor({ state: 'visible' });
assert.deepEqual(await page.locator('#poster-image').evaluate(e => [e.naturalWidth, e.naturalHeight]), [1080, 1440]);
await page.screenshot({ path: '/tmp/roll-poster.png', fullPage: true });
const pngDownload = page.waitForEvent('download'); await page.click('#download-image');
assert.equal((await pngDownload).suggestedFilename(), '送你一颗中秋的月亮.png');
await page.click('#poster-back'); await page.click('#again'); await draw();
await page.clock.runFor(1300); await page.click('#skip');
assert.equal(Number(await page.locator('#result-distance').innerText()), 2000, 'skip preserves exact theoretical range');
await page.reload(); await page.click('#last-moon');
assert.equal(Number(await page.locator('#result-distance').innerText()), 2000, 'saved 3D moon survives reload');
await page.click('#again');
await page.evaluate(() => {
  window.originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); };
});
await draw(); await page.clock.runFor(1300); await page.click('#skip'); await page.click('#poster-open');
await page.locator('#retry-poster').waitFor({ state: 'visible' });
await page.evaluate(() => HTMLCanvasElement.prototype.toBlob = window.originalToBlob);
await page.click('#retry-poster'); await page.locator('#poster-image').waitFor({ state: 'visible' });
await page.evaluate(() => {
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
});
await page.click('#share-image'); assert.equal(await page.locator('#poster-image').isVisible(), true);
await page.goto(base + '/?v=moon-roll-v2&d=1234.5');
assert.match(await page.locator('#challenge').innerText(), /1234.5/);
await page.setViewportSize({ width: 1440, height: 1050 });
await page.screenshot({ path: '/tmp/roll-desktop.png', fullPage: true });
assert.deepEqual(errors, []);
console.log('PASS: one drawing → 3D automatic roll → distance result; invalid retry; OBJ/PNG download; saved model restore; skip consistency; PNG failure retry; share cancellation; challenge; no browser errors.');
await browser.close();
