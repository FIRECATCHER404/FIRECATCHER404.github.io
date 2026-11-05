import { INK, collectSolids, createStage, documentPoint, documentSize, exposeDiagnostics, isInteractable, watchLayout } from "./common.js";
import { chooseShape, createSimulation, verticesAt } from "./physics-world.js";

async function loadPlanck() {
  if (window.planck) return window.planck;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("../vendor/planck/planck.min.js", import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load background physics"));
    document.head.appendChild(script);
  });
  return window.planck;
}

async function start() {
  const sim = createSimulation(await loadPlanck());
  const stage = createStage(document.getElementById("page-background"));
  let frameId = 0, lastTime = 0, accumulator = 0, drag = null, lastSpawn = null;
  const fixedStep = 1000 / 120;
  const heldSize = () => Math.min(40, 5 + (performance.now() - drag.started) * 0.03);

  function syncLayout(scale = true) {
    if (scale) stage.resize();
    const size = documentSize();
    const rectangles = collectSolids().map(rect => ({ ...rect, kind: rect.label.startsWith("button:") ? "button" : "text" }));
    const footer = document.querySelector(".site-footer");
    if (footer) {
      const rect = footer.getBoundingClientRect(), height = parseFloat(getComputedStyle(footer).borderTopWidth);
      if (height > 0) rectangles.push({ x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height, kind: "separator", label: "separator" });
    }
    sim.layout(rectangles, { width: size.width, height: scrollY + innerHeight }, { scale, documentHeight: size.height });
    wake();
  }

  function preview() {
    return sim.findFree(sim.geometry(drag.shape, heldSize()), drag.start);
  }

  function draw(shape) {
    const context = stage.context;
    context.fillStyle = INK;
    context.beginPath();
    if (shape.radius) context.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
    else {
      shape.vertices.forEach((v, i) => i ? context.lineTo(v.x, v.y) : context.moveTo(v.x, v.y));
      context.closePath();
    }
    context.fill();
  }

  function render() {
    stage.clear();
    for (const body of sim.objects) draw(sim.view(body));
    if (!drag) return;
    const candidate = preview();
    if (!candidate) return;
    draw(candidate.radius ? candidate : { ...candidate, vertices: verticesAt(candidate, candidate) });
    stage.context.strokeStyle = INK;
    stage.context.lineWidth = 2;
    stage.context.beginPath();
    stage.context.moveTo(candidate.x, candidate.y);
    stage.context.lineTo(drag.end.x, drag.end.y);
    stage.context.stroke();
  }

  function frame(now) {
    frameId = 0;
    if (document.hidden) return;
    accumulator += Math.min(50, Math.max(0, now - lastTime));
    lastTime = now;
    while (accumulator >= fixedStep) {
      sim.step(fixedStep / 1000);
      accumulator -= fixedStep;
    }
    render();
    if (drag || sim.objects.some(body => body.isAwake())) frameId = requestAnimationFrame(frame);
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
    drag = { id: event.pointerId, pointerType: event.pointerType, start: point, end: point, started: performance.now(), shape: chooseShape() };
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
    const candidate = preview();
    if (candidate) {
      const velocity = { x: (drag.end.x - drag.start.x) * 6, y: (drag.end.y - drag.start.y) * 6 };
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed > 1800) { velocity.x *= 1800 / speed; velocity.y *= 1800 / speed; }
      sim.addShape(candidate, velocity);
      lastSpawn = { shape: drag.shape, size: candidate.size, origin: { ...drag.start }, velocity };
    }
    cancelDrag();
    wake();
  });
  for (const type of ["pointercancel", "lostpointercapture"]) document.addEventListener(type, event => { if (drag?.id === event.pointerId) cancelDrag(); });
  for (const type of ["touchstart", "touchmove"]) document.addEventListener(type, event => {
    if (drag?.pointerType === "touch" && event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener("contextmenu", event => { if (drag) event.preventDefault(); });
  window.addEventListener("blur", cancelDrag);
  let scrollFrame = 0;
  window.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; syncLayout(false); });
  }, { passive: true });
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
    kind: "physics", engine: "planck", color: INK, velocityUnits: "pixels/second", world: { ...sim.bounds }, dragging: Boolean(drag),
    lastSpawn: lastSpawn ? { ...lastSpawn, origin: { ...lastSpawn.origin }, velocity: { ...lastSpawn.velocity } } : null,
    ...sim.snapshot()
  }));
  watchLayout(syncLayout);
  syncLayout();
}

start().catch(error => console.error("Homepage background:", error));
