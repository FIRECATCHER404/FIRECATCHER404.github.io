# Sprite Rig

A browser sprite rigging and animation editor. Open `index.html` through a local HTTP server, or use [the published editor](https://firecatcher404.github.io/projects/sprite-rig/). There is no build or backend. Imported sprites and project drafts stay on the device; the page uses the website's existing analytics script.

## Controls

- Import a PNG, JPEG, or WebP sprite, or try the included Moss robot.
- **Rig → Draw bone:** drag from a joint to a tip. Start on an existing tip to extend a chain. Turn off **Attach to selected bone** for a separate root. **Select joints** lets you drag the rest joints; attached children follow a changed tip.
- Select bones in the list or on the canvas. The inspector edits names, parents, influence radius, pose rotation, and root offsets. **Delete branch** removes the selected bone and its descendants; Undo restores them.
- **Pose:** drag a tip to rotate it. **Reach through parent joints** bends its unbranched chain without rotating the shared root. Drag a root base to translate the rig.
- **Weights:** select a bone in the list, then paint its influence on the sprite. Bright green means more influence. Shift or **Erase weight** removes influence. Painting switches off automatic weights. **Bind weights** recomputes all weights using the influence radii; this is undoable.
- **Auto key** records the entire edited pose at the current frame. Otherwise use **Add key**. Unkeyed poses can be saved or exported as a still, but must be keyed before animation export. Moving the playhead discards an unkeyed working pose.
- Click key diamonds, scrub, or use previous/next key buttons. Space plays/pauses; left/right arrows step frames; Home fits the sprite. These shortcuts leave text fields alone. Ctrl/Cmd+Z undoes; Shift+Ctrl/Cmd+Z redoes.
- Scroll/pinch zooms around the pointer. Right-drag, Alt-drag, or dragging empty space pans. Two fingers pan and zoom; introducing a second finger cancels an unfinished bone edit. On narrow screens, **Controls** opens the sidebar.

The rig uses a regular grid and four-weight linear blend skinning. An overlapping flat drawing can stretch at joints, and extreme rotations can fold the mesh. Weight painting and smaller rotations help. This is a single-sprite editor; it does not split a sprite into independently layered body parts. The example includes manually tuned weights. Rest edits preserve animation keys and change the frame those poses are applied to.

## Files and exports

**Save project** downloads a `.spriterig` JSON file with an embedded sprite, bone hierarchy, grid weights, pose, keyframes, playback settings, playhead, and unkeyed state. **Open project** validates it before replacing the current project. Browser drafts use IndexedDB and recover after reload; private browsing or storage limits can prevent draft saving, which the UI reports. Undo history is for the current session only.

- **Current frame PNG:** transparent still of the working pose, including unkeyed edits.
- **Animated PNG:** full RGBA APNG with the project's frame rate and looping setting. A browser needs `CompressionStream` for this export. APNG playback support in other apps varies.
- **Sprite sheet + JSON:** ZIP containing `sprite-sheet.png` and `frames.json`. Each frame entry has zero-based `frame`, one-based `index`, pixel `x/y/width/height`, and duration in milliseconds. The shared `origin` gives the sprite's original `(0,0)` position within each exported frame. `scale`, `fps`, `loop`, `columns`, and `rows` are also recorded.

Animation frames share bounds calculated from every posed frame to avoid clipping moving parts. Export scale is ½×, 1×, or 2×. No bones, grid, or checkerboard appear in exports. Fractional alpha remains transparent. The custom PNG writer follows the [PNG/APNG specification](https://www.w3.org/TR/png-3/); ZIP uses stored entries, since the image is already compressed.

Limits: sprites up to 2048 × 2048 and 10 MB; 32 bones; 240 frames; 1–60 fps; a 28-column mesh with proportionate rows (4–48); up to 30 undo entries within a 50-million-character budget. Bone length is 2–8192 sprite pixels. Project files can be up to 20 MB. Exports are bounded to 4096 pixels per frame dimension and 32 million total animation pixels, with sprite sheets at most 8192 pixels per dimension. Oversized exports fail with a message instead of truncating frames.

The primary renderer is WebGL, with a Canvas 2D fallback. The fallback can show fine triangle seams. `window.spriteRig.snapshot()` returns a detached, read-only diagnostic snapshot.

## Verification

Run `node scripts/test-sprite-rig.mjs` from the repository root. It checks inverse binds, hierarchical rotation, skinning, CCD IK, reparenting, deletion, joint connectivity, weight normalization/painting, interpolation, file validation, alpha-aware bounds, and APNG/ZIP output. The export test uses independent Python `Pillow` and `zipfile` decoders.

Browser QA covers imports, bone creation, rest and posed joints, automatic and manual keys, playback, weight painting/rebinding, undo/redo, file and draft recovery, and actual exports. The demo's 48 exported animation frames were decoded and compared against corresponding sprite-sheet crops: identical alpha and at most 1/255 RGB rounding difference. Touch posing, pinch cancellation, drawer controls, and layouts at 390/320 pixels were checked with browser touch emulation; physical phone testing remains unverified.
