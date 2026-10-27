# Pixel-256 programmable computer

Open **Open Pixel Computer.cmd** for Windows, or **Open Pixel Computer Web.cmd**
for the local browser edition. Both editions also include **Pixel-256** under
Controls & examples. Import `pixel-256-computer.logic.json` into version 2.9 or later.

The display opens on **layer 2** with **65,536 individual pixel nodes**, arranged
256 wide by 256 high. Layer 1 contains the computer and keyboard. Press Tab to
release keyboard capture, then Page Down / Page Up to change layers; F fits a layer.

| Key | Action |
| --- | --- |
| Arrow keys | Move the cyan selector; hold to repeat |
| A | Paint the selected pixel white; hold while moving to draw |
| S | Erase the selected pixel; takes priority over A |
| Tab | Release keyboard capture |

The selector is an overlay: moving it preserves the pixels underneath.
The ROM activates the wired COMMAND node to request capture at boot. Click the
native window if it opened in the background. **Program & CPU > Run + capture**
captures again. Reset restarts the supplied program, which clears the canvas.

## Your own ROM

Open **Program & CPU** (or Game computer) in the sidebar. Edit hexadecimal
bytes, or open `pixel-placer-ls8.hex`, `.bin`, or `.asm`. **Load ROM + reset**
loads the editor, clears RAM and stops execution. **Run + capture** starts it.
Stop, Step CPU, Step frame, Save .bin and the byte RAM viewer are available.
Changing the ROM changes the program; painting and movement are CPU instructions.

The CPU uses LS8 instructions: **OP LOW HIGH 00**, four bytes each. Branch
targets are byte offsets. See [the LS8 instruction reference](platformer-ls8.md)
for opcodes, arithmetic, branches, stack, pointers and ROM DMA. These bytes are
different from the earlier gate-built RGB-16 instruction format.

This complete test program writes A5 to the last byte of RAM and halts:

```text
E1 FF 7F 00 10 A5 00 00 B0 FF FF 00 01 00 00 00
```

Read address `7FFFFFFF` in Memory to check it. Reload `pixel-placer-ls8.asm`
and press Run + capture to restore the pixel editor.

## Hardware and memory

- CPU8: 8-bit A/X/Y/SP, 16-bit program counter, arithmetic flags, subroutines,
  15-bit RAM bank and a 31-bit pointer. Execution uses bounded instruction batches.
- ROM8: 64 KiB of editable code and data.
- RAM8: **2 GiB address space**, allocated in 4 KiB pages as used. Unwritten
  bytes read zero; the empty default program uses about 8 KiB of host RAM pages.
- VIDEO8: 256x256 framebuffer, one palette index per pixel, 256 RGB565 colors,
  and a separate cursor overlay. The target cadence is 30 display frames/second.
- 126 KEYBOARD nodes feed 16 JOIN buses into the CPU's complete keyboard matrix.
  The six drawing keys also feed its convenient eight-bit IN port.
- RUN, RESET and STEP inputs, COMMAND capture/release, and register OUTPUT monitors.

CPU8, RAM8, ROM8 and VIDEO8 share the machine identified by `computerId`.
They are efficient instruction/memory hardware nodes; the CPU is not assembled
from individual gates. Screen nodes remain individually movable, selectable
and deletable. Intact pixel matrices render together, without grid seams.
Project files compact repeated pixel descriptions and expand them into real nodes
when loaded. Normal autosaves retain program position, memory and painted pixels.

`BANK n` selects a 64 KiB RAM window. Physical address = `n * 65536 + address`.

| Address | Use |
| --- | --- |
| Bank 0: 0000, 0001 | Default program's selector X and Y |
| Bank 0: 0100-01FF | CPU stack |
| Bank 0: 7000-71FF | 256 RGB565 palette entries, low byte first |
| Bank 0: FF00 | IN controls: Left=1, Right=2, Up=4, Down=8, A=16, S=32 |
| Bank 0: FF01 | Keyboard capture acknowledgment |
| Bank 0: FF02 | Command output; bit 0 capture, bit 1 release |
| Bank 0: FF20-FF21 | Completed frame counter, low/high |
| Bank 0: FF30, FF31 | Cursor overlay X and Y |
| Bank 0: FF32 | Cursor overlay enable, bit 0 |
| Bank 0: FF33, FF34 | Cursor RGB565 color, low/high; default cyan 07FF |
| Bank 0: FF80-FF8F | 16 read-only keyboard row bytes |
| Bank 1: 0000-FFFF | Framebuffer: one palette index at `Y * 256 + X` |

The default palette is 00=black and 01=white. `WAIT` presents a frame and yields
until the next scheduled frame. Data writes alone do not present a new frame.

`keyboard-codes.json` lists the 126 physical key codes in matrix order. For index
`i`, read bank 0 address `FF80 + floor(i / 8)` and test bit `i % 8`. The matrix
includes letters, digits, punctuation, modifiers, navigation, numeric keypad,
F1-F24, and common international/media keys. Two final bits are spare. Tab is
reserved for releasing capture, so it is not delivered as a held program key.
OS-reserved shortcuts and keys intercepted by a keyboard driver may not arrive.
