# Pixel Level Maker

Draw every visible pixel yourself. A separate physical layer gives those pixels meaning, and Play runs the behavior underneath the drawing. New projects and rooms start empty. There are no supplied characters, textures, object graphics, animated markers, tile sets, or generated artwork.

Buildless Canvas 2D/JavaScript artwork with hidden 3D collision and movement. **Paint the 3D perspective yourself:** the application does not rotate, extrude, relight, or replace your artwork. Serve `index.html` over HTTP. Exported games run directly from a single HTML file with no server, libraries, accounts, fonts, or network assets.

## 3D physics under your pixel art

Wall rows represent upright wall faces. Scanning each column from bottom to top, a wall pixel adds its configured height; floors above it are higher and offset forward in ground depth. The relationship is `ground depth = drawing Y + elevation / wall-pixel height`, so your original painted perspective remains in place. A floor above a two-pixel wall occupies a different physical elevation from the floor below it.

**Paint floor heights** overrides automatic elevation with the normal drawing tools. Erase or **Restore automatic heights** clears an override, and Reset clears them all. Overrides never change artwork or floor/wall meanings. The height brush shows numbers only in the editor's physical layer. Height overrides, wall-pixel height, and player body height are saved with each room; older files receive compatible defaults.

The player has a rectangular ground footprint plus a vertical body height. The runtime checks vertical walls, closed door volumes, floors, ceilings, and clearance between stacked floors. J / Jump adds upward velocity; gravity brings the player down onto a supporting floor. Walking off a raised edge onto lower ground falls rather than teleporting down. Small steps up to 0.26 units can be walked; taller ledges need a jump or a drawn stair route. Trigger interaction checks elevation so it cannot activate through a different floor. The room remains a surface map, not a freeform voxel sculptor: walls and floors must be authored through this pixel-to-space mapping.

## Two layers

- **Artwork:** any opaque RGB color, with transparency through erasing. It is the complete visible level.
- **Physics:** blue floor, pink blocking wall, dark void, cyan slow water, red hazard, green player region, orange door region, and purple trigger region. These colors are editor guides and do not replace the artwork in Play.

One physical pixel covers a configurable 1x1, 2x2, or 4x4 area of artwork pixels. Changing artwork resolution resamples the drawing with nearest neighbors while preserving the physical map.

Pencil, eraser, flood fill, line, filled/outlined rectangle, eyedropper, and selection tools are available. Space/middle/right drag pans; scroll or pinch zooms; Fit frames the room. Import/export PNG operates on the artwork layer. PNG import uses nearest-neighbor scaling and converts alpha below 128 to transparent; other pixels become opaque.

## Moving your pixels

Paint a green **Player region** by dragging a rectangle in Physics. Paint the player in Artwork over the same area. In Play, exactly those artwork pixels move as a group; nothing is filled in or substituted. A region with no artwork remains invisible, and the editor explains how to draw it. Its full drawn physical rectangle collides with walls, doors, void, and room boundaries.

Player pixels are lifted from their original location, which reveals the room's **cleared-area color**. This color also shows through erased pixels and opened door regions. Set it to the desired underlying color. With one artwork layer, covered background pixels are not separately stored or guessed.

The player's painted colors and physical dimensions travel between rooms. A green region in another room is an arrival marker, or that room's own player region if chosen as the starting room. Without one, room transitions find free floor near the room center or use the custom arrival position. Each room's green region is cleared from the static gameplay drawing so there is no duplicate stationary player.

Painting a player or door region lays floor underneath its physical rectangle. The artwork is untouched. New rooms otherwise contain no floor or artwork until you paint it.

## Door and trigger regions

An orange door region is a rectangular physical obstacle. Its appearance is whatever you paint over it in Artwork. Opening it clears those artwork pixels; closing it restores them. The application never draws a door graphic.

Choose Trigger in Physics, drag an area, and its action popup opens. Select an existing region or use the object list to reopen it. Trigger regions have no in-game markers or graphics. They can run on entry or nearby E interaction, start enabled/disabled, run once, and require a named boolean flag.

Up to 16 actions run in the listed order: show a message; go to another room; open/close/toggle a door; enable/disable/toggle/fire another trigger; set a flag; set a checkpoint; or finish the level. Messages pause movement for acknowledgement but do not defer later actions. Disabled triggers must be enabled before firing. Entry triggers latch until exit/re-entry; enabling one while already inside does not synthesize an entry. A chain visits each trigger at most once and is bounded to 128 actions.

Removing objects or rooms removes dangling target actions. Room duplication remaps local object targets and self-room destinations. Closing a door over the player finds nearby free floor, or cancels the close if none is available.

## Play, files, and limits

WASD/arrows move; J jumps; E/Space/Enter interact or acknowledge messages; Escape returns to editing. Touch has held movement buttons, Jump, and Interact. Restart resets runtime state. Play uses an independent copy and never changes editor pixels or settings. The optional physics preview is diagnostic only.

Movement is normalized diagonally and substepped against the full rectangular player region. A one-pixel-tall player can travel along a one-pixel floor stripe without entering adjacent walls. Water slows movement; hazards cost a health point and return to a checkpoint. Destination entry triggers containing the arrival point are latched to avoid immediate return loops.

Save/Open uses compact RLE `.pixlevel` JSON. Version 2 stores player rectangles. Version 1 files can be explicitly imported: existing artwork is retained, point starts become 1x1 player regions, and old marker settings are discarded. Version 1 drafts are left in their previous storage rather than silently opening the old generated sample. New draft storage is `neoj-pixel-level-maker-v2`, with IndexedDB plus a small-project localStorage recovery copy. Save files for portable backups. Undo retains up to 30 compressed snapshots in an 8 MB budget, keeping at least one full snapshot.

Export playable HTML includes only the project's drawn pixels, physical data, and the runtime. It opens offline as a single file. No assets are generated or fetched.

Limits: 20 rooms, 8-128 physical pixels wide and 8-96 high, one million artwork pixels total, 160 doors/triggers, 16 actions per trigger, 1,000 characters per message, and imports up to 32 MB. Resizing preserves the top-left overlap and clamps region/spawn/destination bounds. Play requires a starting player region and sufficient floor for its footprint.

## Verification

`node scripts/test-pixel-level-maker.mjs` covers independent layers, RGB/transparency, RLE validation, resampling, drawing tools, collision, interaction, trigger chains and cycles, flags, transitions, checkpoints, endings, reference cleanup, strict files, offline packaging, empty defaults, exact player-pixel extraction, invisible unpainted regions, rectangular body clearance, version migration, folded wall geometry, floor depth/elevation, jumping/landing, ceilings, overlapping floors, ledge falls, height persistence/validation, and trigger elevation.

Run `scripts/test-pixel-level-maker-browser.js` through the Playwright browser tool after serving the checkout on port 8974. It exercises painting tools, height editing, exact authored raster colors during Play, 3D movement/jumping, objects/action dialogs, room operations, settings, files/PNG, drafts, a network-disabled exported game, and emulated touch/responsive controls. Its optional second argument supplies `baseURL` and an `offlinePath` for QA exports. Combine this with all core tests before finishing an update. Physical phones and non-Chromium browsers need separate checks.
