# Logic Studio 2.7.2

Custom nodes display their internal circuits: every node, connecting wires,
gate symbols and live signal colors. Nested chips draw their contents too.
Multiple layers get separate labelled sections. Large empty coordinate gaps
are compressed in the preview, and geometry is cached between signal changes.

Zoom in to inspect the miniature. External pins remain ordinary wire targets;
hover for names, widths and values. Right-click > Edit chip contents opens
the full circuit for editing. Import `custom-node-diagram.logic.json` for
a six-gate example.

Components now has a **Custom** tab for created/imported chips, listed by name.
Choose one to place it on the canvas. Search includes custom names, and the
list updates after creating/importing, reloading, editing, and undo/redo.
**Manage custom nodes** opens the existing chip creation/import/edit tools.

Comments have a separate **Notes** tab and no longer appear under I/O.
Both built-in and custom nodes remain available under All.

The website and local browser edition include free comments and directional
send/receive tunnels. Open Controls & examples > Comments & send/receive tunnels
for a working circuit, or import `comments-multi-tunnels.logic.json`.

The native app now keeps Tab navigation within the active tool, skips labels,
and gives buttons hover feedback. Enter applies single-line settings and
activates the focused button. In comment text, Enter inserts a newline and
Ctrl+Enter applies. Escape closes the active tool or dialog.

Settings and the sidebar scroll on short windows. Tab reveals focused controls
that were below the visible area. Fine wheel motion over a panel scrolls that
panel instead of zooming the canvas. Canvas wheel zoom matches the browser's
rate, including faster Ctrl+wheel zoom.

Native hit testing queries occupied grid cells rather than scanning every
screen pixel. Rendering submits without waiting for presentation, and UI
animation polling uses an 8 ms timer; the Windows compositor presents frames.
Tool labels refresh only when needed. CPU status and the byte RAM viewer now
refresh independently, so opening both cannot leave either view stale.
Simulation speed remains independent.

On this machine, the same six-second native panning test, with the platformer,
16,384 individual pixels, four panels and autosave active, measured:

| Measurement | 2.6 | 2.7 |
| --- | ---: | ---: |
| Median pointer-message handling | 5.05 ms | 0.10 ms |
| Median panning frame gap | 13.26 ms | 8.49 ms |
| P95 panning frame gap | 14.55 ms | 8.92 ms |
| Median paint submission | 12.65 ms | 0.83 ms |

These are application timings, not measured monitor/input-to-photon latency.
Neither run had a frame gap over 50 ms during the measured panning interval.
Physical touch hardware and other PCs were not tested.

Run `Open Logic Studio.cmd` for the updated app. It copies the previous saved
workspace on first launch, preferring 2.6 over the original build. Earlier
executables and saved data remain in their original directories.
