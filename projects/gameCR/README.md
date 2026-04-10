# gameCR

`gameCR` is a local browser game about making a video game.

Open `index.html` in a browser. There is no install step.

## What It Has

- Edit mode and play mode.
- A canvas level editor with grid placement and dragging.
- Default thing types: player, platform, sprite, mob, trap, lava, power-up, door, portal, trigger, checkpoint, and goal.
- Sprite and animation importing from image files.
- Built-in pixel art editor for drawing sprites and multi-page animations directly inside the `Art` menu.
- Imported animation assets have editable playback speed in the asset panel.
- Imported pictures are pixel-limited and color-quantized so they stay 8-bit looking.
- Default sprites are drawn as blocky pixel sprites.
- Per-thing action animations for states like idle, walking, start jumping, currently jumping, landing, falling, attacking, hurt, active, inactive, open, and closed.
- Platforms use a 9-slice texture map: middle, four sides, and four corners repeat cleanly when reshaped.
- Platforms have a texture-sheet picker UI so you can assign different atlas cells to the middle, sides, and corners.
- Project-level global textures can be assigned by object type, so untextured things automatically use a shared default.
- The World panel now includes editable gameplay text and outcome settings for intro, HUD, win, loss, respawn, checkpoint, and other runtime messages.
- Sound importing from audio files.
- Keybind logic: bind a key to a function a selected thing can do.
- A canvas-first editor layout: the stage fills the screen, with compact square menu launchers across the top.
- The top menu logos are editable PNG files in `assets/menu-icons/`.
- Opening any editor menu blurs and locks the canvas until you close the menu with `X` or `Esc`, but the top menu buttons stay clickable so you can switch menus immediately.
- Built-in guided tutorial that opens on first launch and can be reopened from the Project menu.
- Mobile play controls: a touch movement wheel and an attack button appear only on touch/mobile screens in play mode.
- A scene outliner with search, quick select, hide/show, and lock/unlock controls.
- A stage toolbar with focus, fit-world, copy, paste, duplicate, visibility, lock, and draw-order actions.
- Trigger logic: make the environment run a function when the player touches a trigger zone.
- Default power-ups and custom power-up actions.
- Doors that can open and close, plus checkpoints that update respawn.
- Portals that can be always active or activated by trigger/keybind logic.
- Enemy patrol and chase behavior.
- Hazards, lava, health, score, projectiles, and a win goal.
- Browser save/load plus JSON export/import.
- Standalone HTML export for a play-only build with no editor UI.
- Undo and redo for editor changes.

## Controls

In edit mode:

- Use the square buttons at the top to open `Build`, `Actions`, `Project`, `Inspect`, `Logic`, `World`, `Scene`, `Sprites`, and `Sounds`.
- The menus are flat panels now. They do not have extra collapsible headers inside them.
- Close an open menu with the `X` button, `Esc`, or by clicking outside the menu. While a menu is open, the canvas is blurred and cannot be edited.
- Open `Build`, click a tool, close the menu, then click the world to place it.
- Select a thing, then open `Inspect` to edit its properties.
- Drag selected things around.
- Drag the edge or corner handles on a selected platform to reshape it directly.
- To texture a platform like a Minecraft-style button, select it and use `Platform texture map` to assign imported pixel sprites for the middle, sides, and corners.
- For sheet-based platform texturing, select a platform, choose a `Texture sheet`, set the sheet `columns` and `rows`, click the platform part you want to edit, then click a cell in the atlas preview.
- To set project-wide defaults, open the `World` menu and use `Global textures`. Pick an object type once, then assign its default sprite or platform atlas there.
- Per-object textures still override the project default. If you want one object to ignore the project default, select it and set `Texture fallback` to `Built-in only`.
- To change win/lose behavior and messages, open the `World` menu and edit `Game flow`. You can change intro text, HUD labels, win title/subtitle, lose title/subtitle, defeat mode, respawn penalty, and the common runtime messages.
- To make portals, place two `Portal` objects. If one portal is waiting unlinked, the next portal you place links to it automatically.
- A portal can be `Always active` or `Activatable by trigger or keybind`; activatable portals use `Activate portal`, `Deactivate portal`, or `Toggle portal` logic actions.
- Drag a blank part of the stage to pan the world.
- Right-drag to draw a selection box and select multiple things at once.
- Drag one of the selected things to move the whole selected group together.
- Use the `Scene` menu to search things, select them from a list, focus the camera on them, or hide/lock them.
- Project name, save/load, undo/redo, export, playable export, and import live in the `Project` menu.
- `Project -> Tutorial` reopens the walkthrough if you want a refresher.
- Use the `Actions` menu for `Copy`, `Paste`, `Duplicate`, `Send Back`, `Bring Front`, `Hide`, `Lock`, `Focus`, and `Fit World`.
- Hold the arrow keys in edit mode to pan the scene in that direction.
- Press `Delete` to remove the current selection.
- Press `Ctrl+C` to copy, `Ctrl+V` to paste, `Ctrl+D` to duplicate, `F` to focus the current selection, `[` to send selected things back, and `]` to bring them to front.
- Press `Ctrl+Z` to undo and `Ctrl+Y` to redo.
- Change `Imported sprite pixel limit` in the World panel to control how low-res imported art becomes.
- Click an imported asset to set its animation speed in FPS.
- To draw art inside the site, open `Art`, use the pixel editor canvas, add pages for animation frames, set FPS, then click `Save Asset`.
- To retexture the top menu logos, edit the PNG files in `assets/menu-icons/` and keep the same filenames.
- To give one thing action-specific animations, select it and use `Action animations` in the Selected Thing panel.
- Example: assign one imported animation to `Idle`, another to `Walking`, another to `Start jumping`, another to `Currently jumping`, and another to `Land`.
- If the player has a `Start jumping` animation assigned, that full animation now plays before lift-off, then `Currently jumping` takes over while the character is still rising.
- Player animations keep the last facing direction in play mode and automatically mirror left when the player moves left, so you only need to draw the right-facing version.
- When the player takes damage, they flash red briefly and get knocked backward opposite their current movement.
- Click `Export Playable` to download a single HTML file that opens straight into the game and hides the editor.

In play mode:

- The default template uses `A`/`D` or arrow keys to move, `Space`/`W`/`ArrowUp` to jump, `Shift` to dash, and `F` to shoot.
- On mobile, use the left movement wheel to move and jump. The wheel maps to the arrow keys, so dragging upward jumps. Use the `ATK` button to trigger the same action as `F`.
- You can delete or add logic bindings in the `Logic` menu.

## Missing

- No timeline editor yet for complex animation events.
- No built-in music sequencer yet.
- Imported projects are stored in-browser unless exported as JSON.
- The built-in physics are intentionally simple so the creator stays easy to understand.
