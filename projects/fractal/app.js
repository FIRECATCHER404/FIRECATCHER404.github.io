import { EXAMPLES, advanceScript, automaticIterations, buildModel, fitCamera, screenToWorld, validateState, zoomCamera } from "./core.js?v=3";
import { FractalRenderer } from "./renderer.js?v=3";
import { DEFAULT_ORBIT, isSolid } from "./solid.js?v=2";

const $ = id => document.getElementById(id);
const viewport = $("viewport"), editor = $("script");
const DRAFT_KEY = "neoj.fractal.draft.v1", VIEWS_KEY = "neoj.fractal.views.v1";
const names = { mandelbrot: "Mandelbrot", julia: "Julia", ship: "Burning Ship", menger: "Menger sponge", carpet: "Sierpinski carpet", tetra: "Sierpinski tetrahedron", gasket: "Sierpinski triangle", script: "Custom curve" };
let state = { mode: "mandelbrot", palette: "aurora", camera: { x: -0.5, y: 0, span: 3.4 }, iterations: 512, juliaX: -0.8, juliaY: 0.156, depth: 0, stroke: 1.1, script: EXAMPLES.dragon.source, orbit: { ...DEFAULT_ORBIT }, runBatch: 1 };
let restored = false, editorSource = state.script, views = [];
try {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  if (draft) { state = validateState(draft.state); editorSource = typeof draft.editor === "string" && draft.editor.length <= 16000 ? draft.editor : state.script; restored = true; }
} catch { /* A corrupt or unavailable draft does not prevent opening the explorer. */ }
try {
  const saved = JSON.parse(localStorage.getItem(VIEWS_KEY));
  if (Array.isArray(saved)) for (const item of saved.slice(0, 50)) {
    try { if (typeof item.id === "string" && typeof item.name === "string") views.push({ id: item.id, name: item.name.slice(0, 48), state: validateState(item.state) }); } catch { /* Skip a damaged entry. */ }
  }
} catch { /* Saving remains optional. */ }
let model = buildModel(state.script, state.depth), frame = 0, persistTimer = 0, busy = true, renderError = "";
const compact = value => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
const renderer = new FractalRenderer(viewport, onRenderStatus);
renderer.onInvalidate = () => requestRender();

function homeCamera() {
  const bounds = isSolid(state.mode) ? { minX: -1.65, maxX: 1.65, minY: -1.65, maxY: 1.65 } : state.mode === "carpet" ? { minX: 0, maxX: 1, minY: 0, maxY: 1 } : state.mode === "gasket" ? { minX: 0, maxX: 1, minY: 0, maxY: Math.sqrt(3) / 2 } : state.mode === "script" ? model.bounds : state.mode === "julia" ? { minX: -1.8, maxX: 1.8, minY: -1.5, maxY: 1.5 } : state.mode === "ship" ? { minX: -2.2, maxX: 1.1, minY: -2, maxY: 1.1 } : { minX: -2.25, maxX: 0.9, minY: -1.35, maxY: 1.35 };
  return fitCamera(bounds, Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight));
}
function dirty() { return state.mode === "script" && editor.value !== state.script; }
function buttons() {
  $("save-view").disabled = busy || !!renderError || dirty();
  $("download-image").disabled = busy || !!renderError || dirty();
  const label = state.runBatch === 1 ? "Run once" : `Run ${state.runBatch} times`;
  $("run-script").textContent = dirty() ? `Apply & ${label.toLowerCase()}` : label;
}
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, editor: editor.value })); } catch { /* Save locations reports storage failures explicitly. */ } }, 350);
}
function updateZoom() {
  const zoom = homeCamera().span / state.camera.span;
  $("magnification").textContent = "×" + (zoom >= 10000 ? zoom.toExponential(2) : zoom.toLocaleString("en", { maximumFractionDigits: zoom < 10 ? 2 : 0 }));
}
function requestRender() {
  state.iterations = automaticIterations(state.camera);
  state.camera.x = Math.max(-1e12, Math.min(1e12, state.camera.x));
  state.camera.y = Math.max(-1e12, Math.min(1e12, state.camera.y));
  busy = true; renderError = ""; buttons(); updateZoom(); persist();
  renderer.cancel();
  if (renderer.lastMode === state.mode) renderer.preview(state.camera);
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; renderer.render(state); });
}
function onRenderStatus(result) {
  busy = result.busy;
  if (result.error) renderError = result.error;
  const progress = $("render-progress"); progress.hidden = !busy;
  if (busy) {
    $("render-status").textContent = "Rendering…";
    if (result.progress === undefined) progress.removeAttribute("value");
    else { progress.max = 1; progress.value = result.progress; }
  } else if (renderError) $("render-status").textContent = renderError;
  else if (state.mode === "script") $("render-status").textContent = `${state.depth} runs · ${compact(result.stats?.logicalSegments || model.segments)} logical segments`;
  else $("render-status").textContent = "Detail follows your view";
  buttons();
}
function syncControls() {
  $("mode").value = state.mode; $("palette").value = state.palette;
  $("julia-controls").hidden = state.mode !== "julia";
  $("script-controls").hidden = state.mode !== "script";
  $("coordinates").hidden = state.mode === "script" || ["gasket", "carpet"].includes(state.mode) || isSolid(state.mode);
  for (const [id, key] of [["julia-x", "juliaX"], ["julia-y", "juliaY"], ["stroke", "stroke"], ["run-count", "runBatch"]]) $(id).value = state[key];
  $("run-total").textContent = `${state.depth} ${state.depth === 1 ? "run" : "runs"} applied`;
  document.querySelector(".gesture-hint").textContent = isSolid(state.mode) ? "Drag to rotate · Shift-drag or two fingers to pan · Scroll or pinch to zoom" : "Drag to pan · Scroll or pinch to zoom";
  viewport.setAttribute("aria-label", isSolid(state.mode) ? "3D fractal. Drag or use arrow keys to rotate. Shift-drag or Shift-arrow keys pan. Scroll or pinch to zoom. Home resets the view." : "Fractal canvas. Drag to pan, scroll or pinch to zoom. Arrow keys pan, plus and minus zoom, and Home fits the view.");
  $("stroke-value").textContent = state.stroke.toFixed(1);
  $("example").value = Object.keys(EXAMPLES).find(key => EXAMPLES[key].source === editor.value) || "";
  buttons();
}
function clearScriptError() { $("script-error").hidden = true; editor.removeAttribute("aria-invalid"); }
function showScriptError(error) {
  $("script-error").textContent = error.message; $("script-error").hidden = false; editor.setAttribute("aria-invalid", "true");
  if (error.line) {
    const lines = editor.value.split("\n"), start = lines.slice(0, error.line - 1).reduce((sum, line) => sum + line.length + 1, 0);
    editor.focus(); editor.setSelectionRange(start, start + (lines[error.line - 1]?.length || 0));
  }
  buttons();
}
function runScript() {
  try {
    if (!$("run-count").checkValidity()) { $("run-count").reportValidity(); return; }
    const count = $("run-count").valueAsNumber;
    const next = advanceScript(state.script, editor.value, state.depth, count);
    model = next; state.depth = next.depth; state.runBatch = count; state.script = editor.value; clearScriptError(); state.camera = homeCamera(); syncControls(); requestRender();
  } catch (error) { showScriptError(error); }
}

$("mode").addEventListener("change", () => {
  state.mode = $("mode").value;
  state.camera = homeCamera(); clearScriptError(); syncControls(); requestRender();
});
$("palette").addEventListener("change", () => { state.palette = $("palette").value; requestRender(); });
for (const [id, key] of [["julia-x", "juliaX"], ["julia-y", "juliaY"]]) $(id).addEventListener("change", () => {
  if (!$(id).checkValidity() || !Number.isFinite($(id).valueAsNumber)) { $(id).reportValidity(); return; }
  state[key] = $(id).valueAsNumber; requestRender();
});
$("run-count").addEventListener("input", () => { if ($("run-count").checkValidity()) { state.runBatch = $("run-count").valueAsNumber; buttons(); persist(); } });
function resetScript() {
  try { model = buildModel(editor.value, 0); state.depth = 0; state.script = editor.value; clearScriptError(); state.camera = homeCamera(); syncControls(); requestRender(); }
  catch (error) { showScriptError(error); }
}
$("reset-script").addEventListener("click", resetScript);
$("stroke").addEventListener("input", () => { state.stroke = Number($("stroke").value); $("stroke-value").textContent = state.stroke.toFixed(1); requestRender(); });
$("example").addEventListener("change", () => { if (EXAMPLES[$("example").value]) { editor.value = EXAMPLES[$("example").value].source; resetScript(); } });
editor.addEventListener("input", () => { clearScriptError(); $("example").value = ""; buttons(); persist(); });
editor.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); runScript(); }
});
$("run-script").addEventListener("click", runScript);

function saveViews(next) {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); views = next; renderViews(); return true; }
  catch { $("save-status").textContent = "This browser couldn’t save the location. Check that site storage is available."; return false; }
}
function renderViews() {
  const list = $("saved-views"); list.replaceChildren();
  if (!views.length) { const item = document.createElement("li"); item.className = "saved-empty"; item.textContent = "No saved locations yet."; list.appendChild(item); }
  for (const view of views) {
    const item = document.createElement("li"); item.className = "saved-item";
    const open = document.createElement("button"); open.type = "button"; open.className = "saved-open"; open.textContent = view.name;
    const meta = document.createElement("span"); meta.textContent = names[view.state.mode]; open.appendChild(meta);
    open.addEventListener("click", () => {
      try { state = validateState(view.state); model = buildModel(state.script, state.depth); editor.value = state.script; clearScriptError(); syncControls(); requestRender(); $("save-status").textContent = `Opened “${view.name}”.`; }
      catch { $("save-status").textContent = "This saved location could not be opened."; }
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "saved-delete"; remove.textContent = "×"; remove.setAttribute("aria-label", `Delete ${view.name}`);
    remove.addEventListener("click", () => { if (saveViews(views.filter(item => item.id !== view.id))) $("save-status").textContent = `Deleted “${view.name}”.`; });
    item.append(open, remove); list.appendChild(item);
  }
}
$("save-form").addEventListener("submit", event => {
  event.preventDefault();
  if (busy || renderError || dirty()) return;
  if (views.length >= 50) { $("save-status").textContent = "There are 50 saved locations. Delete one before saving another."; return; }
  const name = $("view-name").value.trim() || `${names[state.mode]} · ${$("magnification").textContent}`;
  const view = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, state: validateState(state) };
  if (saveViews([...views, view])) { $("view-name").value = ""; $("save-status").textContent = `Saved “${name}”.`; }
});
$("download-image").addEventListener("click", () => { if (!busy && !renderError && !dirty()) renderer.download(); });

function closeControls() { document.body.classList.remove("controls-open"); $("controls-toggle").setAttribute("aria-expanded", "false"); }
$("controls-toggle").addEventListener("click", () => {
  const open = document.body.classList.toggle("controls-open"); $("controls-toggle").setAttribute("aria-expanded", String(open));
});
document.addEventListener("keydown", event => { if (event.key === "Escape" && document.body.classList.contains("controls-open")) { closeControls(); $("controls-toggle").focus(); } });
const center = () => ({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
function zoom(factor, point = center()) { state.camera = zoomCamera(state.camera, factor, point, viewport.clientWidth, viewport.clientHeight); requestRender(); }
$("zoom-in").addEventListener("click", () => zoom(0.5));
$("zoom-out").addEventListener("click", () => zoom(2));
function fitView() { state.orbit = { ...DEFAULT_ORBIT }; state.camera = homeCamera(); requestRender(); }
$("fit-view").addEventListener("click", fitView);
viewport.addEventListener("wheel", event => {
  if (event.target.closest("button")) return;
  event.preventDefault();
  const rect = viewport.getBoundingClientRect(), scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
  zoom(Math.exp(Math.max(-400, Math.min(400, event.deltaY * scale)) * 0.0016), { x: event.clientX - rect.left, y: event.clientY - rect.top });
}, { passive: false });
viewport.addEventListener("dblclick", event => { if (!event.target.closest("button")) { const rect = viewport.getBoundingClientRect(); zoom(0.5, { x: event.clientX - rect.left, y: event.clientY - rect.top }); } });
const pointers = new Map();
let panGesture = false;
let pinch = null;
const localPoint = event => { const rect = viewport.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
const pinchState = () => {
  const [a, b] = [...pointers.values()];
  return { middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
};
viewport.addEventListener("pointerdown", event => {
  if (![0, 2].includes(event.button) || event.target.closest("button")) return;
  if (document.body.classList.contains("controls-open") && matchMedia("(max-width: 800px)").matches) { closeControls(); return; }
  event.preventDefault(); viewport.focus({ preventScroll: true });
  if (!pointers.size) panGesture = event.shiftKey || event.button === 2;
  pointers.set(event.pointerId, localPoint(event)); viewport.setPointerCapture(event.pointerId); viewport.classList.add("is-dragging");
  if (pointers.size === 2) pinch = pinchState();
});
viewport.addEventListener("pointermove", event => {
  const point = localPoint(event), previous = pointers.get(event.pointerId);
  const world = screenToWorld(state.camera, point, viewport.clientWidth, viewport.clientHeight);
  $("coordinates").textContent = `${world.x.toPrecision(8)} ${world.y < 0 ? "−" : "+"} ${Math.abs(world.y).toPrecision(8)}i`;
  if (!previous) return;
  pointers.set(event.pointerId, point);
  if (pointers.size >= 2 && pinch) {
    const next = pinchState();
    const anchor = screenToWorld(state.camera, pinch.middle, viewport.clientWidth, viewport.clientHeight);
    state.camera = zoomCamera(state.camera, pinch.distance / next.distance, pinch.middle, viewport.clientWidth, viewport.clientHeight);
    const units = state.camera.span / viewport.clientHeight;
    state.camera.x = anchor.x - (next.middle.x - viewport.clientWidth / 2) * units;
    state.camera.y = anchor.y - (viewport.clientHeight / 2 - next.middle.y) * units;
    pinch = next;
  } else if (isSolid(state.mode) && !panGesture) {
    state.orbit.yaw = (state.orbit.yaw - (point.x - previous.x) * 0.008) % (Math.PI * 2);
    state.orbit.pitch = Math.max(-1.5, Math.min(1.5, state.orbit.pitch + (point.y - previous.y) * 0.008));
  } else {
    const units = state.camera.span / viewport.clientHeight;
    state.camera.x -= (point.x - previous.x) * units; state.camera.y += (point.y - previous.y) * units;
  }
  requestRender();
});
viewport.addEventListener("contextmenu", event => { if (isSolid(state.mode)) event.preventDefault(); });
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) viewport.addEventListener(type, event => {
  pointers.delete(event.pointerId); if (pointers.size < 2) pinch = null;
  if (!pointers.size) viewport.classList.remove("is-dragging");
});
viewport.addEventListener("keydown", event => {
  if (event.target !== viewport) return;
  const amount = state.camera.span * (event.shiftKey ? 0.2 : 0.05);
  if (["+", "="].includes(event.key)) zoom(0.5);
  else if (event.key === "-") zoom(2);
  else if (event.key === "Home") fitView();
  else if (event.key.startsWith("Arrow")) {
    if (isSolid(state.mode) && !event.shiftKey) {
      if (event.key === "ArrowLeft") state.orbit.yaw -= 0.1;
      if (event.key === "ArrowRight") state.orbit.yaw += 0.1;
      if (event.key === "ArrowUp") state.orbit.pitch = Math.min(1.5, state.orbit.pitch + 0.1);
      if (event.key === "ArrowDown") state.orbit.pitch = Math.max(-1.5, state.orbit.pitch - 0.1);
    } else {
      if (event.key === "ArrowLeft") state.camera.x -= amount;
      if (event.key === "ArrowRight") state.camera.x += amount;
      if (event.key === "ArrowUp") state.camera.y += amount;
      if (event.key === "ArrowDown") state.camera.y -= amount;
    }
    requestRender();
  } else return;
  event.preventDefault();
});

editor.value = editorSource; syncControls(); renderViews();
if (!restored) state.camera = homeCamera();
let lastSize = "";
new ResizeObserver(() => {
  const size = `${viewport.clientWidth}x${viewport.clientHeight}`;
  if (size !== lastSize) { lastSize = size; requestRender(); }
}).observe(viewport);
Object.defineProperty(window, "fractalExplorer", { value: Object.freeze({ snapshot: () => ({ state: structuredClone(state), busy, error: renderError || ($("script-error").hidden ? "" : $("script-error").textContent), editorDirty: dirty(), renderer: renderer.kind, stats: { ...renderer.stats }, saved: views.map(view => ({ ...view, state: structuredClone(view.state) })) }) }) });
requestRender();
