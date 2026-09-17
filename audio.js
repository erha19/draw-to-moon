// Short effects follow the game's animation clock. There are no looping tracks
// or delayed JS callbacks to restart a sound after a screen change.
export function createGameAudio() {
  let context = null, noiseBuffer = null, muted = false, paused = false;
  const voices = new Set();

  function resumeContext() {
    if (!context || muted || paused || context.state === 'closed') return;
    try { context.resume()?.catch(() => {}); } catch { /* Sound is optional. */ }
  }

  function unlock() {
    if (muted || paused) return false;
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return false;
        context = new AudioContext();
        noiseBuffer = null;
      }
      resumeContext();
      return true;
    } catch { return false; }
  }

  function dispose(voice, interrupt = false) {
    voice.source.onended = null;
    if (interrupt) {
      try { voice.source.stop(); } catch { /* It may already have ended. */ }
    }
    for (const node of voice.nodes) {
      try { node.disconnect(); } catch { /* Also safe after partial setup. */ }
    }
    voices.delete(voice);
  }

  function stop() {
    for (const voice of voices) dispose(voice, true);
  }

  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate), context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function voice({ frequency = 160, end = frequency, type = 'sine', duration = .2,
    gain = .025, delay = 0, attack = .012, filter, cutoff = 500, q = .7, breath = false }) {
    let playing;
    try {
      const source = breath ? context.createBufferSource() : context.createOscillator();
      playing = { source, nodes: [source] };
      voices.add(playing);
      const start = context.currentTime + delay, finish = start + duration;
      if (breath) source.buffer = noise();
      else {
        source.type = type;
        source.frequency.setValueAtTime(frequency, start);
        source.frequency.exponentialRampToValueAtTime(end, finish);
      }
      let output = source;
      if (filter) {
        const shaping = context.createBiquadFilter();
        playing.nodes.push(shaping);
        shaping.type = filter;
        shaping.frequency.value = cutoff;
        shaping.Q.value = q;
        output.connect(shaping);
        output = shaping;
      }
      const volume = context.createGain();
      playing.nodes.push(volume);
      volume.gain.setValueAtTime(.0001, start);
      volume.gain.linearRampToValueAtTime(gain, start + Math.min(attack, duration / 2));
      volume.gain.exponentialRampToValueAtTime(.0001, finish);
      output.connect(volume);
      volume.connect(context.destination);
      source.onended = () => dispose(playing);
      source.start(start);
      source.stop(finish + .02);
    } catch {
      if (playing) dispose(playing, true);
    }
  }

  function tone(frequency = 523, duration = .18, gain = .04) {
    if (![frequency, duration, gain].every(Number.isFinite) || frequency <= 0 || duration <= 0 || gain <= 0) return;
    if (!unlock()) return;
    voice({ frequency: Math.min(frequency, 12000), duration: Math.min(duration, 2), gain: Math.min(gain, .08) });
  }

  function cue(name) {
    if (!['brace', 'push', 'release', 'rolling'].includes(name) || !unlock()) return;
    if (name === 'brace') {
      // Two small foot shuffles and a soft, descending effort sound.
      voice({ breath: true, filter: 'bandpass', cutoff: 350, duration: .15, gain: .025 });
      voice({ breath: true, filter: 'bandpass', cutoff: 250, duration: .13, gain: .02, delay: .16 });
      voice({ type: 'triangle', frequency: 155, end: 118, duration: .27, gain: .025, delay: .09 });
    } else if (name === 'push') {
      // A breathy heave lands on a rounded, low thump.
      voice({ breath: true, filter: 'bandpass', cutoff: 480, duration: .25, gain: .05 });
      voice({ type: 'triangle', frequency: 180, end: 110, duration: .28, gain: .022 });
      voice({ frequency: 100, end: 45, duration: .22, gain: .05, delay: .09 });
    } else if (name === 'release') {
      // Air and a warm rising fifth reward the final push.
      voice({ breath: true, filter: 'highpass', cutoff: 650, duration: .55, gain: .028, attack: .12 });
      voice({ frequency: 330, end: 660, duration: .38, gain: .025 });
      voice({ type: 'triangle', frequency: 660, duration: .45, gain: .022, delay: .12 });
      voice({ frequency: 988, duration: .42, gain: .018, delay: .24 });
    } else {
      voice({ breath: true, filter: 'lowpass', cutoff: 150, duration: .65, gain: .04 });
      voice({ frequency: 54, end: 42, duration: .55, gain: .018 });
    }
  }

  return {
    unlock,
    tone,
    cue,
    stop,
    setMuted(value) { muted = Boolean(value); if (muted) stop(); },
    pause() { paused = true; stop(); },
    resume() { paused = false; resumeContext(); },
  };
}
