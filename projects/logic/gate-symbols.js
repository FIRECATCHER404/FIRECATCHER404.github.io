/* Original vector gate drawings, shared by the canvas and component library. */
(() => {
  'use strict';
  const shapes = new Map(), paths = new Map();
  const inverted = new Set(['NOT', 'NAND', 'NOR']);
  const number = n => Number(n.toFixed(4));

  function shape(type, inputs) {
    const key = `${type}:${inputs}`;
    if (shapes.has(key)) return shapes.get(key);
    if (type === 'PULSE' || type === 'REGISTER') {
      const result = type === 'PULSE'
        ? { body: 'M22 28H78V72H22Z', extra: 'M30 59H39V41H50V59H61V41H70', leads: 'M78 50H92', bubble: '' }
        : { body: 'M28 25H76V75H28Z', extra: 'M28 61.5L35 66.5L28 71.5', leads: 'M8 33.5H28M8 66.5H28M76 50H92', bubble: '' };
      shapes.set(key, result); return result;
    }
    const isAnd = type === 'AND' || type === 'NAND';
    const isNot = type === 'NOT';
    // The D-shaped front, concave OR back and separate XOR curve follow the
    // example's symbol style. Bubble edges meet the gate and output lead.
    const body = isNot ? 'M32 27L65 50L32 73Z'
      : isAnd ? 'M28 25H49A25 25 0 0 1 49 75H28Z'
      : 'M25 25H49A25 25 0 0 1 49 75H25Q45 50 25 25Z';
    const extra = type === 'XOR' ? 'M18 25Q38 50 18 75' : '';
    const tip = isNot ? 65 : 74;
    const output = inverted.has(type) ? tip + 8 : tip;
    let leads = `M${output} 50H92`;
    for (let i = 0; i < inputs; i++) {
      const y = 17 + 66 * ((i + .5) / inputs);
      // Keep the existing interactive ports. Dense variants fan into the
      // symbol without merging inputs or changing saved wire connections.
      const entryY = inputs > 4 ? 26 + 48 * ((i + .5) / inputs) : y;
      const t = (entryY - 25) / 50;
      const entryX = isNot ? 32 : isAnd ? 28
        : (type === 'XOR' ? 18 : 25) + 40 * t * (1 - t);
      leads += inputs > 4
        ? `M8 ${number(y)}H12L17 ${number(entryY)}H${number(entryX)}`
        : `M8 ${number(y)}H${number(entryX)}`;
    }
    const bubble = inverted.has(type)
      ? `M${tip} 50a4 4 0 1 0 8 0a4 4 0 1 0 -8 0` : '';
    const result = { body, extra, leads, bubble };
    shapes.set(key, result); return result;
  }

  function draw(ctx, type, inputs, x, y, size, ink) {
    const key = `${type}:${inputs}`;
    if (!paths.has(key)) {
      const drawing = shape(type, inputs);
      paths.set(key, new Path2D(drawing.leads + drawing.body + drawing.extra + drawing.bubble));
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100);
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.7, 85 / size); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke(paths.get(key)); ctx.restore();
  }

  function icon(type, inputs) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 18 100 64'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '3');
    svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('stroke-linecap', 'round');
    const drawing = shape(type, inputs);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', drawing.leads + drawing.body + drawing.extra + drawing.bubble);
    svg.append(path); return svg;
  }

  window.GateSymbols = { draw, icon };
})();
