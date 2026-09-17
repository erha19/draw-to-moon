// A small, dependency-free 3D renderer. The submitted outline forms the
// equator of a closed mesh; lighting and projection are computed in 3D.
const SEGMENTS = 64;
const BANDS = 8;
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const unit = v => { const d = Math.hypot(...v) || 1; return v.map(n => n / d); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const subtract = (a, b) => a.map((n, i) => n - b[i]);

function outlineProfile(contour) {
  const samples = (Array.isArray(contour) ? contour : [])
    .map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p)
    .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.hypot(p.x, p.y) > 0.001)
    .map(p => ({ angle: (Math.atan2(p.y, p.x) + TAU) % TAU, radius: clamp(Math.hypot(p.x, p.y), 0.25, 2.5) }))
    .sort((a, b) => a.angle - b.angle);
  if (samples.length < 3) return () => 1;
  return angle => {
    const a = (angle + TAU) % TAU;
    let right = samples.findIndex(p => p.angle >= a);
    if (right < 0) right = 0;
    const next = samples[right];
    const prev = samples[(right + samples.length - 1) % samples.length];
    const span = (next.angle - prev.angle + TAU) % TAU;
    const offset = (a - prev.angle + TAU) % TAU;
    const t = span > 0.00001 ? offset / span : 0;
    return prev.radius + (next.radius - prev.radius) * t;
  };
}

// Seeded surface features are shared by every frame and every export.
const CRATERS = Array.from({ length: 30 }, (_, i) => {
  const z = 1 - 2 * (i + 0.5) / 30;
  const theta = i * 2.399963229728653;
  const r = Math.sqrt(1 - z * z);
  return { direction: [r * Math.cos(theta), r * Math.sin(theta), z], radius: 0.065 + ((i * 17) % 11) * 0.015 };
});
function surfaceTone(p) {
  const n = unit(p);
  let tone = 0.96 + 0.025 * Math.sin(n[0] * 53 + n[1] * 29) * Math.cos(n[2] * 37);
  // Broad lunar maria plus smaller crater bowls and illuminated rims.
  const maria = [[-.42, -.33, .84, .38], [.35, .26, .9, .29], [-.4, .55, -.72, .31]];
  for (const [x, y, z, radius] of maria) {
    const distance = Math.hypot(n[0] - x, n[1] - y, n[2] - z);
    tone -= 0.19 * Math.exp(-distance * distance / (radius * radius));
  }
  for (const crater of CRATERS) {
    const d = Math.hypot(...subtract(n, crater.direction)) / crater.radius;
    if (d < 1.5) {
      tone -= 0.18 * Math.exp(-d * d * 2.8);
      tone += 0.065 * Math.exp(-((d - .95) ** 2) * 35);
    }
  }
  return clamp(tone, .58, 1);
}

/** Closed, outward-wound mesh. vertices/normals are [x,y,z]; faces are zero-based triples. */
export function buildMoonMesh(contour = []) {
  const radiusAt = outlineProfile(contour);
  const vertices = [[0, 0, -.75]];
  for (let band = 1; band < BANDS; band++) {
    const latitude = -Math.PI / 2 + Math.PI * band / BANDS;
    for (let slice = 0; slice < SEGMENTS; slice++) {
      const angle = TAU * slice / SEGMENTS;
      const radial = radiusAt(angle) * Math.cos(latitude);
      vertices.push([radial * Math.cos(angle), radial * Math.sin(angle), .75 * Math.sin(latitude)]);
    }
  }
  const frontPole = vertices.length;
  vertices.push([0, 0, .75]);
  const faces = [];
  for (let slice = 0; slice < SEGMENTS; slice++) {
    const next = (slice + 1) % SEGMENTS;
    faces.push([0, 1 + next, 1 + slice]);
    for (let ring = 0; ring < BANDS - 2; ring++) {
      const a = 1 + ring * SEGMENTS + slice;
      const b = 1 + ring * SEGMENTS + next;
      const c = a + SEGMENTS;
      const d = b + SEGMENTS;
      faces.push([a, b, c], [b, d, c]);
    }
    const last = 1 + (BANDS - 2) * SEGMENTS;
    faces.push([last + slice, last + next, frontPole]);
  }
  const normals = vertices.map(() => [0, 0, 0]);
  for (const face of faces) {
    const [a, b, c] = face.map(i => vertices[i]);
    const normal = cross(subtract(b, a), subtract(c, a));
    for (const index of face) for (let axis = 0; axis < 3; axis++) normals[index][axis] += normal[axis];
  }
  return { vertices, faces, normals: normals.map(unit), albedo: vertices.map(surfaceTone) };
}

/** Portable geometry, including the user's outline, without requiring a 3D library. */
export function moonOBJ(contour = []) {
  const mesh = buildMoonMesh(contour);
  return ['# Draw to Moon — player-created lunar sculpture', 'o HandDrawnMoon',
    ...mesh.vertices.map(v => `v ${v.map(n => n.toFixed(6)).join(' ')}`),
    ...mesh.normals.map(v => `vn ${v.map(n => n.toFixed(6)).join(' ')}`),
    's 1', ...mesh.faces.map(f => `f ${f.map(i => `${i + 1}//${i + 1}`).join(' ')}`), ''].join('\n');
}

const LIGHT = unit([-.6, -.7, 1.15]);
const color = t => {
  const low = [75, 57, 34], high = [255, 244, 201];
  return `rgb(${low.map((n, i) => Math.round(n + (high[i] - n) * clamp(t, 0, 1))).join(',')})`;
};

export class Moon3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: true });
    if (!this.context) throw new Error('Canvas 2D is unavailable');
    this.setContour([]);
  }
  setContour(contour = []) {
    this.mesh = buildMoonMesh(contour);
    this.radius = Math.max(1, ...this.mesh.vertices.map(v => Math.hypot(v[0], v[1])));
    const radiusAt = outlineProfile(contour);
    const surfacePoint = direction => {
      const n = unit(direction), radial = radiusAt(Math.atan2(n[1], n[0]));
      return [n[0] * radial, n[1] * radial, n[2] * .75];
    };
    this.craters = CRATERS.map(crater => {
      const n = crater.direction;
      const tangent = unit(cross(n, Math.abs(n[2]) < .9 ? [0, 0, 1] : [0, 1, 0]));
      const bitangent = cross(n, tangent);
      const ring = Array.from({ length: 24 }, (_, i) => {
        const a = i / 24 * TAU;
        return surfacePoint(n.map((v, axis) => v + crater.radius * (Math.cos(a) * tangent[axis] + Math.sin(a) * bitangent[axis])));
      });
      return { normal: unit([n[0], n[1], n[2] / .75]), ring };
    });
  }
  render({ rotation = 0, tilt = .2, phase = 0, zoom = 1, width: outputWidth, height: outputHeight, pixelRatio } = {}) {
    if (!this.canvas || !this.context) return;
    const canvas = this.canvas, ctx = this.context;
    const rect = canvas.getBoundingClientRect();
    const width = outputWidth || rect.width || canvas.clientWidth || 320;
    const height = outputHeight || rect.height || canvas.clientHeight || 320;
    const dpr = Math.min(pixelRatio || globalThis.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const size = Math.min(width, height) * .405 * clamp(zoom, .1, 2) / this.radius;
    const cx = width / 2, cy = height / 2;
    const cosZ = Math.cos(rotation), sinZ = Math.sin(rotation);
    const cosY = Math.cos(phase), sinY = Math.sin(phase);
    const cosX = Math.cos(tilt), sinX = Math.sin(tilt);
    const transform = ([x, y, z]) => {
      const x1 = x * cosZ - y * sinZ, y1 = x * sinZ + y * cosZ;
      const x2 = x1 * cosY + z * sinY, z2 = z * cosY - x1 * sinY;
      return [x2, y1 * cosX - z2 * sinX, y1 * sinX + z2 * cosX];
    };
    const vertices = this.mesh.vertices.map(transform);
    const points = vertices.map(v => [cx + v[0] * size, cy + v[1] * size]);
    const shades = this.mesh.normals.map((normal, i) => {
      const n = transform(normal);
      const diffuse = Math.max(0, n.reduce((sum, val, j) => sum + val * LIGHT[j], 0));
      const rim = (1 - Math.abs(n[2])) ** 3 * .08;
      return clamp((.18 + .82 * diffuse + rim) * this.mesh.albedo[i], .09, 1);
    });
    // An atmospheric glow sits outside the genuinely three-dimensional surface.
    const halo = ctx.createRadialGradient(cx, cy, size * .65, cx, cy, size * 1.32);
    halo.addColorStop(0, 'rgba(242,205,124,.12)'); halo.addColorStop(1, 'rgba(242,205,124,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    const visible = this.mesh.faces.filter(face => {
      const [a, b, c] = face.map(i => vertices[i]);
      return cross(subtract(b, a), subtract(c, a))[2] > 0;
    }).sort((a, b) => a.reduce((s, i) => s + vertices[i][2], 0) - b.reduce((s, i) => s + vertices[i][2], 0));
    for (const face of visible) {
      const [a, b, c] = face.map(i => points[i]);
      const [sa, sb, sc] = face.map(i => shades[i]);
      const dx1 = b[0] - a[0], dy1 = b[1] - a[1], dx2 = c[0] - a[0], dy2 = c[1] - a[1];
      const determinant = dx1 * dy2 - dx2 * dy1;
      let fill = color((sa + sb + sc) / 3);
      if (Math.abs(determinant) > .001) {
        const gx = ((sb - sa) * dy2 - (sc - sa) * dy1) / determinant;
        const gy = (dx1 * (sc - sa) - dx2 * (sb - sa)) / determinant;
        const lengthSquared = gx * gx + gy * gy;
        const low = Math.min(sa, sb, sc), high = Math.max(sa, sb, sc);
        if (lengthSquared > 1e-9 && high - low > .004) {
          const start = (low - sa) / lengthSquared, end = (high - sa) / lengthSquared;
          fill = ctx.createLinearGradient(a[0] + gx * start, a[1] + gy * start, a[0] + gx * end, a[1] + gy * end);
          fill.addColorStop(0, color(low)); fill.addColorStop(1, color(high));
        }
      }
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath();
      ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineWidth = .65;
      ctx.fill(); ctx.stroke();
    }
    // Project small crater bowls onto the same rotating surface. Their rims
    // foreshorten naturally near the limb instead of behaving as flat stickers.
    for (const crater of this.craters) {
      const normal = transform(crater.normal);
      if (normal[2] < .3) continue;
      const ring = crater.ring.map(transform).map(v => [cx + v[0] * size, cy + v[1] * size]);
      const light = Math.max(0, normal.reduce((s, n, i) => s + n * LIGHT[i], 0));
      ctx.beginPath(); ctx.moveTo(...ring[0]);
      for (const p of ring.slice(1)) ctx.lineTo(...p);
      ctx.closePath(); ctx.fillStyle = `rgba(83,65,37,${.065 + light * .055})`; ctx.fill();
      ctx.strokeStyle = `rgba(100,76,41,${.09 + light * .10})`; ctx.lineWidth = Math.max(.6, size * .006); ctx.stroke();
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= ring.length; i++) {
        const p = ring[i % ring.length], next = ring[(i + 1) % ring.length];
        if ((next[0] - p[0]) + (next[1] - p[1]) < 0) {
          if (!drawing) ctx.moveTo(...p);
          ctx.lineTo(...next); drawing = true;
        } else drawing = false;
      }
      ctx.strokeStyle = `rgba(255,243,195,${.12 + light * .22})`; ctx.lineWidth = Math.max(.7, size * .007); ctx.stroke();
    }
  }
  destroy() { this.context = null; this.canvas = null; this.mesh = null; this.craters = null; }
}
