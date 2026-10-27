# Bytebound / LS8 native computer

Open **Open Platformer Computer.cmd**. It loads the new machine into the native
app. This example requires Logic Studio 2.5 or later on Windows. Logic Studio 2.9
also supports importing this machine into the browser edition.

The ROM requests keyboard capture through the wired COMMAND node at boot.
Click the window if it was launched in the background. **Tab releases keys.**

| Action | Keys |
|---|---|
| Walk | A/D or Left/Right |
| Jump | Space, W, or Up |
| Run | Hold Shift while moving |
| Restart | R |
| Release keyboard | Tab |

Reach the flag at the right end of the level. Collect coins, jump over the two
pits and spikes, and avoid the moving enemy. You have three lives. The heart
and coin counters appear along the top. R restarts after either win or game
over. The simulation targets 30 game frames per second; global Pause stops it.

The sidebar's **Game computer** tool shows actual completed game FPS, frames,
instructions, CPU registers, and allocated memory. It also provides Run,
Stop, Reset, instruction/frame stepping, ROM editing, and the RAM viewer.
Opening the tool releases keyboard capture so you can edit. Run + capture
returns controls to the game. All tools remain hidden until opened.

## Hardware

This is an instruction-level native 8-bit CPU with generic tile/sprite video
hardware. It is not a CPU assembled from individual gates. Game movement,
collision detection, gravity, coins, lives, enemy AI, HUD, scrolling, and win
conditions are executable instructions in **platformer-ls8.asm**. The video
chip draws tiles and sprites; it contains no platformer rules.

* CPU: 8-bit A/X/Y/SP, 16-bit PC, Z/C/N flags, 15-bit bank selector,
  31-bit data pointer, stack, branches, subroutines, arithmetic, bit operations.
* ROM: 64 KiB, including program instructions, world, textures, palette and sprites.
* RAM: **2 GiB = 2,147,483,648 byte-addressable locations**, 00000000–7FFFFFFF.
  Unwritten RAM reads zero. Physical storage uses 4 KiB pages as needed; this
  example uses about 16 KiB. It does not reserve two gigabytes of host RAM.
* Display: **128 × 128 individual SCREEN PIXEL nodes**. Adjacent pixels have no
  borders. An intact matrix draws in one batch; moving/selecting pixels restores
  individual rendering. The nodes remain separately editable and movable.
* Video: 128 × 16 world tiles, 8 × 8 indexed textures, 256 RGB565 palette colors,
  32 sprites, camera scrolling, sprite transparency and flips.

CPU8, RAM8, ROM8 and VIDEO8 nodes link to a computer by its `computerId`. The
memory/video nodes are views of that machine's shared hardware, not separate
one-bit gate RAM planes. The new machine is stored in `computers8` in the circuit
file. Copying a view retains its link. The Game computer tool operates on the
selected machine; right-click any hardware node > Properties to select it.

CPU8 inputs (top to bottom): RUN, RESET, STEP, KEYS (8-bit), CAPTURE ACK.
Outputs: A, X, Y, PC low, PC high, BANK low, BANK high, last DATA (all 8-bit),
CAPTURE, RELEASE, VSYNC, HALT (one bit). RUN/RESET/STEP are wired to ordinary
input switches, and keys to KEYBOARD nodes and a JOIN bus. Middle-click still
toggles INPUT. One STEP rising edge advances to the next video frame.

## Your programs

Open Game computer > Open .bin / .hex / .asm. Select **platformer-ls8.asm** to
edit the source, or **platformer-ls8.hex** for direct hex bytes. **Load ROM +
reset** assembles if necessary, replaces ROM, clears RAM and stops the CPU.
Press Run + capture to start it. Assemble to hex converts the source without
loading it. Save .bin exports the editor's program. Ordinary Reset resets the
CPU without clearing RAM; the supplied ROM initializes its own game data.

LS8 uses **OP LOW HIGH 00**, four bytes per instruction. This format differs
from the older RGB-16 gate computer's format. Branch operands are byte addresses.
Programs and ROM data share the same 64 KiB ROM. Data loads/stores address RAM.
The assembler accepts labels, decimal, `$`/`0x` hex, `;` comments, `.org`, `.byte`.

For example, this whole hex program writes A5 to the **last byte of 2 GiB RAM**
and halts. Read address 7FFFFFFF in the RAM tool to verify:

```
E1 FF 7F 00  10 A5 00 00  B0 FF FF 00  01 00 00 00
```

The assembly is `BANK $7FFF`, `LDI $A5`, `STA $FFFF`, `HLT`.

### RAM layout used by Bytebound (bank zero)

| Address | Purpose |
|---|---|
| 0000–001F | Game state and scratch variables (documented in source) |
| 0100–01FF | CPU return/data stack |
| 2000–27FF | World map: tile ID at row × 128 + column |
| 3000–6FFF | Texture atlas: tile × 64 + y × 8 + x |
| 7000–71FF | 256 RGB565 palette entries, low byte first |
| 7200–72FF | 32 sprite descriptors, eight bytes each |

Sprite bytes: tile, world X low, world X high, Y, flags, palette offset/16,
reserved, reserved. Flags: 1 enabled, 2 flip X, 4 flip Y, 8 screen coordinates.
Palette index zero is transparent on sprites. Empty tiles use the background
palette entry. Change texture/palette bytes in RAM with CPU stopped to inspect
them; change the ROM assets to retain the changes after reboot.

Bank-zero memory-mapped I/O: FF00 key bits (left/right/jump/restart/run/down in
bits 0–5), FF01 capture acknowledgement, FF02 output/command bits (bit 0 capture,
bit 1 release), FF10/11 camera X low/high, FF12 camera Y, FF13 background color
index, FF20/21 video frame count low/high. These I/O locations overlay ordinary
bank-zero access; raw pointer LDP/STP still access all RAM bytes beneath them.

### Instruction reference

| Opcode | Assembly | Operation |
|---|---|---|
| 00 / 01 | NOP / HLT | No operation / halt |
| 02 / 03 | IN / OUT | Keys to A / A to command output; OUT yields so wired edges propagate |
| 04–07 | TAX TXA TAY TYA | Register transfers |
| 08–0B | INX DEX INY DEY | Increment/decrement X/Y |
| 0C / 0D | SHL / SHR | Shift A; shifted bit to carry |
| 0E / 0F | LDM / STM | Load/store A at bank:Y:X |
| 10 | LDI byte | Immediate A |
| 11 / 12 | ADC / SBC byte | Add/subtract with carry/borrow |
| 13 / 14 | CMP byte / CMPL address | Compare A |
| 15–19 | ADDM SUBM ANDM ORM XORM address | A operation with RAM byte |
| 20 / 30 / 40 / 50 / 60 | ADD SUB AND OR XOR byte | A operation with immediate byte |
| 70 / 80 / 90 | JMP / JZ / JNZ address | Jump / zero / nonzero |
| A0 / B0 | LDA / STA address | Banked RAM load/store |
| A2 / B2 | LDP / STP | Raw RAM load/store at 31-bit pointer |
| A3 / A4 | INC / DEC address | Increment/decrement RAM byte |
| C0 / D0 | LDX / LDY byte | Immediate X/Y |
| C1 / D1 | STX / STY address | Store X/Y to RAM |
| C2 / D2 | LDXM / LDYM address | Load X/Y from RAM |
| E1 | BANK bank | Select 64 KiB data bank, 0000–7FFF |
| E3 | ROM | Read ROM at Y:X into A |
| E8–EB | P0 P1 P2 P3 byte | Set successive bytes of 31-bit pointer |
| EC | DMA count | Copy ROM at Y:X to pointer; advances both; count 0 means 256 |
| F0 | WAIT | Present frame and wait for next 30 Hz video interval |
| F1–F4 | JC JNC JN JP address | Branch carry / no carry / negative / nonnegative |
| F5 / F6 | CALL address / RET | Subroutine call/return |
| F7 / F8 | PUSH / POP | Push/pop A on bank-zero stack |

ADD/SUB ignore incoming carry; ADC/SBC use it. Carry means overflow on addition
and no borrow on subtraction. Loads and arithmetic update zero/negative flags;
stores preserve them. No interrupts, sound, disk filesystem or gamepad hardware
are implemented in this version. It runs the supplied platformer and editable
LS8 programs, not commercial console ROM formats.

Rebuild the supplied example with `python native/scripts/build_platformer.py`.
Build/test the app with `./native/build.ps1 -Test`.
