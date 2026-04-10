(function (global) {
  "use strict";

  const PLAYABLE_EXPORT_CSS = `
    :root {
      color-scheme: dark;
      font-family: "Segoe UI", Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #081015;
      color: #e7f2f3;
    }

    body {
      position: relative;
    }

    #game {
      display: block;
      width: 100vw;
      height: 100vh;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      cursor: crosshair;
      outline: none;
    }

    .hud {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }

    .hud-panel {
      position: absolute;
      left: 18px;
      top: 18px;
      min-width: 280px;
      padding: 12px 14px;
      border: 1px solid rgba(231, 242, 243, 0.14);
      background: rgba(5, 16, 21, 0.76);
      backdrop-filter: blur(4px);
    }

    .hud-title {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 700;
    }

    .hud-line,
    .hud-hint {
      margin: 0;
      font-size: 13px;
      line-height: 1.4;
      color: #c9d8dc;
    }

    .hud-hint {
      position: absolute;
      left: 18px;
      bottom: 18px;
      max-width: 560px;
      padding: 10px 12px;
      border: 1px solid rgba(231, 242, 243, 0.12);
      background: rgba(5, 16, 21, 0.68);
    }

    .outcome-panel {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      min-width: 320px;
      padding: 20px 24px;
      text-align: center;
      border: 1px solid rgba(68, 218, 197, 0.28);
      background: rgba(5, 16, 21, 0.86);
      opacity: 0;
      transition: opacity 120ms ease;
    }

    body[data-outcome="won"] .outcome-panel,
    body[data-outcome="lost"] .outcome-panel {
      opacity: 1;
    }

    .outcome-panel h2 {
      margin: 0 0 8px;
      font-size: 28px;
      color: #44dac5;
    }

    body[data-outcome="lost"] .outcome-panel h2 {
      color: #ff9a84;
    }

    .outcome-panel p {
      margin: 0;
      color: #dce8ea;
      font-size: 14px;
    }

    .mobile-play-controls {
      display: none;
    }

    .mobile-move-wheel,
    .mobile-attack-button {
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    @media (hover: none), (pointer: coarse) {
      .mobile-play-controls {
        position: fixed;
        z-index: 4;
        inset: 0;
        display: block;
        pointer-events: none;
      }

      .mobile-move-wheel {
        position: absolute;
        left: max(18px, env(safe-area-inset-left));
        bottom: max(26px, env(safe-area-inset-bottom));
        width: 118px;
        height: 118px;
        border: 2px solid rgba(231, 242, 243, 0.22);
        border-radius: 50%;
        background:
          linear-gradient(rgba(231, 242, 243, 0.08), rgba(231, 242, 243, 0.02)),
          rgba(13, 23, 28, 0.62);
        box-shadow:
          inset 0 0 0 8px rgba(5, 16, 21, 0.34),
          0 10px 28px rgba(0, 0, 0, 0.32);
        pointer-events: auto;
      }

      .mobile-wheel-cross::before,
      .mobile-wheel-cross::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        width: 70px;
        height: 18px;
        border-radius: 999px;
        background: rgba(231, 242, 243, 0.08);
        transform: translate(-50%, -50%);
      }

      .mobile-wheel-cross::after {
        width: 18px;
        height: 70px;
      }

      .mobile-move-knob {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 42px;
        height: 42px;
        border: 2px solid rgba(68, 218, 197, 0.8);
        border-radius: 50%;
        background: rgba(49, 182, 164, 0.72);
        box-shadow:
          inset 0 0 0 6px rgba(5, 16, 21, 0.22),
          0 4px 14px rgba(0, 0, 0, 0.3);
        transform: translate(-50%, -50%);
      }

      .mobile-move-wheel.active .mobile-move-knob {
        background: rgba(68, 218, 197, 0.92);
      }

      .mobile-attack-button {
        position: absolute;
        right: max(22px, env(safe-area-inset-right));
        bottom: max(36px, env(safe-area-inset-bottom));
        width: 78px;
        height: 78px;
        padding: 0;
        border: 2px solid rgba(255, 184, 74, 0.72);
        border-radius: 50%;
        background:
          radial-gradient(circle at 38% 30%, rgba(255, 224, 143, 0.86), rgba(255, 139, 50, 0.8) 46%, rgba(77, 31, 18, 0.82) 100%);
        color: #170803;
        font-size: 15px;
        font-weight: 900;
        letter-spacing: 0.06em;
        box-shadow:
          inset 0 -8px 0 rgba(77, 31, 18, 0.35),
          0 10px 28px rgba(0, 0, 0, 0.35);
        pointer-events: auto;
      }

      .mobile-attack-button.active {
        transform: translateY(3px) scale(0.96);
        box-shadow:
          inset 0 -3px 0 rgba(77, 31, 18, 0.45),
          0 6px 18px rgba(0, 0, 0, 0.28);
      }
    }
  `;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeJson(value) {
    return JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function buildGameCRPlayableHtml(project) {
    const payload = safeJson(project || {});
    const title = escapeHtml((project && project.name) || "gameCR Playable");
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>${PLAYABLE_EXPORT_CSS}</style>
  </head>
  <body>
    <canvas id="game" width="1280" height="720" tabindex="0" aria-label="Playable exported game"></canvas>
    <div class="hud">
      <div class="hud-panel">
        <p id="hudTitle" class="hud-title"></p>
        <p id="hudStats" class="hud-line"></p>
        <p id="hudMessage" class="hud-line"></p>
      </div>
      <p id="hudHint" class="hud-hint"></p>
      <div class="outcome-panel">
        <h2 id="outcomeTitle"></h2>
        <p id="outcomeSubtitle"></p>
      </div>
    </div>
    <div id="mobilePlayControls" class="mobile-play-controls" aria-label="Mobile play controls">
      <div id="mobileMoveWheel" class="mobile-move-wheel" role="application" aria-label="Movement wheel">
        <span class="mobile-wheel-cross" aria-hidden="true"></span>
        <span id="mobileMoveKnob" class="mobile-move-knob" aria-hidden="true"></span>
      </div>
      <button id="mobileAttackBtn" class="mobile-attack-button" type="button" aria-label="Attack">ATK</button>
    </div>
    <script>(${playableBootstrap.toString()})(${payload});</script>
  </body>
</html>`;
  }

  function playableBootstrap(rawProject) {
    const ANIMATION_SLOTS = [
      "idle",
      "walk",
      "jump_start",
      "jump",
      "land",
      "fall",
      "attack",
      "hurt",
      "active",
      "inactive",
      "open",
      "closed"
    ];
    const PLATFORM_TILE_SLOTS = [
      "center",
      "top",
      "bottom",
      "left",
      "right",
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight"
    ];
    const GLOBAL_TEXTURE_TYPES = [
      "player",
      "platform",
      "sprite",
      "mob",
      "trap",
      "lava",
      "powerup",
      "door",
      "portal",
      "trigger",
      "checkpoint",
      "goal"
    ];
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const hudTitle = document.getElementById("hudTitle");
    const hudStats = document.getElementById("hudStats");
    const hudMessage = document.getElementById("hudMessage");
    const hudHint = document.getElementById("hudHint");
    const outcomeTitle = document.getElementById("outcomeTitle");
    const outcomeSubtitle = document.getElementById("outcomeSubtitle");
    const mobileMoveWheel = document.getElementById("mobileMoveWheel");
    const mobileMoveKnob = document.getElementById("mobileMoveKnob");
    const mobileAttackBtn = document.getElementById("mobileAttackBtn");
    const imageCache = new Map();
    const audioCache = new Map();
    const entityEffectCanvas = document.createElement("canvas");
    const entityEffectCtx = entityEffectCanvas.getContext("2d");
    const keysDown = new Set();
    const justPressed = new Set();
    const justReleased = new Set();
    const camera = { x: 0, y: 0 };
    let project = normalizeProject(rawProject || {});
    let playState = null;
    let lastFrame = performance.now();
    let animationFrame = 0;
    let uidCounter = 0;
    const mobileInput = {
      wheelPointerId: null,
      wheelCodes: new Set(),
      attackPointerId: null
    };

    function uid(prefix) {
      uidCounter += 1;
      return `${prefix}-${uidCounter.toString(16)}`;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function num(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function deepClone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function emptyAnimations() {
      const animations = {};
      for (const slot of ANIMATION_SLOTS) {
        animations[slot] = "";
      }
      return animations;
    }

    function emptyPlatformTiles() {
      const tiles = {};
      for (const slot of PLATFORM_TILE_SLOTS) {
        tiles[slot] = "";
      }
      return tiles;
    }

    function emptyPlatformTileMap() {
      const slots = {};
      for (const slot of PLATFORM_TILE_SLOTS) {
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
      for (const type of GLOBAL_TEXTURE_TYPES) {
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
      for (const type of GLOBAL_TEXTURE_TYPES) {
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

    function entityTemplate(type, x, y, id) {
      const base = {
        id: id || uid(type || "thing"),
        type: type || "sprite",
        name: "Thing",
        x: num(x, 0),
        y: num(y, 0),
        w: 48,
        h: 48,
        color: colorForType(type),
        assetId: "",
        textureFallback: "global",
        animations: emptyAnimations(),
        visible: true,
        props: {}
      };

      if (type === "player") {
        base.name = "Player";
        base.w = 34;
        base.h = 48;
        base.props = { speed: 360, jump: 720, health: 3, active: true };
      } else if (type === "platform") {
        base.name = "Platform";
        base.w = 160;
        base.h = 32;
        base.props = { active: true, tileSize: 16 };
        base.platformTiles = emptyPlatformTiles();
        base.platformTileMap = emptyPlatformTileMap();
      } else if (type === "mob") {
        base.name = "Mob";
        base.w = 42;
        base.h = 42;
        base.props = { ai: "patrol", speed: 80, range: 160, damage: 1, active: true };
      } else if (type === "trap") {
        base.name = "Spike Trap";
        base.w = 96;
        base.h = 30;
        base.props = { damage: 1, active: true };
      } else if (type === "lava") {
        base.name = "Lava";
        base.w = 128;
        base.h = 34;
        base.props = { damage: 1, active: true };
      } else if (type === "powerup") {
        base.name = "Power-up";
        base.w = 34;
        base.h = 34;
        base.props = { effect: "speed", duration: 6, customAction: "grow", customValue: 1, active: true };
      } else if (type === "door") {
        base.name = "Door";
        base.w = 44;
        base.h = 86;
        base.props = { active: true, open: false };
      } else if (type === "portal") {
        base.name = "Portal";
        base.w = 48;
        base.h = 80;
        base.color = "#60b8ff";
        base.props = { active: false, alwaysActive: true, linkedPortalId: "", cooldown: 0.65, soundId: "" };
      } else if (type === "trigger") {
        base.name = "Trigger Zone";
        base.w = 96;
        base.h = 72;
        base.color = "#31b6a4";
        base.props = { active: true, targetId: "", action: "open_door", value: 1, once: false, soundId: "" };
      } else if (type === "checkpoint") {
        base.name = "Checkpoint";
        base.w = 38;
        base.h = 64;
        base.props = { active: true };
      } else if (type === "goal") {
        base.name = "Goal";
        base.w = 54;
        base.h = 72;
        base.props = { active: true };
      } else if (type === "projectile") {
        base.name = "Projectile";
        base.w = 14;
        base.h = 14;
        base.props = { active: true };
      } else if (type === "sprite") {
        base.name = "Sprite";
        base.props = { active: true, gravity: false };
      }

      return base;
    }

    function normalizeProject(input) {
      const source = input || {};
      const next = {
        version: num(source.version, 1),
        name: source.name || "gameCR Playable",
        world: {
          width: clamp(num(source.world && source.world.width, 1600), 320, 100000),
          height: clamp(num(source.world && source.world.height, 900), 240, 100000),
          gravity: num(source.world && source.world.gravity, 1850),
          background: (source.world && source.world.background) || "#172536",
          importPixelLimit: clamp(num(source.world && source.world.importPixelLimit, 32), 8, 128)
        },
        textureDefaults: normalizeTextureDefaults(source.textureDefaults),
        gameplay: normalizeGameSettings(source.gameplay),
        assets: Array.isArray(source.assets) ? source.assets.map((asset) => ({
          id: asset.id || uid("asset"),
          name: asset.name || "Asset",
          type: asset.type || "sprite",
          frames: Array.isArray(asset.frames) ? asset.frames.filter(Boolean) : [],
          frameDuration: clamp(num(asset.frameDuration, 140), 40, 1000)
        })) : [],
        sounds: Array.isArray(source.sounds) ? source.sounds.map((sound) => ({
          id: sound.id || uid("sound"),
          name: sound.name || "Sound",
          src: sound.src || ""
        })) : [],
        entities: Array.isArray(source.entities) ? source.entities.map(normalizeEntity) : [],
        logic: Array.isArray(source.logic) ? source.logic.map((logic) => ({
          id: logic.id || uid("logic"),
          key: logic.key || "",
          event: logic.event || "press",
          targetId: logic.targetId || "",
          action: logic.action || "",
          value: num(logic.value, 1),
          enabled: logic.enabled !== false
        })) : []
      };
      return next;
    }

    function normalizePlatformTileMap(value) {
      const next = emptyPlatformTileMap();
      const source = value || {};
      const slotSource = source.slots || {};
      next.assetId = source.assetId || "";
      next.columns = clamp(num(source.columns, 3), 1, 16);
      next.rows = clamp(num(source.rows, 3), 1, 16);
      for (const slot of PLATFORM_TILE_SLOTS) {
        const index = Math.round(num(slotSource[slot], -1));
        next.slots[slot] = clamp(index, -1, next.columns * next.rows - 1);
      }
      return next;
    }

    function normalizeEntity(entity) {
      const base = entityTemplate(entity.type || "sprite", entity.x, entity.y, entity.id);
        const next = {
          ...base,
          ...entity,
          x: num(entity.x, base.x),
          y: num(entity.y, base.y),
          w: clamp(num(entity.w, base.w), 4, 4096),
          h: clamp(num(entity.h, base.h), 4, 4096),
          color: entity.color || base.color,
          assetId: entity.assetId || "",
          textureFallback: entity.textureFallback === "builtin" ? "builtin" : "global",
          visible: entity.visible !== false,
          props: { ...base.props, ...((entity && entity.props) || {}) },
          animations: { ...emptyAnimations(), ...((entity && entity.animations) || {}) }
      };
      if (next.type === "platform") {
        next.platformTiles = { ...emptyPlatformTiles(), ...((entity && entity.platformTiles) || {}) };
        next.platformTileMap = normalizePlatformTileMap((entity && entity.platformTileMap) || {});
        next.props.tileSize = clamp(num(next.props.tileSize, 16), 4, 64);
      }
      if (next.type === "portal") {
        next.props = {
          active: false,
          alwaysActive: true,
          linkedPortalId: "",
          cooldown: 0.65,
          soundId: "",
          ...next.props
        };
      }
      return next;
    }

    function rebuildImageCache() {
      imageCache.clear();
      for (const asset of project.assets) {
        const frames = asset.frames.map((src) => {
          const image = new Image();
          image.src = src;
          return image;
        });
        imageCache.set(asset.id, frames);
      }
    }

    function rebuildAudioCache() {
      audioCache.clear();
      for (const sound of project.sounds) {
        if (!sound.src) {
          continue;
        }
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
      instance.play().catch(() => {});
    }

    function frameForAsset(assetId, elapsedMs, loop) {
      const asset = project.assets.find((item) => item.id === assetId);
      if (!asset) {
        return null;
      }
      const frames = imageCache.get(assetId);
      if (!frames || frames.length === 0) {
        return null;
      }
      const duration = clamp(num(asset.frameDuration, 140), 40, 1000);
      const rawIndex = Math.floor(num(elapsedMs, animationFrame * 1000) / duration);
      const index = loop === false ? Math.min(frames.length - 1, rawIndex) : rawIndex % frames.length;
      return frames[index];
    }

    function runtimePlayer() {
      return playState ? playState.entities.find((entity) => entity.type === "player" && !entity.dead) || null : null;
    }

    function portalIsActive(portal) {
      return Boolean(portal && portal.props && (portal.props.alwaysActive || portal.props.active));
    }

    function aabb(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function usesPhysics(entity) {
      if (!entity || entity.dead || entity.collected || entity.visible === false) {
        return false;
      }
      if (entity.type === "player" || entity.type === "mob") {
        return true;
      }
      return entity.type === "sprite" && Boolean(entity.props.gravity);
    }

    function showPlayMessage(message, seconds) {
      if (!playState) {
        return;
      }
      if (!message) {
        playState.message = "";
        playState.messageUntil = 0;
        updateHud();
        return;
      }
      playState.message = message;
      playState.messageUntil = playState.time + num(seconds, 1);
      updateHud();
    }

    function updateHud() {
      const settings = gameSettings();
      const player = runtimePlayer();
      const outcome = playState && playState.won ? "won" : playState && playState.lost ? "lost" : "";
      hudTitle.textContent = project.name;
      hudStats.textContent = `${settings.healthLabel}: ${player ? player.health : 0}   ${settings.scoreLabel}: ${playState ? playState.score : 0}`;
      hudMessage.textContent = playState && playState.messageUntil > playState.time ? playState.message : settings.hudIdleMessage;
      hudHint.textContent = settings.hudHint;
      outcomeTitle.textContent = outcome === "won" ? settings.winTitle : outcome === "lost" ? settings.loseTitle : "";
      outcomeSubtitle.textContent = outcome === "won" ? settings.winSubtitle : outcome === "lost" ? settings.loseSubtitle : "";
      document.body.dataset.outcome = outcome;
    }

    function resizeCanvas() {
      canvas.width = Math.max(320, Math.floor(window.innerWidth || 1280));
      canvas.height = Math.max(240, Math.floor(window.innerHeight || 720));
    }

    function startPlay() {
      const settings = gameSettings();
      playState = {
        entities: project.entities.map((entity) => ({
          ...deepClone(entity),
          vx: 0,
          vy: 0,
          onGround: false,
          startX: entity.x,
          startY: entity.y,
          facing: 1,
          health: num(entity.props && entity.props.health, entity.type === "player" ? 3 : 1),
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
        })),
        projectiles: [],
        time: 0,
        score: 0,
        won: false,
        lost: false,
        lastCheckpointId: "",
        message: settings.introMessage,
        messageUntil: settings.introMessage ? settings.introSeconds : 0
      };
      const player = runtimePlayer();
      if (player) {
        camera.x = clamp(player.x - canvas.width / 2, 0, Math.max(0, project.world.width - canvas.width));
        camera.y = clamp(player.y - canvas.height / 2, 0, Math.max(0, project.world.height - canvas.height));
      } else {
        camera.x = 0;
        camera.y = 0;
      }
      updateHud();
    }

    function animationAssetForEntity(entity, state) {
      if (entity.animations && entity.animations[state]) {
        return entity.animations[state];
      }
      if (entity.assetId) {
        return entity.assetId;
      }
      if (entity.textureFallback !== "builtin") {
        return textureDefaultForType(entity.type).assetId || "";
      }
      return "";
    }

    function animationDurationForState(entity, state, fallbackSeconds) {
      const assetId = animationAssetForEntity(entity, state);
      const asset = project.assets.find((item) => item.id === assetId);
      if (!asset || !asset.frames || asset.frames.length === 0) {
        return fallbackSeconds;
      }
      return Math.max(0.05, (asset.frames.length * clamp(num(asset.frameDuration, 140), 40, 1000)) / 1000);
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

    function markAnimation(entity, state, duration) {
      if (!playState || !entity) {
        return;
      }
      entity.animationState = state;
      entity.animationStartedAt = playState.time;
      entity.animationUntil = playState.time + (duration || animationDurationForState(entity, state, 0.2));
    }

    function animationStateForEntity(entity) {
      if (playState && entity.animationState && entity.animationUntil > playState.time) {
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
      if (entity.type === "powerup" || entity.type === "trigger" || entity.type === "checkpoint" || entity.type === "goal" || entity.type === "projectile" || entity.type === "portal") {
        return "active";
      }
      return "idle";
    }

    function isTransientAnimation(entity, state) {
      return Boolean(playState && entity.animationState === state && entity.animationUntil > playState.time);
    }

    function runLogic() {
      for (const logic of project.logic) {
        if (!logic.enabled) {
          continue;
        }
        const shouldRun =
          (logic.event === "down" && keysDown.has(logic.key)) ||
          (logic.event === "press" && justPressed.has(logic.key)) ||
          (logic.event === "up" && justReleased.has(logic.key));
        if (!shouldRun) {
          continue;
        }
        const entity = playState.entities.find((item) => item.id === logic.targetId) || null;
        runAction(entity, logic.action, num(logic.value, 1));
      }
    }

    function spawnRuntimeThing(type, x, y) {
      const template = entityTemplate(type, x, y);
      const entity = normalizeEntity({
        ...template,
        id: uid(type),
        x,
        y
      });
      entity.startX = entity.x;
      entity.startY = entity.y;
      entity.vx = 0;
      entity.vy = 0;
      entity.onGround = false;
      entity.facing = 1;
      entity.health = num(entity.props.health, type === "player" ? 3 : 1);
      entity.invulnerableUntil = 0;
      entity.portalCooldownUntil = 0;
      entity.animationState = "";
      entity.animationStartedAt = 0;
      entity.animationUntil = 0;
      entity.effects = {};
      entity.usedDoubleJump = false;
      entity.collected = false;
      entity.fired = false;
      entity.dead = false;
      playState.entities.push(entity);
      return entity;
    }

    function jumpEntity(entity) {
      const jumpPower = num(entity.props.jump, 650);
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
        visible: true,
        animations: emptyAnimations()
      });
    }

    function applyPowerup(powerup, target) {
      const settings = gameSettings();
      const effect = powerup.props.effect || "speed";
      const duration = num(powerup.props.duration, 6);
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
        target.health = Math.min(num(target.props.health, 3), (target.health || 0) + 1);
        showPlayMessage(settings.healMessage, 1.5);
      } else if (effect === "coin") {
        playState.score += 1;
        showPlayMessage(settings.coinMessage, 1.2);
      } else if (effect === "custom") {
        runAction(target, powerup.props.customAction || "grow", num(powerup.props.customValue, 1));
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
        player.health = num(player.props.health, 3);
        showPlayMessage(settings.respawnMessage, settings.respawnSeconds);
      }
    }

    function respawnEntity(entity) {
      entity.x = num(entity.startX, entity.x);
      entity.y = num(entity.startY, entity.y);
      entity.vx = 0;
      entity.vy = 0;
      entity.onGround = false;
      entity.damageFlashUntil = 0;
      clearPendingJump(entity);
    }

    function runAction(entity, action, value) {
      if (action === "reset_level") {
        startPlay();
        return;
      }
      if (!entity || entity.dead || entity.collected) {
        return;
      }
      const speed = num(entity.props.speed, 260) + num(entity.effects.speedBonus, 0);
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
        playSound(entity.props.soundId);
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

    function fireTrigger(trigger) {
      if (trigger.fired && trigger.props.once) {
        return;
      }
      const target = playState.entities.find((entity) => entity.id === trigger.props.targetId) || trigger;
      playSound(trigger.props.soundId);
      runAction(target, trigger.props.action || "open_door", num(trigger.props.value, 1));
      trigger.fired = true;
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
      player.portalCooldownUntil = playState.time + Math.max(num(portal.props.cooldown, 0.65), num(target.props.cooldown, 0.65), 0.1);
      playSound(portal.props.soundId || target.props.soundId);
      showPlayMessage("Portal jump.", 0.8);
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
        const speed = num(entity.props.speed, 80);
        if (ai === "chase" && player) {
          const dx = player.x - entity.x;
          if (Math.abs(dx) < num(entity.props.range, 220)) {
            entity.vx = Math.sign(dx || 1) * speed;
            entity.facing = Math.sign(dx || 1);
          }
        } else {
          if (!entity.facing) {
            entity.facing = 1;
          }
          entity.vx = entity.facing * speed;
          const origin = num(entity.startX, entity.x);
          if (Math.abs(entity.x - origin) > num(entity.props.range, 160)) {
            entity.facing *= -1;
          }
        }
      }
    }

    function resolveAxis(entity, solids, axis) {
      for (const solid of solids) {
        if (!aabb(entity, solid)) {
          continue;
        }
        if (axis === "x") {
          if (entity.vx > 0) {
            entity.x = solid.x - entity.w;
          } else if (entity.vx < 0) {
            entity.x = solid.x + solid.w;
          }
          entity.vx = 0;
          if (entity.type === "mob") {
            entity.facing = -(entity.facing || 1);
          }
        } else {
          if (entity.vy > 0) {
            entity.y = solid.y - entity.h;
            entity.onGround = true;
            entity.usedDoubleJump = false;
          } else if (entity.vy < 0) {
            entity.y = solid.y + solid.h;
          }
          entity.vy = 0;
        }
      }
    }

    function keepEntityInBounds(entity) {
      const maxX = Math.max(0, project.world.width - entity.w);
      if (entity.x < 0) {
        entity.x = 0;
        entity.vx = 0;
      } else if (entity.x > maxX) {
        entity.x = maxX;
        entity.vx = 0;
      }
      if (entity.y < 0) {
        entity.y = 0;
        entity.vy = 0;
      }
      if (entity.y > project.world.height + 220) {
        respawnEntity(entity);
      }
    }

    function updatePhysics(dt) {
      const solids = playState.entities.filter((entity) => entity.visible !== false && entity.props.active !== false && (entity.type === "platform" || (entity.type === "door" && !entity.props.open)));
      for (const entity of playState.entities) {
        if (!usesPhysics(entity)) {
          continue;
        }
        if (entity.pendingJumpAt && entity.pendingJumpAt > playState.time) {
          entity.onGround = true;
          entity.vy = 0;
          entity.vx *= Math.pow(0.0006, dt);
          entity.x += entity.vx * dt;
          resolveAxis(entity, solids, "x");
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
        resolveAxis(entity, solids, "x");
        entity.y += entity.vy * dt;
        resolveAxis(entity, solids, "y");
        keepEntityInBounds(entity);
        if (!wasOnGround && entity.onGround && verticalVelocityBeforeMove > 60) {
          markAnimation(entity, "land", 0.18);
        }
      }
    }

    function updateProjectiles(dt) {
      const settings = gameSettings();
      const solids = playState.entities.filter((entity) => entity.visible !== false && entity.props.active !== false && (entity.type === "platform" || (entity.type === "door" && !entity.props.open)));
      const mobs = playState.entities.filter((entity) => entity.type === "mob" && !entity.dead);
      for (const projectile of playState.projectiles) {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        for (const solid of solids) {
          if (aabb(projectile, solid)) {
            projectile.life = 0;
          }
        }
        for (const mob of mobs) {
          if (projectile.ownerId !== mob.id && aabb(projectile, mob)) {
            mob.dead = true;
            projectile.life = 0;
            playState.score += 3;
            showPlayMessage(settings.mobClearedMessage, settings.mobClearedSeconds);
          }
        }
        if (projectile.x < -100 || projectile.x > project.world.width + 100 || projectile.y < -100 || projectile.y > project.world.height + 100) {
          projectile.life = 0;
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
          damagePlayer(num(entity.props.damage, 1));
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

    function updateCamera(dt) {
      const player = runtimePlayer();
      if (!player) {
        return;
      }
      const targetX = player.x + player.w / 2 - canvas.width / 2;
      const targetY = player.y + player.h / 2 - canvas.height / 2;
      const maxX = Math.max(0, project.world.width - canvas.width);
      const maxY = Math.max(0, project.world.height - canvas.height);
      camera.x += (clamp(targetX, 0, maxX) - camera.x) * clamp(dt * 5, 0, 1);
      camera.y += (clamp(targetY, 0, maxY) - camera.y) * clamp(dt * 5, 0, 1);
    }

    function stepPlay(dt) {
      playState.time += dt;
      if (playState.won || playState.lost) {
        if (playState.messageUntil && playState.time > playState.messageUntil) {
          playState.messageUntil = 0;
        }
        updateHud();
        return;
      }
      expireTimedEffects();
      runLogic();
      applyPendingJumps();
      updateEnemies();
      updatePhysics(dt);
      updateProjectiles(dt);
      handleRuntimeCollisions();
      updateCamera(dt);
      if (playState.messageUntil && playState.time > playState.messageUntil) {
        playState.messageUntil = 0;
      }
      updateHud();
    }

    function ensurePlatformTiles(entity) {
      entity.platformTiles = { ...emptyPlatformTiles(), ...(entity.platformTiles || {}) };
      entity.props.tileSize = clamp(num(entity.props.tileSize, 16), 4, 64);
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

    function drawPixelSprite(targetCtx, entity, rows, palette) {
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
          targetCtx.fillStyle = color;
          targetCtx.fillRect(
            Math.floor(entity.x + x * cellW),
            Math.floor(entity.y + y * cellH),
            Math.ceil(cellW),
            Math.ceil(cellH)
          );
        }
      }
    }

    function drawPixelPattern(targetCtx, x, y, w, h, pixelSize, rows) {
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
          targetCtx.fillStyle = color;
          targetCtx.fillRect(x + col * size, y + row * size, Math.min(size, w - col * size), Math.min(size, h - row * size));
        }
      }
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

    function drawTiledImage(targetCtx, image, x, y, w, h, tileSize, source) {
      const step = Math.max(1, tileSize);
      for (let tileY = y; tileY < y + h; tileY += step) {
        for (let tileX = x; tileX < x + w; tileX += step) {
          const drawW = Math.min(step, x + w - tileX);
          const drawH = Math.min(step, y + h - tileY);
          if (source) {
            targetCtx.drawImage(image, source.sx, source.sy, source.sw, source.sh, tileX, tileY, drawW, drawH);
          } else {
            targetCtx.drawImage(image, tileX, tileY, drawW, drawH);
          }
        }
      }
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

    function platformTileSource(entity, slot) {
      const selection = platformTileSelection(entity, slot);
      if (!selection) {
        return null;
      }
      const image = frameForAsset(selection.assetId, animationFrame * 1000, true);
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

    function drawDefaultPlatformTile(targetCtx, entity, slot, x, y, w, h) {
      const colors = defaultPlatformTileColors(entity, slot);
      drawPixelPattern(targetCtx, x, y, w, h, Math.max(4, Math.min(8, entity.props.tileSize || 16)), colors);
    }

    function drawPlatformTileRegion(targetCtx, entity, slot, x, y, w, h) {
      if (w <= 0 || h <= 0) {
        return;
      }
      const source = platformTileSource(entity, slot);
      if (source && source.image && source.image.complete) {
        drawTiledImage(targetCtx, source.image, x, y, w, h, entity.props.tileSize || 16, source);
        return;
      }
      drawDefaultPlatformTile(targetCtx, entity, slot, x, y, w, h);
    }

    function drawPlatformTileMap(targetCtx, entity) {
      ensurePlatformTiles(entity);
      const tileSize = Math.min(entity.props.tileSize || 16, entity.w / 2, entity.h / 2);
      const left = entity.x;
      const top = entity.y;
      const right = entity.x + entity.w;
      const bottom = entity.y + entity.h;
      const middleW = Math.max(0, entity.w - tileSize * 2);
      const middleH = Math.max(0, entity.h - tileSize * 2);
      drawPlatformTileRegion(targetCtx, entity, "center", left + tileSize, top + tileSize, middleW, middleH);
      drawPlatformTileRegion(targetCtx, entity, "top", left + tileSize, top, middleW, tileSize);
      drawPlatformTileRegion(targetCtx, entity, "bottom", left + tileSize, bottom - tileSize, middleW, tileSize);
      drawPlatformTileRegion(targetCtx, entity, "left", left, top + tileSize, tileSize, middleH);
      drawPlatformTileRegion(targetCtx, entity, "right", right - tileSize, top + tileSize, tileSize, middleH);
      drawPlatformTileRegion(targetCtx, entity, "topLeft", left, top, tileSize, tileSize);
      drawPlatformTileRegion(targetCtx, entity, "topRight", right - tileSize, top, tileSize, tileSize);
      drawPlatformTileRegion(targetCtx, entity, "bottomLeft", left, bottom - tileSize, tileSize, tileSize);
      drawPlatformTileRegion(targetCtx, entity, "bottomRight", right - tileSize, bottom - tileSize, tileSize, tileSize);
    }

    function drawPortal(targetCtx, entity) {
      const active = portalIsActive(entity);
      const pulse = active ? Math.floor(animationFrame * 8) % 2 : 0;
      drawPixelSprite(targetCtx, entity, [
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

    function shouldMirrorFacing(entity) {
      return entity.type === "player" && (entity.facing || 1) < 0;
    }

    function playerDamageFlashActive(entity) {
      return Boolean(entity.type === "player" && entity.damageFlashUntil && entity.damageFlashUntil > playState.time);
    }

    function drawFacingAware(targetCtx, entity, drawContent) {
      if (!shouldMirrorFacing(entity)) {
        drawContent(targetCtx, entity);
        return;
      }
      targetCtx.save();
      targetCtx.translate(entity.x * 2 + entity.w, 0);
      targetCtx.scale(-1, 1);
      drawContent(targetCtx, entity);
      targetCtx.restore();
    }

    function drawEntityWithEffects(targetCtx, entity, drawContent) {
      if (!playerDamageFlashActive(entity)) {
        drawFacingAware(targetCtx, entity, drawContent);
        return;
      }
      const width = Math.max(1, Math.ceil(entity.w));
      const height = Math.max(1, Math.ceil(entity.h));
      entityEffectCanvas.width = width;
      entityEffectCanvas.height = height;
      entityEffectCtx.clearRect(0, 0, width, height);
      entityEffectCtx.imageSmoothingEnabled = false;
      drawContent(entityEffectCtx, { ...entity, x: 0, y: 0 });
      entityEffectCtx.save();
      entityEffectCtx.globalCompositeOperation = "source-atop";
      entityEffectCtx.fillStyle = "rgba(255, 68, 68, 0.52)";
      entityEffectCtx.fillRect(0, 0, width, height);
      entityEffectCtx.restore();
      drawFacingAware(targetCtx, entity, (finalCtx, drawEntity) => {
        finalCtx.drawImage(entityEffectCanvas, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h);
      });
    }

    function drawFallback(targetCtx, entity) {
      drawPixelPattern(targetCtx, entity.x, entity.y, entity.w, entity.h, 8, [
        [entity.color || "#d5e6ef", "#ffffff"],
        ["#8aa1aa", entity.color || "#d5e6ef"]
      ]);
    }

    function drawBuiltIn(targetCtx, entity) {
      drawEntityWithEffects(targetCtx, entity, (effectTargetCtx, drawEntity) => {
        const active = entity.props ? entity.props.active !== false : true;
        effectTargetCtx.save();
        effectTargetCtx.globalAlpha = active ? 1 : 0.35;
        if (entity.type === "player") {
          drawPixelSprite(effectTargetCtx, drawEntity, ["00111100", "01111110", "01122110", "01111110", "00111100", "03333330", "33333333", "30333303", "00333300", "00300300"], { 1: drawEntity.color, 2: "#061014", 3: "#2f7fa4" });
        } else if (entity.type === "platform") {
          drawPlatformTileMap(effectTargetCtx, drawEntity);
        } else if (entity.type === "mob") {
          drawPixelSprite(effectTargetCtx, drawEntity, ["00011000", "10111101", "11111111", "12211221", "11111111", "01111110", "01011010", "11000011"], { 1: drawEntity.color, 2: "#190504" });
        } else if (entity.type === "trap") {
          drawPixelPattern(effectTargetCtx, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h, 8, [["transparent", drawEntity.color, "transparent", drawEntity.color], [drawEntity.color, drawEntity.color, drawEntity.color, drawEntity.color], ["#28343b", "#202a30", "#28343b", "#202a30"]]);
        } else if (entity.type === "lava") {
          const pulse = 0.5 + Math.sin(animationFrame * 5) * 0.5;
          drawPixelPattern(effectTargetCtx, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h, 10, [[pulse > 0.5 ? "#ffb84a" : drawEntity.color, "#ff6a27", "#9e2d16"], ["#9e2d16", "#ff6a27", "#5b1c12"], ["#5b1c12", "#9e2d16", "#ffb84a"]]);
        } else if (entity.type === "powerup") {
          drawPixelSprite(effectTargetCtx, drawEntity, ["00011000", "00144100", "01444410", "14455441", "14455441", "01444410", "00144100", "00011000"], { 1: "#e7f2f3", 4: drawEntity.color, 5: "#ffffff" });
        } else if (entity.type === "goal") {
          drawPixelSprite(effectTargetCtx, drawEntity, ["11000000", "11444400", "11444440", "11444400", "11000000", "11000000", "11000000", "11000000", "11000000", "11000000"], { 1: "#27343c", 4: drawEntity.color });
        } else if (entity.type === "door") {
          const open = Boolean(drawEntity.props.open);
          drawPixelSprite(effectTargetCtx, drawEntity, ["11111111", "13333331", "13333331", "13333331", "13333531", "13333331", "13333331", "13333331", "11111111"], { 1: open ? "rgba(68, 218, 197, 0.45)" : "#3a2416", 3: open ? "rgba(123, 90, 55, 0.22)" : drawEntity.color, 5: "#ffbf49" });
        } else if (entity.type === "portal") {
          drawPortal(effectTargetCtx, drawEntity);
        } else if (entity.type === "trigger") {
          drawPixelPattern(effectTargetCtx, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h, 10, [["rgba(49, 182, 164, 0.18)", "transparent"], ["transparent", "rgba(68, 218, 197, 0.32)"]]);
          drawPixelSprite(effectTargetCtx, { ...drawEntity, x: drawEntity.x + drawEntity.w * 0.34, y: drawEntity.y + drawEntity.h * 0.34, w: drawEntity.w * 0.32, h: drawEntity.h * 0.32 }, ["0110", "1111", "1111", "0110"], { 1: drawEntity.color });
        } else if (entity.type === "checkpoint") {
          drawPixelSprite(effectTargetCtx, drawEntity, ["11000000", "11444000", "11444400", "11444000", "11000000", "11000000", "11000000", "11000000"], { 1: "#27343c", 4: drawEntity.color });
        } else if (entity.type === "projectile") {
          drawPixelSprite(effectTargetCtx, drawEntity, ["0110", "1111", "1111", "0110"], { 1: drawEntity.color || "#e7f2f3" });
        } else {
          drawFallback(effectTargetCtx, drawEntity);
        }
        effectTargetCtx.restore();
      });
    }

    function drawEntity(targetCtx, entity) {
      if (entity.visible === false || entity.collected || entity.dead) {
        return;
      }
      if (entity.type === "platform") {
        drawPlatformTileMap(targetCtx, entity);
        return;
      }
      const state = animationStateForEntity(entity);
      const assetId = animationAssetForEntity(entity, state);
      if (assetId) {
        const transient = isTransientAnimation(entity, state);
        const elapsedMs = transient ? Math.max(0, (playState.time - entity.animationStartedAt) * 1000) : animationFrame * 1000;
        const image = frameForAsset(assetId, elapsedMs, !transient);
        if (image && image.complete) {
          drawEntityWithEffects(targetCtx, entity, (effectTargetCtx, drawEntity) => {
            effectTargetCtx.drawImage(image, drawEntity.x, drawEntity.y, drawEntity.w, drawEntity.h);
          });
          return;
        }
      }
      drawBuiltIn(targetCtx, entity);
    }

    function drawScene() {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = project.world.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(-camera.x, -camera.y);
      ctx.strokeStyle = "rgba(231, 242, 243, 0.05)";
      ctx.strokeRect(0, 0, project.world.width, project.world.height);
      const entities = playState.entities.concat(playState.projectiles);
      for (const entity of entities) {
        drawEntity(ctx, entity);
      }
      ctx.restore();
    }

    function pressKeyCode(code) {
      if (!code) {
        return;
      }
      if (!keysDown.has(code)) {
        justPressed.add(code);
      }
      keysDown.add(code);
    }

    function releaseKeyCode(code) {
      if (!code) {
        return;
      }
      if (keysDown.has(code)) {
        justReleased.add(code);
      }
      keysDown.delete(code);
    }

    function setMobileWheelCodes(nextCodes) {
      const next = nextCodes || new Set();
      for (const code of mobileInput.wheelCodes) {
        if (!next.has(code)) {
          releaseKeyCode(code);
        }
      }
      for (const code of next) {
        if (!mobileInput.wheelCodes.has(code)) {
          pressKeyCode(code);
        }
      }
      mobileInput.wheelCodes = new Set(next);
    }

    function setMobileWheelKnob(dx = 0, dy = 0) {
      if (!mobileMoveKnob) {
        return;
      }
      mobileMoveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    function updateMobileWheel(event) {
      const rect = mobileMoveWheel.getBoundingClientRect();
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
      event.preventDefault();
      mobileInput.wheelPointerId = event.pointerId;
      mobileMoveWheel.classList.add("active");
      if (mobileMoveWheel.setPointerCapture) {
        try {
          mobileMoveWheel.setPointerCapture(event.pointerId);
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
      mobileMoveWheel.classList.remove("active");
    }

    function onMobileAttackDown(event) {
      event.preventDefault();
      mobileInput.attackPointerId = event.pointerId;
      mobileAttackBtn.classList.add("active");
      if (mobileAttackBtn.setPointerCapture) {
        try {
          mobileAttackBtn.setPointerCapture(event.pointerId);
        } catch (error) {
          void error;
        }
      }
      pressKeyCode("KeyF");
    }

    function onMobileAttackUp(event) {
      if (mobileInput.attackPointerId != null && event.pointerId !== mobileInput.attackPointerId) {
        return;
      }
      event.preventDefault();
      mobileInput.attackPointerId = null;
      mobileAttackBtn.classList.remove("active");
      releaseKeyCode("KeyF");
    }

    function clearMobileInput() {
      setMobileWheelCodes(new Set());
      releaseKeyCode("KeyF");
      mobileInput.wheelPointerId = null;
      mobileInput.attackPointerId = null;
      setMobileWheelKnob(0, 0);
      if (mobileMoveWheel) {
        mobileMoveWheel.classList.remove("active");
      }
      if (mobileAttackBtn) {
        mobileAttackBtn.classList.remove("active");
      }
    }

    function initMobileControls() {
      if (!mobileMoveWheel || !mobileAttackBtn) {
        return;
      }
      mobileMoveWheel.addEventListener("pointerdown", onMobileWheelDown);
      mobileMoveWheel.addEventListener("pointermove", onMobileWheelMove);
      mobileMoveWheel.addEventListener("pointerup", onMobileWheelUp);
      mobileMoveWheel.addEventListener("pointercancel", onMobileWheelUp);
      mobileMoveWheel.addEventListener("lostpointercapture", onMobileWheelUp);
      mobileAttackBtn.addEventListener("pointerdown", onMobileAttackDown);
      mobileAttackBtn.addEventListener("pointerup", onMobileAttackUp);
      mobileAttackBtn.addEventListener("pointercancel", onMobileAttackUp);
      mobileAttackBtn.addEventListener("lostpointercapture", onMobileAttackUp);
    }

    function onKeyDown(event) {
      if (event.code === "KeyR" && playState && (playState.won || playState.lost)) {
        startPlay();
        event.preventDefault();
        return;
      }
      pressKeyCode(event.code);
      if (event.code === "Space" || event.code.startsWith("Arrow")) {
        event.preventDefault();
      }
    }

    function onKeyUp(event) {
      releaseKeyCode(event.code);
    }

    function loop(now) {
      const dt = clamp((now - lastFrame) / 1000, 0, 1 / 20);
      lastFrame = now;
      animationFrame += dt;
      if (playState) {
        stepPlay(dt);
        drawScene();
      }
      justPressed.clear();
      justReleased.clear();
      requestAnimationFrame(loop);
    }

    rebuildImageCache();
    rebuildAudioCache();
    resizeCanvas();
    startPlay();
    updateHud();
    canvas.focus();
    canvas.addEventListener("pointerdown", () => {
      canvas.focus();
    });
    initMobileControls();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearMobileInput);
    requestAnimationFrame(loop);
  }

  global.buildGameCRPlayableHtml = buildGameCRPlayableHtml;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { buildGameCRPlayableHtml };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
