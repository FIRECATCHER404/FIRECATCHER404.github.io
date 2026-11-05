import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Matter = require("../assets/vendor/matter-js/matter.min.js");
const source = await readFile(new URL("../assets/backgrounds/physics-contacts.js", import.meta.url), "utf8");
const { MATERIAL, SURFACE, captureImpact, chooseShape, collisionPairs, createCircle, createPill, finishContacts, motionSubsteps, separateBodies } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { Bodies, Body, Composite, Engine, Vertices } = Matter;

const choices = { circle: 0, square: 0, triangle: 0 };
for (let i = 0; i < 1000; i += 1) choices[chooseShape((i + 0.5) / 1000)] += 1;
assert.deepEqual(choices, { circle: 450, square: 450, triangle: 100 });

function contactStepper(engine, objects, solids) {
  let impacts = [];
  Matter.Events.on(engine, "collisionStart", event => impacts.push(...event.pairs.map(pair => captureImpact(Matter, pair))));
  return () => {
    const count = motionSubsteps(Matter, objects, 1000 / 240);
    let corrections = 0;
    for (let i = 0; i < count; i += 1) {
      impacts = [];
      Engine.update(engine, 1000 / 240 / count);
      finishContacts(Matter, impacts, engine.pairs.list, 1000 / 240 / count);
      const result = separateBodies(Matter, objects, solids);
      assert(result.valid, "Contacts must remain separated after bouncing");
      corrections += result.corrections;
    }
    return corrections;
  };
}

for (const shape of ["circle", "square", "triangle"]) {
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  engine.gravity.scale = 0.0008;
  const floor = Bodies.rectangle(500, 550, 2000, 100, { ...SURFACE, isStatic: true });
  const options = { ...MATERIAL, plugin: { size: 20 } };
  const body = shape === "circle" ? createCircle(Matter, 100, 100, 20, options) : shape === "square" ? Bodies.rectangle(100, 100, 40, 40, options) : Bodies.polygon(100, 100, 3, 80 / 3, options);
  Composite.add(engine.world, [floor, body]);
  const step = contactStepper(engine, [body], [floor]);
  let bounced = false, apex = 500, impactSpeed = 0, reboundSpeed = 0;
  for (let i = 0; i < 720; i += 1) {
    const before = Body.getVelocity(body).y;
    step();
    const after = Body.getVelocity(body).y;
    if (!bounced && before > 1 && after < -1) {
      bounced = true; impactSpeed = before; reboundSpeed = -after;
    }
    if (bounced) apex = Math.min(apex, body.position.y);
  }
  assert(bounced && 480 - apex > 40, `${shape} must visibly rebound after falling`);
  if (shape !== "triangle") assert(reboundSpeed / impactSpeed > 0.6 && reboundSpeed / impactSpeed < 0.7, "A flat face and a circle should retain the configured normal rebound");
}

const rolling = [];
for (const grounded of [false, true]) {
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  engine.gravity.scale = grounded ? 0.0008 : 0;
  const floor = Bodies.rectangle(1000, 550, 4000, 100, { ...SURFACE, isStatic: true });
  const circle = createCircle(Matter, 100, 479.9, 20, { ...MATERIAL, plugin: { size: 20 } });
  Body.setVelocity(circle, { x: 6, y: 0 });
  Body.setAngularVelocity(circle, 0.3);
  Composite.add(engine.world, grounded ? [floor, circle] : [circle]);
  const step = contactStepper(engine, [circle], grounded ? [floor] : []);
  for (let i = 0; i < 360; i += 1) step();
  rolling.push({ speed: Body.getVelocity(circle).x, spin: Body.getAngularVelocity(circle) });
}
assert(rolling[1].speed < rolling[0].speed / 4, "Contact resistance must slow rolling much more than free flight");
assert(rolling[1].spin < rolling[0].spin / 4, "Surface contact must also resist rolling rotation");

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
const floor = Bodies.rectangle(250, floorY + 100, 700, 200, { ...SURFACE, isStatic: true });
const walls = [floor, Bodies.rectangle(-50, 250, 100, 700, { ...SURFACE, isStatic: true }), Bodies.rectangle(550, 250, 100, 700, { ...SURFACE, isStatic: true })];
const engine = Engine.create({ positionIterations: 10, velocityIterations: 8, enableSleeping: true });
engine.gravity.scale = 0.0008;
const shapes = [];
for (let i = 0; i < 18; i += 1) {
  const x = 90 + i % 6 * 60;
  const y = 70 + Math.floor(i / 6) * 75;
  const options = { ...MATERIAL, plugin: { size: 18 } };
  const body = i % 3 === 0 ? createCircle(Matter, x, y, 18, options) : i % 3 === 1 ? Bodies.rectangle(x, y, 36, 36, options) : Bodies.polygon(x, y, 3, 24, options);
  Body.setVelocity(body, { x: i % 2 ? 14 : -14, y: 12 });
  shapes.push(body);
}
Composite.add(engine.world, [...walls, ...shapes]);
const stepPile = contactStepper(engine, shapes, walls);
let corrections = 0;
for (let i = 0; i < 2400; i += 1) {
  corrections += stepPile();
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
console.log(`PASS shape weights, all-shape rebounds, rolling resistance, collision outlines, thin separators, and 2400 pile steps without penetration (${corrections} corrections).`);
