# Personal website

Static site published through GitHub Pages. The Firebase-backed messenger lives at `message.html`.

Publishing uses [.github/workflows/pages.yml](.github/workflows/pages.yml): the existing Jekyll build, followed by a Pages deployment with a 30-minute timeout for slow file syncing. Push to `main` or run **Publish website** from GitHub Actions to publish or retry without an empty commit. Deployments run one at a time and finish before newer queued versions publish.

## Interactive backgrounds

The homepage uses the local Box2D-based Planck.js engine. Clicking outside links creates a grey shape with a 45% circle, 45% square, and 10% triangle distribution; holding grows it, and dragging sets its launch velocity. Buttons, visible text glyphs, and the footer divider are separate static collision bodies. The floor follows the viewport bottom while scrolling. The same constraint solver handles collision normals, friction, rebound, and rotation, with continuous collision detection for fast small shapes and solver torque constraints for rolling resistance. Physics steps at 120 Hz. Circle collision geometry is analytic, and collision skins sit outside the painted outlines. Spawn previews and resized objects must fit in free space. The bio runs a shared Langton's ant grid, adding an invisible ant on each non-interactive click and drawing only changed cells. Both backgrounds use `#474747` and pause in hidden tabs.

The scripts and isolated styles live in `assets/backgrounds/`; the MIT-licensed Planck.js 1.5.1 build is vendored in `assets/vendor/planck/`. `window.pageBackground.snapshot()` exposes read-only diagnostics; velocities are in pixels per second. Run `node scripts/test-page-backgrounds.mjs` for ant rules and resize checks. `node scripts/test-physics-contacts.mjs` checks 162 analytic diagonal impacts, mirrored slope/friction directions, momentum and energy in glancing impacts, repeated rebounds, fast one-pixel-separator impacts, rolling/sliding resistance, floor bounds, and a dense pile.

## Useful files

`useful-files/` contains downloadable collections with browser previews. Its first collection includes all note-block source audio from Minecraft Java 26.3: 20 instruments, 19 mob-head clips, and 2 alternate samples. Original OGG files are verified against the installed asset index; PCM16 WAV copies are decoded with VGMstream. Both formats have individual downloads and complete ZIPs.

To rebuild the audio collection from an installed copy of Minecraft, run `python scripts/build-note-block-files.py --version 26.3 --vgmstream "C:\path\to\vgmstream-cli.exe"`. Pass `--minecraft-dir` for a nonstandard game directory. The catalog and ZIPs include the source asset paths, event pitches, and checksums.

## Fractal Explorer

Open [Fractal Explorer](https://firecatcher404.github.io/projects/fractal/) to explore Mandelbrot, Julia, Burning Ship, and two 2D/3D pairs: Sierpinski carpet / Menger sponge and Sierpinski triangle / Sierpinski tetrahedron. Detail adapts to the view at a consistent pixel resolution. It includes orbit/pan/zoom, local saved locations, palettes, and PNG export. Custom scripts support cumulative single or batch runs; `clone` followed by `turn right` generates the endpoint-joined dragon curve.

The app lives in `projects/fractal/`; its [language reference](projects/fractal/README.md) describes the scripting rules and rendering limits. Run `node scripts/test-fractal-explorer.mjs` for the math, parser, saved-state, and camera checks. Future selected ideas are recorded in [PROJECT_IDEAS.md](PROJECT_IDEAS.md).

## SVG Paint and Shape Morph

[SVG Paint](https://firecatcher404.github.io/projects/svg-paint/) is a vector drawing editor with a Paint-style ribbon, 21 shapes, light/dark themes, drag-box/Shift-click multi-selection, batch styling and transforms, vector merge/combine, point editing, corner rounding, alignment/distribution, layers, and SVG export. [Shape Morph](https://firecatcher404.github.io/projects/shape-morph/) takes two SVG files and automatically animates their geometry and colors in a plain white-on-black interface. It exports animated SVG, color GIF, and PNG frames. Both keep drafts locally and support portable project files.

See [SVG Paint controls and limits](projects/svg-paint/README.md) and [Shape Morph import/export notes](projects/shape-morph/README.md). Run `node scripts/test-svg-paint.mjs` and `node scripts/test-shape-morph.mjs` (the latter independently decodes GIFs with Python/Pillow). `scripts/package-shape-morph.py --app svg-paint --output path.html` packages an offline editor; omit `--app` for Shape Morph.

## Pixel Level Maker

Open [Pixel Level Maker](https://firecatcher404.github.io/projects/pixel-level-maker/) to draw multi-room levels with separate artwork and physical layers. Every visible pixel is yours: paint the player region's artwork, configure invisible triggers, connect rooms, and play or export a single offline HTML file. New levels are empty and there are no supplied graphics.

The buildless app lives in `projects/pixel-level-maker/`. See its [controls and limits](projects/pixel-level-maker/README.md); run `node scripts/test-pixel-level-maker.mjs` for layer, drawing, collision, trigger, file, and export checks.

## Elsewhere

Open [Elsewhere](https://firecatcher404.github.io/projects/elsewhere/) to build and explore impossible spaces. Fit live portal surfaces to walls, drag a tarp's four corners, link rooms back into themselves, and walk into a bigger inside. Includes four starting buildings, room customization, seven scenery pieces, a connection diagram, scale-changing doorways, touch controls, portable buildings, and PNG exports.

The buildless WebGL app lives in `projects/elsewhere/`. See its [controls and practical limits](projects/elsewhere/README.md); run `node scripts/test-elsewhere.mjs` for geometry, travel, topology, and file checks.

## Music Canvas

Open [Music Canvas](https://firecatcher404.github.io/projects/music-canvas/) to arrange moving shapes that play notes when they intersect. Give each shape a pitch and voice, reveal its short ID by selecting it and holding Ctrl, and use a tiny `select` / `move yes` / `move no` script with optional beat waits. Includes live synthesis, quantized notes, local drafts, portable canvas files, and stereo WAV export.

The buildless app lives in `projects/music-canvas/`. See its [language and controls](projects/music-canvas/README.md); run `node scripts/test-music-canvas.mjs` for geometry, timing, script, ID, persistence, and WAV checks.

## Isometric Map Maker

Open [Isometric Map Maker](https://firecatcher404.github.io/projects/isometric/) to build small illustrated worlds in a warm, minimal studio. Generate seeded landscapes in four biomes, customize 22 ground materials, and place 75 buildings and decorations. Includes group editing and copy/paste, searchable objects with names/hide/lock, palette favorites, line/rectangle brushes, resizable long pieces, a live sun wheel, PNG exports, undo/redo, local drafts, portable `.isomap` files, and touch controls.

The buildless app lives in `projects/isometric/`. See its [controls and file notes](projects/isometric/README.md); run `node scripts/test-isometric-map.mjs` for geometry, placement, validation, and camera checks.

## Orbital Sandbox

Open [Orbital Sandbox](https://firecatcher404.github.io/projects/orbit/) to build 3D solar systems with mutual gravity between every pair of bodies. Rotate the perspective view, place bodies at different heights, add tilted orbits, edit XYZ positions/velocities, and follow trails through space. It includes solar-system, planet-and-moon, binary-star, and empty presets, pause/step/speed controls, undo, and local `.orbit` save files; old 2D files upgrade automatically.

The app lives in `projects/orbit/`. See its [controls and physics notes](projects/orbit/README.md), and run `node scripts/test-orbital-sandbox.mjs` for orbit stability, force, collision, persistence, and camera checks.

## Void Lab

Open [Void Lab](https://firecatcher404.github.io/projects/void-lab/) to place material shapes in unbounded 3D space with independent mass, size, velocity, and spin. It has inverse-square mutual gravity, round-sphere and convex collisions, contact-local chipping and irregular fracture, grab/throw, camera follow, undo/redo, device drafts, and portable `.void` files. Mass and size derive compact objects and their horizons automatically; mass also drives background light bending, with no lensing amount or black-hole switch.

The app lives in `projects/void-lab/`. Its [controls and physics model](projects/void-lab/README.md) explain the Newtonian motion, Schwarzschild background-light approximation, illustrative material strengths, and finite browser limits. Run `node scripts/test-void-lab.mjs` for the native Rapier, conservation, contact-fracture, timestep, geodesic, and persistence checks.

## Sprite Rig

Open [Sprite Rig](https://firecatcher404.github.io/projects/sprite-rig/) to turn 3D bone motion into 2D deformation on a fixed flat sprite plane. Move and rotate bones in XYZ, pose with 3D IK, orbit the camera, choose smooth mesh or per-pixel binding for pixel art, paint weights, and animate with quaternion keyframes. It includes a sample character, undo/redo, browser draft recovery, portable `.spriterig` projects with automatic 2D upgrades, and transparent PNG, animated PNG, and sprite-sheet exports from the fixed front view.

The buildless app lives in `projects/sprite-rig/`. See its [controls, format, and limits](projects/sprite-rig/README.md). Run `node scripts/test-sprite-rig.mjs` for 3D transforms, fixed-plane projection, camera math, IK, timeline, migration/validation, and independent PNG/ZIP decoding checks (Python with Pillow is needed for the last group).

## Expressionful Skin Studio

Open [Skin Studio](https://firecatcher404.github.io/projects/skin-studio/) to create animated Minecraft skin packs. It runs entirely in your browser with a dark interface, 3D player preview, frame uploads, rule builder, ZIP import/export, and a draft stored on your device. No server setup or account is required.

Its static files live in `projects/skin-studio/`, including vendored MIT-licensed fflate and skinview3d libraries and the Expressionful 1.2.0 mod download. No uploaded skins or drafts are sent to a backend. Export a ZIP to back up your work or move it between browsers.

## EasySA

Open [EasySA](https://firecatcher404.github.io/projects/easysa/) to draw notes, layer synths, piano, drums, and imported samples inside one pattern, arrange a song, mix effects, and export WAV, MP3, or OGG. It runs in the browser, saves projects on the device, and supports portable `.easysa` files.

The production build lives in `projects/easysa/`, with bundled audio encoders and an offline cache scoped to that app. The original Music Maker remains at `projects/music/`.

## Tic-tac-toe

The game at `projects/ticktacktoe.html` supports computer opponents and online matchmaking. Computer play works without Firebase. Online browser checks can use `?emulator=1` on localhost with the existing Database emulator; this switch is ignored on hosted domains.

Run `node scripts/test-ticktacktoe.mjs` to check winning lines, draws, and every human move sequence against the computer.

## Messenger backend deployment

The messenger uses Firebase Authentication and Realtime Database for groups, friends, direct messages, read markers, and authenticated on-demand file attachments. The attachment limit is intentionally 1 MB per file (up to three files per message) so the feature works on Firebase's no-cost plan without a Cloud Storage bucket. Oversized JPEG, PNG, and WebP photos up to 12 MB are compressed locally before upload; original files never leave the browser when compression fails.

Private invitation links expire after 1, 7, or 30 days and can be limited to 1, 5, 10, or 25 uses. Use the migration once before deploying the stricter rules to preserve legacy private-group invites:

```powershell
node scripts/migrate-message-invites.mjs
node scripts/migrate-message-invites.mjs --apply
```

Then deploy the database rules:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only database --project website-11b5c
```

Attachment contents live outside message records under `secureChat/attachmentData`, so ordinary message listeners do not download files. Files are fetched only when opened (except visible image previews), and message creation plus attachment storage is one atomic database update.

Rules can be compiled and exercised locally without changing production:

```powershell
npx firebase-tools deploy --only database --dry-run
npx firebase-tools emulators:exec --only auth,database "node scripts/test-message-rules.mjs"
```

The emulator suite verifies friend-request privacy, reciprocal acceptance, friend-only DM creation, two-person DM boundaries, private-message access, invite expiration, and hard invite-use limits.

## App Check setup

The App Check integration is included but intentionally remains off until a site key is configured. Create a free reCAPTCHA v3 site key for `firecatcher404.github.io`, paste it into `appCheckConfig.siteKey` in `message-firebase-config.js`, and push the change. In Firebase Console, register the web app with App Check and monitor valid requests before turning on Realtime Database enforcement. Enabling enforcement before the deployed page is producing valid tokens will block the messenger.

The app also enforces a four-second server-validated cooldown for friend requests and user invitations. App Check adds bot and scripted-client protection once its site key and Firebase enforcement are enabled.
