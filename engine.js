/** All distances use the drawing area's short side; simulation time is seconds. */
export const RULES = Object.freeze({ version: 'moon-roll-v2', minDiameter: 0.3, maxDistance: 2000, minDistance: 40 });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;

function clean(points) {
  const out = [];
  for (const p of points) if (Number.isFinite(p.x) && Number.isFinite(p.y) && (!out.length || distance(p, out.at(-1)) > 0.00001)) out.push({ x: p.x, y: p.y });
  return out;
}
function resample(points, count = 64) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + distance(points[i - 1], points[i]));
  const total = lengths.at(-1);
  if (!total) return [];
  let segment = 1;
  return Array.from({ length: count }, (_, i) => {
    const target = total * i / (count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const t = (target - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1]);
    const a = points[segment - 1], b = points[segment];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}
function fit(points) {
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  let xx = 0, xy = 0, yy = 0, xq = 0, yq = 0;
  for (const p of points) {
    const x = p.x - mx, y = p.y - my, q = x * x + y * y;
    xx += x * x; xy += x * y; yy += y * y; xq += x * q; yq += y * q;
  }
  const det = xx * yy - xy * xy;
  if (det < 1e-10 || det / Math.max(1e-10, xx * yy) < 0.01) return null;
  const center = { x: mx + (xq * yy - yq * xy) / (2 * det), y: my + (yq * xx - xq * xy) / (2 * det) };
  const radius = points.reduce((s, p) => s + distance(p, center), 0) / points.length;
  return { center, radius };
}
function winding(points, center) {
  let signed = 0, absolute = 0;
  for (let i = 1; i < points.length; i++) {
    let d = Math.atan2(points[i].y - center.y, points[i].x - center.x) - Math.atan2(points[i - 1].y - center.y, points[i - 1].x - center.x);
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    signed += d; absolute += Math.abs(d);
  }
  return { angle: Math.abs(signed), consistency: Math.abs(signed) / Math.max(absolute, 1e-9) };
}
export function evaluateCircle(input) {
  const raw = clean(input);
  const reject = reason => ({ valid: false, score: 0, reason, contour: [] });
  if (raw.length < 6) return reject('画大一点');
  const span = Math.max(Math.max(...raw.map(p => p.x)) - Math.min(...raw.map(p => p.x)), Math.max(...raw.map(p => p.y)) - Math.min(...raw.map(p => p.y)));
  if (span < RULES.minDiameter) return reject('画大一点');
  const points = resample(raw), circle = fit(points);
  if (!circle || circle.radius > span * 1.5) return reject('试着画一个完整的圆');
  const { center, radius } = circle, turn = winding(points, center);
  if (turn.angle < TAU * 0.8 || turn.angle > TAU * 1.22 || turn.consistency < 0.86) return reject('试着画一个完整的圆');
  const radialError = Math.sqrt(points.reduce((sum, p) => sum + (distance(p, center) - radius) ** 2, 0) / points.length) / radius;
  const gap = distance(points[0], points.at(-1)) / radius;
  if (gap > 1.2) return reject('再把月亮画完整一点');
  const score = Math.round(80 * clamp(1 - 2.7 * radialError, 0, 1) + 20 * clamp(1 - gap / 1.2, 0, 1));
  return { valid: true, score, reason: '', center: { ...center }, radius,
    contour: points.map(p => ({ x: (p.x - center.x) / radius, y: (p.y - center.y) / radius })) };
}

/** A deterministic arcade roll: shape determines range, never drawing speed. */
export function createRoll(evaluation) {
  if (!evaluation?.valid || !Number.isFinite(evaluation.score) || !evaluation.contour?.length) {
    throw new TypeError('A valid drawn moon is required');
  }
  const score = clamp(evaluation.score, 0, 100);
  const quality = score / 100;
  const targetDistance = RULES.minDistance + (RULES.maxDistance - RULES.minDistance) * quality ** 3;
  return {
    version: RULES.version, score, contour: evaluation.contour.map(p => ({ ...p })),
    duration: 8 + 6 * quality, targetDistance,
    elapsed: 0, distance: 0, speed: 2 * targetDistance / (8 + 6 * quality), status: 'rolling',
  };
}

export function advanceRoll(state, seconds) {
  if (!Number.isFinite(seconds) || state.status === 'finished') return state;
  const elapsed = clamp(seconds, state.elapsed, state.duration);
  const fraction = elapsed / state.duration;
  state.elapsed = elapsed;
  state.distance = state.targetDistance * (2 * fraction - fraction ** 2);
  state.speed = 2 * state.targetDistance / state.duration * (1 - fraction);
  if (elapsed >= state.duration) {
    state.distance = state.targetDistance;
    state.speed = 0;
    state.status = 'finished';
  }
  return state;
}

export function summarizeRoll(state) {
  const [grade, title] = state.score >= 95 ? ['SS', '天生满月']
    : state.score >= 85 ? ['S', '月宫远行客']
    : state.score >= 70 ? ['A', '逐月行者']
    : state.score >= 50 ? ['B', '摇摇月亮'] : ['C', '有趣的月球'];
  return {
    version: RULES.version, distance: state.distance, score: state.score,
    grade, title, time: state.elapsed, contour: state.contour.map(p => ({ ...p })),
  };
}
