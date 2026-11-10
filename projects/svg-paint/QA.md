# SVG Paint regression checks

Run the entire affected-app regression before finishing each update. Cover the visible/output behavior as well as document values. Every reported bug needs a regression. Fix failures and rerun the affected checks. Keep unrelated drafts and files intact.

## Geometry and compatibility

```
node scripts/test-svg-paint.mjs
node scripts/test-shape-morph.mjs
```

The rounding regressions check sampled imports, baked Boolean/combined corners, zero rounding, cache invalidation, all 21 shapes, extreme aspect ratios, file compatibility, and exported geometry.

## Real browser inputs

Serve the checkout locally (the suite defaults to port 8973):

```
python -m http.server 8973 --bind 127.0.0.1
```

Pass `scripts/test-svg-paint-browser.js` and `scripts/test-svg-paint-touch.js` to the Playwright browser tool's `filename` argument in separate calls. These self-contained async functions return every group result, including failures. They use mouse, keyboard, native form controls, file input, downloads, and native touch events; the app snapshot/coordinate API is read-only. The touch suite checks 320, 390, and 768 px widths. Alternatively, in a test environment with Playwright installed:

```
node scripts/run-svg-paint-browser.mjs http://127.0.0.1:8973/projects/svg-paint/
```

Feature inventory:

- All 21 shapes, shape parameters, constrained drawing, pencil, polygon completion/cancellation, simplification, point insertion/editing/removal, and open/closed guards.
- Rounding number/range controls, actual curved fill, dense SVG imports, merged/combined corners, zero, history and gesture cancellation.
- Fill/outline color pickers and hex fields, palette targets, swap, toggles, alpha, width slider, ends/joins, mixed multi-selection and batch changes.
- Marquee in both directions, additive boxes and clicks, Select all, hidden exclusions, movement, numeric transforms, shared resize/rotation handles, flips, nudging and Escape.
- Merge (real union, holes and disconnected pieces), Combine (including open outlines), topmost styling, alignment, distribution, layer ordering/visibility, rename, duplication/deletion and undo/redo.
- Save/Open project, SVG import/export, invalid inputs, safe import handling, local draft restoration, New/Undo, theme persistence, canvas dimensions/background, zoom/Fit/Ctrl-wheel and shortcuts.
- Touch drawing/selection/ranges/buttons, responsive layouts, standalone app with networking disabled, and SVG Paint output imported into Shape Morph.

Also inspect the rendered UI at desktop and narrow widths. Emulated touch is not physical-device proof. State untested browsers/devices or missing coverage explicitly.

## Packaging and publication

Rebuild the standalone HTML to a fresh output path:

```
python scripts/package-shape-morph.py --app svg-paint --output C:/path/SVG-Paint.html
```

Exercise it with networking disabled, including imported-path rounding and Boolean operations. Preserve an existing download before replacing it. After pushing a published update, wait for the Pages workflow, compare deployed app assets with the local version, and repeat the bug's actual UI reproduction on the live page. A successful build alone is insufficient.

The desktop suite also accepts `{baseURL: 'file:///C:/path/SVG-Paint.html', offline: true}` as its second argument to run the same checks on the packaged app without networking.
