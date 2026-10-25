# Comments and multi-input tunnels / Logic Studio 2.7.4

Open **Open Logic Studio.cmd** for the updated native app, or **Open Logic
Web.cmd** for the updated local browser edition. Close an older native app
before switching. The native build is in `native/build-2.7/`; the launcher copies
your previous saved workspace on first launch if the new build has none.
The previous app and workspace remain in `native/build/`.

## Comments

Choose **COMMENT** in Components and click the canvas. The comment appears at
the exact pointer position, with a multiline text editor.

* **Middle-click** a comment to edit its text. On the mobile web canvas, hold
  without moving to perform the same action.
* **Left-drag** the comment body to move freely, without snapping.
* Drag the **lower-right corner** to resize. Text wraps within its bounds.
* Right-click for Properties, Copy, Full copy, and Delete. Ordinary copy is
  sufficient for comments because they have no signal connections.

Comments belong to a layer and can overlap grid nodes or other comments. They
do not occupy grid squares, accept wires, or participate in simulation. Circuit
nodes remain clickable above overlapping comments; middle-click a clear part
of the comment to edit it. Text, fractional positions, and dimensions survive
undo/redo, copying, saving, and export/import.

## Send and receive tunnels

Choose **SENDTUNNEL** in Components. Placement opens settings for:

* **Inputs:** 1-16 independent one-bit signals. Each pin is on or off.
* Use a **SPLIT** node to separate a bus into individual bit wires before sending it, and **JOIN** after receiving it to rebuild a bus.
* **Destination:** up or down one layer, within the 256-layer limit.

A sender has **only input pins**. Placing it automatically creates a
**RECEIVETUNNEL** on the chosen adjacent layer, with **only output pins**.
The receiver uses the same X/Y if available, otherwise a nearby free square.
Input 1 appears at output 1, input 2 at output 2, and so on.

The receiver links to the sender by ID. You can move either endpoint anywhere
on its own layer without losing the connection. Changing the sender's channel
count updates its receivers; discarded channel wires are removed. Disconnect
receiver wires before changing its destination layer.

Right-click > Settings configures the sender. Receiver settings let you select
another sender targeting the receiver's layer; its number of one-bit outputs
follows that sender. You can also place or copy additional RECEIVETUNNEL nodes
linked to the same sender. An unlinked receiver outputs zero.

Copying/pasting a sender creates a receiver for the copy. Copying a receiver
keeps its source link when pasted on the source's destination layer. Old
TUNNEL and MULTITUNNEL circuit files retain their original duplex behavior;
new circuits use the directional components.

The Components menu has separate icons for send, receive, and RGB tunnels.
Older directional bus-tunnel saves automatically convert to one-bit tunnels
with SPLIT/JOIN adapters, preserving their bus connections and signals.

Import **comments-multi-tunnels.logic.json** for a four-input, one-bit example.
Layer 1 sends `0`, `1`, `0`, and `1`; Layer 2 shows the matching outputs.
Middle-click an INPUT to toggle it. The example includes a free comment.

These additions are included in the native release and local web edition.
They are also available on the hosted website at
https://firecatcher404.github.io/projects/logic/.
