# Cellular automata

Two independent full-screen apps share this buildless HTML/JS implementation:

- `../game-of-life/`: Conway's B3/S23 Life, with cell, glider, strobe/blinker, static cube/block, Gosper glider gun and erase tools.
- `../langtons-ant/`: Langton's ant, with multiple ants, starting directions, on/off painting and ant removal. Ants have no body or facing triangle; optional position outlines are in Settings.

Only the top-right hamburger is visible initially. Its sidebar opens Place (bottom toolbar), Simulation (run, step and steps/ms), or Settings (theme, map ZIP files, Fit and Clear). Right/middle drag pans; wheel zooms around the pointer. Two fingers pan/pinch. Space runs/pauses when the map is focused, R rotates Life stamps, and Escape dismisses controls.

Light uses exactly `#111111` for on and `#ffffff` for off. Dark uses `#ffffff` for on and `#2a2a2a` for off. Ant rules follow on/off state, independently of the theme. Multiple ants read the same previous state simultaneously and apply flip parity when sharing a cell.

## Engine

`core.js` independently implements a canonical shared quadtree and memoized HashLife evolution for Life. Identical regions share nodes and cached futures. Reference descriptions: [Golly's HashLife documentation](https://golly.sourceforge.io/Help/Algorithms/HashLife.html) and [Tony Finch's algorithm explanation](https://dotat.at/@/2008-02-12-hashlife.html). Ant evolution is sequential; it shares the quadtree storage and renderer, but is not accelerated by Life's cached futures.

A dedicated worker evolves and renders the map in short work slices. The renderer culls offscreen nodes, draws uniform blocks directly, and combines subpixel occupied regions into screen pixels. It never enumerates every live cell at deep zoom. Coordinates and generation counts are BigInts; the camera stores fixed-point BigInt coordinates and a logarithmic zoom. There is no fixed map boundary, wraparound, or lower zoom clamp. Zoom-in is limited to 2^32 CSS pixels per cell. Browser memory and BigInt allocation are still finite.

Requested steps/ms is a target, not a guarantee. Repeating patterns can jump enormous distances in time; chaotic Life patterns and large ant populations are slower. Working nodes have a memory guard and cache collection. The UI reports a worker error and pauses rather than silently dropping cells. This is a browser simulation, not Golly file-format compatibility.

## Files and drafts

Settings downloads an actual ZIP containing `map.json` plus a short README. It preserves the reachable shared quadtree, exact coordinates, generation, ants/directions, camera, theme, speed and marker preference. Open the ZIP on the same simulator page. Files are validated before replacing the current map and always open paused.

ZIP input is limited to 32 MB, with an 8 MB uncompressed `map.json`, 350,000 serialized nodes, 5,000 ants, and bounded integer-string lengths/depths. These are import resource guards, not map-edge or zoom-out limits. The existing local fflate build in `../skin-studio/vendor/` handles ZIPs; no CDN is required. Local drafts are saved after edits/settings and periodically while running, up to 4 million JSON characters. Storage can be unavailable or full; use ZIP files for deliberate saves.

## Verification

Run the engine/serialization/viewport suite:

```powershell
node scripts/test-automata.mjs
```

Serve the repository root, then pass `scripts/test-automata-browser.js` as the Playwright browser tool's `filename`:

```powershell
python -m http.server 8975 --bind 127.0.0.1
```

With Playwright installed in the test environment, the optional CLI runner is `node scripts/run-automata-browser.mjs http://127.0.0.1:8975/projects/`.

The browser file is an async `(page, options)` function. It accepts `baseURL` (ending in `/projects/`) and optional `groups` substring filters; without filters it runs the whole suite. It returns all group results and captured page errors. Use the deployed base URL to repeat the same checks after Pages completes.

Coverage includes independent Life/ant rule comparisons; trillion-generation glider evolution; huge positive/negative coordinates; shared DAG serialization and validation; real ZIP download/native file picking/draft reload; exact rendered theme pixels; menu transitions; every placement tool; running, one-step, speed validation and keyboard focus guards; right pan and pointer-anchored zoom; deep zoom and inverse return; native touch placement/pan/pinch; 320, 390 and 768 px layouts; and both project cards/search. Browser automation does not establish physical-device or all-browser correctness.

Initial local verification passed all 17 engine groups and 29 browser groups with no captured page errors. Desktop screenshots and the settled mobile toolbar/settings were inspected. Touch checks use Chromium device emulation and native touch events; physical devices, Safari and Firefox were not tested.
