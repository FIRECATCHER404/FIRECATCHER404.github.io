# Void Lab

[Open Void Lab](https://firecatcher404.github.io/projects/void-lab/), a 3D material sandbox in unbounded space. The view has no grid, floor, walls, or invisible despawn boundary.

## Controls

Tools opens a compact panel with Place, Orbit, and Grab modes. New object and Inspect have separate tabs. Detailed transforms and simulation settings stay collapsed until needed. Gravity is visible in the top bar, including when a collision example has disabled it. Scene contains examples and Save/Open file actions.

- Place: click to spawn at rest; drag to launch. Shape, material, mass, and size are independent. Select Enter XYZ velocity for a precise launch, or expand Position & spin for coordinates, a placement plane/offset, initial angular velocity, and a fixed anchor. Size is the shape's half extent or radius.
- Orbit: drag to orbit; Shift-drag or middle-drag pans. Right-drag orbits in any mode. Scroll zooms toward the pointer; two fingers pan/pinch. Fit all and Focus recover objects outside the current view.
- Grab: pull with a spring and release to throw. Follow tracks a selected object while retaining the camera offset. It holds the camera still during the actual grab.
- Inspect: click an existing object or choose it from the list. Editing pauses the simulation; Apply changes commits the edit. Fixing an object in space makes it an external anchor, excluded from fracture and capture.
- Space toggles Run/Pause, Home fits all, F focuses, Delete removes the selection, and Ctrl/Cmd-Z undoes an edit. Step advances a single integration step. The time scale is a target; the display reports when processing cannot keep up.

Undo/redo restores the whole scene at an edit boundary. It covers placement, edits, grabs, manual splits, deletion, scene replacement, and imports. It is not a continuous simulation rewind. Motion trails and damage tint are optional and off initially.

## Gravity and time

Each object has one source at its centre of mass. Pair forces are equal and opposite. Outside the bodies' equivalent-volume radii, the force is exactly inverse-square: `F = G m1 m2 / r^2`. Doubling distance quarters acceleration; changing the receiving object's mass does not change its acceleration. There are no discrete octant sources or gravity-induced spin torques. Within overlap, the force transitions continuously to the finite, central field of a uniform sphere using the larger equivalent-volume radius. This interior treatment is an approximation for nonspherical objects, not a constant softening applied at every distance.

Gravity uses kick-drift-kick integration around the rigid-body collision step. The maximum step is 1/120 second; close massive pairs and imminent fast collisions reduce it. Animation carries its sub-frame remainder forward and subtracts the actual elapsed substep, avoiding the previous mass-dependent loss of simulation time. Tiny render-frame remainders do not become separate contact steps. Processing and backlog are bounded; the app slows and reports the achieved rate if the browser cannot keep up.

The orbit example starts both bodies with balanced orbital momentum about their shared centre of mass. Tests run four orbital periods with bounded separation and relative energy error below 0.02% in the test environment.

## Contact and fracture

An intact object has one collider. Spheres use analytic round contacts; other primitives and fragments use convex hull contacts. The sphere's fracture surface is a finite 32-by-16 tessellation, with mass and inertia integrated over that tessellation. Mass properties for all hulls are integrated from signed tetrahedra and diagonalized with a Jacobi eigensolver before being supplied to Rapier, including asymmetric and clipped core pieces. The sphere surface/inertia is therefore a finite approximation, rather than an exact continuous volume reconstruction.

Fracture reads actual manifold contact points, normals and solved normal impulses. The incoming contact velocity includes angular motion, and the effective collision mass includes rotational inertia. The collision's dissipated energy is divided according to material compliance; it is not added repeatedly from a body's total speed. Sustained opposing loads are detected from the impulses of different opponents, divided by an approximate cross section. Pressure can classify a failure as compression, but does not invent a reservoir of launch energy.

A modest hit slices a shallow cap around the struck surface and keeps the large remaining core intact. The cap is cut into irregular Voronoi pieces. More absorbed energy permits deeper cuts and more fracture area. Wood's distance metric favors grain splits; glass and ice are brittle, stone needs harder impacts, steel has high fracture resistance, and rubber rebounds without brittle fracture. New internal surface area costs `toughness * area`; a proposed cut is rejected if the available energy cannot pay for it.

A piece inherits the parent's translation, angular velocity and `omega x (childCOM - parentCOM)`. No mass or geometry is discarded. A contact-pressure gradient can disperse shards using 18% of the energy remaining after the fracture cost. Its net linear and angular momentum are projected out before its kinetic energy is scaled to that budget. Fracture therefore does not add arbitrary explosion velocity. Further impacts can chip the core again, up to three fracture generations. Small-volume/radius and object-count limits keep the original intact rather than deleting matter.

**Fracture is still a rigid-fragment approximation.** It does not solve a continuum stress field, crack propagation through an elastic mesh, steel denting/bending, soft rubber deformation, or engineering-calibrated material strengths. Pressure uses a mean cross section, not a local finite-element stress tensor. Those remain unimplemented; the contact-local geometry and energy budget should not be interpreted as a materials-engineering solver.

## Compact objects and light

There is no black-hole shape, switch, preset, or lensing amount. Fixed scaled units use `G = 0.18` and `c = 40`. Mass sets `r_s = 2GM/c^2`; when this Schwarzschild radius encloses the object's bounding radius, the object becomes compact automatically. A sphere of size 0.25 and mass 5000 has `r_s = 1.125`.

Weak-field background light deflection tends to `4GM/(bc^2)` for a distant observer. Near the dominant compact source, GPU RK4 traces the static Schwarzschild null geodesic, equivalent to `u'' + u = 3u^2/2` for `u = r_s/r`. The captured-light shadow follows `3 sqrt(3) r_s / 2`. The opaque horizon emits/reflects no light. A swept centre path crossing the horizon is captured; rest mass and linear momentum are added to the source, and its mass-dependent horizon grows. Captured matter shifts the merged centre of mass.

**This is not full general relativity.** Massive-body motion remains Newtonian; there is no relativistic speed correction, time dilation, frame dragging, gravitational radiation or multi-mass solution of Einstein's equations. Background lighting assumes one dominant static spherical source plus weak-field approximations for up to seven other sources. Object meshes and trails are not gravitationally ray traced. Capture is a sink approximation that does not conserve full relativistic energy or infalling angular momentum. These are material limits when interpreting the sandbox as astrophysics.

References: [Rapier contact graph](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/), [contact manifolds](https://rapier.rs/javascript3d/classes/TempContactManifold.html), [collider mass properties](https://rapier.rs/javascript3d/classes/Collider.html#setMassProperties), [Schwarzschild radius, Einstein Online](https://www.einstein-online.info/en/explandict/schwarzschild-radius/), [Geometry and physics of black holes](https://relativite.obspm.fr/blackholes/bholes.pdf).

## Files and limits

IndexedDB stores a draft on this device. Save file downloads `.void` JSON with `format: "neoj-void"`, `version: 2`, the complete hulls, material properties, fracture generation/energy, transforms, motion, settings and camera. Version 1 files and drafts migrate automatically: intact precut objects become one hull without changing their stored mass, and their old grid setting is discarded. Open validates a whole replacement world before disposing the current scene. Invalid files leave the current scene intact. No scene data is sent to a server.

There are at most 256 live objects, three fracture generations, and 20 edit snapshots within a 32 MB JSON history budget. Imports are limited to 32 MB. New-object mass is 0.000001 to 100000000 scaled units; size is 0.25 to 8. Coordinates are finite and numerically bounded. A floating origin preserves nearby precision when focusing distant objects, but widely separated rigid bodies still have single-precision limits. Finite browser resources and numerical coordinates remain despite the lack of a spatial wall.

## Verification

Run `node scripts/test-void-lab.mjs` from the repository root. The 39 groups use the vendored Rapier WASM and verify independent polyhedral inertia, one-collider shapes, analytic gravity laws, multi-period orbit energy, exact timestep accounting including render-frame remainders, contact-local chipping, higher-energy fracture area, gentle/steel resistance, mirrored contacts, early high-speed impact, fragment M/COM/P/L/K conservation, energy-budgeted dispersion, compression, rebound/CCD, diagonal friction, repeated chipping, capacity, floating origins, horizons/capture, photon deflection, v2 persistence, v1 migration, and invalid input.

Desktop Chromium checks cover live modest chipping, compression, an orbit following wall time, place/drag, mass/name editing, pinning, undo/redo, files, invalid imports, draft recovery, grab/follow, and mass-derived compact objects. Touch emulation at 390 and 320 CSS pixels covers placement, launch, two-finger gestures, the tools drawer and inspector without horizontal overflow. Physical-phone testing, continuum fracture and full-GR validation remain unperformed.
