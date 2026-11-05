export const INK = "#474747";
export const INTERACTABLE = "a, button, input, select, textarea, summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link']";

export function isInteractable(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTABLE));
}

export function documentSize() {
  return {
    width: document.documentElement.clientWidth,
    height: Math.max(document.documentElement.clientHeight, document.documentElement.scrollHeight)
  };
}

export function documentPoint(event) {
  return { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };
}

export function createStage(canvas) {
  const context = canvas.getContext("2d");
  let pixelRatio = 1;
  function resize() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
  }
  function clear() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, -window.scrollX * pixelRatio, -window.scrollY * pixelRatio);
  }
  resize();
  return { canvas, context, resize, clear };
}

export function collectSolids() {
  const solids = [];
  const bounds = documentSize();
  const measure = document.createElement("canvas").getContext("2d");
  function append(rect, label, rounded = false) {
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;
    if (rect.width < 1 || rect.height < 1 || x + rect.width < 0 || y + rect.height < 0 || x >= bounds.width || y >= bounds.height) return;
    solids.push({ x, y, width: rect.width, height: rect.height, rounded, label });
  }
  for (const element of document.querySelectorAll(INTERACTABLE)) {
    if (!element.checkVisibility()) continue;
    append(element.getBoundingClientRect(), "button:" + element.textContent.trim(), element.classList.contains("btn"));
  }
  // A text Range includes the font's invisible ascent/descent and spaces. Use
  // each visible glyph's ink metrics so shapes meet the letters themselves.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const element = node.parentElement;
    if (!node.textContent.trim() || !element || element.closest("script, style, canvas, noscript, [hidden]")) continue;
    if (isInteractable(element) || !element.checkVisibility()) continue;
    const style = getComputedStyle(element);
    measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const range = document.createRange();
    let offset = 0;
    for (const character of node.textContent) {
      const start = offset;
      offset += character.length;
      if (!character.trim()) continue;
      range.setStart(node, start);
      range.setEnd(node, offset);
      const metrics = measure.measureText(character);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      const fontAscent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * 0.8;
      for (const rect of range.getClientRects()) append({
        left: rect.left - metrics.actualBoundingBoxLeft,
        top: rect.top + fontAscent - ascent,
        width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
        height: ascent + descent
      }, "text:" + character);
    }
  }
  return solids;
}

export function watchLayout(callback) {
  let requested = false;
  const schedule = () => {
    if (requested) return;
    requested = true;
    requestAnimationFrame(() => {
      requested = false;
      callback();
    });
  };
  const observer = new ResizeObserver(schedule);
  for (const element of [document.body, ...document.querySelectorAll("main, footer")]) observer.observe(element);
  window.addEventListener("resize", schedule);
  document.fonts.ready.then(schedule);
  return observer;
}

export function exposeDiagnostics(snapshot) {
  Object.defineProperty(window, "pageBackground", {
    configurable: true,
    value: Object.freeze({ snapshot })
  });
}
