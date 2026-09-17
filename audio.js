// Effects follow the game clock; music uses a short AudioContext lookahead.
// No timers or external recordings can restart audio after leaving the game.
export function createGameAudio() {
  let context = null, noiseBuffer = null, muted = false, paused = false;
  let musicEnabled = true, musicPlaying = false, nextNote = 0, noteIndex = 0, scene = 'home';
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
      musicPlaying = true;
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
    musicPlaying = false; nextNote = 0; noteIndex = 0;
  }

  function silence(musicOnly = false) {
    for (const voice of voices) if (!musicOnly || voice.music) dispose(voice, true);
    nextNote = 0;
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
    gain = .025, delay = 0, attack = .012, filter, cutoff = 500, q = .7, breath = false, music = false }) {
    let playing;
    try {
      const source = breath ? context.createBufferSource() : context.createOscillator();
      playing = { source, nodes: [source], music };
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
    if (!['form', 'draw', 'brace', 'push', 'release', 'rolling'].includes(name) || !unlock()) return;
    if (name === 'form') {
      voice({ frequency: 262, end: 523, duration: 1.1, gain: .024, attack: .25 });
      voice({ frequency: 784, end: 1046, duration: .75, delay: .3, gain: .012, attack: .12 });
      voice({ breath: true, filter: 'bandpass', cutoff: 1200, duration: .8, gain: .014, attack: .25 });
    } else if (name === 'draw') {
      voice({ type: 'triangle', frequency: 523, end: 392, duration: .13, gain: .013 });
    } else if (name === 'brace') {
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

  function combo(count) {
    if (!Number.isInteger(count) || count < 1 || count > 20 || !unlock()) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880];
    const base = scale[(count - 1) % scale.length] * (count > 10 ? 1.25 : 1);
    voice({ frequency: base, duration: .32, gain: .034 });
    voice({ type: 'triangle', frequency: base * 1.5, duration: .36, gain: .016, delay: .055 });
    if (count % 5 === 0) voice({ frequency: base * 2, duration: .6, gain: .019, delay: .12 });
  }

  // An original, repeating pentatonic phrase with rests, plucked overtones and
  // a soft root/fifth. Scene changes alter the pace without restarting notes.
  const melody = [0, null, 2, 4, 3, 2, 1, null, 0, 2, 3, null, 4, 2, 1, null,
    2, 3, 4, null, 2, 1, 0, null, 1, 2, 4, 3, 2, null, 0, null];
  const notes = [392, 440, 523.25, 587.33, 659.25];
  function tick() {
    if (!context || context.state !== 'running' || muted || paused || !musicEnabled || !musicPlaying) return;
    const now = context.currentTime;
    // Missed frames never queue an entire old phrase on resume.
    if (!nextNote || nextNote < now - .15) nextNote = now + .035;
    if (nextNote > now + .12) return;
    const delay = Math.max(0, nextNote - now), index = noteIndex % melody.length;
    const note = melody[index], quiet = scene === 'result' || scene === 'poster' ? .65 : 1;
    if (note !== null) {
      const frequency = notes[note];
      voice({ frequency, duration: .9, gain: .014 * quiet, attack: .015, delay, music: true });
      voice({ frequency: frequency * 2, duration: .35, gain: .0035 * quiet, delay, music: true });
    }
    if (index % 8 === 0) {
      voice({ frequency: index < 16 ? 196 : 220, duration: 2.4, gain: .009 * quiet, attack: .25, delay, music: true });
      voice({ frequency: index < 16 ? 293.66 : 330, duration: 2.6, gain: .005 * quiet, attack: .45, delay, music: true });
    }
    noteIndex++;
    nextNote += scene === 'rolling' ? .4 : .48;
  }

  return {
    unlock,
    tone,
    cue,
    combo,
    tick,
    stop,
    setScene(value) { scene = value; if (context) musicPlaying = true; },
    setMusicEnabled(value) { musicEnabled = Boolean(value); if (!musicEnabled) silence(true); },
    setMuted(value) { muted = Boolean(value); if (muted) silence(); },
    pause() { paused = true; silence(); },
    resume() { paused = false; resumeContext(); },
  };
}
