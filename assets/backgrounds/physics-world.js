export const PIXELS_PER_METER = 20;
export const MATERIAL = Object.freeze({ density: 1, friction: 0.4, restitution: 0.65 });
const CIRCLE_PADDING = 0.25;

export function chooseShape(roll = Math.random()) {
  return roll < 0.45 ? "circle" : roll < 0.9 ? "square" : "triangle";
}

function polygon(shape, size) {
  if (shape === "square") return [{ x: -size, y: -size }, { x: size, y: -size }, { x: size, y: size }, { x: -size, y: size }];
  return Array.from({ length: 3 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / 3;
    return { x: Math.cos(angle) * size * 4 / 3, y: Math.sin(angle) * size * 4 / 3 };
  });
}

function pill(width, height) {
  const r = height / 2, step = Math.PI / 16, outer = r / Math.cos(step / 2);
  return [1, -1].flatMap(side => Array.from({ length: 16 }, (_, i) => {
    const angle = (side === 1 ? -Math.PI / 2 : Math.PI / 2) + (i + 0.5) * step;
    return { x: side * (width / 2 - r) + outer * Math.cos(angle), y: outer * Math.sin(angle) };
  }));
}

export function verticesAt(geometry, point, angle = 0) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return geometry.vertices.map(v => ({ x: point.x + v.x * cos - v.y * sin, y: point.y + v.x * sin + v.y * cos }));
}

// Independent visible-geometry SAT, for placement verification and diagnostics.
// This excludes Box2D's collision skin, which surrounds the painted outlines.
export function penetration(a, b) {
  if (a.radius && b.radius) return Math.max(0, a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y));
  const axes = [];
  for (const item of [a, b]) if (!item.radius) {
    for (let i = 0; i < item.vertices.length; i += 1) {
      const v = item.vertices[i], w = item.vertices[(i + 1) % item.vertices.length];
      const length = Math.hypot(w.x - v.x, w.y - v.y);
      axes.push({ x: -(w.y - v.y) / length, y: (w.x - v.x) / length });
    }
  }
  const circle = a.radius ? a : b.radius ? b : null;
  if (circle) {
    const other = circle === a ? b : a;
    const closest = other.vertices.reduce((best, v) => Math.hypot(v.x - circle.x, v.y - circle.y) < Math.hypot(best.x - circle.x, best.y - circle.y) ? v : best);
    const length = Math.hypot(closest.x - circle.x, closest.y - circle.y);
    if (length > 1e-9) axes.push({ x: (closest.x - circle.x) / length, y: (closest.y - circle.y) / length });
  }
  let depth = Infinity;
  for (const axis of axes) {
    const project = item => {
      if (item.radius) { const center = item.x * axis.x + item.y * axis.y; return [center - item.radius, center + item.radius]; }
      const values = item.vertices.map(v => v.x * axis.x + v.y * axis.y);
      return [Math.min(...values), Math.max(...values)];
    };
    const pa = project(a), pb = project(b);
    const overlap = Math.min(pa[1], pb[1]) - Math.max(pa[0], pb[0]);
    if (overlap <= 0) return 0;
    depth = Math.min(depth, overlap);
  }
  return depth;
}

export function createSimulation(P, options = {}) {
  P.Settings.maxPolygonVertices = 32;
  return new PhysicsWorld(P, options);
}

class PhysicsWorld {
  constructor(P, { gravity = 800 } = {}) {
    this.P = P;
    this.world = new P.World({ gravity: P.Vec2(0, gravity / PIXELS_PER_METER), allowSleep: true });
    this.world.setContinuousPhysics(true);
    this.anchor = this.world.createBody();
    this.objects = [];
    this.solids = [];
    this.bounds = { width: 1, height: 1 };
    this.contacts = { text: 0, button: 0, separator: 0, wall: 0, shapes: 0 };
    this.labels = new Map();
    this.loads = new Map();
    this.nextId = 1;
    this.world.on("begin-contact", contact => {
      const a = contact.getFixtureA().getBody(), b = contact.getFixtureB().getBody();
      const solid = a.isStatic() ? a : b.isStatic() ? b : null;
      const kind = solid ? solid.getUserData().kind : "shapes";
      this.contacts[kind] += 1;
      if (solid) { const label = solid.getUserData().label; this.labels.set(label, (this.labels.get(label) || 0) + 1); }
    });
    this.world.on("post-solve", (contact, impulse) => {
      const a = contact.getFixtureA().getBody(), b = contact.getFixtureB().getBody();
      const body = a.isStatic() ? b : b.isStatic() ? a : null;
      if (!body || body.isStatic()) return;
      const load = impulse.normalImpulses.reduce((sum, value) => sum + value, 0);
      this.loads.set(body, (this.loads.get(body) || 0) + load);
    });
  }

  geometry(shape, size) {
    const { P } = this;
    const geometry = { shape, size };
    if (shape === "circle") {
      geometry.radius = size;
      geometry.fixture = new P.Circle((size + CIRCLE_PADDING) / PIXELS_PER_METER);
    } else {
      geometry.vertices = polygon(shape, size);
      geometry.fixture = new P.Polygon(geometry.vertices.map(v => P.Vec2(v.x / PIXELS_PER_METER, v.y / PIXELS_PER_METER)));
    }
    return geometry;
  }

  addStatic(rect, material = MATERIAL) {
    const { P } = this;
    const geometry = { shape: "polygon", vertices: rect.rounded ? pill(rect.width, rect.height) : polygon("square", 1).map(v => ({ x: v.x * rect.width / 2, y: v.y * rect.height / 2 })) };
    const body = this.world.createBody({ position: P.Vec2((rect.x + rect.width / 2) / PIXELS_PER_METER, (rect.y + rect.height / 2) / PIXELS_PER_METER), angle: rect.angle || 0 });
    body.createFixture(new P.Polygon(geometry.vertices.map(v => P.Vec2(v.x / PIXELS_PER_METER, v.y / PIXELS_PER_METER))), material);
    body.setUserData({ id: this.nextId++, kind: rect.kind || "wall", label: rect.label || "wall", rectangle: { ...rect }, geometry });
    this.solids.push(body);
    return body;
  }

  layout(rectangles, bounds, { scale = true, documentHeight = bounds.height } = {}) {
    const previous = this.bounds;
    this.bounds = { ...bounds };
    for (const body of this.solids) this.world.destroyBody(body);
    this.solids = [];
    for (const rect of rectangles) this.addStatic(rect);
    const extent = Math.max(bounds.height, documentHeight);
    for (const rect of [
      { x: -100, y: -100, width: 100, height: extent + 200 },
      { x: bounds.width, y: -100, width: 100, height: extent + 200 },
      { x: -100, y: -100, width: bounds.width + 200, height: 100 },
      { x: -100, y: bounds.height, width: bounds.width + 200, height: 100 }
    ]) this.addStatic({ ...rect, kind: "wall", label: "wall" });
    for (const body of this.objects) body.setActive(false);
    for (const body of [...this.objects]) {
      const data = body.getUserData(), position = body.getPosition();
      const point = { x: position.x * PIXELS_PER_METER * (scale ? bounds.width / previous.width : 1), y: position.y * PIXELS_PER_METER * (scale ? bounds.height / previous.height : 1) };
      const preview = this.findFree(data.geometry, point, body.getAngle());
      if (!preview) { this.remove(body); continue; }
      body.setTransform(this.P.Vec2(preview.x / PIXELS_PER_METER, preview.y / PIXELS_PER_METER), preview.angle);
      body.setActive(true);
      body.setAwake(true);
    }
  }

  findFree(geometry, point, angle = 0) {
    const { P } = this, radius = geometry.size * Math.SQRT2 + 1;
    const transform = new P.Transform(), aabb = new P.AABB();
    const preview = { ...geometry, angle, x: point.x, y: point.y };
    const check = (x, y) => {
      preview.x = Math.max(radius, Math.min(this.bounds.width - radius, x));
      preview.y = Math.max(radius, Math.min(this.bounds.height - radius, y));
      transform.set(P.Vec2(preview.x / PIXELS_PER_METER, preview.y / PIXELS_PER_METER), angle);
      geometry.fixture.computeAABB(aabb, transform, 0);
      let clear = true;
      this.world.queryAABB(aabb, fixture => {
        if (P.testOverlap(geometry.fixture, 0, fixture.getShape(), 0, transform, fixture.getBody().getTransform())) { clear = false; return false; }
        return true;
      });
      return clear;
    };
    if (check(point.x, point.y)) return preview;
    for (let distance = 8; distance <= 256; distance += 8) {
      const samples = Math.max(12, Math.ceil(distance / 6));
      for (let i = 0; i < samples; i += 1) {
        const angle = i * Math.PI * 2 / samples;
        if (check(point.x + distance * Math.cos(angle), point.y + distance * Math.sin(angle))) return preview;
      }
    }
    const stride = Math.max(12, geometry.size);
    for (let y = radius; y <= this.bounds.height - radius; y += stride) {
      for (let x = radius; x <= this.bounds.width - radius; x += stride) if (check(x, y)) return preview;
    }
    return null;
  }

  addShape(preview, velocity = { x: 0, y: 0 }, material = MATERIAL) {
    const { P } = this;
    const body = this.world.createDynamicBody({ position: P.Vec2(preview.x / PIXELS_PER_METER, preview.y / PIXELS_PER_METER), angle: preview.angle || 0, bullet: true, linearDamping: 0.025, angularDamping: 0.05 });
    body.createFixture(preview.fixture, material);
    body.setUserData({ id: this.nextId++, geometry: preview });
    body.setLinearVelocity(P.Vec2(velocity.x / PIXELS_PER_METER, velocity.y / PIXELS_PER_METER));
    // Rolling resistance is a torque constraint in the same solver as contacts.
    // It never rewrites a contact's normal/tangent velocity after the solve.
    body.rollingJoint = this.world.createJoint(new P.FrictionJoint({ maxForce: 0, maxTorque: 0 }, this.anchor, body, body.getPosition()));
    this.objects.push(body);
    return body;
  }

  remove(body) {
    this.objects.splice(this.objects.indexOf(body), 1);
    this.world.destroyBody(body);
  }

  step(delta) {
    for (const body of this.objects) body.rollingJoint.setMaxTorque(0);
    for (let contact = this.world.getContactList(); contact; contact = contact.getNext()) {
      if (!contact.isTouching()) continue;
      const a = contact.getFixtureA().getBody(), b = contact.getFixtureB().getBody();
      const body = a.isStatic() ? b : b.isStatic() ? a : null;
      if (!body || !body.getUserData()?.geometry.radius) continue;
      const manifold = contact.getWorldManifold(null);
      if (!manifold?.pointCount) continue;
      const v = body.getLinearVelocityFromWorldPoint(manifold.points[0]);
      if (Math.abs(v.x * manifold.normal.x + v.y * manifold.normal.y) > 0.5) continue;
      const radius = body.getUserData().geometry.radius / PIXELS_PER_METER;
      const weight = body.getMass() * this.world.getGravity().length();
      const load = Math.min(weight * 3, (this.loads.get(body) || 0) / delta);
      body.rollingJoint.setMaxTorque(0.08 * load * radius);
    }
    this.loads.clear();
    this.world.step(delta, 12, 12);
  }

  view(body) {
    const data = body.getUserData(), geometry = data.geometry, point = body.getPosition(), velocity = body.getLinearVelocity();
    const result = { id: data.id, shape: geometry.shape, size: geometry.size, x: point.x * PIXELS_PER_METER, y: point.y * PIXELS_PER_METER, angle: body.getAngle(), velocity: { x: velocity.x * PIXELS_PER_METER, y: velocity.y * PIXELS_PER_METER }, sleeping: !body.isAwake() };
    if (geometry.radius) result.radius = geometry.radius;
    else result.vertices = verticesAt(geometry, result, result.angle);
    return result;
  }

  snapshot() {
    const bodies = this.objects.map(body => this.view(body));
    const solids = this.solids.map(body => {
      const { kind, label, rectangle } = body.getUserData();
      return { ...this.view(body), kind, label, rectangle: { ...rectangle }, isStatic: true };
    });
    let maxOverlap = 0, overlaps = 0;
    for (let i = 0; i < bodies.length; i += 1) for (const other of [...solids, ...bodies.slice(0, i)]) {
      const depth = penetration(bodies[i], other);
      if (depth > 0.001) { overlaps += 1; maxOverlap = Math.max(maxOverlap, depth); }
    }
    return { bodies, solids, contacts: { ...this.contacts }, contactLabels: Object.fromEntries(this.labels), separation: { overlaps, maxOverlap } };
  }
}
