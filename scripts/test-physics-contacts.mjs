import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const P = require("../assets/vendor/planck/planck.min.js");
const source = await readFile(new URL("../assets/backgrounds/physics-world.js", import.meta.url), "utf8");
const { MATERIAL, chooseShape, createSimulation } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const close = (actual, expected, tolerance, message) => assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const make = (sim, shape, size, x, y, velocity = { x: 0, y: 0 }, angle = 0, material = MATERIAL) => sim.addShape({ ...sim.geometry(shape, size), x, y, angle }, velocity, material);
const energy = body => { const v = body.getLinearVelocity(); return 0.5 * body.getMass() * v.lengthSquared() + 0.5 * body.getInertia() * body.getAngularVelocity() ** 2; };

const choices = { circle: 0, square: 0, triangle: 0 };
for (let i = 0; i < 1000; i += 1) choices[chooseShape((i + 0.5) / 1000)] += 1;
assert.deepEqual(choices, { circle: 450, square: 450, triangle: 100 });

// A frictionless impact has an analytic result in the plane's coordinates.
// Cover mirrored diagonals, both tangent directions, flat faces, and tiny shapes.
let impacts = 0;
for (const angle of [-Math.PI / 3, -Math.PI / 4, -Math.PI / 6, Math.PI / 6, Math.PI / 4, Math.PI / 3]) {
  for (const shape of ["circle", "square", "triangle"]) for (const size of [5, 20, 40]) for (const tangentSpeed of [-240, 0, 240]) {
    const sim = createSimulation(P, { gravity: 0 });
    sim.layout([], { width: 2000, height: 1400 });
    const material = { density: 1, friction: 0, restitution: 0.65 };
    sim.addStatic({ x: 200, y: 690, width: 1600, height: 20, angle, label: "ramp", kind: "wall" }, material);
    const n = { x: Math.sin(angle), y: -Math.cos(angle) }, t = { x: Math.cos(angle), y: Math.sin(angle) };
    const body = make(sim, shape, size, 1000 + n.x * 120, 700 + n.y * 120, { x: -n.x * 600 + t.x * tangentSpeed, y: -n.y * 600 + t.y * tangentSpeed }, angle, material);
    body.setLinearDamping(0); body.setAngularDamping(0);
    const beforeEnergy = energy(body);
    let hit = false;
    for (let i = 0; i < 80; i += 1) {
      sim.step(1 / 120);
      if (!sim.labels.get("ramp")) continue;
      const velocity = sim.view(body).velocity;
      close(dot(velocity, n), 390, 1, "Rebound must follow the actual diagonal normal");
      close(dot(velocity, t), tangentSpeed, 0.1, "Frictionless impact must preserve the tangent direction and speed");
      assert(energy(body) <= beforeEnergy * 1.000001, "A collision must not create kinetic energy");
      assert.equal(sim.snapshot().separation.overlaps, 0);
      hit = true; impacts += 1; break;
    }
    assert(hit, "Each analytic impact must actually contact the ramp");
  }
}

// Friction opposes contact slip, and must not reverse a non-spinning circle's
// tangential motion or make an aligned flat box slide up its incoming tangent.
for (const angle of [-Math.PI / 4, Math.PI / 4]) for (const shape of ["circle", "square"]) for (const direction of [-1, 1]) {
  const sim = createSimulation(P, { gravity: 0 });
  sim.layout([], { width: 2000, height: 1400 });
  sim.addStatic({ x: 200, y: 690, width: 1600, height: 20, angle, label: "ramp", kind: "wall" });
  const n = { x: Math.sin(angle), y: -Math.cos(angle) }, t = { x: Math.cos(angle), y: Math.sin(angle) };
  const body = make(sim, shape, 20, 1000 + n.x * 120, 700 + n.y * 120, { x: -n.x * 600 + t.x * 240 * direction, y: -n.y * 600 + t.y * 240 * direction }, angle);
  for (let i = 0; i < 80; i += 1) { sim.step(1 / 120); if (sim.labels.get("ramp")) break; }
  const along = dot(sim.view(body).velocity, t) * direction;
  assert(along >= -1e-5 && along < 240, "Friction must slow tangential travel without reversing it");
}

// Objects placed at rest on mirrored inclines must accelerate downhill.
for (const angle of [-Math.PI / 4, -Math.PI / 6, Math.PI / 6, Math.PI / 4]) for (const shape of ["circle", "square"]) {
  const sim = createSimulation(P);
  sim.layout([], { width: 1600, height: 1200 });
  sim.addStatic({ x: 100, y: 590, width: 1400, height: 20, angle, label: "slope", kind: "wall" });
  const n = { x: Math.sin(angle), y: -Math.cos(angle) }, t = { x: Math.cos(angle), y: Math.sin(angle) };
  const body = make(sim, shape, 20, 800 + n.x * 31, 600 + n.y * 31, undefined, angle);
  for (let i = 0; i < 96; i += 1) sim.step(1 / 120);
  assert(dot(sim.view(body).velocity, t) * Math.sign(angle) > 20, "Slope motion must follow gravity downhill");
  assert.equal(sim.snapshot().separation.overlaps, 0);
}

// Off-centre circle impacts must deflect the two bodies in opposite directions,
// conserve momentum, and dissipate rather than add energy.
for (const direction of [-1, 1]) {
  const sim = createSimulation(P, { gravity: 0 });
  sim.layout([], { width: 1600, height: 1000 });
  const a = make(sim, "circle", 20, 400, 400, { x: 600, y: 0 });
  const b = make(sim, "circle", 20, 500, 400 + direction * 25);
  for (const body of [a, b]) { body.setLinearDamping(0); body.setAngularDamping(0); }
  const momentum = a.getMass() * a.getLinearVelocity().x, beforeEnergy = energy(a) + energy(b);
  for (let i = 0; i < 80; i += 1) { sim.step(1 / 120); if (sim.contacts.shapes) break; }
  const va = a.getLinearVelocity(), vb = b.getLinearVelocity();
  assert(va.y * direction < 0 && vb.y * direction > 0, "Oblique hits must deflect away from the contact");
  close(a.getMass() * va.x + b.getMass() * vb.x, momentum, 1e-7, "Horizontal momentum");
  close(a.getMass() * va.y + b.getMass() * vb.y, 0, 1e-7, "Vertical momentum");
  assert(energy(a) + energy(b) <= beforeEnergy * 1.000001);
}

for (const shape of ["circle", "square", "triangle"]) {
  const sim = createSimulation(P);
  sim.layout([], { width: 700, height: 900 });
  const body = make(sim, shape, 20, 150, 200);
  let bounces = 0, previous = 0;
  for (let i = 0; i < 840; i += 1) {
    sim.step(1 / 120);
    const vy = sim.view(body).velocity.y;
    if (previous > 30 && vy < -20) bounces += 1;
    previous = vy;
    assert.equal(sim.snapshot().separation.overlaps, 0);
  }
  assert(bounces >= 3, `${shape} should retain multiple visible bounces before settling`);
}

for (const shape of ["circle", "square", "triangle"]) for (const direction of [-1, 1]) {
  const sim = createSimulation(P, { gravity: 0 });
  sim.layout([{ x: 50, y: 250, width: 400, height: 1, kind: "separator", label: "separator" }], { width: 500, height: 600 });
  const body = make(sim, shape, 5, 250, direction === 1 ? 238 : 263, { x: 0, y: direction * 1800 });
  for (let i = 0; i < 6; i += 1) {
    sim.step(1 / 120);
    const view = sim.view(body);
    assert(direction === 1 ? view.y < 250 : view.y > 251, "Continuous collision must prevent passing through a one-pixel separator");
    assert.equal(sim.snapshot().separation.overlaps, 0);
  }
  assert(body.getLinearVelocity().y * direction < 0, "Fast separator impacts must rebound");
}

for (const shape of ["circle", "square"]) {
  const sim = createSimulation(P);
  sim.layout([], { width: 3000, height: 600 });
  const body = make(sim, shape, 20, 100, 579.4, { x: 180, y: 0 });
  for (let i = 0; i < 240; i += 1) sim.step(1 / 120);
  assert(Math.abs(sim.view(body).velocity.x) < 40, "Ground contact must visibly slow sliding and rolling");
}

const pile = createSimulation(P);
pile.layout([], { width: 600, height: 600 });
for (let i = 0; i < 24; i += 1) {
  const shape = ["circle", "square", "triangle"][i % 3];
  const preview = pile.findFree(pile.geometry(shape, 12 + i % 4 * 3), { x: 100 + i % 6 * 70, y: 70 + Math.floor(i / 6) * 70 });
  assert(preview);
  pile.addShape(preview, { x: (i % 2 ? 1 : -1) * 400, y: 100 });
}
for (let i = 0; i < 1200; i += 1) {
  pile.step(1 / 120);
  const state = pile.snapshot();
  assert.equal(state.separation.overlaps, 0, `Painted outlines must not overlap, step ${i}`);
  for (const body of state.bodies) assert(body.radius ? body.y + body.radius <= 600.001 : body.vertices.every(v => v.y <= 600.001), "The viewport floor must contain every painted shape");
}
pile.layout([{ x: 30, y: 400, width: 240, height: 1, kind: "separator", label: "separator" }], { width: 300, height: 500 });
assert.equal(pile.snapshot().separation.overlaps, 0, "Resized scenes must keep free spawn positions");
console.log(`PASS ${impacts} analytic diagonal impacts, mirrored friction/slopes, oblique momentum/energy, repeated rebounds, continuous thin-line collision, rolling/sliding, and 1200 dense-pile steps.`);
