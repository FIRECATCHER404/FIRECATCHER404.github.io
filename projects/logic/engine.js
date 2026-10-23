/* Logic Studio: dependency-free circuit model. Works from file:// and in Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_LAYERS = 256;
  const GATES = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'];
  const SPECIAL = ['INPUT', 'OUTPUT', 'TUNNEL', 'RGB', 'RGBTUNNEL', 'PULSE', 'REGISTER'];
  const key = (layer, x, y) => `${layer}:${x}:${y}`;
  const comparePosition = (a, b) => a.x < b.x ? -1 : a.x > b.x ? 1 : a.y < b.y ? -1 : a.y > b.y ? 1 : a.id.localeCompare(b.id);
  function inputCount(node) {
    if (['INPUT', 'RGB', 'PULSE'].includes(node.type)) return 0;
    if (node.type === 'REGISTER') return 2;
    if (node.type === 'RGBTUNNEL') return 24;
    if (['NOT', 'OUTPUT', 'TUNNEL'].includes(node.type)) return 1;
    return node.inputs;
  }
  function hasOutput(node) { return !['OUTPUT', 'RGB', 'RGBTUNNEL'].includes(node.type); }
  function gate(type, bits) {
    switch (type) {
      case 'AND': return +bits.every(Boolean);
      case 'NAND': return +!bits.every(Boolean);
      case 'OR': return +bits.some(Boolean);
      case 'NOR': return +!bits.some(Boolean);
      case 'XOR': return bits.reduce((a, b) => a ^ +!!b, 0);
      case 'NOT': return +!bits[0];
      default: return +!!bits[0];
    }
  }
  function integerCoordinate(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Coordinates must be exact integers.');
    if (!/^-?\d{1,1024}$/.test(String(value))) throw new Error('Invalid grid coordinate.');
    return BigInt(value);
  }
  function validateNode(data) {
    if (data && ['RAM', 'ROM'].includes(data.type)) throw new Error('RAM and ROM chips require the desktop edition.');
    if (!data || ![...GATES, ...SPECIAL].includes(data.type)) throw new Error('Unknown node type.');
    const layer = data.layer ?? 0;
    if (!Number.isInteger(layer) || layer < 0 || layer >= MAX_LAYERS) throw new Error('Layers must be between 1 and 256.');
    let inputs = data.inputs ?? (data.type === 'NOT' ? 1 : 2);
    if (GATES.includes(data.type) && data.type !== 'NOT') {
      const allowed = ['OR', 'NOR', 'XOR'].includes(data.type) ? [2, 3] : [2, 3, 4];
      if (!Number.isInteger(inputs) || inputs < 2 || inputs > 16 || (!data.extendible && !allowed.includes(inputs))) throw new Error('Invalid input count (2–16 for extendible gates).');
    }
    let direction = data.direction ?? (layer === 255 ? -1 : 1);
    if (['TUNNEL', 'RGBTUNNEL'].includes(data.type) &&
        (![1, -1].includes(direction) || layer + direction < 0 || layer + direction >= MAX_LAYERS)) throw new Error('The tunnel must target an adjacent layer between 1 and 256.');
    if (data.type === 'REGISTER' && data.clock !== undefined && ![0, 1].includes(data.clock)) throw new Error('Invalid register clock state.');
    return {
      id: String(data.id ?? ''), type: data.type, layer,
      x: integerCoordinate(data.x ?? 0), y: integerCoordinate(data.y ?? 0),
      inputs, extendible: !!data.extendible, direction,
      on: !!data.on, label: typeof data.label === 'string' ? data.label.slice(0, 80) : '',
      ...(data.type === 'REGISTER' ? { clock: data.clock ?? 0 } : {})
    };
  }
  class Circuit {
    constructor() {
      this.nodes = new Map(); this.wires = new Map(); this.groups = new Map(); this.nextId = 1;
      this.values = new Map(); this.name = 'Untitled circuit'; this.rebuild();
    }
    id(prefix) { let id; do { id = `${prefix}${this.nextId++}`; } while (this.nodes.has(id) || this.wires.has(id) || this.groups.has(id)); return id; }
    selectIO(ids) {
      const nodes = [...new Set(ids)].map(id => this.nodes.get(id)).filter(Boolean);
      const inputs = nodes.filter(n => n.type === 'INPUT');
      return (inputs.length ? inputs : nodes.filter(n => n.type === 'OUTPUT')).sort(comparePosition);
    }
    groupNodes(id) {
      const group = this.groups.get(id); if (!group) throw new Error('Relay group not found.');
      return group.nodeIds.map(nodeId => this.nodes.get(nodeId)).filter(Boolean).sort(comparePosition);
    }
    addGroup(title, ids) {
      const nodes = this.selectIO(ids);
      if (!nodes.length) throw new Error('Select at least one INPUT or OUTPUT node.');
      if (nodes.some(n => n.layer !== nodes[0].layer)) throw new Error('A relay group must be on one layer.');
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 80) throw new Error('Give the group a title (1–80 characters).');
      const group = { id: this.id('g'), title: title.trim(), type: nodes[0].type, nodeIds: nodes.map(n => n.id) };
      this.groups.set(group.id, group); return group;
    }
    renameGroup(id, title) {
      const group = this.groups.get(id); if (!group) throw new Error('Relay group not found.');
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 80) throw new Error('Give the group a title (1–80 characters).');
      group.title = title.trim(); return group;
    }
    removeGroup(id) { this.groups.delete(id); }
    groupBits(id) {
      return this.groupNodes(id).map(n => n.type === 'INPUT' ? +n.on : +(!!this.values.get(n.id))).join('');
    }
    setGroupBits(id, bits) {
      const group = this.groups.get(id); if (!group) throw new Error('Relay group not found.');
      if (group.type !== 'INPUT') throw new Error('Output groups display the circuit result and cannot be driven.');
      const nodes = this.groupNodes(id);
      if (typeof bits !== 'string' || !/^[01]+$/.test(bits) || bits.length !== nodes.length) throw new Error(`Enter exactly ${nodes.length} binary digits (0 or 1).`);
      nodes.forEach((n, i) => { n.on = bits[i] === '1'; });
      this.needsSettle = true;
    }
    rebuild() {
      this.needsSettle = true;
      this.positions = new Map(); this.layers = new Map(); this.incoming = new Map(); this.dependents = new Map();
      this.pulses = new Set(); this.registers = new Set();
      for (const n of this.nodes.values()) {
        if (n.type === 'PULSE') this.pulses.add(n.id);
        if (n.type === 'REGISTER') this.registers.add(n.id);
        this.positions.set(key(n.layer, n.x, n.y), n);
        if (!this.layers.has(n.layer)) this.layers.set(n.layer, new Map());
        this.layers.get(n.layer).set(`${n.x}:${n.y}`, n);
        this.incoming.set(n.id, []); this.dependents.set(n.id, new Set());
      }
      for (const w of this.wires.values()) {
        this.incoming.get(w.to)[w.port] = w;
        this.dependents.get(w.from).add(w.to);
      }
      this.peers = new Map();
      for (const n of this.nodes.values()) {
        if (n.type === 'TUNNEL') {
          const peer = this.at(n.layer + n.direction, n.x, n.y);
          if (peer?.type === 'TUNNEL' && peer.layer + peer.direction === n.layer) {
            this.peers.set(n.id, peer.id);
            const incoming = this.incoming.get(peer.id)[0];
            if (incoming) this.dependents.get(incoming.from).add(n.id);
          }
        } else if (n.type === 'RGBTUNNEL') {
          const peer = this.at(n.layer + n.direction, n.x, n.y);
          if (peer?.type === 'RGB') {
            if (this.peers.has(peer.id)) throw new Error('An RGB block can receive only one RGBTUNNEL.');
            this.peers.set(peer.id, n.id); this.peers.set(n.id, peer.id);
            this.dependents.get(n.id).add(peer.id);
          }
        }
      }
    }
    at(layer, x, y) { return this.positions.get(key(layer, x, y)); }
    addNode(data) {
      const n = validateNode(data); n.id ||= this.id('n');
      if (this.nodes.has(n.id) || this.wires.has(n.id) || this.groups.has(n.id)) throw new Error('Duplicate identifier.');
      if (this.at(n.layer, n.x, n.y)) throw new Error('That grid square already contains a node.');
      this.nodes.set(n.id, n);
      try { this.rebuild(); } catch (error) { this.nodes.delete(n.id); this.rebuild(); throw error; }
      return n;
    }
    updateNode(id, changes) {
      const old = this.nodes.get(id); if (!old) throw new Error('Node not found.');
      const n = validateNode({ ...old, ...changes, id });
      if ((n.type !== old.type || n.layer !== old.layer) && [...this.groups.values()].some(g => g.nodeIds.includes(id))) throw new Error('Ungroup this node before changing its type or layer.');
      const occupied = this.at(n.layer, n.x, n.y);
      if (occupied && occupied.id !== id) throw new Error('That grid square already contains a node.');
      const removed = [...this.wires.values()].filter(w => w.to === id && w.port >= inputCount(n));
      removed.forEach(w => this.wires.delete(w.id)); this.nodes.set(id, n);
      try { this.rebuild(); } catch (error) {
        this.nodes.set(id, old); removed.forEach(w => this.wires.set(w.id, w)); this.rebuild(); throw error;
      }
      return n;
    }
    moveNodes(ids, dx, dy) {
      const chosen = new Set(ids); const moving = [...chosen].map(id => this.nodes.get(id)).filter(Boolean);
      for (const n of moving) {
        const occupant = this.at(n.layer, n.x + dx, n.y + dy);
        if (occupant && !chosen.has(occupant.id)) throw new Error('A destination grid square is occupied.');
      }
      const old = moving.map(n => ({ ...n }));
      moving.forEach(n => { n.x += dx; n.y += dy; });
      try { this.rebuild(); } catch (error) { old.forEach(n => this.nodes.set(n.id, n)); this.rebuild(); throw error; }
    }
    removeNodes(ids) {
      const set = new Set(ids);
      for (const id of set) { this.nodes.delete(id); this.values.delete(id); }
      for (const [id, w] of this.wires) if (set.has(w.from) || set.has(w.to)) this.wires.delete(id);
      for (const [id, group] of this.groups) {
        group.nodeIds = group.nodeIds.filter(nodeId => !set.has(nodeId));
        if (!group.nodeIds.length) this.groups.delete(id);
      }
      this.rebuild();
    }
    connect(from, to, port = 0) {
      const a = this.nodes.get(from), b = this.nodes.get(to);
      if (!a || !b || !hasOutput(a) || a.layer !== b.layer || !Number.isInteger(port) || port < 0 || port >= inputCount(b)) throw new Error('Connect an output to an input on the same layer.');
      const old = this.incoming.get(to)[port]; if (old) this.wires.delete(old.id);
      const wire = { id: this.id('w'), from, to, port };
      this.wires.set(wire.id, wire); this.rebuild(); return wire;
    }
    disconnect(id) { this.wires.delete(id); this.rebuild(); }
    bit(id, port, values = this.values) {
      const w = this.incoming.get(id)?.[port]; return w ? +!!values.get(w.from) : 0;
    }
    evaluate(n, values = this.values) {
      if (n.type === 'INPUT') return +n.on;
      // Sequential outputs hold during combinational propagation. Only an
      // explicit frame flips pulses; registers are sampled in parallel below.
      if (n.type === 'PULSE' || n.type === 'REGISTER') return values.get(n.id) || 0;
      if (n.type === 'RGBTUNNEL') {
        let color = 0; for (let i = 0; i < 24; i++) color = (color << 1) | this.bit(n.id, i, values);
        return color;
      }
      if (n.type === 'RGB') return values.get(this.peers.get(n.id)) || 0;
      if (n.type === 'TUNNEL') {
        if (this.incoming.get(n.id)[0]) return this.bit(n.id, 0, values);
        const peer = this.peers.get(n.id); return peer ? this.bit(peer, 0, values) : 0;
      }
      if (n.type === 'NOT') return 1 - this.bit(n.id, 0, values);
      if (n.type === 'OUTPUT') return this.bit(n.id, 0, values);
      const count = inputCount(n);
      if (n.type === 'AND' || n.type === 'NAND') {
        for (let i = 0; i < count; i++) if (!this.bit(n.id, i, values)) return +(n.type === 'NAND');
        return +(n.type === 'AND');
      }
      if (n.type === 'OR' || n.type === 'NOR') {
        for (let i = 0; i < count; i++) if (this.bit(n.id, i, values)) return +(n.type === 'OR');
        return +(n.type === 'NOR');
      }
      let parity = 0; for (let i = 0; i < count; i++) parity ^= this.bit(n.id, i, values);
      return parity;
    }
    sampleRegister(n, values = this.values) {
      const clock = this.bit(n.id, 1, values);
      return { clock, value: clock && !n.clock ? this.bit(n.id, 0, values) : values.get(n.id) || 0 };
    }
    settle(seed) {
      const queue = seed ? [...seed] : [...this.nodes.keys()]; const queued = new Set(queue);
      const limit = Math.max(4096, this.nodes.size * 64); let head = 0, changes = 0;
      const enqueueDependents = id => {
        for (const to of this.dependents.get(id)) if (!queued.has(to)) { queued.add(to); queue.push(to); }
      };
      while (true) {
        while (head < queue.length && changes < limit) {
          const id = queue[head++]; queued.delete(id); const n = this.nodes.get(id); if (!n) continue;
          const value = this.evaluate(n);
          if (value !== (this.values.get(id) ?? 0)) {
            this.values.set(id, value); changes++; enqueueDependents(id);
          }
        }
        if (head < queue.length || changes >= limit) break;
        // Settle D and CLK first, then capture all registers together. A chain
        // of registers sharing a clock therefore advances exactly one stage.
        const samples = [...this.registers].map(id => { const n = this.nodes.get(id); return [n, this.sampleRegister(n)]; });
        let captured = false;
        for (const [n, sample] of samples) {
          n.clock = sample.clock;
          if (sample.value !== (this.values.get(n.id) || 0)) {
            this.values.set(n.id, sample.value); changes++; captured = true; enqueueDependents(n.id);
          }
        }
        if (!captured) break;
      }
      const stable = head === queue.length && changes < limit;
      this.needsSettle = !stable;
      this.lastResult = { stable, oscillating: !stable, changes, evaluations: head };
      return this.lastResult;
    }
    step() {
      const next = new Map(); let changes = 0;
      const clocks = [];
      for (const n of this.nodes.values()) {
        let value;
        if (n.type === 'PULSE') value = 1 - (this.values.get(n.id) || 0);
        else if (n.type === 'REGISTER') { const sample = this.sampleRegister(n); value = sample.value; clocks.push([n, sample.clock]); }
        else value = this.evaluate(n);
        next.set(n.id, value); if (value !== (this.values.get(n.id) || 0)) changes++;
      }
      for (const [n, clock] of clocks) n.clock = clock;
      this.values = next; this.needsSettle = !!changes; this.lastResult = { stable: !changes, oscillating: false, changes, evaluations: this.nodes.size }; return this.lastResult;
    }
    advanceFrame() {
      // Instant mode starts from settled signals. Flip sources once, then
      // visit only their dependents; register captures still happen in parallel.
      if (this.needsSettle) { const pending = this.settle(); if (!pending.stable) return pending; }
      const affected = new Set(); let changedSources = 0;
      for (const id of this.pulses) {
        this.values.set(id, 1 - (this.values.get(id) || 0)); changedSources++;
        for (const to of this.dependents.get(id)) affected.add(to);
      }
      const result = this.settle(affected); result.changes += changedSources; return result;
    }
    toJSON() {
      return { format: 'logic-studio', version: 1, name: this.name, nextId: this.nextId,
        nodes: [...this.nodes.values()].map(n => ({ ...n, x: String(n.x), y: String(n.y) })), wires: [...this.wires.values()].map(w => ({ ...w })),
        signals: [...this.values.entries()], groups: [...this.groups.values()].map(g => ({ ...g, nodeIds: this.groupNodes(g.id).map(n => n.id) })) };
    }
    static fromJSON(data) {
      if (!data || data.format !== 'logic-studio' || data.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.wires)) throw new Error('This is not a supported Logic Studio circuit.');
      const c = new Circuit(); c.name = typeof data.name === 'string' ? data.name.slice(0, 100) : 'Imported circuit';
      for (const raw of data.nodes) {
        const n = validateNode(raw);
        if (!n.id || n.id.length > 100 || c.nodes.has(n.id)) throw new Error('Invalid or duplicate node identifier.');
        if (c.positions.has(key(n.layer, n.x, n.y))) throw new Error('Two nodes occupy the same grid square.');
        c.nodes.set(n.id, n); c.positions.set(key(n.layer, n.x, n.y), n);
      }
      const occupied = new Set();
      for (const raw of data.wires) {
        const a = c.nodes.get(raw.from), b = c.nodes.get(raw.to);
        if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 100 || c.wires.has(raw.id) || c.nodes.has(raw.id) || !a || !b || a.layer !== b.layer || !hasOutput(a) || !Number.isInteger(raw.port) || raw.port < 0 || raw.port >= inputCount(b)) throw new Error('Invalid wire in circuit file.');
        const k = `${raw.to}:${raw.port}`; if (occupied.has(k)) throw new Error('An input has multiple wires.'); occupied.add(k);
        c.wires.set(raw.id, { id: raw.id, from: raw.from, to: raw.to, port: raw.port });
      }
      c.nextId = Number.isSafeInteger(data.nextId) && data.nextId > 0 ? data.nextId : c.nodes.size + c.wires.size + 1;
      c.rebuild();
      if (data.groups !== undefined) {
        if (!Array.isArray(data.groups)) throw new Error('Invalid relay groups.');
        for (const raw of data.groups) {
          if (!raw || typeof raw.id !== 'string' || !raw.id || raw.id.length > 100 || c.groups.has(raw.id) || c.nodes.has(raw.id) || c.wires.has(raw.id) || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.trim().length > 80 || !['INPUT', 'OUTPUT'].includes(raw.type) || !Array.isArray(raw.nodeIds) || !raw.nodeIds.length || new Set(raw.nodeIds).size !== raw.nodeIds.length) throw new Error('Invalid relay group.');
          const nodes = raw.nodeIds.map(id => c.nodes.get(id));
          if (nodes.some(n => !n || n.type !== raw.type || n.layer !== nodes[0]?.layer)) throw new Error('Relay groups must contain only inputs or only outputs on the same layer.');
          c.groups.set(raw.id, { id: raw.id, title: raw.title.trim(), type: raw.type, nodeIds: nodes.sort(comparePosition).map(n => n.id) });
        }
      }
      if (Array.isArray(data.signals)) for (const entry of data.signals) {
        if (!Array.isArray(entry) || entry.length !== 2) throw new Error('Invalid signal state.');
        const [id, v] = entry; const n = c.nodes.get(id);
        if (!n || !Number.isInteger(v) || v < 0 || v > (['RGB', 'RGBTUNNEL'].includes(n.type) ? 0xffffff : 1)) throw new Error('Invalid signal state.');
        c.values.set(id, v);
      }
      return c;
    }
  }
  function example(name = 'adder') {
    const c = new Circuit();
    const node = (type, x, y, more = {}) => c.addNode({ type, x, y, ...more });
    if (name === 'rgb-lights') {
      c.name = 'RGB lights · Relay color mixer';
      const names = ['Red', 'Green', 'Blue'];
      const channels = names.map((name, channel) => {
        const bits = Array.from({ length: 8 }, (_, bit) => node('INPUT', -5 + channel * 2, -3 + bit, { on: channel === 0, label: `${name[0]}${7 - bit}` }));
        c.addGroup(`${name} channel`, bits.map(n => n.id));
        return bits;
      });
      for (let lamp = 0; lamp < 3; lamp++) {
        const x = 3 + lamp * 3;
        const bus = node('RGBTUNNEL', x, 0, { direction: 1, label: `Light ${lamp + 1} bus` });
        node('RGB', x, 0, { layer: 1, label: `Light ${lamp + 1} · ${['RGB', 'BRG', 'GBR'][lamp]}` });
        for (let channel = 0; channel < 3; channel++) {
          const source = channels[(channel - lamp + 3) % 3];
          for (let bit = 0; bit < 8; bit++) c.connect(source[bit].id, bus.id, channel * 8 + bit);
        }
      }
    } else if (name === 'rgb') {
      c.name = 'RGB · between layers';
      const r = node('INPUT', -3, -1, { on: true, label: 'RED' });
      const g = node('INPUT', -3, 1, { on: false, label: 'GREEN' });
      const b = node('INPUT', -3, 3, { on: true, label: 'BLUE' });
      const bus = node('RGBTUNNEL', 1, 1, { direction: 1 });
      node('RGB', 1, 1, { layer: 1 });
      [r, g, b].forEach((source, channel) => { for (let bit = 0; bit < 8; bit++) c.connect(source.id, bus.id, channel * 8 + bit); });
    } else if (name === 'tunnel') {
      c.name = 'Signal · between layers';
      const i = node('INPUT', -2, 0, { on: true }); const a = node('TUNNEL', 1, 0, { direction: 1 });
      const b = node('TUNNEL', 1, 0, { direction: -1, layer: 1 }); const o = node('OUTPUT', 4, 0, { layer: 1 });
      c.connect(i.id, a.id); c.connect(b.id, o.id);
    } else {
      c.name = 'Half adder';
      const a = node('INPUT', -3, -1, { on: true, label: 'A' });
      const b = node('INPUT', -3, 2, { label: 'B' });
      const xor = node('XOR', 0, -1); const and = node('AND', 0, 2);
      const sum = node('OUTPUT', 3, -1, { label: 'SUM' }); const carry = node('OUTPUT', 3, 2, { label: 'CARRY' });
      c.connect(a.id, xor.id, 0); c.connect(b.id, xor.id, 1); c.connect(a.id, and.id, 0); c.connect(b.id, and.id, 1);
      c.connect(xor.id, sum.id); c.connect(and.id, carry.id);
    }
    c.settle(); return c;
  }
  return { Circuit, MAX_LAYERS, GATES, inputCount, hasOutput, gate, example, key, comparePosition };
});
