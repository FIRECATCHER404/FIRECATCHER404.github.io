# Void Lab

[Open Void Lab](https://firecatcher404.github.io/projects/void-lab/), a buildless 3D material sandbox in unbounded space. Nothing disappears at an invisible edge, and the placement grid has no collision surface.

## Controls

- **Place:** click to spawn a shape at rest, or drag to set its velocity in the placement plane. Choose **Exact XYZ velocity** to enter components instead. The coordinate panel places an object at a precise global position.
- Choose a box, sphere, cylinder, or tetrahedron; wood, glass, stone, steel, ice, or rubber; and independent **size and mass**. Size is the shape's half extent or radius. Changing shape or material preserves your chosen mass. Density is mass divided by volume.
- **View:** drag to orbit. Right-drag also orbits in any tool. Shift-drag or middle-drag pans. Scroll zooms toward the pointer; two fingers pan and pinch. Fit all and Focus recover objects outside the view.
- **Grab:** pull an unpinned object with a spring and release to throw it. Follow preserves a camera offset as the selected object moves; it temporarily holds the camera still during a grab.
- Click an object or choose it from the list to inspect it. Editing its fields pauses motion; Apply changes commits the edit. Pinned objects are immovable, unbreakable external anchors. They still contribute gravity.
- Space toggles Run/Pause, Home fits all, F focuses, Delete removes the selection, and Ctrl/Cmd-Z undoes an edit. Step advances one integration step. At extreme masses that step is shorter than 1/120 second.
- Undo/redo covers placements, edits, grabs, manual breaks, deletion, scene replacement, and imports. It restores the scene at the edit boundary, rather than rewinding a continuously running simulation.

## Gravity, mass, and compact objects

There is no black-hole shape, switch, preset, or lensing amount. Every object has the same mass property. The fixed scaled units use `G = 0.18` and `c = 40`. These are choices of units, not separate adjustable strengths. A mass `M` has a Schwarzschild radius `r_s = 2GM/c²`. When this radius encloses the object's bounding radius, the app derives a compact object automatically. For example, a sphere of size `0.25` and mass `5000` has `r_s = 1.125`; enlarging its size or reducing its mass changes that relationship without changing its material or selecting a special type.

Ordinary objects exert mutual Newtonian gravity through their persistent material-cell mass samples. Equal and opposite forces and their corresponding torques are applied to the rigid bodies. The samples remain at the same locations when the cells separate. Compact objects act as a single mass at their centre. Gravity has a `0.15` length softening to keep close encounters finite. A close pair reduces the integration time using its gravitational time scale; demanding scenes also run slower rather than increasing the integration step. The speed menu is a target.

The star field bends according to mass. Weak fields use the finite-observer deflection, tending to `4GM/(bc²)` for a distant observer. Near the dominant compact source, GPU RK4 traces Schwarzschild null geodesics, equivalent to `u'' + u = 3u²/2` for `u = r_s/r`. The captured-light shadow follows the critical impact parameter `3√3 r_s/2`, rather than an arbitrary painted disk. Its opaque horizon emits and reflects no light. Matter whose centre crosses the horizon is absorbed; its rest mass and linear momentum are added to the source, increasing the derived horizon radius. Pinned anchors are excluded from capture.

**This is an approximate sandbox, not a full general-relativity or engineering simulator.** Massive-body motion remains softened Newtonian rigid-body motion, including near a horizon; there is no relativistic speed correction, time dilation, frame dragging, gravitational radiation, or solution of the Einstein field equations for multiple moving masses. The light integrator assumes one dominant static spherical Schwarzschild source and uses weak-field approximations for the other visible sources. At most eight sources with the largest apparent gravitational influence bend the background. Meshes, guides, and trails themselves are not ray traced or gravitationally lensed. Capture is a centre-crossing sink approximation; it conserves rest mass and linear momentum, not relativistic energy, spin, or the full angular momentum of infalling matter. The material forces and strengths use illustrative scaled values. These limits matter if interpreting the experiment as real astrophysics.

References: [Schwarzschild radius, Einstein Online](https://www.einstein-online.info/en/explandict/schwarzschild-radius/), [Geometry and physics of black holes, Éric Gourgoulhon](https://relativite.obspm.fr/blackholes/bholes.pdf), and [Rapier contact-force events](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/).

## Collisions and breakage

Rapier handles 3D convex contact normals, friction, restitution, angular inertia, and continuous collision detection. A new shape is checked against the actual existing convex colliders, including while paused. Rendering and collision geometry use the same polyhedra. The sphere and cylinder use polygonal hulls.

Each new object starts as eight joined convex material cells. Hard collisions damage an object using pre-impact relative contact velocity and reduced mass. Crushing is separate: sustained, opposed loads from different bodies build compression damage, even below the hard-impact speed gate. Loads from several colliders on a single opponent are combined before checking for opposed forces. The damage tint can be hidden. Material breakage and its strength multiplier are experimental controls; rubber is rigid and bouncy, not a deformable soft body.

On fracture, the exact existing cells become independent objects, with their original density and orientation. A piece inherits `v + ω × (childCOM − parentCOM)` and the parent's angular velocity. There are no separation kicks, added gaps, or new mass. This preserves mass, centre of mass, linear momentum, angular momentum, and kinetic energy within the engine's numerical tolerance. Released pieces do not recursively fracture further. A fragment-budget limit holds the original together and records the limit instead of deleting matter.

## Persistence and practical limits

The local IndexedDB draft saves objects, velocities, spins, damage, settings, and camera position. Save scene downloads a portable JSON `.void` file with `format: "neoj-void"` and `version: 1`. Open scene validates an entire replacement world before disposing the current one. Invalid files leave the existing scene intact. There are no accounts or backend requests for scene contents.

The live scene has a maximum of 256 objects and 512 material cells; history keeps up to 20 edit snapshots within a 32 MB JSON budget. Scene imports are limited to 32 MB. New-object mass is between `0.000001` and `100000000` scaled mass units; size is `0.25` to `8`. Coordinates are numerically bounded and finite. Space has no floor, walls, or despawn radius, but precision and browser resources are finite. A floating origin follows distant camera targets to preserve nearby precision; widely separated objects still have single-precision rigid-body limits.

## Verification

Run `node scripts/test-void-lab.mjs` from the repository root. It uses the actual vendored Rapier WASM in Node and verifies shape partitions, paused overlap rejection, inertial motion without a floor, mutual force balance, fracture conservation, glass impact versus steel, low-speed compression, gentle contacts, rebound/CCD, fragment budgets, floating origins, mass-derived compactness, capture conservation, extreme-mass time stepping, Schwarzschild capture/deflection, portable scenes, invalid input, and a bounded mutual orbit.

Desktop Chromium checks exercised placement, drag/exact launches, material selection, editing, pinning, deletion, undo/redo, orbit/pan/zoom, grab/throw, follow, step, file download/import, invalid-file preservation, draft reload, live impact/compression, horizon creation/removal, capture, and distant focus. Touch emulation at 390 px and 320 px exercised place/drag, two-finger gestures, the controls drawer, and material selection without overflow. Rendered screenshots verified that changing mass changes background pixels and the horizon shadow. Physical-phone testing and full-GR validation have not been performed.
