import { INK, createStage, documentPoint, documentSize, exposeDiagnostics, isInteractable, watchLayout } from "./common.js";
import { AntWorld } from "./ant-core.js";

const cellSize = 8;
const stage = createStage(document.getElementById("page-background"));
const cells = document.createElement("canvas");
const cellContext = cells.getContext("2d");
const size = documentSize();
const world = new AntWorld(Math.max(1, Math.ceil(size.width / cellSize)), Math.max(1, Math.ceil(size.height / cellSize)), paintCell);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let frameId = 0;
let lastTime = 0;
let accumulator = 0;

function paintCell(x, y, black) {
  if (black) {
    cellContext.fillStyle = INK;
    cellContext.fillRect(x, y, 1, 1);
  } else cellContext.clearRect(x, y, 1, 1);
}

function render() {
  stage.clear();
  const context = stage.context;
  context.imageSmoothingEnabled = false;
  context.drawImage(cells, 0, 0, world.columns * cellSize, world.rows * cellSize);
}

function syncLayout() {
  stage.resize();
  const size = documentSize();
  world.resize(Math.max(1, Math.ceil(size.width / cellSize)), Math.max(1, Math.ceil(size.height / cellSize)));
  cells.width = world.columns;
  cells.height = world.rows;
  for (const key of world.black) paintCell(key % world.columns, Math.floor(key / world.columns), true);
  wake();
}

function frame(now) {
  frameId = 0;
  if (document.hidden) return;
  const speed = reducedMotion.matches ? 60 : 240;
  accumulator += Math.min(50, Math.max(0, now - lastTime)) * speed / 1000;
  lastTime = now;
  const ticks = Math.floor(accumulator);
  if (ticks) {
    world.step(ticks);
    accumulator -= ticks;
  }
  render();
  if (world.ants.length) frameId = requestAnimationFrame(frame);
}

function wake() {
  if (frameId || document.hidden) return;
  lastTime = performance.now();
  frameId = requestAnimationFrame(frame);
}

document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || isInteractable(event.target)) return;
  if (!window.getSelection()?.isCollapsed) return;
  const point = documentPoint(event);
  world.addAnt(Math.floor(point.x / cellSize), Math.floor(point.y / cellSize));
  wake();
});
window.addEventListener("scroll", wake, { passive: true });
function pause() {
  cancelAnimationFrame(frameId);
  frameId = 0;
  accumulator = 0;
}
document.addEventListener("visibilitychange", () => document.hidden ? pause() : wake());
window.addEventListener("pagehide", pause);
window.addEventListener("pageshow", wake);

exposeDiagnostics(() => ({
  kind: "langton", cellSize, whiteColor: getComputedStyle(document.body).backgroundColor,
  blackColor: INK, columns: world.columns, rows: world.rows, steps: world.steps,
  blackCount: world.black.size, antCount: world.ants.length,
  ants: world.ants.map(ant => ({ ...ant }))
}));
watchLayout(syncLayout);
syncLayout();
