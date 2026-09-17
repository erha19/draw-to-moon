// Presentation time is separate from the deterministic distance simulation.
export const LAUNCH_DURATION = 2.8;
export const REDUCED_LAUNCH_DURATION = .65;
const beats = [
  { at: 0, pose: 0, name: 'ready', text: '玉兔来帮你，把月亮送向远方。' },
  { at: .45, pose: 1, name: 'brace', text: '站稳脚跟，攒一口气…', cue: 'brace' },
  { at: .9, pose: 2, name: 'strain', text: '小小玉兔，也有大大的力气。' },
  { at: 1.4, pose: 3, name: 'push', text: '嘿——哟！', cue: 'push' },
  { at: 1.95, pose: 4, name: 'release', text: '去吧，带着心意去远行。', cue: 'release' },
  { at: 2.35, pose: 5, name: 'wave', text: '让这颗月亮，替你捎去想念。' },
];
const clamp = value => Math.max(0, Math.min(1, value));
export function smoothStep(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}
export function launchAt(seconds, reduced = false) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (reduced) return {
    pose: 3, name: 'gentle', text: '玉兔轻轻一推，月亮出发。',
    done: time >= REDUCED_LAUNCH_DURATION, push: 0, effort: 0, previousPose: 3, blend: 1, squash: 0,
  };
  const beat = beats.findLast(beat => time >= beat.at);
  return {
    ...beat, done: time >= LAUNCH_DURATION,
    previousPose: Math.max(0, beat.pose - 1), blend: smoothStep((time - beat.at) / .14),
    push: smoothStep((time - 1.4) / 1.4),
    effort: time >= .9 && time < 1.95 ? Math.sin((time - .9) * 15) : 0,
    squash: time >= .45 && time < 1.95 ? Math.sin((time - .45) / 1.5 * Math.PI) * .025 : 0,
  };
}
