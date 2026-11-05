import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Matter = require("../assets/vendor/matter-js/matter.min.js");
const source = await readFile(new URL("../assets/backgrounds/physics-contacts.js", import.meta.url), "utf8");
const { collisionPairs, createCircle, createPill, motionSubsteps, separateBodies } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { Bodies, Body, Composite, Engine, Vertices } = Matter;

// Independent SAT check; do not use the same query that performs correction.
function intersects(a, b) {
  for (const polygon of [a.vertices, b.vertices]) {
    for (let i = 0; i < polygon.length; i += 1) {
      const next = polygon[(i + 1) % polygon.length];
      const dx = next.x - polygon[i].x;
      const dy = next.y - polygon[i].y;
      const length = Math.hypot(dx, dy);
      const axis = { x: -dy / length, y: dx / length };
      const project = body => body.vertices.map(v => v.x * axis.x + v.y * axis.y);
      const pa = project(a), pb = project(b);
      if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= 1e-6) return false;
    }
  }
  return true;
}

for (const radius of [5, 15, 40]) {
  const circle = createCircle(Matter, 100, 100, radius, { slop: 0 });
  for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
    assert(Vertices.contains(circle.vertices, { x: 100 + radius * Math.cos(angle), y: 100 + radius * Math.sin(angle) }), "The collision mesh must contain the painted circle");
  }
}
const a = createCircle(Matter, 100, 100, 40, { slop: 0 });
const b = createCircle(Matter, 179.7, 100, 40, { slop: 0 });
assert(collisionPairs(Matter, [a, b], []).length, "Detect the previously missed 0.3px painted-circle overlap");
assert(separateBodies(Matter, [a, b], []).valid);
assert(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) >= 80);

const pill = createPill(Matter, { x: 0, y: 0, width: 250, height: 48 }, { isStatic: true, slop: 0 });
for (let angle = -Math.PI / 2; angle < Math.PI / 2; angle += 0.01) {
  assert(Vertices.contains(pill.vertices, { x: 226 + 24 * Math.cos(angle), y: 24 + 24 * Math.sin(angle) }));
  assert(Vertices.contains(pill.vertices, { x: 24 - 24 * Math.cos(angle), y: 24 + 24 * Math.sin(angle) }));
}

for (const direction of [1, -1]) {
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  engine.gravity.y = 0;
  const line = Bodies.rectangle(100, 100.5, 200, 1, { isStatic: true, slop: 0 });
  const circle = createCircle(Matter, 100, direction === 1 ? 94.8 : 106.2, 5, { slop: 0, restitution: 0.42, plugin: { size: 5 } });
  Body.setVelocity(circle, { x: 0, y: 30 * direction });
  Composite.add(engine.world, [line, circle]);
  const count = motionSubsteps(Matter, [circle], 1000 / 240);
  assert(count > 1, "A fast small body needs substeps for a thin separator");
  for (let i = 0; i < count; i += 1) {
    Engine.update(engine, 1000 / 240 / count);
    assert(separateBodies(Matter, [circle], [line]).valid);
    assert(circle.vertices.every(v => direction === 1 ? v.y <= 100 + 1e-6 : v.y >= 101 - 1e-6), "Do not cross a one-pixel separator from either side");
  }
}

const floorY = 500;
const floor = Bodies.rectangle(250, floorY + 100, 700, 200, { isStatic: true, slop: 0 });
const walls = [floor, Bodies.rectangle(-50, 250, 100, 700, { isStatic: true, slop: 0 }), Bodies.rectangle(550, 250, 100, 700, { isStatic: true, slop: 0 })];
const engine = Engine.create({ positionIterations: 10, velocityIterations: 8, enableSleeping: true });
engine.gravity.scale = 0.0008;
const shapes = [];
for (let i = 0; i < 18; i += 1) {
  const x = 90 + i % 6 * 60;
  const y = 70 + Math.floor(i / 6) * 75;
  const options = { restitution: 0.42, friction: 0.4, frictionAir: 0.004, slop: 0 };
  const body = i % 3 === 0 ? createCircle(Matter, x, y, 18, options) : i % 3 === 1 ? Bodies.rectangle(x, y, 36, 36, options) : Bodies.polygon(x, y, 3, 24, options);
  Body.setVelocity(body, { x: i % 2 ? 14 : -14, y: 12 });
  shapes.push(body);
}
Composite.add(engine.world, [...walls, ...shapes]);
let corrections = 0;
for (let i = 0; i < 2400; i += 1) {
  Engine.update(engine, 1000 / 240);
  const result = separateBodies(Matter, shapes, walls);
  assert(result.valid, `Pile separation failed on step ${i}`);
  corrections += result.corrections;
  assert.equal(collisionPairs(Matter, shapes, walls).length, 0, `Overlap on step ${i}`);
  for (const body of shapes) {
    assert(body.vertices.every(vertex => vertex.x >= -1e-6 && vertex.x <= 500 + 1e-6 && vertex.y <= floorY + 1e-6), "No shape may enter the floor or side walls");
  }
  if (i % 24 === 0) {
    for (let a = 0; a < shapes.length; a += 1) {
      for (let b = 0; b < a; b += 1) assert(!intersects(shapes[a], shapes[b]), "Independent polygon test found an overlap");
    }
  }
}
assert(corrections > 0, "The pile must exercise separation corrections");
console.log(`PASS collision outlines, thin-separator impacts from both sides, and 2400 pile steps with no pair or floor penetration (${corrections} corrections).`);
