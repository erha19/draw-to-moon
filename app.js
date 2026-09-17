import { RULES, evaluateCircle, createRoll, advanceRoll, summarizeRoll } from './engine.js';
import { generatePoster, stageFor } from './poster.js';
import { Moon3D, moonOBJ } from './moon3d.js';

const $ = id => document.getElementById(id);
const screens = ['home', 'game', 'result', 'poster'];
const recordKey = `moon-record-${RULES.version}`;
const collectionKey = `moon-collection-${RULES.version}`;
let current = 'home', phase = 'drawing', roll = null, result = null;
let activePointer = null, points = [], origin = 0, hiddenAt = null;
let raf = 0, lastRender = 0, posterJob = 0, posterBlob = null, posterURL = null;
let modelPhase = .15, modelRotation = 0, modelPointer = null, lastModelX = 0, lastModelY = 0;
function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
const storedSettings = read('moon-settings');
const settings = { muted: storedSettings?.muted === true, reduced: storedSettings?.reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches };
function show(id) {
  current = id;
  screens.forEach(screen => $(screen).hidden = screen !== id);
  document.body.classList.toggle('game-active', id === 'game');
  window.scrollTo(0, 0);
  lastRender = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
let toastTimer;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').hidden = true, 4200);
}
function settingsUI() {
  document.body.classList.toggle('reduced', settings.reduced);
  $('sound').querySelector('span').textContent = settings.muted ? '关' : '开';
  $('sound').setAttribute('aria-pressed', settings.muted);
  $('motion').querySelector('span').textContent = settings.reduced ? '减' : '开';
  $('motion').setAttribute('aria-pressed', settings.reduced);
}
let audio;
function tone(frequency = 523, duration = .18, gain = .04) {
  if (settings.muted) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), volume = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0, audio.currentTime);
    volume.gain.linearRampToValueAtTime(gain, audio.currentTime + .012);
    volume.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    oscillator.connect(volume); volume.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + duration + .02);
  } catch { /* Audio is optional; gameplay stays available. */ }
}
settingsUI();
$('sound').onclick = () => { settings.muted = !settings.muted; save('moon-settings', settings); settingsUI(); if (!settings.muted) tone(); };
$('motion').onclick = () => { settings.reduced = !settings.reduced; save('moon-settings', settings); settingsUI(); };

function validSaved(value) {
  return value?.version === RULES.version && Number.isFinite(value.distance) && value.distance > 0 && value.distance <= RULES.maxDistance && Number.isFinite(value.score) && Array.isArray(value.contour) && value.contour.length >= 6 && value.contour.length <= 128 && value.contour.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 4 && Math.abs(p.y) < 4);
}
function updateRecord() {
  const best = read(recordKey);
  if (validSaved(best)) $('record').querySelector('strong').textContent = `${best.distance.toFixed(1)} 米 · ${best.title}`;
  $('last-moon').hidden = !validSaved(read(collectionKey));
}
updateRecord();
const query = new URLSearchParams(location.search), friendDistance = Number(query.get('d'));
if (query.get('v') === RULES.version && friendDistance >= RULES.minDistance && friendDistance <= RULES.maxDistance) {
  $('challenge').hidden = false;
  $('challenge').textContent = `朋友的月亮滚了 ${friendDistance.toFixed(1)} 米。你的一笔能更远吗？（本机成绩，未经验证）`;
  $('start').innerHTML = '画一颗，挑战朋友 <span>↗</span>';
}

const canvas = $('drawing'), ctx = canvas.getContext('2d');
const landscape = $('landscape'), land = landscape.getContext('2d');
const rollingModel = new Moon3D($('rolling-moon'));
const resultModel = new Moon3D($('personal-moon'));
let width = 0, height = 0, short = 1;
function resizeDrawing() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  width = rect.width; height = rect.height; short = Math.min(width, height);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (activePointer !== null) {
    const pointer = activePointer; activePointer = null; points = [];
    if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    $('feedback').textContent = '画布大小变了，再画一颗就好。';
  }
  drawStroke();
}
new ResizeObserver(resizeDrawing).observe(canvas);
function normalizedPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / short, y: (event.clientY - rect.top) / short };
}
function drawStroke() {
  ctx.clearRect(0, 0, width, height);
  if (points.length < 2) return;
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x * short, p.y * short) : ctx.moveTo(p.x * short, p.y * short));
  ctx.strokeStyle = '#f0d598'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = '#e3c98a'; ctx.shadowBlur = settings.reduced ? 0 : 12;
  ctx.stroke(); ctx.shadowBlur = 0;
}
canvas.addEventListener('pointerdown', event => {
  if (current !== 'game' || phase !== 'drawing' || activePointer !== null || !event.isPrimary) return;
  event.preventDefault();
  activePointer = event.pointerId; points = [normalizedPoint(event)];
  canvas.setPointerCapture(event.pointerId);
  $('guide').style.opacity = '0';
  $('feedback').textContent = '画完这一圈，抬手就出发。';
  drawStroke();
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== activePointer) return;
  event.preventDefault();
  const samples = event.getCoalescedEvents?.();
  for (const sample of samples?.length ? samples : [event]) {
    if (points.length < 4096) points.push(normalizedPoint(sample));
  }
  drawStroke();
});
function cancelDrawing(event) {
  if (event.pointerId !== activePointer) return;
  activePointer = null; points = []; drawStroke();
  $('guide').style.opacity = '1';
  $('feedback').textContent = '刚才的笔迹中断了，再画一颗就好。';
}
canvas.addEventListener('pointercancel', cancelDrawing);
canvas.addEventListener('lostpointercapture', cancelDrawing);
canvas.addEventListener('pointerup', event => {
  if (event.pointerId !== activePointer) return;
  points.push(normalizedPoint(event)); activePointer = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (points.length < 6) {
    $('feedback').textContent = '按住画一个大一点的圆，抬手后自动出发。';
    $('guide').style.opacity = '1'; return;
  }
  const evaluation = evaluateCircle(points);
  if (!evaluation.valid) {
    $('feedback').textContent = evaluation.reason + '。试着用一笔绕一圈。';
    tone(220, .15, .02); return;
  }
  beginRoll(evaluation);
});

function start() {
  posterJob++; result = null; roll = null; phase = 'drawing'; hiddenAt = null;
  points = []; activePointer = null;
  $('draw-panel').hidden = false; $('roll-stage').hidden = true;
  $('live-stats').hidden = true; $('roll-controls').hidden = true;
  $('phase-label').textContent = '壹 · 一笔成月';
  $('game-title').textContent = '画一颗，你的月亮。';
  $('game-eyebrow').textContent = '不必完美，独一无二就好';
  $('game-description').textContent = '一笔画圆，抬手后自动滚动。越圆，滚得越远。';
  $('feedback').textContent = '顺时针、逆时针都可以。只需画一次。';
  $('guide').style.opacity = '1';
  show('game'); resizeDrawing(); tone(392, .25);
}
function beginRoll(evaluation) {
  roll = createRoll(evaluation); phase = 'forming';
  $('draw-panel').hidden = true; $('roll-stage').hidden = false;
  $('live-stats').hidden = false; $('roll-controls').hidden = false;
  $('forming').hidden = false; $('skip').disabled = true;
  $('roundness').textContent = roll.score;
  $('distance').textContent = '0.0';
  $('phase-label').textContent = '贰 · 月亮自己远行';
  $('game-eyebrow').textContent = '你的一笔，正在变成立体月亮';
  $('game-title').textContent = roll.score >= 85 ? '这一轮，滚向更远。' : '有点歪，也有自己的远方。';
  $('game-description').textContent = '不用再画了。接下来，交给月亮。';
  $('feedback').textContent = roll.score >= 95 ? '完美满月 · 稳稳滚向远方' : roll.score >= 85 ? '漂亮月亮 · 这一笔很有潜力' : roll.score >= 60 ? '歪歪月亮 · 看它摇摇晃晃地出发' : '有趣的月球 · 小小颠簸，也是旅程';
  rollingModel.setContour(roll.contour);
  origin = performance.now();
  renderRoll(); tone(659, .3);
}
function terrain(x, camera, h) { return h * .72 + Math.sin((x + camera) / 230) * 10 + Math.sin((x + camera) / 87) * 3; }
function renderRoll() {
  if (!roll) return;
  const rect = $('roll-stage').getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const w = rect.width, h = rect.height, dpr = Math.min(devicePixelRatio || 1, 2);
  if (landscape.width !== Math.round(w * dpr) || landscape.height !== Math.round(h * dpr)) {
    landscape.width = Math.round(w * dpr); landscape.height = Math.round(h * dpr);
  }
  land.setTransform(dpr, 0, 0, dpr, 0, 0);
  const camera = settings.reduced ? 0 : roll.distance * .65;
  const sky = land.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#112b37'); sky.addColorStop(1, '#305552');
  land.fillStyle = sky; land.fillRect(0, 0, w, h);
  for (let i = 0; i < 45; i++) {
    const x = ((i * 91.7 - camera * .08) % w + w) % w, y = (i * 67.9) % (h * .57);
    land.fillStyle = i % 4 ? '#decd9655' : '#efdcb699';
    land.beginPath(); land.arc(x, y, i % 4 ? .8 : 1.4, 0, Math.PI * 2); land.fill();
  }
  // Fixed scenery seed: each drawn moon travels through the same route.
  for (let layer = 0; layer < 3; layer++) {
    land.beginPath(); land.moveTo(0, h);
    for (let x = -10; x <= w + 10; x += 8) {
      const k = (x + camera * (.12 + layer * .1)) / (130 - layer * 15);
      const y = h * (.52 + layer * .075) - Math.abs(Math.sin(k) * Math.cos(k * .38)) * h * (.2 - layer * .025);
      land.lineTo(x, y);
    }
    land.lineTo(w, h); land.closePath(); land.fillStyle = ['#45605c', '#284b4c', '#193e44'][layer]; land.fill();
  }
  land.beginPath(); land.moveTo(0, terrain(0, camera, h));
  for (let x = 0; x <= w + 8; x += 8) land.lineTo(x, terrain(x, camera, h));
  land.lineTo(w, h); land.lineTo(0, h); land.closePath();
  const ground = land.createLinearGradient(0, h * .7, 0, h); ground.addColorStop(0, '#56695b'); ground.addColorStop(1, '#203d40');
  land.fillStyle = ground; land.fill();
  land.beginPath(); for (let x = 0; x <= w + 8; x += 8) { const y = terrain(x, camera, h); x ? land.lineTo(x, y) : land.moveTo(x, y); }
  land.strokeStyle = '#d3bd83'; land.lineWidth = 2; land.stroke();
  land.strokeStyle = '#d3bd8320'; land.lineWidth = 8; land.stroke();
  for (let i = 0; i < 14; i++) {
    const x = ((i * 97 - camera) % (w + 80) + w + 80) % (w + 80) - 40;
    const y = terrain(x, camera, h) + 20 + (i * 11 % 46);
    land.strokeStyle = '#b8af7a55'; land.lineWidth = 1;
    land.beginPath(); land.moveTo(x, y); land.lineTo(x + 6, y - 4); land.lineTo(x + 13, y - 1); land.stroke();
  }
  const moonSize = Math.min(w < 500 ? 160 : 210, h * .68), centerX = w * .39;
  const roughness = (100 - roll.score) / 100;
  const rotation = settings.reduced ? 0 : roll.distance / 65;
  const bounce = settings.reduced ? 0 : Math.abs(Math.sin(rotation * 3)) * roughness * 22;
  const groundY = terrain(centerX, camera, h);
  land.fillStyle = '#051d2c55'; land.beginPath(); land.ellipse(centerX, groundY + 2, moonSize * .35, 9, 0, 0, Math.PI * 2); land.fill();
  const body = $('rolling-body');
  body.style.width = moonSize + 'px'; body.style.height = moonSize + 'px';
  body.style.left = centerX - moonSize / 2 + 'px'; body.style.top = groundY - moonSize * .84 - bounce + 'px';
  rollingModel.render({ rotation, phase: .2, tilt: .13 + Math.sin(rotation * 2) * roughness * .14 });
  $('distance').textContent = roll.distance.toFixed(1);
  $('stage-name').textContent = stageFor(roll.distance);
}
function finish() {
  if (!roll || phase === 'finished') return;
  advanceRoll(roll, roll.duration); phase = 'finished';
  result = summarizeRoll(roll);
  const previous = read(recordKey);
  result.isRecord = !validSaved(previous) || result.distance > previous.distance;
  let stored = save(collectionKey, result);
  if (result.isRecord) stored = save(recordKey, result) && stored;
  presentResult();
  $('best-note').textContent = !stored ? '本局月亮可下载，浏览器暂时无法保存收藏。' : result.isRecord ? '刷新最远月迹 · 你的月亮又多走了一程' : '月亮已收藏，下次打开仍能找到它。';
  updateRecord(); tone(1046, .45);
}
function presentResult() {
  modelPhase = .15; modelRotation = 0; modelPointer = null;
  show('result');
  resultModel.setContour(result.contour); resultModel.render({ phase: modelPhase, rotation: modelRotation, tilt: .12 });
  $('result-distance').textContent = result.distance.toFixed(1);
  $('result-score').textContent = `${result.score} / 100`;
  $('result-stage').textContent = stageFor(result.distance);
  $('grade').textContent = `${result.grade} · ${result.title}`;
  $('result-kicker').textContent = result.score >= 85 ? '你的一笔，在月光里走了很远。' : '不必是满月，也可以有自己的远方。';
  $('result-note').textContent = '轮廓与模型已随成绩保留 · ' + RULES.version;
  $('best-note').textContent = '这是你收藏的上一颗月亮。';
  // Export independently of viewport size so a short phone screen cannot blur the gift.
  const exportCanvas = document.createElement('canvas');
  const exportModel = new Moon3D(exportCanvas);
  exportModel.setContour(result.contour);
  exportModel.render({ phase: .15, tilt: .12, width: 900, height: 900, pixelRatio: 1 });
  result.moonImage = exportCanvas.toDataURL('image/png');
  exportModel.destroy();
  preparePoster();
}
function frame(now) {
  const dt = Math.min((now - lastRender) / 1000, .06); lastRender = now;
  if (current === 'game' && roll && hiddenAt === null) {
    if (phase === 'forming' && now - origin >= 1000) {
      phase = 'rolling'; origin = now; $('forming').hidden = true; $('skip').disabled = false;
      $('game-eyebrow').textContent = '越圆越稳，越稳越远'; tone(784, .3);
    }
    if (phase === 'rolling') {
      advanceRoll(roll, (now - origin) / 1000);
      renderRoll();
      if (roll.status === 'finished') { finish(); return; }
    }
  } else if (current === 'result' && result) {
    if (!settings.reduced && modelPointer === null) modelPhase += dt * .16;
    resultModel.render({ phase: modelPhase, rotation: modelRotation, tilt: .12 });
  }
  if (current === 'game' || current === 'result') raf = requestAnimationFrame(frame);
}
function visibility() {
  if (document.hidden) {
    if (current === 'game' && (phase === 'rolling' || phase === 'forming')) hiddenAt ??= performance.now();
    if (activePointer !== null) cancelDrawing({ pointerId: activePointer });
  } else if (hiddenAt !== null) {
    origin += performance.now() - hiddenAt; hiddenAt = null;
  }
}
document.addEventListener('visibilitychange', visibility);
window.addEventListener('pagehide', () => { if (current === 'game' && roll) hiddenAt ??= performance.now(); });
window.addEventListener('pageshow', () => { if (hiddenAt !== null && !document.hidden) { origin += performance.now() - hiddenAt; hiddenAt = null; } });
window.addEventListener('resize', () => { if (current === 'game' && roll) renderRoll(); });

const modelCanvas = $('personal-moon');
modelCanvas.addEventListener('pointerdown', event => {
  if (modelPointer !== null || !event.isPrimary) return;
  modelPointer = event.pointerId; lastModelX = event.clientX; lastModelY = event.clientY;
  modelCanvas.setPointerCapture(event.pointerId);
});
modelCanvas.addEventListener('pointermove', event => {
  if (event.pointerId !== modelPointer) return;
  modelPhase += (event.clientX - lastModelX) * .014;
  modelRotation += (event.clientY - lastModelY) * .009;
  lastModelX = event.clientX; lastModelY = event.clientY;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) modelCanvas.addEventListener(event, () => modelPointer = null);

async function preparePoster() {
  const job = ++posterJob; posterBlob = null;
  $('poster-image').hidden = true; $('poster-controls').hidden = true; $('retry-poster').hidden = true;
  $('poster-loading').hidden = false; $('poster-loading').textContent = '正在把月光，装进一封祝福里…';
  try {
    const blob = await generatePoster(result, location.href);
    if (job !== posterJob) return;
    posterBlob = blob;
    if (posterURL) URL.revokeObjectURL(posterURL);
    posterURL = URL.createObjectURL(blob);
    $('poster-image').src = posterURL; $('download-image').href = posterURL; $('original-image').href = posterURL;
    $('poster-loading').hidden = true; $('poster-image').hidden = false; $('poster-controls').hidden = false;
  } catch {
    if (job !== posterJob) return;
    $('poster-loading').textContent = '海报暂时没画好，月亮仍在。请重新生成。';
    $('retry-poster').hidden = false;
  }
}
$('start').onclick = start; $('again').onclick = start;
$('skip').onclick = () => { if (phase === 'rolling') finish(); };
$('leave').onclick = () => { phase = 'drawing'; roll = null; activePointer = null; hiddenAt = null; show('home'); };
$('home-button').onclick = () => show('home');
$('last-moon').onclick = () => { const saved = read(collectionKey); if (validSaved(saved)) { result = saved; presentResult(); } };
$('poster-open').onclick = () => show('poster');
$('poster-back').onclick = () => show('result');
$('retry-poster').onclick = preparePoster;
$('download-model').onclick = () => {
  if (!result) return;
  const blob = new Blob([moonOBJ(result.contour)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = '我的月亮.obj'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast('已导出月亮 3D 网格（OBJ），可在三维软件中打开。');
};
$('share-image').onclick = async () => {
  if (!posterBlob) return;
  const file = new File([posterBlob], '送你一颗中秋的月亮.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '送你一颗中秋的月亮', text: '愿你所念皆圆满，所行皆坦途。' });
    } else toast('可长按图片保存，或使用下方“下载图片 / 打开原图”。');
  } catch (error) { if (error.name !== 'AbortError') toast('此处暂不能调用分享，请下载图片或打开原图。'); }
};
$('challenge-share').onclick = async () => {
  if (!result) return;
  const url = new URL(location.href); url.search = ''; url.hash = '';
  url.searchParams.set('d', result.distance.toFixed(1)); url.searchParams.set('v', RULES.version);
  const text = `我只画一笔，月亮滚了 ${result.distance.toFixed(1)} 米。你的月亮能走多远？（本机成绩）`;
  try {
    if (navigator.share) await navigator.share({ title: '画到月亮', text, url: url.href });
    else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url.href);
      toast(/localhost|127\.0\.0\.1|^192\.168\./.test(url.hostname) ? '链接已复制；当前为本地试玩地址，外网访问需先部署。' : '挑战链接已复制，发给朋友画一颗月亮。');
    } else { history.replaceState(null, '', url); toast('请复制地址栏中的挑战链接。'); }
  } catch (error) { if (error.name !== 'AbortError') toast('暂时无法分享，请稍后重试。'); }
};
