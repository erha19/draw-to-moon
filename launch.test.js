import test from 'node:test';
import assert from 'node:assert/strict';
import { launchAt, LAUNCH_DURATION, REDUCED_LAUNCH_DURATION } from './launch.js';

test('the rabbit braces before pushing, then releases and waves before travel', () => {
  assert.deepEqual([0, .5, 1, 1.5, 2, 2.4].map(t => launchAt(t).name),
    ['ready', 'brace', 'strain', 'push', 'release', 'wave']);
  assert.equal(launchAt(1.39).push, 0);
  assert.ok(launchAt(2).push > 0);
  assert.equal(launchAt(LAUNCH_DURATION - .001).done, false);
  assert.equal(launchAt(LAUNCH_DURATION).done, true);
  assert.equal(launchAt(100).push, 1);
});

test('launch presentation is deterministic and never mutates a game result', () => {
  const paused = launchAt(1.1);
  assert.deepEqual(launchAt(1.1), paused);
  for (let t = 0; t < 4; t += 1 / 120) {
    const state = launchAt(t);
    assert.ok(state.pose >= 0 && state.pose <= 5);
    assert.ok(state.push >= 0 && state.push <= 1);
  }
  assert.equal(launchAt(NaN).name, 'ready');
  assert.equal(launchAt(-1).name, 'ready');
});

test('reduced motion uses one still pose and a brief transition without effort shakes', () => {
  for (const t of [0, .2, .64]) {
    const state = launchAt(t, true);
    assert.equal(state.pose, 3);
    assert.equal(state.push, 0);
    assert.equal(state.effort, 0);
    assert.equal(state.done, false);
    assert.equal(state.cue, undefined);
  }
  assert.equal(launchAt(REDUCED_LAUNCH_DURATION, true).done, true);
});
