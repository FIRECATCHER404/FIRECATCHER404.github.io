/* Logic Studio: dependency-free circuit model. Works from file:// and in Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; require('./advanced.js'); }
  else root.Logic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_LAYERS = 256;
  const GATES = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'];
  const SPECIAL = ['INPUT', 'OUTPUT', 'TUNNEL', 'RGB', 'RGBTUNNEL', 'PULSE', 'REGISTER', 'RAM', 'ROM', 'SCREEN', 'BUSINPUT', 'BUSOUTPUT', 'JOIN', 'SPLIT', 'CHIP', 'KEYBOARD', 'COMMAND', 'COMMENT', 'MULTITUNNEL', 'SENDTUNNEL', 'RECEIVETUNNEL'];
  const key = (layer, x, y) => `${layer}:${x}:${y}`;
  const comparePosition = (a, b) => a.x < b.x ? -1 : a.x > b.x ? 1 : a.y < b.y ? -1 : a.y > b.y ? 1 : a.id.localeCompare(b.id);
  function inputCount(node) {
    if(node.type==='COMMENT'||node.type==='RECEIVETUNNEL')return 0;if(node.type==='MULTITUNNEL'||node.type==='SENDTUNNEL')return node.inputs;
    if (node.type === 'CHIP') return (node.pinsIn || []).length;
    if (['BUSINPUT','KEYBOARD'].includes(node.type)) return 0;
    if (node.type === 'JOIN') return node.bits || 8;
    if (['BUSOUTPUT','SPLIT','COMMAND'].includes(node.type)) return 1;
    if (['INPUT', 'RGB', 'PULSE', 'SCREEN'].includes(node.type)) return 0;
    if (node.type === 'REGISTER') return 2;
    if (node.type === 'RAM') return (node.addressBits || 8) + 4 + (node.addressBits === 16 ? 1 : 0);
    if (node.type === 'ROM') return node.addressBits || 8;
    if (node.type === 'RGBTUNNEL') return 24;
    if (['NOT', 'OUTPUT', 'TUNNEL'].includes(node.type)) return 1;
    return node.inputs;
  }
  function hasOutput(node) { return !['SENDTUNNEL','COMMENT', 'OUTPUT', 'RGB', 'RGBTUNNEL', 'SCREEN', 'BUSOUTPUT'].includes(node.type); }
  function outputCount(n) { return ['MULTITUNNEL','RECEIVETUNNEL'].includes(n.type)?n.inputs:n.type === 'CHIP' ? (n.pinsOut || []).length : n.type === 'SPLIT' ? n.bits || 8 : +hasOutput(n); }
  function inputWidth(n, p = 0) { return ['MULTITUNNEL','SENDTUNNEL','RECEIVETUNNEL'].includes(n.type)?n.channelBits:n.type === 'CHIP' ? n.pinsIn[p]?.width : ['SPLIT','BUSOUTPUT'].includes(n.type) ? n.bits || 8 : 1; }
  function outputWidth(n, p = 0) { return ['MULTITUNNEL','SENDTUNNEL','RECEIVETUNNEL'].includes(n.type)?n.channelBits:n.type === 'CHIP' ? n.pinsOut[p]?.width : ['JOIN','BUSINPUT'].includes(n.type) ? n.bits || 8 : 1; }
  function nodeSize(node) { return node.type === 'SCREEN' && node.screenPixels !== 1 ? 8 : 1; }
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
    if (!data || ![...GATES, ...SPECIAL].includes(data.type)) throw new Error('Unknown node type.');
    const layer = data.layer ?? 0;
    if (!Number.isInteger(layer) || layer < 0 || layer >= MAX_LAYERS) throw new Error('Layers must be between 1 and 256.');
    let inputs = data.inputs ?? (data.type === 'NOT' ? 1 : 2);
    if (GATES.includes(data.type) && data.type !== 'NOT') {
      const allowed = ['OR', 'NOR', 'XOR'].includes(data.type) ? [2, 3] : [2, 3, 4];
      if (!Number.isInteger(inputs) || inputs < 2 || inputs > 16 || (!data.extendible && !allowed.includes(inputs))) throw new Error('Invalid input count (2–16 for extendible gates).');
    }
    let direction = data.direction ?? (layer === 255 ? -1 : 1);
    if (['TUNNEL', 'MULTITUNNEL','SENDTUNNEL', 'RGBTUNNEL'].includes(data.type) &&
        (![1, -1].includes(direction) || layer + direction < 0 || layer + direction >= MAX_LAYERS)) throw new Error('The tunnel must target an adjacent layer between 1 and 256.');
    if (data.type === 'REGISTER' && data.clock !== undefined && ![0, 1].includes(data.clock)) throw new Error('Invalid register clock state.');
    const addressBits = data.addressBits ?? 8;if (![8,16].includes(addressBits)) throw new Error('Memory uses 8 or 16 address bits.');const memory = data.memory ?? '0'.repeat(1 << addressBits);
    if (['RAM', 'ROM'].includes(data.type) && (typeof memory !== 'string' || memory.length !== (1 << addressBits) || /[^01]/.test(memory))) throw new Error('Memory components hold exactly 256 binary bits.');
    if (data.type === 'RAM' && data.clock !== undefined && ![0, 1].includes(data.clock)) throw new Error('Invalid memory clock state.');
    const n = {
      id: String(data.id ?? ''), type: data.type, layer,
      x: integerCoordinate(data.x ?? 0), y: integerCoordinate(data.y ?? 0),
      inputs, extendible: !!data.extendible, direction,
      on: !!data.on, label: typeof data.label === 'string' ? data.label.slice(0, data.type==='COMMENT'?8192:80) : '',
      ...(data.type === 'REGISTER' ? { clock: data.clock ?? 0 } : {}),
      ...(['RAM', 'ROM'].includes(data.type) ? { memory, ...(addressBits !== 8 ? { addressBits } : {}), ...(data.type === 'RAM' ? { clock: data.clock ?? 0 } : {}) } : {})
    };
    if(n.type==='COMMENT'){for(const [key,value]of Object.entries({commentOX:0,commentOY:0,commentWidth:3,commentHeight:1.5})){n[key]=data[key]??value;if(typeof n[key]!=='number'||!Number.isFinite(n[key]))throw Error('Invalid comment geometry.');}if(n.commentOX<0||n.commentOX>=1||n.commentOY<0||n.commentOY>=1||n.commentWidth<.5||n.commentWidth>10000||n.commentHeight<.4||n.commentHeight>10000)throw Error('Invalid comment bounds.');}
    if(['MULTITUNNEL','SENDTUNNEL','RECEIVETUNNEL'].includes(n.type)){n.sourceId=data.sourceId??'';if(typeof n.sourceId!=='string'||n.sourceId.length>100)throw Error('Invalid tunnel source.');n.channelBits=data.channelBits??1;if(!Number.isInteger(n.inputs)||n.inputs<(n.type==='MULTITUNNEL'?2:1)||n.inputs>16||![1,8,16].includes(n.channelBits))throw Error('Use 2-16 channels of 1, 8 or 16 bits.');n.portValues=data.portValues??Array(n.inputs).fill(0);if(!Array.isArray(n.portValues)||n.portValues.length!==n.inputs||n.portValues.some(v=>!Number.isInteger(v)||v<0||v>=2**n.channelBits))throw Error('Invalid tunnel channel state.');n.portValues=[...n.portValues];}
    if(n.type==='SCREEN'){n.screenPixels=data.screenPixels??128;n.screenBase=data.screenBase??49152;n.screenPrefix=data.screenPrefix??'DATA';if(![1,128].includes(n.screenPixels)||!Number.isInteger(n.screenBase)||n.screenBase<0||n.screenBase>65536-n.screenPixels*n.screenPixels||typeof n.screenPrefix!=='string'||!n.screenPrefix||n.screenPrefix.length>80)throw new Error('Invalid screen memory region.');}
    if(['RAM','ROM'].includes(n.type)&&addressBits===16){Object.defineProperty(n,'storage',{value:Uint8Array.from(memory,c=>+(c==='1')),writable:true});Object.defineProperty(n,'memory',{enumerable:true,get(){return Array.from(this.storage).join('');},set(value){this.storage=Uint8Array.from(value,c=>+(c==='1'));}});if(data.memoryHex!==undefined){if(typeof data.memoryHex!=='string'||!/^[0-9a-f]{16384}$/i.test(data.memoryHex))throw new Error('Invalid packed 64K memory plane.');for(let a=0;a<16384;a++){const v=parseInt(data.memoryHex[a],16);for(let b=0;b<4;b++)n.storage[a*4+b]=(v>>(3-b))&1;}}n.memoryVersion=0;}
    if (['BUSINPUT','BUSOUTPUT','JOIN','SPLIT'].includes(n.type)) {
      n.bits=data.bits??8;if(![8,16].includes(n.bits))throw Error('Buses use 8 or 16 bits.');
      n.busValue=data.busValue??0;if(!Number.isInteger(n.busValue)||n.busValue<0||n.busValue>=2**n.bits)throw Error('Bus value is out of range.');
    }
    if(n.type==='KEYBOARD'){n.keyCode=data.keyCode??'KeyW';if(!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Backspace|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right))$/.test(n.keyCode))throw Error('Choose a supported keyboard key.');}
    if(n.type==='COMMAND'){n.command=data.command??'capture_keyboard';n.clock=data.clock??0;if(!['capture_keyboard','release_keyboard'].includes(n.command)||![0,1].includes(n.clock))throw Error('Invalid command settings.');}
    if(n.type==='CHIP'){n.chipId=String(data.chipId??'');if(data.chipState)n.chipState=data.chipState;}
    return n;
  }
  class Circuit {
    constructor() {
      this.nodes = new Map(); this.wires = new Map(); this.groups = new Map(); this.nextId = 1;
      this.chips = new Map(); this.children = new Map(); this.keyDown = new Set(); this.keyboardCaptured = false; this.commands = [];
      this.values = new Map(); this.name = 'Untitled circuit'; this.rebuild();
    }
    id(prefix) { let id; do { id = `${prefix}${this.nextId++}`; } while (this.nodes.has(id) || this.wires.has(id) || this.groups.has(id) || this.chips.has(id)); return id; }
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
      this.prepareChips?.();
      this.largeMemory=[...this.nodes.values()].some(n=>n.addressBits===16);this.topologyVersion=(this.topologyVersion||0)+1;this.wireLayers=new Map();this.screens=new Set();this.positions = new Map(); this.layers = new Map(); this.incoming = new Map(); this.dependents = new Map();
      this.comments=new Set([...this.nodes.values()].filter(n=>n.type==='COMMENT').map(n=>n.id));this.logicNodes=[];this.pulses = new Set(); this.registers = new Set(); this.memories = new Set();
      for (const n of this.nodes.values()) {
        if(!['SCREEN','COMMENT'].includes(n.type))this.logicNodes.push(n.id);
        if (n.type === 'PULSE') this.pulses.add(n.id);
        if (n.type === 'REGISTER') this.registers.add(n.id);
        if (n.type === 'RAM') this.memories.add(n.id);if(n.type==='SCREEN')this.screens.add(n.id);
        if(n.type==='COMMENT'){}else if(n.type==='SCREEN')for(let y=0n;y<BigInt(nodeSize(n));y++)for(let x=0n;x<BigInt(nodeSize(n));x++){const k=key(n.layer,n.x+x,n.y+y);if(this.positions.has(k))throw new Error('Screen overlaps another component.');this.positions.set(k,n);}else{const k=key(n.layer,n.x,n.y);if(this.positions.has(k))throw new Error('That grid square is occupied.');this.positions.set(k,n);}
        if (!this.layers.has(n.layer)) this.layers.set(n.layer, new Map());
        this.layers.get(n.layer).set(n.type==='COMMENT'?'comment:'+n.id:`${n.x}:${n.y}`, n);
        this.incoming.set(n.id, []); this.dependents.set(n.id, new Set());
      }
      for (const w of this.wires.values()) {
        const l=this.nodes.get(w.from).layer;if(!this.wireLayers.has(l))this.wireLayers.set(l,[]);this.wireLayers.get(l).push(w);
        this.incoming.get(w.to)[w.port] = w;
        this.dependents.get(w.from).add(w.to);
      }
      this.peers = new Map();
      for (const n of this.nodes.values()) {
        if (n.type === 'TUNNEL'||n.type==='MULTITUNNEL') {
          const peer = this.at(n.layer + n.direction, n.x, n.y);
          if (peer?.type===n.type&&peer.layer+peer.direction===n.layer&&(n.type!=='MULTITUNNEL'||peer.inputs===n.inputs&&peer.channelBits===n.channelBits)) {
            this.peers.set(n.id, peer.id);
            for(const incoming of this.incoming.get(peer.id))if(incoming)this.dependents.get(incoming.from).add(n.id);
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
      for(const n of this.nodes.values())if(n.type==='RECEIVETUNNEL'){const source=this.nodes.get(n.sourceId);if(source?.type==='SENDTUNNEL'&&source.layer+source.direction===n.layer&&source.inputs===n.inputs&&source.channelBits===n.channelBits){this.peers.set(n.id,source.id);if(!this.peers.has(source.id))this.peers.set(source.id,n.id);for(const w of this.incoming.get(source.id))if(w)this.dependents.get(w.from).add(n.id);}}
    }
    at(layer, x, y) { return this.positions.get(key(layer, x, y)); }
    addNode(data,{autoReceiver=true}={}) {
      const n = validateNode(data); this.prepareChip?.(n); n.id ||= this.id('n');
      if (this.nodes.has(n.id) || this.wires.has(n.id) || this.groups.has(n.id)) throw new Error('Duplicate identifier.');
      if (n.type!=='COMMENT'&&this.at(n.layer, n.x, n.y)) throw new Error('That grid square already contains a node.');
      this.nodes.set(n.id, n);
      try { this.rebuild(); } catch (error) { this.nodes.delete(n.id); this.rebuild(); throw error; }
      if(n.type==='SENDTUNNEL'&&autoReceiver){try{this.ensureSendReceivers([n.id]);}catch(e){this.nodes.delete(n.id);this.rebuild();throw e;}}return n;
    }
    updateNode(id, changes) {
      const old = this.nodes.get(id); if (!old) throw new Error('Node not found.');
      const n = validateNode({ ...old, ...changes, ...(['MULTITUNNEL','SENDTUNNEL','RECEIVETUNNEL'].includes(old.type)&&(changes.inputs!==undefined||changes.channelBits!==undefined)?{portValues:undefined}:{}), id }); this.prepareChip?.(n);
      if ((n.type !== old.type || n.layer !== old.layer) && [...this.groups.values()].some(g => g.nodeIds.includes(id))) throw new Error('Ungroup this node before changing its type or layer.');
      const occupied = this.at(n.layer, n.x, n.y);
      if (n.type!=='COMMENT'&&occupied && occupied.id !== id) throw new Error('That grid square already contains a node.');
      const removed = [...this.wires.values()].filter(w => w.to === id && w.port >= inputCount(n)||w.from===id&&(w.fromPort||0)>=outputCount(n));
      for(const w of this.wires.values()){if(removed.includes(w))continue;const a=w.from===id?n:this.nodes.get(w.from),b=w.to===id?n:this.nodes.get(w.to),fp=w.fromPort||0;if(fp>=outputCount(a)||outputWidth(a,fp)!==inputWidth(b,w.port))throw Error('Disconnect incompatible wires before changing bus width or pins.');}
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
        if (n.type!=='COMMENT'&&occupant && !chosen.has(occupant.id)) throw new Error('A destination grid square is occupied.');
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
    connect(from, to, port = 0, fromPort = 0) {
      const a = this.nodes.get(from), b = this.nodes.get(to);
      if (!a || !b || !hasOutput(a) || a.layer !== b.layer || !Number.isInteger(port) || port < 0 || port >= inputCount(b)) throw new Error('Connect an output to an input on the same layer.');
      if(!Number.isInteger(fromPort)||fromPort<0||fromPort>=outputCount(a)||outputWidth(a,fromPort)!==inputWidth(b,port))throw Error('Pin widths must match. Use a bus joiner or splitter.');
      const old = this.incoming.get(to)[port]; if (old) this.wires.delete(old.id);
      const wire = { id: this.id('w'), from, to, port, ...(fromPort ? {fromPort} : {}) };
      this.wires.set(wire.id, wire); this.rebuild(); return wire;
    }
    disconnect(id) { this.wires.delete(id); this.rebuild(); }
    bit(id, port, values = this.values) {
      const w = this.incoming.get(id)?.[port]; return w ? +!!this.signal(w.from,w.fromPort||0,values) : 0;
    }
    evaluate(n, values = this.values) {
      if(n.type==='SCREEN'||n.type==='COMMENT')return 0;
      if(n.type==='SENDTUNNEL')return this.word(n.id,0,values);
      if(n.type==='RECEIVETUNNEL'){const peer=this.peers.get(n.id),v=Array.from({length:n.inputs},(_,p)=>peer?this.word(peer,p,values):0);this.portsChanged=v.some((x,p)=>x!==n.portValues[p]);n.portValues=v;return v[0];}
      if(n.type==='MULTITUNNEL'){const peer=this.peers.get(n.id),v=Array.from({length:n.inputs},(_,p)=>this.incoming.get(n.id)[p]?this.word(n.id,p,values):peer?this.word(peer,p,values):0);this.portsChanged=v.some((x,p)=>x!==n.portValues[p]);n.portValues=v;return v[0];}if (n.type === 'INPUT') return n.driven ?? +n.on;
      if(['BUSINPUT','BUSOUTPUT','JOIN','SPLIT','CHIP','KEYBOARD','COMMAND'].includes(n.type))return this.evaluateAdvanced(n,values);
      // Sequential outputs hold during combinational propagation. Only an
      // explicit frame flips pulses; registers are sampled in parallel below.
      if (n.type === 'PULSE' || n.type === 'REGISTER') return values.get(n.id) || 0;
      if (n.type === 'RAM' || n.type === 'ROM') return this.memoryBit(n,this.memoryAddress(n,values));
      if (n.type === 'RGBTUNNEL') {
        let color = 0; for (let i = 0; i < 24; i++) color = (color << 1) | this.bit(n.id, i, values);
        return color;
      }
      if (n.type === 'RGB') return values.get(this.peers.get(n.id)) || 0;
      if (n.type === 'TUNNEL'||n.type==='MULTITUNNEL') {
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
    memoryAddress(n, values = this.values) {
      let address = 0; for (let bit = 0; bit < (n.addressBits||8); bit++) address |= this.bit(n.id, bit, values) << bit;
      return address;
    }
    memoryBit(n,address){return n.storage?n.storage[address]:+(n.memory[address]==='1');}
    sampleMemory(n,values=this.values){const k=n.addressBits||8,clock=this.bit(n.id,k+2,values),rise=clock&&!n.clock;return {clock,address:this.memoryAddress(n,values),data:this.bit(n.id,k,values),clear:!!(rise&&this.bit(n.id,k+3,values)),write:!!(rise&&this.bit(n.id,k+1,values)),fill:!!(k===16&&rise&&this.bit(n.id,k+4,values))};}
    commitMemory(n,s){n.clock=s.clock;let changed=false;if(n.storage){if(s.clear){changed=n.storage.some(Boolean);if(changed)n.storage.fill(0);}else if(s.fill){for(let a=49152;a<65536;a++)if(n.storage[a]!==s.data){changed=true;break;}if(changed)n.storage.fill(s.data,49152);}else if(s.write&&n.storage[s.address]!==s.data){n.storage[s.address]=s.data;changed=true;}if(changed)n.memoryVersion++;}else{let m=n.memory;if(s.clear)m='0'.repeat(256);else if(s.write&&m[s.address]!==String(s.data))m=m.slice(0,s.address)+s.data+m.slice(s.address+1);changed=m!==n.memory;n.memory=m;}return changed;}
    settle(seed, capture = true) {
      this.childUnstable = false;
      const queue = seed ? [...seed] : [...this.logicNodes]; const queued = new Set(queue);
      const limit = Math.max(4096, this.nodes.size * 64); let head = 0, changes = 0;
      const enqueueDependents = id => {
        for (const to of this.dependents.get(id)) if (!queued.has(to)) { queued.add(to); queue.push(to); }
      };
      while (true) {
        while (head < queue.length && changes < limit) {
          const id = queue[head++]; queued.delete(id); const n = this.nodes.get(id); if (!n) continue;
          this.portsChanged = false; const value = this.evaluate(n);
          if (this.portsChanged || value !== (this.values.get(id) ?? 0)) {
            this.values.set(id, value); changes++; enqueueDependents(id);
          }
        }
        if (head < queue.length || changes >= limit) break;
        if (!capture) break;
        // Settle D and CLK first, then capture all registers together. A chain
        // of registers sharing a clock therefore advances exactly one stage.
        const samples = [...this.registers].map(id => { const n = this.nodes.get(id); return [n, this.sampleRegister(n)]; });
        const memorySamples = [...this.memories].map(id => { const n = this.nodes.get(id); return [n, this.sampleMemory(n)]; });
        let captured = false;
        for (const [n, sample] of samples) {
          n.clock = sample.clock;
          if (sample.value !== (this.values.get(n.id) || 0)) {
            this.values.set(n.id, sample.value); changes++; captured = true; enqueueDependents(n.id);
          }
        }
        // Sample RAM with the same old address/data/clock as CPU registers.
        // Commit storage only after every sequential element has sampled.
        for (const [n,sample] of memorySamples)if(this.commitMemory(n,sample)){changes++;captured=true;if(!queued.has(n.id)){queued.add(n.id);queue.push(n.id);}}
        for(const id of this.captureAdvanced?.()||[]){changes++;captured=true;if(!queued.has(id)){queued.add(id);queue.push(id);}}
        if (!captured) break;
      }
      const stable = head === queue.length && changes < limit && !this.childUnstable;
      this.needsSettle = !stable;
      this.lastResult = { stable, oscillating: !stable, changes, evaluations: head };
      return this.lastResult;
    }
    step() {
      this.flipChildren?.();
      const next = new Map(); let changes = 0;
      const clocks = [], memorySamples = [];
      for (const n of this.nodes.values()) {
        let value;
        if (n.type === 'PULSE') value = 1 - (this.values.get(n.id) || 0);
        else if (n.type === 'REGISTER') { const sample = this.sampleRegister(n); value = sample.value; clocks.push([n, sample.clock]); }
        else { value = this.evaluate(n); if (n.type === 'RAM') memorySamples.push([n, this.sampleMemory(n)]); }
        next.set(n.id, value); if (value !== (this.values.get(n.id) || 0)) changes++;
      }
      for (const [n, clock] of clocks) n.clock = clock;
      for(const [n,sample]of memorySamples)if(this.commitMemory(n,sample))changes++;
      for(const id of this.captureAdvanced?.()||[])changes++;
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
      for(const id of this.flipChildren?.()||[])affected.add(id);
      const result = this.settle(affected); result.changes += changedSources; return result;
    }
    toJSON() {
      return { format: 'logic-studio', version: 1, name: this.name, nextId: this.nextId,
        ...(this.chips.size?{chips:[...this.chips.values()]}:{}),
        nodes: [...this.nodes.values()].map(n=>{if(n.type==='CHIP'){const child=this.children.get(n.id);return {...n,x:String(n.x),y:String(n.y),pinsIn:undefined,pinsOut:undefined,...(child?{chipState:child.toJSON()}: {})};}if(!n.storage)return {...n,x:String(n.x),y:String(n.y)};const data={};for(const k of Object.keys(n))if(k!=='memory'&&k!=='memoryVersion')data[k]=n[k];data.x=String(n.x);data.y=String(n.y);let packed='';const digits='0123456789ABCDEF';for(let a=0;a<65536;a+=4)packed+=digits[(n.storage[a]<<3)|(n.storage[a+1]<<2)|(n.storage[a+2]<<1)|n.storage[a+3]];data.memoryHex=packed;return data;}), wires: [...this.wires.values()].map(w => ({ ...w })),
        signals: [...this.values.entries()], groups: [...this.groups.values()].map(g => ({ ...g, nodeIds: this.groupNodes(g.id).map(n => n.id) })) };
    }
    static fromJSON(data) {
      if (!data || data.format !== 'logic-studio' || data.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.wires)) throw new Error('This is not a supported Logic Studio circuit.');
      const c = new Circuit(); if(data.chips!==undefined){if(!Array.isArray(data.chips))throw Error('Invalid chip library.');for(const def of data.chips){if(!def.id||c.chips.has(def.id))throw Error('Invalid or duplicate chip definition.');c.chips.set(def.id,def);}} c.name = typeof data.name === 'string' ? data.name.slice(0, 100) : 'Imported circuit';
      for (const raw of data.nodes) {
        const n = validateNode(raw); c.prepareChip?.(n);
        if (!n.id || n.id.length > 100 || c.nodes.has(n.id)) throw new Error('Invalid or duplicate node identifier.');
        if (n.type!=='COMMENT'&&c.positions.has(key(n.layer, n.x, n.y))) throw new Error('Two nodes occupy the same grid square.');
        c.nodes.set(n.id, n);if(n.type!=='COMMENT')c.positions.set(key(n.layer, n.x, n.y), n);
      }
      const occupied = new Set();
      for (const raw of data.wires) {
        const a = c.nodes.get(raw.from), b = c.nodes.get(raw.to);
        if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 100 || c.wires.has(raw.id) || c.nodes.has(raw.id) || !a || !b || a.layer !== b.layer || !hasOutput(a) || !Number.isInteger(raw.port) || raw.port < 0 || raw.port >= inputCount(b)) throw new Error('Invalid wire in circuit file.');
        const fp=raw.fromPort??0;if(!Number.isInteger(fp)||fp<0||fp>=outputCount(a)||outputWidth(a,fp)!==inputWidth(b,raw.port))throw Error('Invalid output pin or bus width.');
        const k = `${raw.to}:${raw.port}`; if (occupied.has(k)) throw new Error('An input has multiple wires.'); occupied.add(k);
        c.wires.set(raw.id, { id: raw.id, from: raw.from, to: raw.to, port: raw.port, ...(fp?{fromPort:fp}:{}) });
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
        if (!n || !Number.isInteger(v) || v < 0 || v > (['RGB', 'RGBTUNNEL'].includes(n.type) ? 0xffffff : ['BUSINPUT','BUSOUTPUT','JOIN','SPLIT','CHIP','MULTITUNNEL','SENDTUNNEL','RECEIVETUNNEL'].includes(n.type) ? 65535 : 1)) throw new Error('Invalid signal state.');
        c.values.set(id, v);
      }
      return c;
    }
  }
  Circuit.prototype.ensureSendReceivers=function(ids){for(const id of ids){const n=this.nodes.get(id);if(n?.type!=='SENDTUNNEL')continue;const layer=n.layer+n.direction;if([...this.nodes.values()].some(r=>r.type==='RECEIVETUNNEL'&&r.sourceId===id&&r.layer===layer))continue;let pos;const free=(dx,dy)=>{const x=n.x+BigInt(dx),y=n.y+BigInt(dy);if(this.at(layer,x,y))return false;pos={x,y};return true;};let found=free(0,0);for(let radius=1;radius<=256&&!found;radius++)for(let k=-radius;k<=radius&&!found;k++)found=free(k,-radius)||free(k,radius)||free(-radius,k)||free(radius,k);if(!found)throw Error('No nearby free square for the receiver.');this.addNode({type:'RECEIVETUNNEL',sourceId:id,layer,...pos,inputs:n.inputs,channelBits:n.channelBits,direction:-n.direction});}};
  const updateTunnelNode=Circuit.prototype.updateNode;
  Circuit.prototype.updateNode=function(id,changes){const old=this.nodes.get(id);if(old?.type==='RECEIVETUNNEL'&&changes.sourceId){const source=this.nodes.get(changes.sourceId);if(source?.type!=='SENDTUNNEL'||source.layer+source.direction!==(changes.layer??old.layer))throw Error('Select a sender targeting this layer.');changes={...changes,inputs:source.inputs,channelBits:source.channelBits,direction:source.layer-(changes.layer??old.layer)};}
   if(old?.type!=='SENDTUNNEL')return updateTunnelNode.call(this,id,changes);const saved=this.toJSON();try{const receivers=[...this.nodes.values()].filter(n=>n.type==='RECEIVETUNNEL'&&n.sourceId===id);const sender=updateTunnelNode.call(this,id,changes);for(const r of receivers){const layer=sender.layer+sender.direction;if(layer!==r.layer&&[...this.wires.values()].some(w=>w.from===r.id))throw Error('Disconnect receiver wires before changing destination.');updateTunnelNode.call(this,r.id,{inputs:sender.inputs,channelBits:sender.channelBits,layer,direction:-sender.direction});}this.ensureSendReceivers([id]);return sender;}catch(error){Object.assign(this,Circuit.fromJSON(saved));throw error;}};
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
  return { Circuit, MAX_LAYERS, GATES, inputCount, hasOutput, outputCount, inputWidth, outputWidth, nodeSize, gate, example, key, comparePosition };
});
