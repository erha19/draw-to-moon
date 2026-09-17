export const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('素材加载失败'));
  image.src = src;
});

export function drawPersonalMoon(ctx, contour, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  if (contour?.length) {
    contour.forEach((point, i) => {
      const px = point.x * r, py = point.y * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
  } else ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.shadowColor = '#e5c879';
  ctx.shadowBlur = r * .19;
  const gradient = ctx.createRadialGradient(-r * .3, -r * .4, r * .05, r * .12, r * .1, r * 1.15);
  gradient.addColorStop(0, '#fff2cb');
  gradient.addColorStop(.6, '#d9bd7e');
  gradient.addColorStop(1, '#756348');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();
  for (let i = 0; i < 34; i++) {
    const a = i * 2.39996, rr = r * Math.sqrt((i + .5) / 34);
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, r * (.02 + (i % 5) * .017), r * (.02 + (i % 3) * .012), a, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#74634830' : '#fff3cb35';
    ctx.fill();
  }
  ctx.restore();
}

export const POSTER_COPY = Object.freeze({
  title: '送你一颗中秋的月亮',
  subtitle: '把亲手画的月光，送给心上的你',
  blessing: ['愿你所念皆圆满，', '所行皆坦途。'],
  wish: '愿此刻的月光，照亮每一个想念。',
  footer: '画到月亮 · 一笔成月，寄予团圆',
});

function blossom(ctx, x, y, size, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#dac38b';
  for (let n = 0; n < 4; n++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -size * .65, size * .42, size * .7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff0c4';
  ctx.beginPath();
  ctx.arc(0, 0, size * .24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function osmanthus(ctx, x, y, rotation, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#9da47a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(30, -50, 35, -170, 90, -290);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const py = -35 - i * 35, px = 13 + i * 9;
    const side = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + side * 70, py - 4, px + side * 58, py - 54);
    ctx.quadraticCurveTo(px + side * 15, py - 48, px, py);
    ctx.fillStyle = i % 2 ? '#466d60' : '#365e54';
    ctx.fill();
    ctx.strokeStyle = '#8d9f7566';
    ctx.stroke();
    for (let j = 0; j < 3; j++) blossom(ctx, px - side * (13 + j * 11), py - 7 - j % 2 * 15, 5 + j % 2, i + j);
  }
  ctx.restore();
}

function cloud(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#d4c18c50';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-115, 9 + i * 8);
    ctx.bezierCurveTo(-70, 15 + i * 8, -70, -20 + i * 8, -27, -13 + i * 8);
    ctx.bezierCurveTo(-45, -61 + i * 8, 21, -67 + i * 8, 34, -28 + i * 8);
    ctx.bezierCurveTo(54, -43 + i * 8, 83, -22 + i * 8, 76, -5 + i * 8);
    ctx.bezierCurveTo(112, -6 + i * 8, 113, 18 + i * 8, 155, 12 + i * 8);
    ctx.stroke();
  }
  ctx.restore();
}

export async function generatePoster(result, url) {
  await document.fonts.ready;
  const [rabbit, moon] = await Promise.all([
    loadImage('assets/rabbit-celebrate.svg').catch(() => null),
    result.moonImage ? loadImage(result.moonImage).catch(() => null) : null,
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('图片绘制不可用，请重试');
  const bg = ctx.createLinearGradient(0, 0, 1080, 1440);
  bg.addColorStop(0, '#214c49');
  bg.addColorStop(.48, '#153d3d');
  bg.addColorStop(1, '#102d33');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1440);
  // Fine woven-paper texture stays quiet behind the calligraphic hierarchy.
  ctx.fillStyle = '#ead4a007';
  for (let y = 0; y < 1440; y += 4) ctx.fillRect(0, y, 1080, 1);
  for (let i = 0; i < 1700; i++) {
    ctx.fillStyle = i % 3 ? '#fff0cb08' : '#001d2018';
    ctx.fillRect((i * 173.37) % 1080, (i * 397.21) % 1440, 1, 2);
  }
  ctx.strokeStyle = '#c6ae7866';
  ctx.lineWidth = 1;
  ctx.strokeRect(35, 35, 1010, 1370);
  ctx.strokeStyle = '#c6ae782b';
  ctx.strokeRect(46, 46, 988, 1348);
  for (const [x, y, sx, sy] of [[55, 55, 1, 1], [1025, 55, -1, 1], [55, 1385, 1, -1], [1025, 1385, -1, -1]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = '#cfb882';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 78); ctx.lineTo(0, 0); ctx.lineTo(78, 0);
    ctx.moveTo(13, 53); ctx.lineTo(13, 13); ctx.lineTo(53, 13);
    ctx.moveTo(26, 40); ctx.lineTo(26, 26); ctx.lineTo(40, 26);
    ctx.stroke();
    blossom(ctx, 13, 13, 5, Math.PI / 4);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  const text = (value, y, size, color = '#f0e3bd') => {
    ctx.font = `${size}px "Songti SC", "STSong", serif`;
    ctx.fillStyle = color;
    ctx.fillText(value, 540, y, 880);
  };
  text('二〇二六  ·  中秋', 116, 22, '#c2b98e');
  text('送你一颗', 211, 53);
  text('中秋的月亮', 308, 79, '#f7e7bd');
  text(POSTER_COPY.subtitle, 364, 24, '#c9c7a8');

  const halo = ctx.createRadialGradient(540, 674, 85, 540, 674, 350);
  halo.addColorStop(0, '#e9d19c25');
  halo.addColorStop(.62, '#bdae7220');
  halo.addColorStop(1, '#e9d19c00');
  ctx.fillStyle = halo;
  ctx.fillRect(175, 309, 730, 730);
  ctx.strokeStyle = '#d8c48929';
  ctx.beginPath();
  ctx.arc(540, 674, 293, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#d8c48913';
  ctx.beginPath();
  ctx.arc(540, 674, 304, 0, Math.PI * 2);
  ctx.stroke();
  osmanthus(ctx, 137, 932, -.35, 1.05);
  osmanthus(ctx, 941, 662, 2.8, .86);
  cloud(ctx, 202, 530, .75);
  cloud(ctx, 851, 839, .8);
  // Retain the player's transparent 3D capture and silhouette, never a stock moon.
  if (moon) {
    const scale = Math.min(610 / moon.naturalWidth, 610 / moon.naturalHeight);
    const width = moon.naturalWidth * scale, height = moon.naturalHeight * scale;
    ctx.drawImage(moon, 540 - width / 2, 674 - height / 2, width, height);
  } else {
    const contour = result.contour;
    const extent = contour?.length ? Math.max(1, ...contour.map(point => Math.hypot(point.x, point.y))) : 1;
    drawPersonalMoon(ctx, contour, 540, 674, 235 / extent);
  }
  if (rabbit) ctx.drawImage(rabbit, 715, 818, 120, 120);
  for (const [x, y, size] of [[248, 737, 5], [817, 479, 6], [850, 728, 4], [319, 897, 4], [703, 430, 4]]) blossom(ctx, x, y, size, x / 40);

  text(POSTER_COPY.blessing[0], 1064, 44);
  text(POSTER_COPY.blessing[1], 1127, 44);
  text(POSTER_COPY.wish, 1193, 23, '#afbb9f');
  ctx.strokeStyle = '#b8aa7455';
  ctx.beginPath();
  ctx.moveTo(356, 1258); ctx.lineTo(511, 1258);
  ctx.moveTo(569, 1258); ctx.lineTo(724, 1258);
  ctx.stroke();
  blossom(ctx, 540, 1258, 7, Math.PI / 4);
  text(POSTER_COPY.footer, 1320, 24, '#c9c49f');
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('图片导出失败，请重新生成')),
    'image/png',
  ));
}

export function stageFor(distance) {
  return distance < 200 ? '桂花小径' : distance < 600 ? '云间石桥' : distance < 1000 ? '青山月隘' : distance < 1500 ? '星河长坡' : '月宫前庭';
}
