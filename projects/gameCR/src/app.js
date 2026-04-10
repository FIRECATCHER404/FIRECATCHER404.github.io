const GRID_SIZE = 32;
const STORAGE_KEY = "gameCR.project.v1";
const HISTORY_LIMIT = 80;
const DEFAULT_IMPORT_PIXEL_LIMIT = 32;
const PIXEL_EDITOR_MIN_SIZE = 4;
const PIXEL_EDITOR_MAX_SIZE = 64;
const PIXEL_EDITOR_CANVAS_SIZE = 384;
const RESIZE_HANDLE_SIZE = 10;
const EDIT_PAN_SPEED = 960;
const PAN_DRAG_THRESHOLD = 6;
const PANEL_STATE_KEY = "gameCR-panel-state-v1";
const TUTORIAL_STEPS = [
  {
    title: "Welcome to gameCR",
    menu: "project",
    body: [
      "gameCR is a canvas-first 2D game maker. You place objects in the world, assign art and animation, wire actions with keybind logic, test it instantly, and export a playable HTML file."
    ],
    bullets: [
      "Use the square buttons across the top to switch between Build, Actions, Project, Info, Logic, World, Scene, Art, and SFX.",
      "Everything important lives in those menus so the game canvas stays visible while you work.",
      "The Tutorial button in Project reopens this guide whenever you want a refresher."
    ],
    examples: [
      "Typical loop: open Build, place platforms and a player, open Info to tweak them, open Logic to bind controls, then press Play.",
      "If you forget where something lives, use the menu shown on each step with the Open Menu button."
    ]
  },
  {
    title: "Build the Level",
    menu: "build",
    body: [
      "Open Build to choose what you want to place in the level. After you click a tool, close the menu and click the world to drop that thing onto the map."
    ],
    bullets: [
      "The main pieces are Player, Platform, Sprite, Mob, Trap, Lava, Door, Portal, Trigger, Checkpoint, Goal, and Erase.",
      "After placing something, the editor switches back to Select so you can move, resize, or place the next object without getting stuck in place mode.",
      "Drag empty space to pan the scene. On desktop, arrow keys also pan while editing."
    ],
    examples: [
      "Basic platformer start: place one Player, a wide Platform as the ground, a Goal near the end, and a few higher Platforms to jump across.",
      "Hazard setup: place Lava under gaps and a Mob on a platform so the player has to jump or fight."
    ]
  },
  {
    title: "Select, Move, and Resize",
    menu: "inspect",
    body: [
      "Select a thing in the canvas to edit it. Info is where you change size, textures, platform maps, animations, behavior, and most per-object settings."
    ],
    bullets: [
      "Drag a selected thing to move it. Drag the edge or corner handles on a platform to reshape it directly instead of stacking tiles side-by-side.",
      "Right-drag selects multiple objects so you can move or delete a group together.",
      "If you prefer list-based selection, the Scene menu lets you find, focus, hide, and lock objects."
    ],
    examples: [
      "To make a floating ledge, place one Platform, select it, then drag its right edge until it is the width you want.",
      "To move an enemy section together, right-drag across a mob, trap, and checkpoint, then drag any selected object to move the whole set."
    ]
  },
  {
    title: "Textures and Visual Setup",
    menu: "inspect",
    body: [
      "Each object can use built-in visuals, a local texture, or a project-wide default texture. Platforms are special because they support a full 9-slice tile map."
    ],
    bullets: [
      "A normal object like Player, Mob, Door, or Portal can use a sprite or animation asset directly.",
      "Platforms can use a middle texture plus top, bottom, left, right, and corner pieces so they stretch cleanly.",
      "World -> Global textures lets you assign defaults so every platform or portal does not need to be textured by hand."
    ],
    examples: [
      "If every platform in your game should use the same grass tiles, set that in World -> Global textures once instead of editing every platform.",
      "If one special platform should look different, select only that platform in Info and assign a local texture override."
    ]
  },
  {
    title: "Art, Frames, and Animation",
    menu: "sprites",
    body: [
      "The Art menu includes both importing and a built-in pixel editor. The pixel editor is for drawing sprites inside the site, and each page becomes one frame of an animation."
    ],
    bullets: [
      "Use Draw and Erase to edit pixels. Change W and H to choose the sprite resolution, and FPS to control how fast the saved animation plays.",
      "Add Page creates a new frame. Duplicate copies the current frame so you can make small motion changes between frames.",
      "Save Asset turns the pages into a normal sprite or animation that can be assigned anywhere in the game."
    ],
    examples: [
      "Idle animation example: make three pages where the player blinks or bobs slightly, then save at 6 to 8 FPS.",
      "Walk animation example: duplicate a standing frame several times and move the feet and arms a little on each page."
    ]
  },
  {
    title: "Assign Action Animations",
    menu: "inspect",
    body: [
      "Objects can use one texture for everything, or separate animations for specific states. This is especially useful for the player, mobs, doors, and other active objects."
    ],
    bullets: [
      "Action slots include idle, walking, start jumping, currently jumping, land, falling, attacking, hurt, active, inactive, open, and closed.",
      "Jumping is split into start jumping, currently jumping, and land so the player can lift off cleanly before the in-air loop starts.",
      "Animation speed lives on the asset itself, so one saved animation can be reused in multiple places."
    ],
    examples: [
      "Player example: assign one asset to Idle, another to Walking, another to Start jumping, another to Currently jumping, and another to Land.",
      "Door example: assign a closed animation to Closed and a different one to Open so the door visibly changes state."
    ]
  },
  {
    title: "Logic and Keybinds",
    menu: "logic",
    body: [
      "Logic is event-driven and key-based. You do not write code. Instead, you choose a key, choose when it should trigger, and choose an action for the selected object."
    ],
    bullets: [
      "Events include key down, key press, and key up, so you can choose whether an action repeats or only fires once.",
      "Actions include move, jump, dash, shoot, activate, spawn, resize, hide, show, open door, close door, activate portal, and more.",
      "The selected object is usually the target of the logic entry, so select the right thing before you add a keybind."
    ],
    examples: [
      "Default player controls: ArrowLeft or A -> Move left, ArrowRight or D -> Move right, Space -> Jump, F -> Shoot.",
      "Trap toggle example: bind a switch object to Toggle active so a key can turn a hazard on and off."
    ]
  },
  {
    title: "Triggers, Portals, Doors, and Power-Ups",
    menu: "logic",
    body: [
      "Interactive levels come from combining object types. A trigger can activate another thing, a portal can teleport the player, a door can block routes, and power-ups can change the player temporarily."
    ],
    bullets: [
      "Place two portals and they auto-link when the second one is placed if the first is still waiting for a pair.",
      "Portals can be always active or activatable, so a trigger or keybind can turn them on later.",
      "Power-ups support built-in effects like speed, shield, low gravity, heal, and double jump, plus custom function hooks."
    ],
    examples: [
      "Puzzle example: a trigger near the start activates a portal near the end, opening a secret shortcut only after the player reaches the switch.",
      "Progression example: a door blocks the exit until the player touches a checkpoint trigger or collects a power-up."
    ]
  },
  {
    title: "World Settings and Project Defaults",
    menu: "world",
    body: [
      "World controls the overall project instead of a single object. This is where you set the camera bounds, gravity, grid behavior, import pixel limit, messages, and default textures."
    ],
    bullets: [
      "Game flow settings let you customize intro text, HUD labels, win title, lose title, respawn behavior, and other runtime messages.",
      "Global textures let you assign one default look to each object type.",
      "Imported sprite pixel limit controls how aggressively imported art is reduced to the 8-bit look."
    ],
    examples: [
      "If your game is supposed to feel floaty, lower gravity in World instead of editing every jump-related object.",
      "If you want a stronger retro look, lower the imported sprite pixel limit so outside art becomes chunkier."
    ]
  },
  {
    title: "Playtest, Mobile, and Export",
    menu: "project",
    body: [
      "Use Play at the top right to test the game immediately without leaving the editor. When you are happy with it, save the project and export a standalone build."
    ],
    bullets: [
      "Save stores the project in the current browser. Export saves JSON. Playable exports a single HTML file with no editor UI.",
      "On touch devices, play mode automatically shows a movement wheel and attack button.",
      "The exported HTML uses the same assets, logic, and mobile controls as the editor preview."
    ],
    examples: [
      "Quick test loop: move a platform, press Play, try the jump, go back to Edit, then tweak the platform again.",
      "Sharing example: export a playable HTML file and upload it to a static host or GitHub Pages so other people can play it without seeing the editor."
    ]
  }
];

const TOOLS = [
  ["select", "Select"],
  ["player", "Player"],
  ["platform", "Platform"],
  ["sprite", "Sprite"],
  ["mob", "Mob"],
  ["trap", "Trap"],
  ["lava", "Lava"],
  ["powerup", "Power-up"],
  ["door", "Door"],
  ["portal", "Portal"],
  ["trigger", "Trigger"],
  ["checkpoint", "Checkpoint"],
  ["goal", "Goal"],
  ["erase", "Erase"]
];

const ACTIONS = [
  ["move_left", "Move left"],
  ["move_right", "Move right"],
  ["move_up", "Move up"],
  ["move_down", "Move down"],
  ["jump", "Jump"],
  ["dash_left", "Dash left"],
  ["dash_right", "Dash right"],
  ["shoot", "Shoot"],
  ["toggle_active", "Toggle active"],
  ["spawn_mob", "Spawn mob"],
  ["spawn_powerup", "Spawn power-up"],
  ["apply_powerup", "Apply power-up"],
  ["grow", "Grow"],
  ["shrink", "Shrink"],
  ["hide", "Hide"],
  ["show", "Show"],
  ["open_door", "Open door"],
  ["close_door", "Close door"],
  ["activate_portal", "Activate portal"],
  ["deactivate_portal", "Deactivate portal"],
  ["toggle_portal", "Toggle portal"],
  ["play_sound", "Play sound"],
  ["teleport_player", "Teleport player"],
  ["reset_level", "Reset level"]
];

const POWERUP_EFFECTS = [
  ["speed", "Speed boost"],
  ["shield", "Shield"],
  ["low_gravity", "Low gravity"],
  ["double_jump", "Double jump"],
  ["heal", "Heal"],
  ["coin", "Coin"],
  ["custom", "Custom function"]
];

const ANIMATION_SLOTS = [
  ["idle", "Idle"],
  ["walk", "Walking"],
  ["jump_start", "Start jumping"],
  ["jump", "Currently jumping"],
  ["land", "Land"],
  ["fall", "Falling"],
  ["attack", "Attacking"],
  ["hurt", "Hurt"],
  ["active", "Active"],
  ["inactive", "Inactive"],
  ["open", "Open"],
  ["closed", "Closed"]
];

const PLATFORM_TILE_SLOTS = [
  ["center", "Middle"],
  ["top", "Top side"],
  ["bottom", "Bottom side"],
  ["left", "Left side"],
  ["right", "Right side"],
  ["topLeft", "Top-left corner"],
  ["topRight", "Top-right corner"],
  ["bottomLeft", "Bottom-left corner"],
  ["bottomRight", "Bottom-right corner"]
];

const PLATFORM_TILE_LAYOUT = [
  ["topLeft", "top", "topRight"],
  ["left", "center", "right"],
  ["bottomLeft", "bottom", "bottomRight"]
];

const TYPE_LABELS = {
  player: "Player",
  platform: "Platform",
  sprite: "Sprite",
  mob: "Mob",
  trap: "Trap",
  lava: "Lava",
  powerup: "Power-up",
  door: "Door",
  portal: "Portal",
  trigger: "Trigger",
  checkpoint: "Checkpoint",
  goal: "Goal",
  projectile: "Projectile"
};

const GLOBAL_TEXTURE_TYPES = TOOLS.filter(([tool]) => !["select", "erase"].includes(tool));

const els = {};
let project = createDefaultProject();
let mode = "edit";
let activeTool = "select";
let selectedId = null;
let selectedIds = [];
let sceneFilterText = "";
let selectedAssetId = null;
let selectedSoundId = "";
let camera = { x: -40, y: -40, zoom: 1 };
let mouse = {
  down: false,
  dragging: false,
  draggingGroup: false,
  resizing: false,
  marqueeSelecting: false,
  resizeHandle: "",
  panning: false,
  panCandidate: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragStartWorldX: 0,
  dragStartWorldY: 0,
  dragSelectionStart: [],
  resizeStartX: 0,
  resizeStartY: 0,
  resizeStartRect: null,
  panStartX: 0,
  panStartY: 0,
  cameraStartX: 0,
  cameraStartY: 0,
  marqueeStartX: 0,
  marqueeStartY: 0,
  marqueeCurrentX: 0,
  marqueeCurrentY: 0,
  pointerId: null
};
let playState = null;
let lastFrame = performance.now();
let animationFrame = 0;
let undoStack = [];
let redoStack = [];
let editPanKeys = new Set();
let panelState = {};
let clipboardSelection = null;
let clipboardPasteCount = 0;
const imageCache = new Map();
const audioCache = new Map();
let entityEffectCanvas = null;
let entityEffectCtx = null;
let selectedPlatformTileSlot = "center";
let selectedGlobalTextureType = "platform";
let selectedGlobalPlatformTileSlot = "center";
let activeDockTab = "";
let activeMenu = "";
const MOBILE_WHEEL_CODES = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
const mobileInput = {
  wheelPointerId: null,
  wheelCodes: new Set(),
  attackPointerId: null
};
const pixelEditor = {
  width: 16,
  height: 16,
  frames: [createBlankPixelFrame(16, 16)],
  activeFrame: 0,
  color: "#31b6a4",
  tool: "draw",
  pointerId: null,
  drawing: false
};
const tutorialState = {
  open: false,
  step: 0
};

function uid(prefix) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && cryptoApi.randomUUID) {
    return `${prefix}-${cryptoApi.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultProject() {
  const playerId = uid("player");
  const platformId = uid("platform");
  const mobId = uid("mob");
  const powerupId = uid("powerup");
  const doorId = uid("door");
  const triggerId = uid("trigger");
  const goalId = uid("goal");
  return {
    version: 1,
    name: "Crystal Runner",
    world: {
      width: 1600,
      height: 900,
      gravity: 1850,
      background: "#172536",
      grid: true,
      snap: true,
      importPixelLimit: DEFAULT_IMPORT_PIXEL_LIMIT
    },
    textureDefaults: emptyTextureDefaults(),
    gameplay: defaultGameSettings(),
    assets: [],
    sounds: [],
    entities: [
      entityTemplate("player", 160, 470, playerId),
      { ...entityTemplate("platform", 64, 560, platformId), w: 720, h: 44, name: "Ground" },
      { ...entityTemplate("platform", 520, 430), w: 230, h: 34, name: "High Platform" },
      { ...entityTemplate("mob", 640, 500, mobId), props: { ai: "patrol", speed: 85, range: 180, damage: 1, active: true } },
      { ...entityTemplate("lava", 900, 560), w: 190, h: 44, props: { damage: 1, active: true } },
      { ...entityTemplate("trap", 420, 528), w: 96, h: 32, props: { damage: 1, active: true } },
      { ...entityTemplate("powerup", 570, 385, powerupId), props: { effect: "speed", duration: 6, customAction: "grow", customValue: 1, active: true } },
      { ...entityTemplate("trigger", 1000, 488, triggerId), w: 82, h: 72, name: "Door Trigger", props: { active: true, targetId: doorId, action: "open_door", value: 1, once: false, soundId: "" } },
      { ...entityTemplate("door", 1110, 488, doorId), h: 72, props: { active: true, open: false } },
      { ...entityTemplate("checkpoint", 760, 512), props: { active: true } },
      { ...entityTemplate("goal", 1230, 488, goalId), w: 54, h: 72, name: "Exit Flag" }
    ],
    logic: [
      logicTemplate("KeyA", "down", playerId, "move_left", 1),
      logicTemplate("ArrowLeft", "down", playerId, "move_left", 1),
      logicTemplate("KeyD", "down", playerId, "move_right", 1),
      logicTemplate("ArrowRight", "down", playerId, "move_right", 1),
      logicTemplate("KeyW", "press", playerId, "jump", 1),
      logicTemplate("ArrowUp", "press", playerId, "jump", 1),
      logicTemplate("Space", "press", playerId, "jump", 1),
      logicTemplate("ShiftLeft", "press", playerId, "dash_right", 1),
      logicTemplate("KeyF", "press", playerId, "shoot", 1)
    ]
  };
}

function entityTemplate(type, x, y, id = uid(type)) {
  const base = {
    id,
    type,
    name: TYPE_LABELS[type] || "Thing",
    x,
    y,
    w: 48,
    h: 48,
    color: colorForType(type),
    assetId: "",
    textureFallback: "global",
    locked: false,
    animations: emptyAnimations(),
    visible: true,
    props: {}
  };

  if (type === "player") {
    base.w = 34;
    base.h = 48;
    base.name = "Player";
    base.props = { speed: 360, jump: 720, health: 3, active: true };
  } else if (type === "platform") {
    base.w = 160;
    base.h = 32;
    base.name = "Platform";
    base.props = { active: true, tileSize: 16 };
    base.platformTiles = emptyPlatformTiles();
    base.platformTileMap = emptyPlatformTileMap();
  } else if (type === "mob") {
    base.w = 42;
    base.h = 42;
    base.name = "Mob";
    base.props = { ai: "patrol", speed: 80, range: 160, damage: 1, active: true };
  } else if (type === "trap") {
    base.w = 96;
    base.h = 30;
    base.name = "Spike Trap";
    base.props = { damage: 1, active: true };
  } else if (type === "lava") {
    base.w = 128;
    base.h = 34;
    base.name = "Lava";
    base.props = { damage: 1, active: true };
  } else if (type === "powerup") {
    base.w = 34;
    base.h = 34;
    base.name = "Power-up";
    base.props = { effect: "speed", duration: 6, customAction: "grow", customValue: 1, active: true };
  } else if (type === "door") {
    base.w = 44;
    base.h = 86;
    base.name = "Door";
    base.props = { active: true, open: false };
  } else if (type === "portal") {
    base.w = 48;
    base.h = 80;
    base.name = "Portal";
    base.color = "#60b8ff";
    base.props = {
      active: false,
      alwaysActive: true,
      linkedPortalId: "",
      cooldown: 0.65,
      soundId: ""
    };
  } else if (type === "trigger") {
    base.w = 96;
    base.h = 72;
    base.name = "Trigger Zone";
    base.color = "#31b6a4";
    base.props = {
      active: true,
      targetId: "",
      action: "open_door",
      value: 1,
      once: false,
      soundId: ""
    };
  } else if (type === "checkpoint") {
    base.w = 38;
    base.h = 64;
    base.name = "Checkpoint";
    base.props = { active: true };
  } else if (type === "goal") {
    base.w = 54;
    base.h = 72;
    base.name = "Goal";
    base.props = { active: true };
  } else if (type === "sprite") {
    base.name = "Sprite";
    base.props = { active: true, gravity: false };
  }

  return base;
}

function emptyAnimations() {
  const animations = {};
  for (const [slot] of ANIMATION_SLOTS) {
    animations[slot] = "";
  }
  return animations;
}

function emptyPlatformTiles() {
  const tiles = {};
  for (const [slot] of PLATFORM_TILE_SLOTS) {
    tiles[slot] = "";
  }
  return tiles;
}

function emptyPlatformTileMap() {
  const slots = {};
  for (const [slot] of PLATFORM_TILE_SLOTS) {
    slots[slot] = -1;
  }
  return {
    assetId: "",
    columns: 3,
    rows: 3,
    slots
  };
}

function normalizeTextureDefaults(value) {
  const next = emptyTextureDefaults();
  const source = value || {};
  for (const [type] of GLOBAL_TEXTURE_TYPES) {
    const current = source[type] || {};
    next[type] = {
      ...emptyTypeTextureDefault(type),
      ...current,
      assetId: current.assetId || ""
    };
    if (type === "platform") {
      next[type].platformTileMap = normalizePlatformTileMap(current.platformTileMap);
    }
  }
  return next;
}

function emptyTypeTextureDefault(type) {
  const next = {
    assetId: ""
  };
  if (type === "platform") {
    next.platformTileMap = emptyPlatformTileMap();
  }
  return next;
}

function emptyTextureDefaults() {
  const defaults = {};
  for (const [type] of GLOBAL_TEXTURE_TYPES) {
    defaults[type] = emptyTypeTextureDefault(type);
  }
  return defaults;
}

function defaultGameSettings() {
  return {
    introMessage: "Find the goal.",
    introSeconds: 2,
    hudIdleMessage: "Play mode",
    hudHint: "Click the game, then use your project keybinds. Press R after win or loss to restart.",
    healthLabel: "Health",
    scoreLabel: "Score",
    winMessage: "Goal reached.",
    winMessageSeconds: 2,
    winTitle: "You made it.",
    winSubtitle: "Press R to restart.",
    defeatMode: "respawn",
    loseTitle: "Game over.",
    loseSubtitle: "Press R to restart.",
    damageMessage: "Ouch.",
    damageSeconds: 1.2,
    shieldBlockedMessage: "Shield blocked damage.",
    shieldBlockedSeconds: 1,
    checkpointMessage: "Checkpoint set.",
    checkpointSeconds: 1.2,
    respawnMessage: "Respawned.",
    respawnSeconds: 1.8,
    mobClearedMessage: "Mob cleared.",
    mobClearedSeconds: 1.2,
    speedBoostMessage: "Speed boost.",
    shieldActiveMessage: "Shield active.",
    lowGravityMessage: "Low gravity.",
    doubleJumpMessage: "Double jump unlocked.",
    healMessage: "Healed.",
    coinMessage: "Coin collected.",
    customPowerupMessage: "Custom power-up fired.",
    deathScorePenalty: 2,
    invulnerableSeconds: 1.1
  };
}

function normalizeGameSettings(value) {
  const defaults = defaultGameSettings();
  const source = value || {};
  const readNumber = (key) => {
    const parsed = Number(source[key]);
    return Number.isFinite(parsed) ? parsed : defaults[key];
  };
  return {
    ...defaults,
    ...source,
    introMessage: source.introMessage ?? defaults.introMessage,
    introSeconds: clamp(readNumber("introSeconds"), 0, 30),
    hudIdleMessage: source.hudIdleMessage ?? defaults.hudIdleMessage,
    hudHint: source.hudHint ?? defaults.hudHint,
    healthLabel: source.healthLabel ?? defaults.healthLabel,
    scoreLabel: source.scoreLabel ?? defaults.scoreLabel,
    winMessage: source.winMessage ?? defaults.winMessage,
    winMessageSeconds: clamp(readNumber("winMessageSeconds"), 0, 30),
    winTitle: source.winTitle ?? defaults.winTitle,
    winSubtitle: source.winSubtitle ?? defaults.winSubtitle,
    defeatMode: source.defeatMode === "game_over" ? "game_over" : "respawn",
    loseTitle: source.loseTitle ?? defaults.loseTitle,
    loseSubtitle: source.loseSubtitle ?? defaults.loseSubtitle,
    damageMessage: source.damageMessage ?? defaults.damageMessage,
    damageSeconds: clamp(readNumber("damageSeconds"), 0, 30),
    shieldBlockedMessage: source.shieldBlockedMessage ?? defaults.shieldBlockedMessage,
    shieldBlockedSeconds: clamp(readNumber("shieldBlockedSeconds"), 0, 30),
    checkpointMessage: source.checkpointMessage ?? defaults.checkpointMessage,
    checkpointSeconds: clamp(readNumber("checkpointSeconds"), 0, 30),
    respawnMessage: source.respawnMessage ?? defaults.respawnMessage,
    respawnSeconds: clamp(readNumber("respawnSeconds"), 0, 30),
    mobClearedMessage: source.mobClearedMessage ?? defaults.mobClearedMessage,
    mobClearedSeconds: clamp(readNumber("mobClearedSeconds"), 0, 30),
    speedBoostMessage: source.speedBoostMessage ?? defaults.speedBoostMessage,
    shieldActiveMessage: source.shieldActiveMessage ?? defaults.shieldActiveMessage,
    lowGravityMessage: source.lowGravityMessage ?? defaults.lowGravityMessage,
    doubleJumpMessage: source.doubleJumpMessage ?? defaults.doubleJumpMessage,
    healMessage: source.healMessage ?? defaults.healMessage,
    coinMessage: source.coinMessage ?? defaults.coinMessage,
    customPowerupMessage: source.customPowerupMessage ?? defaults.customPowerupMessage,
    deathScorePenalty: clamp(Math.round(readNumber("deathScorePenalty")), 0, 9999),
    invulnerableSeconds: clamp(readNumber("invulnerableSeconds"), 0, 30)
  };
}

function logicTemplate(key, eventType, targetId, action, value = 1) {
  return {
    id: uid("logic"),
    key,
    event: eventType,
    targetId,
    action,
    value,
    enabled: true
  };
}

function colorForType(type) {
  return {
    player: "#5cc8ff",
    platform: "#547447",
    sprite: "#d5e6ef",
    mob: "#ff6b57",
    trap: "#d1d5db",
    lava: "#ff6a27",
    powerup: "#44dac5",
    door: "#7b5a37",
    portal: "#60b8ff",
    trigger: "#31b6a4",
    checkpoint: "#60b8ff",
    goal: "#ffbf49",
    projectile: "#e7f2f3"
  }[type] || "#d5e6ef";
}

function init() {
  els.appShell = document.querySelector(".app-shell");
  els.workspace = document.querySelector(".workspace");
  els.bottomDock = document.querySelector(".bottom-dock");
  els.menuOverlay = document.getElementById("menuOverlay");
  els.menuBackdrop = document.querySelector(".menu-backdrop");
  els.menuTitle = document.getElementById("menuTitle");
  els.menuCloseBtn = document.getElementById("menuCloseBtn");
  els.menuButtons = Array.from(document.querySelectorAll("[data-menu-open]"));
  els.menuPanels = Array.from(document.querySelectorAll("[data-menu-panel]"));
  els.tutorialOverlay = document.getElementById("tutorialOverlay");
  els.tutorialBackdrop = document.querySelector(".tutorial-backdrop");
  els.tutorialTitle = document.getElementById("tutorialTitle");
  els.tutorialStepLabel = document.getElementById("tutorialStepLabel");
  els.tutorialBody = document.getElementById("tutorialBody");
  els.tutorialCloseBtn = document.getElementById("tutorialCloseBtn");
  els.tutorialPrevBtn = document.getElementById("tutorialPrevBtn");
  els.tutorialNextBtn = document.getElementById("tutorialNextBtn");
  els.tutorialOpenMenuBtn = document.getElementById("tutorialOpenMenuBtn");
  els.mobilePlayControls = document.getElementById("mobilePlayControls");
  els.mobileMoveWheel = document.getElementById("mobileMoveWheel");
  els.mobileMoveKnob = document.getElementById("mobileMoveKnob");
  els.mobileAttackBtn = document.getElementById("mobileAttackBtn");
  els.pixelEditorName = document.getElementById("pixelEditorName");
  els.pixelEditorWidth = document.getElementById("pixelEditorWidth");
  els.pixelEditorHeight = document.getElementById("pixelEditorHeight");
  els.pixelEditorFps = document.getElementById("pixelEditorFps");
  els.pixelEditorColor = document.getElementById("pixelEditorColor");
  els.pixelEditorCanvas = document.getElementById("pixelEditorCanvas");
  els.pixelEditorDrawBtn = document.getElementById("pixelEditorDrawBtn");
  els.pixelEditorEraserBtn = document.getElementById("pixelEditorEraserBtn");
  els.pixelEditorClearFrameBtn = document.getElementById("pixelEditorClearFrameBtn");
  els.pixelEditorPrevFrameBtn = document.getElementById("pixelEditorPrevFrameBtn");
  els.pixelEditorNextFrameBtn = document.getElementById("pixelEditorNextFrameBtn");
  els.pixelEditorAddFrameBtn = document.getElementById("pixelEditorAddFrameBtn");
  els.pixelEditorDuplicateFrameBtn = document.getElementById("pixelEditorDuplicateFrameBtn");
  els.pixelEditorDeleteFrameBtn = document.getElementById("pixelEditorDeleteFrameBtn");
  els.pixelEditorSaveAssetBtn = document.getElementById("pixelEditorSaveAssetBtn");
  els.pixelEditorFrameList = document.getElementById("pixelEditorFrameList");
  els.canvas = document.getElementById("stage");
  els.ctx = els.canvas.getContext("2d");
  els.statusLine = document.getElementById("statusLine");
  els.toolGrid = document.getElementById("toolGrid");
  els.stageToolbar = document.getElementById("stageToolbar");
  els.assetList = document.getElementById("assetList");
  els.soundList = document.getElementById("soundList");
  els.sceneList = document.getElementById("sceneList");
  els.sceneSearchInput = document.getElementById("sceneSearchInput");
  els.selectionPanel = document.getElementById("selectionPanel");
  els.logicBuilder = document.getElementById("logicBuilder");
  els.logicList = document.getElementById("logicList");
  els.worldPanel = document.getElementById("worldPanel");
  els.projectName = document.getElementById("projectName");
  els.dockTabs = Array.from(document.querySelectorAll("[data-dock-tab]"));
  els.dockPanes = Array.from(document.querySelectorAll("[data-dock-pane]"));

  document.getElementById("editModeBtn").addEventListener("click", () => setMode("edit"));
  document.getElementById("playModeBtn").addEventListener("click", () => setMode("play"));
  document.getElementById("stopModeBtn").addEventListener("click", () => setMode("edit"));
  document.getElementById("saveLocalBtn").addEventListener("click", saveLocal);
  document.getElementById("loadLocalBtn").addEventListener("click", loadLocal);
  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("redoBtn").addEventListener("click", redo);
  document.getElementById("exportBtn").addEventListener("click", exportProject);
  document.getElementById("exportPlayableBtn").addEventListener("click", exportPlayableHtml);
  document.getElementById("openTutorialBtn").addEventListener("click", () => openTutorial(0));
  document.getElementById("projectImport").addEventListener("change", importProject);
  document.getElementById("assetImport").addEventListener("change", importAssets);
  document.getElementById("soundImport").addEventListener("change", importSounds);
  els.projectName.addEventListener("input", () => {
    pushHistory();
    project.name = els.projectName.value || "Untitled game";
  });
  els.sceneSearchInput.addEventListener("input", () => {
    sceneFilterText = els.sceneSearchInput.value || "";
    renderSceneList();
  });
  els.dockTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveDockTab(button.dataset.dockTab));
  });
  els.menuButtons.forEach((button) => {
    button.addEventListener("click", () => openMenu(button.dataset.menuOpen));
  });
  els.menuCloseBtn.addEventListener("click", closeMenu);
  els.menuBackdrop.addEventListener("click", closeMenu);
  els.tutorialCloseBtn.addEventListener("click", closeTutorial);
  els.tutorialBackdrop.addEventListener("click", closeTutorial);
  els.tutorialPrevBtn.addEventListener("click", tutorialPrev);
  els.tutorialNextBtn.addEventListener("click", tutorialNext);
  els.tutorialOpenMenuBtn.addEventListener("click", tutorialOpenMenu);
  initMobilePlayControls();
  initPixelEditor();

  initPanelSections();
  els.canvas.addEventListener("pointerdown", onPointerDown);
  els.canvas.addEventListener("pointermove", onPointerMove);
  els.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("pointerup", onPointerUp);
  els.canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearTransientInputs);
  window.addEventListener("resize", resizeCanvas);

  renderAllPanels();
  resizeCanvas();
  requestAnimationFrame(loop);
}

function setMode(nextMode) {
  clearTransientInputs();
  if (nextMode === "play") {
    startPlay();
    mode = "play";
    activeTool = "select";
    els.canvas.focus();
  } else {
    stopPlay();
    mode = "edit";
  }
  syncModeButtons();
  setStatus(mode === "play" ? "Play mode. Your keybind logic is running." : "Edit mode. Select a tool and click the world.");
  renderToolGrid();
}

function syncModeButtons() {
  document.getElementById("editModeBtn").classList.toggle("primary", mode === "edit");
  document.getElementById("playModeBtn").classList.toggle("primary", mode === "play");
  document.getElementById("stopModeBtn").classList.toggle("primary", false);
  if (els.appShell) {
    els.appShell.classList.toggle("play-mode", mode === "play");
  }
}

function snapshotProject() {
  return JSON.stringify(project);
}

function pushHistory() {
  const snapshot = snapshotProject();
  if (undoStack[undoStack.length - 1] === snapshot) {
    return;
  }
  undoStack.push(snapshot);
  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift();
  }
  redoStack = [];
}

function restoreSnapshot(snapshot) {
  project = normalizeProject(JSON.parse(snapshot));
  clearSelection();
  selectedAssetId = null;
  selectedSoundId = "";
  stopPlay();
  mode = "edit";
  renderAllPanels();
  syncModeButtons();
}

function undo() {
  if (undoStack.length === 0) {
    setStatus("Nothing to undo.");
    return;
  }
  redoStack.push(snapshotProject());
  const snapshot = undoStack.pop();
  restoreSnapshot(snapshot);
  setStatus("Undid the last edit.");
}

function redo() {
  if (redoStack.length === 0) {
    setStatus("Nothing to redo.");
    return;
  }
  undoStack.push(snapshotProject());
  const snapshot = redoStack.pop();
  restoreSnapshot(snapshot);
  setStatus("Redid the edit.");
}

function startPlay() {
  const settings = gameSettings();
  const runtimeEntities = project.entities.map((entity) => ({
    ...deepClone(entity),
    vx: 0,
    vy: 0,
    onGround: false,
    startX: entity.x,
    startY: entity.y,
    facing: 1,
    health: entity.props.health || 1,
    invulnerableUntil: 0,
      portalCooldownUntil: 0,
      animationState: "",
      animationStartedAt: 0,
      animationUntil: 0,
      pendingJumpAt: 0,
      pendingJumpPower: 0,
      effects: {},
      usedDoubleJump: false,
    collected: false,
    fired: false,
    dead: false
  }));

  playState = {
    entities: runtimeEntities,
    projectiles: [],
    keysDown: new Set(),
    justPressed: new Set(),
    justReleased: new Set(),
    time: 0,
    score: 0,
    won: false,
    lost: false,
    lastCheckpointId: "",
    message: settings.introMessage,
    messageUntil: settings.introMessage ? settings.introSeconds : 0
  };
}

function stopPlay() {
  clearMobilePlayInput();
  playState = null;
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(640, Math.floor(rect.width * dpr));
  els.canvas.height = Math.max(360, Math.floor(rect.height * dpr));
  els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  els.ctx.imageSmoothingEnabled = false;
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;
  animationFrame += dt;

  if (mode === "edit") {
    stepEditCamera(dt);
  }
  if (mode === "play" && playState) {
    stepPlay(dt);
  }

  draw();
  if (playState) {
    playState.justPressed.clear();
    playState.justReleased.clear();
  }
  requestAnimationFrame(loop);
}

function renderAllPanels() {
  els.projectName.value = project.name;
  els.sceneSearchInput.value = sceneFilterText;
  rebuildImageCache();
  rebuildAudioCache();
  syncDockTabs();
  syncMenuOverlay();
  syncTutorialOverlay();
  renderToolGrid();
  renderStageToolbar();
  renderSceneList();
  renderPixelEditor();
  renderAssetList();
  renderSoundList();
  renderSelectionPanel();
  renderLogicBuilder();
  renderLogicList();
  renderWorldPanel();
}

function loadPanelState() {
  try {
    panelState = JSON.parse(localStorage.getItem(PANEL_STATE_KEY) || "{}") || {};
  } catch (error) {
    panelState = {};
  }
}

function savePanelState() {
  try {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(panelState));
  } catch (error) {
    void error;
  }
}

function initPanelSections() {
  loadPanelState();
  activeDockTab = panelState.activeDockTab || "";
  document.querySelectorAll("details.panel-section[data-section]").forEach((section) => {
    const key = section.dataset.section;
    if (Object.prototype.hasOwnProperty.call(panelState, key)) {
      section.open = Boolean(panelState[key]);
    } else {
      panelState[key] = section.open;
    }
    section.addEventListener("toggle", () => {
      panelState[key] = section.open;
      savePanelState();
    });
  });
  savePanelState();
}

function setActiveDockTab(tab) {
  activeDockTab = activeDockTab === tab ? "" : (tab || "");
  panelState.activeDockTab = activeDockTab;
  savePanelState();
  syncDockTabs();
  requestAnimationFrame(() => resizeCanvas());
}

function syncDockTabs() {
  if (!els.dockTabs || !els.dockPanes) {
    return;
  }
  els.dockTabs.forEach((button) => {
    const active = button.dataset.dockTab === activeDockTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.dockPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.dockPane === activeDockTab);
  });
  if (els.workspace) {
    els.workspace.classList.toggle("dock-collapsed", !activeDockTab);
  }
  if (els.bottomDock) {
    els.bottomDock.classList.toggle("collapsed", !activeDockTab);
  }
}

function openMenu(menu) {
  activeMenu = menu || "build";
  clearTransientInputs();
  syncMenuOverlay();
}

function closeMenu() {
  if (!activeMenu) {
    return;
  }
  activeMenu = "";
  clearTransientInputs();
  syncMenuOverlay();
  els.canvas.focus();
}

function syncMenuOverlay() {
  const menuTitles = {
    build: "Build",
    actions: "Quick Actions",
    project: "Project",
    inspect: "Selected Thing",
    logic: "Logic",
    world: "World",
    scene: "Scene",
    sprites: "Sprites",
    sounds: "Sounds"
  };
  const hasOpenMenu = Boolean(activeMenu);
  if (els.appShell) {
    els.appShell.classList.toggle("menu-open", hasOpenMenu);
  }
  if (els.menuOverlay) {
    els.menuOverlay.hidden = !hasOpenMenu;
  }
  if (els.menuTitle) {
    els.menuTitle.textContent = menuTitles[activeMenu] || "Menu";
  }
  if (els.menuButtons) {
    els.menuButtons.forEach((button) => {
      const active = button.dataset.menuOpen === activeMenu;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  if (els.menuPanels) {
    els.menuPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.menuPanel === activeMenu);
    });
  }
}

function openTutorial(step = 0) {
  tutorialState.open = true;
  tutorialState.step = clamp(step, 0, TUTORIAL_STEPS.length - 1);
  closeMenu();
  clearTransientInputs();
  syncTutorialOverlay();
}

function closeTutorial() {
  if (!tutorialState.open) {
    return;
  }
  tutorialState.open = false;
  syncTutorialOverlay();
  els.canvas.focus();
}

function syncTutorialOverlay() {
  if (els.appShell) {
    els.appShell.classList.toggle("tutorial-open", tutorialState.open);
  }
  if (els.tutorialOverlay) {
    els.tutorialOverlay.hidden = !tutorialState.open;
  }
  if (!tutorialState.open) {
    return;
  }
  const step = TUTORIAL_STEPS[tutorialState.step];
  const examples = Array.isArray(step.examples) ? step.examples : [];
  els.tutorialTitle.textContent = step.title;
  els.tutorialStepLabel.textContent = `Step ${tutorialState.step + 1} of ${TUTORIAL_STEPS.length}`;
  els.tutorialBody.innerHTML = `
    ${step.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    <ul>${step.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    ${examples.length > 0 ? `
      <div class="tutorial-examples">
        <p class="tutorial-section-title">Examples</p>
        <ul>${examples.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    ` : ""}
  `;
  els.tutorialPrevBtn.disabled = tutorialState.step <= 0;
  els.tutorialNextBtn.textContent = tutorialState.step >= TUTORIAL_STEPS.length - 1 ? "Finish" : "Next";
  const hasMenu = Boolean(step.menu);
  els.tutorialOpenMenuBtn.hidden = !hasMenu;
  if (hasMenu) {
    els.tutorialOpenMenuBtn.textContent = `Open ${menuTitleForTutorialStep(step.menu)}`;
  }
}

function menuTitleForTutorialStep(menu) {
  return {
    build: "Build",
    actions: "Actions",
    project: "Project",
    inspect: "Info",
    logic: "Logic",
    world: "World",
    scene: "Scene",
    sprites: "Art",
    sounds: "SFX"
  }[menu] || "Menu";
}

function tutorialPrev() {
  tutorialState.step = clamp(tutorialState.step - 1, 0, TUTORIAL_STEPS.length - 1);
  syncTutorialOverlay();
}

function tutorialNext() {
  if (tutorialState.step >= TUTORIAL_STEPS.length - 1) {
    closeTutorial();
    setStatus("Tutorial finished. Reopen it any time from Project.");
    return;
  }
  tutorialState.step += 1;
  syncTutorialOverlay();
}

function tutorialOpenMenu() {
  const step = TUTORIAL_STEPS[tutorialState.step];
  if (!step.menu) {
    return;
  }
  closeTutorial();
  openMenu(step.menu);
}

function initMobilePlayControls() {
  if (!els.mobileMoveWheel || !els.mobileAttackBtn) {
    return;
  }
  els.mobileMoveWheel.addEventListener("pointerdown", onMobileWheelDown);
  els.mobileMoveWheel.addEventListener("pointermove", onMobileWheelMove);
  els.mobileMoveWheel.addEventListener("pointerup", onMobileWheelUp);
  els.mobileMoveWheel.addEventListener("pointercancel", onMobileWheelUp);
  els.mobileMoveWheel.addEventListener("lostpointercapture", onMobileWheelUp);
  els.mobileAttackBtn.addEventListener("pointerdown", onMobileAttackDown);
  els.mobileAttackBtn.addEventListener("pointerup", onMobileAttackUp);
  els.mobileAttackBtn.addEventListener("pointercancel", onMobileAttackUp);
  els.mobileAttackBtn.addEventListener("lostpointercapture", onMobileAttackUp);
}

function pressPlayCode(code) {
  if (!playState || !code) {
    return;
  }
  if (!playState.keysDown.has(code)) {
    playState.justPressed.add(code);
  }
  playState.keysDown.add(code);
}

function releasePlayCode(code) {
  if (!playState || !code) {
    return;
  }
  if (playState.keysDown.has(code)) {
    playState.justReleased.add(code);
  }
  playState.keysDown.delete(code);
}

function setMobileWheelCodes(nextCodes) {
  const next = nextCodes || new Set();
  for (const code of mobileInput.wheelCodes) {
    if (!next.has(code)) {
      releasePlayCode(code);
    }
  }
  for (const code of next) {
    if (!mobileInput.wheelCodes.has(code)) {
      pressPlayCode(code);
    }
  }
  mobileInput.wheelCodes = new Set(next);
}

function setMobileWheelKnob(dx = 0, dy = 0) {
  if (!els.mobileMoveKnob) {
    return;
  }
  els.mobileMoveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function updateMobileWheel(event) {
  const rect = els.mobileMoveWheel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = Math.max(1, rect.width / 2);
  const maxTravel = radius * 0.42;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxTravel ? maxTravel / distance : 1;
  setMobileWheelKnob(Math.round(dx * scale), Math.round(dy * scale));

  const deadZone = radius * 0.22;
  const next = new Set();
  if (dx < -deadZone) {
    next.add("ArrowLeft");
  } else if (dx > deadZone) {
    next.add("ArrowRight");
  }
  if (dy < -deadZone) {
    next.add("ArrowUp");
  } else if (dy > deadZone) {
    next.add("ArrowDown");
  }
  setMobileWheelCodes(next);
}

function onMobileWheelDown(event) {
  if (mode !== "play" || !playState) {
    return;
  }
  event.preventDefault();
  mobileInput.wheelPointerId = event.pointerId;
  els.mobileMoveWheel.classList.add("active");
  if (els.mobileMoveWheel.setPointerCapture) {
    try {
      els.mobileMoveWheel.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
  }
  updateMobileWheel(event);
}

function onMobileWheelMove(event) {
  if (event.pointerId !== mobileInput.wheelPointerId) {
    return;
  }
  event.preventDefault();
  updateMobileWheel(event);
}

function onMobileWheelUp(event) {
  if (mobileInput.wheelPointerId != null && event.pointerId !== mobileInput.wheelPointerId) {
    return;
  }
  event.preventDefault();
  mobileInput.wheelPointerId = null;
  setMobileWheelCodes(new Set());
  setMobileWheelKnob(0, 0);
  els.mobileMoveWheel.classList.remove("active");
}

function onMobileAttackDown(event) {
  if (mode !== "play" || !playState) {
    return;
  }
  event.preventDefault();
  mobileInput.attackPointerId = event.pointerId;
  els.mobileAttackBtn.classList.add("active");
  if (els.mobileAttackBtn.setPointerCapture) {
    try {
      els.mobileAttackBtn.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
  }
  pressPlayCode("KeyF");
}

function onMobileAttackUp(event) {
  if (mobileInput.attackPointerId != null && event.pointerId !== mobileInput.attackPointerId) {
    return;
  }
  event.preventDefault();
  mobileInput.attackPointerId = null;
  els.mobileAttackBtn.classList.remove("active");
  releasePlayCode("KeyF");
}

function clearMobilePlayInput() {
  if (playState) {
    for (const code of MOBILE_WHEEL_CODES) {
      releasePlayCode(code);
    }
    releasePlayCode("KeyF");
  }
  mobileInput.wheelPointerId = null;
  mobileInput.wheelCodes.clear();
  mobileInput.attackPointerId = null;
  setMobileWheelKnob(0, 0);
  if (els.mobileMoveWheel) {
    els.mobileMoveWheel.classList.remove("active");
  }
  if (els.mobileAttackBtn) {
    els.mobileAttackBtn.classList.remove("active");
  }
}

function createBlankPixelFrame(width, height) {
  return Array.from({ length: width * height }, () => "");
}

function initPixelEditor() {
  if (!els.pixelEditorCanvas) {
    return;
  }
  const ctx = els.pixelEditorCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  els.pixelEditorCanvas.addEventListener("pointerdown", onPixelEditorPointerDown);
  els.pixelEditorCanvas.addEventListener("pointermove", onPixelEditorPointerMove);
  els.pixelEditorCanvas.addEventListener("pointerup", onPixelEditorPointerUp);
  els.pixelEditorCanvas.addEventListener("pointercancel", onPixelEditorPointerUp);
  els.pixelEditorCanvas.addEventListener("lostpointercapture", onPixelEditorPointerUp);
  els.pixelEditorWidth.addEventListener("change", updatePixelEditorSize);
  els.pixelEditorHeight.addEventListener("change", updatePixelEditorSize);
  els.pixelEditorColor.addEventListener("input", () => {
    pixelEditor.color = els.pixelEditorColor.value || pixelEditor.color;
    setPixelEditorTool("draw");
  });
  els.pixelEditorDrawBtn.addEventListener("click", () => setPixelEditorTool("draw"));
  els.pixelEditorEraserBtn.addEventListener("click", () => setPixelEditorTool("erase"));
  els.pixelEditorClearFrameBtn.addEventListener("click", clearPixelEditorFrame);
  els.pixelEditorPrevFrameBtn.addEventListener("click", () => setPixelEditorFrame(pixelEditor.activeFrame - 1));
  els.pixelEditorNextFrameBtn.addEventListener("click", () => setPixelEditorFrame(pixelEditor.activeFrame + 1));
  els.pixelEditorAddFrameBtn.addEventListener("click", addPixelEditorFrame);
  els.pixelEditorDuplicateFrameBtn.addEventListener("click", duplicatePixelEditorFrame);
  els.pixelEditorDeleteFrameBtn.addEventListener("click", deletePixelEditorFrame);
  els.pixelEditorSaveAssetBtn.addEventListener("click", savePixelEditorAsset);
  renderPixelEditor();
}

function renderPixelEditor() {
  if (!els.pixelEditorCanvas) {
    return;
  }
  els.pixelEditorWidth.value = pixelEditor.width;
  els.pixelEditorHeight.value = pixelEditor.height;
  els.pixelEditorColor.value = pixelEditor.color;
  els.pixelEditorDrawBtn.classList.toggle("primary", pixelEditor.tool === "draw");
  els.pixelEditorEraserBtn.classList.toggle("primary", pixelEditor.tool === "erase");
  els.pixelEditorPrevFrameBtn.disabled = pixelEditor.activeFrame <= 0;
  els.pixelEditorNextFrameBtn.disabled = pixelEditor.activeFrame >= pixelEditor.frames.length - 1;
  els.pixelEditorDeleteFrameBtn.disabled = pixelEditor.frames.length <= 1;
  drawPixelEditorCanvas();
  renderPixelEditorFrameList();
}

function drawPixelEditorCanvas() {
  const canvas = els.pixelEditorCanvas;
  const ctx = canvas.getContext("2d");
  canvas.width = PIXEL_EDITOR_CANVAS_SIZE;
  canvas.height = PIXEL_EDITOR_CANVAS_SIZE;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cellW = canvas.width / pixelEditor.width;
  const cellH = canvas.height / pixelEditor.height;
  for (let y = 0; y < pixelEditor.height; y += 1) {
    for (let x = 0; x < pixelEditor.width; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#0a1216" : "#101d23";
      ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
    }
  }
  const frame = pixelEditor.frames[pixelEditor.activeFrame] || createBlankPixelFrame(pixelEditor.width, pixelEditor.height);
  for (let y = 0; y < pixelEditor.height; y += 1) {
    for (let x = 0; x < pixelEditor.width; x += 1) {
      const color = frame[y * pixelEditor.width + x];
      if (!color) {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
    }
  }
  ctx.strokeStyle = "rgba(231, 242, 243, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= pixelEditor.width; x += 1) {
    const px = Math.round(x * cellW) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= pixelEditor.height; y += 1) {
    const py = Math.round(y * cellH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvas.width, py);
    ctx.stroke();
  }
}

function renderPixelEditorFrameList() {
  els.pixelEditorFrameList.innerHTML = pixelEditor.frames.map((frame, index) => `
    <button class="pixel-frame-button${index === pixelEditor.activeFrame ? " active" : ""}" type="button" data-pixel-frame="${index}">
      <canvas class="pixel-frame-thumb" width="${pixelEditor.width}" height="${pixelEditor.height}" aria-hidden="true"></canvas>
      <span>Page ${index + 1}</span>
    </button>
  `).join("");
  els.pixelEditorFrameList.querySelectorAll("[data-pixel-frame]").forEach((button) => {
    button.addEventListener("click", () => setPixelEditorFrame(Number(button.dataset.pixelFrame)));
    const thumb = button.querySelector("canvas");
    drawPixelFrameThumbnail(thumb, pixelEditor.frames[Number(button.dataset.pixelFrame)]);
  });
}

function drawPixelFrameThumbnail(canvas, frame) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < pixelEditor.height; y += 1) {
    for (let x = 0; x < pixelEditor.width; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#0a1216" : "#101d23";
      ctx.fillRect(x, y, 1, 1);
      const color = frame[y * pixelEditor.width + x];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function setPixelEditorTool(tool) {
  pixelEditor.tool = tool === "erase" ? "erase" : "draw";
  renderPixelEditor();
}

function setPixelEditorFrame(index) {
  pixelEditor.activeFrame = clamp(index, 0, pixelEditor.frames.length - 1);
  renderPixelEditor();
}

function addPixelEditorFrame() {
  pixelEditor.frames.splice(pixelEditor.activeFrame + 1, 0, createBlankPixelFrame(pixelEditor.width, pixelEditor.height));
  pixelEditor.activeFrame += 1;
  renderPixelEditor();
}

function duplicatePixelEditorFrame() {
  const current = pixelEditor.frames[pixelEditor.activeFrame] || createBlankPixelFrame(pixelEditor.width, pixelEditor.height);
  pixelEditor.frames.splice(pixelEditor.activeFrame + 1, 0, current.slice());
  pixelEditor.activeFrame += 1;
  renderPixelEditor();
}

function deletePixelEditorFrame() {
  if (pixelEditor.frames.length <= 1) {
    return;
  }
  pixelEditor.frames.splice(pixelEditor.activeFrame, 1);
  pixelEditor.activeFrame = clamp(pixelEditor.activeFrame, 0, pixelEditor.frames.length - 1);
  renderPixelEditor();
}

function clearPixelEditorFrame() {
  pixelEditor.frames[pixelEditor.activeFrame] = createBlankPixelFrame(pixelEditor.width, pixelEditor.height);
  renderPixelEditor();
}

function updatePixelEditorSize() {
  const nextWidth = clamp(Math.round(Number(els.pixelEditorWidth.value) || pixelEditor.width), PIXEL_EDITOR_MIN_SIZE, PIXEL_EDITOR_MAX_SIZE);
  const nextHeight = clamp(Math.round(Number(els.pixelEditorHeight.value) || pixelEditor.height), PIXEL_EDITOR_MIN_SIZE, PIXEL_EDITOR_MAX_SIZE);
  if (nextWidth === pixelEditor.width && nextHeight === pixelEditor.height) {
    renderPixelEditor();
    return;
  }
  pixelEditor.frames = pixelEditor.frames.map((frame) => resizePixelFrame(frame, pixelEditor.width, pixelEditor.height, nextWidth, nextHeight));
  pixelEditor.width = nextWidth;
  pixelEditor.height = nextHeight;
  renderPixelEditor();
}

function resizePixelFrame(frame, oldWidth, oldHeight, nextWidth, nextHeight) {
  const next = createBlankPixelFrame(nextWidth, nextHeight);
  const copyWidth = Math.min(oldWidth, nextWidth);
  const copyHeight = Math.min(oldHeight, nextHeight);
  for (let y = 0; y < copyHeight; y += 1) {
    for (let x = 0; x < copyWidth; x += 1) {
      next[y * nextWidth + x] = frame[y * oldWidth + x] || "";
    }
  }
  return next;
}

function onPixelEditorPointerDown(event) {
  event.preventDefault();
  pixelEditor.pointerId = event.pointerId;
  pixelEditor.drawing = true;
  if (els.pixelEditorCanvas.setPointerCapture) {
    try {
      els.pixelEditorCanvas.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
  }
  paintPixelEditorPoint(event);
}

function onPixelEditorPointerMove(event) {
  if (!pixelEditor.drawing || event.pointerId !== pixelEditor.pointerId) {
    return;
  }
  event.preventDefault();
  paintPixelEditorPoint(event);
}

function onPixelEditorPointerUp(event) {
  if (pixelEditor.pointerId != null && event.pointerId !== pixelEditor.pointerId) {
    return;
  }
  event.preventDefault();
  pixelEditor.pointerId = null;
  pixelEditor.drawing = false;
  renderPixelEditor();
}

function paintPixelEditorPoint(event) {
  const rect = els.pixelEditorCanvas.getBoundingClientRect();
  const x = clamp(Math.floor(((event.clientX - rect.left) / rect.width) * pixelEditor.width), 0, pixelEditor.width - 1);
  const y = clamp(Math.floor(((event.clientY - rect.top) / rect.height) * pixelEditor.height), 0, pixelEditor.height - 1);
  const frame = pixelEditor.frames[pixelEditor.activeFrame];
  const value = pixelEditor.tool === "erase" ? "" : pixelEditor.color;
  const index = y * pixelEditor.width + x;
  if (frame[index] === value) {
    return;
  }
  frame[index] = value;
  drawPixelEditorCanvas();
}

function pixelFrameToDataUrl(frame) {
  const canvas = document.createElement("canvas");
  canvas.width = pixelEditor.width;
  canvas.height = pixelEditor.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < pixelEditor.height; y += 1) {
    for (let x = 0; x < pixelEditor.width; x += 1) {
      const color = frame[y * pixelEditor.width + x];
      if (!color) {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL("image/png");
}

function savePixelEditorAsset() {
  const name = (els.pixelEditorName.value || "").trim() || `Pixel Asset ${project.assets.length + 1}`;
  const fps = clamp(Math.round(Number(els.pixelEditorFps.value) || 8), 1, 25);
  const frames = pixelEditor.frames.map((frame) => pixelFrameToDataUrl(frame));
  const asset = {
    id: uid("asset"),
    name,
    type: frames.length === 1 ? "sprite" : "animation",
    frames,
    frameDuration: clamp(Math.round(1000 / fps), 40, 1000),
    pixelLimit: Math.max(pixelEditor.width, pixelEditor.height)
  };
  pushHistory();
  project.assets.push(asset);
  selectedAssetId = asset.id;
  rebuildImageCache();
  renderAssetList();
  renderSelectionPanel();
  renderWorldPanel();
  setStatus(`${name} saved as ${frames.length === 1 ? "a sprite" : `${frames.length} animation pages`}.`);
}

function openPanelSection(key) {
  const section = document.querySelector(`details.panel-section[data-section="${key}"]`);
  if (!section || section.open) {
    return;
  }
  section.open = true;
  panelState[key] = true;
  savePanelState();
}

function renderToolGrid() {
  els.toolGrid.innerHTML = "";
  for (const [tool, label] of TOOLS) {
    const button = document.createElement("button");
    button.className = `tool-button${activeTool === tool ? " active" : ""}`;
    button.dataset.tool = tool;
    button.innerHTML = `<span class="tool-label">${escapeHtml(label)}</span>`;
    button.disabled = mode === "play" && tool !== "select";
    button.addEventListener("click", () => {
      activeTool = tool;
      renderToolGrid();
      if (activeMenu === "build") {
        closeMenu();
      }
    });
    els.toolGrid.appendChild(button);
  }
}

function renderStageToolbar() {
  const selection = selectedEntities();
  const count = selection.length;
  const hiddenCount = selection.filter((entity) => entity.visible === false).length;
  const lockedCount = selection.filter((entity) => entity.locked).length;
  const editDisabled = mode !== "edit";
  const selectionLabel = count === 0 ? "No selection" : count === 1 ? selection[0].name : `${count} things selected`;
  const hideLabel = count > 0 && hiddenCount === count ? "Show" : "Hide";
  const lockLabel = count > 0 && lockedCount === count ? "Unlock" : "Lock";
  els.stageToolbar.innerHTML = `
    <div class="stage-toolbar-group">
      <span class="stage-pill strong">${escapeHtml(mode === "edit" ? "Editor" : "Play")}</span>
      <span class="stage-pill">${escapeHtml(selectionLabel)}</span>
      <button id="focusSelectionBtn"${count === 0 ? " disabled" : ""}>Focus</button>
      <button id="fitWorldBtn">Fit World</button>
    </div>
    <div class="stage-toolbar-group">
      <button id="copySelectionBtn"${editDisabled || count === 0 ? " disabled" : ""}>Copy</button>
      <button id="pasteSelectionBtn"${editDisabled || !clipboardSelection ? " disabled" : ""}>Paste</button>
      <button id="duplicateSelectionBtn"${editDisabled || count === 0 ? " disabled" : ""}>Duplicate</button>
      <button id="sendBackBtn"${editDisabled || count === 0 ? " disabled" : ""}>Send Back</button>
      <button id="bringFrontBtn"${editDisabled || count === 0 ? " disabled" : ""}>Bring Front</button>
      <button id="toggleVisibilityBtn"${editDisabled || count === 0 ? " disabled" : ""}>${hideLabel}</button>
      <button id="toggleLockBtn"${editDisabled || count === 0 ? " disabled" : ""}>${lockLabel}</button>
    </div>
  `;
  document.getElementById("focusSelectionBtn").addEventListener("click", focusCameraOnSelection);
  document.getElementById("fitWorldBtn").addEventListener("click", fitCameraToWorld);
  document.getElementById("copySelectionBtn").addEventListener("click", copySelectionToClipboard);
  document.getElementById("pasteSelectionBtn").addEventListener("click", pasteClipboardSelection);
  document.getElementById("duplicateSelectionBtn").addEventListener("click", duplicateSelected);
  document.getElementById("sendBackBtn").addEventListener("click", () => moveSelectionToLayerEdge("back"));
  document.getElementById("bringFrontBtn").addEventListener("click", () => moveSelectionToLayerEdge("front"));
  document.getElementById("toggleVisibilityBtn").addEventListener("click", toggleSelectedVisibility);
  document.getElementById("toggleLockBtn").addEventListener("click", toggleSelectedLock);
}

function renderSceneList() {
  const query = sceneFilterText.trim().toLowerCase();
  const sceneEntities = [...project.entities].reverse().filter((entity) => {
    if (!query) {
      return true;
    }
    const haystack = `${entity.name} ${TYPE_LABELS[entity.type] || entity.type}`.toLowerCase();
    return haystack.includes(query);
  });
  if (sceneEntities.length === 0) {
    els.sceneList.innerHTML = '<p class="hint">No things match this search.</p>';
    return;
  }
  els.sceneList.innerHTML = sceneEntities.map((entity) => `
    <div class="scene-item${isEntitySelected(entity.id) ? " selected" : ""}${entity.visible === false ? " dimmed" : ""}">
      <button class="scene-main" type="button" data-scene-select="${entity.id}">
        <span class="card-title">${escapeHtml(entity.name)}</span>
        <span class="card-meta">${escapeHtml(TYPE_LABELS[entity.type] || entity.type)}${entity.locked ? " | Locked" : ""}${entity.visible === false ? " | Hidden" : ""}</span>
      </button>
      <div class="scene-actions">
        <button class="scene-mini" type="button" data-scene-focus="${entity.id}">Go</button>
        <button class="scene-mini" type="button" data-scene-visible="${entity.id}">${entity.visible === false ? "Show" : "Hide"}</button>
        <button class="scene-mini" type="button" data-scene-lock="${entity.id}">${entity.locked ? "Unlock" : "Lock"}</button>
      </div>
    </div>
  `).join("");
  els.sceneList.querySelectorAll("[data-scene-select]").forEach((button) => {
    button.addEventListener("click", (event) => selectSceneEntity(button.dataset.sceneSelect, event));
  });
  els.sceneList.querySelectorAll("[data-scene-focus]").forEach((button) => {
    button.addEventListener("click", () => focusCameraOnEntities([button.dataset.sceneFocus]));
  });
  els.sceneList.querySelectorAll("[data-scene-visible]").forEach((button) => {
    button.addEventListener("click", () => toggleEntityVisible(button.dataset.sceneVisible));
  });
  els.sceneList.querySelectorAll("[data-scene-lock]").forEach((button) => {
    button.addEventListener("click", () => toggleEntityLocked(button.dataset.sceneLock));
  });
}

function renderAssetList() {
  els.assetList.innerHTML = "";
  if (project.assets.length === 0) {
    els.assetList.innerHTML = '<p class="hint">Imported images show up here. Select one, then place a Sprite or assign it to a selected thing.</p>';
    return;
  }
  for (const asset of project.assets) {
    const card = document.createElement("button");
    card.className = `asset-card${selectedAssetId === asset.id ? " selected" : ""}`;
    card.type = "button";
      card.innerHTML = `
        <img class="asset-thumb" alt="" src="${asset.frames[0]}">
        <span>
          <span class="card-title">${escapeHtml(asset.name)}</span>
          <span class="card-meta">${asset.frames.length} frame${asset.frames.length === 1 ? "" : "s"}${asset.frames.length > 1 ? ` at ${animationFpsForAsset(asset)} FPS` : ""}</span>
        </span>
      `;
    card.addEventListener("click", () => {
      selectedAssetId = asset.id;
      const selected = selectedEntity();
      if (selected) {
        selected.assetId = asset.id;
        selected.color = selected.color || "#ffffff";
        renderSelectionPanel();
      }
      renderAssetList();
      });
    els.assetList.appendChild(card);
  }
  const asset = selectedAsset();
  if (asset) {
    const fps = animationFpsForAsset(asset);
    const settings = document.createElement("div");
    settings.className = "asset-settings";
    settings.innerHTML = `
      <div class="form-grid">
        <label class="wide">Selected asset<input id="assetNameInput" value="${escapeAttr(asset.name)}" autocomplete="off"></label>
        <label>Frames<input value="${asset.frames.length}" disabled></label>
        <label>Animation speed (FPS)<input id="assetSpeedInput" type="number" min="1" max="25" step="0.5" value="${fps}"></label>
      </div>
      <p class="hint">${asset.frames.length > 1 ? "Playback speed changes how fast this animation runs everywhere in the editor and exported game." : "Single-frame assets stay static, but this speed will apply if you add more frames later."}</p>
    `;
    els.assetList.appendChild(settings);
    document.getElementById("assetNameInput").addEventListener("change", (event) => updateAssetName(asset.id, event.target.value));
    document.getElementById("assetSpeedInput").addEventListener("change", (event) => updateAssetSpeed(asset.id, event.target.value));
  }
}

function renderSoundList() {
  els.soundList.innerHTML = "";
  if (!project.sounds || project.sounds.length === 0) {
    els.soundList.innerHTML = '<p class="hint">Imported sounds can be played from keybinds, triggers, and power-ups.</p>';
    return;
  }
  for (const sound of project.sounds) {
    const card = document.createElement("button");
    card.className = `asset-card${selectedSoundId === sound.id ? " selected" : ""}`;
    card.type = "button";
    card.innerHTML = `
      <span>
        <span class="card-title">${escapeHtml(sound.name)}</span>
        <span class="card-meta">Sound asset</span>
      </span>
    `;
    card.addEventListener("click", () => {
      selectedSoundId = sound.id;
      const selected = selectedEntity();
      if (selected) {
        pushHistory();
        selected.props.soundId = sound.id;
        renderSelectionPanel();
      }
      playSound(sound.id);
      renderSoundList();
    });
    els.soundList.appendChild(card);
  }
}

function renderSelectionPanel() {
  renderStageToolbar();
  renderSceneList();
  if (selectedIds.length > 1) {
    openPanelSection("selection");
    const count = selectedIds.length;
    els.selectionPanel.innerHTML = `
      <p class="card-title">${count} things selected</p>
      <p class="hint">Drag one of the selected things to move the whole group. Press Delete to remove them together.</p>
      <div class="tiny-row">
        <button id="clearMultiSelectionBtn">Clear selection</button>
        <button id="removeMultiSelectionBtn" class="danger">Remove selected</button>
      </div>
    `;
    document.getElementById("clearMultiSelectionBtn").addEventListener("click", () => {
      clearSelection();
      renderSelectionPanel();
      renderLogicBuilder();
    });
    document.getElementById("removeMultiSelectionBtn").addEventListener("click", removeSelected);
    return;
  }
  const entity = selectedEntity();
  if (!entity) {
    els.selectionPanel.innerHTML = '<p class="hint">No thing selected.</p>';
    return;
  }
  openPanelSection("selection");
  const localTextureLabel = entity.type === "platform" ? "Local middle fallback sprite" : "Local sprite or animation override";
  const localTexturePlaceholder = entity.textureFallback === "builtin" ? "Built-in look" : "Use project default";

  els.selectionPanel.innerHTML = `
    <div class="form-grid">
      <label class="wide">Name<input data-prop="name" value="${escapeAttr(entity.name)}"></label>
      <label>Type<input value="${TYPE_LABELS[entity.type] || entity.type}" disabled></label>
      <label>Color<input data-prop="color" type="color" value="${escapeAttr(entity.color)}"></label>
      <label>X<input data-prop="x" type="number" value="${Math.round(entity.x)}"></label>
      <label>Y<input data-prop="y" type="number" value="${Math.round(entity.y)}"></label>
      <label>Width<input data-prop="w" type="number" min="4" value="${Math.round(entity.w)}"></label>
      <label>Height<input data-prop="h" type="number" min="4" value="${Math.round(entity.h)}"></label>
      <label>Visible<select data-prop="visible">
        ${option("true", "Visible", String(entity.visible !== false))}
        ${option("false", "Hidden", String(entity.visible !== false))}
      </select></label>
      <label>Locked<select data-prop="locked">
        ${option("false", "Unlocked", String(Boolean(entity.locked)))}
        ${option("true", "Locked", String(Boolean(entity.locked)))}
      </select></label>
      <label>Texture fallback<select data-prop="textureFallback">
        ${option("global", "Project default", entity.textureFallback || "global")}
        ${option("builtin", "Built-in only", entity.textureFallback || "global")}
      </select></label>
      <label class="wide">${localTextureLabel}<select data-prop="assetId">${assetSelectOptions(entity.assetId, localTexturePlaceholder)}</select></label>
      <label class="wide">Sound<select data-nested="soundId">${soundOptions(entity.props.soundId || "")}</select></label>
      ${typeSpecificFields(entity)}
      ${animationFields(entity)}
    </div>
    <div class="tiny-row">
      <button id="duplicateEntityBtn">Duplicate</button>
      <button id="removeEntityBtn" class="danger">Remove</button>
    </div>
  `;

  els.selectionPanel.querySelectorAll("[data-prop]").forEach((input) => {
    input.addEventListener("input", () => updateEntityField(entity.id, input.dataset.prop, input.value, input.type));
    input.addEventListener("change", () => updateEntityField(entity.id, input.dataset.prop, input.value, input.type));
  });
  els.selectionPanel.querySelectorAll("[data-nested]").forEach((input) => {
    input.addEventListener("input", () => updateEntityNestedField(entity.id, input.dataset.nested, input.value));
    input.addEventListener("change", () => updateEntityNestedField(entity.id, input.dataset.nested, input.value));
  });
    els.selectionPanel.querySelectorAll("[data-animation-slot]").forEach((input) => {
      input.addEventListener("change", () => updateEntityAnimationField(entity.id, input.dataset.animationSlot, input.value));
    });
    els.selectionPanel.querySelectorAll("[data-platform-atlas]").forEach((input) => {
      input.addEventListener("input", () => updatePlatformTileMapField(entity.id, input.dataset.platformAtlas, input.value));
      input.addEventListener("change", () => updatePlatformTileMapField(entity.id, input.dataset.platformAtlas, input.value));
    });
    els.selectionPanel.querySelectorAll("[data-platform-tile]").forEach((input) => {
      input.addEventListener("change", () => updatePlatformTileField(entity.id, input.dataset.platformTile, input.value));
    });
    els.selectionPanel.querySelectorAll("[data-platform-slot-target]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedPlatformTileSlot = button.dataset.platformSlotTarget;
        renderSelectionPanel();
      });
    });
    document.getElementById("duplicateEntityBtn").addEventListener("click", duplicateSelected);
    document.getElementById("removeEntityBtn").addEventListener("click", removeSelected);
    if (entity.type === "platform") {
      const clearButton = document.getElementById("clearPlatformTileSlotBtn");
      if (clearButton) {
        clearButton.addEventListener("click", () => clearPlatformTileMapSlot(entity.id, selectedPlatformTileSlot));
      }
      const autoFillButton = document.getElementById("autofillPlatformTileMapBtn");
      if (autoFillButton) {
        autoFillButton.addEventListener("click", () => autoFillPlatformTileMap(entity.id));
      }
      renderPlatformTileAtlasPicker(entity);
    }
  }

function platformTileSlotLabel(slot) {
  const found = PLATFORM_TILE_SLOTS.find(([value]) => value === slot);
  return found ? found[1] : slot;
}

function platformTileSlotCode(slot) {
  return {
    topLeft: "TL",
    top: "T",
    topRight: "TR",
    left: "L",
    center: "C",
    right: "R",
    bottomLeft: "BL",
    bottom: "B",
    bottomRight: "BR"
  }[slot] || slot.slice(0, 2).toUpperCase();
}

function platformTileSlotSummary(tileMap, slot) {
  const index = tileMap.slots[slot];
  if (index == null || index < 0) {
    return "Unassigned";
  }
  const col = (index % tileMap.columns) + 1;
  const row = Math.floor(index / tileMap.columns) + 1;
  return `${col}, ${row}`;
}

function platformTextureMapFields(entity) {
  const tileMap = ensurePlatformTileMap(entity);
  const activeSlot = PLATFORM_TILE_SLOTS.some(([slot]) => slot === selectedPlatformTileSlot) ? selectedPlatformTileSlot : "center";
  const activeSummary = platformTileSlotSummary(tileMap, activeSlot);
  return `
    <label class="wide">Texture sheet<select data-platform-atlas="assetId">${assetSelectOptions(tileMap.assetId, "No texture sheet")}</select></label>
    <label>Sheet columns<input data-platform-atlas="columns" type="number" min="1" max="16" value="${tileMap.columns}"></label>
    <label>Sheet rows<input data-platform-atlas="rows" type="number" min="1" max="16" value="${tileMap.rows}"></label>
    <div class="wide platform-texture-ui">
      <p class="platform-map-title">Platform texture map</p>
      <div class="platform-slot-grid">
        ${PLATFORM_TILE_LAYOUT.map((row) => row.map((slot) => `
          <button type="button" class="platform-slot-button${activeSlot === slot ? " active" : ""}" data-platform-slot-target="${slot}">
            <span>${escapeHtml(platformTileSlotLabel(slot))}</span>
            <span class="card-meta">${escapeHtml(platformTileSlotSummary(tileMap, slot))}</span>
          </button>
        `).join("")).join("")}
      </div>
      <p class="hint">Selected part: ${escapeHtml(platformTileSlotLabel(activeSlot))}. Current cell: ${escapeHtml(activeSummary)}. Choose a texture sheet, then click a cell below to assign it.</p>
      ${tileMap.assetId ? '<canvas id="platformTileAtlasCanvas" class="platform-tile-canvas" width="240" height="240"></canvas>' : '<p class="hint">Choose a texture sheet to start assigning parts.</p>'}
      <div class="tiny-row">
        <button type="button" id="clearPlatformTileSlotBtn">Clear selected part</button>
        <button type="button" id="autofillPlatformTileMapBtn">Auto-fill first 3x3</button>
      </div>
    </div>
  `;
}

function globalTextureTypeOptions(selectedValue) {
  return GLOBAL_TEXTURE_TYPES
    .map(([type]) => `<option value="${type}"${type === selectedValue ? " selected" : ""}>${escapeHtml(TYPE_LABELS[type] || type)}</option>`)
    .join("");
}

function globalPlatformTextureMapFields(tileMap) {
  const activeSlot = PLATFORM_TILE_SLOTS.some(([slot]) => slot === selectedGlobalPlatformTileSlot) ? selectedGlobalPlatformTileSlot : "center";
  const activeSummary = platformTileSlotSummary(tileMap, activeSlot);
  return `
    <div class="platform-texture-ui">
      <div class="form-grid">
        <label class="wide">Texture sheet<select data-global-platform-atlas="assetId">${assetSelectOptions(tileMap.assetId, "No texture sheet")}</select></label>
        <label>Sheet columns<input data-global-platform-atlas="columns" type="number" min="1" max="16" value="${tileMap.columns}"></label>
        <label>Sheet rows<input data-global-platform-atlas="rows" type="number" min="1" max="16" value="${tileMap.rows}"></label>
      </div>
      <div class="platform-slot-grid">
        ${PLATFORM_TILE_LAYOUT.map((row) => row.map((slot) => `
          <button type="button" class="platform-slot-button${activeSlot === slot ? " active" : ""}" data-global-platform-slot-target="${slot}">
            <span>${escapeHtml(platformTileSlotLabel(slot))}</span>
            <span class="card-meta">${escapeHtml(platformTileSlotSummary(tileMap, slot))}</span>
          </button>
        `).join("")).join("")}
      </div>
      <p class="hint">Selected part: ${escapeHtml(platformTileSlotLabel(activeSlot))}. Current cell: ${escapeHtml(activeSummary)}. This atlas becomes the default for every platform without a local platform texture map.</p>
      ${tileMap.assetId ? '<canvas id="globalPlatformTileAtlasCanvas" class="platform-tile-canvas" width="240" height="240"></canvas>' : '<p class="hint">Choose a texture sheet to start assigning platform defaults.</p>'}
      <div class="tiny-row">
        <button type="button" id="clearGlobalPlatformTileSlotBtn">Clear selected part</button>
        <button type="button" id="autofillGlobalPlatformTileMapBtn">Auto-fill first 3x3</button>
      </div>
    </div>
  `;
}

function gameSettingsFields(settings) {
  return `
    <div class="panel-subsection">
      <p class="platform-map-title">Game flow</p>
      <div class="form-grid">
        <label class="wide">Intro message<input data-game="introMessage" value="${escapeAttr(settings.introMessage)}"></label>
        <label>Intro seconds<input data-game="introSeconds" type="number" min="0" max="30" step="0.1" value="${settings.introSeconds}"></label>
        <label>Defeat mode<select data-game="defeatMode">
          ${option("respawn", "Respawn player", settings.defeatMode)}
          ${option("game_over", "Game over screen", settings.defeatMode)}
        </select></label>
        <label>Death score penalty<input data-game="deathScorePenalty" type="number" min="0" max="9999" value="${settings.deathScorePenalty}"></label>
        <label>Hit invulnerability<input data-game="invulnerableSeconds" type="number" min="0" max="30" step="0.1" value="${settings.invulnerableSeconds}"></label>
        <label>HUD idle message<input data-game="hudIdleMessage" value="${escapeAttr(settings.hudIdleMessage)}"></label>
        <label class="wide">HUD hint<input data-game="hudHint" value="${escapeAttr(settings.hudHint)}"></label>
        <label>Health label<input data-game="healthLabel" value="${escapeAttr(settings.healthLabel)}"></label>
        <label>Score label<input data-game="scoreLabel" value="${escapeAttr(settings.scoreLabel)}"></label>
        <label class="wide">Win HUD message<input data-game="winMessage" value="${escapeAttr(settings.winMessage)}"></label>
        <label>Win message seconds<input data-game="winMessageSeconds" type="number" min="0" max="30" step="0.1" value="${settings.winMessageSeconds}"></label>
        <label class="wide">Win title<input data-game="winTitle" value="${escapeAttr(settings.winTitle)}"></label>
        <label class="wide">Win subtitle<input data-game="winSubtitle" value="${escapeAttr(settings.winSubtitle)}"></label>
        <label class="wide">Lose title<input data-game="loseTitle" value="${escapeAttr(settings.loseTitle)}"></label>
        <label class="wide">Lose subtitle<input data-game="loseSubtitle" value="${escapeAttr(settings.loseSubtitle)}"></label>
        <label>Damage message<input data-game="damageMessage" value="${escapeAttr(settings.damageMessage)}"></label>
        <label>Damage seconds<input data-game="damageSeconds" type="number" min="0" max="30" step="0.1" value="${settings.damageSeconds}"></label>
        <label>Shield block message<input data-game="shieldBlockedMessage" value="${escapeAttr(settings.shieldBlockedMessage)}"></label>
        <label>Shield block seconds<input data-game="shieldBlockedSeconds" type="number" min="0" max="30" step="0.1" value="${settings.shieldBlockedSeconds}"></label>
        <label>Checkpoint message<input data-game="checkpointMessage" value="${escapeAttr(settings.checkpointMessage)}"></label>
        <label>Checkpoint seconds<input data-game="checkpointSeconds" type="number" min="0" max="30" step="0.1" value="${settings.checkpointSeconds}"></label>
        <label>Respawn message<input data-game="respawnMessage" value="${escapeAttr(settings.respawnMessage)}"></label>
        <label>Respawn seconds<input data-game="respawnSeconds" type="number" min="0" max="30" step="0.1" value="${settings.respawnSeconds}"></label>
        <label>Mob cleared message<input data-game="mobClearedMessage" value="${escapeAttr(settings.mobClearedMessage)}"></label>
        <label>Mob cleared seconds<input data-game="mobClearedSeconds" type="number" min="0" max="30" step="0.1" value="${settings.mobClearedSeconds}"></label>
        <label>Speed boost message<input data-game="speedBoostMessage" value="${escapeAttr(settings.speedBoostMessage)}"></label>
        <label>Shield active message<input data-game="shieldActiveMessage" value="${escapeAttr(settings.shieldActiveMessage)}"></label>
        <label>Low gravity message<input data-game="lowGravityMessage" value="${escapeAttr(settings.lowGravityMessage)}"></label>
        <label>Double jump message<input data-game="doubleJumpMessage" value="${escapeAttr(settings.doubleJumpMessage)}"></label>
        <label>Heal message<input data-game="healMessage" value="${escapeAttr(settings.healMessage)}"></label>
        <label>Coin message<input data-game="coinMessage" value="${escapeAttr(settings.coinMessage)}"></label>
        <label class="wide">Custom power-up message<input data-game="customPowerupMessage" value="${escapeAttr(settings.customPowerupMessage)}"></label>
      </div>
    </div>
  `;
}

function typeSpecificFields(entity) {
  if (entity.type === "player") {
    return `
      <label>Speed<input data-nested="speed" type="number" value="${entity.props.speed || 360}"></label>
      <label>Jump<input data-nested="jump" type="number" value="${entity.props.jump || 720}"></label>
      <label>Health<input data-nested="health" type="number" min="1" value="${entity.props.health || 3}"></label>
    `;
  }
  if (entity.type === "platform") {
    ensurePlatformTiles(entity);
    ensurePlatformTileMap(entity);
    return `
      <label class="wide">Platform tile size<input data-nested="tileSize" type="number" min="4" max="64" value="${entity.props.tileSize || 16}"></label>
      ${platformTextureMapFields(entity)}
    `;
  }
  if (entity.type === "mob") {
    return `
      <label>AI<select data-nested="ai">
        ${option("patrol", "Patrol", entity.props.ai)}
        ${option("chase", "Chase player", entity.props.ai)}
        ${option("idle", "Idle", entity.props.ai)}
      </select></label>
      <label>Speed<input data-nested="speed" type="number" value="${entity.props.speed || 80}"></label>
      <label>Range<input data-nested="range" type="number" value="${entity.props.range || 160}"></label>
      <label>Damage<input data-nested="damage" type="number" min="0" value="${entity.props.damage || 1}"></label>
    `;
  }
  if (entity.type === "trap" || entity.type === "lava") {
    return `<label>Damage<input data-nested="damage" type="number" min="0" value="${entity.props.damage || 1}"></label>`;
  }
  if (entity.type === "powerup") {
    return `
      <label class="wide">Effect<select data-nested="effect">${POWERUP_EFFECTS.map(([value, label]) => option(value, label, entity.props.effect)).join("")}</select></label>
      <label>Duration<input data-nested="duration" type="number" min="1" value="${entity.props.duration || 6}"></label>
      <label>Custom value<input data-nested="customValue" type="number" value="${entity.props.customValue || 1}"></label>
      <label class="wide">Custom function<select data-nested="customAction">${ACTIONS.map(([value, label]) => option(value, label, entity.props.customAction)).join("")}</select></label>
    `;
  }
  if (entity.type === "door") {
    return `
      <label class="wide">Starts<select data-nested="open">
        ${option("false", "Closed", String(Boolean(entity.props.open)))}
        ${option("true", "Open", String(Boolean(entity.props.open)))}
      </select></label>
    `;
  }
  if (entity.type === "portal") {
    return `
      <label class="wide">Activation<select data-nested="alwaysActive">
        ${option("true", "Always active", String(Boolean(entity.props.alwaysActive)))}
        ${option("false", "Activatable by trigger or keybind", String(Boolean(entity.props.alwaysActive)))}
      </select></label>
      <label class="wide">Currently active<select data-nested="active">
        ${option("false", "Off", String(Boolean(entity.props.active)))}
        ${option("true", "On", String(Boolean(entity.props.active)))}
      </select></label>
      <label class="wide">Linked portal<select data-nested="linkedPortalId">${portalOptions(entity)}</select></label>
      <label>Cooldown<input data-nested="cooldown" type="number" min="0.1" step="0.05" value="${entity.props.cooldown || 0.65}"></label>
    `;
  }
  if (entity.type === "trigger") {
    return `
      <label class="wide">Target<select data-nested="targetId">${entityOptions(entity.props.targetId || firstDoorId() || firstPlayerId())}</select></label>
      <label class="wide">Function<select data-nested="action">${ACTIONS.map(([value, label]) => option(value, label, entity.props.action)).join("")}</select></label>
      <label>Value<input data-nested="value" type="number" value="${entity.props.value || 1}"></label>
      <label>Runs<select data-nested="once">
        ${option("false", "Every touch", String(Boolean(entity.props.once)))}
        ${option("true", "Only once", String(Boolean(entity.props.once)))}
      </select></label>
    `;
  }
  if (entity.type === "sprite") {
    return `
      <label class="wide">Gravity<select data-nested="gravity">
        ${option("false", "No gravity", String(Boolean(entity.props.gravity)))}
        ${option("true", "Uses gravity in play mode", String(Boolean(entity.props.gravity)))}
      </select></label>
    `;
  }
  return "";
}

function animationFields(entity) {
  ensureAnimations(entity);
  return `
    <label class="wide">Action animations<select disabled><option>Pick animations per action below</option></select></label>
    ${ANIMATION_SLOTS.map(([slot, label]) => `
      <label>${label}<select data-animation-slot="${slot}">${assetSelectOptions(entity.animations[slot], "Use default")}</select></label>
    `).join("")}
  `;
}

function assetSelectOptions(selectedValue, emptyLabel) {
  return [`<option value="">${emptyLabel}</option>`]
    .concat(project.assets.map((asset) => `<option value="${asset.id}"${asset.id === selectedValue ? " selected" : ""}>${escapeHtml(asset.name)}</option>`))
    .join("");
}

function renderLogicBuilder() {
  const selected = primarySelectedEntity();
  const targetId = selected ? selected.id : firstPlayerId();
  els.logicBuilder.innerHTML = `
    <label>Key<input id="logicKey" value="KeyE" autocomplete="off"></label>
    <label>When<select id="logicEvent">
      <option value="down">while held</option>
      <option value="press">on press</option>
      <option value="up">on release</option>
    </select></label>
    <label>Thing<select id="logicTarget">${entityOptions(targetId)}</select></label>
    <label>Function<select id="logicAction">${ACTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
    <label>Value<input id="logicValue" type="number" value="1"></label>
    <button id="addLogicBtn" class="primary">Add keybind</button>
  `;
  document.getElementById("logicKey").addEventListener("keydown", (event) => {
    event.preventDefault();
    document.getElementById("logicKey").value = event.code;
  });
  document.getElementById("addLogicBtn").addEventListener("click", () => {
    const key = document.getElementById("logicKey").value.trim();
    const eventType = document.getElementById("logicEvent").value;
    const logicTarget = document.getElementById("logicTarget").value;
    const action = document.getElementById("logicAction").value;
    const value = Number(document.getElementById("logicValue").value || 1);
    if (!key || !logicTarget) {
      setStatus("Pick a key and a thing before adding logic.");
      return;
    }
    pushHistory();
    project.logic.push(logicTemplate(key, eventType, logicTarget, action, value));
    renderLogicList();
    setStatus(`Added ${key} -> ${labelForAction(action)}.`);
  });
}

function renderLogicList() {
  els.logicList.innerHTML = "";
  if (project.logic.length === 0) {
    els.logicList.innerHTML = '<p class="hint">No keybinds yet.</p>';
    return;
  }
  for (const logic of project.logic) {
    const target = project.entities.find((entity) => entity.id === logic.targetId);
    const card = document.createElement("div");
    card.className = "logic-card";
    card.innerHTML = `
      <div>
        <p class="card-title">${escapeHtml(logic.key)} ${logic.event === "down" ? "held" : logic.event}</p>
        <p class="card-meta">${escapeHtml(target ? target.name : "Missing thing")} -> ${escapeHtml(labelForAction(logic.action))} (${logic.value})</p>
      </div>
      <button class="danger" data-remove-logic="${logic.id}">Remove</button>
    `;
    els.logicList.appendChild(card);
  }
  els.logicList.querySelectorAll("[data-remove-logic]").forEach((button) => {
    button.addEventListener("click", () => {
      pushHistory();
      project.logic = project.logic.filter((logic) => logic.id !== button.dataset.removeLogic);
      renderLogicList();
    });
  });
}

function renderWorldPanel() {
  const activeType = GLOBAL_TEXTURE_TYPES.some(([type]) => type === selectedGlobalTextureType) ? selectedGlobalTextureType : "platform";
  selectedGlobalTextureType = activeType;
  const defaults = textureDefaultForType(activeType);
  const settings = gameSettings();
  els.worldPanel.innerHTML = `
    <div class="form-grid">
      <label>Width<input data-world="width" type="number" value="${project.world.width}"></label>
      <label>Height<input data-world="height" type="number" value="${project.world.height}"></label>
      <label>Gravity<input data-world="gravity" type="number" value="${project.world.gravity}"></label>
      <label>Background<input data-world="background" type="color" value="${project.world.background}"></label>
      <label class="wide">Imported sprite pixel limit<input data-world="importPixelLimit" type="number" min="8" max="128" value="${project.world.importPixelLimit || DEFAULT_IMPORT_PIXEL_LIMIT}"></label>
      <label class="wide">Snap to grid<select data-world="snap">
        ${option("true", "On", String(Boolean(project.world.snap)))}
        ${option("false", "Off", String(Boolean(project.world.snap)))}
      </select></label>
    </div>
    <p class="hint">Imported pictures are shrunk to this max pixel size and then drawn without smoothing for an 8-bit look.</p>
    <div class="panel-subsection">
      <p class="platform-map-title">Global textures</p>
      <div class="form-grid">
        <label class="wide">Object type<select id="globalTextureTypeSelect">${globalTextureTypeOptions(activeType)}</select></label>
        <label class="wide">${activeType === "platform" ? "Default middle fallback sprite" : "Default sprite or animation"}<select data-global-texture="assetId">${assetSelectOptions(defaults.assetId, "No project default")}</select></label>
      </div>
      <p class="hint">Things with no local texture use this project default. A local texture still overrides it. Use Built-in only on a selected thing to ignore the project default.</p>
      ${activeType === "platform" ? globalPlatformTextureMapFields(defaults.platformTileMap) : ""}
    </div>
    ${gameSettingsFields(settings)}
    <div class="tiny-row">
      <button id="newProjectBtn" class="danger">New template</button>
    </div>
  `;
  els.worldPanel.querySelectorAll("[data-world]").forEach((input) => {
    input.addEventListener("input", () => updateWorldField(input.dataset.world, input.value));
    input.addEventListener("change", () => updateWorldField(input.dataset.world, input.value));
  });
  els.worldPanel.querySelectorAll("[data-game]").forEach((input) => {
    input.addEventListener("input", () => updateGameSettingField(input.dataset.game, input.value));
    input.addEventListener("change", () => updateGameSettingField(input.dataset.game, input.value));
  });
  const globalTypeSelect = document.getElementById("globalTextureTypeSelect");
  if (globalTypeSelect) {
    globalTypeSelect.addEventListener("change", () => {
      selectedGlobalTextureType = globalTypeSelect.value;
      renderWorldPanel();
    });
  }
  els.worldPanel.querySelectorAll("[data-global-texture]").forEach((input) => {
    input.addEventListener("input", () => updateGlobalTextureField(activeType, input.dataset.globalTexture, input.value));
    input.addEventListener("change", () => updateGlobalTextureField(activeType, input.dataset.globalTexture, input.value));
  });
  els.worldPanel.querySelectorAll("[data-global-platform-atlas]").forEach((input) => {
    input.addEventListener("input", () => updateGlobalPlatformTileMapField(activeType, input.dataset.globalPlatformAtlas, input.value));
    input.addEventListener("change", () => updateGlobalPlatformTileMapField(activeType, input.dataset.globalPlatformAtlas, input.value));
  });
  els.worldPanel.querySelectorAll("[data-global-platform-slot-target]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedGlobalPlatformTileSlot = button.dataset.globalPlatformSlotTarget;
      renderWorldPanel();
    });
  });
  const clearGlobalTileButton = document.getElementById("clearGlobalPlatformTileSlotBtn");
  if (clearGlobalTileButton && activeType === "platform") {
    clearGlobalTileButton.addEventListener("click", () => clearGlobalPlatformTileMapSlot(activeType, selectedGlobalPlatformTileSlot));
  }
  const autoFillGlobalTileButton = document.getElementById("autofillGlobalPlatformTileMapBtn");
  if (autoFillGlobalTileButton && activeType === "platform") {
    autoFillGlobalTileButton.addEventListener("click", () => autoFillGlobalPlatformTileMap(activeType));
  }
  if (activeType === "platform") {
    renderGlobalPlatformTileAtlasPicker();
  }
  document.getElementById("newProjectBtn").addEventListener("click", () => {
    pushHistory();
    project = createDefaultProject();
    clearSelection();
    selectedAssetId = null;
    selectedGlobalTextureType = "platform";
    selectedGlobalPlatformTileSlot = "center";
    stopPlay();
    mode = "edit";
    camera = { x: -40, y: -40, zoom: 1 };
    renderAllPanels();
    syncModeButtons();
    setStatus("New template created.");
  });
}

function option(value, label, selectedValue) {
  return `<option value="${value}"${String(selectedValue) === String(value) ? " selected" : ""}>${label}</option>`;
}

function entityOptions(selectedValue) {
  return project.entities.map((entity) => `<option value="${entity.id}"${entity.id === selectedValue ? " selected" : ""}>${escapeHtml(entity.name)} (${TYPE_LABELS[entity.type]})</option>`).join("");
}

function soundOptions(selectedValue) {
  const sounds = project.sounds || [];
  return ['<option value="">No sound</option>']
    .concat(sounds.map((sound) => `<option value="${sound.id}"${sound.id === selectedValue ? " selected" : ""}>${escapeHtml(sound.name)}</option>`))
    .join("");
}

function portalOptions(currentPortal) {
  return ['<option value="">Unlinked</option>']
    .concat(project.entities
      .filter((entity) => entity.type === "portal" && entity.id !== currentPortal.id)
      .map((portal) => `<option value="${portal.id}"${portal.id === currentPortal.props.linkedPortalId ? " selected" : ""}>${escapeHtml(portal.name)} (${Math.round(portal.x)}, ${Math.round(portal.y)})</option>`))
    .join("");
}

function firstDoorId() {
  const door = project.entities.find((entity) => entity.type === "door");
  return door ? door.id : "";
}

function autoLinkPortal(portal) {
  const waitingPortal = project.entities.find((entity) =>
    entity.type === "portal" &&
    entity.id !== portal.id &&
    (!entity.props.linkedPortalId || !project.entities.some((target) => target.id === entity.props.linkedPortalId))
  );
  if (!waitingPortal) {
    return;
  }
  portal.props.linkedPortalId = waitingPortal.id;
  waitingPortal.props.linkedPortalId = portal.id;
  setStatus(`Linked ${waitingPortal.name} and ${portal.name}.`);
}

function linkPortalPair(portal, targetId) {
  for (const entity of project.entities) {
    if (entity.type === "portal" && entity.id !== portal.id && entity.props.linkedPortalId === portal.id) {
      entity.props.linkedPortalId = "";
    }
  }
  if (!targetId) {
    portal.props.linkedPortalId = "";
    return;
  }
  const target = project.entities.find((entity) => entity.type === "portal" && entity.id === targetId);
  if (!target) {
    portal.props.linkedPortalId = "";
    return;
  }
  portal.props.linkedPortalId = target.id;
  target.props.linkedPortalId = portal.id;
}

function updateEntityField(id, field, value) {
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  if (value === "true" || value === "false") {
    entity[field] = value === "true";
  } else if (["x", "y", "w", "h"].includes(field)) {
    entity[field] = Number(value) || 0;
  } else {
    entity[field] = value;
  }
  if (field === "assetId") {
    selectedAssetId = value;
    renderAssetList();
  }
  renderStageToolbar();
  renderSceneList();
}

function updateEntityNestedField(id, field, value) {
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  if (value === "true" || value === "false") {
    entity.props[field] = value === "true";
  } else if (field === "tileSize") {
    entity.props[field] = clamp(Math.round(Number(value) || 16), 4, 64);
  } else if (!Number.isNaN(Number(value)) && value !== "") {
    entity.props[field] = Number(value);
  } else {
    entity.props[field] = value;
  }
  if (field === "soundId") {
    selectedSoundId = value;
    renderSoundList();
  } else if (field === "linkedPortalId" && entity.type === "portal") {
    linkPortalPair(entity, value);
  }
  renderSceneList();
}

function updateEntityAnimationField(id, slot, value) {
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  ensureAnimations(entity);
  entity.animations[slot] = value;
}

function updatePlatformTileField(id, slot, value) {
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  ensurePlatformTiles(entity);
  entity.platformTiles[slot] = value;
}

function updatePlatformTileMapField(id, field, value) {
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  const tileMap = ensurePlatformTileMap(entity);
  if (field === "assetId") {
    tileMap.assetId = value;
  } else if (field === "columns" || field === "rows") {
    tileMap[field] = clamp(Math.round(Number(value) || tileMap[field] || 3), 1, 16);
    const maxIndex = tileMap.columns * tileMap.rows - 1;
    for (const [slot] of PLATFORM_TILE_SLOTS) {
      tileMap.slots[slot] = clamp(Math.round(Number(tileMap.slots[slot]) || -1), -1, maxIndex);
    }
  }
  renderSelectionPanel();
}

function assignPlatformTileMapSlot(id, slot, cellIndex) {
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  const tileMap = ensurePlatformTileMap(entity);
  tileMap.slots[slot] = clamp(cellIndex, -1, tileMap.columns * tileMap.rows - 1);
  renderSelectionPanel();
}

function clearPlatformTileMapSlot(id, slot) {
  assignPlatformTileMapSlot(id, slot, -1);
}

function autoFillPlatformTileMap(id) {
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  const tileMap = ensurePlatformTileMap(entity);
  if (tileMap.columns < 3 || tileMap.rows < 3) {
    setStatus("Auto-fill needs at least a 3 by 3 texture sheet.");
    return;
  }
  pushHistory();
  tileMap.slots.topLeft = 0;
  tileMap.slots.top = 1;
  tileMap.slots.topRight = 2;
  tileMap.slots.left = tileMap.columns;
  tileMap.slots.center = tileMap.columns + 1;
  tileMap.slots.right = tileMap.columns + 2;
  tileMap.slots.bottomLeft = tileMap.columns * 2;
  tileMap.slots.bottom = tileMap.columns * 2 + 1;
  tileMap.slots.bottomRight = tileMap.columns * 2 + 2;
  renderSelectionPanel();
  setStatus("Filled platform parts from the first 3 by 3 block.");
}

function updateGlobalTextureField(type, field, value) {
  pushHistory();
  const defaults = textureDefaultForType(type);
  defaults[field] = value;
  renderWorldPanel();
}

function updateGlobalPlatformTileMapField(type, field, value) {
  pushHistory();
  const defaults = textureDefaultForType(type);
  defaults.platformTileMap = normalizePlatformTileMap(defaults.platformTileMap);
  const tileMap = defaults.platformTileMap;
  if (field === "assetId") {
    tileMap.assetId = value;
  } else if (field === "columns" || field === "rows") {
    tileMap[field] = clamp(Math.round(Number(value) || tileMap[field] || 3), 1, 16);
    const maxIndex = tileMap.columns * tileMap.rows - 1;
    for (const [slot] of PLATFORM_TILE_SLOTS) {
      tileMap.slots[slot] = clamp(Math.round(Number(tileMap.slots[slot]) || -1), -1, maxIndex);
    }
  }
  renderWorldPanel();
}

function assignGlobalPlatformTileMapSlot(type, slot, cellIndex) {
  pushHistory();
  const defaults = textureDefaultForType(type);
  defaults.platformTileMap = normalizePlatformTileMap(defaults.platformTileMap);
  const tileMap = defaults.platformTileMap;
  tileMap.slots[slot] = clamp(cellIndex, -1, tileMap.columns * tileMap.rows - 1);
  renderWorldPanel();
}

function clearGlobalPlatformTileMapSlot(type, slot) {
  assignGlobalPlatformTileMapSlot(type, slot, -1);
}

function autoFillGlobalPlatformTileMap(type) {
  const defaults = textureDefaultForType(type);
  defaults.platformTileMap = normalizePlatformTileMap(defaults.platformTileMap);
  const tileMap = defaults.platformTileMap;
  if (tileMap.columns < 3 || tileMap.rows < 3) {
    setStatus("Auto-fill needs at least a 3 by 3 texture sheet.");
    return;
  }
  pushHistory();
  tileMap.slots.topLeft = 0;
  tileMap.slots.top = 1;
  tileMap.slots.topRight = 2;
  tileMap.slots.left = tileMap.columns;
  tileMap.slots.center = tileMap.columns + 1;
  tileMap.slots.right = tileMap.columns + 2;
  tileMap.slots.bottomLeft = tileMap.columns * 2;
  tileMap.slots.bottom = tileMap.columns * 2 + 1;
  tileMap.slots.bottomRight = tileMap.columns * 2 + 2;
  renderWorldPanel();
  setStatus("Filled project platform defaults from the first 3 by 3 block.");
}

function platformTileSelection(entity, slot) {
  const tileMap = ensurePlatformTileMap(entity);
  const atlasIndex = tileMap.slots[slot];
  if (tileMap.assetId && atlasIndex >= 0) {
    return {
      assetId: tileMap.assetId,
      index: atlasIndex,
      columns: tileMap.columns,
      rows: tileMap.rows
    };
  }
  const tileId = entity.platformTiles[slot] || (slot === "center" ? entity.assetId : "");
  if (tileId) {
    return { assetId: tileId, index: -1, columns: 1, rows: 1 };
  }
  if (entity.textureFallback !== "builtin") {
    const defaults = textureDefaultForType("platform");
    const defaultTileMap = normalizePlatformTileMap(defaults.platformTileMap);
    const defaultIndex = defaultTileMap.slots[slot];
    if (defaultTileMap.assetId && defaultIndex >= 0) {
      return {
        assetId: defaultTileMap.assetId,
        index: defaultIndex,
        columns: defaultTileMap.columns,
        rows: defaultTileMap.rows
      };
    }
    if (slot === "center" && defaults.assetId) {
      return { assetId: defaults.assetId, index: -1, columns: 1, rows: 1 };
    }
  }
  return null;
}

function renderPlatformTileAtlasPicker(entity) {
  const canvas = document.getElementById("platformTileAtlasCanvas");
  if (!canvas) {
    return;
  }
  const tileMap = ensurePlatformTileMap(entity);
  const image = frameForAsset(tileMap.assetId);
  const ctx = canvas.getContext("2d");
  const drawPlaceholder = () => {
    canvas.width = 240;
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1216";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(231, 242, 243, 0.12)";
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    ctx.fillStyle = "#99adb2";
    ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("Texture sheet preview unavailable.", 16, canvas.height / 2);
  };
  if (!image) {
    drawPlaceholder();
    return;
  }
  const drawAtlas = () => {
    const maxSide = 240;
    const scale = Math.max(1, Math.floor(maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1))) || 1;
    const finalScale = Math.max(0.25, Math.min(scale, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1)));
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * finalScale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * finalScale));
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const cellW = canvas.width / tileMap.columns;
    const cellH = canvas.height / tileMap.rows;
    ctx.strokeStyle = "rgba(231, 242, 243, 0.28)";
    ctx.lineWidth = 1;
    for (let col = 0; col <= tileMap.columns; col += 1) {
      const x = Math.round(col * cellW) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let row = 0; row <= tileMap.rows; row += 1) {
      const y = Math.round(row * cellH) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    for (const [slot, label] of PLATFORM_TILE_SLOTS) {
      const index = tileMap.slots[slot];
      if (index < 0) {
        continue;
      }
      const col = index % tileMap.columns;
      const row = Math.floor(index / tileMap.columns);
      ctx.fillStyle = slot === selectedPlatformTileSlot ? "rgba(68, 218, 197, 0.2)" : "rgba(5, 16, 21, 0.32)";
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      ctx.strokeStyle = slot === selectedPlatformTileSlot ? "#44dac5" : "rgba(231, 242, 243, 0.35)";
      ctx.lineWidth = slot === selectedPlatformTileSlot ? 2 : 1;
      ctx.strokeRect(col * cellW + 1, row * cellH + 1, Math.max(0, cellW - 2), Math.max(0, cellH - 2));
      ctx.fillStyle = "#e7f2f3";
      ctx.font = "11px Segoe UI, sans-serif";
      ctx.fillText(platformTileSlotCode(slot), col * cellW + 4, row * cellH + 14);
    }
    canvas.onclick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const col = clamp(Math.floor(localX / cellW), 0, tileMap.columns - 1);
      const row = clamp(Math.floor(localY / cellH), 0, tileMap.rows - 1);
      assignPlatformTileMapSlot(entity.id, selectedPlatformTileSlot, row * tileMap.columns + col);
    };
  };
  if (image.complete) {
    drawAtlas();
  } else {
    image.onload = drawAtlas;
    image.onerror = drawPlaceholder;
  }
}

function renderGlobalPlatformTileAtlasPicker() {
  const canvas = document.getElementById("globalPlatformTileAtlasCanvas");
  if (!canvas) {
    return;
  }
  const defaults = textureDefaultForType("platform");
  defaults.platformTileMap = normalizePlatformTileMap(defaults.platformTileMap);
  const tileMap = defaults.platformTileMap;
  const image = frameForAsset(tileMap.assetId);
  const ctx = canvas.getContext("2d");
  const drawPlaceholder = () => {
    canvas.width = 240;
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1216";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(231, 242, 243, 0.12)";
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    ctx.fillStyle = "#99adb2";
    ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("Texture sheet preview unavailable.", 16, canvas.height / 2);
  };
  if (!image) {
    drawPlaceholder();
    return;
  }
  const drawAtlas = () => {
    const maxSide = 240;
    const scale = Math.max(1, Math.floor(maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1))) || 1;
    const finalScale = Math.max(0.25, Math.min(scale, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1)));
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * finalScale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * finalScale));
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const cellW = canvas.width / tileMap.columns;
    const cellH = canvas.height / tileMap.rows;
    ctx.strokeStyle = "rgba(231, 242, 243, 0.28)";
    ctx.lineWidth = 1;
    for (let col = 0; col <= tileMap.columns; col += 1) {
      const x = Math.round(col * cellW) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let row = 0; row <= tileMap.rows; row += 1) {
      const y = Math.round(row * cellH) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    for (const [slot] of PLATFORM_TILE_SLOTS) {
      const index = tileMap.slots[slot];
      if (index < 0) {
        continue;
      }
      const col = index % tileMap.columns;
      const row = Math.floor(index / tileMap.columns);
      ctx.fillStyle = slot === selectedGlobalPlatformTileSlot ? "rgba(68, 218, 197, 0.2)" : "rgba(5, 16, 21, 0.32)";
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      ctx.strokeStyle = slot === selectedGlobalPlatformTileSlot ? "#44dac5" : "rgba(231, 242, 243, 0.35)";
      ctx.lineWidth = slot === selectedGlobalPlatformTileSlot ? 2 : 1;
      ctx.strokeRect(col * cellW + 1, row * cellH + 1, Math.max(0, cellW - 2), Math.max(0, cellH - 2));
      ctx.fillStyle = "#e7f2f3";
      ctx.font = "11px Segoe UI, sans-serif";
      ctx.fillText(platformTileSlotCode(slot), col * cellW + 4, row * cellH + 14);
    }
    canvas.onclick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const col = clamp(Math.floor(localX / cellW), 0, tileMap.columns - 1);
      const row = clamp(Math.floor(localY / cellH), 0, tileMap.rows - 1);
      assignGlobalPlatformTileMapSlot("platform", selectedGlobalPlatformTileSlot, row * tileMap.columns + col);
    };
  };
  if (image.complete) {
    drawAtlas();
  } else {
    image.onload = drawAtlas;
    image.onerror = drawPlaceholder;
  }
}

function animationFpsForAsset(asset) {
  return Math.round((1000 / (asset.frameDuration || 140)) * 10) / 10;
}

function updateAssetName(id, value) {
  const asset = project.assets.find((item) => item.id === id);
  if (!asset) {
    return;
  }
  const nextName = value.trim() || asset.name;
  if (nextName === asset.name) {
    renderAssetList();
    return;
  }
  pushHistory();
  asset.name = nextName;
  renderAssetList();
  renderSelectionPanel();
  renderWorldPanel();
}

function updateAssetSpeed(id, value) {
  const asset = project.assets.find((item) => item.id === id);
  if (!asset) {
    return;
  }
  const fps = clamp(Number(value) || animationFpsForAsset(asset), 1, 25);
  const nextFrameDuration = clamp(Math.round(1000 / fps), 40, 1000);
  if (nextFrameDuration === asset.frameDuration) {
    renderAssetList();
    return;
  }
  pushHistory();
  asset.frameDuration = nextFrameDuration;
  renderAssetList();
  setStatus(`${asset.name} now plays at ${animationFpsForAsset(asset)} FPS.`);
}

function updateWorldField(field, value) {
  pushHistory();
  if (value === "true" || value === "false") {
    project.world[field] = value === "true";
  } else if (field === "background") {
    project.world[field] = value;
  } else if (field === "importPixelLimit") {
    project.world[field] = clamp(Math.round(Number(value) || DEFAULT_IMPORT_PIXEL_LIMIT), 8, 128);
  } else {
    project.world[field] = Number(value) || project.world[field];
  }
}

function updateGameSettingField(field, value) {
  pushHistory();
  const settings = gameSettings();
  if ([
    "introSeconds",
    "winMessageSeconds",
    "damageSeconds",
    "shieldBlockedSeconds",
    "checkpointSeconds",
    "respawnSeconds",
    "mobClearedSeconds",
    "invulnerableSeconds"
  ].includes(field)) {
    settings[field] = clamp(Number(value) || 0, 0, 30);
  } else if (field === "deathScorePenalty") {
    settings[field] = clamp(Math.round(Number(value) || 0), 0, 9999);
  } else if (field === "defeatMode") {
    settings[field] = value === "game_over" ? "game_over" : "respawn";
  } else {
    settings[field] = value;
  }
}

function selectedEntity() {
  if (selectedIds.length !== 1) {
    return null;
  }
  return project.entities.find((entity) => entity.id === selectedId) || null;
}

function primarySelectedEntity() {
  return project.entities.find((entity) => entity.id === selectedId) || null;
}

function selectedEntities() {
  const lookup = new Set(selectedIds);
  return project.entities.filter((entity) => lookup.has(entity.id));
}

function isEntitySelected(id) {
  return selectedIds.includes(id);
}

function setSelection(ids, primaryId = ids[0] || null) {
  const uniqueIds = Array.from(new Set((ids || []).filter((id) => project.entities.some((entity) => entity.id === id))));
  selectedIds = uniqueIds;
  selectedId = uniqueIds.length === 0 ? null : (uniqueIds.includes(primaryId) ? primaryId : uniqueIds[0]);
}

function setSingleSelection(id) {
  if (!id) {
    clearSelection();
    return;
  }
  setSelection([id], id);
}

function clearSelection() {
  selectedIds = [];
  selectedId = null;
}

function toggleSelection(id) {
  if (isEntitySelected(id)) {
    const next = selectedIds.filter((value) => value !== id);
    setSelection(next, next[0] || null);
  } else {
    setSelection([...selectedIds, id], id);
  }
}

function editableSelectedEntities() {
  return selectedEntities().filter((entity) => !entity.locked);
}

function selectSceneEntity(id, event) {
  if (mode !== "edit") {
    return;
  }
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    toggleSelection(id);
  } else {
    setSingleSelection(id);
  }
  renderSelectionPanel();
  renderLogicBuilder();
}

function toggleEntityVisible(id) {
  if (mode !== "edit") {
    return;
  }
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  entity.visible = entity.visible === false;
  renderSelectionPanel();
}

function toggleEntityLocked(id) {
  if (mode !== "edit") {
    return;
  }
  const entity = project.entities.find((item) => item.id === id);
  if (!entity) {
    return;
  }
  pushHistory();
  entity.locked = !entity.locked;
  renderSelectionPanel();
}

function toggleSelectedVisibility() {
  if (mode !== "edit") {
    return;
  }
  const selection = selectedEntities();
  if (selection.length === 0) {
    return;
  }
  pushHistory();
  const shouldShow = selection.every((entity) => entity.visible === false);
  for (const entity of selection) {
    entity.visible = shouldShow;
  }
  renderSelectionPanel();
}

function toggleSelectedLock() {
  if (mode !== "edit") {
    return;
  }
  const selection = selectedEntities();
  if (selection.length === 0) {
    return;
  }
  pushHistory();
  const shouldUnlock = selection.every((entity) => entity.locked);
  for (const entity of selection) {
    entity.locked = !shouldUnlock;
  }
  renderSelectionPanel();
}

function moveSelectionToLayerEdge(direction) {
  if (mode !== "edit") {
    return;
  }
  if (selectedIds.length === 0) {
    return;
  }
  const selectionLookup = new Set(selectedIds);
  const selected = project.entities.filter((entity) => selectionLookup.has(entity.id));
  if (selected.length === 0) {
    return;
  }
  pushHistory();
  const unselected = project.entities.filter((entity) => !selectionLookup.has(entity.id));
  project.entities = direction === "front" ? unselected.concat(selected) : selected.concat(unselected);
  renderSelectionPanel();
  setStatus(direction === "front" ? "Moved selection to front." : "Moved selection to back.");
}

function snapshotSelectionForClipboard() {
  const selectionLookup = new Set(selectedIds);
  const entities = project.entities.filter((entity) => selectionLookup.has(entity.id)).map((entity) => deepClone(entity));
  if (entities.length === 0) {
    return null;
  }
  const logic = project.logic.filter((item) => selectionLookup.has(item.targetId)).map((item) => deepClone(item));
  return {
    entities,
    logic
  };
}

function copySelectionToClipboard() {
  if (mode !== "edit") {
    return;
  }
  const snapshot = snapshotSelectionForClipboard();
  if (!snapshot) {
    return;
  }
  clipboardSelection = snapshot;
  clipboardPasteCount = 0;
  renderStageToolbar();
  setStatus(`Copied ${snapshot.entities.length} thing${snapshot.entities.length === 1 ? "" : "s"}.`);
}

function pasteClipboardSelection() {
  if (mode !== "edit") {
    return;
  }
  if (!clipboardSelection || !clipboardSelection.entities || clipboardSelection.entities.length === 0) {
    return;
  }
  pushHistory();
  clipboardPasteCount += 1;
  const offsetX = GRID_SIZE * clipboardPasteCount;
  const offsetY = GRID_SIZE * clipboardPasteCount;
  const idMap = new Map();
  const copies = clipboardSelection.entities.map((source) => {
    const copy = deepClone(source);
    const newId = uid(source.type);
    idMap.set(source.id, newId);
    copy.id = newId;
    copy.name = source.name.includes("Copy") ? source.name : `${source.name} Copy`;
    copy.x += offsetX;
    copy.y += offsetY;
    return copy;
  });
  for (const copy of copies) {
    if (copy.type === "portal" && copy.props && idMap.has(copy.props.linkedPortalId)) {
      copy.props.linkedPortalId = idMap.get(copy.props.linkedPortalId);
    }
    if (copy.type === "trigger" && copy.props && idMap.has(copy.props.targetId)) {
      copy.props.targetId = idMap.get(copy.props.targetId);
    }
  }
  const logicCopies = clipboardSelection.logic.map((item) => ({
    ...deepClone(item),
    id: uid("logic"),
    targetId: idMap.get(item.targetId) || item.targetId
  }));
  project.entities.push(...copies);
  project.logic.push(...logicCopies);
  setSelection(copies.map((entity) => entity.id), copies[0].id);
  renderSelectionPanel();
  renderLogicBuilder();
  renderLogicList();
  setStatus(`Pasted ${copies.length} thing${copies.length === 1 ? "" : "s"}.`);
}

function selectedAsset() {
  return project.assets.find((asset) => asset.id === selectedAssetId) || null;
}

function entityBounds(entities) {
  if (!entities || entities.length === 0) {
    return null;
  }
  const minX = Math.min(...entities.map((entity) => entity.x));
  const minY = Math.min(...entities.map((entity) => entity.y));
  const maxX = Math.max(...entities.map((entity) => entity.x + entity.w));
  const maxY = Math.max(...entities.map((entity) => entity.y + entity.h));
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  };
}

function fitCameraToBounds(bounds, padding = 96) {
  if (!bounds) {
    return;
  }
  const rect = els.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const targetZoom = clamp(
    Math.min(
      rect.width / Math.max(bounds.w + padding * 2, 64),
      rect.height / Math.max(bounds.h + padding * 2, 64)
    ),
    0.45,
    2.5
  );
  camera.zoom = targetZoom;
  camera.x = bounds.x + bounds.w / 2 - rect.width / camera.zoom / 2;
  camera.y = bounds.y + bounds.h / 2 - rect.height / camera.zoom / 2;
}

function fitCameraToWorld() {
  fitCameraToBounds({ x: 0, y: 0, w: project.world.width, h: project.world.height }, 64);
}

function focusCameraOnEntities(ids) {
  const lookup = new Set(ids || []);
  const entities = project.entities.filter((entity) => lookup.has(entity.id));
  const bounds = entityBounds(entities);
  if (!bounds) {
    return;
  }
  fitCameraToBounds(bounds, 96);
}

function focusCameraOnSelection() {
  focusCameraOnEntities(selectedIds);
}

function ensureAnimations(entity) {
  entity.animations = { ...emptyAnimations(), ...(entity.animations || {}) };
  return entity.animations;
}

function normalizePlatformTileMap(value) {
  const next = emptyPlatformTileMap();
  const source = value || {};
  const slotSource = source.slots || {};
  next.assetId = source.assetId || "";
  next.columns = clamp(Math.round(Number(source.columns) || 3), 1, 16);
  next.rows = clamp(Math.round(Number(source.rows) || 3), 1, 16);
  for (const [slot] of PLATFORM_TILE_SLOTS) {
    const slotIndex = Math.round(Number(slotSource[slot]));
    next.slots[slot] = Number.isFinite(slotIndex) ? clamp(slotIndex, -1, next.columns * next.rows - 1) : -1;
  }
  return next;
}

function ensurePlatformTiles(entity) {
  entity.platformTiles = { ...emptyPlatformTiles(), ...(entity.platformTiles || {}) };
  entity.props.tileSize = clamp(Math.round(Number(entity.props.tileSize) || 16), 4, 64);
  return entity.platformTiles;
}

function ensurePlatformTileMap(entity) {
  entity.platformTileMap = normalizePlatformTileMap(entity.platformTileMap);
  return entity.platformTileMap;
}

function ensureTextureDefaults() {
  project.textureDefaults = normalizeTextureDefaults(project.textureDefaults);
  return project.textureDefaults;
}

function textureDefaultForType(type) {
  const defaults = ensureTextureDefaults();
  if (!defaults[type]) {
    defaults[type] = emptyTypeTextureDefault(type);
  }
  if (type === "platform") {
    defaults[type].platformTileMap = normalizePlatformTileMap(defaults[type].platformTileMap);
  }
  defaults[type].assetId = defaults[type].assetId || "";
  return defaults[type];
}

function gameSettings() {
  project.gameplay = normalizeGameSettings(project.gameplay);
  return project.gameplay;
}

function firstPlayerId() {
  const player = project.entities.find((entity) => entity.type === "player");
  return player ? player.id : (project.entities[0] ? project.entities[0].id : "");
}

function duplicateSelected() {
  if (selectedIds.length === 0) {
    return;
  }
  clipboardSelection = snapshotSelectionForClipboard();
  clipboardPasteCount = 0;
  pasteClipboardSelection();
}

function removeSelected() {
  if (selectedIds.length === 0) {
    return;
  }
  const removable = selectedEntities().filter((entity) => !entity.locked);
  if (removable.length === 0) {
    setStatus("Unlock the selection before removing it.");
    return;
  }
  pushHistory();
  const removedIds = new Set(removable.map((entity) => entity.id));
  project.entities = project.entities.filter((entity) => !removedIds.has(entity.id));
  project.logic = project.logic.filter((logic) => !removedIds.has(logic.targetId));
  for (const entity of project.entities) {
    if (entity.type === "portal" && removedIds.has(entity.props.linkedPortalId)) {
      entity.props.linkedPortalId = "";
    }
  }
  clearSelection();
  renderSelectionPanel();
  renderLogicBuilder();
  renderLogicList();
}

function onPointerDown(event) {
  if (activeMenu) {
    return;
  }
  const pos = screenToWorld(event);
  mouse.down = true;
  mouse.pointerId = event.pointerId;
  els.canvas.focus();
  if (els.canvas.setPointerCapture) {
    try {
      els.canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
  }

  if (mode === "play") {
    return;
  }

  if (event.button === 2 && activeTool === "select") {
    mouse.marqueeSelecting = true;
    mouse.marqueeStartX = pos.x;
    mouse.marqueeStartY = pos.y;
    mouse.marqueeCurrentX = pos.x;
    mouse.marqueeCurrentY = pos.y;
    return;
  }

  if (event.button === 1 || event.shiftKey) {
    mouse.panning = true;
    mouse.panStartX = event.clientX;
    mouse.panStartY = event.clientY;
    mouse.cameraStartX = camera.x;
    mouse.cameraStartY = camera.y;
    return;
  }

  if (activeTool === "select") {
    const selected = selectedEntity();
    const resizeHandle = selected ? resizeHandleAt(selected, pos.x, pos.y) : "";
    if (resizeHandle) {
      pushHistory();
      mouse.resizing = true;
      mouse.resizeHandle = resizeHandle;
      mouse.resizeStartX = pos.x;
      mouse.resizeStartY = pos.y;
      mouse.resizeStartRect = { x: selected.x, y: selected.y, w: selected.w, h: selected.h };
      return;
    }

    const hit = findEntityAt(pos.x, pos.y);
    if (hit) {
      if (selectedIds.length > 1 && isEntitySelected(hit.id)) {
        const movableSelection = editableSelectedEntities();
        if (movableSelection.length === 0) {
          setStatus("Unlock the selection before moving it.");
          return;
        }
        pushHistory();
        mouse.dragging = true;
        mouse.draggingGroup = true;
        mouse.dragStartWorldX = pos.x;
        mouse.dragStartWorldY = pos.y;
        mouse.dragSelectionStart = movableSelection.map((entity) => ({
          id: entity.id,
          x: entity.x,
          y: entity.y
        }));
        renderSelectionPanel();
        renderLogicBuilder();
        return;
      }
      setSingleSelection(hit.id);
      if (!hit.locked) {
        pushHistory();
        mouse.dragging = true;
        mouse.draggingGroup = false;
        mouse.dragOffsetX = pos.x - hit.x;
        mouse.dragOffsetY = pos.y - hit.y;
      }
      openPanelSection("selection");
      renderSelectionPanel();
      renderLogicBuilder();
      return;
    }
    clearSelection();
    mouse.panCandidate = true;
    mouse.panStartX = event.clientX;
    mouse.panStartY = event.clientY;
    mouse.cameraStartX = camera.x;
    mouse.cameraStartY = camera.y;
    renderSelectionPanel();
    renderLogicBuilder();
    return;
  }

  if (activeTool === "erase") {
    const hit = findEntityAt(pos.x, pos.y);
    if (hit) {
      setSingleSelection(hit.id);
      removeSelected();
    }
    return;
  }

  const snapped = snapPoint(pos.x, pos.y);
  const entity = entityTemplate(activeTool, snapped.x, snapped.y);
  pushHistory();
  if (activeTool === "sprite" && selectedAssetId) {
    entity.assetId = selectedAssetId;
    const asset = project.assets.find((item) => item.id === selectedAssetId);
    if (asset) {
      entity.name = asset.name;
    }
  } else if (activeTool === "trigger") {
    entity.props.targetId = firstDoorId() || firstPlayerId();
    entity.props.soundId = selectedSoundId;
  } else if (activeTool === "portal") {
    autoLinkPortal(entity);
    entity.props.soundId = selectedSoundId;
  }
  project.entities.push(entity);
  setSingleSelection(entity.id);
  activeTool = "select";
  renderSelectionPanel();
  renderLogicBuilder();
  renderToolGrid();
}

function onPointerMove(event) {
  if (activeMenu) {
    return;
  }
  if (!mouse.down || mode !== "edit") {
    return;
  }
  if (mouse.marqueeSelecting) {
    const pos = screenToWorld(event);
    mouse.marqueeCurrentX = pos.x;
    mouse.marqueeCurrentY = pos.y;
    return;
  }
  if (mouse.panCandidate && !mouse.panning) {
    const dx = event.clientX - mouse.panStartX;
    const dy = event.clientY - mouse.panStartY;
    if (Math.hypot(dx, dy) >= PAN_DRAG_THRESHOLD) {
      mouse.panning = true;
    }
  }
  if (mouse.panning) {
    camera.x = mouse.cameraStartX - (event.clientX - mouse.panStartX) / camera.zoom;
    camera.y = mouse.cameraStartY - (event.clientY - mouse.panStartY) / camera.zoom;
    return;
  }
  if (mouse.resizing) {
    const entity = selectedEntity();
    if (!entity || !mouse.resizeStartRect) {
      return;
    }
    resizeSelectedEntity(entity, screenToWorld(event));
    renderSelectionPanel();
    return;
  }
  if (!mouse.dragging) {
    return;
  }
  const pos = screenToWorld(event);
  if (mouse.draggingGroup) {
    const rawDx = pos.x - mouse.dragStartWorldX;
    const rawDy = pos.y - mouse.dragStartWorldY;
    const dx = project.world.snap ? Math.round(rawDx / GRID_SIZE) * GRID_SIZE : rawDx;
    const dy = project.world.snap ? Math.round(rawDy / GRID_SIZE) * GRID_SIZE : rawDy;
    for (const start of mouse.dragSelectionStart) {
      const entity = project.entities.find((item) => item.id === start.id);
      if (!entity) {
        continue;
      }
      entity.x = start.x + dx;
      entity.y = start.y + dy;
    }
    renderSelectionPanel();
    return;
  }
  const entity = primarySelectedEntity();
  if (!entity) {
    return;
  }
  const next = snapPoint(pos.x - mouse.dragOffsetX, pos.y - mouse.dragOffsetY);
  entity.x = next.x;
  entity.y = next.y;
  renderSelectionPanel();
}

function onPointerUp(event) {
  if (activeMenu) {
    resetMouseState();
    return;
  }
  if (event && mouse.pointerId != null && event.pointerId !== mouse.pointerId) {
    return;
  }
  if (els.canvas.releasePointerCapture && mouse.pointerId != null) {
    try {
      els.canvas.releasePointerCapture(mouse.pointerId);
    } catch (error) {
      void error;
    }
  }
  if (mouse.marqueeSelecting) {
    finalizeMarqueeSelection();
  }
  resetMouseState();
}

function onWheel(event) {
  if (activeMenu) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  camera.zoom = clamp(camera.zoom * zoomFactor, 0.45, 2.5);
}

function onKeyDown(event) {
  if (event.key === "Escape" && tutorialState.open) {
    closeTutorial();
    event.preventDefault();
    return;
  }
  if (tutorialState.open) {
    if (event.key === "ArrowRight" || event.key === "Enter") {
      tutorialNext();
      event.preventDefault();
    } else if (event.key === "ArrowLeft") {
      tutorialPrev();
      event.preventDefault();
    }
    return;
  }
  if (event.key === "Escape" && activeMenu) {
    closeMenu();
    event.preventDefault();
    return;
  }
  if (activeMenu) {
    return;
  }
  if (isTypingTarget(event.target)) {
    return;
  }
  if (mode === "edit") {
    if (event.code.startsWith("Arrow")) {
      editPanKeys.add(event.code);
      event.preventDefault();
    } else if ((event.ctrlKey || event.metaKey) && event.code === "KeyC" && selectedIds.length > 0) {
      copySelectionToClipboard();
      event.preventDefault();
    } else if ((event.ctrlKey || event.metaKey) && event.code === "KeyV") {
      pasteClipboardSelection();
      event.preventDefault();
    } else if ((event.ctrlKey || event.metaKey) && event.code === "KeyD" && selectedIds.length > 0) {
      duplicateSelected();
      event.preventDefault();
    } else if (event.key === "Delete" && selectedIds.length > 0) {
      removeSelected();
      event.preventDefault();
    } else if ((event.ctrlKey || event.metaKey) && event.code === "KeyZ") {
      undo();
      event.preventDefault();
    } else if ((event.ctrlKey || event.metaKey) && (event.code === "KeyY" || (event.shiftKey && event.code === "KeyZ"))) {
      redo();
      event.preventDefault();
    } else if (event.code === "KeyF" && selectedIds.length > 0) {
      focusCameraOnSelection();
      event.preventDefault();
    } else if (event.code === "BracketLeft" && selectedIds.length > 0) {
      moveSelectionToLayerEdge("back");
      event.preventDefault();
    } else if (event.code === "BracketRight" && selectedIds.length > 0) {
      moveSelectionToLayerEdge("front");
      event.preventDefault();
    }
    return;
  }
  if (!playState) {
    return;
  }
  if (event.code === "KeyR" && (playState.won || playState.lost)) {
    startPlay();
    event.preventDefault();
    return;
  }
  pressPlayCode(event.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
}

function onKeyUp(event) {
  if (tutorialState.open) {
    return;
  }
  if (activeMenu) {
    return;
  }
  if (isTypingTarget(event.target)) {
    return;
  }
  if (mode === "edit") {
    if (event.code.startsWith("Arrow")) {
      editPanKeys.delete(event.code);
      event.preventDefault();
    }
    return;
  }
  if (!playState) {
    return;
  }
  releasePlayCode(event.code);
}

function selectionRectFromMouse() {
  const left = Math.min(mouse.marqueeStartX, mouse.marqueeCurrentX);
  const top = Math.min(mouse.marqueeStartY, mouse.marqueeCurrentY);
  const right = Math.max(mouse.marqueeStartX, mouse.marqueeCurrentX);
  const bottom = Math.max(mouse.marqueeStartY, mouse.marqueeCurrentY);
  return {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top
  };
}

function rectIntersectsEntity(rect, entity) {
  return rect.x < entity.x + entity.w &&
    rect.x + rect.w > entity.x &&
    rect.y < entity.y + entity.h &&
    rect.y + rect.h > entity.y;
}

function finalizeMarqueeSelection() {
  const rect = selectionRectFromMouse();
  const minSize = 4 / Math.max(camera.zoom, 0.01);
  const effectiveRect = rect.w < minSize && rect.h < minSize
    ? { x: rect.x - minSize / 2, y: rect.y - minSize / 2, w: minSize, h: minSize }
    : rect;
  const ids = project.entities
    .filter((entity) => entity.visible !== false && !entity.locked && rectIntersectsEntity(effectiveRect, entity))
    .map((entity) => entity.id);
  setSelection(ids);
  renderSelectionPanel();
  renderLogicBuilder();
}

function resetMouseState() {
  mouse.down = false;
  mouse.dragging = false;
  mouse.draggingGroup = false;
  mouse.resizing = false;
  mouse.marqueeSelecting = false;
  mouse.resizeHandle = "";
  mouse.resizeStartRect = null;
  mouse.panning = false;
  mouse.panCandidate = false;
  mouse.dragSelectionStart = [];
  mouse.pointerId = null;
}

function clearTransientInputs() {
  resetMouseState();
  editPanKeys.clear();
  clearMobilePlayInput();
}

function stepEditCamera(dt) {
  if (editPanKeys.size === 0) {
    return;
  }
  const speed = EDIT_PAN_SPEED / Math.max(0.35, camera.zoom);
  if (editPanKeys.has("ArrowLeft")) {
    camera.x += speed * dt;
  }
  if (editPanKeys.has("ArrowRight")) {
    camera.x -= speed * dt;
  }
  if (editPanKeys.has("ArrowUp")) {
    camera.y += speed * dt;
  }
  if (editPanKeys.has("ArrowDown")) {
    camera.y -= speed * dt;
  }
}

function isTypingTarget(target) {
  return target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function screenToWorld(event) {
  const rect = els.canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  return {
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y
  };
}

function snapPoint(x, y) {
  if (!project.world.snap) {
    return { x, y };
  }
  return {
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE
  };
}

function findEntityAt(x, y) {
  for (let index = project.entities.length - 1; index >= 0; index -= 1) {
    const entity = project.entities[index];
    if (entity.visible === false || entity.locked) {
      continue;
    }
    if (x >= entity.x && x <= entity.x + entity.w && y >= entity.y && y <= entity.y + entity.h) {
      return entity;
    }
  }
  return null;
}

function resizeSelectedEntity(entity, pos) {
  const minSize = entity.type === "platform" ? 16 : 8;
  const dx = pos.x - mouse.resizeStartX;
  const dy = pos.y - mouse.resizeStartY;
  const start = mouse.resizeStartRect;
  let nextX = start.x;
  let nextY = start.y;
  let nextW = start.w;
  let nextH = start.h;

  if (mouse.resizeHandle.includes("e")) {
    nextW = start.w + dx;
  }
  if (mouse.resizeHandle.includes("s")) {
    nextH = start.h + dy;
  }
  if (mouse.resizeHandle.includes("w")) {
    nextX = start.x + dx;
    nextW = start.w - dx;
  }
  if (mouse.resizeHandle.includes("n")) {
    nextY = start.y + dy;
    nextH = start.h - dy;
  }

  if (project.world.snap) {
    if (mouse.resizeHandle.includes("w")) {
      const snappedLeft = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
      const right = start.x + start.w;
      nextX = Math.min(snappedLeft, right - minSize);
      nextW = right - nextX;
    } else if (mouse.resizeHandle.includes("e")) {
      const snappedRight = Math.round((nextX + nextW) / GRID_SIZE) * GRID_SIZE;
      nextW = snappedRight - nextX;
    }

    if (mouse.resizeHandle.includes("n")) {
      const snappedTop = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
      const bottom = start.y + start.h;
      nextY = Math.min(snappedTop, bottom - minSize);
      nextH = bottom - nextY;
    } else if (mouse.resizeHandle.includes("s")) {
      const snappedBottom = Math.round((nextY + nextH) / GRID_SIZE) * GRID_SIZE;
      nextH = snappedBottom - nextY;
    }
  }

  if (nextW < minSize) {
    if (mouse.resizeHandle.includes("w")) {
      nextX = start.x + start.w - minSize;
    }
    nextW = minSize;
  }
  if (nextH < minSize) {
    if (mouse.resizeHandle.includes("n")) {
      nextY = start.y + start.h - minSize;
    }
    nextH = minSize;
  }

  entity.x = nextX;
  entity.y = nextY;
  entity.w = nextW;
  entity.h = nextH;
}

function resizeHandleAt(entity, worldX, worldY) {
  const handleSize = handleWorldSize();
  for (const handle of resizeHandles(entity)) {
    if (
      worldX >= handle.x - handleSize / 2 &&
      worldX <= handle.x + handleSize / 2 &&
      worldY >= handle.y - handleSize / 2 &&
      worldY <= handle.y + handleSize / 2
    ) {
      return handle.name;
    }
  }
  return "";
}

function resizeHandles(entity) {
  const midX = entity.x + entity.w / 2;
  const midY = entity.y + entity.h / 2;
  const right = entity.x + entity.w;
  const bottom = entity.y + entity.h;
  return [
    { name: "nw", x: entity.x, y: entity.y },
    { name: "n", x: midX, y: entity.y },
    { name: "ne", x: right, y: entity.y },
    { name: "e", x: right, y: midY },
    { name: "se", x: right, y: bottom },
    { name: "s", x: midX, y: bottom },
    { name: "sw", x: entity.x, y: bottom },
    { name: "w", x: entity.x, y: midY }
  ];
}

function handleWorldSize() {
  return RESIZE_HANDLE_SIZE / camera.zoom;
}

function draw() {
  const ctx = els.ctx;
  const rect = els.canvas.getBoundingClientRect();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = project.world.background;
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  if (project.world.grid && mode === "edit") {
    drawGrid(ctx, rect.width / camera.zoom, rect.height / camera.zoom);
  }

  drawWorldBounds(ctx);
  const entities = mode === "play" && playState ? playState.entities.concat(playState.projectiles) : project.entities;
  for (const entity of entities) {
    const selected = mode === "edit" && isEntitySelected(entity.id);
    const showHandles = selected && selectedIds.length === 1 && entity.id === selectedId;
    drawEntity(ctx, entity, selected, showHandles);
  }
  if (mode === "edit" && mouse.marqueeSelecting) {
    drawMarqueeSelection(ctx);
  }
  ctx.restore();

  if (mode === "play" && playState) {
    drawPlayHud(ctx, rect.width, rect.height);
  }
}

function drawGrid(ctx, width, height) {
  const startX = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE;
  const endX = camera.x + width;
  const endY = camera.y + height;
  ctx.strokeStyle = "rgba(231, 242, 243, 0.08)";
  ctx.lineWidth = 1 / camera.zoom;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += GRID_SIZE) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += GRID_SIZE) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
}

function drawWorldBounds(ctx) {
  ctx.strokeStyle = "rgba(68, 218, 197, 0.55)";
  ctx.lineWidth = 3 / camera.zoom;
  ctx.strokeRect(0, 0, project.world.width, project.world.height);
}

function drawEntity(ctx, entity, selected = false, showHandles = false) {
  if (entity.visible === false || entity.collected || entity.dead) {
    return;
  }
  if (entity.type === "platform") {
    drawPlatformTileMap(ctx, entity);
  } else {
    const state = animationStateForEntity(entity);
    const assetId = animationAssetForEntity(entity, state);
    if (assetId) {
      const transient = isTransientAnimation(entity, state);
      const elapsedMs = transient ? Math.max(0, (playState.time - (entity.animationStartedAt || playState.time)) * 1000) : animationFrame * 1000;
      const image = frameForAsset(assetId, elapsedMs, !transient);
      if (image && image.complete) {
        drawEntityWithEffects(ctx, entity, (targetCtx, drawEntity) => {
          targetCtx.drawImage(image, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h);
        });
      } else {
        drawFallback(ctx, entity);
      }
    } else {
      drawBuiltIn(ctx, entity);
    }
  }

  if (selected) {
    ctx.strokeStyle = "#44dac5";
    ctx.lineWidth = 3 / camera.zoom;
    ctx.strokeRect(entity.x - 3, entity.y - 3, entity.w + 6, entity.h + 6);
    if (showHandles) {
      drawResizeHandles(ctx, entity);
    }
  }
}

function drawMarqueeSelection(ctx) {
  const rect = selectionRectFromMouse();
  ctx.save();
  ctx.strokeStyle = "#44dac5";
  ctx.fillStyle = "rgba(68, 218, 197, 0.12)";
  ctx.lineWidth = 2 / camera.zoom;
  ctx.setLineDash([10 / camera.zoom, 8 / camera.zoom]);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function shouldMirrorFacing(entity) {
  return mode === "play" && entity.type === "player" && (entity.facing || 1) < 0;
}

function playerDamageFlashActive(entity) {
  return Boolean(mode === "play" && playState && entity.type === "player" && entity.damageFlashUntil && entity.damageFlashUntil > playState.time);
}

function ensureEntityEffectSurface() {
  if (!entityEffectCanvas) {
    entityEffectCanvas = document.createElement("canvas");
    entityEffectCtx = entityEffectCanvas.getContext("2d");
  }
  return { canvas: entityEffectCanvas, ctx: entityEffectCtx };
}

function drawFacingAware(ctx, entity, drawContent) {
  if (!shouldMirrorFacing(entity)) {
    drawContent(ctx, entity);
    return;
  }
  ctx.save();
  ctx.translate(entity.x * 2 + entity.w, 0);
  ctx.scale(-1, 1);
  drawContent(ctx, entity);
  ctx.restore();
}

function drawEntityWithEffects(ctx, entity, drawContent) {
  if (!playerDamageFlashActive(entity)) {
    drawFacingAware(ctx, entity, drawContent);
    return;
  }
  const { canvas, ctx: effectCtx } = ensureEntityEffectSurface();
  const width = Math.max(1, Math.ceil(entity.w));
  const height = Math.max(1, Math.ceil(entity.h));
  canvas.width = width;
  canvas.height = height;
  effectCtx.clearRect(0, 0, width, height);
  effectCtx.imageSmoothingEnabled = false;
  drawContent(effectCtx, { ...entity, x: 0, y: 0 });
  effectCtx.save();
  effectCtx.globalCompositeOperation = "source-atop";
  effectCtx.fillStyle = "rgba(255, 68, 68, 0.52)";
  effectCtx.fillRect(0, 0, width, height);
  effectCtx.restore();
  drawFacingAware(ctx, entity, (targetCtx, drawEntity) => {
    targetCtx.drawImage(canvas, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h);
  });
}

function drawPlatformTileMap(ctx, entity) {
  ensurePlatformTiles(entity);
  const tileSize = Math.min(entity.props.tileSize || 16, entity.w / 2, entity.h / 2);
  const left = entity.x;
  const top = entity.y;
  const right = entity.x + entity.w;
  const bottom = entity.y + entity.h;
  const middleW = Math.max(0, entity.w - tileSize * 2);
  const middleH = Math.max(0, entity.h - tileSize * 2);

  drawPlatformTileRegion(ctx, entity, "center", left + tileSize, top + tileSize, middleW, middleH);
  drawPlatformTileRegion(ctx, entity, "top", left + tileSize, top, middleW, tileSize);
  drawPlatformTileRegion(ctx, entity, "bottom", left + tileSize, bottom - tileSize, middleW, tileSize);
  drawPlatformTileRegion(ctx, entity, "left", left, top + tileSize, tileSize, middleH);
  drawPlatformTileRegion(ctx, entity, "right", right - tileSize, top + tileSize, tileSize, middleH);
  drawPlatformTileRegion(ctx, entity, "topLeft", left, top, tileSize, tileSize);
  drawPlatformTileRegion(ctx, entity, "topRight", right - tileSize, top, tileSize, tileSize);
  drawPlatformTileRegion(ctx, entity, "bottomLeft", left, bottom - tileSize, tileSize, tileSize);
  drawPlatformTileRegion(ctx, entity, "bottomRight", right - tileSize, bottom - tileSize, tileSize, tileSize);
}

function drawPlatformTileRegion(ctx, entity, slot, x, y, w, h) {
  if (w <= 0 || h <= 0) {
    return;
  }
  const source = platformTileSource(entity, slot);
  if (source && source.image && source.image.complete) {
    drawTiledImage(ctx, source.image, x, y, w, h, entity.props.tileSize || 16, source);
    return;
  }
  drawDefaultPlatformTile(ctx, entity, slot, x, y, w, h);
}

function platformTileSource(entity, slot) {
  const selection = platformTileSelection(entity, slot);
  if (!selection) {
    return null;
  }
  const image = frameForAsset(selection.assetId);
  if (!image) {
    return null;
  }
  if (selection.index >= 0) {
    const sourceWidth = (image.naturalWidth || image.width || 1) / selection.columns;
    const sourceHeight = (image.naturalHeight || image.height || 1) / selection.rows;
    return {
      image,
      sx: (selection.index % selection.columns) * sourceWidth,
      sy: Math.floor(selection.index / selection.columns) * sourceHeight,
      sw: sourceWidth,
      sh: sourceHeight
    };
  }
  return {
    image,
    sx: 0,
    sy: 0,
    sw: image.naturalWidth || image.width || 1,
    sh: image.naturalHeight || image.height || 1
  };
}

function drawTiledImage(ctx, image, x, y, w, h, tileSize, source = null) {
  const step = Math.max(1, tileSize);
  for (let tileY = y; tileY < y + h; tileY += step) {
    for (let tileX = x; tileX < x + w; tileX += step) {
      const drawW = Math.min(step, x + w - tileX);
      const drawH = Math.min(step, y + h - tileY);
      if (source) {
        ctx.drawImage(image, source.sx, source.sy, source.sw, source.sh, tileX, tileY, drawW, drawH);
      } else {
        ctx.drawImage(image, tileX, tileY, drawW, drawH);
      }
    }
  }
}

function drawDefaultPlatformTile(ctx, entity, slot, x, y, w, h) {
  const colors = defaultPlatformTileColors(entity, slot);
  drawPixelPattern(ctx, x, y, w, h, Math.max(4, Math.min(8, entity.props.tileSize || 16)), colors);
}

function drawPortal(ctx, entity) {
  const active = portalIsActive(entity);
  const pulse = active ? Math.floor(animationFrame * 8) % 2 : 0;
  drawPixelSprite(ctx, entity, [
    "00111100",
    "01144110",
    "11444411",
    "14422441",
    "14422441",
    "11444411",
    "01144110",
    "00111100"
  ], {
    1: active ? "#d7f7ff" : "#3d5560",
    2: active ? (pulse ? "#b74cff" : "#60b8ff") : "#1c2a31",
    4: active ? entity.color : "#27343c"
  });
}

function portalIsActive(portal) {
  return Boolean(portal.props.alwaysActive || portal.props.active);
}

function defaultPlatformTileColors(entity, slot) {
  if (slot === "top" || slot === "topLeft" || slot === "topRight") {
    return [["#8fd76b", "#7ebd5b"], ["#5f9e47", "#7ebd5b"]];
  }
  if (slot === "bottom" || slot === "bottomLeft" || slot === "bottomRight") {
    return [["#33462d", "#2c3d28"], ["#3f5737", "#33462d"]];
  }
  if (slot === "left" || slot === "right") {
    return [[entity.color, "#49683d"], ["#3c5a31", entity.color]];
  }
  return [[entity.color, "#49683d"], ["#3f5737", "#33462d"]];
}

function drawResizeHandles(ctx, entity) {
  const size = handleWorldSize();
  ctx.save();
  ctx.fillStyle = "#071014";
  ctx.strokeStyle = "#44dac5";
  ctx.lineWidth = 2 / camera.zoom;
  for (const handle of resizeHandles(entity)) {
    ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
    ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
  }
  ctx.restore();
}

function animationAssetForEntity(entity, state = null) {
  ensureAnimations(entity);
  const resolvedState = state || animationStateForEntity(entity);
  if (entity.animations[resolvedState]) {
    return entity.animations[resolvedState];
  }
  if (entity.assetId) {
    return entity.assetId;
  }
  if (entity.textureFallback !== "builtin") {
    return textureDefaultForType(entity.type).assetId || "";
  }
  return "";
}

function animationStateForEntity(entity) {
  if (playState && entity.animationState && entity.animationUntil && entity.animationUntil > playState.time) {
    return entity.animationState;
  }
  if (entity.props && entity.props.active === false) {
    return "inactive";
  }
  if (entity.type === "door") {
    return entity.props.open ? "open" : "closed";
  }
  if (entity.type === "player" || entity.type === "mob" || (entity.type === "sprite" && entity.props.gravity)) {
    if ((entity.vy || 0) < -35) {
      return "jump";
    }
    if ((entity.vy || 0) > 35 && !entity.onGround) {
      return "fall";
    }
    if (Math.abs(entity.vx || 0) > 10) {
      return "walk";
    }
    return "idle";
  }
  if (entity.type === "powerup" || entity.type === "trigger" || entity.type === "checkpoint" || entity.type === "goal" || entity.type === "projectile") {
    return "active";
  }
  return "idle";
}

function isTransientAnimation(entity, state) {
  return Boolean(playState && entity.animationState === state && entity.animationUntil && entity.animationUntil > playState.time);
}

function drawBuiltIn(ctx, entity) {
  drawEntityWithEffects(ctx, entity, (targetCtx, drawEntity) => {
    const active = entity.props ? entity.props.active !== false : true;
    targetCtx.save();
    targetCtx.globalAlpha = active ? 1 : 0.35;
    if (entity.type === "player") {
      drawPixelSprite(targetCtx, drawEntity, [
        "00111100",
        "01111110",
        "01122110",
        "01111110",
        "00111100",
        "03333330",
        "33333333",
        "30333303",
        "00333300",
        "00300300"
      ], {
        1: drawEntity.color,
        2: "#061014",
        3: "#2f7fa4"
      });
    } else if (entity.type === "platform") {
      drawPixelPattern(targetCtx, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h, 8, [
        ["#7ebd5b", "#5f9e47", "#7ebd5b", "#8fd76b"],
        [drawEntity.color, "#49683d", drawEntity.color, "#3c5a31"],
        ["#33462d", "#3f5737", "#33462d", "#2c3d28"]
      ]);
    } else if (entity.type === "mob") {
      drawPixelSprite(targetCtx, drawEntity, [
        "00011000",
        "10111101",
        "11111111",
        "12211221",
        "11111111",
        "01111110",
        "01011010",
        "11000011"
      ], {
        1: drawEntity.color,
        2: "#190504"
      });
    } else if (entity.type === "trap") {
      drawPixelPattern(targetCtx, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h, 8, [
        ["transparent", drawEntity.color, "transparent", drawEntity.color],
        [drawEntity.color, drawEntity.color, drawEntity.color, drawEntity.color],
        ["#28343b", "#202a30", "#28343b", "#202a30"]
      ]);
    } else if (entity.type === "lava") {
      const pulse = 0.5 + Math.sin(animationFrame * 5) * 0.5;
      drawPixelPattern(targetCtx, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h, 10, [
        [pulse > 0.5 ? "#ffb84a" : drawEntity.color, "#ff6a27", "#9e2d16"],
        ["#9e2d16", "#ff6a27", "#5b1c12"],
        ["#5b1c12", "#9e2d16", "#ffb84a"]
      ]);
    } else if (entity.type === "powerup") {
      drawPixelSprite(targetCtx, drawEntity, [
        "00011000",
        "00144100",
        "01444410",
        "14455441",
        "14455441",
        "01444410",
        "00144100",
        "00011000"
      ], {
        1: "#e7f2f3",
        4: drawEntity.color,
        5: "#ffffff"
      });
    } else if (entity.type === "goal") {
      drawPixelSprite(targetCtx, drawEntity, [
        "11000000",
        "11444400",
        "11444440",
        "11444400",
        "11000000",
        "11000000",
        "11000000",
        "11000000",
        "11000000",
        "11000000"
      ], {
        1: "#27343c",
        4: drawEntity.color
      });
    } else if (entity.type === "door") {
      const open = Boolean(drawEntity.props.open);
      drawPixelSprite(targetCtx, drawEntity, [
        "11111111",
        "13333331",
        "13333331",
        "13333331",
        "13333531",
        "13333331",
        "13333331",
        "13333331",
        "11111111"
      ], {
        1: open ? "rgba(68, 218, 197, 0.45)" : "#3a2416",
        3: open ? "rgba(123, 90, 55, 0.22)" : drawEntity.color,
        5: "#ffbf49"
      });
    } else if (entity.type === "portal") {
      drawPortal(targetCtx, drawEntity);
    } else if (entity.type === "trigger") {
      drawPixelPattern(targetCtx, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h, 10, [
        ["rgba(49, 182, 164, 0.18)", "transparent"],
        ["transparent", "rgba(68, 218, 197, 0.32)"]
      ]);
      drawPixelSprite(targetCtx, {
        ...drawEntity,
        x: drawEntity.x + drawEntity.w * 0.34,
        y: drawEntity.y + drawEntity.h * 0.34,
        w: drawEntity.w * 0.32,
        h: drawEntity.h * 0.32
      }, [
        "0110",
        "1111",
        "1111",
        "0110"
      ], {
        1: drawEntity.color
      });
    } else if (entity.type === "checkpoint") {
      drawPixelSprite(targetCtx, drawEntity, [
        "11000000",
        "11444000",
        "11444400",
        "11444000",
        "11000000",
        "11000000",
        "11000000",
        "11000000"
      ], {
        1: "#27343c",
        4: drawEntity.color
      });
    } else if (entity.type === "projectile") {
      drawPixelSprite(targetCtx, drawEntity, [
        "0110",
        "1111",
        "1111",
        "0110"
      ], {
        1: drawEntity.color || "#e7f2f3"
      });
    } else {
      drawFallback(targetCtx, drawEntity);
    }
    targetCtx.restore();
  });
}

function drawFallback(ctx, entity) {
  drawPixelPattern(ctx, entity.x, entity.y, entity.w, entity.h, 8, [
    [entity.color || "#d5e6ef", "#ffffff"],
    ["#8aa1aa", entity.color || "#d5e6ef"]
  ]);
}

function drawPixelSprite(ctx, entity, rows, palette) {
  const rowCount = rows.length;
  const colCount = Math.max(...rows.map((row) => row.length));
  const cellW = entity.w / colCount;
  const cellH = entity.h / rowCount;
  for (let y = 0; y < rowCount; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const key = rows[y][x];
      const color = palette[key];
      if (!color || color === "transparent") {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(entity.x + x * cellW),
        Math.floor(entity.y + y * cellH),
        Math.ceil(cellW),
        Math.ceil(cellH)
      );
    }
  }
}

function drawPixelPattern(ctx, x, y, w, h, pixelSize, rows) {
  const size = Math.max(2, pixelSize);
  const cols = Math.ceil(w / size);
  const rowCount = Math.ceil(h / size);
  for (let row = 0; row < rowCount; row += 1) {
    const patternRow = rows[row % rows.length];
    for (let col = 0; col < cols; col += 1) {
      const color = patternRow[col % patternRow.length];
      if (!color || color === "transparent") {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x + col * size, y + row * size, Math.min(size, w - col * size), Math.min(size, h - row * size));
    }
  }
}

function drawPlayHud(ctx, width, height) {
  const player = runtimePlayer();
  const settings = gameSettings();
  ctx.save();
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "rgba(5, 16, 15, 0.78)";
  ctx.fillRect(18, 18, 330, 92);
  ctx.fillStyle = "#e7f2f3";
  ctx.font = "16px Segoe UI, sans-serif";
  ctx.fillText(project.name, 34, 44);
  ctx.font = "13px Segoe UI, sans-serif";
  const health = player ? player.health : 0;
  ctx.fillText(`${settings.healthLabel}: ${health}   ${settings.scoreLabel}: ${playState.score}`, 34, 68);
  ctx.fillStyle = "#99adb2";
  ctx.fillText(playState.message || settings.hudIdleMessage, 34, 92);
  if (playState.won || playState.lost) {
    ctx.fillStyle = "rgba(5, 16, 15, 0.82)";
    ctx.fillRect(width / 2 - 180, height / 2 - 70, 360, 140);
    ctx.textAlign = "center";
    ctx.fillStyle = playState.won ? "#44dac5" : "#ff9a84";
    ctx.font = "28px Segoe UI, sans-serif";
    ctx.fillText(playState.won ? settings.winTitle : settings.loseTitle, width / 2, height / 2 - 16);
    ctx.fillStyle = "#e7f2f3";
    ctx.font = "14px Segoe UI, sans-serif";
    ctx.fillText(playState.won ? settings.winSubtitle : settings.loseSubtitle, width / 2, height / 2 + 16);
    ctx.textAlign = "start";
  }
  ctx.restore();
}

function stepPlay(dt) {
  playState.time += dt;
  if (playState.won || playState.lost) {
    if (playState.messageUntil && playState.time > playState.messageUntil) {
      playState.messageUntil = 0;
    }
    return;
  }
  expireTimedEffects();
  runLogic();
  applyPendingJumps();
  updateEnemies();
  updatePhysics(dt);
  updateProjectiles(dt);
  handleRuntimeCollisions();
  updatePlayCamera(dt);
  if (playState.messageUntil && playState.time > playState.messageUntil) {
    playState.messageUntil = 0;
  }
}

function expireTimedEffects() {
  for (const entity of playState.entities) {
    if (!entity.effects) {
      continue;
    }
    if (entity.effects.speedUntil && playState.time >= entity.effects.speedUntil) {
      entity.effects.speedBonus = 0;
    }
    if (entity.effects.lowGravity && playState.time >= entity.effects.lowGravity) {
      entity.effects.lowGravity = 0;
    }
    if (entity.effects.shieldUntil && playState.time >= entity.effects.shieldUntil) {
      entity.effects.shieldUntil = 0;
    }
  }
}

function runLogic() {
  for (const logic of project.logic) {
    if (!logic.enabled) {
      continue;
    }
    const shouldRun =
      (logic.event === "down" && playState.keysDown.has(logic.key)) ||
      (logic.event === "press" && playState.justPressed.has(logic.key)) ||
      (logic.event === "up" && playState.justReleased.has(logic.key));
    if (!shouldRun) {
      continue;
    }
    const entity = playState.entities.find((item) => item.id === logic.targetId);
    runAction(entity, logic.action, Number(logic.value || 1));
  }
}

function runAction(entity, action, value = 1) {
  if (action === "reset_level") {
    startPlay();
    return;
  }
  if (!entity || entity.dead || entity.collected) {
    return;
  }
  const speed = (entity.props.speed || 260) + (entity.effects.speedBonus || 0);
  if (action === "move_left") {
    entity.vx = -speed * value;
    entity.facing = -1;
  } else if (action === "move_right") {
    entity.vx = speed * value;
    entity.facing = 1;
  } else if (action === "move_up") {
    entity.vy = -speed * value;
  } else if (action === "move_down") {
    entity.vy = speed * value;
  } else if (action === "jump") {
    jumpEntity(entity);
  } else if (action === "dash_left") {
    entity.vx = -780 * value;
    entity.facing = -1;
    markAnimation(entity, "walk", 0.18);
  } else if (action === "dash_right") {
    entity.vx = 780 * value;
    entity.facing = 1;
    markAnimation(entity, "walk", 0.18);
  } else if (action === "shoot") {
    shoot(entity);
  } else if (action === "toggle_active") {
    entity.props.active = entity.props.active === false;
  } else if (action === "spawn_mob") {
    spawnRuntimeThing("mob", entity.x + entity.w + 20, entity.y);
  } else if (action === "spawn_powerup") {
    spawnRuntimeThing("powerup", entity.x + entity.w + 20, entity.y - 10);
  } else if (action === "apply_powerup") {
    applyPowerup({ props: { effect: "speed", duration: 5 } }, entity);
  } else if (action === "grow") {
    entity.w = clamp(entity.w + 10 * value, 8, 240);
    entity.h = clamp(entity.h + 10 * value, 8, 240);
  } else if (action === "shrink") {
    entity.w = clamp(entity.w - 10 * value, 8, 240);
    entity.h = clamp(entity.h - 10 * value, 8, 240);
  } else if (action === "hide") {
    entity.visible = false;
  } else if (action === "show") {
    entity.visible = true;
  } else if (action === "open_door") {
    entity.props.open = true;
    markAnimation(entity, "open", 0.35);
  } else if (action === "close_door") {
    entity.props.open = false;
    markAnimation(entity, "closed", 0.35);
  } else if (action === "activate_portal") {
    entity.props.active = true;
  } else if (action === "deactivate_portal") {
    entity.props.active = false;
  } else if (action === "toggle_portal") {
    entity.props.active = !entity.props.active;
  } else if (action === "play_sound") {
    playSound(entity.props.soundId || selectedSoundId);
  } else if (action === "teleport_player") {
    const player = runtimePlayer();
    if (player) {
      player.x = entity.x;
      player.y = entity.y - player.h - 4;
      player.vx = 0;
      player.vy = 0;
    }
  }
}

function spawnRuntimeThing(type, x, y) {
  const entity = entityTemplate(type, x, y);
  entity.id = uid(type);
  entity.startX = entity.x;
  entity.startY = entity.y;
  entity.vx = 0;
  entity.vy = 0;
  entity.health = entity.props.health || 1;
  entity.portalCooldownUntil = 0;
  entity.animationState = "";
  entity.animationStartedAt = 0;
  entity.animationUntil = 0;
  entity.effects = {};
  playState.entities.push(entity);
}

function jumpEntity(entity) {
  const jumpPower = entity.props.jump || 650;
  if (entity.pendingJumpAt && entity.pendingJumpAt > playState.time) {
    return;
  }
  if (entity.onGround) {
    const windup = jumpWindupDuration(entity);
    if (windup > 0) {
      markAnimation(entity, "jump_start", windup);
      entity.pendingJumpAt = playState.time + windup;
      entity.pendingJumpPower = jumpPower;
      entity.vy = 0;
      return;
    }
    entity.vy = -jumpPower;
    entity.onGround = false;
    entity.usedDoubleJump = false;
    markAnimation(entity, "jump_start");
  } else if (entity.effects.doubleJump && !entity.usedDoubleJump) {
    entity.vy = -jumpPower * 0.85;
    entity.usedDoubleJump = true;
    markAnimation(entity, "jump_start");
  }
}

function shoot(entity) {
  const dir = entity.facing || 1;
  markAnimation(entity, "attack", 0.28);
  playState.projectiles.push({
    id: uid("projectile"),
    type: "projectile",
    name: "Projectile",
    x: entity.x + entity.w / 2 + dir * entity.w * 0.55,
    y: entity.y + entity.h * 0.42,
    w: 14,
    h: 14,
    color: "#e7f2f3",
    vx: dir * 620,
    vy: 0,
    ownerId: entity.id,
    life: 1.6,
    props: { active: true },
    visible: true
  });
}

function markAnimation(entity, state, duration = null) {
  if (!playState || !entity) {
    return;
  }
  entity.animationState = state;
  entity.animationStartedAt = playState.time;
  entity.animationUntil = playState.time + (duration ?? animationDurationForState(entity, state, 0.2));
}

function animationDurationForState(entity, state, fallbackSeconds) {
  const assetId = animationAssetForEntity(entity, state);
  const asset = project.assets.find((item) => item.id === assetId);
  if (!asset || !asset.frames || asset.frames.length === 0) {
    return fallbackSeconds;
  }
  return Math.max(0.05, (asset.frames.length * (asset.frameDuration || 140)) / 1000);
}

function jumpWindupDuration(entity) {
  if (!entity || entity.type !== "player" || !entity.animations || !entity.animations.jump_start) {
    return 0;
  }
  return animationDurationForState(entity, "jump_start", 0.2);
}

function clearPendingJump(entity) {
  entity.pendingJumpAt = 0;
  entity.pendingJumpPower = 0;
}

function applyPendingJumps() {
  for (const entity of playState.entities) {
    if (!entity.pendingJumpAt || entity.pendingJumpAt > playState.time || entity.dead || entity.collected) {
      continue;
    }
    entity.vy = -(entity.pendingJumpPower || entity.props.jump || 650);
    entity.onGround = false;
    entity.usedDoubleJump = false;
    clearPendingJump(entity);
  }
}

function updateEnemies() {
  const player = runtimePlayer();
  for (const entity of playState.entities) {
    if (entity.type !== "mob" || entity.props.active === false || entity.dead) {
      continue;
    }
    const ai = entity.props.ai || "patrol";
    if (ai === "idle") {
      continue;
    }
    const speed = entity.props.speed || 80;
    if (ai === "chase" && player) {
      const dx = player.x - entity.x;
      if (Math.abs(dx) < (entity.props.range || 220)) {
        entity.vx = Math.sign(dx || 1) * speed;
        entity.facing = Math.sign(dx || 1);
      }
    } else {
      if (!entity.facing) {
        entity.facing = 1;
      }
      entity.vx = entity.facing * speed;
      const origin = entity.startX ?? entity.x;
      if (Math.abs(entity.x - origin) > (entity.props.range || 160)) {
        entity.facing *= -1;
      }
    }
  }
}

function updatePhysics(dt) {
  const platforms = playState.entities.filter((entity) => {
    if (entity.props.active === false || entity.visible === false) {
      return false;
    }
    return entity.type === "platform" || (entity.type === "door" && !entity.props.open);
  });
  for (const entity of playState.entities) {
    if (!usesPhysics(entity)) {
      continue;
    }
    if (entity.pendingJumpAt && entity.pendingJumpAt > playState.time) {
      entity.onGround = true;
      entity.vy = 0;
      entity.vx *= Math.pow(0.0006, dt);
      entity.x += entity.vx * dt;
      resolveAxis(entity, platforms, "x");
      if (entity.y > project.world.height + 220) {
        respawnEntity(entity);
      }
      continue;
    }
    const wasOnGround = entity.onGround;
    entity.onGround = false;
    const gravityScale = entity.effects.lowGravity && entity.effects.lowGravity > playState.time ? 0.45 : 1;
    entity.vy += project.world.gravity * gravityScale * dt;
    const verticalVelocityBeforeMove = entity.vy;
    entity.vx *= Math.pow(0.0006, dt);
    entity.x += entity.vx * dt;
    resolveAxis(entity, platforms, "x");
    entity.y += entity.vy * dt;
    resolveAxis(entity, platforms, "y");

    if (!wasOnGround && entity.onGround && verticalVelocityBeforeMove > 60) {
      markAnimation(entity, "land", 0.18);
    }

    if (entity.y > project.world.height + 220) {
      respawnEntity(entity);
    }
  }
}

function usesPhysics(entity) {
  if (entity.dead || entity.collected || entity.visible === false) {
    return false;
  }
  if (entity.type === "player" || entity.type === "mob") {
    return true;
  }
  return entity.type === "sprite" && Boolean(entity.props.gravity);
}

function resolveAxis(entity, platforms, axis) {
  for (const platform of platforms) {
    if (!aabb(entity, platform)) {
      continue;
    }
    if (axis === "x") {
      if (entity.vx > 0) {
        entity.x = platform.x - entity.w;
      } else if (entity.vx < 0) {
        entity.x = platform.x + platform.w;
      }
      entity.vx = 0;
      if (entity.type === "mob") {
        entity.facing = -(entity.facing || 1);
      }
    } else {
      if (entity.vy > 0) {
        entity.y = platform.y - entity.h;
        entity.onGround = true;
        entity.usedDoubleJump = false;
      } else if (entity.vy < 0) {
        entity.y = platform.y + platform.h;
      }
      entity.vy = 0;
    }
  }
}

function updateProjectiles(dt) {
  const settings = gameSettings();
  const mobs = playState.entities.filter((entity) => entity.type === "mob" && !entity.dead);
  for (const projectile of playState.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    for (const mob of mobs) {
      if (projectile.ownerId !== mob.id && aabb(projectile, mob)) {
        mob.dead = true;
        projectile.life = 0;
        playState.score += 3;
        showPlayMessage(settings.mobClearedMessage, settings.mobClearedSeconds);
      }
    }
  }
  playState.projectiles = playState.projectiles.filter((projectile) => projectile.life > 0);
}

function handleRuntimeCollisions() {
  const settings = gameSettings();
  const player = runtimePlayer();
  if (!player || player.dead) {
    return;
  }
  for (const entity of playState.entities) {
    if (entity === player || entity.dead || entity.collected || entity.visible === false || entity.props.active === false) {
      continue;
    }
    if (!aabb(player, entity)) {
      continue;
    }
    if (entity.type === "mob" || entity.type === "trap" || entity.type === "lava") {
      damagePlayer(entity.props.damage || 1);
    } else if (entity.type === "powerup") {
      playSound(entity.props.soundId);
      applyPowerup(entity, player);
      entity.collected = true;
    } else if (entity.type === "checkpoint") {
      if (playState.lastCheckpointId !== entity.id) {
        player.startX = entity.x;
        player.startY = entity.y - player.h - 6;
        playState.lastCheckpointId = entity.id;
        showPlayMessage(settings.checkpointMessage, settings.checkpointSeconds);
      }
    } else if (entity.type === "trigger") {
      fireTrigger(entity);
    } else if (entity.type === "portal") {
      usePortal(player, entity);
    } else if (entity.type === "goal") {
      playState.won = true;
      showPlayMessage(settings.winMessage, settings.winMessageSeconds);
    }
  }
}

function usePortal(player, portal) {
  if (!portalIsActive(portal)) {
    return;
  }
  if (player.portalCooldownUntil && player.portalCooldownUntil > playState.time) {
    return;
  }
  const target = playState.entities.find((entity) => entity.id === portal.props.linkedPortalId && entity.type === "portal");
  if (!target || !portalIsActive(target)) {
    return;
  }
  player.x = target.x + target.w / 2 - player.w / 2;
  player.y = target.y + target.h / 2 - player.h / 2;
  player.vx = 0;
  player.vy = 0;
  player.portalCooldownUntil = playState.time + Math.max(Number(portal.props.cooldown || 0.65), Number(target.props.cooldown || 0.65), 0.1);
  playSound(portal.props.soundId || target.props.soundId);
  showPlayMessage("Portal jump.", 0.8);
}

function fireTrigger(trigger) {
  if (trigger.fired && trigger.props.once) {
    return;
  }
  const target = playState.entities.find((entity) => entity.id === trigger.props.targetId) || trigger;
  playSound(trigger.props.soundId);
  runAction(target, trigger.props.action || "open_door", Number(trigger.props.value || 1));
  trigger.fired = true;
}

function applyPowerup(powerup, target) {
  const settings = gameSettings();
  const effect = powerup.props.effect || "speed";
  const duration = Number(powerup.props.duration || 6);
  if (effect === "speed") {
    target.effects.speedBonus = 180;
    target.effects.speedUntil = playState.time + duration;
    showPlayMessage(settings.speedBoostMessage, duration);
  } else if (effect === "shield") {
    target.effects.shieldUntil = playState.time + duration;
    showPlayMessage(settings.shieldActiveMessage, duration);
  } else if (effect === "low_gravity") {
    target.effects.lowGravity = playState.time + duration;
    showPlayMessage(settings.lowGravityMessage, duration);
  } else if (effect === "double_jump") {
    target.effects.doubleJump = true;
    showPlayMessage(settings.doubleJumpMessage, 2);
  } else if (effect === "heal") {
    target.health = Math.min((target.props.health || 3), target.health + 1);
    showPlayMessage(settings.healMessage, 1.5);
  } else if (effect === "coin") {
    playState.score += 1;
    showPlayMessage(settings.coinMessage, 1.2);
  } else if (effect === "custom") {
    runAction(target, powerup.props.customAction || "grow", Number(powerup.props.customValue || 1));
    showPlayMessage(settings.customPowerupMessage, 1.8);
  }
}

function damagePlayer(amount) {
  const settings = gameSettings();
  const player = runtimePlayer();
  if (!player) {
    return;
  }
  if (player.effects.shieldUntil && player.effects.shieldUntil > playState.time) {
    showPlayMessage(settings.shieldBlockedMessage, settings.shieldBlockedSeconds);
    return;
  }
  if (player.invulnerableUntil && player.invulnerableUntil > playState.time) {
    return;
  }
  player.health -= amount;
  clearPendingJump(player);
  markAnimation(player, "hurt", 0.55);
  const incomingDirection = Math.sign(player.vx || player.facing || 1) || 1;
  player.vx = -incomingDirection * 360;
  player.vy = -320;
  player.facing = Math.sign(player.vx) || player.facing || 1;
  player.onGround = false;
  player.damageFlashUntil = playState.time + 0.22;
  player.invulnerableUntil = playState.time + settings.invulnerableSeconds;
  showPlayMessage(settings.damageMessage, settings.damageSeconds);
  if (player.health <= 0) {
    playState.score = Math.max(0, playState.score - settings.deathScorePenalty);
    if (settings.defeatMode === "game_over") {
      playState.lost = true;
      player.health = 0;
      showPlayMessage(settings.loseTitle, 999);
      return;
    }
    respawnEntity(player);
    player.health = player.props.health || 3;
    showPlayMessage(settings.respawnMessage, settings.respawnSeconds);
  }
}

function respawnEntity(entity) {
  entity.x = entity.startX ?? entity.x;
  entity.y = entity.startY ?? entity.y;
  entity.vx = 0;
  entity.vy = 0;
  entity.onGround = false;
  entity.damageFlashUntil = 0;
  clearPendingJump(entity);
}

function updatePlayCamera(dt) {
  const player = runtimePlayer();
  if (!player) {
    return;
  }
  const rect = els.canvas.getBoundingClientRect();
  const targetX = player.x + player.w / 2 - rect.width / camera.zoom / 2;
  const targetY = player.y + player.h / 2 - rect.height / camera.zoom / 2;
  camera.x += (targetX - camera.x) * clamp(dt * 5, 0, 1);
  camera.y += (targetY - camera.y) * clamp(dt * 5, 0, 1);
}

function runtimePlayer() {
  if (!playState) {
    return null;
  }
  return playState.entities.find((entity) => entity.type === "player") || null;
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function showPlayMessage(message, seconds) {
  if (!message) {
    playState.message = "";
    playState.messageUntil = 0;
    return;
  }
  playState.message = message;
  playState.messageUntil = playState.time + seconds;
}

function frameForAsset(assetId, elapsedMs = animationFrame * 1000, loop = true) {
  const asset = project.assets.find((item) => item.id === assetId);
  if (!asset) {
    return null;
  }
  const frames = imageCache.get(assetId);
  if (!frames || frames.length === 0) {
    return null;
  }
  const duration = asset.frameDuration || 140;
  const rawIndex = Math.floor(elapsedMs / duration);
  const index = loop ? rawIndex % frames.length : Math.min(frames.length - 1, rawIndex);
  return frames[index];
}

function rebuildImageCache() {
  imageCache.clear();
  for (const asset of project.assets) {
    const images = asset.frames.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    imageCache.set(asset.id, images);
  }
}

function importAssets(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) {
    return;
  }
  pushHistory();
  Promise.all(files.map(readFileAsPixelSprite)).then((frames) => {
    const name = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : `Animation ${project.assets.length + 1}`;
    const asset = {
      id: uid("asset"),
      name,
      type: frames.length === 1 ? "sprite" : "animation",
      frames,
      frameDuration: 140,
      pixelLimit: normalizedImportPixelLimit()
    };
    project.assets.push(asset);
    selectedAssetId = asset.id;
    rebuildImageCache();
    openPanelSection("sprites");
    renderAssetList();
    renderSelectionPanel();
    renderWorldPanel();
    setStatus(`${name} imported.`);
    event.target.value = "";
  });
}

function readFileAsPixelSprite(file) {
  return readFileAsDataUrl(file).then((src) => pixelateImageSource(src, normalizedImportPixelLimit()));
}

function normalizedImportPixelLimit() {
  return clamp(Math.round(Number(project.world.importPixelLimit) || DEFAULT_IMPORT_PIXEL_LIMIT), 8, 128);
}

function pixelateImageSource(src, maxPixels) {
  return loadImage(src).then((image) => {
    const maxSide = Math.max(1, Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const scale = Math.min(1, maxPixels / maxSide);
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, width, height);
    quantizeCanvas(ctx, width, height);
    return canvas.toDataURL("image/png");
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });
}

function quantizeCanvas(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const step = 51;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = Math.round(data[index] / step) * step;
    data[index + 1] = Math.round(data[index + 1] / step) * step;
    data[index + 2] = Math.round(data[index + 2] / step) * step;
  }
  ctx.putImageData(imageData, 0, 0);
}

function importSounds(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) {
    return;
  }
  pushHistory();
  Promise.all(files.map(readFileAsDataUrl)).then((sources) => {
    sources.forEach((src, index) => {
      project.sounds.push({
        id: uid("sound"),
        name: files[index].name.replace(/\.[^.]+$/, ""),
        src
      });
    });
    selectedSoundId = project.sounds[project.sounds.length - 1].id;
    rebuildAudioCache();
    openPanelSection("sounds");
    renderSoundList();
    renderSelectionPanel();
    setStatus(`${files.length} sound${files.length === 1 ? "" : "s"} imported.`);
    event.target.value = "";
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function rebuildAudioCache() {
  audioCache.clear();
  for (const sound of project.sounds || []) {
    const audio = new Audio(sound.src);
    audio.preload = "auto";
    audioCache.set(sound.id, audio);
  }
}

function playSound(soundId) {
  if (!soundId) {
    return;
  }
  const audio = audioCache.get(soundId);
  if (!audio) {
    return;
  }
  const instance = audio.cloneNode();
  instance.volume = 0.8;
  instance.play().catch(() => {
    setStatus("Browser blocked sound until the page receives a click or key press.");
  });
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  setStatus("Saved in this browser.");
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    setStatus("No browser save found.");
    return;
  }
  try {
    pushHistory();
    project = normalizeProject(JSON.parse(raw));
    clearSelection();
    selectedAssetId = null;
    stopPlay();
    mode = "edit";
    renderAllPanels();
    syncModeButtons();
    setStatus("Loaded browser save.");
  } catch (error) {
    setStatus(`Could not load save: ${error.message}`);
  }
}

function exportProject() {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "gamecr-project"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportPlayableHtml() {
  if (typeof window.buildGameCRPlayableHtml !== "function") {
    setStatus("Playable exporter is missing.");
    return;
  }
  try {
    const html = window.buildGameCRPlayableHtml(normalizeProject(deepClone(project)));
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "gamecr-playable"}.html`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Exported standalone playable HTML.");
  } catch (error) {
    setStatus(`Could not export playable HTML: ${error.message}`);
  }
}

function importProject(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      pushHistory();
      project = normalizeProject(JSON.parse(reader.result));
      clearSelection();
      selectedAssetId = null;
      selectedGlobalTextureType = "platform";
      selectedGlobalPlatformTileSlot = "center";
      stopPlay();
      mode = "edit";
      renderAllPanels();
      syncModeButtons();
      setStatus(`${project.name} imported.`);
    } catch (error) {
      setStatus(`Could not import project: ${error.message}`);
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function normalizeProject(input) {
  const next = createDefaultProject();
  const source = input || {};
  const merged = {
    ...next,
    ...source,
    world: { ...next.world, ...(source.world || {}) },
    textureDefaults: normalizeTextureDefaults(source.textureDefaults),
    gameplay: normalizeGameSettings(source.gameplay),
    assets: Array.isArray(source.assets) ? source.assets : [],
    sounds: Array.isArray(source.sounds) ? source.sounds : [],
    entities: Array.isArray(source.entities) ? source.entities : next.entities,
    logic: Array.isArray(source.logic) ? source.logic : next.logic
  };
  merged.assets = merged.assets.map((asset) => ({
    id: asset.id || uid("asset"),
    name: asset.name || "Asset",
    type: asset.type || (Array.isArray(asset.frames) && asset.frames.length > 1 ? "animation" : "sprite"),
    frames: Array.isArray(asset.frames) ? asset.frames.filter(Boolean) : [],
    frameDuration: clamp(Math.round(Number(asset.frameDuration) || 140), 40, 1000),
    pixelLimit: clamp(Math.round(Number(asset.pixelLimit) || merged.world.importPixelLimit || DEFAULT_IMPORT_PIXEL_LIMIT), 8, 128)
  }));
  merged.entities = merged.entities.map((entity) => ({
    ...entityTemplate(entity.type || "sprite", entity.x || 0, entity.y || 0, entity.id || uid(entity.type || "sprite")),
    ...entity,
    props: { ...(entityTemplate(entity.type || "sprite", 0, 0).props || {}), ...(entity.props || {}) }
  }));
    merged.entities = merged.entities.map((entity) => ({
      ...entity,
      textureFallback: entity.textureFallback === "builtin" ? "builtin" : "global",
      locked: Boolean(entity.locked),
      animations: { ...emptyAnimations(), ...(entity.animations || {}) },
      platformTiles: entity.type === "platform" ? { ...emptyPlatformTiles(), ...(entity.platformTiles || {}) } : entity.platformTiles,
      platformTileMap: entity.type === "platform" ? normalizePlatformTileMap(entity.platformTileMap) : entity.platformTileMap
    }));
  for (const entity of merged.entities) {
    if (entity.type === "portal") {
      entity.props = {
        active: false,
        alwaysActive: true,
        linkedPortalId: "",
        cooldown: 0.65,
        soundId: "",
        ...(entity.props || {})
      };
    }
  }
  return merged;
}

function setStatus(message) {
  els.statusLine.textContent = message;
}

function labelForAction(action) {
  const found = ACTIONS.find(([value]) => value === action);
  return found ? found[1] : action;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

init();
