const GAP = 0.05;
const EPSILON = 1e-7;

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
