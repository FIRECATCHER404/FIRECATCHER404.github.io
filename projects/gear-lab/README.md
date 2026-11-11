# Gear Lab

A buildless browser workbench for physical spur gears. Place pegs and gears, stack them on seven axial layers, and optionally lock gears on the same peg into a compound shaft. Choose teeth, module, thickness, material, motor speed/torque limit, and brake load. Start empty or load a pair, compound train, or overload example.

Motion is transferred by rigid-body **tooth contacts**, not by copying angular velocities or imposing a gear ratio. Pegs are fixed revolute bearings. A shaft lock is a fixed joint that preserves the initial angle difference. A torque-limited speed controller drives the selected gear; zero-speed joint motors provide static/dynamic brake resistance. Different modules need not mesh correctly.

The local Rapier 3D 0.21.0 WebAssembly engine runs at 240 Hz, with CCD and small contact tolerances. Shapes are sampled 20-degree involute profiles, assembled from convex tooth, rim, and hub pieces. The solver works in centimetres to avoid contact errors on millimetre features; positions, material density, forces, torque, mass and readouts are converted consistently to SI units. Rendering uses the existing local Three.js 0.187.0 modules. No runtime CDN is needed. These shared, unchanged dependencies and their licenses are documented under [Void Lab vendor](../void-lab/vendor/README.md) and [Isometric vendor](../isometric/vendor/README.md).

## Material failure

Acetal, hardwood, glass, aluminium, and steel have different density, friction, nominal strength, and damage responses. Measured tooth-contact forces drive a cantilever-section stress estimate and accumulated overload damage. A failed tooth, or a rim sector during severe brittle overload, detaches into an independently simulated rigid fragment. The original colliders are removed, so the broken gear genuinely loses that part of its tooth profile. Fragment velocities inherit the original rigid body's velocity field; no arbitrary explosion impulse is added.

This is an approximate failure model with predetermined tooth/rim crack boundaries. It does **not** solve finite-element elasticity, arbitrary crack propagation, plastic deformation, thermal wear, or grade-specific material behavior. Pegs and shaft locks remain ideal rigid supports. The material presets are illustrative, not manufacturing or safety data.

## Controls and files

- Peg/Gear tools: click the work area. Gear placement can create a peg and snap to the pitch distance and starting tooth phase of a nearby gear with the same module.
- Select: click a gear's face or a peg. Drag a peg/gear to move its entire peg stack. Changes pause and rebuild the intact mechanism.
- Stack a gear adds a free gear on the next available layer. Choose a gear in **Lock shaft to** and Apply to couple it. Layer spacing is 50 mm.
- Right-drag or Shift-drag orbits the camera. The front/3D view button and Fit reframe it; the wheel zooms.
- Run/Pause, single Step, Reset, stress colors, gravity, Undo/Redo, Delete, and Space/Ctrl+Z/Ctrl+Shift+Z are supported. Losing focus pauses.
- Save/Open `.gears` files and the local draft preserve the **intact design**, not a running fracture state. Reset repairs all runtime damage. Invalid files leave the current design intact.

Limits: 24 gears, 48 pegs, 8–48 teeth, 5–30 mm module, 6–40 mm thickness, seven stack layers, ±240 RPM, 500 N·m motor/brake limits, and 192 detached fragments. High speeds, dense mechanisms, and badly overlapping initial geometry can exceed the useful accuracy or performance of this discrete rigid-body model.

## Validation

Run `node scripts/test-gear-lab.mjs` and the self-contained `scripts/test-gear-lab-browser.js` through the Playwright browser tool. Serve the checkout at port 8974 for its default URL, or pass `{baseURL: 'https://…/projects/gear-lab/'}` as the browser function's second argument.

Core coverage includes real contact ratios at different modules/tooth counts, solver-scale regression, independent/locked stacks, static braking, motor limits, material overload versus steel resistance, disabled fracture, unloaded high-speed rotation, fragment mass/velocity conservation, strict files, and exact frame-time accumulation. Browser coverage exercises placement/snapping, controls, simulation, stacks/locks, examples, fracture, files/drafts, undo/redo, deletion, camera/movement and emulated touch/responsive layouts at 320, 390, and 768 px. Inspect the rendered app and verify deployed assets after Pages finishes. Physical devices and other browser engines need separate validation.

Implementation references: [Rapier joints](https://rapier.rs/docs/user_guides/javascript/joints/), [contact-force events](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/), and [revolute joint motors](https://rapier.rs/javascript3d/classes/RevoluteImpulseJoint.html).
