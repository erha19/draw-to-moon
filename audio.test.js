import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAudio } from './audio.js';

function installAudio(t, { failGain = false, failResume = false, legacy = false } = {}) {
  const previous = ['AudioContext', 'webkitAudioContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const contexts = [];
  class FakeAudioContext {
    constructor() {
      this.state = 'running'; this.currentTime = 5; this.sampleRate = 8000;
      this.destination = {}; this.nodes = []; this.resumes = 0;
      contexts.push(this);
    }
    resume() { this.resumes++; return failResume ? Promise.reject(new Error('Blocked')) : Promise.resolve(); }
    parameter() {
      return {
        events: [],
        setValueAtTime(...args) { this.events.push(['set', ...args]); },
        linearRampToValueAtTime(...args) { this.events.push(['linear', ...args]); },
        exponentialRampToValueAtTime(...args) { this.events.push(['exponential', ...args]); },
      };
    }
    node(kind) {
      const node = {
        kind, connections: [], disconnected: false,
        connect(target) { this.connections.push(target); },
        disconnect() { this.disconnected = true; this.connections = []; },
      };
      this.nodes.push(node);
      return node;
    }
    source(kind) {
      return Object.assign(this.node(kind), {
        frequency: this.parameter(), starts: [], stops: [], onended: null,
        start(time) { this.starts.push(time); },
        stop(time) { this.stops.push(time); },
      });
    }
    createOscillator() { return this.source('oscillator'); }
    createBufferSource() { return this.source('noise'); }
    createGain() {
      if (failGain) throw new Error('Unavailable gain node');
      return Object.assign(this.node('gain'), { gain: this.parameter() });
    }
    createBiquadFilter() { return Object.assign(this.node('filter'), { frequency: {}, Q: {} }); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  for (const [key] of previous) Object.defineProperty(globalThis, key, { value: undefined, configurable: true, writable: true });
  globalThis[legacy ? 'webkitAudioContext' : 'AudioContext'] = FakeAudioContext;
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return contexts;
}
const sources = context => context.nodes.filter(node => node.starts);

test('muting before unlock never creates a context or replays skipped cues', t => {
  const contexts = installAudio(t), audio = createGameAudio();
  audio.setMuted(true);
  assert.equal(audio.unlock(), false);
  audio.cue('push'); audio.tone(); audio.resume();
  assert.equal(contexts.length, 0);
  audio.setMuted(false);
  assert.equal(contexts.length, 0);
  assert.equal(audio.unlock(), true);
  assert.equal(sources(contexts[0]).length, 0);
  audio.cue('push');
  assert.equal(sources(contexts[0]).length, 3);
});

test('mute stops current and future scheduled voices and disconnects every node', t => {
  const contexts = installAudio(t), audio = createGameAudio();
  audio.cue('release');
  const context = contexts[0], scheduled = sources(context);
  assert.ok(scheduled.some(source => source.starts[0] > context.currentTime));
  audio.setMuted(true);
  assert.ok(context.nodes.every(node => node.disconnected));
  assert.ok(scheduled.every(source => source.stops.at(-1) === undefined && source.onended === null));
  const count = context.nodes.length;
  audio.setMuted(false); audio.resume();
  assert.equal(context.nodes.length, count);
  audio.stop();
  assert.ok(scheduled.every(source => source.stops.length === 2));
});

test('pause blocks cues and resume neither allocates audio nor restarts canceled sources', t => {
  const contexts = installAudio(t), audio = createGameAudio();
  audio.resume();
  assert.equal(contexts.length, 0);
  audio.pause(); audio.tone(); audio.cue('brace'); audio.unlock();
  assert.equal(contexts.length, 0);
  audio.resume(); audio.cue('brace');
  const context = contexts[0], original = sources(context);
  audio.pause();
  assert.ok(context.nodes.every(node => node.disconnected));
  audio.cue('push'); audio.resume();
  assert.equal(sources(context).length, original.length);
  assert.ok(original.every(source => source.starts.length === 1));
  audio.cue('release');
  assert.equal(sources(context).length, original.length + 4);
});

test('finished voices clean up their complete node chain and stop is idempotent', t => {
  const contexts = installAudio(t), audio = createGameAudio();
  audio.cue('rolling');
  const context = contexts[0], scheduled = sources(context);
  for (const source of scheduled) source.onended();
  assert.ok(context.nodes.every(node => node.disconnected));
  audio.stop(); audio.stop();
  assert.ok(scheduled.every(source => source.stops.length === 1));
});

test('unknown cues and invalid tones do not allocate audio; valid tones stay bounded', t => {
  const contexts = installAudio(t), audio = createGameAudio();
  audio.cue('unknown'); audio.tone(NaN); audio.tone(220, -1); audio.tone(440, .2, 0);
  assert.equal(contexts.length, 0);
  audio.tone(50000, 100, 10);
  const context = contexts[0], source = sources(context)[0];
  assert.equal(source.frequency.events[0][1], 12000);
  assert.equal(source.stops[0], context.currentTime + 2.02);
  assert.equal(context.nodes.find(node => node.kind === 'gain').gain.events[1][1], .08);
});

test('absent or failing audio capabilities leave gameplay calls harmless', t => {
  installAudio(t);
  globalThis.AudioContext = undefined;
  let audio = createGameAudio();
  assert.equal(audio.unlock(), false);
  assert.doesNotThrow(() => { audio.cue('push'); audio.tone(); audio.pause(); audio.resume(); audio.stop(); });
  globalThis.AudioContext = class { constructor() { throw new Error('Unavailable'); } };
  audio = createGameAudio();
  assert.equal(audio.unlock(), false);
  assert.doesNotThrow(() => audio.cue('release'));
});

test('partial node failures are cleaned up and rejected resume promises are handled', async t => {
  const contexts = installAudio(t, { failGain: true, failResume: true }), audio = createGameAudio();
  assert.doesNotThrow(() => audio.cue('brace'));
  await Promise.resolve();
  assert.ok(contexts[0].nodes.every(node => node.disconnected));
  assert.ok(sources(contexts[0]).every(source => source.onended === null));
});

test('legacy AudioContext works and repeated unlock calls reuse one context', t => {
  const contexts = installAudio(t, { legacy: true }), audio = createGameAudio();
  audio.unlock(); audio.unlock(); audio.tone();
  assert.equal(contexts.length, 1);
  assert.equal(sources(contexts[0]).length, 1);
});
