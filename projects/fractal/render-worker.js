import { buildModel, colorAt, curveSegments, escapePoint } from "./core.js";

let current = 0;
const breathe = () => new Promise(resolve => setTimeout(resolve, 0));
self.onmessage = ({ data }) => {
  current = data.id;
  if (data.type === "cancel") return;
  render(data).catch(error => {
    if (current === data.id) self.postMessage({ id: data.id, type: "error", message: error.message, line: error.line || 0 });
  });
};

async function render({ id, state, width, height }) {
  const started = performance.now();
  if (state.mode === "script") {
    const model = buildModel(state.script, state.depth), stats = {};
    const buffer = new Float32Array(300000 * 4);
    let count = 0;
    for (const tolerance of [1.2, 2.4, 4.8]) {
      const iterator = curveSegments(model, state.camera, width, height, stats, { lod: tolerance });
      count = 0;
      try {
        let done = false;
        while (!done) {
          for (let i = 0; i < 2048; i += 1) {
            const next = iterator.next();
            if (next.done) { done = true; break; }
            buffer.set(next.value, count * 4); count += 1;
          }
          if (id !== current) return;
          if (!done) { self.postMessage({ id, type: "progress", segments: count }); await breathe(); }
        }
        stats.pixelTolerance = tolerance;
        break;
      } catch (error) {
        if (tolerance === 4.8 || !/too (much detail|complex)/i.test(error.message)) throw error;
        await breathe();
        if (id !== current) return;
      }
    }
    const segments = buffer.slice(0, count * 4);
    self.postMessage({ id, type: "curve", buffer: segments.buffer, stats: { ...stats, logicalSegments: model.segments.toString(), milliseconds: performance.now() - started } }, [segments.buffer]);
    return;
  }
  const table = new Uint8Array(4096 * 3);
  for (let i = 0; i < 4096; i += 1) table.set(colorAt(i / 4096 / 0.025, state.palette), i * 3);
  const units = state.camera.span / height;
  for (let top = 0; top < height; top += 8) {
    if (id !== current) return;
    const rows = Math.min(8, height - top), pixels = new Uint8ClampedArray(width * rows * 4);
    for (let row = 0; row < rows; row += 1) {
      const imaginary = state.camera.y + (height / 2 - top - row - 0.5) * units;
      for (let column = 0; column < width; column += 1) {
        const real = state.camera.x + (column + 0.5 - width / 2) * units;
        const value = escapePoint(real, imaginary, state.mode, state.iterations, state.juliaX, state.juliaY);
        const pixel = (row * width + column) * 4;
        if (value === -1) { pixels[pixel] = 8; pixels[pixel + 1] = 12; pixels[pixel + 2] = 14; }
        else {
          const index = Math.min(4095, Math.floor(((value * 0.025 % 1 + 1) % 1) * 4096)) * 3;
          pixels[pixel] = table[index]; pixels[pixel + 1] = table[index + 1]; pixels[pixel + 2] = table[index + 2];
        }
        pixels[pixel + 3] = 255;
      }
    }
    self.postMessage({ id, type: "tile", top, rows, width, buffer: pixels.buffer, progress: (top + rows) / height }, [pixels.buffer]);
    await breathe();
  }
  if (id === current) self.postMessage({ id, type: "complete", stats: { milliseconds: performance.now() - started, precision: "double" } });
}
