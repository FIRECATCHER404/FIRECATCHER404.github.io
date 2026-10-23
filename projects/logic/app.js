/* Offline canvas editor. No network, dependencies, or build step. */
(async () => {
  'use strict';
  const { Circuit, inputCount, hasOutput, example } = Logic;
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const CELL = 96;
  const requestedExample = new URL(location.href).searchParams.get('example');
  const initialExample = ['rgb-lights', 'graphical-computer'].includes(requestedExample) ? requestedExample : null;
  const STORE = initialExample ? `logic-studio-example-${initialExample}-v1` : 'logic-studio-v1';
  const COLORS = { bg: '#ffffff', grid: '#eeeeee', on: '#c5efad', off: '#777777', text: '#222222', muted: '#777777', line: '#777777', panel: '#f6f6f6' };
  let preferences = { theme: 'light', simSpeed: 50, simBatch: 1 };
  try { const saved = JSON.parse(localStorage.getItem('logic-studio-preferences-v1')); if (saved && ['light', 'dark'].includes(saved.theme) && Number.isInteger(saved.simSpeed) && saved.simSpeed >= 0 && saved.simSpeed <= 60000) preferences = { ...saved, simBatch: Number.isInteger(saved.simBatch) && saved.simBatch >= 1 && saved.simBatch <= 256 ? saved.simBatch : 1 }; } catch {}
  const components = [];
  for (const type of ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR']) {
    if (type === 'NOT') components.push({ type, inputs: 1, name: 'NOT', category: 'gates' });
    else {
      const counts = ['AND', 'NAND'].includes(type) ? [2, 3, 4] : [2, 3];
      counts.forEach(inputs => components.push({ type, inputs, name: inputs === 2 ? type : `${type} (${inputs} INPUT)`, category: 'gates' }));
      components.push({ type, inputs: 2, extendible: true, name: `${type} (EXTENDIBLE INPUT)`, category: 'gates' });
    }
  }
  for (const type of ['INPUT', 'OUTPUT', 'TUNNEL', 'RGB', 'RGBTUNNEL', 'PULSE', 'REGISTER']) components.push({ type, name: type, category: type.startsWith('RGB') ? 'color' : 'io' });
  document.querySelector('.tiny-badge').textContent = components.length;
  const state = {
    circuit: example(initialExample === 'rgb-lights' ? 'rgb-lights' : 'adder'), layer: initialExample === 'rgb-lights' ? 1 : 0, camera: { x: 0n, y: 0n, ox: 0, oy: 0, scale: 1 },
    tool: 'select', placing: null, selected: new Set(), wire: null, hover: null,
    pointer: { x: 0, y: 0 }, drag: null, space: false, running: true,
    ghost: false, history: [], future: [], clipboard: null, activeFilter: 'all', dirty: true,
    width: innerWidth, height: innerHeight, lastSimulation: { stable: true }, modified: false,
    theme: preferences.theme, simSpeed: preferences.simSpeed, simBatch: preferences.simBatch, simulationPending: false, simulationSeen: new Set(),
    ioSelection: false, relayGroupId: '', relayDrafts: new Map(), relayOrders: new Map()
  };
  let saveTimer, toastTimer, animation, simulationTimer, simulationFrame, restoring = false, pendingSettings, pendingReplacement, pendingGroup, dropMotion = null;
  let relayOptionsKey = '', relayOrderKey = '';
  const pointers = new Map();
  const hex = v => '#' + (v || 0).toString(16).padStart(6, '0').toUpperCase();
  const shorten = b => { const s = String(b); return s.length > 13 ? s.slice(0, 7) + '…' + s.slice(-3) : s; };
  const nameOf = n => n.type === 'REGISTER' ? 'REGISTER · 1 bit' : n.extendible ? `${n.type} · ${n.inputs} inputs` : inputCount(n) > 1 && inputCount(n) < 24 ? `${n.type} · ${n.inputs} inputs` : n.type;
  function applyTheme() {
    const dark = state.theme === 'dark'; document.documentElement.dataset.theme = state.theme;
    Object.assign(COLORS, { bg: dark ? '#111111' : '#ffffff', grid: dark ? '#252525' : '#eeeeee', text: dark ? '#eeeeee' : '#222222', muted: dark ? '#aaaaaa' : '#777777', off: dark ? '#aaaaaa' : '#777777', line: dark ? '#999999' : '#777777', panel: dark ? '#222222' : '#f6f6f6' });
    document.querySelector('meta[name="theme-color"]').content = COLORS.bg;
  }
  const hasPulses = () => state.circuit.pulses.size > 0;
  function stopTicks() {
    clearTimeout(simulationTimer); cancelAnimationFrame(simulationFrame);
    simulationTimer = simulationFrame = null;
  }
  function signature() { return [...state.circuit.nodes.values()].map(n => `${state.circuit.values.get(n.id) || 0}${n.type === 'REGISTER' ? ':' + n.clock : ''}`).join(','); }
  function scheduleTick() {
    if (simulationTimer || simulationFrame || !state.running || state.lastSimulation.oscillating || (!state.simulationPending && !hasPulses())) return;
    if (state.simSpeed === 0 && hasPulses()) simulationFrame = requestAnimationFrame(simulationTick);
    else simulationTimer = setTimeout(simulationTick, state.simSpeed);
  }
  function requestSimulation() {
    stopTicks();
    state.simulationSeen = new Set([signature()]); state.simulationPending = true;
    state.lastSimulation = { stable: false, oscillating: false };
    if (!state.running) return;
    if (state.simSpeed === 0) { state.lastSimulation = state.circuit.settle(); state.simulationPending = false; }
    scheduleTick();
  }
  function simulationTick() {
    simulationTimer = simulationFrame = null; if (!state.running || (!state.simulationPending && !hasPulses())) return;
    let result;
    if (state.simSpeed === 0) {
      const start = performance.now();
      for (let frame = 0; frame < state.simBatch; frame++) {
        result = state.circuit.advanceFrame();
        if (!result.stable || performance.now() - start >= 8) break;
      }
    } else result = state.circuit.step();
    if (result.stable) { state.simulationPending = false; state.simulationSeen.clear(); }
    else if (!hasPulses()) {
      const sig = signature();
      if (state.simulationSeen.has(sig)) { result.oscillating = true; state.simulationPending = false; }
      else {
        state.simulationSeen.add(sig);
        const capacity = Math.max(2, Math.min(512, Math.floor(8000000 / Math.max(1, sig.length))));
        if (state.simulationSeen.size > capacity) state.simulationSeen.delete(state.simulationSeen.values().next().value);
      }
    }
    state.lastSimulation = result; updateUI(); render(); saveSoon(); scheduleTick();
  }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3500); }
  function snapshot() {
    return JSON.stringify({ ...state.circuit.toJSON(), editor: { layer: state.layer, camera: { ...state.camera, x: String(state.camera.x), y: String(state.camera.y) }, ghost: state.ghost, running: state.running, simSpeed: state.simSpeed, simBatch: state.simBatch } });
  }
  function checkpoint() {
    state.history.push(snapshot());
    if (state.history.length > 64) state.history.shift();
    state.future = [];
  }
  function restore(text, preserveView = false) {
    const data = JSON.parse(text), c = Circuit.fromJSON(data);
    stopTicks(); state.simulationPending = false; state.simulationSeen.clear();
    state.circuit = c; state.selected.clear(); state.wire = null; state.placing = null; state.drag = null; state.ioSelection = false; state.relayDrafts.clear(); state.relayOrders.clear(); relayOrderKey = '';
    if (data.editor && !preserveView) {
      state.layer = Number.isInteger(data.editor.layer) ? Math.max(0, Math.min(255, data.editor.layer)) : 0;
      const cam = data.editor.camera;
      if (cam && /^-?\d{1,1024}$/.test(cam.x) && /^-?\d{1,1024}$/.test(cam.y) && Number.isFinite(cam.scale) && cam.scale >= 1e-200 && cam.scale <= 32 && Number.isFinite(cam.ox) && Number.isFinite(cam.oy) && Math.abs(cam.ox) < 1e7 && Math.abs(cam.oy) < 1e7) state.camera = { x: BigInt(cam.x), y: BigInt(cam.y), ox: cam.ox, oy: cam.oy, scale: cam.scale };
      state.ghost = !!data.editor.ghost; state.running = data.editor.running !== false;
      if (Number.isInteger(data.editor.simSpeed) && data.editor.simSpeed >= 0 && data.editor.simSpeed <= 60000) state.simSpeed = data.editor.simSpeed;
      if (Number.isInteger(data.editor.simBatch) && data.editor.simBatch >= 1 && data.editor.simBatch <= 256) state.simBatch = data.editor.simBatch;
      else if (initialExample === 'graphical-computer' || data.name === 'Graphical 8-bit computer - RGB-8') state.simBatch = 64;
    }
    state.lastSimulation = state.running ? c.settle() : { stable: true, oscillating: false };
    $('project-name').value = c.name; $('ghost').checked = state.ghost;
    updateUI(); renderLibrary(); render(); scheduleTick();
  }
  function saveSoon() {
    if (restoring) return;
    state.modified = true; $('save-state').textContent = 'Saving…';
    if (!hasPulses() || !saveTimer) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); }
  }
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    try { localStorage.setItem(STORE, snapshot()); state.modified = false; $('save-state').textContent = 'Saved locally'; }
    catch { $('save-state').textContent = 'Export to save'; if (state.modified) toast('Browser storage is full or unavailable. Export your circuit to keep it.'); }
  }
  function changed(simulate = true) {
    if (simulate) requestSimulation();
    updateUI(); render(); saveSoon(); scheduleTick();
  }
  function edit(action) {
    const before = snapshot();
    try { action(); state.history.push(before); if (state.history.length > 64) state.history.shift(); state.future = []; changed(); }
    catch (error) { toast(error.message); render(); }
  }
  function undo(redo = false) {
    const from = redo ? state.future : state.history, to = redo ? state.history : state.future;
    if (!from.length) return;
    to.push(snapshot()); restore(from.pop()); saveSoon(); toast(redo ? 'Change restored' : 'Change undone');
  }
  function updateUI() {
    const c = state.circuit, nodes = c.layers.get(state.layer)?.size || 0;
    $('layer-label').textContent = `Layer ${String(state.layer + 1).padStart(3, '0')}`;
    $('layer-number').value = state.layer + 1; $('layer-node-count').textContent = `${nodes} component${nodes === 1 ? '' : 's'}`;
    $('layer-up').disabled = state.layer === 255; $('layer-down').disabled = state.layer === 0;
    $('counts').textContent = `${c.nodes.size} nodes · ${c.wires.size} wires`;
    $('selection-count').textContent = state.selected.size ? `${state.selected.size} selected` : 'Grid snap on';
    $('undo').disabled = !state.history.length; $('redo').disabled = !state.future.length;
    const unstable = state.lastSimulation.oscillating === true;
    $('sim-state').textContent = unstable ? 'Feedback oscillating' : state.running ? hasPulses() ? 'Pulse generators running' : state.simulationPending ? 'Signals propagating' : 'Circuit settled' : !state.lastSimulation.stable ? 'Propagation pending' : 'Simulation paused';
    $('sim-detail').textContent = unstable ? 'Check loop' : state.running ? !state.simSpeed && state.simBatch > 1 ? `${state.simBatch}× turbo` : `${state.simSpeed} ms` : 'Paused';
    $('simulation-summary').textContent = unstable ? 'Oscillating feedback · use Step' : state.running ? hasPulses() ? state.simSpeed ? `Pulses · ${state.simSpeed} ms / frame` : state.simBatch > 1 ? `Pulses · turbo ${state.simBatch}×` : 'Pulses · display frames' : state.simulationPending ? `Propagation · ${state.simSpeed} ms / step` : 'All signals settled' : 'Paused · one frame per step';
    $('sim-light').className = `live-dot${unstable ? ' warning' : state.running ? '' : ' paused'}`;
    $('play').replaceChildren(document.createTextNode(state.running ? 'Ⅱ ' : '▶ '));
    const playLabel = document.createElement('span'); playLabel.textContent = state.running ? 'Pause' : 'Run'; $('play').append(playLabel);
    $('placement').hidden = !state.placing;
    $('placement-name').textContent = state.placing?.name || '';
    document.body.classList.toggle('placing', !!state.placing);
    $('occupied-layers').replaceChildren();
    const layers = [...c.layers.keys()].sort((a, b) => a - b);
    for (const layer of layers) {
      const b = document.createElement('button'); b.textContent = String(layer + 1).padStart(3, '0'); b.className = layer === state.layer ? 'active' : ''; b.title = `${c.layers.get(layer).size} components on layer ${layer + 1}`;
      b.onclick = () => setLayer(layer); $('occupied-layers').append(b);
    }
    const chosen = [...state.selected].map(id => c.nodes.get(id)).filter(Boolean);
    $('selection-panel').hidden = !chosen.length;
    $('selected-actions').replaceChildren();
    if (chosen.length === 1) {
      const n = chosen[0]; $('selected-type').textContent = nameOf(n);
      let desc = `X ${n.x} · Y ${n.y}\n`;
      if (n.type === 'RGB') desc += `${hex(c.values.get(n.id))} · ${c.peers.has(n.id) ? 'bus connected' : 'no adjacent bus'}`;
      else if (n.type === 'RGBTUNNEL') desc += `24 bits → layer ${n.layer + n.direction + 1}\n${hex(c.values.get(n.id))} · ${c.peers.has(n.id) ? 'RGB linked' : 'place RGB at target'}`;
      else if (n.type === 'TUNNEL') desc += `${n.direction === 1 ? 'Up' : 'Down'} → layer ${n.layer + n.direction + 1}\n${c.peers.has(n.id) ? 'Tunnel linked' : 'Place facing tunnel at target'}`;
      else if (n.type === 'PULSE') desc += `Signal ${c.values.get(n.id) || 0} · flips every simulation frame\nPause freezes it; Step flips once.`;
      else if (n.type === 'REGISTER') desc += `Q ${c.values.get(n.id) || 0} · stored bit\nD: top input · CLK: bottom input\nCaptures D on a rising CLK edge.`;
      else desc += `Signal ${c.values.get(n.id) || 0}${n.type === 'INPUT' ? ` · switch ${n.on ? 'on' : 'off'}` : ''}`;
      $('selected-description').textContent = desc; $('selected-description').style.whiteSpace = 'pre-line';
      if (n.type === 'INPUT') addAction('Toggle', () => toggleInput(n));
      if (n.extendible || ['TUNNEL', 'RGBTUNNEL'].includes(n.type)) addAction('Settings', () => settings(n));
      if (['TUNNEL', 'RGBTUNNEL'].includes(n.type)) addAction('Follow ↗', () => { setLayer(n.layer + n.direction); focusAt(n.x, n.y); });
    } else { $('selected-type').textContent = `${chosen.length} components`; $('selected-description').textContent = 'Drag to move together. Copy, paste, or delete the selection.'; }
    addAction('Delete', removeSelected);
    const io = c.selectIO(state.selected);
    if (io.length) addAction('Group / title', () => groupDialog());
    $('io-selection-actions').hidden = !state.ioSelection || !!state.drag || !io.length;
    $('io-selection-summary').textContent = io.length ? `${io.length} ${io[0].type === 'INPUT' ? 'input' : 'output'}${io.length === 1 ? '' : 's'} selected` : '';
    updateRelay();
  }
  function addAction(label, onClick) { const b = document.createElement('button'); b.className = 'action'; b.textContent = label; b.onclick = onClick; $('selected-actions').append(b); }
  const normalizeBinary = text => text.replace(/[\s_]/g, '');
  function relayError(message) { $('relay-error').textContent = message; $('relay-error').hidden = !message; }
  function updateRelay() {
    const c = state.circuit, groups = [...c.groups.values()];
    const optionsKey = JSON.stringify(groups.map(g => [g.id, g.title]));
    if (optionsKey !== relayOptionsKey) {
      $('relay-group').replaceChildren();
      for (const group of groups) { const option = document.createElement('option'); option.value = group.id; option.textContent = group.title; $('relay-group').append(option); }
      relayOptionsKey = optionsKey;
    }
    if (!c.groups.has(state.relayGroupId)) state.relayGroupId = groups[0]?.id || '';
    const group = c.groups.get(state.relayGroupId);
    $('relay-create').disabled = !c.selectIO(state.selected).length;
    $('relay-empty').hidden = !!group; $('relay-content').hidden = !group;
    if (!group) { relayOrderKey = ''; return; }
    $('relay-group').value = group.id;
    const nodes = c.groupNodes(group.id), bits = c.groupBits(group.id);
    const input = group.type === 'INPUT';
    $('relay-summary').textContent = `${nodes.length} ${input ? 'input' : 'output'}${nodes.length === 1 ? '' : 's'} · Layer ${nodes[0].layer + 1}`;
    $('relay-live').textContent = bits;
    $('relay-apply').hidden = !input; $('relay-output-note').hidden = input;
    const orderKey = JSON.stringify([group.id, ...nodes.map(n => [n.id, String(n.x), String(n.y), n.label])]);
    if (orderKey !== relayOrderKey) {
      $('relay-nodes').replaceChildren();
      $('relay-bit-inputs').replaceChildren();
      for (const n of nodes) { const item = document.createElement('li'); item.textContent = `${n.label || n.type} · X ${n.x}, Y ${n.y}`; item.dataset.node = n.id; $('relay-nodes').append(item); }
      if (input) nodes.forEach((n, index) => {
        const label = document.createElement('label'); label.className = 'relay-bit';
        const title = document.createElement('span'); title.textContent = `${index + 1}. ${n.label || 'INPUT'}`; title.title = `X ${n.x}, Y ${n.y}`;
        const field = document.createElement('input'); field.type = 'text'; field.inputMode = 'numeric'; field.maxLength = 1; field.autocomplete = 'off'; field.dataset.index = index; field.dataset.node = n.id;
        field.setAttribute('aria-label', `Bit ${index + 1}: ${n.label || 'INPUT'}`);
        field.onfocus = () => field.select();
        field.oninput = () => {
          const value = field.value;
          const chars = normalizeBinary(state.relayDrafts.get(group.id) || c.groupBits(group.id)).padEnd(nodes.length, '?').slice(0, nodes.length).split('');
          chars[index] = /^[01]$/.test(value) ? value : '?'; state.relayDrafts.set(group.id, chars.join(''));
          relayError(value && !/^[01]$/.test(value) ? 'Each input needs a single 0 or 1.' : '');
          updateRelay();
        };
        field.onkeydown = e => {
          const next = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : null;
          if (next !== null) { e.preventDefault(); $('relay-bit-inputs').querySelector(`[data-index="${next}"]`)?.focus(); }
        };
        field.onpaste = e => {
          e.preventDefault(); const bits = normalizeBinary(e.clipboardData.getData('text'));
          if (!/^[01]+$/.test(bits) || bits.length > nodes.length - index) { relayError(`Paste up to ${nodes.length - index} binary digits here.`); return; }
          const chars = normalizeBinary(state.relayDrafts.get(group.id) || c.groupBits(group.id)).padEnd(nodes.length, '?').slice(0, nodes.length).split('');
          [...bits].forEach((bit, offset) => chars[index + offset] = bit); state.relayDrafts.set(group.id, chars.join('')); relayError(''); updateRelay();
          field.value = bits[0]; $('relay-bit-inputs').querySelector(`[data-index="${Math.min(nodes.length - 1, index + bits.length)}"]`)?.focus();
        };
        label.append(title, field); $('relay-bit-inputs').append(label);
      });
      const memberOrder = JSON.stringify(nodes.map(n => n.id));
      if (state.relayOrders.has(group.id) && state.relayOrders.get(group.id) !== memberOrder) state.relayDrafts.delete(group.id);
      state.relayOrders.set(group.id, memberOrder);
      relayOrderKey = orderKey;
    }
    if (!state.relayDrafts.has(group.id)) state.relayDrafts.set(group.id, bits);
    if (document.activeElement !== $('relay-pattern')) $('relay-pattern').value = state.relayDrafts.get(group.id);
    const draft = normalizeBinary(state.relayDrafts.get(group.id));
    $('relay-bit-inputs').querySelectorAll('input').forEach((field, i) => { if (document.activeElement !== field) field.value = /^[01]$/.test(draft[i] || '') ? draft[i] : ''; });
    $('relay-pattern').placeholder = `${nodes.length} bits, e.g. ${'10'.repeat(Math.ceil(Math.min(nodes.length, 8) / 2)).slice(0, Math.min(nodes.length, 8))}${nodes.length > 8 ? '…' : ''}`;
  }
  function groupDialog(id) {
    const group = id ? state.circuit.groups.get(id) : null;
    const nodes = group ? state.circuit.groupNodes(id) : state.circuit.selectIO(state.selected);
    if (!nodes.length) { toast('Shift-drag a box around INPUT or OUTPUT nodes first.'); return; }
    pendingGroup = { id: group?.id, nodeIds: nodes.map(n => n.id) };
    $('group-dialog-title').textContent = group ? 'Rename relay group' : `Group ${nodes[0].type === 'INPUT' ? 'inputs' : 'outputs'}`;
    $('group-title').value = group?.title || `${nodes[0].type === 'INPUT' ? 'Inputs' : 'Outputs'} ${state.circuit.groups.size + 1}`;
    $('group-dialog-note').textContent = `${nodes.length} nodes. Binary digits follow X, then Y (left to right, then top to bottom at the same X).`;
    $('group-preview').replaceChildren();
    for (const n of nodes) { const item = document.createElement('li'); item.textContent = `${n.label || n.type} · X ${n.x}, Y ${n.y}`; $('group-preview').append(item); }
    $('group-save').textContent = group ? 'Save title' : 'Create group';
    $('group-dialog').showModal(); $('group-title').focus(); $('group-title').select();
  }
  $('group-form').onsubmit = e => {
    e.preventDefault(); if (!pendingGroup) return;
    let saved = false;
    edit(() => {
      const group = pendingGroup.id ? state.circuit.renameGroup(pendingGroup.id, $('group-title').value) : state.circuit.addGroup($('group-title').value, pendingGroup.nodeIds);
      state.relayGroupId = group.id; state.ioSelection = false; saved = true;
    });
    if (saved) { $('group-dialog').close(); pendingGroup = null; openTool('relay', true); updateUI(); }
  };
  $('relay-group').onchange = () => { state.relayGroupId = $('relay-group').value; $('relay-error').hidden = true; updateRelay(); };
  $('relay-pattern').oninput = () => { state.relayDrafts.set(state.relayGroupId, $('relay-pattern').value); relayError(''); updateRelay(); };
  $('relay-apply').onsubmit = e => {
    e.preventDefault(); const bits = normalizeBinary(state.relayDrafts.get(state.relayGroupId) || $('relay-pattern').value);
    try {
      const c = state.circuit, group = c.groups.get(state.relayGroupId);
      if (!group || group.type !== 'INPUT' || !/^[01]+$/.test(bits) || bits.length !== c.groupNodes(group.id).length) throw new Error(`Enter exactly ${group ? c.groupNodes(group.id).length : 0} binary digits (0 or 1).`);
      state.relayDrafts.set(group.id, bits); edit(() => c.setGroupBits(group.id, bits)); relayError(''); updateRelay();
    } catch (error) { $('relay-error').textContent = error.message; $('relay-error').hidden = false; }
  };
  $('relay-create').onclick = $('group-selection').onclick = () => groupDialog();
  $('relay-rename').onclick = () => groupDialog(state.relayGroupId);
  $('relay-delete').onclick = () => edit(() => { state.circuit.removeGroup(state.relayGroupId); state.relayDrafts.delete(state.relayGroupId); });
  $('relay-show').onclick = () => {
    const nodes = state.circuit.groupNodes(state.relayGroupId);
    setLayer(nodes[0].layer); state.selected = new Set(nodes.map(n => n.id)); state.ioSelection = true; fit(); updateUI(); render();
  };
  $('clear-io-selection').onclick = () => { state.selected.clear(); state.ioSelection = false; updateUI(); render(); };
  function selectIOInBox(a, b) {
    const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y), s = cellSize();
    const ids = [];
    for (const n of state.circuit.layers.get(state.layer)?.values() || []) {
      if (n.type !== 'INPUT' && n.type !== 'OUTPUT') continue;
      const p = worldToScreen(n.x, n.y);
      if (p.x + s * .92 >= left && p.x + s * .08 <= right && p.y + s * .92 >= top && p.y + s * .08 <= bottom) ids.push(n.id);
    }
    state.selected = new Set(state.circuit.selectIO(ids).map(n => n.id));
  }
  function setLayer(layer) {
    state.layer = Math.max(0, Math.min(255, layer)); state.selected.clear(); state.wire = null; state.drag = null; state.ioSelection = false; hideContext(); changed(false);
  }
  function renderLibrary() {
    const query = $('search').value.trim().toUpperCase(), list = $('component-list'); list.replaceChildren();
    const symbols = { INPUT: '01', OUTPUT: '◉', TUNNEL: '⇅', RGB: '◈', RGBTUNNEL: '▦' };
    let lastGroup, count = 0;
    for (const spec of components) {
      if ((state.activeFilter !== 'all' && spec.category !== state.activeFilter) || (query && !spec.name.includes(query))) continue;
      if (spec.category !== lastGroup) {
        const h = document.createElement('div'); h.className = 'component-group'; h.textContent = { gates: 'LOGIC GATES', io: 'INPUT / OUTPUT', color: '24-BIT COLOR' }[spec.category]; list.append(h); lastGroup = spec.category;
      }
      const b = document.createElement('button'); b.className = `component${state.placing === spec ? ' active' : ''}`; b.dataset.component = spec.name;
      b.title = `Place ${spec.name}`; b.setAttribute('aria-label', `Place ${spec.name}`);
      const icon = document.createElement('span'); icon.className = `component-icon ${spec.category}`;
      if (spec.category === 'gates' || ['PULSE', 'REGISTER'].includes(spec.type)) {
        if (spec.category !== 'gates') icon.classList.add('sequential');
        icon.append(GateSymbols.icon(spec.type, spec.inputs));
      }
      else icon.textContent = symbols[spec.type];
      const label = document.createElement('span'); label.className = 'component-name'; label.textContent = spec.type;
      const detail = document.createElement('span'); detail.className = 'component-detail'; detail.textContent = spec.type === 'PULSE' ? 'generator' : spec.type === 'REGISTER' ? '1 bit' : spec.extendible ? '2–16 in' : spec.type === 'RGBTUNNEL' ? '24 in' : spec.inputs > 2 ? `${spec.inputs} in` : '';
      const plus = document.createElement('span'); plus.className = 'component-plus'; plus.textContent = '+';
      b.append(icon, label, detail, plus); b.onclick = () => { state.placing = state.placing === spec ? null : spec; state.wire = null; state.drag = null; updateUI(); renderLibrary(); render(); canvas.focus(); };
      list.append(b); count++;
    }
    if (!count) { const p = document.createElement('p'); p.className = 'no-components'; p.textContent = 'No matching components'; list.append(p); }
  }
  const cellSize = () => CELL * state.camera.scale;
  function screenToWorld(x, y) {
    const cam = state.camera, s = cellSize();
    const dx = (x - state.width / 2 - cam.ox) / s, dy = (y - state.height / 2 - cam.oy) / s;
    const ix = Math.floor(dx), iy = Math.floor(dy);
    return { x: cam.x + BigInt(ix), y: cam.y + BigInt(iy), fx: dx - ix, fy: dy - iy };
  }
  function worldToScreen(x, y, fx = 0, fy = 0) {
    return { x: state.width / 2 + state.camera.ox + (Number(x - state.camera.x) + fx) * cellSize(), y: state.height / 2 + state.camera.oy + (Number(y - state.camera.y) + fy) * cellSize() };
  }
  function zoomAt(factor, x = state.width / 2, y = state.height / 2) {
    const anchor = screenToWorld(x, y), cam = state.camera;
    cam.scale = Math.max(1e-200, Math.min(32, cam.scale * factor));
    cam.x = anchor.x; cam.y = anchor.y; cam.ox = x - state.width / 2 - anchor.fx * cellSize(); cam.oy = y - state.height / 2 - anchor.fy * cellSize();
    render(); saveSoon();
  }
  function pan(dx, dy) {
    const cam = state.camera, s = cellSize(); cam.ox += dx; cam.oy += dy;
    const ix = Math.trunc(cam.ox / s), iy = Math.trunc(cam.oy / s);
    cam.x -= BigInt(ix); cam.y -= BigInt(iy); cam.ox -= ix * s; cam.oy -= iy * s;
    render();
  }
  function focusAt(x, y) { state.camera.x = x; state.camera.y = y; state.camera.ox = -cellSize() / 2; state.camera.oy = -cellSize() / 2; render(); saveSoon(); }
  function fit() {
    const nodes = [...(state.circuit.layers.get(state.layer)?.values() || [])];
    if (!nodes.length) { state.camera = { x: 0n, y: 0n, ox: 0, oy: 0, scale: 1 }; render(); return; }
    let minX = nodes[0].x, maxX = minX, minY = nodes[0].y, maxY = minY;
    nodes.forEach(n => { if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x; if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y; });
    const libraryVisible = $('library').classList.contains('tool-open') && !document.body.classList.contains('library-hidden');
    const left = libraryVisible ? $('library').getBoundingClientRect().right + 35 : 40;
    const control = $('relay-panel').classList.contains('tool-open') ? $('relay-panel') : document.querySelector('.right-panels');
    const controlVisible = control.classList.contains('tool-open');
    const right = controlVisible ? control.getBoundingClientRect().left - 35 : state.width - 40;
    let availableW = right - left, centerX = (left + right) / 2;
    if (availableW < 230) { document.body.classList.add('library-hidden'); availableW = state.width - (state.width - right) - 45; centerX = (25 + right) / 2; }
    const availableH = Math.max(150, state.height - (document.querySelector('.topbar').classList.contains('tool-open') ? 280 : 180));
    const scale = Math.min(1.12, availableW / ((Number(maxX - minX) + 2.4) * CELL), availableH / ((Number(maxY - minY) + 2.4) * CELL));
    state.camera = { x: (minX + maxX) / 2n, y: (minY + maxY) / 2n, ox: 0, oy: 0, scale: Math.max(1e-200, scale) };
    const cx = Number(minX + maxX - state.camera.x * 2n) / 2 + .5, cy = Number(minY + maxY - state.camera.y * 2n) / 2 + .5;
    state.camera.ox = centerX - state.width / 2 - cx * cellSize(); state.camera.oy = (state.height - availableH) / 2 + availableH / 2 - state.height / 2 - cy * cellSize(); render(); saveSoon();
  }
  function ports(n) {
    const count = inputCount(n), list = [];
    if (n.type === 'RGBTUNNEL') {
      for (let i = 0; i < 24; i++) {
        const side = Math.floor(i / 6), f = .18 + (i % 6) * .128;
        list.push({ x: side === 0 ? f : side === 1 ? .92 : side === 2 ? 1 - f : .08, y: side === 0 ? .08 : side === 1 ? f : side === 2 ? .92 : 1 - f, kind: 'in', index: i, side });
      }
    } else for (let i = 0; i < count; i++) list.push({ x: .08, y: .17 + .66 * ((i + .5) / count), kind: 'in', index: i, side: 3 });
    if (hasOutput(n)) list.push({ x: .92, y: .5, kind: 'out', index: 0, side: 1 });
    return list;
  }
  function nodePose(n, time = performance.now()) {
    let dx = 0, dy = 0, lift = 0;
    const drag = state.drag;
    if (drag?.kind === 'move' && drag.moved && state.selected.has(n.id)) {
      dx = drag.freeX || 0; dy = drag.freeY || 0;
      lift = 1 - (1 - Math.min(1, (time - drag.liftStart) / 90)) ** 3;
    } else if (dropMotion?.ids.has(n.id)) {
      const t = Math.min(1, (time - dropMotion.start) / 160), remaining = (1 - t) ** 3;
      dx = dropMotion.dx * remaining; dy = dropMotion.dy * remaining; lift = dropMotion.lift * remaining;
    }
    const base = worldToScreen(n.x, n.y), size = cellSize() * (1 + .06 * lift);
    return { x: base.x + dx + (cellSize() - size) / 2, y: base.y + dy + (cellSize() - size) / 2 - 3 * lift, size, lift };
  }
  function portPoint(n, port) { const p = nodePose(n); return { x: p.x + port.x * p.size, y: p.y + port.y * p.size }; }
  function hit(x, y) {
    const w = screenToWorld(x, y), c = state.circuit, s = cellSize();
    if (s < 8) { const n = c.at(state.layer, w.x, w.y); return n ? { node: n } : null; }
    const radius = Math.max(4, Math.min(10, s * .06));
    const cells = [w, { x: w.x - 1n, y: w.y }, { x: w.x + 1n, y: w.y }, { x: w.x, y: w.y - 1n }, { x: w.x, y: w.y + 1n }];
    let nearest = null, nearestDistance = radius;
    for (const cell of cells) {
      const n = c.at(state.layer, cell.x, cell.y); if (!n) continue;
      for (const port of ports(n)) { const p = portPoint(n, port), distance = Math.hypot(x - p.x, y - p.y); if (distance <= nearestDistance) { nearestDistance = distance; nearest = { node: n, port }; } }
    }
    if (nearest) return nearest;
    const n = c.at(state.layer, w.x, w.y);
    if (n && w.fx > .05 && w.fx < .95 && w.fy > .05 && w.fy < .95) return { node: n };
    return null;
  }
  function pathWire(a, b, sourceSide = 1, targetSide = 3) {
    const len = Math.max(28, Math.min(180, Math.hypot(b.x - a.x, b.y - a.y) * .45));
    const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]], av = vectors[sourceSide], bv = vectors[targetSide];
    return { a, b, c: { x: a.x + av[0] * len, y: a.y + av[1] * len }, d: { x: b.x + bv[0] * len, y: b.y + bv[1] * len } };
  }
  function wireGeometry(w) {
    const a = state.circuit.nodes.get(w.from), b = state.circuit.nodes.get(w.to);
    const ap = ports(a).find(p => p.kind === 'out'), bp = ports(b).find(p => p.kind === 'in' && p.index === w.port);
    return pathWire(portPoint(a, ap), portPoint(b, bp), 1, bp.side);
  }
  function drawCurve(g) { ctx.beginPath(); ctx.moveTo(g.a.x, g.a.y); ctx.bezierCurveTo(g.c.x, g.c.y, g.d.x, g.d.y, g.b.x, g.b.y); }
  function hitWire(x, y) {
    let closest = null, distance = 8;
    for (const w of state.circuit.wires.values()) {
      if (state.circuit.nodes.get(w.from).layer !== state.layer) continue;
      const g = wireGeometry(w);
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, u = 1 - t;
        const px = u ** 3 * g.a.x + 3 * u * u * t * g.c.x + 3 * u * t * t * g.d.x + t ** 3 * g.b.x;
        const py = u ** 3 * g.a.y + 3 * u * u * t * g.c.y + 3 * u * t * t * g.d.y + t ** 3 * g.b.y;
        const d = Math.hypot(px - x, py - y); if (d < distance) { distance = d; closest = w; }
      }
    }
    return closest;
  }
  function grid() {
    const s = cellSize();
    // Adaptive grid: draw powers of ten when individual cells become subpixel.
    let exponent = Math.max(0, Math.ceil(Math.log10(18 / s))), spacing = s * 10 ** exponent;
    if (!Number.isFinite(spacing) || spacing < 1) return;
    const stride = 10n ** BigInt(exponent), cam = state.camera;
    const mod = (a, b) => ((a % b) + b) % b;
    const baseX = state.width / 2 + cam.ox - Number(mod(cam.x, stride)) * s;
    const baseY = state.height / 2 + cam.oy - Number(mod(cam.y, stride)) * s;
    const startX = ((baseX % spacing) + spacing) % spacing, startY = ((baseY % spacing) + spacing) % spacing;
    ctx.fillStyle = COLORS.grid;
    for (let x = startX; x < state.width; x += spacing) for (let y = startY; y < state.height; y += spacing) ctx.fillRect(x, y, 1, 1);
    if (s > 35) {
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = .6; ctx.beginPath();
      for (let x = startX; x < state.width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, state.height); }
      for (let y = startY; y < state.height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(state.width, y); } ctx.stroke();
    }
  }
  function visibleNodes(layer) {
    const nodes = state.circuit.layers.get(layer); if (!nodes) return [];
    const a = screenToWorld(-cellSize(), -cellSize()), b = screenToWorld(state.width + cellSize(), state.height + cellSize());
    const nx = b.x - a.x + 1n, ny = b.y - a.y + 1n;
    if (nx > 0n && ny > 0n && nx * ny < BigInt(Math.min(40000, nodes.size * 3))) {
      const found = [];
      for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) { const n = nodes.get(`${x}:${y}`); if (n) found.push(n); }
      return found;
    }
    return [...nodes.values()].filter(n => n.x >= a.x && n.x <= b.x && n.y >= a.y && n.y <= b.y);
  }
  function drawGroups() {
    const s = cellSize(); if (s < 8) return;
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = COLORS.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = '11px Arial,sans-serif';
    for (const group of state.circuit.groups.values()) {
      const nodes = state.circuit.groupNodes(group.id); if (!nodes.length || nodes[0].layer !== state.layer) continue;
      let minX = nodes[0].x, maxX = minX, minY = nodes[0].y, maxY = minY;
      for (const n of nodes) { if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x; if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y; }
      const a = worldToScreen(minX, minY, .015, -.18), b = worldToScreen(maxX, maxY, .985, .985);
      if (![a.x, a.y, b.x, b.y].every(Number.isFinite) || b.x < 0 || b.y < 0 || a.x > state.width || a.y > state.height) continue;
      ctx.setLineDash([3, 4]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
      if (s >= 28) {
        const title = group.title; const width = ctx.measureText(title).width;
        ctx.fillStyle = COLORS.bg; ctx.fillRect(a.x + 5, a.y - 8, width + 8, 15);
        ctx.fillStyle = COLORS.text; ctx.fillText(title, a.x + 9, a.y + 4);
      }
    }
    ctx.restore();
  }
  function drawNode(n, ghost = false, preview = false, dx = 0n, dy = 0n) {
    const pose = !ghost && !preview ? nodePose(n) : null;
    const s = pose?.size || cellSize(), p = pose ? { x: pose.x, y: pose.y } : worldToScreen(n.x + dx, n.y + dy);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x + s < 0 || p.y + s < 0 || p.x > state.width || p.y > state.height) return;
    const value = state.circuit.values.get(n.id) || 0;
    const rgb = n.type === 'RGB';
    const luminance = rgb ? (value >> 16) * .299 + ((value >> 8) & 255) * .587 + (value & 255) * .114 : 0;
    const selected = state.selected.has(n.id) && !ghost, color = rgb ? hex(value) : value ? COLORS.on : COLORS.text;
    ctx.save(); if (ghost) ctx.globalAlpha = .15; if (preview) ctx.globalAlpha = .5;
    if (pose?.lift) { ctx.shadowColor = `rgba(0,0,0,${.18 * pose.lift})`; ctx.shadowBlur = 12 * pose.lift; ctx.shadowOffsetY = 5 * pose.lift; }
    const inset = .08 * s, size = .84 * s;
    if (rgb) {
      // Adjacent cells share the same rounded device-pixel edge. Filling whole
      // pixels avoids hairline seams at fractional zoom/pan and high DPI.
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const end = pose?.lift ? { x: p.x + s, y: p.y + s } : worldToScreen(n.x + dx + 1n, n.y + dy + 1n);
      const left = pose?.lift ? p.x : Math.round(p.x * ratio) / ratio, top = pose?.lift ? p.y : Math.round(p.y * ratio) / ratio;
      const right = pose?.lift ? end.x : Math.round(end.x * ratio) / ratio, bottom = pose?.lift ? end.y : Math.round(end.y * ratio) / ratio;
      ctx.fillStyle = color; ctx.fillRect(left, top, right - left, bottom - top);
    } else {
      ctx.fillStyle = s < 9 ? color : value ? COLORS.on : COLORS.bg;
      ctx.strokeStyle = COLORS.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(p.x + inset, p.y + inset, size, size, .055 * s); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = ctx.shadowOffsetY = 0;
      if (s >= 9) ctx.stroke();
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = ctx.shadowOffsetY = 0;
    if (s < 9) { ctx.restore(); return; }
    if (selected) { ctx.strokeStyle = rgb ? luminance > 145 ? '#222222' : '#ffffff' : COLORS.text; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(p.x + .035 * s, p.y + .035 * s, .93 * s, .93 * s); ctx.setLineDash([]); }
    if (s >= 27) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (n.type === 'RGB') {
        ctx.fillStyle = luminance > 145 ? '#13200e' : '#f0faeb'; ctx.font = `600 ${s * .115}px Consolas,monospace`; ctx.fillText(hex(value), p.x + s / 2, p.y + s * .5);
        ctx.font = `${s * .08}px Consolas,monospace`; ctx.fillText('RGB', p.x + s / 2, p.y + s * .75);
      } else {
        const small = n.type.length > 6;
        const ink = value ? '#222222' : COLORS.text;
        ctx.fillStyle = ink; ctx.font = `${s * (small ? .095 : .13)}px Arial,sans-serif`;
        const symbol = Logic.GATES.includes(n.type) || ['PULSE', 'REGISTER'].includes(n.type);
        ctx.fillText(n.type === 'RGBTUNNEL' ? 'RGB BUS' : n.type, p.x + s * .5, p.y + s * (symbol ? .165 : .38));
        if (['INPUT', 'OUTPUT'].includes(n.type)) {
          ctx.font = `${s * .23}px Arial,sans-serif`; ctx.fillStyle = ink; ctx.fillText(String(value), p.x + s * .5, p.y + s * .65);
        } else if (['TUNNEL', 'RGBTUNNEL'].includes(n.type)) {
          ctx.fillStyle = ink; ctx.font = `${s * .24}px Arial,sans-serif`; ctx.fillText(n.direction === 1 ? '↑' : '↓', p.x + s * .5, p.y + s * .61);
          ctx.font = `${s * .075}px Consolas,monospace`; ctx.fillText(`L${String(n.layer + n.direction + 1).padStart(3, '0')}`, p.x + s * .5, p.y + s * .8);
        } else if (n.type === 'PULSE' || n.type === 'REGISTER') {
          GateSymbols.draw(ctx, n.type, inputCount(n), p.x, p.y, s, ink);
          ctx.fillStyle = ink;
          if (n.type === 'REGISTER') {
            ctx.font = `${s * .09}px Arial,sans-serif`; ctx.fillText('D', p.x + s * .38, p.y + s * .335);
            ctx.fillText('CLK', p.x + s * .51, p.y + s * .665); ctx.fillText('Q', p.x + s * .69, p.y + s * .5);
            ctx.font = `${s * .18}px Arial,sans-serif`; ctx.fillText(String(value), p.x + s * .5, p.y + s * .48);
          } else {
            ctx.font = `${s * .09}px Arial,sans-serif`; ctx.fillText(String(value), p.x + s * .5, p.y + s * .83);
          }
        } else {
          GateSymbols.draw(ctx, n.type, inputCount(n), p.x, p.y, s, ink);
          ctx.font = `${s * .075}px Arial,sans-serif`; ctx.fillStyle = ink; ctx.fillText(n.type === 'NOT' ? '' : `${n.inputs} INPUTS${n.extendible ? ' +' : ''}`, p.x + s / 2, p.y + s * .83);
        }
      }
      if (n.label) { ctx.fillStyle = COLORS.muted; ctx.font = `${Math.min(12, s * .105)}px Arial,sans-serif`; ctx.fillText(n.label, p.x + s * .5, p.y - s * .065); }
    }
    if (!ghost && s > 16 && !preview) for (const port of ports(n)) {
      const pp = { x: p.x + port.x * s, y: p.y + port.y * s };
      const on = port.kind === 'out' ? value : state.circuit.bit(n.id, port.index);
      const radius = Math.min(n.type === 'RGBTUNNEL' || inputCount(n) > 8 ? s * .021 : s * .045, 9);
      const hovered = state.hover?.node.id === n.id && state.hover?.port?.kind === port.kind && state.hover.port.index === port.index;
      ctx.beginPath(); ctx.arc(pp.x, pp.y, Math.max(1.5, radius + (hovered ? 2 : 0)), 0, Math.PI * 2);
      ctx.fillStyle = port.kind === 'out' ? COLORS.bg : on ? COLORS.on : COLORS.text; ctx.strokeStyle = on ? COLORS.on : COLORS.text; ctx.lineWidth = Math.min(2, Math.max(1, s * .015)); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function draw() {
    animation = null; const { width, height } = state;
    const ratio = Math.min(devicePixelRatio || 1, 2); if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height); ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, width, height); grid();
    if (state.ghost) for (const layer of [state.layer - 1, state.layer + 1]) visibleNodes(layer).forEach(n => drawNode(n, true));
    drawGroups();
    const c = state.circuit;
    for (const w of c.wires.values()) {
      if (c.nodes.get(w.from).layer !== state.layer) continue;
      if (w.id === state.wire?.detached) continue;
      const g = wireGeometry(w), padding = 200;
      if (Math.max(g.a.x, g.b.x) < -padding || Math.min(g.a.x, g.b.x) > width + padding || Math.max(g.a.y, g.b.y) < -padding || Math.min(g.a.y, g.b.y) > height + padding) continue;
      if (![g.a.x, g.a.y, g.b.x, g.b.y].every(Number.isFinite)) continue;
      const on = !!c.values.get(w.from); ctx.strokeStyle = on ? COLORS.on : COLORS.line; ctx.lineWidth = Math.max(1, Math.min(2, cellSize() * .02));
      drawCurve(g); ctx.stroke();
    }
    const floating = state.drag?.kind === 'move' && state.drag.moved ? state.selected : dropMotion?.ids;
    visibleNodes(state.layer).forEach(n => { if (!floating?.has(n.id)) drawNode(n); });
    for (const id of floating || []) { const n = c.nodes.get(id); if (n?.layer === state.layer) drawNode(n); }
    if (state.placing && state.pointer.y > 72) { const w = screenToWorld(state.pointer.x, state.pointer.y); drawNode({ ...state.placing, id: 'preview', x: w.x, y: w.y, layer: state.layer, direction: state.layer === 255 ? -1 : 1 }, false, true); }
    if (state.wire) {
      const n = c.nodes.get(state.wire.node), port = state.wire.port;
      if (n) { const p = portPoint(n, port), end = state.pointer;
        const g = port.kind === 'out' ? pathWire(p, end, port.side, state.hover?.port?.side ?? 3) : pathWire(end, p, 1, port.side);
        ctx.strokeStyle = c.values.get(n.id) ? COLORS.on : COLORS.line; ctx.lineWidth = 2; drawCurve(g); ctx.stroke();
      }
    }
    if (state.drag?.kind === 'select') {
      const a = state.drag.start, b = state.pointer; ctx.fillStyle = '#88888815'; ctx.strokeStyle = COLORS.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
    }
    if (state.hover?.port && !state.drag && !state.wire && !state.placing) {
      const { node, port } = state.hover, p = portPoint(node, port);
      let text = port.kind === 'out' ? 'OUTPUT · drag to connect' : `INPUT ${port.index + 1} · ${c.bit(node.id, port.index)}`;
      if (node.type === 'REGISTER') text = port.kind === 'out' ? 'Q · stored bit · drag to connect' : `${port.index === 0 ? 'D · data' : 'CLK · rising edge'} · ${c.bit(node.id, port.index)}`;
      if (node.type === 'RGBTUNNEL') text = `${['R', 'G', 'B'][Math.floor(port.index / 8)]}${7 - port.index % 8} · BIT ${23 - port.index} · ${c.bit(node.id, port.index)}`;
      ctx.font = '10px Consolas,monospace'; const tw = ctx.measureText(text).width;
      ctx.fillStyle = COLORS.panel; ctx.strokeStyle = COLORS.line; ctx.lineWidth = 1; ctx.fillRect(p.x - tw / 2 - 8, p.y - 31, tw + 16, 23); ctx.strokeRect(p.x - tw / 2 - 8, p.y - 31, tw + 16, 23); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = COLORS.text; ctx.fillText(text, p.x, p.y - 19);
    }
    const percent = state.camera.scale * 100; $('zoom-value').textContent = percent < .01 ? percent.toExponential(1) + '%' : Math.round(percent) + '%';
    if (dropMotion && performance.now() - dropMotion.start >= 160) dropMotion = null;
    if (dropMotion || state.drag?.kind === 'move' && state.drag.moved && performance.now() - state.drag.liftStart < 90) render();
  }
  function render() { if (!animation) animation = requestAnimationFrame(draw); }
  function toggleInput(n) { if (n.type !== 'INPUT') return; edit(() => state.circuit.updateNode(n.id, { on: !n.on })); }
  function removeSelected() {
    if (!state.selected.size) return;
    edit(() => { state.circuit.removeNodes(state.selected); state.selected.clear(); state.ioSelection = false; }); hideContext();
  }
  function hideContext() { $('context-menu').hidden = true; }
  function cancel() { state.placing = null; state.wire = null; state.drag = null; state.selected.clear(); state.ioSelection = false; setDrawer(false); hideContext(); updateUI(); renderLibrary(); render(); }
  function chooseTool(tool) { state.tool = tool; state.placing = null; state.wire = null; document.body.dataset.tool = tool; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool)); updateUI(); renderLibrary(); render(); }
  function contextMenu(event) {
    event.preventDefault(); const h = hit(event.clientX, event.clientY), menu = $('context-menu'); menu.replaceChildren();
    const title = document.createElement('div'); title.className = 'context-title'; title.textContent = h ? nameOf(h.node).toUpperCase() : 'CONNECTION'; menu.append(title);
    const item = (text, shortcut, callback, danger = false) => {
      const b = document.createElement('button'); b.role = 'menuitem'; b.className = danger ? 'danger' : ''; b.append(document.createTextNode(text));
      const k = document.createElement('span'); k.textContent = shortcut; b.append(k); b.onclick = () => { hideContext(); callback(); }; menu.append(b);
    };
    if (h) {
      if (!state.selected.has(h.node.id)) { state.selected = new Set([h.node.id]); updateUI(); render(); }
      if (h.node.type === 'INPUT') item('Toggle input', 'Enter', () => toggleInput(h.node));
      if (['INPUT', 'OUTPUT'].includes(h.node.type)) item('Group / title…', 'G', () => groupDialog());
      if (h.node.extendible || ['TUNNEL', 'RGBTUNNEL'].includes(h.node.type)) item('Settings…', '', () => settings(h.node));
      if (['TUNNEL', 'RGBTUNNEL'].includes(h.node.type)) item('Follow to adjacent layer', '↗', () => { setLayer(h.node.layer + h.node.direction); focusAt(h.node.x, h.node.y); });
      if (h.port?.kind === 'in') {
        const w = state.circuit.incoming.get(h.node.id)[h.port.index]; if (w) item('Disconnect input', '', () => edit(() => state.circuit.disconnect(w.id)));
      }
      item(state.selected.size > 1 ? `Delete ${state.selected.size} nodes` : 'Delete node', 'Del', removeSelected, true);
    } else {
      const wire = hitWire(event.clientX, event.clientY); if (!wire) { hideContext(); return; }
      item('Delete wire', '×', () => edit(() => state.circuit.disconnect(wire.id)), true);
    }
    menu.hidden = false; const bounds = menu.getBoundingClientRect(); menu.style.left = `${Math.min(event.clientX, innerWidth - bounds.width - 10)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - bounds.height - 40)}px`;
  }
  function settings(n, placing = false) {
    pendingSettings = { node: n, placing }; $('settings-title').textContent = placing ? `Place ${n.type}` : `Edit ${n.type}`;
    const fields = $('settings-fields'); fields.replaceChildren();
    if (n.extendible) {
      $('settings-note').textContent = 'Choose how many inputs this gate should have. Unconnected inputs are off.';
      const label = document.createElement('label'); label.className = 'field'; label.textContent = 'Number of inputs (2–16)';
      const input = document.createElement('input'); input.id = 'setting-inputs'; input.type = 'number'; input.min = '2'; input.max = '16'; input.step = '1'; input.required = true; input.value = n.inputs || 2; label.append(input); fields.append(label);
    } else {
      $('settings-note').textContent = n.type === 'RGBTUNNEL' ? 'Send 24 bits to an RGB block at this exact grid position on the adjacent layer. Six inputs on each side; bits run clockwise, R7 first.' : 'Match a tunnel at this exact grid position on the adjacent layer, pointing back toward this layer.';
      const label = document.createElement('label'); label.className = 'field'; label.textContent = 'Destination layer';
      const select = document.createElement('select'); select.id = 'setting-direction';
      for (const direction of [1, -1]) {
        const option = document.createElement('option'); option.value = direction; option.textContent = `${direction === 1 ? '↑ Up' : '↓ Down'} one layer${n.layer + direction >= 0 && n.layer + direction < 256 ? ` → Layer ${n.layer + direction + 1}` : ' (unavailable)'}`; option.disabled = n.layer + direction < 0 || n.layer + direction > 255; select.append(option);
      }
      select.value = n.direction || (n.layer === 255 ? -1 : 1); label.append(select); fields.append(label);
    }
    $('settings-dialog').showModal(); fields.querySelector('input,select')?.focus();
  }
  $('settings-form').onsubmit = e => {
    e.preventDefault(); if (!pendingSettings) return;
    const { node, placing } = pendingSettings;
    const changes = node.extendible ? { inputs: Number($('setting-inputs').value) } : { direction: Number($('setting-direction').value) };
    let success = false;
    edit(() => { if (placing) { const n = state.circuit.addNode({ ...node, ...changes }); state.selected = new Set([n.id]); } else state.circuit.updateNode(node.id, changes); success = true; });
    if (success) { $('settings-dialog').close(); pendingSettings = null; }
  };
  function place(x, y) {
    const pos = screenToWorld(x, y), spec = state.placing;
    if (state.circuit.at(state.layer, pos.x, pos.y)) { toast('That grid square is occupied.'); return; }
    const node = { ...spec, x: pos.x, y: pos.y, layer: state.layer, direction: state.layer === 255 ? -1 : 1 };
    if (spec.extendible || ['TUNNEL', 'RGBTUNNEL'].includes(spec.type)) settings(node, true);
    else edit(() => { const n = state.circuit.addNode(node); state.selected = new Set([n.id]); });
  }
  function finishWire(target) {
    if (!state.wire || !target?.port) return false;
    const start = state.wire;
    if (start.port.kind !== 'out' || target.port.kind !== 'in') return false;
    edit(() => { if (start.detached) state.circuit.disconnect(start.detached); state.circuit.connect(start.node, target.node.id, target.port.index); }); state.wire = null; render(); return true;
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button === 2) return;
    hideContext(); canvas.focus(); const { clientX: x, clientY: y } = event; state.pointer = { x, y };
    pointers.set(event.pointerId, { x, y }); canvas.setPointerCapture(event.pointerId);
    if (event.pointerType === 'touch' && pointers.size === 2) {
      const ps = [...pointers.values()]; state.drag = { kind: 'pinch', distance: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), midpoint: { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } }; return;
    }
    const h = hit(x, y);
    if (event.button === 0 && event.shiftKey) {
      state.placing = null; state.wire = null; state.ioSelection = false;
      state.drag = { kind: 'select', io: true, start: { x, y }, before: new Set(state.selected), hit: h, moved: false };
      updateUI(); renderLibrary(); render(); return;
    }
    state.ioSelection = false;
    if (event.button === 1) { event.preventDefault(); if (h?.node.type === 'INPUT') { toggleInput(h.node); state.drag = null; return; } }
    if (event.button === 1 || state.space || state.tool === 'pan') { state.drag = { kind: 'pan', last: { x, y } }; document.body.classList.add('dragging'); return; }
    if (state.placing) { place(x, y); return; }
    if (h?.port) {
      if (h.port.kind === 'out') state.wire = { node: h.node.id, port: h.port, start: { x, y } };
      else {
        const old = state.circuit.incoming.get(h.node.id)[h.port.index];
        if (!old) { state.wire = null; state.drag = null; render(); return; }
        const source = state.circuit.nodes.get(old.from);
        state.wire = { node: old.from, port: ports(source).find(p => p.kind === 'out'), detached: old.id, start: { x, y } };
      }
      state.drag = { kind: 'wire', moved: false }; render(); return;
    }
    if (state.wire) { state.wire = null; render(); return; }
    if (h?.node) {
      if (event.shiftKey) { if (state.selected.has(h.node.id)) state.selected.delete(h.node.id); else state.selected.add(h.node.id); }
      else if (!state.selected.has(h.node.id)) state.selected = new Set([h.node.id]);
      dropMotion = null;
      state.drag = { kind: 'move', start: { x, y }, origin: screenToWorld(x, y), dx: 0n, dy: 0n, freeX: 0, freeY: 0, moved: false, liftStart: performance.now() };
    } else {
      const before = new Set(state.selected); if (!event.shiftKey) state.selected.clear(); state.drag = { kind: 'select', start: { x, y }, before: event.shiftKey ? before : new Set() };
    }
    updateUI(); render();
  });
  canvas.addEventListener('pointermove', event => {
    const { clientX: x, clientY: y } = event; state.pointer = { x, y };
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x, y });
    const drag = state.drag;
    if (drag?.kind === 'pinch' && pointers.size === 2) {
      const ps = [...pointers.values()], d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), midpoint = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      if (drag.distance > 0) zoomAt(d / drag.distance, drag.midpoint.x, drag.midpoint.y); pan(midpoint.x - drag.midpoint.x, midpoint.y - drag.midpoint.y); drag.distance = d; drag.midpoint = midpoint; return;
    }
    const w = screenToWorld(x, y); $('cursor-position').textContent = `X ${shorten(w.x)} · Y ${shorten(w.y)}`;
    if (drag?.kind === 'pan') { pan(x - drag.last.x, y - drag.last.y); drag.last = { x, y }; return; }
    if (drag?.kind === 'move') {
      if (!drag.moved && Math.hypot(x - drag.start.x, y - drag.start.y) > 3) { drag.moved = true; drag.liftStart = performance.now(); }
      drag.freeX = x - drag.start.x; drag.freeY = y - drag.start.y;
      drag.dx = BigInt(Math.round(drag.freeX / cellSize())); drag.dy = BigInt(Math.round(drag.freeY / cellSize())); render();
    }
    else if (drag?.kind === 'select') {
      if (drag.io) {
        drag.moved ||= Math.hypot(x - drag.start.x, y - drag.start.y) > 4;
        if (drag.moved) selectIOInBox(drag.start, { x, y });
        updateUI(); render(); return;
      }
      const a = screenToWorld(drag.start.x, drag.start.y), b = w;
      const minX = a.x < b.x ? a.x : b.x, maxX = a.x > b.x ? a.x : b.x, minY = a.y < b.y ? a.y : b.y, maxY = a.y > b.y ? a.y : b.y;
      state.selected = new Set(drag.before);
      for (const n of state.circuit.layers.get(state.layer)?.values() || []) if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) state.selected.add(n.id);
      updateUI(); render();
    } else if (drag?.kind === 'wire') { drag.moved ||= Math.hypot(x - state.wire.start.x, y - state.wire.start.y) > 5; }
    const hover = hit(x, y); state.hover = hover;
    canvas.style.cursor = state.placing ? 'crosshair' : state.tool === 'pan' || state.space ? 'grab' : hover?.port || state.wire ? 'crosshair' : hover?.node ? 'move' : 'default'; render();
  });
  function endPointer(event, canceled = false) {
    pointers.delete(event.pointerId); const drag = state.drag;
    if (drag?.kind === 'select' && drag.io) {
      if (canceled) { state.selected = drag.before; state.ioSelection = false; }
      else if (drag.moved) { selectIOInBox(drag.start, { x: event.clientX, y: event.clientY }); state.ioSelection = !!state.selected.size; }
      else {
        state.selected = drag.before;
        if (drag.hit?.node) { const id = drag.hit.node.id; if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id); }
      }
    }
    if (!canceled && drag?.kind === 'move' && drag.moved) {
      let committed = !drag.dx && !drag.dy;
      if (drag.dx || drag.dy) edit(() => { state.circuit.moveNodes(state.selected, drag.dx, drag.dy); committed = true; });
      const lift = 1 - (1 - Math.min(1, (performance.now() - drag.liftStart) / 90)) ** 3;
      dropMotion = { ids: new Set(state.selected), dx: drag.freeX - (committed ? Number(drag.dx) * cellSize() : 0), dy: drag.freeY - (committed ? Number(drag.dy) * cellSize() : 0), lift, start: performance.now() };
    }
    if (!canceled && drag?.kind === 'wire') {
      if (drag.moved) {
        if (!finishWire(hit(event.clientX, event.clientY)) && state.wire?.detached) { const id = state.wire.detached; edit(() => state.circuit.disconnect(id)); }
      }
      state.wire = null; render();
    }
    if (canceled) state.wire = null;
    if (drag?.kind === 'pan' || drag?.kind === 'pinch') saveSoon();
    state.drag = null; document.body.classList.remove('dragging'); if (drag?.kind === 'select' && drag.io) updateUI(); render();
  }
  canvas.addEventListener('pointerup', e => endPointer(e)); canvas.addEventListener('pointercancel', e => endPointer(e, true));
  canvas.addEventListener('contextmenu', contextMenu); canvas.addEventListener('auxclick', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? state.height : 1; zoomAt(Math.exp(-Math.max(-500, Math.min(500, e.deltaY * unit)) * (e.ctrlKey ? .009 : .0018)), e.clientX, e.clientY); }, { passive: false });
  canvas.addEventListener('dblclick', event => { const h = hit(event.clientX, event.clientY); if (h?.node.type === 'INPUT') toggleInput(h.node); });
  document.addEventListener('pointerdown', e => { if (!$('context-menu').contains(e.target)) hideContext(); });
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (typing) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    const ctrl = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (ctrl && key === 'z') { e.preventDefault(); undo(e.shiftKey); }
    else if (ctrl && key === 'y') { e.preventDefault(); undo(true); }
    else if (ctrl && key === 's') { e.preventDefault(); saveNow(); toast('Saved locally. Export for a portable copy.'); }
    else if (ctrl && key === 'a') { e.preventDefault(); state.selected = new Set([...(state.circuit.layers.get(state.layer)?.values() || [])].map(n => n.id)); updateUI(); render(); }
    else if (ctrl && key === 'c') { e.preventDefault(); copy(); }
    else if (ctrl && key === 'v') { e.preventDefault(); paste(); }
    else if (e.code === 'Space') { e.preventDefault(); state.space = true; document.body.classList.add('space-held'); canvas.style.cursor = 'grab'; }
    else if (key === 'delete' || key === 'backspace') { e.preventDefault(); removeSelected(); }
    else if (key === 'escape') cancel();
    else if (key === 'enter') { const n = state.circuit.nodes.get([...state.selected][0]); if (n?.type === 'INPUT') toggleInput(n); }
    else if (key === 'f') fit();
    else if (key === '0') { state.camera = { x: 0n, y: 0n, ox: 0, oy: 0, scale: 1 }; render(); saveSoon(); }
    else if (key === 'v') chooseTool('select');
    else if (key === 'p') chooseTool('pan');
    else if (key === 'h' || key === '?') $('help-dialog').showModal();
    else if (key === 'g') groupDialog();
    else if (key === '/') { e.preventDefault(); openTool('components', true); $('search').focus(); }
    else if (key === 'tab') { e.preventDefault(); setDrawer(!document.body.classList.contains('drawer-open')); }
    else if (key === 'pageup') { e.preventDefault(); setLayer(state.layer + 1); }
    else if (key === 'pagedown') { e.preventDefault(); setLayer(state.layer - 1); }
    else if (key === '+' || key === '=') zoomAt(1.25);
    else if (key === '-') zoomAt(.8);
  });
  document.addEventListener('keyup', e => { if (e.code === 'Space') { state.space = false; document.body.classList.remove('space-held'); canvas.style.cursor = ''; } });
  window.addEventListener('blur', () => { state.space = false; state.drag = null; pointers.clear(); document.body.classList.remove('space-held', 'dragging'); render(); });
  function copy() {
    const ids = new Set(state.selected); if (!ids.size) return;
    state.clipboard = { nodes: [...ids].map(id => state.circuit.nodes.get(id)).filter(Boolean).map(n => ({ ...n })), signals: new Map([...ids].map(id => [id, state.circuit.values.get(id) || 0])), wires: [...state.circuit.wires.values()].filter(w => ids.has(w.from) && ids.has(w.to)).map(w => ({ ...w })) };
    toast(`Copied ${ids.size} component${ids.size === 1 ? '' : 's'}`);
  }
  function paste() {
    if (!state.clipboard) return;
    const c = state.circuit, clip = state.clipboard, before = snapshot(), ids = new Map(), added = [];
    let offset = 1n;
    while (clip.nodes.some(n => c.at(state.layer, n.x + offset, n.y + offset))) offset++;
    try {
      for (const n of clip.nodes) { const copy = c.addNode({ ...n, id: undefined, x: n.x + offset, y: n.y + offset, layer: state.layer, direction: state.layer === 255 ? -1 : state.layer === 0 ? 1 : n.direction }); c.values.set(copy.id, clip.signals.get(n.id) || 0); ids.set(n.id, copy.id); added.push(copy.id); }
      for (const w of clip.wires) c.connect(ids.get(w.from), ids.get(w.to), w.port);
      state.selected = new Set(added); state.history.push(before); state.future = []; changed();
    } catch (error) { restore(before); toast(error.message); }
  }
  function exportFile() {
    const blob = new Blob([snapshot()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = (state.circuit.name.replace(/[^a-zA-Z0-9_ -]/g, '').trim() || 'circuit') + '.logic.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast('Circuit exported');
  }
  $('export').onclick = exportFile; $('import').onclick = () => $('file-input').click();
  $('file-input').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text(); const data = JSON.parse(text); Circuit.fromJSON(data);
      const before = snapshot(); restore(text); state.history.push(before); state.future = []; if (!data.editor) fit(); changed(false); toast(`Imported ${state.circuit.nodes.size} components`);
    } catch (error) { toast(`Import failed: ${error.message}`); }
    e.target.value = '';
  };
  function programError(message) { $('program-error').textContent = message; $('program-error').hidden = !message; }
  function openProgram() {
    programError(''); $('program-load').disabled = false;
    try {
      $('program-bytes').value = LogicProgram.format(LogicProgram.read(state.circuit));
      $('program-note').textContent = [...state.circuit.groups.values()].some(g => g.title === '01 RUN') ? 'Current ROM. After loading, turn the RUN input on, or use the circuit’s STEP input.' : 'Current ROM. After loading, use the circuit’s SAMPLE and COMMIT clock controls.';
    }
    catch (error) { $('program-bytes').value = ''; $('program-load').disabled = true; $('program-note').textContent = error.message; }
    $('program-dialog').showModal(); $('program-bytes').focus();
  }
  $('program-open').onclick = () => $('program-file').click();
  $('program-file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 4096) throw new Error('The program is too long for this 16-byte ROM.');
      const bytes = file.name.toLowerCase().endsWith('.bin') ? Array.from(new Uint8Array(await file.arrayBuffer())) : LogicProgram.parse(await file.text());
      if (!bytes.length || bytes.length > 16) throw new Error('A binary program must contain 1–16 bytes.');
      $('program-bytes').value = LogicProgram.format(bytes); programError(''); $('program-note').textContent = `${file.name} · ${bytes.length} bytes ready. Click Load & reset.`;
    } catch (error) { programError(error.message); }
    e.target.value = '';
  };
  $('program-form').onsubmit = e => {
    e.preventDefault();
    try {
      const loaded = LogicProgram.load(state.circuit, LogicProgram.parse($('program-bytes').value));
      edit(() => { state.circuit = loaded.circuit; state.simSpeed = 0; state.selected.clear(); state.wire = null; state.drag = null; });
      $('program-dialog').close(); toast(`${loaded.length} program bytes loaded. CPU reset; ${loaded.runStopped ? 'RUN is off' : 'clock inputs are low'}.`);
    } catch (error) { programError(error.message); }
  };
  function requestReplacement(which) {
    const names = { 'rgb': 'RGB bus', 'rgb-lights': 'RGB lights', 'tunnel': 'layer tunnel', 'adder': 'half adder' };
    pendingReplacement = which; $('confirm-title').textContent = which === 'blank' ? 'Start a blank circuit?' : `Open the ${names[which] || 'half adder'} example?`;
    $('confirm-replace').textContent = which === 'blank' ? 'Start new' : 'Open example';
    $('help-dialog').close(); $('confirm-dialog').showModal();
  }
  $('confirm-dialog').addEventListener('close', () => {
    if ($('confirm-dialog').returnValue === 'export') { exportFile(); $('confirm-dialog').showModal(); return; }
    if ($('confirm-dialog').returnValue !== 'replace') return;
    checkpoint(); state.circuit = pendingReplacement === 'blank' ? new Circuit() : example(pendingReplacement);
    stopTicks(); state.simulationPending = false; state.simulationSeen.clear();
    state.layer = pendingReplacement === 'rgb-lights' ? 1 : 0; state.selected.clear(); state.wire = null; state.placing = null; state.running = true; state.ioSelection = false; state.relayDrafts.clear(); state.relayOrders.clear(); state.relayGroupId = ''; relayOrderKey = '';
    $('project-name').value = state.circuit.name; state.lastSimulation = state.circuit.settle(); fit(); changed(false); renderLibrary();
  });
  $('new-project').onclick = () => requestReplacement('blank');
  document.querySelectorAll('[data-example]').forEach(b => b.onclick = () => requestReplacement(b.dataset.example));
  $('project-name').onchange = () => edit(() => { state.circuit.name = $('project-name').value.trim() || 'Untitled circuit'; $('project-name').value = state.circuit.name; });
  $('help').onclick = $('shortcuts').onclick = () => $('help-dialog').showModal();
  document.querySelectorAll('[data-close-dialog]').forEach(b => b.onclick = () => b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
  $('undo').onclick = () => undo(); $('redo').onclick = () => undo(true);
  $('layer-up').onclick = () => setLayer(state.layer + 1); $('layer-down').onclick = () => setLayer(state.layer - 1);
  $('layer-number').onchange = () => { const value = Number($('layer-number').value); if (Number.isInteger(value) && value >= 1 && value <= 256) setLayer(value - 1); else { $('layer-number').value = state.layer + 1; toast('Choose a layer from 1 to 256.'); } };
  $('ghost').onchange = () => { state.ghost = $('ghost').checked; changed(false); };
  $('play').onclick = () => { state.running = !state.running; if (state.running) requestSimulation(); else stopTicks(); changed(false); };
  $('step').onclick = () => { stopTicks(); state.running = false; state.lastSimulation = state.circuit.step(); state.simulationPending = !state.lastSimulation.stable; changed(false); };
  $('preferences-form').onsubmit = e => {
    e.preventDefault(); const speed = Number($('sim-speed').value), batch = Number($('sim-batch').value), theme = $('theme-select').value;
    if (!Number.isInteger(speed) || speed < 0 || speed > 60000 || !Number.isInteger(batch) || batch < 1 || batch > 256 || !['light', 'dark'].includes(theme)) return;
    state.simSpeed = speed; state.simBatch = batch; state.theme = theme; applyTheme();
    try { localStorage.setItem('logic-studio-preferences-v1', JSON.stringify({ simSpeed: speed, simBatch: batch, theme })); } catch { toast('Settings could not be saved in this browser.'); }
    if (state.running && (state.simulationPending || hasPulses())) requestSimulation();
    $('preferences-dialog').close(); updateUI(); render(); saveSoon();
  };
  $('cancel-placement').onclick = cancel; $('close-selection').onclick = () => { state.selected.clear(); updateUI(); render(); };
  $('search').oninput = renderLibrary;
  document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { state.activeFilter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-selected', x === b)); renderLibrary(); });
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => chooseTool(b.dataset.tool));
  $('zoom-in').onclick = () => zoomAt(1.25); $('zoom-out').onclick = () => zoomAt(.8); $('zoom-value').onclick = () => zoomAt(1 / state.camera.scale); $('fit').onclick = fit;
  $('fullscreen').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { toast('Fullscreen is unavailable here. The canvas already fills this window.'); }
  };
  $('toggle-library').onclick = () => openTool('components');
  document.querySelector('.brand').onclick = e => { e.preventDefault(); fit(); };
  window.addEventListener('resize', () => { state.width = innerWidth; state.height = innerHeight; render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.modified) saveNow(); });
  window.addEventListener('beforeunload', () => { if (state.modified) saveNow(); });
  const toolElements = {
    components: [$('library')], control: [document.querySelector('.right-panels')],
    canvas: [document.querySelector('.tools'), document.querySelector('.bottom-controls'), document.querySelector('.statusbar')],
    project: [document.querySelector('.topbar')], relay: [$('relay-panel')]
  };
  function setDrawer(open) {
    document.body.classList.toggle('drawer-open', open); $('tool-drawer').inert = !open;
    $('drawer-handle').textContent = open ? '‹' : '›'; $('drawer-handle').setAttribute('aria-label', open ? 'Close sidebar' : 'Open sidebar'); $('drawer-handle').setAttribute('aria-expanded', String(open));
    $('tool-drawer').style.removeProperty('transform'); $('drawer-handle').style.removeProperty('left');
  }
  function openTool(name, force) {
    if (name === 'program') { setDrawer(false); openProgram(); return; }
    if (name === 'help') { setDrawer(false); $('help-dialog').showModal(); return; }
    if (name === 'settings') { setDrawer(false); $('sim-speed').value = state.simSpeed; $('sim-batch').value = state.simBatch; $('theme-select').value = state.theme; $('preferences-dialog').showModal(); return; }
    const elements = toolElements[name]; if (!elements) return;
    const open = force ?? !elements[0].classList.contains('tool-open'); elements.forEach(el => el.classList.toggle('tool-open', open));
    if (open && name === 'relay') openTool('control', false);
    if (open && name === 'control') openTool('relay', false);
    const button = document.querySelector(`[data-open-tool="${name}"]`); button.setAttribute('aria-pressed', String(open)); button.querySelector('.drawer-indicator').textContent = open ? '−' : '+';
    if (name === 'components') { document.body.classList.remove('library-hidden'); if (!open) { state.placing = null; state.wire = null; updateUI(); renderLibrary(); } }
    setDrawer(false); render();
  }
  document.querySelectorAll('[data-open-tool]').forEach(b => b.onclick = () => openTool(b.dataset.openTool));
  document.querySelectorAll('[data-close-tool]').forEach(b => b.onclick = () => openTool(b.dataset.closeTool, false));
  let drawerDrag = null, suppressDrawerClick = false;
  $('drawer-handle').addEventListener('pointerdown', e => {
    if (e.button !== 0) return; e.preventDefault();
    drawerDrag = { x: e.clientX, open: document.body.classList.contains('drawer-open'), moved: false };
    $('drawer-handle').setPointerCapture(e.pointerId); document.body.classList.add('drawer-dragging');
  });
  $('drawer-handle').addEventListener('pointermove', e => {
    if (!drawerDrag) return;
    const delta = e.clientX - drawerDrag.x; drawerDrag.moved ||= Math.abs(delta) > 4;
    if (!drawerDrag.moved) return;
    const width = $('tool-drawer').getBoundingClientRect().width, progress = Math.max(0, Math.min(width, (drawerDrag.open ? width : 0) + delta));
    $('tool-drawer').style.transform = `translateX(${progress - width}px)`; $('drawer-handle').style.left = `${progress}px`;
  });
  $('drawer-handle').addEventListener('pointerup', e => {
    if (!drawerDrag) return;
    const width = $('tool-drawer').getBoundingClientRect().width;
    const progress = (drawerDrag.open ? width : 0) + e.clientX - drawerDrag.x;
    suppressDrawerClick = drawerDrag.moved; const open = drawerDrag.moved ? progress > width / 2 : !drawerDrag.open;
    drawerDrag = null; document.body.classList.remove('drawer-dragging'); setDrawer(open);
  });
  $('drawer-handle').addEventListener('pointercancel', () => { const open = drawerDrag?.open || false; drawerDrag = null; document.body.classList.remove('drawer-dragging'); setDrawer(open); });
  $('drawer-handle').onclick = e => { if (e.detail === 0 && !suppressDrawerClick) setDrawer(!document.body.classList.contains('drawer-open')); suppressDrawerClick = false; };
  canvas.addEventListener('pointerdown', () => { if (document.body.classList.contains('drawer-open')) setDrawer(false); });
  applyTheme();
  let loaded = false;
  try { const saved = localStorage.getItem(STORE); if (saved) { restoring = true; restore(saved); loaded = true; } }
  catch { toast('The saved circuit could not be restored. Import an exported copy if needed.'); }
  finally { restoring = false; }
  if (!loaded && initialExample === 'graphical-computer') {
    try {
      // A local script works on file:// without a server or blocked JSON fetch.
      const data = await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = 'examples/graphical-computer.js';
        script.onload = () => resolve(window.LogicGraphicalComputer);
        script.onerror = () => reject(new Error('The graphical computer example file is missing.'));
        document.head.append(script);
      });
      restoring = true; restore(JSON.stringify(data)); loaded = true;
      delete window.LogicGraphicalComputer;
    } catch (error) { toast(error.message); }
    finally { restoring = false; }
  }
  $('project-name').value = state.circuit.name; document.body.dataset.tool = state.tool;
  renderLibrary(); updateUI(); if (!loaded) fit(); render(); scheduleTick();
  // Read-only hooks for integration checks and diagnostics; all editing uses the UI/model.
  window.logicStudio = { get circuit() { return state.circuit; }, get state() { return state; }, screenToWorld, worldToScreen, ports, portPoint, fit, render, snapshot };
})();
