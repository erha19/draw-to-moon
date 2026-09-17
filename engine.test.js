import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, evaluateCircle, createRoll, advanceRoll, summarizeRoll } from './engine.js';
const circle = (count = 120, rx = .25, ry = rx, turns = 1, reverse = false) => Array.from({ length: count + 1 }, (_, i) => { const a = i / count * Math.PI * 2 * turns * (reverse ? -1 : 1); return { x: .5 + rx * Math.cos(a), y: .5 + ry * Math.sin(a) }; });
const good = score => ({ ...evaluateCircle(circle()), score });
test('circles score above ellipses, independent of drawing direction and event density', () => {
  for (const reverse of [false, true]) for (const n of [24, 60, 240]) assert.ok(evaluateCircle(circle(n, .25, .25, 1, reverse)).score >= 98);
  assert.ok(evaluateCircle(circle(120, .32, .16)).score < 80);
  assert.equal(evaluateCircle(circle()).score, evaluateCircle(circle().map(p => ({ x: p.x + 5, y: p.y - 2 }))).score);
});
test('gap circles are retained, lines/eights/tiny circles/partial circles rejected', () => {
  const full = evaluateCircle(circle()), gap = evaluateCircle(circle(120, .25, .25, .95));
  assert.ok(gap.valid && gap.score < full.score);
  assert.equal(evaluateCircle(circle(120, .07)).valid, false);
  assert.equal(evaluateCircle(circle(120, .25, .25, .5)).valid, false);
  assert.equal(evaluateCircle(Array.from({ length: 100 }, (_, i) => ({ x: i / 100, y: .5 }))).valid, false);
  const eight = Array.from({ length: 121 }, (_, i) => ({ x: .5 + .3 * Math.sin(i / 120 * Math.PI * 2), y: .5 + .3 * Math.sin(i / 120 * Math.PI * 4) }));
  assert.equal(evaluateCircle(eight).valid, false);
});
test('a single evaluation rolls automatically to a finite stop', () => {
  const state = createRoll(good(90));
  advanceRoll(state, 100);
  assert.equal(state.status, 'finished');
  assert.equal(state.speed, 0);
  assert.equal(state.elapsed, state.duration);
  assert.ok(state.distance > 1400 && state.distance < 1500);
});
test('rounder moons travel farther, low scoring moons still roll', () => {
  const distances = [0, 30, 50, 70, 85, 95, 100].map(score => {
    const state = createRoll(good(score)); advanceRoll(state, 60); return state.distance;
  });
  assert.ok(distances.every((d, i) => d > 0 && (!i || d > distances[i - 1])));
  assert.equal(distances.at(-1), RULES.maxDistance);
});
test('30/60/120 fps produce identical distance and stopping time', () => {
  const states = [30, 60, 120].map(fps => {
    const state = createRoll(good(81));
    for (let i = 0; i <= fps * 20; i++) advanceRoll(state, i / fps);
    return state;
  });
  for (const state of states) {
    assert.equal(state.distance, states[0].distance);
    assert.equal(state.elapsed, states[0].elapsed);
  }
});
test('no reverse movement, no NaN, no movement after stop', () => {
  const state = createRoll(good(70)); advanceRoll(state, 3); const distance = state.distance;
  advanceRoll(state, 2); assert.equal(state.distance, distance);
  advanceRoll(state, NaN); assert.equal(state.distance, distance);
  advanceRoll(state, 100); const final = state.distance;
  advanceRoll(state, 200); assert.equal(state.distance, final);
  assert.throws(() => createRoll({valid: false}));
});
test('summary preserves drawn contour with versioned distance result, no fake rank', () => {
  const evaluation = good(97), state = createRoll(evaluation);
  advanceRoll(state, 50); const result = summarizeRoll(state);
  assert.equal(result.version, 'moon-roll-v2');
  assert.deepEqual(result.contour, evaluation.contour);
  assert.notEqual(result.contour, evaluation.contour);
  assert.equal(result.grade, 'SS');
  assert.equal(result.percentile, undefined);
  assert.equal(result.distance, state.targetDistance);
});
