# Sprite Rig 3D

A browser animation editor where 3D bones deform a sprite on one fixed flat plane. Open `index.html` through an HTTP server or use [the published editor](https://firecatcher404.github.io/projects/sprite-rig/). There is no build or backend. Sprites and drafts stay on the device; the page retains the website's analytics script.

## Rig and pose

Import a PNG, JPEG, or WebP sprite, or try the included Moss robot. The example has a waving animation with movement through depth.

- **Rig → Draw bone:** drag from a joint to a tip in the current camera view plane. Start at an existing tip to extend a chain. Turn off **Attach to selected bone** for a separate root.
- **Rig → Select joints:** drag a rest joint, including on world X, Y, or Z. Connected children follow a changed tip. The inspector edits rest offsets in parent space and rest rotation on all three axes.
- **Pose → Reach joint:** drag a tip to a 3D target. **Reach through parent joints** bends the unbranched chain without rotating its shared root. Bone lengths remain fixed.
- **Pose → Move bone:** translate the selected bone and its children in XYZ. Offsets are independent for each bone; moving a child can detach its base from its parent tip.
- **Pose → Rotate bone:** drag for free 3D rotation, or select X/Y/Z for a single world rotation axis. Numeric rotation fields edit the local pose rotation in degrees.
- Drag the colored **XYZ handles**, choose a **Drag axis**, or hold **Shift** to move through depth. A dashed handle indicates an axis pointing almost along the camera; the diagonal handle remains draggable from the front view.
- Numeric **Pose offset X/Y/Z** fields use the parent's coordinate frame. The tip coordinate readout uses world coordinates. World X points right, Y down, and positive Z away from the front camera.
- Select a bone from the list or canvas. The inspector also edits names, parents, and influence radius. Reparenting preserves the world rest transform. **Delete branch** removes a bone and its descendants; Undo restores it.

The artwork always lies on the world XY plane at Z=0, with the same orientation. It never rotates toward the editor camera, and its individual parts do not become 3D strips. Full 3D bone transforms first deform the source mesh with four-weight skinning; a fixed front projection then maps those vertices back onto the flat sprite. Moving a bone through depth changes the 2D position, scale, and foreshortening of its weighted artwork. Original 3D depths determine overlap order while every rendered sprite vertex remains at Z=0.

The fixed projection is centered on the original image, at a distance of twice its largest dimension. Positive Z shrinks artwork away from that center; negative Z enlarges it. Extreme negative Z can cross the projection limit: the editor shows a warning, and exports reject affected poses until they are moved back. Rest coordinates, bone data, keyframes, and image weights are retained when opening existing projects.

## Camera and weights

Right-drag, drag empty space, or enable **Orbit view** to orbit the 3D camera. Shift-right-drag and middle-drag pan. Scroll zooms around the pointer. **Front / Side / Top / Angle** set the view; **Fit** or Home frames the rig. The outlined sprite plane, ground grid, and orientation axes help show depth and are excluded from exports. Dashed guides show the bones projected onto the 2D plane. Orbiting only changes the view: Side sees the sprite nearly edge-on, while Front shows its 2D result.

On touchscreens, use **Orbit view** and one finger to orbit. Two fingers pan and zoom. Adding a second finger cancels an unfinished bone edit before navigating. **Controls** opens the sidebar on narrow screens. Toolbar taps activate on touch release and suppress their duplicate native click so buttons continue working immediately after a canvas gesture.

**Weights** temporarily uses the front rest view to paint on the original sprite. Select a bone, then paint its influence; bright green follows it more strongly. Shift or **Erase weight** removes influence. Painting switches off automatic weights. **Bind weights** recomputes weights from 3D rest segments and influence radii, and is undoable. Leaving Weights restores the preceding 3D view, including when Play is pressed.

## Per-pixel binding for pixel art

Choose **Weight binding ? Per pixel (pixel art)**. Each visible source pixel follows exactly one bone at full weight, independently of its neighbors. Initial binding uses the nearest 3D rest segment. The sprite still stays on the fixed XY plane, with 3D motion projected into 2D.

In **Weights**, choose a bone, then paint its pixels. **Pixel brush size = 1** assigns exactly one source pixel; larger square brushes cover 1?64 pixels per side. Fast strokes fill every crossed pixel. The native pixel grid appears when zoomed in, and the hover readout shows the source coordinate and current bone. Transparent source pixels are skipped. **Unbind pixels** or Shift leaves painted pixels at their original positions instead of attaching them to another bone. **Bind weights** resets all visible pixels to their nearest bone. Brush strokes and rebinds are undoable.

Pixel rendering uses independent source-pixel quads to produce a native-resolution image without antialiasing or texture filtering, then displays that image on the fixed plane. The pixel grid stays crisp while bones translate, rotate, and move through depth. Crisp sampling is locked on in this mode. Sharp changes of ownership can separate neighboring parts during animation; paint deliberate regions for each bone. Smooth mesh binding and its painted weights are preserved when switching modes, and pixel assignments are retained when switching back.

Per-pixel mode supports up to **65,536 visible source pixels**, including a fully opaque 256 ? 256 sprite; transparent pixels do not count. Each posed native raster is limited to 4096 pixels per side and 4 million pixels in total. A rejected mode switch leaves the existing project intact. The WebGL renderer has a CPU raster fallback; the fallback additionally bounds its per-frame raster work to 32 million pixel visits and reports an overly dense pose rather than hanging.

## Animation and project files

**Auto key** records the complete edited pose, including XYZ translations and quaternion rotations, at the current frame. With Auto key off, use **Add key**. Unkeyed poses can be saved or exported as a still; key them before animation export. Moving the playhead discards an unkeyed working pose. Click key diamonds or scrub the timeline. Space plays/pauses; arrows step frames; Ctrl/Cmd+Z undoes and Shift+Ctrl/Cmd+Z redoes. Shortcuts leave text fields alone.

Rotations interpolate using shortest-path quaternion slerp, including across the 180-degree boundary. Positions interpolate on all three axes. **Smooth transitions** eases the interpolation; looped animations interpolate between their last and first keys.

**Save project** downloads a version-3 `.spriterig` JSON file containing the embedded sprite, 3D hierarchy, grid weights, poses, keyframes, animation settings, playhead, unkeyed state, camera, binding mode, and per-pixel owners. **Open project** validates before replacement. Version-1 and version-2 files and browser drafts upgrade automatically. Existing projects use Smooth mesh by default. For version 1: 2D offsets become XYZ with Z=0, and their angles become Z-axis quaternions. Images, weights, timing, poses, and keys are retained.

Drafts use the existing IndexedDB store and recover after reload, including the 3D camera. Browser restrictions or storage limits can prevent saving; the UI reports this. Undo history is limited to the current session.

## Exports

- **Current frame PNG:** transparent still of the working 3D pose, including unkeyed edits.
- **Animated PNG:** all frames of the flat sprite from its fixed front view, with the selected timing and loop setting. Requires `CompressionStream`; playback support in other apps varies.
- **Sprite sheet + JSON:** ZIP containing `sprite-sheet.png` and `frames.json`. Each frame has zero-based `frame`, one-based `index`, pixel `x/y/width/height`, and duration in milliseconds. Metadata version 3 includes `bindingMode`, `projection.type: "fixed-front"`, the fixed projection parameters, the front `view`, scale, fps, loop, columns, rows, and `origin`: the original sprite's `(0,0)` position within each trimmed frame. Previous version-2 metadata used an editor view target as its origin.

Animation bounds include every active vertex in every frame after the 3D-to-2D projection. All frames share a crop and scale. Exports always use the sprite's front view, including when editing from Side, Top, or Angle; orbit, pan, and zoom do not affect the exported result. Poses that cross the fixed projection or exceed the export size limits fail instead of truncating frames.

Limits: 2048 × 2048 and 10 MB per sprite; 32 bones; 240 frames; 1–60 fps; 28 mesh columns with 4–48 proportionate rows; up to 30 undo entries within a 50-million-character budget; bone length 2–8192 sprite pixels; 20 MB project files. Export scale is ½×, 1×, or 2×, with at most 4096 pixels per frame dimension and 32 million total animation pixels. Sprite sheets are at most 8192 pixels per dimension.

The primary renderer uses WebGL with perspective texturing for the editor view and back-to-front ordering based on the source 3D depth. The sprite geometry stays coplanar, so depth testing is disabled for it. Canvas 2D provides a fallback with triangle sorting; fine seams and approximate perspective within each triangle may be visible there. `window.spriteRig.snapshot()` returns detached diagnostics, including world/projected joints, camera, gizmos, and fixed-plane geometry diagnostics.

## Verification

Run `node scripts/test-sprite-rig.mjs` at the repository root. Twenty-one groups cover quaternion rotations and inverses, hierarchical XYZ transforms, 3D skinning/IK and fixed lengths, translation through rotated parents, reparenting/deletion, joint connectivity, fixed-plane invariance, depth-to-2D changes, perspective camera math, weights, quaternion/depth interpolation, v1 upgrades, invalid files, front-view export bounds, per-pixel ownership/painting/erasing, continuous strokes, persistence, limits, and APNG/ZIP decoding. The last group needs Python with Pillow for an independent decoder.

Browser QA checks every rendered vertex stays at Z=0 during depth drags and playback, that orbiting does not change geometry, and that Side views the actual plane nearly edge-on. XYZ bone movement changes its 2D geometry and Undo restores it. Still exports made while editing from Front, Angle, and Side agree within 1/255 RGBA render rounding. Forty-eight APNG frames were decoded and compared with sprite-sheet crops: at most 1/255 premultiplied RGBA and alpha difference. Save/draft recovery, invalid-pose warnings and export rejection, WebGL/Canvas fallback, and emulated touch depth/orbit controls are checked. Physical phone testing remains unverified.

Pixel-mode browser QA verifies a single assigned pixel moves while its adjacent pixel does not, exact opaque source colors and alpha in still/APNG/sprite-sheet exports, automatic binding, unbinding, undo/redo, save/draft recovery, smooth/pixel mode switching, and the 65,536-pixel limit. The CPU export matches the GPU fixture byte for byte. Touch emulation covers single-pixel taps, pinch cancellation, and a 320-pixel layout; physical phones remain untested.
