# Gear Lab

A physical gear workbench with a floor, axis-aligned support walls, surface-mounted pegs, gears, separate motors, and hand cranks. Start empty or load a floor-mounted motor train, a wall-mounted train, a hand-cranked pair, a compound shaft, or an overload example.

## Building

The **floor already exists**, has a collision shape, and catches falling fragments. Gravity starts enabled.

1. **Wall:** choose XY, YZ, or XZ. Click the floor or a platform top to place it. Vertical walls sit flush on their support; XZ makes a horizontal platform. Width, height/depth, and elevation are editable. Select a wall to resize or delete it. Moving it carries its pegs and gears. Remove attached pegs before changing its plane.
2. **Peg:** click a floor or wall face. Its shaft points out along that face's X, Y, or Z normal. All six wall-face directions work. The snap option adjusts new peg spacing to the pitch distance of a nearby compatible gear.
3. **Gear:** click an **existing peg**. Clicking empty space never creates a peg. Click the peg again, or any gear already on it, to place another ordinary gear above the stack. Placement chooses the next clear outer slot automatically, including extra motor-housing clearance. There is no Stack button or manual layer input. Stacked gears turn independently until fused or synced.

Use the same module for meshing gears. Thirty-two stack positions are 50 mm apart. Shafts extend to reach their highest part. Thicker motor housings need extra clearance; overlapping parts on a peg are rejected. A crank belongs on the outermost ordinary gear.

Select and drag a peg along its mounting face to move its stack. Drag a wall along the floor to move the whole assembly. Front-view dragging keeps movement on the visible allowed axis. Right-drag or Shift-drag on empty space orbits; wheel zooms; Fit reframes the mechanism. Peg dragging stays on its supporting face; wall dragging keeps its base height.

## Multiple selection and connections

**Shift-click** a part to add or remove it. A normal click replaces the selection; clicking an already selected part keeps the group available for dragging. Selected gears, motor housings, pegs, and walls are highlighted. The **Parts** list also supports Shift-click and reaches gears covered by other stack layers. **Add selection** provides the same toggle behavior on touch screens. Ctrl+A selects all gears; Escape clears selection and Add selection mode.

- **Fuse stack** joins selected gears on the same peg with rigid shaft joints. Different tooth counts can form a compound train while preserving their initial angular offsets.
- **Sync 1:1** couples rotation on parallel shafts pointing in the same direction. Their centres remain on their own pegs, their starting phase offsets are preserved, and the solver transfers torque and braking load. Sync works with motors or hand cranks. It is an ideal rotational coupling; it does not create a visible belt or simulate a gearbox. Directly meshing gears normally need opposite rotation and should not also receive a same-direction Sync connection.
- **Disconnect** removes connections incident to the selected parts, including older shaft links. Fuse or Sync reconnects selected parts and replaces their previous incident connections. Other parts and their connections remain intact.
- **Apply to selected gears** changes geometry, material, and brake load together. Motor settings are applied together when every selected part is a motor; mixed gear/motor selections retain the motors' drive settings. Mount positions, layers, crank attachments, and connections are preserved.
- **Drag** a selected part to move the selected mounts together. Each peg stack moves once; a selected wall carries its attached pegs once. Movement respects all selected mounting planes, and out-of-bounds changes are rejected. **Delete** removes every selected part, cascading from walls and pegs as usual. Undo/Redo restores the complete operation.

Fuse requires a single peg; Sync requires parallel shaft directions. Invalid operations leave the design and history intact. Connection loops, duplicate connections, and inconsistent constant-RPM motor commands are rejected. Thirty-two occupied slots or an attached outer hand crank prevent further stacking; remove the crank before extending its stack.

## Motors and hand cranks

**Motor** places a separate housing with a rotating gear in its centre. It can mount on a surface with an integral shaft, or use an existing peg. Its default **Constant RPM** drive is a velocity-controlled kinematic rotor that holds the selected RPM while the simulation runs. Other gears receive motion through physical tooth contacts. The optional **Torque limited** mode preserves the earlier finite-torque behavior and can stall under load. Brake load applies to ordinary gears and torque-limited rotors.

**Hand crank** attaches a lever and grip to an ordinary gear. Click the grip or **Latch handle**, then move the pointer around the shaft to crank it. Touch can latch and drag the same handle. Click again, press Escape, or choose Release to let go. Latching starts the simulation; release removes the hand torque and leaves it running. If the crank is edge-on, the camera turns enough to make it usable. The grip turns green while latched.

To hand-drive a train that includes a motor, choose Torque limited and set its torque to zero.

The crank applies limited torque through the physics solver, including to any meshing or shaft-linked gears. It does not directly change gear transforms. **Hand torque** sets the torque limit. The arm and grip have collision shapes and contribute mass. Remove crank detaches the accessory from the design.

Design edits pause and rebuild the intact mechanism. Run/Pause, single Step, Reset, stress colors, gravity, Undo/Redo, Delete, Space, Ctrl+Z, and Ctrl+Shift+Z remain available. Losing focus pauses and releases a latched crank.

## Gear stepper example

Choose **Gear stepper / 2:1 speed-up**, set **Stepper stages** (1–20, default 20), and load the example. A 20-tooth, 6 RPM motor drives a 10-tooth gear. Each 10-tooth gear has a 20-tooth gear fused directly above it; that upper gear meshes with the next pair. Successive pairs rise one 50 mm position along their pegs so each large gear stays above its small gear. The full example has 41 gears on 21 floor-mounted shafts with 20 fuse joints.

Each mesh doubles speed and reverses direction. Twenty stages have an ideal gain of **1,048,576×**, giving **6,291,456 RPM** from the default 6 RPM input. The panel separates measured output from ideal output, and its table shows every stage. Edit the motor RPM normally. Stage count controls the next example load; it does not resize an existing edited mechanism. Save/Open, drafts, and Undo/Redo preserve the full train and its measurement metadata. Measurements hide if edits disconnect or alter the preset's mesh arrangement.

**Physics is the default.** One and three-stage tests reach their expected speed ratios. The full 20-stage train does not maintain the ideal ratio in this contact solver; acceleration, reflected inertia, finite contact constraints, discrete stepping and possible fracture limit its result. Treat the measured values as this model's output, not a prediction of a real million-RPM mechanism. Reducing the stage count makes physical motion easier to inspect.

**Ideal motion preview** is an explicit alternative for viewing the complete multiplication. It animates the ideal ratios without advancing rigid-body physics, applying forces or breaking parts. The stage table shows preview turns and ideal RPM; readouts identify the preview. Run/Pause, Step and Reset control its separate clock. Switching modes resets motion. Preview does not write animated angles into the design or saved file. Latching a hand crank switches back to physics. At high RPM, frame sampling can make visible rotation appear slow or reversed.

## Physics and breakage

Local Rapier 3D 0.21.0 runs at 240 Hz with CCD and small contact tolerances. Sampled 20-degree involute teeth transfer contact forces; gear ratios are not copied between objects. Pegs use oriented revolute bearings, and shaft locks use fixed joints. The solver works in centimetres with consistent SI conversions for dimensions, mass, forces, torque and readouts. Rendering uses local Three.js 0.187.0 modules. Dependency versions and licenses: [Rapier/Three vendor](../void-lab/vendor/README.md), [Three vendor](../isometric/vendor/README.md).

Acetal, hardwood, glass, aluminium and steel differ in density, friction, nominal strength and overload response. Measured contacts drive a tooth-section stress estimate and accumulated damage. Failed teeth or rim sectors become separate colliding fragments with inherited rigid-body velocity. The gear loses the corresponding collision shapes and visible geometry. The floor and walls remain physical obstacles to these pieces.

Fracture is an approximation with predefined tooth/rim boundaries. Finite-element elasticity, arbitrary cracks, plastic deformation, thermal wear, and grade-specific material behavior are not modeled. Pegs, walls, motor housings and shaft locks are rigid supports. Material presets are illustrative, not manufacturing data.

## Files and limits

Save/Open `.gears` files and the local draft preserve the **intact design**, including walls, mounted axes, motors, crank attachments, legacy shaft links, and new Fuse/Sync connections. They do not store running fracture state. Reset repairs damage. Invalid files preserve the current mechanism and history.

Version 2 files store the 3D mounts and an optional `couplings` array for Fuse/Sync. Earlier version 2 files without that array load with no new connections; their existing shaft links remain valid. Version 1 files and drafts acquire a support wall behind their original XY mechanism and retain finite-torque motor settings. Mechanisms below the new floor are translated upward together while retaining their relative layout. Old draft storage is left intact; new drafts use `neoj-gear-lab-v2`.

Limits: 64 gears/motors, 48 pegs, 24 walls, 8–48 teeth, 5–30 mm module, 6–40 mm gear thickness, 32 stack positions, ±240 RPM, 500 N·m torque/brake limits, 0.1–50 N·m hand torque, and 192 detached fragments. High speeds, dense mechanisms, and badly interfering tooth layouts can exceed this discrete rigid-body model's useful accuracy or performance.

## Regression checks

Run `node scripts/test-gear-lab.mjs`. Run `scripts/test-gear-lab-browser.js` through the Playwright browser tool after serving the checkout on port 8975, or pass `{baseURL: 'https://…/projects/gear-lab/'}` as its second argument. The browser suite also accepts a `groups` array for focused retries; run it without filters for the final regression.

Coverage includes the original ratios, braking, material failure, mass conservation, files and histories, plus the complete stepper layout, short physical stepper ratios, finite full-train runtime, ideal preview/rendered rotations, long-shaft rendering, wide/tall Fit, large-design file/draft/history round trips, repeated peg/gear placement, stack capacity and crank obstruction, world/list Shift-selection, rendered highlights, bulk editing/movement/deletion, fused stacks, load-bearing Sync on all shaft directions, connection files/history, touch selection actions, floor collision, all six mounting directions, XY/YZ/XZ wall placement, mandatory peg placement, constant-RPM motors, crank torque and coupling, actual mouse/touch handle gestures, edge-on crank visibility, wall resizing/movement/deletion, housing clearance, legacy migration, and 320/390/768 px layouts. Check the rendered scene, wait for Pages deployment, compare deployed files and repeat browser checks on the public page. Physical devices and non-Chromium browsers need separate validation.

References: [Rapier rigid-body types](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/), [joints](https://rapier.rs/docs/user_guides/javascript/joints/), [contact-force events](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/).
