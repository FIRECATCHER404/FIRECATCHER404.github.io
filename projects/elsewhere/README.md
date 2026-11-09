# Elsewhere

A browser-only impossible-space workshop. Rooms use independent coordinate systems rather than positions in a shared building. Wall-mounted portals show the other room live and transform the visitor's position, facing direction, and optionally scale when crossed. Connections may link different walls of the same room. No backend or build step is required.

Open `index.html` through a static HTTP server. Needs WebGL 2. Imports the repository's existing pinned Three.js 0.187.0 modules from `../isometric/vendor/`; their MIT license and provenance remain alongside those files. Fonts are local. No new runtime downloads or accounts are used.

## Build

- Drag the scene to orbit; scroll to zoom; right-drag to pan. Reset camera frames the current room. Click a portal or object to edit it. The room list and clickable connection diagram select rooms independently of their links.
- Edit room dimensions (4–32 m wide/deep, 3–16 m tall), name, atmosphere, floor pattern, and entrance. The building can contain 12 rooms, with up to 8 portals and 36 objects per room, and 40 portals total.
- Add a portal and choose one of four upright walls. Width, height, position along the wall, and height above the floor fit the surface to that wall. **Tarp** exposes four draggable corner handles in the wall view; corners stay within the fitted rectangle and must remain convex. Rectangle, arch, and oval apertures are also available.
- **Stretch to wall** expands the bounding surface. **Square corners** resets a tarp. Shapes are planar, taut surfaces, rather than simulated fabric.
- Connect to another portal in the dropdown, or use **New room beyond / Bigger inside** to create a paired destination. Relinking clears the former partner at both ends. Removing a portal or room removes its dangling connections. A pair's scale setting is shared. Self-room links are supported; a portal cannot connect to itself.
- Put plinths, orbs, columns, benches, plants, steps, and rings on the floor. Edit their position, elevation, size, rotation, color, and solid setting. Solids use conservative horizontal collision bounds; they are scenery rather than a full rigid-body simulation. Steps are decorative obstacles; use Fly to explore elevated scenery.

Four starting buildings are supplied: the five-room folded house, pocket museum, returning corridor, and an empty building. Changing examples is undoable. Local drafts use `neoj-elsewhere-v1` in localStorage, scoped to this app. Portable `.elsewhere` JSON files validate all geometry and reciprocal links before replacing the current scene. Invalid imports preserve the current building. Undo/redo keeps 35 edit snapshots. **Save a picture** exports the current 3D canvas as PNG.

## Walk

**Walk** starts from the current room. **Try this doorway** positions the visitor in front of the selected surface. WASD / arrows move, drag to look, Shift moves faster. Mouse capture is optional; Escape releases it. Tab returns to Build. Enable Fly and use Q/E to descend/rise. Touch devices have movement buttons, with drag-to-look on the scene. Releasing movement buttons stops movement; blur/visibility loss clears held inputs.

Travel uses 1/90-second movement steps and continuous portal plane-crossing checks, with aperture clearance for the visitor's feet, head, and radius. Ordinary walls and unconnected surfaces stay solid. Linked surfaces map between wall frames with a half turn and anchor vertical mapping to the bottom of the surface. Scaled pairs use the ratio of their widths; eye height, movement speed, and body radius scale together. Turn around and cross back to restore the previous scale. Valid visitor scale is 0.15×–5×, and a crossing is blocked if the visitor cannot fit the exit room/aperture. Very low ceilings or sharply fitted surfaces may be viewable without being walkable.

## Rendering and practical limits

Each portal is a projectively sampled render target from a transformed camera. The destination's wall plane clips the view, preventing the back of the entry wall from hiding the destination. Views are recursive, with one, two, or three visible doorway levels and a budget of 12 offscreen views per frame. Distant surfaces fall back to a colored surface when this budget/depth ends; walking continues through their topology. This is a bounded renderer, not infinite geometry.

Rooms have simple architectural lighting, instanced floor patterns, and inexpensive grounding patches. There is no ray tracing, rigid-body prop physics, arbitrary gravity direction, or automatic physically arranged global floor plan. Tarp corners fit convex quadrilaterals on upright walls. Surfaces on the same wall should be kept separate to avoid ambiguous overlapping connections.

## Verification

Run `node scripts/test-elsewhere.mjs` from the repository root. Twenty-one groups cover strict example/file round trips, all wall-frame combinations, reversibility, quarter turns, floor anchoring, actual aperture shapes, body clearance, wall/prop collision, scaling and reverse travel, same-room loops, fly/ceiling bounds, relinking/deletion cleanup, maximum-size room generation, resizing, and ID/count limits.

Chromium browser checks cover live recursive rendering, keyboard travel into a different room and a 2×-scale room, custom corner dragging, portal sizing, new linked rooms, former-link cleanup, room/object edits, placement/copy/delete, undo/redo, immediate draft reload, valid file round trips, and malformed import preservation. Touch emulation at 390 and 320 CSS pixels checks layout, editing, held/released movement, scale-changing travel, and draft restoration. Physical phones and non-Chromium browsers have not been tested. Optional native mouse capture has not been verified independently of drag-to-look.
