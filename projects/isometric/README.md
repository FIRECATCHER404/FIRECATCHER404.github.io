# Isometric Map Maker

A buildless, browser-only editor for small illustrated worlds. Open `index.html` through a static HTTP server. Requires WebGL 2. All models are original procedural geometry: matte colors, shallow bevels, orthographic projection, and soft shadows.

## Building

Choose terrain or a piece in **Pieces**, then click or drag on the map. Search finds pieces across every category. There are 22 terrain materials and 75 original pieces, including farms, greenhouses, a lighthouse, windmill, gazebo, market stall, buses, bicycles, playground pieces, crops, and more plants. Save favorites with the star button and filter to them beside Search. Favorites are browser preferences, separate from map files and undo.

Terrain has 1, 3, and 5 tile brushes, square/round shapes, and a connected fill that respects existing styles. **Draw with** adds straight lines and filled/outline rectangles; a drag previews its tiles before committing one undo step. Raise/lower changes height once per stroke, up to twelve levels. **Level** paints the chosen height; **Soften** averages neighboring heights from the stroke's original state. **Style this terrain** sets custom surface/cliff colors and plain, speckled, paved, or plank details. Pick a style from the map with **I**. Sculpting preserves colors and details. Erase removes props when the stroke starts on a prop, or cuts terrain when it starts on ground. Support checks protect existing buildings from uneven ground or accidental removal.

**Select** picks a prop; drag it to move it. The selection panel rotates, duplicates, recolors, resizes, or deletes it. Props snap to tile footprints, cannot overlap, and stay inside the map. Water lilies and boats need water. Bridges support widths of 1–3 and lengths of 2–16 tiles; every cell of both banks must be level and dry. Jetties need only their starting bank and extend up to 12 tiles. Walls, fences, hedges, benches, and stair widths are adjustable too. Size controls work before placement and on existing pieces. Rotation applies to the entire resized footprint; failed edits leave the piece and undo history unchanged.

Shift-click more pieces, or enable **Add pieces** on touch screens, to build a selection. Drag any selected piece to move the group. Rotate, recolor, duplicate, and delete apply to the whole selection; if any member is blocked, the entire edit is rejected. Quarter-turns anchor the group's top-left bounding tile to stay exactly on the grid. Copy/Paste uses an editor clipboard that can carry groups between scenes in the same session. **R** turns a copied group before placement.

**Scene → Objects** lists every piece with name, coordinates, selection, visibility, and lock controls. Use **Edit selection** to return to the selection panel. Hidden pieces disappear from rendering, picking, bounds, shadows, and PNGs, but still reserve their tiles. Locked pieces resist movement, recoloring, resizing, deletion, height changes beneath them, and map resizing that would crop them. Rename a single selected piece in its panel. Visibility and lock changes are undoable and saved in map files.

| Action | Control |
| --- | --- |
| Paint / current piece | B |
| Erase | E |
| Pick terrain style and height | I |
| Select / Hand | V / H |
| Rotate piece or selected prop | R |
| Copy / paste / duplicate selection | Ctrl/Cmd C / V / D |
| Select visible unlocked pieces | Ctrl/Cmd A |
| Landscape generator / object list | G / O |
| Pan | Hand, Space + drag, middle/right drag |
| Zoom | Scroll or + / − |
| Fit map | Home or Fit |
| Undo / redo | Ctrl/Cmd Z / Ctrl/Cmd Shift Z |
| Save map file | Ctrl/Cmd S |
| Delete selected prop | Delete |
| Cancel gesture / selection | Escape |

On touch screens, tap/drag to build and use two fingers to pan/pinch. Adding a second finger cancels any painting that started with the first. The palette closes after choosing a piece on narrow screens. Each completed building stroke is one undo step; canceled gestures restore their starting state.

## Files and exports

**Scene** contains seven example scenes (including Sunday Farm), a blank island, landscape creation, object management, map file save/open, and an undoable decoration clear that keeps locked pieces. **World** controls map dimensions, atmosphere, sunlight, and background. Maps range from 4×4 to 32×32 tiles with up to 256 props. Resizing keeps the top-left corner and crops unsupported unlocked pieces, with undo available. Forty undo snapshots are retained in memory.

**Create a landscape** offers islands, river valleys, rolling hills, archipelagos, and open meadows in meadow, autumn, desert, or snow biomes. Choose width/depth, seed, hill relief, and nature density. The same settings and seed produce the same result. Terrain and foliage use separate random streams, so changing density keeps terrain unchanged. **Create landscape** replaces the current map in one undo step while keeping world lighting. **Add nature to this map** keeps existing tiles and pieces, and fills suitable free locations with biome plants. Placements are bounded by support, occupancy, and the 256-piece limit. Edited tiles/props remain authoritative; generation does not keep running afterward.

The sun wheel updates lighting live: drag around for direction and inward for a higher sun. Low sunlight is warmer and casts longer shadows. Arrow keys on the wheel and the two sliders offer precise control. A sun drag is one undo action. **Shadow beneath the world** toggles only the shadow received by the void; shadows on the map stay enabled. The void color is also customizable.

A draft is stored locally in IndexedDB, scoped to this app; save an `.isomap` file for a portable backup. Version 1 and 2 maps/drafts migrate automatically. Version 3 also retains piece names, visibility, and locks. Files are validated before replacing the current scene. No map content is uploaded. The site's existing analytics script still applies.

PNG exports are square at 1024, 2048, or 3072 pixels, fit the visible map and its cast shadow, and retain the current view quarter and world lighting. Hidden pieces are excluded. Transparency removes the backdrop. The underside shadow follows its World toggle in both opaque and transparent PNGs; turn it off for a clean cutout. Guides, controls, and selection are excluded. Export uses a separate renderer/camera and does not reposition the editor.

## Checks

Run `node scripts/test-isometric-map.mjs` from the repository root. Twenty-nine groups cover all model bounds/rotations, resizable pieces and supports, atomic single/group edits, four-turn group recovery, copied metadata and ID exhaustion, visibility/locks, custom terrain and shapes, all landscape/biome combinations at minimum/maximum sizes, seeded repeatability, scatter preservation, migrations, malformed imports, lighting, shadows, camera/picking, and instanced entity IDs.

Browser QA exercised line/rectangle previews, group selection/drag/rotation/undo/rotated paste, favorites, object rename/hide/lock, map files, and draft recovery. Emulated touch at 390 and 320 CSS pixels covered group copy/paste, dynamic object rows, generation/undo, and two-finger shape cancellation. Hidden-object PNGs were compared pixel-for-pixel against an empty world to verify no geometry or shadow residue. Earlier sunlight/terrain/PNG checks remain covered by the model suite and focused browser checks. Physical phones and non-Chromium browsers have not been tested. This is a tile-based illustration tool, not a game or physics simulator.

## Dependencies

Three.js 0.187.0 is pinned locally under `vendor/` with its MIT license. The existing site font is Atkinson Hyperlegible Next. No runtime CDN imports, backend, package installation, or build step is needed.
