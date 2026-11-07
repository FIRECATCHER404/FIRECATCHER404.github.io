# Personal website

Static site published through GitHub Pages. The Firebase-backed messenger lives at `message.html`.

## Interactive backgrounds

The homepage uses the local Box2D-based Planck.js engine. Clicking outside links creates a grey shape with a 45% circle, 45% square, and 10% triangle distribution; holding grows it, and dragging sets its launch velocity. Buttons, visible text glyphs, and the footer divider are separate static collision bodies. The floor follows the viewport bottom while scrolling. The same constraint solver handles collision normals, friction, rebound, and rotation, with continuous collision detection for fast small shapes and solver torque constraints for rolling resistance. Physics steps at 120 Hz. Circle collision geometry is analytic, and collision skins sit outside the painted outlines. Spawn previews and resized objects must fit in free space. The bio runs a shared Langton's ant grid, adding an invisible ant on each non-interactive click and drawing only changed cells. Both backgrounds use `#474747` and pause in hidden tabs.

The scripts and isolated styles live in `assets/backgrounds/`; the MIT-licensed Planck.js 1.5.1 build is vendored in `assets/vendor/planck/`. `window.pageBackground.snapshot()` exposes read-only diagnostics; velocities are in pixels per second. Run `node scripts/test-page-backgrounds.mjs` for ant rules and resize checks. `node scripts/test-physics-contacts.mjs` checks 162 analytic diagonal impacts, mirrored slope/friction directions, momentum and energy in glancing impacts, repeated rebounds, fast one-pixel-separator impacts, rolling/sliding resistance, floor bounds, and a dense pile.

## Useful files

`useful-files/` contains downloadable collections with browser previews. Its first collection includes all note-block source audio from Minecraft Java 26.3: 20 instruments, 19 mob-head clips, and 2 alternate samples. Original OGG files are verified against the installed asset index; PCM16 WAV copies are decoded with VGMstream. Both formats have individual downloads and complete ZIPs.

To rebuild the audio collection from an installed copy of Minecraft, run `python scripts/build-note-block-files.py --version 26.3 --vgmstream "C:\path\to\vgmstream-cli.exe"`. Pass `--minecraft-dir` for a nonstandard game directory. The catalog and ZIPs include the source asset paths, event pitches, and checksums.

## Fractal Explorer

Open [Fractal Explorer](https://firecatcher404.github.io/projects/fractal/) to explore Mandelbrot, Julia, Burning Ship, and two 2D/3D pairs: Sierpinski carpet / Menger sponge and Sierpinski triangle / Sierpinski tetrahedron. Detail adapts to the view at a consistent pixel resolution. It includes orbit/pan/zoom, local saved locations, palettes, and PNG export. Custom scripts support cumulative single or batch runs; `clone` followed by `turn right` generates the endpoint-joined dragon curve.

The app lives in `projects/fractal/`; its [language reference](projects/fractal/README.md) describes the scripting rules and rendering limits. Run `node scripts/test-fractal-explorer.mjs` for the math, parser, saved-state, and camera checks. Future selected ideas are recorded in [PROJECT_IDEAS.md](PROJECT_IDEAS.md).

## Orbital Sandbox

Open [Orbital Sandbox](https://firecatcher404.github.io/projects/orbit/) to build 3D solar systems with mutual gravity between every pair of bodies. Rotate the perspective view, place bodies at different heights, add tilted orbits, edit XYZ positions/velocities, and follow trails through space. It includes solar-system, planet-and-moon, binary-star, and empty presets, pause/step/speed controls, undo, and local `.orbit` save files; old 2D files upgrade automatically.

The app lives in `projects/orbit/`. See its [controls and physics notes](projects/orbit/README.md), and run `node scripts/test-orbital-sandbox.mjs` for orbit stability, force, collision, persistence, and camera checks.

## Sprite Rig

Open [Sprite Rig](https://firecatcher404.github.io/projects/sprite-rig/) to attach bones to a sprite, pose a hierarchy with IK, paint skin weights, and animate with keyframes. It includes a sample character, undo/redo, browser draft recovery, portable `.spriterig` projects, transparent frame PNGs, animated PNGs, and sprite-sheet ZIPs with frame data.

The buildless app lives in `projects/sprite-rig/`. See its [controls, format, and limits](projects/sprite-rig/README.md). Run `node scripts/test-sprite-rig.mjs` for transforms, skinning, IK, timeline, validation, and independent PNG/ZIP decoding checks (Python with Pillow is needed for the last group).

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
