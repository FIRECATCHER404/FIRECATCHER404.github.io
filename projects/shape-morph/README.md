# Shape Morph

Import SVG A and SVG B (or drop a file onto either canvas). Matching and playback start automatically. The interface uses plain white controls on black; white artboards keep dark SVG artwork visible.

Change the duration, easing, and playback direction, or scrub the timeline. Export an animated SVG, a color GIF, or a PNG of the current frame. Save/Open uses `.morph` projects; the most recent project is also stored in this browser. Space plays/pauses when focus is outside a control. Playback pauses when the window loses focus.

Supported SVG input: paths (including curves and arcs), rectangles, circles, ellipses, polygons, polylines, lines, transformed groups, solid fills/strokes, opacity, and compound outlines/holes. Each outline is sampled to 128 points. Images retain their aspect ratio inside a square. Matching uses location and outline size; extra shapes shrink/fade in or out. Different drawings can produce intersections, and changing layer order, fill rules, or open/closed topology is approximate. This is geometric interpolation, not semantic image matching.

Convert text, gradients, patterns, CSS stylesheets, clipped/masked artwork, filters, images, and referenced symbols to plain solid-color paths before importing. Unsupported files report an error and leave the current project intact. Source scripts, event handlers, and external resource links are never mounted. Group opacity is flattened onto individual shapes, which can differ for overlapping objects.

Limits: 1 MB per SVG, 64 painted shapes and 128 outlines per image. GIF export is capped at 240 frames / 32 million total pixels, uses a 256-color palette, and has a white background. Animated SVG has no frame-count limit. Imported SVGs and project data stay on the device.

Run `node scripts/test-shape-morph.mjs` from the repository root (Python with Pillow is needed for independent GIF decoding). To package an offline editor: `python scripts/package-shape-morph.py --output C:/path/Shape-Morph.html`.
