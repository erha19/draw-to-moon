import { smoothStep } from './launch.js';

export const FORM_DURATION = 1.35;
export const REDUCED_FORM_DURATION = .25;
export const COMBO_STEP = 100;

export function formationAt(seconds, reduced = false) {
  const duration = reduced ? REDUCED_FORM_DURATION : FORM_DURATION;
  const progress = Math.max(0, Math.min(1, (Number.isFinite(seconds) ? seconds : 0) / duration));
  return { progress, done: progress === 1, move: smoothStep(progress),
    fill: smoothStep((progress - .12) / .48), surface: smoothStep((progress - .4) / .5) };
}

export function comboAt(distance) {
  const meters = Number.isFinite(distance) ? Math.max(0, Math.min(2000, distance)) : 0;
  const count = Math.floor(meters / COMBO_STEP);
  return { count, milestone: count * COMBO_STEP, progress: (meters % COMBO_STEP) / COMBO_STEP,
    remaining: COMBO_STEP - Math.floor(meters % COMBO_STEP),
    title: count >= 20 ? '圆满之旅' : count >= 12 ? '一路追月' : count >= 7 ? '乘风逐月' : count >= 3 ? '越滚越有劲' : '月亮，出发！' };
}

// Moves the actual drawn outline into the actual rendered moon; no generic orb.
export function paintFormation(ctx, source, target, moon, state, reduced = false) {
  const { progress, move, fill, surface } = state;
  const cx = target.x + target.size / 2, cy = target.y + target.size / 2;
  ctx.save();
  if (reduced) {
    ctx.globalAlpha = progress;
    ctx.drawImage(moon, target.x, target.y, target.size, target.size);
    ctx.restore(); return;
  }
  const radius = target.size * .405;
  const polygon = source.map(p => ({
    x: p.x + (cx + p.nx * radius - p.x) * move,
    y: p.y + (cy + p.ny * radius - p.y) * move,
  }));
  if (polygon.length) {
    ctx.beginPath();
    polygon.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    const glow = ctx.createRadialGradient(cx - radius * .3, cy - radius * .3, 0, cx, cy, radius * 1.5);
    glow.addColorStop(0, '#fff3cb'); glow.addColorStop(.55, '#d8bc7b'); glow.addColorStop(1, '#8c754f');
    ctx.fillStyle = glow; ctx.globalAlpha = fill * (1 - surface); ctx.fill();
    ctx.globalAlpha = 1 - surface; ctx.strokeStyle = '#f2d598'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#f2d598'; ctx.shadowBlur = 10 + 16 * Math.sin(progress * Math.PI); ctx.stroke();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = surface;
  ctx.drawImage(moon, target.x, target.y, target.size, target.size);
  // A restrained inward spiral makes the forming volume readable.
  const glow = Math.sin(progress * Math.PI);
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8 + progress * 2;
    const r = radius * (1.6 - progress * .65);
    ctx.globalAlpha = glow * .65;
    ctx.fillStyle = '#f1d89e'; ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, i % 3 ? 1.2 : 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
