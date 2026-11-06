# Fractal Explorer

A buildless browser app. Serve the repository over HTTP and open `/projects/fractal/`.

Drag to pan, scroll at the cursor or pinch to zoom, and double-click to zoom in.
The canvas also accepts arrow keys, `+`, `-`, and `Home` (fit).
For 3D fractals, drag or use arrow keys to rotate; Shift-drag, right-drag,
Shift-arrow keys, or two-finger movement pans. Pinching also zooms. Fit/Home
restores the initial orientation and framing.
On narrow screens, **Controls** opens the settings drawer; Escape or a tap on
the exposed canvas closes it. **Save PNG** exports the rendered canvas.

## Fractals and saved locations

- Mandelbrot iterates `z = z² + c`, starting at zero.
- Julia uses the same recurrence, starting at the pixel coordinate with a
  constant chosen in the two Julia fields.
- Burning Ship takes the absolute value of both components of `z` before
  squaring. All three use escape radius 2 and smooth escape coloring.
- Menger sponge is a 3D cube subdivided into 20 retained corner/edge cubes
  at each level. A ray-marched distance bound reveals the visible holes.
- Sierpinski tetrahedron uses four half-sized copies at its corners.
- Sierpinski triangle is a separate automatic 2D preset with three corner copies.
- Custom curves apply a script once per generation, beginning with a seed path.

Names, camera position and zoom, palette, iterations, Julia constant, generation
count, line width, script, batch count, and 3D orientation are included in each saved location. Up to 50
locations and the current draft are stored in this browser's localStorage.
They do not sync between devices and clearing site data removes them. An
unrun editor draft is retained separately from the last successfully parsed
script. Saved locations and PNG export are disabled while edits are pending.
Existing saved views from the first version retain their camera and script
runs; missing batch/orbit fields receive defaults.

## Curve language

The script describes **one run**. **Run once** applies another run to the
current curve each time it is clicked. **Runs per click** applies that many
additional runs in one batch, with the same result as individual clicks.
Ctrl+Enter also runs. Reset returns to the seed at zero runs, and choosing
an example loads its seed. Editing the source starts a new curve on the next
Run; a failed parse leaves the previous curve and run count intact.

Runs change the algorithm's result, rather than its rendering quality.
The renderer automatically refines the visible part of that result as you zoom.
Each `clone` reads the entire previous generation, not the output of the
current generation. The old drawing is retained unless `clear` removes it.
Transforms apply in written order to the most recent clone. They never run
arbitrary JavaScript. Blank lines, `# comments`, and `// comments` are allowed;
command names are case insensitive.

```text
clone
turn right
```

This copies the previous path, rotates the copy clockwise 90 degrees around
the previous path's endpoint, and reads the copy in reverse so its start
joins that endpoint. Repeating this creates the dragon curve. Each generation
has twice as many logical segments. `turn left` reflects the construction.

| Command | Meaning |
| --- | --- |
| `clone` | Select a new copy of the previous generation. |
| `turn right [degrees]` | Rotate clockwise around the pivot; defaults to 90. |
| `turn left [degrees]` | Rotate counterclockwise; defaults to 90. |
| `scale 0.5` | Uniformly resize around the pivot. Factor must be greater than 0 and at most 4. |
| `move 1 0` | Translate in original seed units; positive X is right and positive Y is up. |
| `flip x` | Reverse X relative to the pivot (horizontal reflection). |
| `flip y` | Reverse Y relative to the pivot (vertical reflection). |
| `pivot start` / `end` / `center` / `origin` | Finish the current clone and choose the pivot for following clones. Default is the previous path's endpoint. Center is the center of its conservative bounds. Origin is always `(0, 0)`. |
| `clear` | Remove this generation's output so far, keeping the previous generation available to clone. |
| `seed line` / `triangle` / `square` | Choose the starting path, as the first statement. Default is a unit line. Polygons are closed unit-width outlines. |

Endpoint joining is automatic for rotations, scales, and mirrors around the
default endpoint. Moving a copy or choosing a different pivot can separate
it from the original. Separate copies are drawn as separate paths, with no
extra connecting lines.

For example, this replaces each triangle with three half-sized copies:

```text
seed triangle
clear
pivot origin
clone
scale 0.5
clone
scale 0.5
move 0.5 0
clone
scale 0.5
move 0.25 0.4330127018922193
```

## Rendering and limits

There are no iteration, depth, distance, or quality controls. Preset detail
is selected from the current viewport and zoom. Escape iteration budgets
increase from roughly 512 up to 8192 as you zoom. Solid distance fields and
the 2D triangle add recursive levels until their detail is subpixel sized
(up to 48 levels in double precision). Only rays crossing the visible solid
bounds are marched; no full recursive mesh is generated.

All renderers target the same canvas dimensions at every zoom: viewport size
times device pixel ratio, capped at 2. The CPU fallback retains these dimensions.
Moving between GPU and CPU does not reduce resolution. Escape-time fractals
and solids use WebGL when high-precision fragment floats are available. At
vertical spans below `0.002`, or when WebGL is unavailable, a cancellable worker
uses JavaScript double precision. A completed replacement frame is shown
after rendering; interaction can cancel obsolete work.

Zoom has a coordinate-dependent precision floor, at least `1e-12`.
This is a finite-precision explorer, not an arbitrary-precision deep zoomer;
the numeric recursion and ray-step limits still apply. CPU solid rendering
can take longer on large or high-density screens.

Curve models retain a hierarchy rather than materializing every generation.
Off-screen branches are culled; branches smaller than the detail tolerance
are approximated by their endpoints at a fixed one backing-pixel tolerance.
The tolerance does not increase at deeper zooms or for dense views. Geometry
is streamed in small chunks into an off-screen canvas instead of building
one enormous drawing path. Exact overlapping child transforms are rendered
once while retaining the full logical segment count. Logical counts describe
the mathematical run result, not the number of drawn segments.

There are at most 128 script runs, 128 commands, and 16,000 script characters.
Numeric growth can reach the coordinate limit sooner, producing an explicit
error with the old curve retained. Curve work budgets scale with canvas area:
at least 300,000 segments / 2,000,000 nodes, or 8 segments / 24 visited nodes
per backing pixel. Pathological scripts that exceed these budgets report an
error; the renderer does not silently lower quality or present a partial
frame as complete. Simplify the script, zoom in, or reset to recover.

## Validation

From the repository root, run `node scripts/test-fractal-explorer.mjs`.
It checks independent expanded dragon geometry and endpoint joining,
Sierpinski bounds and counts, parser errors, clipping and complexity limits,
escape-time equations, zoom anchors, and saved-state validation.
`window.fractalExplorer.snapshot()` exposes read-only runtime diagnostics.

Browser checks cover cumulative and batch runs, edits/reset/error recovery,
saved-state reload including 3D orientation, 32-run adaptive curves, fixed
canvas dimensions across zoom/precision changes, all presets, PNG download,
CPU fallback and cancellation, GPU/CPU pixel comparisons, and emulated touch
orbit/pan/pinch at phone widths. They do not replace physical-device testing.

Mathematical references:
[Dragon curve](https://mathworld.wolfram.com/DragonCurve.html),
[Mandelbrot set](https://mathworld.wolfram.com/MandelbrotSet.html),
[Julia set](https://mathworld.wolfram.com/JuliaSet.html),
[Menger sponge](https://mathworld.wolfram.com/MengerSponge.html),
[Sierpinski tetrahedron](https://mathworld.wolfram.com/SierpinskiTetrahedron.html).
