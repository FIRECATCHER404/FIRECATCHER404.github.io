# SVG Paint

A buildless vector editor with a Paint-style file bar and ribbon, a canvas, a shape inspector, layers, and flat light/dark themes. New drawings contain no supplied graphics. Artwork, drafts, and project files stay on the device.

- The shape gallery has 21 shapes: rectangle, ellipse, triangle, right triangle, diamond, parallelogram, trapezoid, pentagon, hexagon, octagon, regular polygon, star, burst, arrow, double arrow, chevron, heart, cross, ring, arc, and line. Drag to place one. Hold Shift to constrain proportions or line angles.
- Regular polygons, stars, bursts, and rings show **New shape options** before drawing: side/point count and inner size. These settings apply to the next shape; existing outlines remain editable with Points and the shape inspector. Ring holes remain separate closed contours in exported SVGs.
- Polygon: click its corners, then press Enter, double-click, or choose Finish polygon. Escape cancels the unfinished outline.
- Pencil: draw a freehand line. Redundant points are simplified on release.
- Select: move shapes and drag their corner handles to resize. Shift constrains movement or preserves proportions during resize. The inspector also sets exact position, size, rotation, opacity, and corner-rounding distance.
- Points: drag individual points or set their X/Y values. Double-click an edge to insert a point; Delete removes the selected point. Corner rounding cuts back along adjacent edges and adds a quadratic curve, limited to half the length of either edge.
- Simplify threshold removes points within the chosen distance while retaining endpoints. Minimum outlines retain two points (open) or three (closed).
- The ribbon has separate **Fill** and **Outline** groups. Toggle either paint, use a color picker or 3/6-digit hex value, and set their opacities independently. The palette can target fill or outline, and Swap colors exchanges the two colors. Outline width has a precise 0–512 px field and a live slider; dragging the slider is one undo step, and Escape cancels the drag. Outline ends can be round, flat, or square; corners can be round, sharp, or beveled.
- With a shape selected, appearance controls edit that shape. Choosing a drawing tool switches them to **New shapes**, using the previous selection's appearance without changing it. Align the selected shape's edges or center to the canvas, flip it, duplicate/delete, reorder layers, or hide it. Canvas dimensions and an optional exported background are editable.

Export SVG creates plain vector paths that can be imported into Shape Morph. Save/Open project preserves editable point geometry in `.svgpaint` files. A local draft restores after reload; theme choice is saved separately. Import SVG replaces the current drawing (Undo restores it) and samples curves into editable points. It supports the same plain geometry as [Shape Morph](../shape-morph/README.md); complex effects and text must be converted to solid-color outlines first. Transparency exports even though the working paper is displayed white.

Keyboard: Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y), Ctrl+D to duplicate, Ctrl+S to save a project, Delete to remove, arrows to nudge (Shift for 10 px), Escape to cancel. Ctrl+wheel zooms; Fit restores a useful canvas view. Mouse and touch gestures are supported; point insertion by double-click is easiest with a mouse.

Limits: 1–4096 px artboards, 64 shapes, 32,768 total points, 4,096 points per outline, 60 undo snapshots with a 4 MB history budget. Add a canvas background only when the combined exported shape count will stay within Shape Morph's 64-shape limit. Imports sample each outline to 128 points and flatten group opacity; imported curves are approximations, not editable Bezier handles. There are no text, image, gradient, Boolean-path, or multi-selection tools yet.

Run `node scripts/test-svg-paint.mjs`. To package a standalone editor: `python scripts/package-shape-morph.py --app svg-paint --output C:/path/SVG-Paint.html`. Keep it beside `Shape-Morph.html` for their cross-links to work offline.
