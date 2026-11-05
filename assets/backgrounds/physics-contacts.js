const GAP = 0.05;
const EPSILON = 1e-7;

export const SURFACE = Object.freeze({ restitution: 0.65, friction: 0.65, frictionStatic: 1.2, slop: 0 });
export const MATERIAL = Object.freeze({ ...SURFACE, frictionAir: 0.002 });

export function chooseShape(roll = Math.random()) {
  return roll < 0.45 ? "circle" : roll < 0.9 ? "square" : "triangle";
}

function pointVelocity(Matter, body, point) {
  const velocity = Matter.Body.getVelocity(body);
  const spin = Matter.Body.getAngularVelocity(body);
  return { x: velocity.x - spin * (point.y - body.position.y), y: velocity.y + spin * (point.x - body.position.x) };
}

export function captureImpact(Matter, pair) {
  const collision = pair.collision;
  const a = collision.bodyA;
  const b = collision.bodyB;
  const point = { x: 0, y: 0 };
  for (let i = 0; i < collision.supportCount; i += 1) {
    point.x += collision.supports[i].x / collision.supportCount;
    point.y += collision.supports[i].y / collision.supportCount;
  }
  const va = pointVelocity(Matter, a, point), vb = pointVelocity(Matter, b, point);
  const normal = { ...collision.normal };
  const approach = -((va.x - vb.x) * normal.x + (va.y - vb.y) * normal.y);
  // Quiet contacts should settle; new impacts retain their intended rebound.
  return approach > 1 ? { a, b, point, normal, target: approach * pair.restitution } : null;
}

export function finishContacts(Matter, impacts, pairs, delta) {
  for (const impact of impacts) {
    if (!impact) continue;
    const { a, b, point, normal, target } = impact;
    const va = pointVelocity(Matter, a, point), vb = pointVelocity(Matter, b, point);
    const speed = (va.x - vb.x) * normal.x + (va.y - vb.y) * normal.y;
    const armA = (point.x - a.position.x) * normal.y - (point.y - a.position.y) * normal.x;
    const armB = (point.x - b.position.x) * normal.y - (point.y - b.position.y) * normal.x;
    const massA = a.isStatic ? 0 : a.inverseMass;
    const massB = b.isStatic ? 0 : b.inverseMass;
    const inertiaA = a.isStatic ? 0 : a.inverseInertia;
    const inertiaB = b.isStatic ? 0 : b.inverseInertia;
    const denominator = massA + massB + armA * armA * inertiaA + armB * armB * inertiaB;
    if (!denominator || speed >= target) continue;
    // Matter can lose rebound when two corners contact a plane together. Apply
    // only the missing normal impulse, including the contact's rotational mass.
    const impulse = (target - speed) / denominator;
    for (const [body, sign, inverseMass, inverseInertia, arm] of [[a, 1, massA, inertiaA, armA], [b, -1, massB, inertiaB, armB]]) {
      if (body.isStatic) continue;
      Matter.Sleeping.set(body, false);
      const velocity = Matter.Body.getVelocity(body);
      Matter.Body.setVelocity(body, { x: velocity.x + normal.x * impulse * sign * inverseMass, y: velocity.y + normal.y * impulse * sign * inverseMass });
      Matter.Body.setAngularVelocity(body, Matter.Body.getAngularVelocity(body) + arm * impulse * sign * inverseInertia);
    }
  }
  const damped = new Set();
  for (const pair of pairs) {
    if (!pair.isActive) continue;
    const { bodyA: a, bodyB: b, normal, tangent } = pair.collision;
    const body = a.isStatic ? b : b.isStatic ? a : null;
    if (!body || body.isSleeping || damped.has(body.id)) continue;
    const velocity = Matter.Body.getVelocity(body);
    if (Math.abs(velocity.x * normal.x + velocity.y * normal.y) > 1) continue;
    // Surface resistance slows sliding and rolling without braking free flight.
    const along = velocity.x * tangent.x + velocity.y * tangent.y;
    const reduction = along * (1 - Math.exp(-3.5 * delta / 1000));
    Matter.Body.setVelocity(body, { x: velocity.x - tangent.x * reduction, y: velocity.y - tangent.y * reduction });
    Matter.Body.setAngularVelocity(body, Matter.Body.getAngularVelocity(body) * Math.exp(-4 * delta / 1000));
    damped.add(body.id);
  }
}

export function motionSubsteps(Matter, objects, delta) {
  let steps = 1;
  for (const body of objects) {
    if (body.isSleeping) continue;
    const size = body.plugin.size;
    const velocity = Matter.Body.getVelocity(body);
    const travel = (Math.hypot(velocity.x, velocity.y) + Math.abs(Matter.Body.getAngularVelocity(body)) * size * Math.SQRT2) * delta / (1000 / 60);
    steps = Math.max(steps, Math.ceil(travel / (size * 0.4)));
  }
  return steps;
}

export function createCircle(Matter, x, y, radius, options) {
  // Matter's regular circle mesh is inscribed, which lets the painted circle
  // enter other bodies. A circumscribed mesh contains every painted pixel edge.
  const sides = 48;
  const body = Matter.Bodies.polygon(x, y, sides, (radius + GAP) / Math.cos(Math.PI / sides), options);
  body.circleRadius = radius;
  return body;
}

export function createPill(Matter, rect, options) {
  const radius = rect.height / 2;
  const step = Math.PI / 16;
  const outer = radius / Math.cos(step / 2);
  const vertices = [];
  for (const side of [1, -1]) {
    const centerX = side * (rect.width / 2 - radius);
    const start = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    for (let i = 0; i < 16; i += 1) {
      const angle = start + (i + 0.5) * step;
      vertices.push({ x: centerX + outer * Math.cos(angle), y: outer * Math.sin(angle) });
    }
  }
  return Matter.Bodies.fromVertices(rect.x + rect.width / 2, rect.y + radius, vertices, options);
}

export function collisionPairs(Matter, objects, solids) {
  const pairs = [];
  for (let i = 0; i < objects.length; i += 1) {
    for (const collision of Matter.Query.collides(objects[i], solids.concat(objects.slice(0, i)))) {
      if (collision.depth > EPSILON) pairs.push(collision);
    }
  }
  return pairs;
}

export function separateBodies(Matter, objects, solids, passes = 40) {
  let corrections = 0;
  for (let pass = 0; pass < passes; pass += 1) {
    const pairs = collisionPairs(Matter, objects, solids);
    if (!pairs.length) return { valid: true, corrections };
    for (const pair of pairs) {
      // Earlier corrections in this pass may have already separated this pair.
      const collision = Matter.Collision.collides(pair.bodyA, pair.bodyB);
      if (!collision || collision.depth <= EPSILON) continue;
      const a = collision.bodyA;
      const b = collision.bodyB;
      const weightA = a.isStatic ? 0 : a.inverseMass;
      const weightB = b.isStatic ? 0 : b.inverseMass;
      const weight = weightA + weightB;
      if (!weight) continue;
      const distance = collision.depth + GAP;
      for (const [body, share] of [[a, weightA / weight], [b, -weightB / weight]]) {
        if (!share) continue;
        Matter.Body.setPosition(body, {
          x: body.position.x + collision.normal.x * distance * share,
          y: body.position.y + collision.normal.y * distance * share
        });
        body.positionImpulse.x = body.positionImpulse.y = 0;
      }
      corrections += 1;
    }
  }
  return { valid: collisionPairs(Matter, objects, solids).length === 0, corrections };
}
