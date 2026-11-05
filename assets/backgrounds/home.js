import { INK, collectSolids, createStage, documentPoint, documentSize, exposeDiagnostics, isInteractable, watchLayout } from "./common.js";

async function loadMatter() {
  if (window.Matter) return window.Matter;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("../vendor/matter-js/matter.min.js", import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load background physics"));
    document.head.appendChild(script);
  });
  return window.Matter;
}

async function start() {
  const { Bodies, Body, Composite, Engine, Events, Query, Sleeping } = await loadMatter();
  const stage = createStage(document.getElementById("page-background"));
  const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  engine.gravity.y = 1;
  engine.gravity.scale = 0.0008;
  const objects = [];
  const previousPoses = new Map();
  const contacts = { text: 0, button: 0, wall: 0, shapes: 0 };
  const contactLabels = new Map();
  let world = documentSize();
  let solids = [];
  let frameId = 0;
  let lastTime = 0;
  let accumulator = 0;
  let drag = null;
  let lastSpawn = null;
  const fixedStep = 1000 / 240;
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const heldSize = () => Math.min(40, 5 + (performance.now() - drag.started) * 0.03);

  Events.on(engine, "collisionStart", event => {
    for (const pair of event.pairs) {
      const solid = pair.bodyA.isStatic ? pair.bodyA : pair.bodyB.isStatic ? pair.bodyB : null;
      if (!solid) { contacts.shapes += 1; continue; }
      const kind = solid.plugin.kind;
      if (kind in contacts) contacts[kind] += 1;
      contactLabels.set(solid.label, (contactLabels.get(solid.label) || 0) + 1);
    }
  });

  function clearPosition(body, point, obstacles = solids) {
    const radius = body.plugin.size * (body.plugin.shape === "square" ? Math.SQRT2 : 1.4) + 2;
    function test(x, y) {
      Body.setPosition(body, {
        x: clamp(x, radius, Math.max(radius, world.width - radius)),
        y: clamp(y, radius, Math.max(radius, world.height - radius))
      });
      return Query.collides(body, obstacles).length === 0;
    }
    if (test(point.x, point.y)) return;
    // A click on solid text, or a large held shape between buttons, is moved to
    // the nearest free space instead of leaving a body trapped inside the UI.
    const limit = Math.hypot(world.width, world.height);
    for (let distance = 8; distance < limit; distance += 8) {
      const samples = Math.max(12, Math.ceil(distance / 4));
      for (let index = 0; index < samples; index += 1) {
        const angle = index * Math.PI * 2 / samples;
        if (test(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance)) return;
      }
    }
    Body.setPosition(body, point);
  }

  function syncLayout() {
    stage.resize();
    const previous = world;
    world = documentSize();
    for (const solid of solids) Composite.remove(engine.world, solid);
    solids = collectSolids().map(rect => Bodies.rectangle(
      rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height,
      {
        isStatic: true, label: rect.label, restitution: 0.3, friction: 0.4,
        chamfer: rect.rounded ? { radius: Math.min(rect.height / 2, rect.width / 2) - 0.5 } : undefined,
        plugin: { kind: rect.label.startsWith("button:") ? "button" : "text", rectangle: rect }
      }
    ));
    const thickness = 100;
    const walls = [
      [-thickness / 2, world.height / 2, thickness, world.height + thickness * 2],
      [world.width + thickness / 2, world.height / 2, thickness, world.height + thickness * 2],
      [world.width / 2, -thickness / 2, world.width + thickness * 2, thickness],
      [world.width / 2, world.height + thickness / 2, world.width + thickness * 2, thickness]
    ].map(([x, y, width, height]) => Bodies.rectangle(x, y, width, height, {
      isStatic: true, label: "wall", restitution: 0.3, friction: 0.4, plugin: { kind: "wall" }
    }));
    solids.push(...walls);
    Composite.add(engine.world, solids);
    for (const body of objects) {
      const point = { x: body.position.x * world.width / previous.width, y: body.position.y * world.height / previous.height };
      clearPosition(body, point);
      previousPoses.set(body.id, { ...body.position, angle: body.angle });
      Sleeping.set(body, false);
    }
    wake();
  }

  function drawObject(body, alpha = 1) {
    const context = stage.context;
    const previous = previousPoses.get(body.id);
    context.save();
    if (previous && !body.isSleeping) {
      const x = previous.x + (body.position.x - previous.x) * alpha;
      const y = previous.y + (body.position.y - previous.y) * alpha;
      const angle = previous.angle + (body.angle - previous.angle) * alpha;
      context.translate(x, y);
      context.rotate(angle - body.angle);
      context.translate(-body.position.x, -body.position.y);
    }
    context.fillStyle = INK;
    context.beginPath();
    if (body.circleRadius) context.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
    else {
      body.vertices.forEach((vertex, index) => index ? context.lineTo(vertex.x, vertex.y) : context.moveTo(vertex.x, vertex.y));
      context.closePath();
    }
    context.fill();
    context.restore();
  }

  function makeShape(shape, point, size) {
    const options = {
      restitution: 0.42, friction: 0.4, frictionStatic: 0.7, frictionAir: 0.004, slop: 0.015,
      render: { fillStyle: INK, strokeStyle: INK },
      plugin: { shape, size, color: INK }
    };
    if (shape === "circle") return Bodies.circle(point.x, point.y, size, options, 32);
    if (shape === "square") return Bodies.rectangle(point.x, point.y, size * 2, size * 2, options);
    return Bodies.polygon(point.x, point.y, 3, size * 4 / 3, options);
  }

  function updatePreview() {
    const body = drag.preview;
    const size = heldSize();
    const scale = size / body.plugin.size;
    Body.scale(body, scale, scale);
    body.plugin.size = size;
    clearPosition(body, drag.start, [...solids, ...objects]);
    return body;
  }

  function render() {
    stage.clear();
    for (const body of objects) drawObject(body, accumulator / fixedStep);
    if (drag) {
      const preview = updatePreview();
      drawObject(preview);
      stage.context.strokeStyle = INK;
      stage.context.lineWidth = 2;
      stage.context.beginPath();
      stage.context.moveTo(preview.position.x, preview.position.y);
      stage.context.lineTo(drag.end.x, drag.end.y);
      stage.context.stroke();
    }
  }

  function clampSpeed(body) {
    const velocity = Body.getVelocity(body);
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > 30) Body.setVelocity(body, { x: velocity.x * 30 / speed, y: velocity.y * 30 / speed });
    const spin = Body.getAngularVelocity(body);
    if (Math.abs(spin) > 0.35) Body.setAngularVelocity(body, Math.sign(spin) * 0.35);
  }

  function frame(now) {
    frameId = 0;
    if (document.hidden) return;
    accumulator += Math.min(50, Math.max(0, now - lastTime));
    lastTime = now;
    while (accumulator >= fixedStep) {
      for (const body of objects) {
        previousPoses.set(body.id, { ...body.position, angle: body.angle });
        if (!body.isSleeping) {
          clampSpeed(body);
          Body.setAngularVelocity(body, Body.getAngularVelocity(body) * Math.pow(0.992, fixedStep / (1000 / 60)));
        }
      }
      Engine.update(engine, fixedStep);
      accumulator -= fixedStep;
    }
    render();
    if (drag || objects.some(body => !body.isSleeping)) frameId = requestAnimationFrame(frame);
    else accumulator = 0;
  }

  function wake() {
    if (frameId || document.hidden) return;
    lastTime = performance.now();
    frameId = requestAnimationFrame(frame);
  }

  function cancelDrag() {
    if (!drag) return;
    const id = drag.id;
    drag = null;
    if (stage.canvas.hasPointerCapture(id)) stage.canvas.releasePointerCapture(id);
    wake();
  }

  document.addEventListener("pointerdown", event => {
    if (drag || !event.isPrimary || event.button !== 0 || isInteractable(event.target)) return;
    event.preventDefault();
    const point = documentPoint(event);
    drag = {
      id: event.pointerId, pointerType: event.pointerType, start: point, end: point,
      started: performance.now(), shape: ["circle", "square", "triangle"][Math.floor(Math.random() * 3)]
    };
    drag.preview = makeShape(drag.shape, point, 5);
    stage.canvas.setPointerCapture(event.pointerId);
    wake();
  });
  document.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.end = documentPoint(event);
    wake();
  });
  document.addEventListener("pointerup", event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.end = documentPoint(event);
    const body = updatePreview();
    const velocity = { x: (drag.end.x - drag.start.x) * 0.1, y: (drag.end.y - drag.start.y) * 0.1 };
    Body.setVelocity(body, velocity);
    clampSpeed(body);
    lastSpawn = { shape: drag.shape, size: body.plugin.size, origin: { ...drag.start }, velocity: { ...Body.getVelocity(body) } };
    objects.push(body);
    previousPoses.set(body.id, { ...body.position, angle: body.angle });
    Composite.add(engine.world, body);
    cancelDrag();
    wake();
  });
  for (const type of ["pointercancel", "lostpointercapture"]) {
    document.addEventListener(type, event => { if (drag?.id === event.pointerId) cancelDrag(); });
  }
  // Background drags are physics gestures on touch screens. A swipe that starts
  // on a link remains native page scrolling, so short phone screens stay usable.
  for (const type of ["touchstart", "touchmove"]) {
    document.addEventListener(type, event => {
      if (drag?.pointerType === "touch" && event.cancelable) event.preventDefault();
    }, { passive: false });
  }
  document.addEventListener("contextmenu", event => { if (drag) event.preventDefault(); });
  window.addEventListener("blur", cancelDrag);
  window.addEventListener("scroll", wake, { passive: true });
  function pause() {
    cancelDrag();
    cancelAnimationFrame(frameId);
    frameId = 0;
    accumulator = 0;
  }
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : wake());
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", wake);

  exposeDiagnostics(() => ({
    kind: "physics", color: INK, world: { ...world }, dragging: Boolean(drag),
    lastSpawn: lastSpawn ? { ...lastSpawn, origin: { ...lastSpawn.origin }, velocity: { ...lastSpawn.velocity } } : null,
    contacts: { ...contacts }, contactLabels: Object.fromEntries(contactLabels),
    bodies: objects.map(body => ({
      id: body.id, shape: body.plugin.shape, size: body.plugin.size, color: body.plugin.color,
      x: body.position.x, y: body.position.y, velocity: { ...Body.getVelocity(body) },
      angle: body.angle, sleeping: body.isSleeping,
      vertices: body.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }))
    })),
    solids: solids.filter(body => body.plugin.kind !== "wall").map(body => ({
      label: body.label, isStatic: body.isStatic, x: body.position.x, y: body.position.y,
      velocity: { ...Body.getVelocity(body) }, rectangle: { ...body.plugin.rectangle }
    }))
  }));
  watchLayout(syncLayout);
  syncLayout();
}

start().catch(error => console.error("Homepage background:", error));
