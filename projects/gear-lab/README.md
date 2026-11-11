# Gear Lab

A physical gear workbench with a floor, axis-aligned support walls, surface-mounted pegs, gears, separate motors, and hand cranks. Start empty or load a floor-mounted motor train, a wall-mounted train, a hand-cranked pair, a compound shaft, or an overload example.

## Building

The **floor already exists**, has a collision shape, and catches falling fragments. Gravity starts enabled.

1. **Wall:** choose XY, YZ, or XZ. Click the floor or a platform top to place it. Vertical walls sit flush on their support; XZ makes a horizontal platform. Width, height/depth, and elevation are editable. Select a wall to resize or delete it. Moving it carries its pegs and gears. Remove attached pegs before changing its plane.
2. **Peg:** click a floor or wall face. Its shaft points out along that face's X, Y, or Z normal. All six wall-face directions work. The snap option adjusts new peg spacing to the pitch distance of a nearby compatible gear.
3. **Gear:** click an **existing peg**. Clicking empty space never creates a peg. The chosen layer places it along the shaft. Stack a gear uses the next free layer; choose **Lock shaft to** to make a compound shaft. Stacked gears otherwise turn independently.

Use the same module for meshing gears. Seven stack layers are 50 mm apart. Thicker motor housings need extra clearance; overlapping parts on a peg are rejected. A crank belongs on the outermost ordinary gear.

Select and drag a peg along its mounting face to move its stack. Drag a wall along the floor to move the whole assembly. Front-view dragging keeps movement on the visible allowed axis. Right-drag or Shift-drag orbits; wheel zooms; Fit reframes the mechanism. Peg dragging stays on its supporting face; wall dragging keeps its base height.

## Motors and hand cranks

**Motor** places a separate housing with a rotating gear in its centre. It can mount on a surface with an integral shaft, or use an existing peg. Its default **Constant RPM** drive is a velocity-controlled kinematic rotor that holds the selected RPM while the simulation runs. Other gears receive motion through physical tooth contacts. The optional **Torque limited** mode preserves the earlier finite-torque behavior and can stall under load. Brake load applies to ordinary gears and torque-limited rotors.

**Hand crank** attaches a lever and grip to an ordinary gear. Click the grip or **Latch handle**, then move the pointer around the shaft to crank it. Touch can latch and drag the same handle. Click again, press Escape, or choose Release to let go. Latching starts the simulation; release removes the hand torque and leaves it running. If the crank is edge-on, the camera turns enough to make it usable. The grip turns green while latched.

To hand-drive a train that includes a motor, choose Torque limited and set its torque to zero.

The crank applies limited torque through the physics solver, including to any meshing or shaft-linked gears. It does not directly change gear transforms. **Hand torque** sets the torque limit. The arm and grip have collision shapes and contribute mass. Remove crank detaches the accessory from the design.

Design edits pause and rebuild the intact mechanism. Run/Pause, single Step, Reset, stress colors, gravity, Undo/Redo, Delete, Space, Ctrl+Z, and Ctrl+Shift+Z remain available. Losing focus pauses and releases a latched crank.

## Physics and breakage

Local Rapier 3D 0.21.0 runs at 240 Hz with CCD and small contact tolerances. Sampled 20-degree involute teeth transfer contact forces; gear ratios are not copied between objects. Pegs use oriented revolute bearings, and shaft locks use fixed joints. The solver works in centimetres with consistent SI conversions for dimensions, mass, forces, torque and readouts. Rendering uses local Three.js 0.187.0 modules. Dependency versions and licenses: [Rapier/Three vendor](../void-lab/vendor/README.md), [Three vendor](../isometric/vendor/README.md).

Acetal, hardwood, glass, aluminium and steel differ in density, friction, nominal strength and overload response. Measured contacts drive a tooth-section stress estimate and accumulated damage. Failed teeth or rim sectors become separate colliding fragments with inherited rigid-body velocity. The gear loses the corresponding collision shapes and visible geometry. The floor and walls remain physical obstacles to these pieces.

Fracture is an approximation with predefined tooth/rim boundaries. Finite-element elasticity, arbitrary cracks, plastic deformation, thermal wear, and grade-specific material behavior are not modeled. Pegs, walls, motor housings and shaft locks are rigid supports. Material presets are illustrative, not manufacturing data.

## Files and limits

Save/Open `.gears` files and the local draft preserve the **intact design**, including walls, mounted axes, motors, crank attachments and shaft links. They do not store running fracture state. Reset repairs damage. Invalid files preserve the current mechanism and history.

Version 2 files store the 3D mounts. Version 1 files and drafts acquire a support wall behind their original XY mechanism and retain finite-torque motor settings. Mechanisms below the new floor are translated upward together while retaining their relative layout. Old draft storage is left intact; new drafts use `neoj-gear-lab-v2`.

Limits: 24 gears/motors, 48 pegs, 24 walls, 8–48 teeth, 5–30 mm module, 6–40 mm gear thickness, seven stack layers, ±240 RPM, 500 N·m torque/brake limits, 0.1–50 N·m hand torque, and 192 detached fragments. High speeds, dense mechanisms, and badly interfering tooth layouts can exceed this discrete rigid-body model's useful accuracy or performance.

## Regression checks

Run `node scripts/test-gear-lab.mjs`. Run `scripts/test-gear-lab-browser.js` through the Playwright browser tool after serving the checkout on port 8975, or pass `{baseURL: 'https://…/projects/gear-lab/'}` as its second argument. The browser suite also accepts a `groups` array for focused retries; run it without filters for the final regression.

Coverage includes the original ratios, braking, material failure, mass conservation, files and histories, plus floor collision, all six mounting directions, XY/YZ/XZ wall placement, mandatory peg placement, constant-RPM motors, crank torque and coupling, actual mouse/touch handle gestures, edge-on crank visibility, wall resizing/movement/deletion, housing clearance, legacy migration, and 320/390/768 px layouts. Check the rendered scene, wait for Pages deployment, compare deployed files and repeat browser checks on the public page. Physical devices and non-Chromium browsers need separate validation.

References: [Rapier rigid-body types](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/), [joints](https://rapier.rs/docs/user_guides/javascript/joints/), [contact-force events](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/).
