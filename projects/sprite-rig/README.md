# Sprite Rig 3D

A browser animation editor for a camera-facing sprite driven by a 3D skeleton. Open `index.html` through an HTTP server or use [the published editor](https://firecatcher404.github.io/projects/sprite-rig/). There is no build or backend. Sprites and drafts stay on the device; the page retains the website's analytics script.

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

The sprite remains flat artwork, with camera-facing skinned strips following the 3D bone axes. It does not become a volumetric model, and a single image cannot reveal unseen back surfaces. Four-weight blending joins the strips. Extreme poses, overlapping artwork, and looking along a bone can fold or compress parts of the drawing. A twist about an isolated strip's own axis does not make its surface turn edge-on; it can still rotate child bones. Weight painting and restrained poses help with joins.

## Camera and weights

Right-drag, drag empty space, or enable **Orbit view** to orbit the 3D camera. Shift-right-drag and middle-drag pan. Scroll zooms around the pointer. **Front / Side / Top / Angle** set the view; **Fit** or Home frames the rig. The ground grid and orientation axes help show depth and are excluded from exports.

On touchscreens, use **Orbit view** and one finger to orbit. Two fingers pan and zoom. Adding a second finger cancels an unfinished bone edit before navigating. **Controls** opens the sidebar on narrow screens. Toolbar taps activate on touch release and suppress their duplicate native click so buttons continue working immediately after a canvas gesture.

**Weights** temporarily uses the front rest view to paint on the original sprite. Select a bone, then paint its influence; bright green follows it more strongly. Shift or **Erase weight** removes influence. Painting switches off automatic weights. **Bind weights** recomputes weights from 3D rest segments and influence radii, and is undoable. Leaving Weights restores the preceding 3D view, including when Play is pressed.

## Animation and project files

**Auto key** records the complete edited pose, including XYZ translations and quaternion rotations, at the current frame. With Auto key off, use **Add key**. Unkeyed poses can be saved or exported as a still; key them before animation export. Moving the playhead discards an unkeyed working pose. Click key diamonds or scrub the timeline. Space plays/pauses; arrows step frames; Ctrl/Cmd+Z undoes and Shift+Ctrl/Cmd+Z redoes. Shortcuts leave text fields alone.

Rotations interpolate using shortest-path quaternion slerp, including across the 180-degree boundary. Positions interpolate on all three axes. **Smooth transitions** eases the interpolation; looped animations interpolate between their last and first keys.

**Save project** downloads a version-2 `.spriterig` JSON file containing the embedded sprite, 3D hierarchy, grid weights, poses, keyframes, animation settings, playhead, unkeyed state, and camera. **Open project** validates before replacement. Version-1 files and browser drafts upgrade automatically: 2D offsets become XYZ with Z=0, and their angles become Z-axis quaternions. Images, weights, timing, poses, and keys are retained.

Drafts use the existing IndexedDB store and recover after reload, including the 3D camera. Browser restrictions or storage limits can prevent saving; the UI reports this. Undo history is limited to the current session.

## Exports

- **Current frame PNG:** transparent still of the working 3D pose, including unkeyed edits.
- **Animated PNG:** all frames viewed through the current 3D camera, with the selected timing and loop setting. Requires `CompressionStream`; playback support in other apps varies.
- **Sprite sheet + JSON:** ZIP containing `sprite-sheet.png` and `frames.json`. Each frame has zero-based `frame`, one-based `index`, pixel `x/y/width/height`, and duration in milliseconds. Metadata version 2 includes the fixed `view` camera, scale, fps, loop, columns, rows, and `origin`: the projection of the view target within each frame. Version 1 used the original sprite's upper-left corner as its origin.

Animation bounds include every active mesh vertex in every frame, using the chosen camera and perspective. All frames share a crop and scale, and depth affects perspective and occlusion. Exporting from Weights uses the preceding 3D camera. Camera movement itself is not keyed. A camera crossing the animated geometry is rejected with a prompt to zoom out. Bounds that exceed the export limits fail instead of truncating frames.

Limits: 2048 × 2048 and 10 MB per sprite; 32 bones; 240 frames; 1–60 fps; 28 mesh columns with 4–48 proportionate rows; up to 30 undo entries within a 50-million-character budget; bone length 2–8192 sprite pixels; 20 MB project files. Export scale is ½×, 1×, or 2×, with at most 4096 pixels per frame dimension and 32 million total animation pixels. Sprite sheets are at most 8192 pixels per dimension.

The primary renderer uses WebGL with perspective texturing, depth testing, and back-to-front triangle ordering for transparency. Canvas 2D provides a fallback with triangle sorting; fine seams and approximate perspective within each triangle may be visible there. `window.spriteRig.snapshot()` returns detached diagnostics, including world/projected joints, camera, and gizmos.

## Verification

Run `node scripts/test-sprite-rig.mjs` at the repository root. Fourteen groups cover quaternion rotations and inverses, hierarchical XYZ transforms, depth skinning, 3D IK and fixed lengths, translation through rotated parents, reparenting/deletion, joint connectivity, camera-facing strips, perspective camera math, weights, quaternion/depth interpolation, v1 upgrades, invalid files, camera-aware export bounds, and APNG/ZIP decoding. The last group needs Python with Pillow for an independent decoder.

Browser QA covers native XYZ gizmo drags, depth IK, free and axis rotations, numeric editing, keyframes, playback through depth, camera orbit/pan, undo/redo, v1 import, and XYZ/camera save-file and draft recovery. Forty-eight 3D APNG frames were decoded and compared against their sprite-sheet crops: at most 1/255 premultiplied RGBA and alpha difference between render passes. Front/side/angled exports retain visible artwork. Browser touch emulation covers depth dragging, pinch cancellation/zoom, orbiting, toolbar taps after canvas gestures, and 390/320-pixel layouts. Physical phone testing remains unverified.
