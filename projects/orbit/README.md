# Orbital Sandbox

A buildless, browser-local 2D gravity sandbox. Serve the repository over HTTP
and open `/projects/orbit/`.

## Controls

- **Place:** choose planet, moon, or star, then click empty space to place it
  at rest. Drag from the starting point in the launch direction to set a
  velocity. A preview arrow shows the direction and speed. One world unit of
  drag corresponds to two velocity units.
- **Orbit:** click a body to select the primary, then click empty space to
  create a new body with a circular relative starting velocity. The selected
  body receives the opposite recoil. Clockwise reverses the direction.
  Other bodies can perturb the orbit; close or heavy neighbors can destabilize it.
- **Select:** click a body to inspect it; drag to pan. Shift-drag, middle-drag,
  right-drag, and two-finger movement pan with any tool.
- Scroll or pinch to zoom, anchored at the pointer or pinch center. Follow
  mode keeps zoom centered on the followed body. Fit system/Home frames the
  bodies around their center of mass. Panning turns off Follow.
- Pause/Play or Space on the canvas controls playback. Step pauses and
  advances one sixtieth of a simulation time unit. Time speed runs from ¼× to 16×.
  Arrow keys pan; `+` and `-` zoom. Canvas keyboard shortcuts do not capture typing in inputs.
- The selected-body form edits name, mass, and X/Y velocities. Apply changes
  commits all fields together. Delete removes the body. Follow centers the
  camera on it. Trails can be hidden or cleared.
- Undo restores the system to just before the last placement, body edit,
  deletion, preset load, or import, including that moment's simulation time.
  It keeps 30 edits in this tab; it is not a frame-by-frame rewind.
- On phones, Controls opens the settings drawer and Escape or a tap outside
  closes it. One finger uses the selected tool; two fingers pan and zoom
  without placing extra bodies.

## Starting systems and storage

The mini solar system contains a star, three planets, and a moon; these are
invented sandbox bodies, not a scaled model of our Solar System. Planet & moon
and binary stars are isolated circular two-body systems. Empty space starts
with Star selected in the new-body picker.

The current system, simulation time, camera, selected body, and controls are
saved to `neoj.orbit.draft.v1` in localStorage. Closing/reloading the page
retains the draft when site storage is available. Trails and undo history
are session-only; reopening starts fresh trails at the saved positions.
Clearing site data removes the draft. Save system downloads an `.orbit` JSON
file as a portable backup. Open system validates the complete file before
replacing anything, and a successful import can be undone. No uploaded
system is sent to a backend. Imports are limited to 1 MB and 128 bodies.

## Physics and limits

All bodies attract one another; no star or planet is pinned. The model uses
normalized units with `G = 1`. For displacement `r` from body A to B,
acceleration of A due to B is:

```text
a = G * mass_B * r / (|r|² + softening²)^(3/2)
softening = 0.025
```

Equal/opposite pair forces preserve linear momentum. Integration uses
kick-drift-kick velocity Verlet with a maximum step of `1/240`. Steps shrink
for short gravitational time scales and predicted high-speed contact, so
quick bodies cannot simply pass through one another at the ordinary time step.

All bodies use a shared density (`radius = 0.08 * cbrt(mass)`). Contact merges
bodies, preserving total mass, center of mass, and linear momentum. The larger
body retains its name, color, and ID. Merges are inelastic; kinetic energy
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

The suite checks analytical pair forces, ballistic motion, 100 circular
revolutions, binary motion and center of mass, the solar preset's moon,
fast impacts, merge cascades, mass/momentum conservation, invalid-input
atomicity, saved-scene validation, camera anchors, and bounded trails.

Browser checks cover actual placement, drag launch, automatic orbits,
editing/deletion/undo, follow/pan/zoom, pause/step/speed, all presets, file
round-trips, corrupt-file rejection, draft reload, and emulated touch gestures
and controls at narrow phone widths. Physical-device testing remains separate.
`window.orbitalSandbox.snapshot()` exposes read-only diagnostics.

References: [NASA gravity and mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-1/)
and [LAMMPS velocity-Verlet description](https://docs.lammps.org/fix_nve.html).
