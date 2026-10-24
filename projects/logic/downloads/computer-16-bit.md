# Logic Studio 2.2.4 / RGB-16

Run **Open 16-bit Computer.cmd** locally or **Open RGB-16.cmd** from the portable ZIP, import `computer-16-bit.logic.json`, or choose **Controls & examples → Programmable 16-bit / 128×128 screen**. The Windows ZIP includes the same file. The browser example is available through the sidebar help tool.

The computer uses 18,597 inspectable nodes and 4,815 wires. Its CPU is built from gates and 82 one-bit registers. RAM and ROM are memory components connected to that circuit; there is no separate CPU interpreter.

- 16-bit A, X, Y, OUT and PC; carry, zero and halt flags.
- 65,536 words of RAM (128 KiB), plus 65,536 words of program ROM (128 KiB). Two identical ROM read banks supply opcode and operand together.
- A 128×128 RGB565 screen backed by RAM C000–FFFF. The display is **16,384 individual Screen Pixel nodes in a 128-wide by 128-high grid**. Each pixel occupies exactly one grid cell, with no gaps. It reads one RGB565 word from sixteen RAM planes named `DATA bit0` through `DATA bit15`. Each node can be selected, moved, copied or deleted independently; its RAM prefix and word address can be edited through right-click Settings. The original multi-pixel SCREEN block remains available for older circuits.
- Fixed two-word instructions: opcode, then operand. PC and branches use word addresses. PC advances by two and wraps at 65536. Branch targets must be even.

The initial file includes a gradient already stored in video RAM. **Middle-click RUN** to execute the included program and draw it again. Reset clears RAM and the display. **Control panel → One CPU instruction** steps with RUN off. The main app preserves your existing workspace; opening this example is explicit.

## Your own program

Open **Program bytes**, select **Assembly** or **Hex bytes / words**, then **Load & reset**. `.asm`, `.hex`, `.txt` and `.bin` files are supported. Binary files contain little-endian 16-bit words. Loading stops RUN, clears RAM, and resets registers. Turn RUN on afterward.

```asm
CLEAR $0000
LDX 0
PLOT $F800
LDI $BEEF
STA $8000
OUT
HLT
```

Equivalent hex words:

```text
00E2 0000 00C0 0000 00E0 F800 0010 BEEF
00B0 8000 0003 0000 0001 0000
```

This makes the first pixel red, stores BEEF at RAM 8000, and outputs BEEF. Decimal operands use ordinary numbers; hex uses `$` or `0x`. Labels end with `:`, and `;` begins comments. The included `computer16-demo.asm` and `.hex` draw the full gradient. Loading and RAM edits can be undone.

## Instruction set

Every instruction takes two words, including instructions whose operand word is 0000. Arithmetic wraps modulo 65536. ZERO reflects A. ADD sets carry on overflow; SUB sets carry when there is no borrow; shifts capture the shifted-out bit. Other instructions preserve carry.

| Opcode | Assembly | Effect |
| --- | --- | --- |
| 00 / 01 | NOP / HLT | Advance / halt until reset |
| 02 / 03 | IN / OUT | External input to A / A to OUT |
| 04 / 05 | TAX / TXA | A to X / X to A |
| 06 / 07 | TAY / TYA | A to Y / Y to A |
| 08 / 09 | INX / DEX | Increment / decrement X |
| 0A / 0B | INY / DEY | Increment / decrement Y |
| 0C / 0D | SHL / SHR | Shift A, zero fill |
| 0E / 0F | LDAX / STAX | A = RAM[X] / RAM[X] = A |
| 10 | LDI n | A = n |
| 20 / 30 | ADD n / SUB n | Add / subtract immediate |
| 40 / 50 / 60 | AND n / OR n / XOR n | Bitwise immediate |
| 70 / 80 / 90 | JMP n / JZ n / JNZ n | Branch always / if A zero / if A nonzero |
| A0 / B0 | LDA n / STA n | Read / write RAM[n] |
| C0 / D0 | LDX n / LDY n | Load X / Y immediate |
| E0 / E1 | PLOT n / PLOTA | Pixel at X = n / A |
| E2 / E3 | CLEAR n / PIXEL | Fill video RAM / read pixel at X into A |
| F0 / F1 | JC n / JNC n | Branch if carry set / clear |

Pixel index is `X & 3FFF`, with `x = index & 127`, `y = index >> 7`. Its RAM word address is `C000 + index`. Colors are RGB565: red F800, green 07E0, blue 001F, white FFFF. Ordinary memory instructions can also read/write the screen. TILE instructions belong to the older 8-bit computer.

## Memory components and copying

The library provides RAM/ROM 256×1 and RAM/ROM 64K×1. Address pins are A0 upward (least significant first). RAM adds D, WE, CLK, RESET, and on 64K variants FILL. A rising CLK writes D if WE is high. RESET clears the plane. FILL on a rising clock fills the C000–FFFF video region with D; lower RAM remains unchanged. Registers and RAM sample the same edge. Sixteen planes form one 16-bit memory. Right-click Settings edits a plane's packed bits; ordinary programs use the Program bytes tool instead.

**Copy / Ctrl+C** clones selected nodes and their internal wires. **Full copy / Ctrl+Shift+C** also creates new input wires from existing external sources into the clones. It does not clone those sources or move their original wires. Full copy also remembers outgoing wires. Paste restores them to existing destination input ports that are still free; occupied ports keep their current wires. This supports copying a pulse, deleting it, running to clear disconnected logic, and pasting it back with its connections restored. Missing destinations, removed input ports, and destinations on other layers are skipped. Paste uses Ctrl+V. Copy stays usable within the Windows app if the system clipboard is unavailable.

**Settings → Wires** offers Automatic, All, Selected connections only, and Hidden. Automatic suppresses distant/dense wire drawing. These options affect drawing only; every circuit connection still simulates. Both renderers cache wire paths and skip offscreen wires. The native engine and save worker run separately from drawing.

The 16-bit computer uses a different program format from older examples. Open the corresponding computer before loading its program. The Windows application is the main development version; the browser retains scheduling and storage limits imposed by its browser.

On touch screens, hold still for 0.5 seconds to middle-click an INPUT; hold elsewhere and drag to pan. Two quick taps open the context menu. The sidebar caret has a 44x44 touch target. Right-click (or double-tap) any node and choose Properties to edit its label; INPUT switch state and REGISTER stored Q can also be set to on/off. Registers capture again on the next rising clock edge. These edits support undo and saving.

## RGB counter example

**Controls & examples → RGB 24-bit counter** loads the supplied 24-bit light counter. It opens paused on layer 1; press **Run** in the Control panel. Layer 0 contains the clock, registers and carry logic. The bundled copy reconnects 15 missing register clock wires so it counts through all 16,777,216 RGB colors, then wraps to black. The downloaded original is unchanged. `rgb-counter.logic.json` is also included for import.
