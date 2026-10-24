/* Local program-byte tools for circuits with ROM 00..0F input groups. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.Logic);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LogicProgram = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (logic) {
  'use strict';
  const { Circuit } = logic;
  function validate(bytes, limit = 16, wordBits = 8) {
    if (!Array.isArray(bytes) || bytes.length < 1 || bytes.length > limit || bytes.some(n => !Number.isInteger(n) || n < 0 || n >= (1 << wordBits))) throw new Error(`Enter 1–${limit} ${wordBits===16?"words":"bytes"}, each between 0 and ${(1<<wordBits)-1}.`);
    return bytes;
  }
  function parse(text, limit = 16) {
    if (typeof text !== 'string' || text.length > 32768) throw new Error(`Paste up to ${limit} hex bytes.`);
    const words = text.trim().split(/[\s,]+/).filter(Boolean).flatMap(word => /^[a-f\d]{4,}$/i.test(word) && word.length % 2 === 0 ? word.match(/../g) : [word]);
    if (!words.length) throw new Error('Enter at least one hex byte.');
    if (words.length > limit) throw new Error(`This ROM holds ${limit} bytes. The program is too long.`);
    return validate(words.map(word => {
      if (!/^(?:0x)?[a-f\d]{1,2}$/i.test(word)) throw new Error(`Invalid byte "${word.slice(0, 20)}". Use hex values from 00 to FF.`);
      return parseInt(word.replace(/^0x/i, ''), 16);
    }), limit);
  }
  function planes(circuit, type, prefix) {
    return Array.from({ length: wordBits(circuit) }, (_, bit) => {
      const matches = [...circuit.nodes.values()].filter(n => n.type === type && n.label === `${prefix} bit${bit}`);
      if (matches.length !== 1) throw new Error(`The computer needs its ${wordBits(circuit)} ${prefix} memory planes.`);
      return matches[0];
    });
  }
  function isV2(circuit) { return [...circuit.nodes.values()].some(n => n.type === 'ROM' && n.label === 'PROGRAM A bit0'); }
  function wordBits(circuit){const n=[...circuit.nodes.values()].find(n=>n.label==='PROGRAM A bit0'&&n.type==='ROM');return n?.addressBits===16?16:8;}
  function capacity(circuit) { return isV2(circuit) ? (wordBits(circuit)===16?65536:256) : 16; }
  function memory(circuit) { const chips = planes(circuit, 'RAM', 'DATA'); return Array.from({ length: capacity(circuit) }, (_, a) => chips.reduce((n, chip, bit) => n | (circuit.memoryBit(chip,a) << bit), 0)); }
  function writeMemory(circuit, address, value) {
    if (!Number.isInteger(address) || address < 0 || address >= capacity(circuit) || !Number.isInteger(value) || value < 0 || value >= (1 << wordBits(circuit))) throw new Error('Address or value is outside this memory range.');
    const chips = planes(circuit, 'RAM', 'DATA');
    if ([...circuit.groups.values()].filter(g => g.title === '01 RUN' || g.title.startsWith('03 STEP')).some(g => /1/.test(circuit.groupBits(g.id)))) throw new Error('Stop RUN and lower STEP before editing RAM.');
    chips.forEach((chip,bit)=>{if(chip.storage){chip.storage[address]=(value>>bit)&1;chip.memoryVersion++;}else chip.memory=chip.memory.slice(0,address)+((value>>bit)&1)+chip.memory.slice(address+1);});
    circuit.needsSettle = true;
  }
  function layout(circuit) {
    const groups = [];
    for (let i = 0; i < 16; i++) {
      const title = `ROM ${i.toString(16).padStart(2, '0').toUpperCase()}`;
      const matches = [...circuit.groups.values()].filter(g => g.title.toUpperCase() === title && g.type === 'INPUT');
      if (matches.length !== 1 || circuit.groupNodes(matches[0].id).length !== 8) throw new Error('Open a computer with eight-bit input groups named ROM 00 through ROM 0F.');
      groups.push(matches[0]);
    }
    return groups;
  }
  function read(circuit) {
    if (!isV2(circuit)) return layout(circuit).map(group => parseInt(circuit.groupBits(group.id), 2));
    const a = planes(circuit, 'ROM', 'PROGRAM A'), b = planes(circuit, 'ROM', 'PROGRAM B');
    if (a.some((n,i)=>n.storage?(!b[i].storage||n.storage.some((v,a)=>v!==b[i].storage[a])):n.memory!==b[i].memory)) throw new Error('The two program ROM read banks disagree.');
    return Array.from({ length: capacity(circuit) }, (_, address) => a.reduce((n, chip, bit) => n | (circuit.memoryBit(chip,address) << bit), 0));
  }
  function format(bytes,bits=8) {
    return bytes.map((n, i) => n.toString(16).padStart(bits===16?4:2, '0').toUpperCase() + (i === bytes.length - 1 ? '' : i % 4 === 3 ? '\n' : ' ')).join('');
  }
  function load(circuit, bytes) {
    const v2 = isV2(circuit); validate(bytes, capacity(circuit),wordBits(circuit));
    if (v2) { read(circuit); if (bytes.length % 2) throw new Error('This computer uses two-value instructions. Enter an even number of program values.'); }
    else layout(circuit);
    // Prepare and reset a clone. Invalid layouts/feedback cannot partially
    // overwrite the live ROM; the editor commits this as one undoable change.
    const copy = Circuit.fromJSON(circuit.toJSON()), groups = v2 ? [] : layout(copy);
    const controls = [...copy.groups.values()].filter(g => g.type === 'INPUT');
    const reset = controls.find(g => g.title === '02 RESET' && copy.groupNodes(g.id).length === 1);
    if (!reset) throw new Error('The computer needs its one-bit 02 RESET input group.');
    for (const group of controls) {
      if (group.title === '01 RUN' || group.title.startsWith('03 STEP') || group.title.startsWith('01 CLOCK')) copy.setGroupBits(group.id, '0'.repeat(copy.groupNodes(group.id).length));
    }
    groups.forEach((group, i) => copy.setGroupBits(group.id, (bytes[i] || 0).toString(2).padStart(8, '0')));
    if (v2) for (const prefix of ['PROGRAM A', 'PROGRAM B']) planes(copy, 'ROM', prefix).forEach((chip, bit) => {
      if(chip.storage){chip.storage.fill(0);bytes.forEach((v,a)=>chip.storage[a]=(v>>bit)&1);chip.memoryVersion++;}else chip.memory=Array.from({length:256},(_,a)=>String(((bytes[a]||0)>>bit)&1)).join('');
    });
    copy.setGroupBits(reset.id, '1');
    const settle = () => { if (!copy.settle().stable) throw new Error('The computer could not reset because its circuit did not settle.'); };
    settle();
    if (copy.pulses.size) for (let i = 0; i < 2; i++) { if (!copy.advanceFrame().stable) throw new Error('The computer could not reset.'); }
    copy.setGroupBits(reset.id, '0'); settle();
    return { circuit: copy, length: bytes.length, runStopped: controls.some(g => g.title === '01 RUN') };
  }
  return { parse, read, format, load, capacity, wordBits, isV2, memory, writeMemory };
});
