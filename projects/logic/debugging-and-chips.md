# Debugging and chips / Logic Studio 2.8

These controls are available in both the local web edition and the Windows app.

## Log and Console

1. Open **Components > Notes > LOG**, place it, and enter a message.
2. Drag its small top handle onto the node to watch. Drop on a particular output
   pin to watch that pin on a node with multiple outputs.
3. Open **Console** from the sidebar. A message appears once whenever the watched
   value changes to exactly `1`. A held-high signal does not repeat the message.

The watched node gets a rounded outline with a top dot. Click the dot to detach
the Log, or drag it to another node to change its target. Middle-click its label
or use its context-menu Properties to edit the message. Logs do not add signal
wires or use up inputs. Attachments follow their target when it moves; copying
both together attaches the copied Log to the copied target.

For an 8- or 16-bit output, the trigger is the complete value `1`. Other nonzero
values do not trigger it. A newly attached Log also reports a target already at
`1`; saving and reloading preserves the edge state and does not repeat it.

The Console retains the latest 2,000 entries with timestamps and node details.
Clear empties the view; Copy log copies its text. Messages from inside custom
chips include the instance path. Console history lasts until the app/page is
closed, while Log attachments and messages are saved with the circuit.

## Chips and multi-bit outputs

Select the nodes and create a chip as usual. Chips can have **0-16 inputs** and
**0-16 outputs**, including neither. A pulse generator or logger can therefore
run inside an autonomous chip.

**Delete** in **Chips & buses** removes a reusable chip from the current library
and Components tab. Placed copies continue working, including after save/load.
Undo restores the library entry. To delete an instance, delete its canvas node.

The ordinary **OUTPUT** node accepts **1, 8, or 16 bits through its single pin**.
It takes its width from the connected wire and displays the full value; bus
values appear in hexadecimal. OUTPUT nodes also expose that width when used
as a chip's output pins. JOIN combines individual bits into an 8- or 16-bit
wire. Each input still has one driver. Relay output groups show every bit,
most significant first within each node.

## Tunnels

Placing SENDTUNNEL opens a popup for **1-16 inputs** and the adjacent destination
layer. Each input carries one bit. A linked RECEIVETUNNEL is placed automatically
and follows the sender's input count. RGBTUNNEL keeps its 24 color-bit inputs.
