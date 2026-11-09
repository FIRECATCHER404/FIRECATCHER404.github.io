# Isometric Map Maker

A buildless, browser-only editor for small illustrated worlds. Open `index.html` through a static HTTP server. Requires WebGL 2. All models are original procedural geometry: matte colors, shallow bevels, orthographic projection, and soft shadows.

## Building

Choose terrain or a piece in **Pieces**, then click or drag on the map. Search filters the current category. There are 17 terrain materials and 43 original pieces, including blossom trees, palms, reeds, mushrooms, boats, tents, fountains, and small street decorations.

Terrain has 1, 3, and 5 tile brushes, square/round shapes, and a connected fill that respects existing styles. Raise/lower changes height once per stroke, up to twelve levels. **Level** paints the chosen height; **Soften** averages neighboring heights from the stroke's original state. **Style this terrain** sets custom surface/cliff colors and plain, speckled, paved, or plank details. Pick a style from the map with **I**. Sculpting preserves colors and details. Erase removes props when the stroke starts on a prop, or cuts terrain when it starts on ground. Support checks protect existing buildings from uneven ground or accidental removal.

**Select** picks a prop; drag it to move it. The selection panel rotates, duplicates, recolors, resizes, or deletes it. Props snap to tile footprints, cannot overlap, and stay inside the map. Water lilies and boats need water. Bridges support widths of 1–3 and lengths of 2–16 tiles; every cell of both banks must be level and dry. Jetties need only their starting bank and extend up to 12 tiles. Walls, fences, hedges, benches, and stair widths are adjustable too. Size controls work before placement and on existing pieces. Rotation applies to the entire resized footprint; failed edits leave the piece and undo history unchanged.

| Action | Control |
| --- | --- |
| Paint / current piece | B |
| Erase | E |
| Pick terrain style and height | I |
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

**Scene** contains six example scenes, a blank island, map file save/open, and an undoable decoration clear. **World** controls map dimensions, atmosphere, sunlight, and background. Maps range from 4×4 to 32×32 tiles with up to 256 props. Resizing keeps the top-left corner and crops unsupported pieces, with undo available. Forty undo snapshots are retained in memory.

The sun wheel updates lighting live: drag around for direction and inward for a higher sun. Low sunlight is warmer and casts longer shadows. Arrow keys on the wheel and the two sliders offer precise control. A sun drag is one undo action. **Shadow beneath the world** toggles only the shadow received by the void; shadows on the map stay enabled. The void color is also customizable.

A draft is stored locally in IndexedDB, scoped to this app; save an `.isomap` file for a portable backup. Version 1 maps/drafts migrate automatically; version 2 saves retain custom terrain, piece sizes, and world lighting. Files are validated before replacing the current scene. No map content is uploaded. The site's existing analytics script still applies.

PNG exports are square at 1024, 2048, or 3072 pixels, fit the entire map and its cast shadow, and retain the current view quarter and world lighting. Transparency removes the backdrop. The underside shadow follows its World toggle in both opaque and transparent PNGs; turn it off for a clean cutout. Guides, controls, and selection are excluded. Export uses a separate renderer/camera and does not reposition the editor.

## Checks

Run `node scripts/test-isometric-map.mjs` from the repository root. Eighteen groups cover scene validation, every piece's geometry and four rotations, minimum/maximum resizable footprints, wide-bridge/jetty/stair supports, atomic placement and resizing, custom terrain, order-independent smoothing, brush/fill, v1 migration and malformed imports, sun math, shadow bounds, camera/picking, and instanced entity IDs.

Browser QA exercised custom terrain and cliff colors, details, leveling/smoothing, eyedropper, piece search, bridge resizing/recoloring/duplication, invalid rotation rollback, sun-wheel undo/cancel, underside shadow switching, portable files, and draft recovery. Emulated touch was checked at 390 and 320 CSS pixels, including canceled sun gestures preserving terrain and a no-change slider regression. PNG size/alpha and long-shadow margins were inspected independently with Pillow/NumPy. Physical phones and non-Chromium browsers have not been tested. This is a tile-based illustration tool, not a game or physics simulator.

## Dependencies

Three.js 0.187.0 is pinned locally under `vendor/` with its MIT license. The existing site font is Atkinson Hyperlegible Next. No runtime CDN imports, backend, package installation, or build step is needed.
