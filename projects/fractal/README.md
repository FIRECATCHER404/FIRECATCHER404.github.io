# Fractal Explorer

A buildless browser app. Serve the repository over HTTP and open `/projects/fractal/`.

Drag to pan, scroll at the cursor or pinch to zoom, and double-click to zoom in.
The canvas also accepts arrow keys, `+`, `-`, and `Home` (fit).
On narrow screens, **Controls** opens the settings drawer; Escape or a tap on
the exposed canvas closes it. **Save PNG** exports the rendered canvas.

## Fractals and saved locations

- Mandelbrot iterates `z = z² + c`, starting at zero.
- Julia uses the same recurrence, starting at the pixel coordinate with a
  constant chosen in the two Julia fields.
- Burning Ship takes the absolute value of both components of `z` before
  squaring. All three use escape radius 2 and smooth escape coloring.
- Custom curves apply a script once per generation, beginning with a seed path.

Names, camera position and zoom, palette, iterations, Julia constant, generation
count, line width, and script are included in each saved location. Up to 50
locations and the current draft are stored in this browser's localStorage.
They do not sync between devices and clearing site data removes them. An
unrun editor draft is retained separately from the last successfully parsed
script. Saved locations and PNG export are disabled while edits are pending.

## Curve language

The script describes **one generation**, repeated by the Generations slider.
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

Escape-time fractals use WebGL when high-precision fragment floats are
available. At vertical spans below `0.002`, or when WebGL is unavailable,
a cancellable worker renders with JavaScript double precision. CPU images
are capped at 800,000 pixels; WebGL uses at most 1.5 device pixels per CSS
pixel. Zoom has a coordinate-dependent precision floor, at least `1e-12`.
This is a finite-precision explorer, not an arbitrary-precision deep zoomer.
Increasing the iteration slider may reveal additional escape detail.

Curve models retain a hierarchy rather than materializing every generation.
Off-screen branches are culled; branches smaller than the detail tolerance
are approximated by their endpoints. The tolerance starts at 1.2 CSS pixels
and may increase to 2.4 or 4.8 for dense views. Zooming refines the visible
hierarchy. Logical segment counts describe the full mathematical generation,
not the number of drawn segments.

There are at most 32 generations, 128 commands, and 16,000 script characters.
Views are limited to 300,000 drawn segments and 2,000,000 visited hierarchy
nodes per attempt. Excess detail produces an explicit message; partial
geometry is not presented as a completed frame. Lower generations or zoom
in to recover. Very large coordinates are rejected. The previous completed
frame stays visible while a replacement renders or a script has an error.

## Validation

From the repository root, run `node scripts/test-fractal-explorer.mjs`.
It checks independent expanded dragon geometry and endpoint joining,
Sierpinski bounds and counts, parser errors, clipping and complexity limits,
escape-time equations, zoom anchors, and saved-state validation.
`window.fractalExplorer.snapshot()` exposes read-only runtime diagnostics.

Browser checks cover desktop controls, all examples, depth-32 adaptive
rendering, invalid script recovery, saved-state reload, PNG download, CPU
fallback and cancellation, automatic precision switching, and emulated touch
pan/pinch at phone widths. They do not replace physical-device testing.

Mathematical references:
[Dragon curve](https://mathworld.wolfram.com/DragonCurve.html),
[Mandelbrot set](https://mathworld.wolfram.com/MandelbrotSet.html),
[Julia set](https://mathworld.wolfram.com/JuliaSet.html).
