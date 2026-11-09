# Music Canvas

A buildless, browser-only generative music canvas. Moving circles, squares, triangles, and hexagons carry notes. When two shapes enter an overlap, both play; they pass through each other rather than colliding. The stage edges reflect movement. Each pair is latched until separation, so an ongoing overlap does not repeatedly trigger notes.

Open `index.html` through a static HTTP server. Uses Canvas 2D and Web Audio with locally synthesized voices; there are no runtime libraries or sample downloads. The existing site font is Atkinson Hyperlegible Next.

## Use

Choose a shape button, then click/tap empty space to place it. Select and drag shapes to arrange them. The inspector edits note, voice, speed, direction, size, rotation, color, note level, and whether the shape moves. Stopping a shape keeps its stored velocity; another moving shape can still trigger its note. A muted shape (note level zero) does not emit notes.

**Select a shape and hold Ctrl to show its numeric ID.** IDs are otherwise hidden. On touch screens, hold the **ID** button beside **Edit shape**. Release it to hide the ID. IDs are integers from 1 to 99; the canvas supports 48 shapes, preserves IDs in saved files, and reuses free IDs after deletion.

**Play** starts audio and movement; **Pause** freezes the transport, retains pending script waits, and silences live/scheduled voices. **Rewind** returns shapes to their saved starting positions/velocities and clears the script schedule/beat clock. Placement, dragging, and manual motion edits update a shape's rewind anchor. Undo/redo pauses playback and restores an edit snapshot; it does not record each animation step. Forty edit snapshots are kept in memory.

Intersections use convex SAT geometry, including the extra nearest-vertex axis for circles against polygons. Motion runs in 1/120-second steps and splits those steps at script command times. Velocity is bounded at 300 stage units per second. The 1000×700 stage keeps its proportions as the window changes size. Playback catches up short frame delays; a delay over 250 ms pauses playback with a message instead of silently changing the musical tempo. Focus/visibility loss also pauses playback.

## Tiny movement language

```text
select 1, 2
move yes

select 3
move no
```

**Run script** (or Ctrl/Cmd+Enter) checks the entire script, then applies its beat-zero commands and starts playback. Unknown IDs or malformed commands report a line number and leave movement unchanged. Every Run replaces the previous schedule and starts its waits relative to the current beat; it does not stack another copy or reset the scene.

| Command | Meaning |
| --- | --- |
| `select 1, 2` | Replace the script selection with these IDs. Whitespace-separated IDs also work. |
| `select all` | Select every shape that exists when Run is pressed. |
| `move yes` / `move no` | Enable/disable movement of the script selection. |
| `move` / `stop` | Short aliases for yes/no. `on/off` and `true/false` also work with `move`. |
| `wait 2` | Wait two transport beats; decimal beats and `wait 2 beats` are accepted. |
| `# comment` | Ignore the rest of the line. |

For example, stop everything, then let just one shape go:

```text
select all
move no
wait 2
select 1
move yes
```

The script selection is independent of the selected shape in the inspector. Scripts only control movement; they cannot run JavaScript or access the page. Limits: 12,000 characters, 256 lines, individual waits of 0–64 beats, and at most 256 total waiting beats. Editing script text cancels its pending schedule. **Cancel** cancels future commands while keeping movement settings already applied. Deleting a shape removes that identity from pending commands, so a newly reused ID is not affected until another Run.

## Sound and files

Four pitched voices (bell, pluck, soft sine, and wood) use oscillator envelopes, filtering, stereo positioning, and a master compressor. Live audio is capped at 32 voices. The optional snap control schedules notes on the next quarter-beat boundary (16th notes when each beat is a quarter note). Tempo changes preserve script waits in beats and re-anchor the audio grid. Wall-hit notes are optional.

**Export audio** renders 8, 16, or 32 beats from the current arrangement to stereo 44.1 kHz, 16-bit PCM WAV, with a 1.5-second tail. The script can be included or skipped. Export simulates a clone and does not move the editor's shapes. A render above 8,000 note events is rejected with a message; shorten the export or use fewer shapes. Exported sound was checked by decoding PCM and measuring note-frequency bands; it has not been evaluated by ear.

**Scene → Save canvas/Open canvas** uses portable `.musiccanvas` JSON files. Imports validate geometry, IDs, musical parameters, and limits before changing the scene. Drafts use IndexedDB and a synchronous local recovery copy, scoped to this app. Normal playback checkpoints periodically; edits and pause are saved, with a final save on page exit. Drafts are restored paused. No canvas or audio is uploaded. The site's existing analytics still applies.

| Shortcut | Action |
| --- | --- |
| Ctrl held on selected shape | Reveal its ID |
| Space | Play/pause (outside controls) |
| Ctrl/Cmd+Enter | Run script |
| Ctrl/Cmd+S | Save canvas |
| Ctrl/Cmd+Z / Shift+Z | Undo / redo |
| V | Selection tool |
| Delete | Delete selected shape |
| Escape | Cancel dragging, deselect, close mobile controls |

## Checks

Run `node scripts/test-music-canvas.mjs` from the repository root. Twenty groups cover strict files/IDs, shape picking and SAT, wall reflection and bounds, overlap entry latches, fixed-step fast crossings, reused IDs, stored velocities, beat scheduling and tempo changes, fractional waits, atomic script rejection, tuning, and independent WAV byte decoding.

Browser QA covers Ctrl press/release IDs, native script editing and Run, preserved velocities and beat waits, pause/resume, live audio node activity, shape editing, copy/delete/undo, immediate reload recovery, portable files, malformed import preservation, and stereo WAV exports. Touch emulation at 390 and 320 CSS pixels covers held/released IDs, placement, note edits, script targets, pause, layout, and drafts. The harness keeps background documents reported as focused/visible, so actual OS focus-loss behavior was not natively verified. Physical phones and non-Chromium browsers are also untested.
