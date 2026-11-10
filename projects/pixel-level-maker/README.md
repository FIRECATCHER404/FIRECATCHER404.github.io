# Pixel Level Maker

Paint a multi-room, top-down pixel dungeon with two independent drawing layers, configure triggers through a popup, and click Play. This first version focuses on exploration, room connections, doors, and simple interactive puzzles.

Buildless Canvas 2D/JavaScript. Open `index.html` through a static HTTP server. No dependencies, server-side storage, accounts, or asset downloads are needed. The editor uses the site's local Hyperlegible font; exported games use system fonts and contain their complete runtime and pixel data.

## The two layers

**Artwork** accepts any opaque RGB color, plus transparency through the eraser. It controls appearance, never collision. **Physics** assigns meaning to pixels:

| Color | Material | Behavior |
| --- | --- | --- |
| Blue `#549cde` | Floor | Walkable |
| Pink `#ed729e` | Wall | Blocks the player |
| Dark `#242735` | Void | Blocks movement outside the level |
| Cyan `#49c9cf` | Water | Walkable at 55% speed |
| Red `#f07560` | Hazard | Costs a heart and returns to the checkpoint |
| Green | Player start | One starting point per room |
| Orange | Door | A rectangular obstacle with an open/closed state |
| Purple | Trigger | A rectangular action region |

One physical pixel covers a configurable **1×1, 2×2, or 4×4** block of artwork pixels. Changing artwork resolution resamples the drawing with nearest neighbors and leaves physics unchanged. A single-pixel floor stripe is wide enough for the player's collision footprint; adjacent wall pixels still block movement. The sprite extends above its footprint, as in a top-down RPG.

Pencil, eraser, flood fill, line, filled/outlined rectangle, eyedropper, and object selection are available. Drag selected doors/triggers to move them. Space + drag, middle-drag, or right-drag pans. Scroll or pinch zooms, and Fit frames the room. The optional physics overlay helps align artwork with collision.

New rooms start with walkable ground and generated artwork. **Generate artwork from physics** repaints the current room with a simple stone/floor/water palette and is undoable. PNG import fits the image to the current artwork raster using nearest neighbors; alpha below 128 becomes transparent and other pixels become opaque. Physics is preserved. PNG export exports the artwork layer at its native resolution.

## Triggers and rooms

Choose **Trigger** in Physics, drag a region, and its popup opens. Use Select or the object list to reopen the popup. Choose activation on entry or nearby E interaction, whether it is initially enabled, whether it runs once, an optional flag condition, and an optional lever/chest/rune/doorway marker. With no marker, paint the appearance yourself.

Add up to 16 actions in execution order:

- Show a message.
- Go to another room, using its player start or a chosen arrival position.
- Open, close, or toggle a particular door.
- Enable, disable, toggle, or immediately fire another trigger.
- Set a named boolean flag, set the checkpoint, or finish the level.

Targets are labeled with room, name, and short object ID. A disabled trigger must first be enabled before it can fire. Enabling an entry trigger while already inside its area does not synthesize another entry: leave/re-enter, or use Fire immediately. Recursive chains visit each trigger at most once per activation and have a 128-action budget. Cycles cannot hang the page. Removing rooms or objects cleans up actions referring to them. Duplicating a room remaps its local object references and self-room destinations.

Doors are separate rectangular objects over floor. Painting a door lays floor underneath so opening it creates a walkable passage. Their built-in drawing can be disabled for custom artwork. Closing a door over the player relocates them to nearby free floor, or cancels the close if no free position exists.

## Play and export

Play creates a fresh copy of the project. **WASD/arrows** move; **E/Space/Enter** interact or acknowledge a message; **Escape** returns to editing. Touch devices have held movement buttons and an Interact button. Restart resets runtime flags, door states, spent triggers, checkpoint, and health. Stopping Play preserves the editor's pixels and settings.

Movement is normalized diagonally and split into short substeps, with a circular footprint against pixel walls and door rectangles. Room boundaries are solid. Unsafe spawn/arrival positions find nearby walkable floor; a fully blocked destination reports a message without changing rooms. Destination triggers already containing the arrival point are latched to prevent immediate room-change loops.

**Save project** writes compact RLE-compressed `.pixlevel` JSON; Open validates limits, rasters, references, and action types before replacing the editor. Drafts use IndexedDB plus a small-project localStorage recovery copy. Large drafts rely on IndexedDB, so save project files for portable backups. Undo/redo retains up to 30 compressed edit snapshots within an 8 MB history budget, always keeping one undo snapshot even if it exceeds the budget.

**Export playable HTML** packages the complete level and runtime into one file. Open the downloaded HTML directly, offline, without this website or a web server. It has its own movement, interaction, messages, restart, and ending UI. This was verified from a `file://` URL with all HTTP(S) requests blocked.

Limits: 20 rooms; 8–128 physical pixels wide and 8–96 high per room; one million artwork pixels across the project; 160 doors/triggers; 16 actions per trigger; 1,000 characters per message; project imports up to 32 MB. Room resizing keeps the top-left overlap and clamps object/spawn/arrival bounds. An entirely solid entrance cannot be played until it has walkable floor.

## Verification and current scope

Run `node scripts/test-pixel-level-maker.mjs`. Twenty-six groups cover compressed files, colors, independent layers, resampling, brush/line/rectangle/fill behavior, one-pixel floor strips, thin-wall collision, diagonal speed, water, door state isolation, trigger entry latches, interaction, ordered chains, cycles, flags, transitions, unsafe spawns, checkpoints/hazards, endings, resizing/deletion cleanup, strict imports, and safe standalone packaging.

Chromium browser QA recreated the pink-wall/blue-floor example through native editor input, painted at 4× artwork resolution without changing physics, configured an ordered room-transition/message trigger through its popup, checked undo/redo and immediate draft recovery, completed all three sample rooms and the ending, and ran an exported game offline. Touch emulation at 390 and 320 CSS pixels covers painting, pinch zoom without viewport growth, trigger creation and popup saving, movement press/release, and draft recovery. Physical phones, non-Chromium browsers, and actual OS focus-loss behavior remain unverified.

This is an exploration-level maker, not a full RPG engine: enemies, combat, custom player sprites, character animation editing, and arbitrary scripting are not included. Trigger actions use fixed data operations and never evaluate JavaScript.
