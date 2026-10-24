# Logic Studio 2.3.0 / programmable 16-bit computer

Open **Open 16-bit Computer.cmd** locally, **Open RGB-16.cmd** from the Windows ZIP, or **Controls & examples → Programmable 16-bit** in either edition. Then open **Program & CPU** in the sidebar.

The computer has a gate-built 16-bit CPU, 128 KiB of program ROM and 128 KiB of RAM. The CPU has A, X, Y, OUT and PC registers, carry/zero/halt flags, arithmetic, conditional branches, input/output, and RAM load/store instructions. Its 18,597 nodes and 4,815 wires include 82 one-bit registers; there is no separate CPU interpreter. Layer 0 holds controls, readouts and the display. Layer 1 holds the CPU gates, RAM and ROM planes.

The screen contains **16,384 individual one-cell Screen Pixel nodes in a 128-wide by 128-high grid**. Each reads one RGB565 RAM word. It starts blank; programs draw by writing video RAM. Pixels remain independently selectable, movable, copyable and editable. Adjacent colors meet without separator lines.

## Write hex byte code

The default editor shows the short program currently in ROM. The new example starts with a 48-byte program that calculates 6 × 7 using a loop, stores the result at RAM word `8000`, sends it to OUT, and halts. Click **Run**: OUT and the RAM watch become **002A**, which is 42 in decimal.

Paste this smaller program to load 42, store it in RAM, output it, then halt:

```text
10 00 2A 00
B0 00 00 80
03 00 00 00
01 00 00 00
```

Choose **Hex bytes (00–FF)**. Each instruction is exactly **four bytes: OP 00 LOW HIGH**. The first two bytes form the opcode word; the last two form its 16-bit operand, least-significant byte first. Thus `2A 00` means 002A, and `00 80` means 8000. Instructions without operands use `00 00`. Spaces, line breaks, commas and `;` line comments are accepted.

- **Run** loads changed code, resets the CPU/RAM when needed, and starts execution. Run after a halt restarts the program.
- **Stop** stops the CPU clock while retaining registers and RAM.
- **Step instruction** loads changed code when needed, stops automatic execution, then executes exactly one instruction.
- **Load & reset** writes ROM and resets registers/RAM without starting execution.
- **IN (hex) → Set input** changes the 16-bit input word read by opcode 02.
- **Watch RAM word** shows the selected word; **Open RAM** opens that page for inspection and editing.
- **Save .bin** exports the program's actual binary bytes. **Open file** accepts `.bin`, byte-code `.hex`/`.txt`, word-formatted hex, or existing `.asm` files.

The status shows PC in both ROM word and byte addresses, A, X, Y, OUT, and whether the CPU is running, stopped or halted. Program ROM and RAM are separate. Loading clears RAM; stopping preserves it.

## Examples

Use the **Example** dropdown and **Use example**, then **Run**:

1. **RAM calculation: 6 × 7** demonstrates arithmetic, a loop, conditional branches, RAM and OUT.
2. **Live input → RAM and OUT** repeatedly reads IN and stores it at RAM 8000. Set IN to BEEF, then 1234 while running; OUT and RAM follow.
3. **Moving screen pixel** uses loops, X/Y registers and video RAM to move a red pixel through the display. Stop freezes its state.
4. **Screen gradient** retains the original graphics demonstration as an optional program.

The ZIP includes `computer16-ram-example.hex`, its matching `.bin`, `computer16-input-example.hex` and `computer16-pixel-example.hex`. The original gradient assembly and word hex files remain available. Hex-word and assembly formats remain optional in the editor.

## Instruction bytes

Append `00 LOW HIGH` to each opcode. Unused operands are `00 00`. Registers and arithmetic wrap at 65536. ZERO reflects A. ADD sets carry on overflow; SUB sets carry when there is no borrow. Shifts capture the shifted-out bit; other instructions preserve carry.

| OP | Meaning | Operand |
| --- | --- | --- |
| 00 / 01 | NOP / halt | unused |
| 02 / 03 | IN → A / A → OUT | unused |
| 04 / 05 | A → X / X → A | unused |
| 06 / 07 | A → Y / Y → A | unused |
| 08 / 09 | X++ / X-- | unused |
| 0A / 0B | Y++ / Y-- | unused |
| 0C / 0D | Shift A left / right | unused |
| 0E / 0F | RAM[X] → A / A → RAM[X] | unused |
| 10 | Load immediate into A | value |
| 20 / 30 | Add / subtract immediate | value |
| 40 / 50 / 60 | AND / OR / XOR immediate | mask |
| 70 | Jump | ROM word address |
| 80 / 90 | Jump if A is zero / nonzero | ROM word address |
| A0 / B0 | RAM → A / A → RAM | RAM word address |
| C0 / D0 | Load immediate into X / Y | value |
| E0 / E1 | Plot operand / A at pixel X | RGB565 color / unused |
| E2 / E3 | Fill screen / read pixel X into A | RGB565 color / unused |
| F0 / F1 | Jump if carry set / clear | ROM word address |

PC and branch operands count **16-bit ROM words**, so one instruction advances PC by two words / four bytes. Branch targets must be even. For example, `70 00 04 00` jumps to word 0004, byte offset 00008: the third instruction.

RAM addresses `0000–BFFF` are ordinary storage. `C000–FFFF` are the 128×128 RGB565 display. Pixel index is `X & 3FFF`; x = index & 127, y = index >> 7; its RAM word address is C000 + index. Colors include red F800, green 07E0, blue 001F, white FFFF. For example, `E2 00 00 F8` fills the screen red. Ordinary load/store instructions can also access screen RAM.

## Memory components and copying

The library provides RAM/ROM 256×1 and RAM/ROM 64K×1. Address pins are A0 upward (least significant first). RAM adds D, WE, CLK, RESET, and on 64K variants FILL. A rising CLK writes D if WE is high. RESET clears the plane. FILL on a rising clock fills the C000–FFFF video region with D; lower RAM remains unchanged. Registers and RAM sample the same edge. Sixteen planes form one 16-bit memory. Right-click Settings edits a plane's packed bits; ordinary programs use the Program bytes tool instead.

**Copy / Ctrl+C** clones selected nodes and their internal wires. **Full copy / Ctrl+Shift+C** also creates new input wires from existing external sources into the clones. It does not clone those sources or move their original wires. Full copy also remembers outgoing wires. Paste restores them to existing destination input ports that are still free; occupied ports keep their current wires. This supports copying a pulse, deleting it, running to clear disconnected logic, and pasting it back with its connections restored. Missing destinations, removed input ports, and destinations on other layers are skipped. Paste uses Ctrl+V. Copy stays usable within the Windows app if the system clipboard is unavailable.

**Settings → Wires** offers Automatic, All, Selected connections only, and Hidden. Automatic suppresses distant/dense wire drawing. These options affect drawing only; every circuit connection still simulates. Both renderers cache wire paths and skip offscreen wires. The native engine and save worker run separately from drawing.

The 16-bit computer uses a different program format from older examples. Open the corresponding computer before loading its program. The Windows application is the main development version; the browser retains scheduling and storage limits imposed by its browser.

On touch screens, hold still for 0.5 seconds to middle-click an INPUT; hold elsewhere and drag to pan. Two quick taps open the context menu. The sidebar caret has a 44x44 touch target. Right-click (or double-tap) any node and choose Properties to edit its label; INPUT switch state and REGISTER stored Q can also be set to on/off. Registers capture again on the next rising clock edge. These edits support undo and saving.

## RGB counter example

**Controls & examples → RGB 24-bit counter** loads the supplied 24-bit light counter. It opens paused on layer 1; press **Run** in the Control panel. Layer 0 contains the clock, registers and carry logic. The bundled copy reconnects 15 missing register clock wires so it counts through all 16,777,216 RGB colors, then wraps to black. The downloaded original is unchanged. `rgb-counter.logic.json` is also included for import.
