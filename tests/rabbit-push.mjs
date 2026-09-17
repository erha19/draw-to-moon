// Use an externally installed Playwright; no browser dependency is shipped.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
const base = process.env.GAME_URL || 'http://localhost:4173';
const failures = [];

async function game({ width = 1440, height = 900, reduced = false, noAudio = false, noAtlas = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-09-17T00:00:00Z') });
  await page.addInitScript(({ noAudio }) => {
    // Observe actual Web Audio scheduling without replacing the synthesis engine.
    window.audioEvents = [];
    window.audioContexts = 0;
    if (noAudio) {
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
      Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
      return;
    }
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    let nextId = 0;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.audioContexts++; }
      observe(source) {
        const id = ++nextId;
        for (const method of ['start', 'stop']) {
          const original = source[method].bind(source);
          source[method] = (...args) => {
            original(...args);
            window.audioEvents.push({ id, action: method, immediate: args.length === 0 });
          };
        }
        source.addEventListener('ended', () => window.audioEvents.push({ id, action: 'ended' }));
        return source;
      }
      createOscillator() { return this.observe(super.createOscillator()); }
      createBufferSource() { return this.observe(super.createBufferSource()); }
    };
  }, { noAudio });
  if (noAtlas) await page.route('**/assets/rabbit-push-atlas.png', route => route.fulfill({ status: 404, body: 'Unavailable' }));
  await page.goto(base);
  await page.clock.pauseAt(new Date('2026-09-17T01:00:00Z'));
  if (!noAtlas) await page.locator('#pushing-rabbit[data-ready="true"]').waitFor({ state: 'attached' });
  return { page, errors };
}

async function draw(page, ry = 1) {
  await page.locator('#drawing').evaluate((canvas, ratio) => {
    const rect = canvas.getBoundingClientRect(), radius = Math.min(rect.width, rect.height) * .25;
    const fire = (type, i) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 42, isPrimary: true, pointerType: 'touch', bubbles: true,
      clientX: rect.left + rect.width / 2 + radius * Math.cos(i / 100 * Math.PI * 2),
      clientY: rect.top + rect.height / 2 + radius * ratio * Math.sin(i / 100 * Math.PI * 2),
    }));
    canvas.setPointerCapture = () => {};
    fire('pointerdown', 0);
    for (let i = 1; i <= 100; i++) fire('pointermove', i);
    fire('pointerup', 100);
  }, ry);
}

const stage = page => page.locator('#roll-stage').getAttribute('data-phase');
const distance = async page => Number(await page.locator('#distance').innerText());
const audioEvents = page => page.evaluate(() => window.audioEvents);
const started = events => events.filter(event => event.action === 'start').map(event => event.id);
function assertCanceled(ids, events, description) {
  assert.ok(ids.every(id => events.some(event => event.id === id &&
    (event.action === 'ended' || event.action === 'stop' && event.immediate))), description);
}
async function snapshot(page) {
  return page.evaluate(() => {
    const rabbit = document.querySelector('#pushing-rabbit');
    return { phase: document.querySelector('#roll-stage').dataset.phase, pose: rabbit.dataset.pose,
      transform: rabbit.style.transform, left: rabbit.style.left,
      distance: document.querySelector('#distance').textContent };
  });
}
async function hidden(page, value) {
  await page.evaluate(value => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}
async function launchBounds(page) {
  const bounds = await page.evaluate(() => {
    const box = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    };
    // Transparent canvas padding preserves the paw/foot anchor; measure pixels
    // so these checks catch clipped artwork rather than harmless empty space.
    const canvas = document.querySelector('#rabbit-sprite'), rect = canvas.getBoundingClientRect();
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x); right = Math.max(right, x + 1);
        top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      }
    }
    const rabbit = { x: rect.x + left / canvas.width * rect.width, y: rect.y + top / canvas.height * rect.height,
      right: rect.x + right / canvas.width * rect.width, bottom: rect.y + bottom / canvas.height * rect.height };
    return { rabbit, moon: box('#rolling-body'), stage: box('#roll-stage'),
      width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.ok(bounds.scrollWidth <= bounds.width, 'no horizontal overflow');
  assert.ok(bounds.rabbit.right > bounds.rabbit.x, 'the generated rabbit is actually painted');
  for (const name of ['rabbit', 'moon']) {
    assert.ok(bounds[name].x >= bounds.stage.x && bounds[name].right <= bounds.stage.right, `${name} stays horizontally in stage: ${JSON.stringify(bounds)}`);
    assert.ok(bounds[name].y >= bounds.stage.y && bounds[name].bottom <= bounds.stage.bottom, `${name} stays vertically in stage: ${JSON.stringify(bounds)}`);
  }
  assert.ok(bounds.stage.bottom <= bounds.height, 'stage fits viewport');
}
async function verify(name, options, run) {
  const { page, errors } = await game(options);
  try {
    await run(page);
    assert.deepEqual(errors, [], `${name}: no runtime errors`);
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL: ${name}\n${error.message}`);
  } finally { await page.close(); }
}

try {
  await verify('all six launch poses precede travel; desktop push screenshot', {}, async page => {
    await page.click('#start'); await draw(page);
    assert.equal(await stage(page), 'ready');
    assert.equal(await distance(page), 0);
    assert.equal(await page.locator('#pushing-rabbit').getAttribute('data-ready'), 'true');
    assert.equal(await page.locator('#rabbit-sprite').isVisible(), true);
    assert.equal(await page.locator('.rabbit-fallback').isVisible(), false);
    let previous = 0;
    for (const [at, name, pose] of [[600, 'brace', 1], [1100, 'strain', 2], [1600, 'push', 3], [2100, 'release', 4], [2500, 'wave', 5], [2770, 'wave', 5]]) {
      await page.clock.runFor(at - previous); previous = at;
      assert.equal(await stage(page), name, `${at}ms: expected ${name}`);
      assert.equal(await page.locator('#pushing-rabbit').getAttribute('data-pose'), String(pose));
      assert.equal(await distance(page), 0, `${name}: launch must not consume rolling distance`);
      if (name === 'push') await page.screenshot({ path: '/tmp/rabbit-push-desktop.png', fullPage: true });
    }
    const events = await audioEvents(page);
    assert.ok(started(events).length >= 12, 'start, forming, brace, push, and release produce real audio sources');
    await page.clock.runFor(230);
    assert.equal(await stage(page), 'rolling');
    assert.ok(await distance(page) > 0);
    assert.equal(await page.locator('#forming').isVisible(), false);
    const firstDistance = await distance(page);
    await page.clock.runFor(450);
    assert.ok(await distance(page) > firstDistance);
  });

  await verify('phone push stays within stage and viewport', { width: 390, height: 844 }, async page => {
    await page.click('#start'); await draw(page, .85); await page.clock.runFor(1650);
    assert.equal(await stage(page), 'push');
    await page.screenshot({ path: '/tmp/rabbit-push-phone.png', fullPage: true });
    await launchBounds(page);
  });

  for (const [width, height] of [[320, 568], [844, 390]]) {
    await verify(`${width}×${height}: all six painted poses fit the stage`, { width, height }, async page => {
      await page.click('#start'); await draw(page);
      let previous = 0;
      for (const [at, name] of [[0, 'ready'], [600, 'brace'], [1100, 'strain'], [1600, 'push'], [2100, 'release'], [2500, 'wave']]) {
        if (at > previous) await page.clock.runFor(at - previous);
        previous = at;
        assert.equal(await stage(page), name); assert.equal(await distance(page), 0);
        if (name === 'push') await page.screenshot({ path: `/tmp/rabbit-push-${width}x${height}.png`, fullPage: true });
        await launchBounds(page);
      }
    });
  }

  await verify('visibility pause preserves launch pose and remaining duration', {}, async page => {
    await page.click('#start'); await draw(page); await page.clock.runFor(1100);
    const before = await snapshot(page), sources = started(await audioEvents(page));
    await hidden(page, true);
    assertCanceled(sources, await audioEvents(page), 'hiding cancels every launch sound');
    const count = started(await audioEvents(page)).length;
    await page.clock.runFor(5000);
    assert.deepEqual(await snapshot(page), before, 'hidden time cannot advance pose or distance');
    assert.equal(started(await audioEvents(page)).length, count, 'no cues while hidden');
    await hidden(page, false); await page.clock.runFor(32);
    assert.equal(await stage(page), 'strain'); assert.equal(await distance(page), 0);
    assert.equal(started(await audioEvents(page)).length, count, 'resume does not repeat the prior cue');
    await page.clock.runFor(500);
    assert.equal(await stage(page), 'push'); assert.equal(await distance(page), 0);
    await page.clock.runFor(1200);
    assert.equal(await stage(page), 'rolling'); assert.ok(await distance(page) > 0);
  });

  await verify('skip cancels launch sounds and preserves the exact final distance', {}, async page => {
    await page.click('#start'); await draw(page); await page.clock.runFor(1650);
    const sources = started(await audioEvents(page));
    await page.click('#skip');
    assert.equal(await page.locator('#result').isVisible(), true);
    assert.equal(Number(await page.locator('#result-distance').innerText()), 2000);
    assertCanceled(sources, await audioEvents(page), 'skip cancels all pre-result sources');
    const count = started(await audioEvents(page)).length;
    assert.equal(count, sources.length + 1, 'only the intended result chime may start after skip');
    await page.clock.runFor(4000);
    assert.equal(started(await audioEvents(page)).length, count, 'no delayed launch cues after skip');
    assert.equal(Number(await page.locator('#result-distance').innerText()), 2000);
  });

  await verify('leave and replay cannot resume a stale launch', {}, async page => {
    await page.click('#start'); await draw(page); await page.clock.runFor(600);
    const sources = started(await audioEvents(page));
    await page.click('#leave');
    assertCanceled(sources, await audioEvents(page), 'leaving cancels launch sources');
    const count = started(await audioEvents(page)).length;
    await page.clock.runFor(3500);
    assert.equal(await page.locator('#home').isVisible(), true);
    assert.equal(started(await audioEvents(page)).length, count);
    await page.click('#start'); await page.clock.runFor(3200);
    assert.equal(await page.locator('#draw-panel').isVisible(), true, 'old callbacks cannot leave drawing');
    await draw(page);
    assert.equal(await stage(page), 'ready'); assert.equal(await distance(page), 0);
    await page.clock.runFor(600);
    assert.equal(await stage(page), 'brace'); assert.equal(await distance(page), 0);
    await page.clock.runFor(2300);
    assert.equal(await stage(page), 'rolling'); assert.ok(await distance(page) > 0);
  });

  await verify('reduced motion gives a short static push before travel', { reduced: true }, async page => {
    await page.click('#start'); await draw(page);
    assert.equal(await stage(page), 'gentle');
    const before = await snapshot(page);
    await page.clock.runFor(500);
    assert.deepEqual(await snapshot(page), before, 'reduced-motion rabbit remains still');
    assert.equal(await distance(page), 0);
    await page.screenshot({ path: '/tmp/rabbit-push-reduced.png', fullPage: true });
    await page.clock.runFor(250);
    assert.equal(await stage(page), 'rolling'); assert.ok(await distance(page) > 0);
    assert.ok(started(await audioEvents(page)).length <= 3, 'no full effort cue sequence in reduced mode');
  });

  await verify('enabling reduced motion during a push does not jump the rolling distance', {}, async page => {
    await page.click('#start'); await draw(page); await page.clock.runFor(1650);
    assert.equal(await stage(page), 'push');
    await page.click('#motion'); await page.clock.runFor(32);
    assert.equal(await stage(page), 'rolling', 'motion toggle promptly finishes the transition');
    const traveled = await distance(page);
    assert.ok(traveled >= 0 && traveled < 10, 'travel starts from zero when motion is reduced');
    assert.equal((await snapshot(page)).transform, 'translateY(0px)');
    await page.clock.runFor(250);
    assert.equal(await stage(page), 'rolling');
    assert.ok(await distance(page) > traveled && await distance(page) < 100, 'normal rolling time follows the toggle');
  });

  await verify('mute cancels voices, persists, and blocks cues before audio unlock', {}, async page => {
    await page.click('#start'); await draw(page); await page.clock.runFor(600);
    const sources = started(await audioEvents(page));
    await page.click('#sound');
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    assertCanceled(sources, await audioEvents(page), 'mute immediately cancels all sources');
    await page.clock.runFor(2800);
    assert.equal(started(await audioEvents(page)).length, sources.length, 'no sound starts while muted');
    assert.ok(await distance(page) > 0, 'muted gameplay still proceeds');
    await page.reload();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    await page.click('#start'); await draw(page); await page.clock.runFor(3000);
    assert.equal(await page.evaluate(() => window.audioContexts), 0, 'saved mute never creates an AudioContext');
    assert.equal(started(await audioEvents(page)).length, 0);
    assert.equal(await stage(page), 'rolling');
  });

  await verify('missing AudioContext and missing atlas retain playable fallback', { noAudio: true, noAtlas: true }, async page => {
    await page.click('#start'); await draw(page); await page.clock.runFor(1650);
    assert.equal(await stage(page), 'push'); assert.equal(await distance(page), 0);
    assert.notEqual(await page.locator('#pushing-rabbit').getAttribute('data-ready'), 'true');
    assert.equal(await page.locator('.rabbit-fallback').isVisible(), true);
    assert.equal(await page.locator('#rabbit-sprite').isVisible(), false);
    await page.clock.runFor(1400);
    assert.equal(await stage(page), 'rolling'); assert.ok(await distance(page) > 0);
    await page.click('#skip');
    assert.equal(Number(await page.locator('#result-distance').innerText()), 2000);
    assert.equal(await page.evaluate(() => window.audioContexts), 0);
  });
  assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
  console.log('PASS: rabbit launch lifecycle, audio cancellation, accessibility, atlas fallback, and desktop/phone captures.');
} finally { await browser.close(); }
