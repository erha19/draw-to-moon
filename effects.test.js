import test from 'node:test';
import assert from 'node:assert/strict';
import { formationAt, comboAt, FORM_DURATION, REDUCED_FORM_DURATION } from './effects.js';

test('formation preserves a complete start and finish with continuous bounded layers', () => {
  assert.equal(formationAt(0).move, 0);
  assert.equal(formationAt(FORM_DURATION).surface, 1);
  assert.equal(formationAt(FORM_DURATION).done, true);
  assert.equal(formationAt(FORM_DURATION - .01).done, false);
  let previous = formationAt(0);
  for (let t = 0; t < 2; t += 1 / 120) {
    const state = formationAt(t);
    for (const field of ['move', 'fill', 'surface']) {
      assert.ok(state[field] >= previous[field] && state[field] <= 1);
    }
    previous = state;
  }
  assert.equal(formationAt(REDUCED_FORM_DURATION, true).done, true);
});

test('combos belong to absolute 100m milestones, including exact boundaries and skipped frames', () => {
  assert.equal(comboAt(99.99).count, 0);
  assert.equal(comboAt(100).count, 1);
  assert.equal(comboAt(399).count, 3);
  assert.equal(comboAt(400).count, 4);
  assert.equal(comboAt(2000).count, 20);
  assert.equal(comboAt(2000).title, '圆满之旅');
  assert.equal(comboAt(-4).count, 0);
  assert.equal(comboAt(NaN).count, 0);
  assert.equal(comboAt(99999).count, 20);
  assert.equal(comboAt(150).progress, .5);
});
