export const G = 1;
export const SOFTENING = 0.025;
export const BASE_STEP = 1 / 240;
export const MAX_BODIES = 128;
export const MAX_MASS = 128000000;
export const BODY_TYPES = Object.freeze({
  planet: { name: "Planet", mass: 4, color: "#85bce5" },
  moon: { name: "Moon", mass: 0.1, color: "#d1d3c8" },
  star: { name: "Star", mass: 1000, color: "#f2cf81" }
});
export const radiusForMass = mass => 0.08 * Math.cbrt(mass);
const finite = (n, limit) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit;
function checkedBody(value, id) {
  if (!value || !finite(value.mass, MAX_MASS) || value.mass < 0.001) throw new Error("Mass must be between 0.001 and 128,000,000.");
  if (![value.x, value.y].every(n => finite(n, 1e8)) || ![value.vx, value.vy].every(n => finite(n, 10000))) throw new Error("Position or velocity is outside the sandbox's numeric range.");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 32 || typeof value.color !== "string" || !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error("Give each body a name and a valid color.");
  return { id, name: value.name.trim(), mass: value.mass, x: value.x, y: value.y, vx: value.vx, vy: value.vy, color: value.color, radius: radiusForMass(value.mass) };
}
export function validateScene(scene) {
  if (!scene || scene.version !== 1 || !Array.isArray(scene.bodies) || scene.bodies.length > MAX_BODIES || !finite(scene.time, 1e12) || scene.time < 0) throw new Error("This is not a valid Orbital Sandbox file.");
  const seen = new Set();
  const bodies = scene.bodies.map(body => {
    if (!Number.isInteger(body.id) || body.id < 1 || body.id > 1e9 || seen.has(body.id)) throw new Error("The file contains invalid or repeated body IDs.");
    seen.add(body.id); return checkedBody(body, body.id);
  });
  if (bodies.reduce((sum,body)=>sum+body.mass,0)>MAX_MASS) throw new Error("The system's total mass exceeds the numeric limit.");
  return { version: 1, time: scene.time, bodies };
}
export function circularSpeed(primaryMass, newMass, distance) {
  return Math.sqrt(G * (primaryMass + newMass) * distance * distance / (distance * distance + SOFTENING * SOFTENING) ** 1.5);
}
export class Simulation {
  constructor(scene = { version: 1, time: 0, bodies: [] }) { this.restore(scene); }
  restore(scene) {
    const checked = validateScene(scene);
    this.time = checked.time;
    this.bodies = checked.bodies.map(body => ({ ...body, trail: [{ x: body.x, y: body.y }] }));
    this.nextId = Math.max(0, ...this.bodies.map(body => body.id)) + 1;
    this.nextTrail = this.time + 1 / 45;
    this.resolveCollisions();
  }
  toJSON() { return { version: 1, time: this.time, bodies: this.bodies.map(({ trail, radius, ...body }) => ({ ...body })) }; }
  canPlace(x, y, mass, except = 0) {
    const radius = radiusForMass(mass);
    return this.bodies.every(body => body.id === except || Math.hypot(body.x - x, body.y - y) > body.radius + radius);
  }
  add(config) {
    if (this.bodies.length >= MAX_BODIES) throw new Error(`The sandbox can contain up to ${MAX_BODIES} bodies.`);
    if (this.nextId>1e9) this.nextId=1;
    while(this.bodies.some(body=>body.id===this.nextId))this.nextId++;
    const body = checkedBody({ vx: 0, vy: 0, ...config }, this.nextId);
    if (this.bodies.reduce((sum,item)=>sum+item.mass,0)+body.mass>MAX_MASS) throw new Error("The system's total mass exceeds the numeric limit.");
    if (!this.canPlace(body.x, body.y, body.mass)) throw new Error("Place the new body in free space.");
    this.nextId++; body.trail = [{ x: body.x, y: body.y }]; this.bodies.push(body); return body;
  }
  addOrbiter(primaryId, config, clockwise = false) {
    const primary = this.bodies.find(body => body.id === primaryId);
    if (!primary) throw new Error("Select a body to orbit first.");
    const dx = config.x - primary.x, dy = config.y - primary.y, distance = Math.hypot(dx, dy);
    if (distance <= primary.radius + radiusForMass(config.mass)) throw new Error("Start the orbit outside the selected body.");
    const speed = circularSpeed(primary.mass, config.mass, distance), sign = clockwise ? -1 : 1;
    const relativeX = -dy / distance * speed * sign, relativeY = dx / distance * speed * sign;
    const total = primary.mass + config.mass, vx = primary.vx, vy = primary.vy;
    // The two bodies receive opposite recoil so their common velocity is unchanged.
    const body = this.add({ ...config, vx: vx + relativeX * primary.mass / total, vy: vy + relativeY * primary.mass / total });
    primary.vx = vx - relativeX * body.mass / total; primary.vy = vy - relativeY * body.mass / total;
    return body;
  }
  edit(id, changes) {
    const body = this.bodies.find(item => item.id === id);
    if (!body) throw new Error("Select a body first.");
    const next = checkedBody({ ...body, ...changes }, id);
    if (this.bodies.reduce((sum,item)=>sum+item.mass,0)-body.mass+next.mass>MAX_MASS) throw new Error("The system's total mass exceeds the numeric limit.");
    Object.assign(body, next);
    body.trail = [{ x: body.x, y: body.y }];
    return this.resolveCollisions();
  }
  remove(id) { this.bodies = this.bodies.filter(body => body.id !== id); }
  clearTrails() { for (const body of this.bodies) body.trail = [{ x: body.x, y: body.y }]; }
  resolveCollisions() {
    const merged = [];
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) > a.radius + b.radius) continue;
        const keep = a.mass >= b.mass ? a : b, remove = keep === a ? b : a, total = a.mass + b.mass;
        for (const field of ["x", "y", "vx", "vy"]) keep[field] = (a[field] * a.mass + b[field] * b.mass) / total;
        keep.mass = total; keep.radius = radiusForMass(total); keep.trail = [{ x: keep.x, y: keep.y }];
        merged.push({ keep: keep.id, remove: remove.id }); this.bodies.splice(this.bodies.indexOf(remove), 1);
        changed = true; break outer;
      }
    }
    return merged;
  }
  accelerations() {
    const n = this.bodies.length, result = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = this.bodies[i], b = this.bodies[j], dx = b.x - a.x, dy = b.y - a.y;
      const force = G / (dx * dx + dy * dy + SOFTENING * SOFTENING) ** 1.5;
      result[2*i] += dx * force * b.mass; result[2*i+1] += dy * force * b.mass;
      result[2*j] -= dx * force * a.mass; result[2*j+1] -= dy * force * a.mass;
    }
    return result;
  }
  safeStep(remaining) {
    let step = Math.min(BASE_STEP, remaining);
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j], dx = b.x - a.x, dy = b.y - a.y, r2 = dx*dx + dy*dy;
      step = Math.min(step, 0.035 / Math.sqrt(G * (a.mass + b.mass) / (r2 + SOFTENING * SOFTENING) ** 1.5));
      const vx = b.vx - a.vx, vy = b.vy - a.vy, dot = dx*vx + dy*vy, v2 = vx*vx + vy*vy, contact = a.radius + b.radius;
      if (dot < 0 && v2 > 0 && r2 - dot*dot/v2 < contact*contact*1.1) step = Math.min(step, 0.2 * Math.max(Math.sqrt(r2) - contact, contact * 0.1) / Math.sqrt(v2));
    }
    return Math.min(remaining, Math.max(1e-7, step));
  }
  step(dt) {
    const merged = this.resolveCollisions(), first = this.accelerations();
    this.bodies.forEach((body, i) => {
      body.vx += first[2*i] * dt/2; body.vy += first[2*i+1] * dt/2;
      body.x += body.vx * dt; body.y += body.vy * dt;
    });
    merged.push(...this.resolveCollisions());
    const last = this.accelerations();
    this.bodies.forEach((body, i) => { body.vx += last[2*i] * dt/2; body.vy += last[2*i+1] * dt/2; });
    this.time += dt;
    if (this.time >= this.nextTrail) {
      for (const body of this.bodies) { body.trail.push({ x: body.x, y: body.y }); if (body.trail.length > 900) body.trail.shift(); }
      this.nextTrail = this.time + 1/45;
    }
    return merged;
  }
  advance(seconds, maxSteps = 256, deadline = Infinity) {
    if (!Number.isFinite(seconds) || seconds<0 || seconds>60) throw new Error("Invalid time interval.");
    let remaining = seconds, steps = 0;
    const merged = [];
    while (remaining > 1e-12 && steps < maxSteps) {
      if (steps % 8 === 0 && performance.now() > deadline) break;
      const dt = this.safeStep(remaining); merged.push(...this.step(dt)); remaining -= dt; steps++;
    }
    return { advanced: seconds - remaining, remaining, steps, merged };
  }
  invariants() {
    let mass = 0, px = 0, py = 0, angular = 0, energy = 0;
    for (const a of this.bodies) { mass += a.mass; px += a.mass*a.vx; py += a.mass*a.vy; angular += a.mass*(a.x*a.vy-a.y*a.vx); energy += a.mass*(a.vx*a.vx+a.vy*a.vy)/2; }
    for (let i = 0; i < this.bodies.length; i++) for (let j = i+1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j]; energy -= G*a.mass*b.mass / Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+SOFTENING**2);
    }
    return { mass, px, py, angular, energy };
  }
}
function recenter(simulation) {
  const total = simulation.invariants().mass;
  if (!total) return;
  const center = { x: 0, y: 0, vx: 0, vy: 0 };
  for (const body of simulation.bodies) for (const key of Object.keys(center)) center[key] += body[key] * body.mass / total;
  for (const body of simulation.bodies) { for (const key of Object.keys(center)) body[key] -= center[key]; body.trail = [{ x: body.x, y: body.y }]; }
}
export function preset(name) {
  const simulation = new Simulation();
  const body = (name, mass, x, y, color) => ({ name, mass, x, y, color });
  if (name === "solar") {
    const sun = simulation.add(body("Sun", 1000, 0, 0, "#f2cf81"));
    simulation.addOrbiter(sun.id, body("Ember", 0.7, 5, 0, "#e8a181"));
    const planet = simulation.addOrbiter(sun.id, body("Tidal", 4, 9*Math.cos(1.2), 9*Math.sin(1.2), "#85bce5"));
    simulation.addOrbiter(planet.id, body("Luna", 0.06, planet.x+0.28, planet.y, "#d1d3c8"));
    simulation.addOrbiter(sun.id, body("Verdant", 7, 15*Math.cos(3.5), 15*Math.sin(3.5), "#acd298"));
  } else if (name === "moon") {
    const planet = simulation.add(body("Planet", 100, 0, 0, "#85bce5"));
    simulation.addOrbiter(planet.id, body("Moon", 1, 2.8, 0, "#d1d3c8"));
  } else if (name === "binary") {
    const star = simulation.add(body("Amber", 400, -4, 0, "#f2cf81"));
    simulation.addOrbiter(star.id, body("Azure", 250, 4, 0, "#9fc9f3"));
  } else if (name !== "empty") throw new Error("Unknown starting system.");
  recenter(simulation); return simulation.toJSON();
}
export function fitCamera(bodies, width, height) {
  if (!bodies.length) return { x: 0, y: 0, span: 40 };
  const mass = bodies.reduce((sum,b)=>sum+b.mass,0), x = bodies.reduce((sum,b)=>sum+b.x*b.mass/mass,0), y = bodies.reduce((sum,b)=>sum+b.y*b.mass/mass,0);
  const radius = Math.max(2, ...bodies.map(body=>Math.hypot(body.x-x,body.y-y)+body.radius));
  return { x, y, span: Math.min(1e7,Math.max(8, radius*2.5*Math.max(1,height/width))) };
}
export const screenToWorld = (camera, point, width, height) => ({ x: camera.x+(point.x-width/2)*camera.span/height, y: camera.y+(height/2-point.y)*camera.span/height });
export function zoomCamera(camera, factor, point, width, height) {
  const anchor = screenToWorld(camera,point,width,height), span = Math.max(0.5,Math.min(1e7,camera.span*factor));
  return { x: anchor.x-(point.x-width/2)*span/height, y: anchor.y-(height/2-point.y)*span/height, span };
}
