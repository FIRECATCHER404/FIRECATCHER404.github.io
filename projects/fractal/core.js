export const EXAMPLES = Object.freeze({
  dragon: { name: "Dragon curve", source: "clone\nturn right" },
  gasket: { name: "Sierpinski triangle", source: "seed triangle\nclear\npivot origin\nclone\nscale 0.5\nclone\nscale 0.5\nmove 0.5 0\nclone\nscale 0.5\nmove 0.25 0.4330127018922193" },
  branches: { name: "Branching form", source: "clone\nturn left 145\nscale 0.68\nclone\nturn right 145\nscale 0.68" },
  spiral: { name: "Shrinking folds", source: "clone\nturn right 60\nscale 0.8" }
});

export const PALETTES = Object.freeze({
  aurora: { name: "Aurora", colors: [[16, 38, 49], [29, 93, 103], [79, 158, 128], [186, 218, 156], [248, 232, 177]] },
  ember: { name: "Ember", colors: [[31, 18, 33], [113, 37, 57], [221, 94, 52], [255, 191, 93], [255, 240, 200]] },
  ocean: { name: "Ocean", colors: [[10, 16, 42], [30, 61, 126], [34, 146, 180], [134, 218, 221], [224, 246, 234]] },
  mono: { name: "Monochrome", colors: [[12, 15, 18], [72, 81, 83], [132, 146, 139], [205, 218, 200], [247, 247, 239]] }
});

export class ScriptError extends Error {
  constructor(message, line = 0) { super(line ? `Line ${line}: ${message}` : message); this.line = line; }
}

export const MAX_RUNS = 128;
export function automaticIterations(camera) {
  return Math.min(8192, Math.round(512 + Math.max(0, Math.log2(3.4 / camera.span)) * 128));
}
export function advanceScript(previousSource, source, depth, count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_RUNS) throw new ScriptError(`Runs must be a whole number from 1 to ${MAX_RUNS}.`);
  const nextDepth = (source === previousSource ? depth : 0) + count;
  if (nextDepth > MAX_RUNS) throw new ScriptError(`This curve has reached ${MAX_RUNS} runs. Reset to the seed to start again.`);
  return buildModel(source, nextDepth);
}
export function gasketContains(x, y, levels) {
  let c = y / (Math.sqrt(3) / 2), b = x - c / 2, a = 1 - b - c;
  if (Math.min(a, b, c) < 0) return false;
  for (let i = 0; i < levels; i++) {
    if (Math.max(a, b, c) < 0.5) return false;
    if (a >= b && a >= c) { a = a * 2 - 1; b *= 2; c *= 2; }
    else if (b >= c) { b = b * 2 - 1; a *= 2; c *= 2; }
    else { c = c * 2 - 1; a *= 2; b *= 2; }
  }
  return true;
}
export function carpetContains(x, y, levels) {
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  for (let i = 0; i < levels; i++) {
    x *= 3; y *= 3;
    const column = Math.floor(x), row = Math.floor(y);
    if (column === 1 && row === 1) return false;
    x -= column; y -= row;
  }
  return true;
}
export function planarDetail(mode, span, height) {
  const base = mode === "carpet" ? 3 : 2;
  return Math.max(1, Math.min(48, Math.ceil(Math.log(height / span) / Math.log(base)) + 1));
}

const IDENTITY = [1, 0, 0, 1, 0, 0];
const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
function number(token, line, limit = 1e6) {
  const value = Number(token);
  if (!numeric.test(token || "") || !Number.isFinite(value) || Math.abs(value) > limit) throw new ScriptError(`Expected a finite number between ${-limit} and ${limit}.`, line);
  return value;
}

export function parseScript(source) {
  if (typeof source !== "string" || source.length > 16000) throw new ScriptError("Scripts can contain up to 16,000 characters.");
  const instructions = [];
  let seed = "line", first = true, selected = false, clones = 0;
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const text = raw.replace(/#.*$|\/\/.*$/, "").trim().toLowerCase();
    if (!text) continue;
    const words = text.split(/\s+/), line = index + 1, op = words[0];
    const count = n => { if (words.length !== n + 1) throw new ScriptError(`Unexpected arguments for ${op}.`, line); };
    if (op === "seed") {
      count(1);
      if (!first || !["line", "triangle", "square"].includes(words[1])) throw new ScriptError("Put seed line, seed triangle, or seed square at the start.", line);
      seed = words[1]; first = false; continue;
    }
    first = false;
    let instruction;
    if (op === "clone") { count(0); selected = true; clones += 1; instruction = { op }; }
    else if (op === "clear") { count(0); selected = false; instruction = { op }; }
    else if (op === "pivot") {
      count(1);
      if (!["start", "end", "center", "origin"].includes(words[1])) throw new ScriptError("Pivot must be start, end, center, or origin.", line);
      selected = false; instruction = { op, value: words[1] };
    } else {
      if (!["turn", "scale", "move", "flip"].includes(op)) throw new ScriptError(`Unknown command “${words[0]}”.`, line);
      if (!selected) throw new ScriptError(`Use clone before ${op}; transformations act on the new copy.`, line);
      if (op === "turn") {
        if (!["right", "left"].includes(words[1]) || ![2, 3].includes(words.length)) throw new ScriptError("Use turn right [degrees] or turn left [degrees].", line);
        instruction = { op, angle: (words.length === 3 ? number(words[2], line, 3600) : 90) * Math.PI / 180 * (words[1] === "right" ? -1 : 1) };
      } else if (op === "scale") {
        count(1); const value = number(words[1], line, 4);
        if (value <= 0) throw new ScriptError("Scale must be greater than 0 and at most 4.", line);
        instruction = { op, value };
      } else if (op === "move") { count(2); instruction = { op, x: number(words[1], line), y: number(words[2], line) }; }
      else {
        count(1);
        if (!["x", "y"].includes(words[1])) throw new ScriptError("Use flip x or flip y.", line);
        instruction = { op, axis: words[1] };
      }
    }
    instructions.push({ ...instruction, line });
    if (instructions.length > 128) throw new ScriptError("Use at most 128 commands.", line);
  }
  if (!clones) throw new ScriptError("Add a clone command. Try clone, then turn right.");
  return { seed, instructions };
}

export const transformPoint = (m, p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
export function compose(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function boundsOf(points) {
  return points.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}
const corners = b => [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }];
function around(m, pivot) { return compose([1, 0, 0, 1, pivot.x, pivot.y], compose(m, [1, 0, 0, 1, -pivot.x, -pivot.y])); }
function clipLine(a, b, width, height) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy], q = [a[0] + 4, width + 4 - a[0], a[1] + 4, height + 4 - a[1]];
  let start = 0, end = 1;
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const ratio = q[i] / p[i];
    if (p[i] < 0) start = Math.max(start, ratio); else end = Math.min(end, ratio);
    if (start > end) return null;
  }
  return [Math.max(-4, Math.min(width + 4, a[0] + dx * start)), Math.max(-4, Math.min(height + 4, a[1] + dy * start)), Math.max(-4, Math.min(width + 4, a[0] + dx * end)), Math.max(-4, Math.min(height + 4, a[1] + dy * end))];
}

export function buildModel(source, depth) {
  if (!Number.isInteger(depth) || depth < 0 || depth > MAX_RUNS) throw new ScriptError(`Runs must be a whole number from 0 to ${MAX_RUNS}.`);
  const parsed = typeof source === "string" ? parseScript(source) : source;
  const points = parsed.seed === "triangle" ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: Math.sqrt(3) / 2 }, { x: 0, y: 0 }] : parsed.seed === "square" ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }] : [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  const levels = [{ points, start: points[0], end: points.at(-1), bounds: boundsOf(points), segments: BigInt(points.length - 1) }];
  for (let generation = 1; generation <= depth; generation += 1) {
    const previous = levels.at(-1);
    let children = [{ matrix: IDENTITY, reverse: false }], pending = null, pivot = previous.end;
    const flush = () => { if (pending) children.push(pending); pending = null; };
    for (const command of parsed.instructions) {
      if (command.op === "clear") { children = []; pending = null; }
      else if (command.op === "pivot") {
        flush();
        pivot = command.value === "origin" ? { x: 0, y: 0 } : command.value === "center" ? { x: (previous.bounds.minX + previous.bounds.maxX) / 2, y: (previous.bounds.minY + previous.bounds.maxY) / 2 } : previous[command.value];
      } else if (command.op === "clone") { flush(); pending = { matrix: IDENTITY, reverse: true }; }
      else if (command.op === "turn") {
        const c = Math.cos(command.angle), s = Math.sin(command.angle);
        pending.matrix = compose(around([c, s, -s, c, 0, 0], pivot), pending.matrix);
      } else if (command.op === "scale") pending.matrix = compose(around([command.value, 0, 0, command.value, 0, 0], pivot), pending.matrix);
      else if (command.op === "move") pending.matrix = compose([1, 0, 0, 1, command.x, command.y], pending.matrix);
      else pending.matrix = compose(around(command.axis === "x" ? [-1, 0, 0, 1, 0, 0] : [1, 0, 0, -1, 0, 0], pivot), pending.matrix);
    }
    flush();
    if (!children.length) throw new ScriptError("The generation is empty. Put a clone after clear.");
    const first = children[0], last = children.at(-1);
    const bounds = boundsOf(children.flatMap(child => corners(previous.bounds).map(p => transformPoint(child.matrix, p))));
    if (Object.values(bounds).some(n => !Number.isFinite(n) || Math.abs(n) > 1e12)) throw new ScriptError(`The drawing is too large at generation ${generation}. Reduce scale or generations.`);
    const seen = new Set(), renderChildren = children.filter(child => {
      const key = child.matrix.join(",");
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    levels.push({ children, renderChildren, bounds, start: transformPoint(first.matrix, previous[first.reverse ? "end" : "start"]), end: transformPoint(last.matrix, previous[last.reverse ? "start" : "end"]), segments: previous.segments * BigInt(children.length) });
  }
  return { levels, depth, bounds: levels.at(-1).bounds, segments: levels.at(-1).segments };
}

export function fitCamera(bounds, width, height) {
  const span = Math.max(bounds.maxY - bounds.minY, (bounds.maxX - bounds.minX) * height / width, 0.1) * 1.13;
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, span };
}
export function screenToWorld(camera, point, width, height) {
  return { x: camera.x + (point.x - width / 2) * camera.span / height, y: camera.y + (height / 2 - point.y) * camera.span / height };
}
export function zoomCamera(camera, factor, point, width, height) {
  const anchor = screenToWorld(camera, point, width, height);
  const minimum = Math.max(1e-12, Math.max(1, Math.abs(anchor.x), Math.abs(anchor.y)) * Number.EPSILON * height * 8);
  const span = Math.max(minimum, Math.min(1e12, camera.span * factor));
  return { x: anchor.x - (point.x - width / 2) * span / height, y: anchor.y - (height / 2 - point.y) * span / height, span };
}

export function* curveSegments(model, camera, width, height, stats = {}, limits = {}) {
  const units = camera.span / height, lod = limits.lod ?? 1.2, maxSegments = limits.maxSegments ?? 300000, maxNodes = limits.maxNodes ?? 2000000;
  const visible = { minX: camera.x - width / 2 * units - 3 * units, maxX: camera.x + width / 2 * units + 3 * units, minY: camera.y - height / 2 * units - 3 * units, maxY: camera.y + height / 2 * units + 3 * units };
  const stack = [{ level: model.depth, matrix: IDENTITY }];
  stats.nodes = 0; stats.segments = 0; stats.approximated = 0;
  const pixel = p => [width / 2 + (p.x - camera.x) / units, height / 2 - (p.y - camera.y) / units];
  const emit = (a, b) => {
    const segment = clipLine(pixel(a), pixel(b), width, height);
    if (!segment) return null;
    if (++stats.segments > maxSegments) throw new ScriptError("This script draws too many overlapping segments. Zoom in, simplify the script, or reset the curve.");
    return segment;
  };
  while (stack.length) {
    const node = stack.pop(), level = model.levels[node.level];
    if (++stats.nodes > maxNodes) throw new ScriptError("This script is too complex in this view. Zoom in, simplify the script, or reset the curve.");
    const bounds = boundsOf(corners(level.bounds).map(p => transformPoint(node.matrix, p)));
    if (bounds.maxX < visible.minX || bounds.minX > visible.maxX || bounds.maxY < visible.minY || bounds.minY > visible.maxY) continue;
    if (node.level > 0 && Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / units <= lod) {
      stats.approximated += 1;
      const segment = emit(transformPoint(node.matrix, level.start), transformPoint(node.matrix, level.end));
      if (segment) yield segment;
    } else if (node.level === 0) {
      for (let i = 1; i < level.points.length; i += 1) {
        const segment = emit(transformPoint(node.matrix, level.points[i - 1]), transformPoint(node.matrix, level.points[i]));
        if (segment) yield segment;
      }
    } else {
      for (let i = level.renderChildren.length - 1; i >= 0; i -= 1) stack.push({ level: node.level - 1, matrix: compose(node.matrix, level.renderChildren[i].matrix) });
    }
  }
}

export function escapePoint(real, imaginary, mode, maxIterations, juliaX = -0.8, juliaY = 0.156) {
  if (mode === "mandelbrot") {
    const offset = real - 0.25, squaredY = imaginary * imaginary, q = offset * offset + squaredY;
    if (q * (q + offset) <= 0.25 * squaredY || (real + 1) ** 2 + squaredY <= 0.0625) return -1;
  }
  let x = mode === "julia" ? real : 0, y = mode === "julia" ? imaginary : 0;
  const cr = mode === "julia" ? juliaX : real, ci = mode === "julia" ? juliaY : imaginary;
  for (let i = 0; i < maxIterations; i += 1) {
    if (mode === "ship") { x = Math.abs(x); y = Math.abs(y); }
    const nextX = x * x - y * y + cr;
    y = 2 * x * y + ci; x = nextX;
    const lengthSquared = x * x + y * y;
    if (lengthSquared > 4) return Math.max(0, i + 2 - Math.log2(Math.log(Math.sqrt(lengthSquared))));
  }
  return -1;
}
export function colorAt(value, palette = "aurora") {
  if (value < 0) return [8, 12, 14];
  const colors = PALETTES[palette].colors;
  const position = ((value * 0.025 % 1 + 1) % 1) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(position)), mix = position - index;
  return colors[index].map((n, channel) => Math.round(n + (colors[index + 1][channel] - n) * mix));
}

export function validateState(value) {
  if (!value || !["mandelbrot", "julia", "ship", "gasket", "carpet", "menger", "tetra", "script"].includes(value.mode) || !Object.keys(PALETTES).includes(value.palette)) throw new Error("Invalid saved fractal.");
  const camera = value.camera;
  if (!camera || ![camera.x, camera.y, camera.span].every(Number.isFinite) || Math.abs(camera.x) > 1e12 || Math.abs(camera.y) > 1e12 || camera.span < 1e-12 || camera.span > 1e12) throw new Error("Invalid saved location.");
  if (!Number.isInteger(value.iterations) || value.iterations < 64 || value.iterations > 8192 || !Number.isInteger(value.depth) || value.depth < 0 || value.depth > MAX_RUNS) throw new Error("Invalid saved detail setting.");
  if (![value.juliaX, value.juliaY].every(n => Number.isFinite(n) && Math.abs(n) <= 2) || !Number.isFinite(value.stroke) || value.stroke < 0.5 || value.stroke > 4) throw new Error("Invalid saved settings.");
  if (typeof value.script !== "string" || value.script.length > 16000) throw new Error("Invalid saved script.");
  buildModel(value.script, value.depth);
  const orbit = value.orbit ?? { yaw: 0.65, pitch: 0.38 }, runBatch = value.runBatch ?? 1;
  if (![orbit.yaw, orbit.pitch].every(Number.isFinite) || Math.abs(orbit.yaw) > 1e6 || Math.abs(orbit.pitch) > 1.5 || !Number.isInteger(runBatch) || runBatch < 1 || runBatch > MAX_RUNS) throw new Error("Invalid saved controls.");
  return { mode: value.mode, palette: value.palette, camera: { ...camera }, iterations: value.iterations, depth: value.depth, juliaX: value.juliaX, juliaY: value.juliaY, stroke: value.stroke, script: value.script, orbit: { ...orbit }, runBatch };
}
