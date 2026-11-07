# Orbital Sandbox

A buildless, browser-local 3D gravity sandbox. Serve the repository over HTTP
and open `/projects/orbit/`.

## Controls

- **View:** drag to rotate the perspective camera; click a body to inspect it.
  Right-drag rotates with any tool. Shift-drag, middle-drag, and two-finger
  movement pan in the camera's view plane. Scroll or pinch zooms. Arrow keys
  rotate; Shift-arrow keys pan. `+` and `-` zoom, and Fit system/Home restores
  the initial viewing angle and frames the system.
- **Place:** choose planet, moon, or star, then click its horizontal height
  plane. Height Z sets that plane's position, and Launch velocity Z sets
  vertical launch speed. Drag to set X/Y velocity; one world unit of drag
  corresponds to two velocity units. The preview arrow shows the in-plane
  direction and the speed readout includes the Z component. A click uses
  zero X/Y velocity and the chosen Z velocity.
- **Orbit:** click a body to select the primary, then click empty space to
  create a new body with a circular relative starting velocity. The selected
  body receives the opposite recoil in X, Y, and Z. Orbit tilt rotates the
  orbit plane around world X; the visible grid passes through the selected
  body in that plane. Clockwise reverses the direction. Click the grid to
  choose the starting position and the new body's velocity is tangent to it.
  Other bodies can perturb the orbit; close or heavy neighbors can destabilize it.
- Zoom is anchored in the camera's target plane. Follow tracks the body's
  X/Y/Z position and keeps zoom centered on it. Panning turns off Follow.
- Pause/Play or Space on the canvas controls playback. Step pauses and
  advances one sixtieth of a simulation time unit. Time speed runs from ¼× to 16×.
  Canvas keyboard shortcuts do not capture typing in inputs.
- The selected-body form edits name, mass, XYZ position, and XYZ velocity. Apply changes
  commits only the edited fields together; unchanged positions and velocities
  keep their current simulation values. Delete removes the body. Follow centers the
  camera on it. Trails can be hidden or cleared.
- Undo restores the system to just before the last placement, body edit,
  deletion, preset load, or import, including that moment's simulation time.
  It keeps 30 edits in this tab; it is not a frame-by-frame rewind.
- On phones, Controls opens the settings drawer and Escape or a tap outside
  closes it. One finger uses the selected tool (View rotates); two fingers pan and zoom
  without placing extra bodies.

## Starting systems and storage

The mini solar system contains a star, three planets, and a moon on differently
inclined orbits; these are
invented sandbox bodies, not a scaled model of our Solar System. Planet & moon
and binary stars are inclined, isolated circular two-body systems. Empty space starts
with Star selected in the new-body picker.

The current system, simulation time, camera, selected body, and controls are
saved to `neoj.orbit.draft.v1` in localStorage. Closing/reloading the page
retains the draft when site storage is available. Trails and undo history
are session-only; reopening starts fresh trails at the saved positions.
Clearing site data removes the draft. Save system downloads an `.orbit` JSON
file as a portable backup. Open system validates the complete file before
replacing anything, and a successful import can be undone. No uploaded
system is sent to a backend. Imports are limited to 1 MB and 128 bodies.
Version 2 files retain XYZ body state, camera target/orientation, placement
height, Z launch velocity, and orbit tilt. Version 1 files and existing 2D
drafts are upgraded with zero Z position/velocity and a default 3D camera;
their old X/Y data, masses, and simulation time are preserved.

## Display

The primary renderer uses WebGL sphere meshes, perspective projection, and a
depth buffer. Bodies occlude each other and trails in 3D. Picking casts a ray
and selects its nearest sphere intersection. The placement grid and XYZ
compass help show depth. Tiny bodies receive a minimum visible marker size.

All uploaded vertices are relative to the camera target to reduce floating
point loss when the system moves far from the origin. When WebGL is
unavailable, a simpler Canvas renderer still projects and depth-sorts the
3D bodies; its trail occlusion and lighting are less detailed. Both renderers
use the same 3D simulation. No external graphics library or CDN is required.

## Physics and limits

Every pair of bodies attracts in X, Y, and Z; no star, planet, or moon is pinned.
Stars recoil under planet gravity, planets pull on other planets, and moons
also influence their primaries and neighbors. The model uses
normalized units with `G = 1`. For displacement `r` from body A to B,
acceleration of A due to B is:

```text
a = G * mass_B * r / (|r|² + softening²)^(3/2), r = (dx, dy, dz)
softening = 0.025
```

Equal/opposite pair forces preserve linear momentum. Integration uses
kick-drift-kick velocity Verlet with a maximum step of `1/240`. Steps shrink
for short gravitational time scales and predicted high-speed contact, so
quick bodies cannot simply pass through one another at the ordinary time step.

All bodies use a shared density (`radius = 0.08 * cbrt(mass)`). Contact merges
bodies, preserving total mass, center of mass, and linear momentum. The larger
body retains its name, color, and ID. Contact distances and merged XYZ
positions/velocities use all three dimensions. Merges are inelastic; kinetic energy
and internal spin are not preserved as separate state. Contacts are resolved
again after a merge so no overlapping survivors are left behind.

The Orbit tool uses the circular speed of the softened two-body force:

```text
relative_speed² = G * (primary_mass + new_mass) * distance²
                 / (distance² + softening²)^(3/2)
```

There is no drag or artificial damping. An isolated correctly placed pair
therefore keeps orbiting; an arbitrary multi-body system can collide or eject
bodies. Mass/velocity edits intentionally change the system's energy.

The sandbox allows 128 bodies, a minimum mass of `0.001`, and total mass up to
128 million. New-body inputs allow up to 1 million. Saved coordinates must
be within ±100 million and velocity components within ±10,000. View span is
limited to 0.5–10 million units. This is a finite-precision sandbox.

Each frame has a simulation-work budget. When a large system or requested
speed exceeds available processing time, **at capacity** appears and
simulation time advances more slowly. Uncomputed time is not added to the
simulation clock. Hidden tabs suspend advancement; resuming does not jump
forward by the time spent away. Trails retain at most 900 points per body.

## Validation

From the repository root:

```text
node scripts/test-orbital-sandbox.mjs
```

The suite checks independent three-dimensional all-pairs forces, influence
of a third body on both others, no fixed bodies, ballistic motion, 100 circular
revolutions, inclined/vertical orbit planes, all three momentum and angular
momentum components, binary center of mass, the solar preset's moon, fast
XYZ impacts, merge cascades, data validation/migration, camera projection,
ray picking, view-plane zoom anchors, and bounded trails.

Browser checks cover actual placement, drag launch, automatic orbits,
editing/deletion/undo, follow/pan/zoom, pause/step/speed, all presets, file
round-trips, 2D-file migration, draft reload, depth-buffer occlusion independent
of render order, foreground ray picking, height/Z-velocity controls, tilted
orbits, mutual-gravity mass changes, and emulated touch gestures and controls
at narrow phone widths. Physical-device testing remains separate.
`window.orbitalSandbox.snapshot()` exposes read-only diagnostics.

References: [NASA gravity and mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-1/)
and [LAMMPS velocity-Verlet description](https://docs.lammps.org/fix_nve.html).
