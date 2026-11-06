import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../projects/fractal/core.js", import.meta.url));
const { EXAMPLES, ScriptError, parseScript, buildModel, curveSegments, fitCamera, screenToWorld, zoomCamera, escapePoint, colorAt, validateState } = await import(`data:text/javascript;base64,${source.toString("base64")}`);
let checks = 0;
const test = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const close = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test("two-line dragon joins every rotated copy at the endpoint", () => {
  const ends = [[1, 0], [1, 1], [0, 2], [-2, 2], [-4, 0], [-4, -4]];
  for (let depth = 0; depth < ends.length; depth++) {
    const model = buildModel("clone\nturn right", depth);
    assert.equal(model.segments, 2n ** BigInt(depth));
    close(model.levels.at(-1).end.x, ends[depth][0]);
    close(model.levels.at(-1).end.y, ends[depth][1]);
  }
});

test("visible dragon geometry matches independently expanded point paths", () => {
  for (const direction of ["right", "left"]) {
    let points = [[0, 0], [1, 0]];
    for (let generation = 0; generation < 8; generation++) {
      const [ex, ey] = points.at(-1);
      const rotated = points.slice().reverse().map(([x, y]) => direction === "right" ? [ex + y - ey, ey - x + ex] : [ex - y + ey, ey + x - ex]);
      points = points.concat(rotated.slice(1));
    }
    const model = buildModel(`clone\nturn ${direction}`, 8), camera = fitCamera(model.bounds, 1000, 700);
    const key = (a, b) => [a, b].map(p => p.map(n => Math.round(n * 1e6)).join(",")).sort().join(";");
    const expected = points.slice(1).map((p, i) => key(points[i], p)).sort();
    const actual = [...curveSegments(model, camera, 1000, 700, {}, { lod: 0 })].map(s => {
      const a = screenToWorld(camera, { x: s[0], y: s[1] }, 1000, 700), b = screenToWorld(camera, { x: s[2], y: s[3] }, 1000, 700);
      return key([a.x, a.y], [b.x, b.y]);
    }).sort();
    assert.deepEqual(actual, expected);
  }
});

test("Sierpinski copies, pivots, seeds, and clear preserve expected bounds", () => {
  const model = buildModel(EXAMPLES.gasket.source, 12);
  assert.equal(model.segments, 3n ** 13n);
  close(model.bounds.minX, 0); close(model.bounds.maxX, 1);
  close(model.bounds.minY, 0); close(model.bounds.maxY, Math.sqrt(3) / 2);
  assert.equal(buildModel("seed square\nclone", 0).segments, 4n);
  const moved = buildModel("clear\npivot origin\nclone\nscale 0.5\nmove 2 3", 1);
  close(moved.bounds.minX, 2); close(moved.bounds.maxX, 2.5); close(moved.bounds.minY, 3);
  const flipped = buildModel("clear\npivot origin\nclone\nflip x", 1);
  close(flipped.bounds.minX, -1); close(flipped.bounds.maxX, 0);
});

test("parser rejects malformed or executable input with useful line numbers", () => {
  const bad = ["", "turn right", "clone\nscale 0", "clone\nscale 5", "clone\nmove Infinity 2", "clone\nturn sideways", "clone\nseed triangle", "clone\nwindow.alert(1)", "clone\nmove 1+2 0", "clone\nclear", "clone\n".repeat(129), "#".repeat(16001)];
  for (const script of bad) assert.throws(() => buildModel(script, 2), ScriptError, script);
  assert.throws(() => parseScript("# comment\nclone\nnope"), e => e.line === 3 && /Unknown command/.test(e.message));
  assert.equal(parseScript("# comment\nCLONE // copy\nTurn Right 45").instructions.length, 2);
  assert.throws(() => buildModel("clone\nscale 4", 32), /too large/);
  assert.throws(() => buildModel(EXAMPLES.dragon.source, 33), /0 to 32/);
});

test("deep curves adapt, clip to the viewport, and explicitly reject excess work", () => {
  const model = buildModel(EXAMPLES.dragon.source, 32), camera = fitCamera(model.bounds, 500, 350), stats = {};
  assert.equal(model.segments, 4294967296n);
  for (const segment of curveSegments(model, camera, 500, 350, stats, { lod: 2.4 })) {
    assert.ok(segment.every(Number.isFinite));
    assert.ok(segment[0] >= -4 && segment[0] <= 504 && segment[2] >= -4 && segment[2] <= 504);
    assert.ok(segment[1] >= -4 && segment[1] <= 354 && segment[3] >= -4 && segment[3] <= 354);
  }
  assert.ok(stats.segments < 300000 && stats.approximated > 0);
  assert.throws(() => [...curveSegments(model, camera, 500, 350, {}, { lod: 0, maxSegments: 20 })], /Too much detail/);
  const zoomed = { x: 0, y: 0, span: 0.000001 };
  assert.ok([...curveSegments(buildModel(EXAMPLES.dragon.source, 8), zoomed, 500, 350)].flat().every(Number.isFinite));
});

test("zoom holds its cursor anchor and camera fitting handles portrait screens", () => {
  const camera = { x: -0.7, y: 0.13, span: 0.002 }, point = { x: 107, y: 519 };
  const before = screenToWorld(camera, point, 900, 700), after = screenToWorld(zoomCamera(camera, 0.12, point, 900, 700), point, 900, 700);
  close(before.x, after.x, 1e-14); close(before.y, after.y, 1e-14);
  const fitted = fitCamera({ minX: -2, maxX: 2, minY: -1, maxY: 1 }, 320, 800);
  assert.ok(fitted.span * 320 / 800 > 4);
});

test("escape-time equations match an independent complex recurrence", () => {
  const reference = (real, imaginary, mode, juliaX, juliaY) => {
    let z = mode === "julia" ? [real, imaginary] : [0, 0];
    const c = mode === "julia" ? [juliaX, juliaY] : [real, imaginary];
    for (let i = 0; i < 128; i++) {
      const [a, b] = mode === "ship" ? z.map(Math.abs) : z;
      z = [a ** 2 - b ** 2 + c[0], a * b * 2 + c[1]];
      if (Math.hypot(...z) > 2) return Math.max(0, i + 2 - Math.log2(Math.log(Math.hypot(...z))));
    }
    return -1;
  };
  for (const mode of ["mandelbrot", "julia", "ship"]) for (const [x, y] of [[0, 0], [-1, 0], [2, 2], [-1.7, -0.04], [-0.71, 0.25], [0.5, 0.5]]) close(escapePoint(x, y, mode, 128, -0.8, 0.156), reference(x, y, mode, -0.8, 0.156));
  assert.equal(escapePoint(0.9, 0, "julia", 128, 0, 0), -1);
  assert.ok(escapePoint(1.1, 0, "julia", 128, 0, 0) >= 0);
  assert.deepEqual(colorAt(-1), [8, 12, 14]);
  assert.ok(colorAt(24, "ember").every(n => n >= 0 && n <= 255));
});

test("saved views round-trip full scripts and reject corrupt settings", () => {
  const state = { mode: "script", palette: "aurora", camera: { x: 2, y: 3, span: 0.004 }, iterations: 384, depth: 18, juliaX: -0.8, juliaY: 0.156, stroke: 1.1, script: EXAMPLES.dragon.source };
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
  for (const changed of [{ palette: "__proto__" }, { iterations: NaN }, { camera: { x: 0, y: 0, span: 0 } }, { mode: "unknown" }, { script: "nope", mode: "mandelbrot" }]) assert.throws(() => validateState({ ...state, ...changed }));
});
console.log(`${checks} fractal test groups passed.`);
