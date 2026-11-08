# Isometric Map Maker

A buildless, browser-only editor for small illustrated worlds. Open `index.html` through a static HTTP server. Requires WebGL 2. All models are original procedural geometry: matte colors, shallow bevels, orthographic projection, and soft shadows.

## Building

Choose terrain or a piece in **Pieces**, then click or drag on the map. Terrain has 1×1 and 3×3 brushes and a connected fill. Raise/lower changes height by one level per stroke, up to six levels. Erase removes props when the stroke starts on a prop, or cuts terrain when it starts on ground. Support checks protect existing buildings from uneven ground or accidental removal.

**Select** picks a prop; drag it to move it. The selection panel rotates, duplicates, or deletes it. Props snap to tile footprints, cannot overlap, and stay inside the map. Water lilies need water. Bridges span three tiles with two level, dry banks; stairs can bridge a one-level rise. Rotation applies to both the visual model and its footprint.

| Action | Control |
| --- | --- |
| Paint / current piece | B |
| Erase | E |
| Select / Hand | V / H |
| Rotate piece or selected prop | R |
| Pan | Hand, Space + drag, middle/right drag |
| Zoom | Scroll or + / − |
| Fit map | Home or Fit |
| Undo / redo | Ctrl/Cmd Z / Ctrl/Cmd Shift Z |
| Save map file | Ctrl/Cmd S |
| Delete selected prop | Delete |
| Cancel gesture / selection | Escape |

On touch screens, tap/drag to build and use two fingers to pan/pinch. Adding a second finger cancels any painting that started with the first. The palette closes after choosing a piece on narrow screens. Each completed building stroke is one undo step; canceled gestures restore their starting state.

## Files and exports

**Scene** contains four example scenes, a blank island, map file save/open, and settings. Maps range from 4×4 to 32×32 tiles with up to 256 props. Resizing keeps the top-left corner and crops unsupported pieces, with undo available. Forty undo snapshots are retained in memory.

A draft is stored locally in IndexedDB, scoped to this app; save an `.isomap` file for a portable backup. Files are validated before replacing the current scene. No map content is uploaded. The site's existing analytics script still applies.

PNG exports are square at 1024, 2048, or 3072 pixels, fit the entire map, and retain the current view quarter and light theme. Optional transparency removes the backdrop and its cast shadow; shadows on the map remain. Guides, controls, and selection are excluded. Export uses a separate renderer/camera and does not reposition the editor.

## Checks

Run `node scripts/test-isometric-map.mjs` from the repository root. Covers scene validation, all prop footprints through four rotations, bridge/stair supports, geometry bounds, atomic placement, terrain edits, brush/fill, resize, malformed imports, camera math, triangle picking, and instanced entity IDs.

Browser QA exercised desktop editing, map download/import and draft recovery, four camera quarters, opaque/transparent PNG export, and emulated touch at 390 and 320 CSS pixels. PNG dimensions/alpha were independently inspected with Pillow. Physical phones and non-Chromium browsers have not been tested. This is a tile-based illustration tool, not a game or physics simulator.

## Dependencies

Three.js 0.187.0 is pinned locally under `vendor/` with its MIT license. The existing site font is Atkinson Hyperlegible Next. No runtime CDN imports, backend, package installation, or build step is needed.
