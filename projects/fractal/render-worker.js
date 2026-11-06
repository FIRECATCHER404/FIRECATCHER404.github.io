import { PALETTES, buildModel, colorAt, curveSegments, escapePoint, gasketContains } from "./core.js?v=2";
import { isSolid, solidBasis, solidDetail, solidPixel } from "./solid.js?v=2";

let current = 0;
const breathe = () => new Promise(resolve => setTimeout(resolve, 0));
self.onmessage = ({ data }) => {
  current = data.id;
  if (data.type === "cancel") return;
  render(data).catch(error => {
    if (current === data.id) self.postMessage({ id: data.id, type: "error", message: error.message, line: error.line || 0 });
  });
};

async function render({ id, state, width, height, pixelRatio }) {
  const started = performance.now();
  if (state.mode === "script") {
    const model = buildModel(state.script, state.depth), stats = {};
    const iterator = curveSegments(model, state.camera, width, height, stats, { lod: 1, maxSegments: Math.max(300000, width * height * 8), maxNodes: Math.max(2000000, width * height * 24) });
    self.postMessage({ id, type: "curve-start", width, height });
    let done = false;
    while (!done) {
      const buffer = new Float32Array(8192 * 4);
      let count = 0;
      for (; count < 8192; count++) {
        const next = iterator.next();
        if (next.done) { done = true; break; }
        buffer.set(next.value, count * 4);
      }
      if (id !== current) return;
      const chunk = buffer.slice(0, count * 4);
      self.postMessage({ id, type: "curve-chunk", buffer: chunk.buffer }, [chunk.buffer]);
      if (!done) { self.postMessage({ id, type: "progress", segments: stats.segments }); await breathe(); }
    }
    self.postMessage({ id, type: "curve-complete", stats: { ...stats, width, height, pixelRatio, pixelTolerance: 1, logicalSegments: model.segments.toString(), milliseconds: performance.now() - started } });
    return;
  }
  const table = new Uint8Array(4096 * 3), colors = PALETTES[state.palette].colors;
  for (let i = 0; i < 4096; i += 1) table.set(colorAt(i / 4096 / 0.025, state.palette), i * 3);
  const units = state.camera.span / height, solid = isSolid(state.mode), basis = solidBasis(state.orbit), detail = solidDetail(state.mode, state.camera.span, height);
  const triangleLevels = Math.max(1, Math.min(48, Math.ceil(Math.log2(height / state.camera.span)) + 1));
  const tileHeight = solid ? 2 : 8;
  for (let top = 0; top < height; top += tileHeight) {
    if (id !== current) return;
    const rows = Math.min(tileHeight, height - top), pixels = new Uint8ClampedArray(width * rows * 4);
    for (let row = 0; row < rows; row += 1) {
      const imaginary = state.camera.y + (height / 2 - top - row - 0.5) * units;
      for (let column = 0; column < width; column += 1) {
        const pixel = (row * width + column) * 4;
        if (solid) pixels.set(solidPixel(column, top + row, width, height, state, basis, detail, colors), pixel);
        else {
          const real = state.camera.x + (column + 0.5 - width / 2) * units;
          if (state.mode === "gasket") {
            const inside = gasketContains(real, imaginary, triangleLevels), mix = Math.max(0, Math.min(1, real));
            pixels.set(inside ? colors[2].map((n, i) => Math.round(n + (colors[4][i] - n) * mix)) : [16, 21, 23], pixel);
          } else {
            const value = escapePoint(real, imaginary, state.mode, state.iterations, state.juliaX, state.juliaY);
            if (value === -1) pixels.set([8, 12, 14], pixel);
            else {
              const index = Math.min(4095, Math.floor(((value * 0.025 % 1 + 1) % 1) * 4096)) * 3;
              pixels.set(table.subarray(index, index + 3), pixel);
            }
          }
        }
        pixels[pixel + 3] = 255;
      }
    }
    self.postMessage({ id, type: "tile", top, rows, width, buffer: pixels.buffer, progress: (top + rows) / height }, [pixels.buffer]);
    await breathe();
  }
  if (id === current) self.postMessage({ id, type: "complete", stats: { milliseconds: performance.now() - started, precision: "double", width, height, pixelRatio, ...(solid ? detail : state.mode === "gasket" ? { levels: triangleLevels } : { iterations: state.iterations }) } });
}
