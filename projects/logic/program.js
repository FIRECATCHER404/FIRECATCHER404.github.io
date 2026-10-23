/* Local program-byte tools for circuits with ROM 00..0F input groups. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.Logic);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LogicProgram = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (logic) {
  'use strict';
  const { Circuit } = logic;
  function validate(bytes) {
    if (!Array.isArray(bytes) || bytes.length < 1 || bytes.length > 16 || bytes.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Enter 1–16 bytes, each between 00 and FF.');
    return bytes;
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > 4096) throw new Error('Paste up to 16 hex bytes.');
    const words = text.trim().split(/[\s,]+/).filter(Boolean).flatMap(word => /^[a-f\d]{4,}$/i.test(word) && word.length % 2 === 0 ? word.match(/../g) : [word]);
    if (!words.length) throw new Error('Enter at least one hex byte.');
    if (words.length > 16) throw new Error('This ROM holds 16 bytes. The program is too long.');
    return validate(words.map(word => {
      if (!/^(?:0x)?[a-f\d]{1,2}$/i.test(word)) throw new Error(`Invalid byte "${word.slice(0, 20)}". Use hex values from 00 to FF.`);
      return parseInt(word.replace(/^0x/i, ''), 16);
    }));
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
  function read(circuit) { return layout(circuit).map(group => parseInt(circuit.groupBits(group.id), 2)); }
  function format(bytes) {
    return bytes.map((n, i) => n.toString(16).padStart(2, '0').toUpperCase() + (i === bytes.length - 1 ? '' : i % 4 === 3 ? '\n' : ' ')).join('');
  }
  function load(circuit, bytes) {
    validate(bytes); layout(circuit);
    // Prepare and reset a clone. Invalid layouts/feedback cannot partially
    // overwrite the live ROM; the editor commits this as one undoable change.
    const copy = Circuit.fromJSON(circuit.toJSON()), groups = layout(copy);
    const controls = [...copy.groups.values()].filter(g => g.type === 'INPUT');
    const reset = controls.find(g => g.title === '02 RESET' && copy.groupNodes(g.id).length === 1);
    if (!reset) throw new Error('The computer needs its one-bit 02 RESET input group.');
    for (const group of controls) {
      if (group.title === '01 RUN' || group.title.startsWith('03 STEP') || group.title.startsWith('01 CLOCK')) copy.setGroupBits(group.id, '0'.repeat(copy.groupNodes(group.id).length));
    }
    groups.forEach((group, i) => copy.setGroupBits(group.id, (bytes[i] || 0).toString(2).padStart(8, '0')));
    copy.setGroupBits(reset.id, '1');
    const settle = () => { if (!copy.settle().stable) throw new Error('The computer could not reset because its circuit did not settle.'); };
    settle();
    if (copy.pulses.size) for (let i = 0; i < 2; i++) { if (!copy.advanceFrame().stable) throw new Error('The computer could not reset.'); }
    copy.setGroupBits(reset.id, '0'); settle();
    return { circuit: copy, length: bytes.length, runStopped: controls.some(g => g.title === '01 RUN') };
  }
  return { parse, read, format, load };
});
