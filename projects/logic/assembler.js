/* RGB-8 v2: fixed two-byte instructions, byte addresses, no code evaluation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LogicAssembler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const OPS = {
    NOP: [0x00, 0], HLT: [0x01, 0], IN: [0x02, 0], OUT: [0x03, 0], TAX: [0x04, 0], TXA: [0x05, 0], TAY: [0x06, 0], TYA: [0x07, 0],
    INX: [0x08, 0], DEX: [0x09, 0], INY: [0x0a, 0], DEY: [0x0b, 0], SHL: [0x0c, 0], SHR: [0x0d, 0], LDAX: [0x0e, 0], STAX: [0x0f, 0],
    LDI: [0x10, 1], ADD: [0x20, 1], SUB: [0x30, 1], AND: [0x40, 1], OR: [0x50, 1], XOR: [0x60, 1],
    JMP: [0x70, 1], JZ: [0x80, 1], JNZ: [0x90, 1], LDA: [0xa0, 1], STA: [0xb0, 1], LDX: [0xc0, 1], LDY: [0xd0, 1],
    PLOT: [0xe0, 1], PLOTA: [0xe1, 0], CLEAR: [0xe2, 1], PIXEL: [0xe3, 0], TILE: [0xe4, 1], TILEA: [0xe5, 0], TILEGET: [0xe6, 0],
    JC: [0xf0, 1], JNC: [0xf1, 1]
  };
  function assemble(source) {
    if (typeof source !== 'string' || source.length > 32768) throw new Error('Assembly source is too long.');
    const labels = new Map(), lines = []; let address = 0;
    source.split(/\r?\n/).forEach((raw, i) => {
      let line = raw.replace(/;.*/, '').trim(); if (!line) return;
      const label = line.match(/^([a-z_]\w*):/i);
      if (label) { const name = label[1].toUpperCase(); if (labels.has(name)) throw new Error(`Line ${i + 1}: duplicate label ${name}.`); labels.set(name, address); line = line.slice(label[0].length).trim(); }
      if (!line) return;
      const [mnemonic, ...args] = line.split(/[\s,]+/), op = OPS[mnemonic.toUpperCase()];
      if (!op || args.length !== op[1]) throw new Error(`Line ${i + 1}: ${op ? `${mnemonic} needs ${op[1]} operand(s)` : `unknown instruction ${mnemonic}`}.`);
      lines.push({ address, op, mnemonic: mnemonic.toUpperCase(), arg: args[0], line: i + 1 }); address += 2;
    });
    if (!address || address > 256) throw new Error('Programs must contain 1–128 instructions (2–256 bytes).');
    const bytes = [], listing = [];
    for (const line of lines) {
      let value = 0;
      if (line.arg !== undefined) {
        const arg = line.arg.replace(/^#/, '');
        if (labels.has(arg.toUpperCase())) value = labels.get(arg.toUpperCase());
        else if (/^0x[\da-f]+$/i.test(arg)) value = parseInt(arg.slice(2), 16);
        else if (/^\$[\da-f]+$/i.test(arg)) value = parseInt(arg.slice(1), 16);
        else if (/^0b[01]+$/i.test(arg)) value = parseInt(arg.slice(2), 2);
        else if (/^\d+$/.test(arg)) value = Number(arg);
        else throw new Error(`Line ${line.line}: unknown value or label ${arg}.`);
        if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error(`Line ${line.line}: operand must be 0–255.`);
        if (['JMP', 'JZ', 'JNZ', 'JC', 'JNC'].includes(line.mnemonic) && value % 2) throw new Error(`Line ${line.line}: branch addresses must be even.`);
      }
      bytes.push(line.op[0], value); listing.push(`${line.address.toString(16).padStart(2, '0').toUpperCase()}  ${line.op[0].toString(16).padStart(2, '0').toUpperCase()} ${value.toString(16).padStart(2, '0').toUpperCase()}  ${line.mnemonic}${line.arg === undefined ? '' : ' ' + line.arg}`);
    }
    return { bytes, listing: listing.join('\n') };
  }
  const ANT = `; Langton's ant: RAM 00–0F is a 4x4 byte matrix.
; X = cell index (y*4+x), Y = direction (N,E,S,W).
; White 00: turn right. Black 01: turn left. Wrap edges.
CLEAR 7
LDX 5
LDY 0
TILE 4
loop:
LDAX
XOR 1
STAX
JZ black
TILE 0
INY
JMP turned
black:
TILE 7
DEY
turned:
TYA
AND 3
TAY
JZ north
SUB 1
JZ east
SUB 1
JZ south
; West: preserve row and wrap the column.
TXA
AND 12
STA 0xF0
TXA
ADD 3
AND 3
JMP horizontal
east:
TXA
AND 12
STA 0xF0
TXA
ADD 1
AND 3
horizontal:
STA 0xF1
LDA 0xF0
; Add the column to row via X as a temporary counter.
TAX
LDA 0xF1
JZ atcolumn
columnloop:
INX
SUB 1
JNZ columnloop
atcolumn:
TILE 4
JMP loop
north:
TXA
SUB 4
JMP vertical
south:
TXA
ADD 4
vertical:
AND 15
TAX
TILE 4
JMP loop`;
  return { OPS, assemble, ANT };
});
