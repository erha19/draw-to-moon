import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
const base = process.env.GAME_URL || 'http://localhost:4173';

async function open(width = 390, height = 844, reduced = false) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-09-17T00:00:00Z') });
  await page.addInitScript(() => {
    window.sourceCount = 0; window.contextCount = 0;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args) { super(...args); window.contextCount++; }
      createOscillator() { window.sourceCount++; return super.createOscillator(); }
      createBufferSource() { window.sourceCount++; return super.createBufferSource(); }
    };
  });
  await page.goto(base);
  await page.clock.pauseAt(new Date('2026-09-17T00:00:01Z'));
  await page.locator('#pushing-rabbit[data-ready="true"]').waitFor({ state: 'attached' });
  return { page, errors };
}
async function draw(page) {
  await page.locator('#drawing').evaluate(canvas => {
    const r = canvas.getBoundingClientRect(), radius = Math.min(r.width, r.height) * .25;
    const fire = (type, i) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, isPrimary: true,
      pointerType: 'touch', bubbles: true, clientX: r.left + r.width / 2 + radius * Math.cos(i / 100 * Math.PI * 2),
      clientY: r.top + r.height / 2 + radius * Math.sin(i / 100 * Math.PI * 2) }));
    canvas.setPointerCapture = () => {};
    fire('pointerdown', 0); for (let i = 1; i <= 100; i++) fire('pointermove', i); fire('pointerup', 100);
  });
}
const phase = page => page.locator('#roll-stage').getAttribute('data-phase');
const sources = page => page.evaluate(() => window.sourceCount);
async function pixels(page) {
  return page.locator('#moon-formation').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0, hash = 0;
    for (let i = 3; i < data.length; i += 4) { if (data[i] > 16) painted++; hash = (hash * 31 + data[i]) | 0; }
    return { painted, hash };
  });
}
async function within(page, selector) {
  const r = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  assert.ok(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= viewport.width + 1 && r.y + r.height <= viewport.height + 1, `${selector} stays in ${viewport.width}×${viewport.height}`);
}

try {
  {
    const { page, errors } = await open();
    assert.equal(await page.evaluate(() => window.contextCount), 0, 'music never autoplays on load');
    await page.click('#start'); await page.clock.runFor(32);
    assert.ok(await sources(page) >= 5, 'user gesture starts a melody with backing notes');
    await page.click('#music');
    const stopped = await sources(page); await page.clock.runFor(700);
    assert.equal(await sources(page), stopped, 'music switch stops new music notes');
    await draw(page);
    assert.ok(await sources(page) > stopped, 'drawing and forming sounds still work with music off');
    assert.equal(await phase(page), 'forming');
    assert.equal(await page.locator('#moon-formation').isVisible(), true);
    const initial = await pixels(page); assert.ok(initial.painted > 200, 'the drawn outline stays visible');
    await page.clock.runFor(620);
    const middle = await pixels(page); assert.ok(middle.painted > initial.painted, 'the outline fills into a moon');
    assert.equal(Number(await page.locator('#distance').innerText()), 0);
    await page.screenshot({ path: '/tmp/moon-formation-phone.png' });
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const frozen = await pixels(page), mutedCount = await sources(page);
    await page.clock.runFor(3000);
    assert.deepEqual(await pixels(page), frozen, 'pagehide freezes the forming moon');
    assert.equal(await sources(page), mutedCount, 'pagehide stops all music and effects');
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await page.clock.runFor(800);
    assert.equal(await phase(page), 'ready');
    assert.equal(await page.locator('#moon-formation').isVisible(), false);
    await page.clock.runFor(2800);
    assert.equal(await phase(page), 'rolling');
    const beforeJump = await sources(page);
    await page.clock.fastForward(2400);
    const meters = Number(await page.locator('#distance').innerText());
    const combo = Math.floor(meters / 100);
    assert.equal(await page.locator('#combo-count').innerText(), `×${combo}`);
    assert.equal(await page.locator('#combo-burst-count').innerText(), `COMBO ×${combo}`);
    assert.ok(await sources(page) <= beforeJump + 3, 'a delayed frame rewards the latest milestone without an audio storm');
    await within(page, '#combo-hud'); await within(page, '#combo-burst');
    await page.clock.runFor(120);
    await page.screenshot({ path: '/tmp/moon-combo-phone.png' });
    const once = await sources(page); await page.clock.runFor(16);
    assert.equal(await sources(page), once, 'the same Combo is not retriggered on the next frame');
    await page.click('#sound'); const silent = await sources(page);
    await page.clock.runFor(1400); assert.equal(await sources(page), silent, 'master mute also suppresses Combo sounds');
    await page.click('#skip');
    assert.equal(Number(await page.locator('#result-distance').innerText()), 2000);
    assert.match(await page.locator('#result-combo').innerText(), /COMBO ×20/);
    assert.equal(await sources(page), silent, 'a muted result remains silent');
    await page.reload();
    assert.equal(await page.locator('#music').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    assert.doesNotMatch(await page.locator('body').innerText(), /画的月光|把月光/);
    const copy = await page.evaluate(async () => (await import('./poster.js')).POSTER_COPY);
    assert.match(copy.subtitle, /画的月亮/);
    assert.deepEqual(errors, []); await page.close();
    console.log('PASS: formation continuity, music/SFX controls, pagehide resume, Combo thresholds, no cue storm, copy and persistence.');
  }

  for (const [width, height] of [[320, 568], [844, 390], [1440, 900]]) {
    const { page, errors } = await open(width, height);
    await page.click('#start'); await draw(page); await page.clock.runFor(650);
    await within(page, '#moon-formation'); await within(page, '#music'); await within(page, '#sound');
    await page.screenshot({ path: `/tmp/moon-formation-${width}.png` });
    await page.clock.runFor(4400);
    assert.equal(await phase(page), 'rolling');
    await within(page, '#combo-hud');
    // Move just past a fresh absolute distance milestone to capture a live burst.
    const before = await page.locator('#combo-count').innerText();
    for (let i = 0; i < 60 && await page.locator('#combo-count').innerText() === before; i++) await page.clock.runFor(32);
    await within(page, '#combo-burst');
    await page.clock.runFor(120);
    await page.screenshot({ path: `/tmp/moon-combo-${width}.png` });
    await page.click('#skip');
    assert.equal(Number(await page.locator('#result-distance').innerText()), 2000);
    assert.deepEqual(errors, []); await page.close();
    console.log(`PASS: ${width}×${height} formation and Combo layout.`);
  }

  {
    const { page, errors } = await open(390, 844, true);
    await page.click('#start'); await draw(page);
    await page.clock.runFor(300); assert.equal(await phase(page), 'gentle');
    await page.clock.runFor(670); assert.equal(await phase(page), 'rolling');
    await page.clock.runFor(500);
    assert.equal(await page.locator('#combo-burst').evaluate(e => e.style.transform), 'translate(-50%, 0px)');
    await page.click('#skip'); await page.click('#again'); await draw(page);
    await page.click('#skip');
    assert.equal(await page.locator('#moon-formation').isVisible(), false, 'skip during forming removes the overlay');
    assert.equal(Number(await page.locator('#result-distance').innerText()), 2000);
    assert.deepEqual(errors, []); await page.close();
    console.log('PASS: shortened reduced-motion formation and static Combo, skip during formation.');
  }
} finally { await browser.close(); }
