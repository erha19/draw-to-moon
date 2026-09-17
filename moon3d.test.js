import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMoonMesh, moonOBJ } from './moon3d.js';

const circle = (radial = () => 1) => Array.from({ length: 64 }, (_, i) => {
  const angle = i / 64 * Math.PI * 2, radius = radial(angle);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
});

test('moon is a deterministic closed manifold with fewer than 1000 triangles', () => {
  const mesh = buildMoonMesh(circle());
  assert.ok(mesh.faces.length < 1000);
  assert.deepEqual(mesh, buildMoonMesh(circle()));
  const edges = new Map();
  for (const face of mesh.faces) for (let i = 0; i < 3; i++) {
    const edge = [face[i], face[(i + 1) % 3]].sort((a, b) => a - b).join(',');
    edges.set(edge, (edges.get(edge) || 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2));
  assert.equal(mesh.vertices.length - edges.size + mesh.faces.length, 2);
  assert.ok(mesh.vertices.some(v => v[2] === .75));
  assert.ok(mesh.vertices.some(v => v[2] === -.75));
});

test('all triangles face outward and vertex normals are normalized', () => {
  const mesh = buildMoonMesh(circle());
  for (const face of mesh.faces) {
    const [a, b, c] = face.map(i => mesh.vertices[i]);
    const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
    const normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    assert.ok(normal.reduce((sum, n, i) => sum + n * a[i], 0) > 0);
  }
  assert.ok(mesh.normals.every(n => Math.abs(Math.hypot(...n) - 1) < 1e-10));
});

test('equator retains the submitted irregular moon instead of replacing it with a sphere', () => {
  const contour = circle(a => 1 + .17 * Math.cos(a * 3));
  const mesh = buildMoonMesh(contour);
  const equator = mesh.vertices.filter(v => Math.abs(v[2]) < 1e-12);
  assert.equal(equator.length, 64);
  for (let i = 0; i < 64; i++) {
    assert.ok(Math.abs(equator[i][0] - contour[i].x) < 1e-10);
    assert.ok(Math.abs(equator[i][1] - contour[i].y) < 1e-10);
  }
  assert.deepEqual(buildMoonMesh([...contour].reverse()), mesh);
});

test('invalid outlines fall back safely and OBJ indices reference exported vertices', () => {
  const mesh = buildMoonMesh([{ x: NaN, y: 1 }, null]);
  assert.ok(mesh.vertices.flat().every(Number.isFinite));
  const obj = moonOBJ(circle());
  assert.equal(obj.split('\n').filter(line => line.startsWith('v ')).length, mesh.vertices.length);
  assert.equal(obj.split('\n').filter(line => line.startsWith('f ')).length, mesh.faces.length);
  for (const line of obj.split('\n').filter(line => line.startsWith('f '))) {
    for (const token of line.slice(2).split(' ')) {
      const [vertex, normal] = token.split('//').map(Number);
      assert.ok(vertex >= 1 && vertex <= mesh.vertices.length);
      assert.equal(vertex, normal);
    }
  }
});
