# Chips, buses and keyboard commands

Both the native Windows app and browser edition include these tools in version 2.4.0. The canvas still opens with only its sidebar arrow.

## Reusable chips

1. Label the INPUT and OUTPUT nodes that should become the chip's pins. Use BUSINPUT and BUSOUTPUT for multi-bit pins.
2. Left-drag from empty canvas to select the whole circuit, or use Ctrl+A. Shift-drag retains its existing input/output selection behavior.
3. Open **Chips & buses > Create from selection**, or right-click a selected node and choose **Create chip from selection**. Name the chip.
4. Choose **Place** in the chip library, then click the canvas. Inputs are solid circles on the left; outputs are hollow circles on the right. Hover a pin to see its name, width and value.

Pins are ordered by X, then Y, matching Relay. Each definition supports up to 16 input pins and 16 output pins; each pin carries one bit, 8 bits or 16 bits. A chip needs at least one output. Give each input pin a unique name, and each output pin a unique name. Nested chips are supported to 16 levels.

Every instance keeps independent registers, memory and pulse state. Registers inside and outside chips sample together after combinational inputs settle. Full copy keeps the instance's state and external wire references. Normal copy preserves its internal state without external wires.

Choose **Edit contents**, then **Save & return** or **Discard & return**. Keep the existing pin order and widths when editing; create a new definition for a different interface. Saving resets instances of that definition in the current circuit. The editor saves the parent circuit while you work inside a chip, including across app/browser restarts. Export and import `.chip.json` files to reuse chips in other projects; dependencies travel with the chip.

## Buses

- **BUSINPUT** supplies a configurable 8- or 16-bit hex word. Right-click **Properties** to edit its width, value and label.
- **BUSOUTPUT** displays an 8- or 16-bit word.
- **JOIN** combines 8 or 16 individual bit inputs into one bus output.
- **SPLIT** separates one bus input into 8 or 16 independently connectable bit outputs.

Bit 0 is the top JOIN/SPLIT pin. Bus wires are thicker and connect only matching widths. Existing gates and one-bit memory planes still use individual bits; use JOIN/SPLIT to connect them to a bus. Disconnect incompatible wires before changing a bus width.

## Command and keyboard nodes

**COMMAND** has an ENABLE input and a status output. In Properties, choose **Capture keyboard** or **Release keyboard**. A rising ENABLE signal sends the command once. Its output reports whether the keyboard is currently captured.

**KEYBOARD** represents a chosen key. In Properties, focus the Key field and press the key. Its output is 1 while that key is held and capture is active; otherwise it is 0. Supported keys include letters, digits, arrows, Space, Enter, Escape, Backspace and left/right Shift, Control and Alt.

**Tab releases capture and clears held keys.** Changing windows also releases it. While captured, keys go to the circuit and normal editor shortcuts are suppressed. A Command input held high does not recapture after Tab; lower it, then raise it again. Capture requested while a modal editor is open waits until the editor closes and the app has focus. Capture applies inside the app; it does not install a system-wide keyboard hook.

## Examples

**Chips & buses** includes buttons for the small **Chips, buses & keyboard** example and the **Keyboard 16-bit computer**. The browser also lists them under **Controls & examples**. The native archive includes both import files.

The small example contains a reusable half adder, a 16-bit hex word and an 8-bit keyboard bus. Middle-click its capture input, then press W/A/S/D or the arrow keys. Press Tab to release.

The keyboard computer retains the real gate-built 16-bit CPU, 128 KiB RAM, 128 KiB program ROM and 128x128 individual screen pixel nodes. Eight KEYBOARD nodes are ORed with the manual IN inputs:

| IN bit | Key |
| --- | --- |
| 0 | W |
| 1 | A |
| 2 | S |
| 3 | D |
| 4 | Up |
| 5 | Left |
| 6 | Down |
| 7 | Right |

In this example's wiring, OUT bit 0 drives a capture Command and OUT bit 1 drives a release Command. Open **Program & CPU**, click **Run**, then close the editor. W fills the screen green; releasing W clears it. RAM word 8000 contains the key bit mask. Leave manual IN bits off for keyboard-only input.

The example ROM is 48 bytes (`computer16-keyboard-example.hex` / `.bin`):

```text
10 00 01 00 03 00 00 00 10 00 00 00 03 00 00 00
02 00 00 00 B0 00 00 80 40 00 01 00 80 00 14 00
E2 00 E0 07 70 00 08 00 E2 00 00 00 70 00 08 00
```

The first four instructions raise OUT0, then lower it. The loop reads IN, stores the mask, tests W and fills the screen. To request capture again after Tab, reload/reset this program and run it from the beginning. To request release from your own program, output 0002 on this example's OUT word. Command behavior comes from connected nodes, rather than new CPU opcodes.
