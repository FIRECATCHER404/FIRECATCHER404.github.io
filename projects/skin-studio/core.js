/* Expressionful Skin Studio: shared browser/Node pack model and ZIP codec. */
(function (root) {
  'use strict';
  const catalog = root.ExpressionfulCatalog;
  const zip = root.fflate || (typeof require === 'function' ? require('./vendor/fflate.js') : null);
  const LIMITS = { archive: 2 * 1024 * 1024, expanded: 8 * 1024 * 1024, file: 65536, frames: 512, animations: 128, rules: 256 };
  const WHEEL_PREVIEWS = ['face','head','body','torso','left_arm','right_arm','legs','skin'];
  const compact = value => value.toLowerCase().replace(/[ _-]/g, '');
  const aliases = new Map();
  for (const name of catalog.states) for (const prefix of ['', 'is', 'while']) aliases.set(compact(prefix + name), name);
  for (const name of catalog.events) for (const prefix of ['', 'was', 'on']) aliases.set(compact(prefix + name), name);
  for (const [key, value] of Object.entries(catalog.aliases)) aliases.set(compact(key), value);
  const attributes = new Map(catalog.values.map(value => [compact(value), { value, scale: 1 }]));
  for (const [key, value] of Object.entries(catalog.attributes)) attributes.set(compact(key), value);
  const comparison = /^([a-z_]+)\s*(==|!=|<=|>=|=|<|>)\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)$/;
  const dynamic = /^(?:dimension|biome|effect|item):[a-z0-9_.-]+:[a-z0-9_./-]+$/;
  const encode = text => new TextEncoder().encode(text);
  const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const uid = () => (root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  function normalize(value) {
    if (typeof value !== 'string' || value.length > 160) return null;
    let name = value.trim().toLowerCase();
    const match = comparison.exec(name.replace(/^attribute:/, '').replace(/^([a-z_]+?)[_:]?(\d+(?:\.\d+)?)$/, '$1==$2'));
    if (match) {
      const attribute = attributes.get(compact(match[1])), number = Number(match[3]);
      if (!attribute || !Number.isFinite(number) || Math.abs(number * attribute.scale) > 1e9) return null;
      return `${attribute.value}${match[2] === '=' ? '==' : match[2]}${number * attribute.scale}`;
    }
    name = name.replace(/^has_effect:/, 'effect:');
    if (/^effect:[^:]+$/.test(name)) name = name.replace(/^effect:/, 'effect:minecraft:');
    return dynamic.test(name) ? name : aliases.get(compact(name)) || null;
  }
  function base64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  function unbase64(value) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
  }
  const pngData = bytes => 'data:image/png;base64,' + base64(bytes);
  const pngBytes = data => unbase64(data.slice(data.indexOf(',') + 1));
  function validatePng(bytes, icon = false) {
    if (bytes.length < 33 || bytes.length > LIMITS.file || ![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) throw Error(icon ? 'The pack icon must be a PNG of at most 64 KiB.' : 'Each frame must be a PNG under 64 KiB.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452 || (icon ? width !== height || width < 16 || width > 256 : width !== 64 || height !== 64)) throw Error(icon ? 'Pack icons must be square PNGs, 16–256 pixels.' : 'Each skin frame must be exactly 64 × 64 pixels.');
  }
  function newProject() {
    return { version: 1, name: 'My skin pack', description: '', author: '', packVersion: '', icon: '', model: 'auto', fallback: 'idle', useAliases: true,
      animations: [{ id: 'idle', fps: 10, loop: true, playback: 'forward', frames: [] }], rules: [], wheel: [] };
  }
  function asList(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
  function metadata(project) {
    const pack = { pack_format: 1, name: project.name, description: project.description || '' };
    if (project.author) pack.author = project.author;
    if (project.packVersion) pack.version = project.packVersion;
    return { pack };
  }
  function readMetadata(bytes) {
    try {
      const { pack } = JSON.parse(decode(bytes));
      if (!pack || pack.pack_format !== 1) throw Error('pack.pack_format must be 1.');
      for (const [key, max] of Object.entries({name:80,description:160,author:80,version:40})) {
        if (Object.hasOwn(pack,key) && (typeof pack[key] !== 'string' || pack[key].length > max || key === 'name' && !pack[key].trim())) throw Error(`${key} must be text of at most ${max} characters${key === 'name' ? ' and cannot be blank' : ''}.`);
      }
      return pack;
    } catch (error) { throw Error('Invalid skinpack.mcmeta: ' + error.message); }
  }
  function choices(rule) {
    if (rule.animation) return [{ animation: rule.animation, weight: 1 }];
    if (Array.isArray(rule.animations)) return rule.animations.map(animation => ({ animation, weight: 1 }));
    return Object.entries(rule.animations || {}).map(([animation, weight]) => ({ animation, weight }));
  }
  function manifest(project) {
    const result = { format: 2, name: project.name, description: project.description, model: project.model, default: project.fallback, animations: Object.create(null) };
    for (const animation of project.animations) {
      const definition = { frames: animation.frames.map((frame, i) => `animations/${animation.id}/${String(i).padStart(3, '0')}.png`), fps: animation.fps, loop: !!animation.loop, playback: animation.playback || 'forward' };
      if (animation.frames.some(frame => frame.ms != null)) definition.frame_ms = animation.frames.map(frame => frame.ms ?? 1000 / animation.fps);
      result.animations[animation.id] = definition;
    }
    const rules = [], shortcut = Object.create(null);
    let aliasStart = project.rules.length;
    if (project.useAliases) {
      const seen = new Set();
      for (let i = project.rules.length - 1; i >= 0; i--) {
        const when = project.rules[i].when;
        if (typeof when !== 'string' || seen.has(when)) break;
        seen.add(when); aliasStart = i;
      }
    }
    for (const [index, source] of project.rules.entries()) {
      const rule = JSON.parse(JSON.stringify(source));
      if (index >= aliasStart) {
        const key = rule.when; delete rule.when;
        const normalized = normalize(key);
        const aliasPriority = catalog.events.includes(normalized) ? 100 : normalized?.startsWith('health') ? 80 : normalized?.startsWith('food') ? 60 : normalized?.startsWith('effect:') ? 50 : 0;
        if (rule.priority == null && aliasPriority !== 0) rule.priority = 0;
        shortcut[key] = Object.keys(rule).length === 1 && rule.animation ? rule.animation : rule;
      } else rules.push(rule);
    }
    if (Object.keys(shortcut).length) result.aliases = shortcut;
    if (rules.length || !Object.keys(shortcut).length) result.rules = rules;
    if (Array.isArray(project.wheel) && project.wheel.length) result.wheel = project.wheel.map(({animation,label,preview,yaw,pitch})=>({animation,label,preview,yaw,pitch}));
    return result;
  }
  function range(value, fallback, min, max, label) {
    const values = Array.isArray(value) ? value : [value ?? fallback, value ?? fallback];
    if (values.length !== 2 || values.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) || values[0] > values[1]) throw Error(`${label} has an invalid range.`);
  }
  function validate(project) {
    const errors = [];
    const check = action => { try { action(); } catch (error) { errors.push(error.message); } };
    check(() => {
      if (typeof project.name !== 'string' || !project.name.trim() || project.name.length > 80) throw Error('Give the pack a name (1–80 characters).');
      if (project.description != null && (typeof project.description !== 'string' || project.description.length > 160)) throw Error('Description must be text of at most 160 characters.');
      for (const [key, label, max] of [['author','Author',80],['packVersion','Pack version',40]]) if (project[key] != null && (typeof project[key] !== 'string' || project[key].length > max)) throw Error(`${label} must be text of at most ${max} characters.`);
      if (!['auto', 'wide', 'slim'].includes(project.model)) throw Error('Choose an arm model.');
      if (!project.animations.length || project.animations.length > LIMITS.animations) throw Error('A pack needs 1–128 animations.');
      if (!project.animations.some(a => a.id === project.fallback)) throw Error('Choose an existing animation as the default.');
    });
    const ids = new Set(); let count = 0, expanded = 0;
    if (project.icon) check(() => { const bytes = pngBytes(project.icon); validatePng(bytes, true); expanded += bytes.length; });
    for (const a of project.animations) check(() => {
      if (!/^[a-z0-9_]{1,40}$/.test(a.id) || ids.has(a.id)) throw Error(`Animation ID “${a.id}” must be unique, lowercase, and use letters, numbers or underscores.`);
      ids.add(a.id);
      if (!a.frames.length) throw Error(`Upload at least one frame for “${a.id}”.`);
      if (!Number.isFinite(a.fps) || a.fps < .1 || a.fps > 120) throw Error(`“${a.id}” FPS must be 0.1–120.`);
      if (!['forward','reverse','ping_pong'].includes(a.playback || 'forward')) throw Error(`Invalid playback for “${a.id}”.`);
      for (const frame of a.frames) {
        const bytes = pngBytes(frame.data); validatePng(bytes); count++; expanded += bytes.length;
        if (frame.ms != null && (!Number.isFinite(frame.ms) || frame.ms < 1 || frame.ms > 60000)) throw Error('Frame duration must be 1–60000 ms.');
      }
    });
    if (count > LIMITS.frames) errors.push('The pack exceeds 512 frames.');
    check(()=>{
      const wheel=project.wheel === undefined ? [] : project.wheel, used=new Set();
      if(!Array.isArray(wheel) || wheel.length>128)throw Error('Too many wheel preview settings.');
      for(const entry of wheel){
        if(!entry || !ids.has(entry.animation))throw Error('Unknown wheel animation: '+entry?.animation);
        if(used.has(entry.animation))throw Error('Duplicate wheel preview for animation: '+entry.animation);
        used.add(entry.animation);
        if(entry.label!==undefined && (typeof entry.label!=='string' || !entry.label.trim() || entry.label.length>32))throw Error('Wheel labels need 1–32 characters.');
        if(!WHEEL_PREVIEWS.includes(entry.preview === undefined ? 'head' : entry.preview))throw Error('Choose a valid wheel preview.');
        for(const [key,min,max] of [['yaw',-180,180],['pitch',-50,50]])if(entry[key]!==undefined && (typeof entry[key]!=='number' || !Number.isFinite(entry[key]) || entry[key]<min || entry[key]>max))throw Error(`Wheel ${key} must be ${min} to ${max}.`);
      }
    });
    if (project.rules.length > LIMITS.rules) errors.push('The pack exceeds 256 rules.');
    project.rules.forEach((rule, index) => check(() => {
      const prefix = `Rule ${index + 1}: `;
      const conditions = asList(rule.when);
      if (!conditions.length || conditions.length > 32 || [...conditions, ...asList(rule.all), ...asList(rule.not)].some(c => !normalize(c))) throw Error(prefix + 'choose valid conditions or aliases.');
      const normalized = conditions.map(normalize);
      const mode = rule.mode || (normalized.every(c => catalog.events.includes(c)) ? 'event' : 'state');
      if (!['state','event','enter','exit','random'].includes(mode)) throw Error(prefix + 'invalid mode.');
      if (mode === 'event' && normalized.some(c => !catalog.events.includes(c))) throw Error(prefix + 'event mode needs an event condition.');
      if (mode === 'random' && normalized.some(c => catalog.events.includes(c))) throw Error(prefix + 'random intervals need a persistent state.');
      const targets = choices(rule);
      if (!targets.length || targets.length > 32 || new Set(targets.map(t => t.animation)).size !== targets.length || targets.some(t => !ids.has(t.animation) || !Number.isFinite(t.weight) || t.weight <= 0 || t.weight > 1e6)) throw Error(prefix + 'choose existing animations with positive weights.');
      range(rule.chance, 1, 0, 1, prefix + 'Chance'); range(rule.speed, 1, .1, 8, prefix + 'Speed');
      range(rule.interval, 3, .05, 86400, prefix + 'Interval'); range(rule.cooldown, 0, 0, 86400, prefix + 'Cooldown');
      range(rule.delay, 0, 0, 3600, prefix + 'Delay'); range(rule.duration, 0, 0, 86400, prefix + 'Duration');
      if (!Number.isInteger(rule.repeats ?? 1) || (rule.repeats ?? 1) < 1 || (rule.repeats ?? 1) > 100) throw Error(prefix + 'repeat count must be 1–100.');
      if (!Number.isInteger(rule.priority ?? 0)) throw Error(prefix + 'priority must be a whole number.');
      if (!Number.isFinite(rule.threshold ?? .25) || (rule.threshold ?? .25) < 0 || (rule.threshold ?? .25) > 1) throw Error(prefix + 'health threshold must be 0–1.');
      for (const bounds of [rule.min, rule.max]) for (const [key, value] of Object.entries(bounds || {})) if (!catalog.values.includes(key) || !Number.isFinite(value) || Math.abs(value) > 1e9) throw Error(prefix + 'invalid numeric filter.');
    }));
    const text = JSON.stringify(manifest(project), null, 2);
    const meta = JSON.stringify(metadata(project), null, 2);
    if (encode(text).length > LIMITS.file) errors.push('The manifest exceeds 64 KiB.');
    if (expanded + encode(text).length + encode(meta).length + 2 > LIMITS.expanded) errors.push('The expanded pack exceeds 8 MiB.');
    return [...new Set(errors)];
  }
  function exportZip(project) {
    const errors = validate(project); if (errors.length) throw Error(errors.join('\n'));
    const files = Object.create(null); files['skinpack.json'] = encode(JSON.stringify(manifest(project), null, 2) + '\n');
    files['skinpack.mcmeta'] = encode(JSON.stringify(metadata(project), null, 2) + '\n');
    if (project.icon) files['pack.png'] = pngBytes(project.icon);
    for (const a of project.animations) a.frames.forEach((frame,i) => { files[`animations/${a.id}/${String(i).padStart(3,'0')}.png`] = pngBytes(frame.data); });
    const bytes = zip.zipSync(files, { level: 6, mtime: new Date(2026,0,1) });
    if (bytes.length > LIMITS.archive) throw Error('The compressed pack exceeds the mod’s 2 MiB limit.');
    return bytes;
  }
  function importZip(bytes) {
    if (bytes.length > LIMITS.archive) throw Error('Skin packs must be at most 2 MiB.');
    let expanded = 0, count = 0;
    const files = zip.unzipSync(bytes, { filter: entry => {
      if (entry.name.endsWith('/')) return false;
      if (++count > LIMITS.frames + 3 || entry.originalSize > LIMITS.file || (expanded += entry.originalSize) > LIMITS.expanded) throw Error('The ZIP exceeds pack limits.');
      if (!/^(?:skinpack\.(?:json|mcmeta)|[^\\:]+\.png)$/.test(entry.name) || entry.name.startsWith('/') || entry.name.split('/').some(s => !s || s === '.' || s === '..')) throw Error('The ZIP contains an unsupported or unsafe file path.');
      return true;
    } });
    if (!files['skinpack.json']) throw Error('The ZIP needs skinpack.json at its root.');
    const source = JSON.parse(decode(files['skinpack.json']));
    if (![1,2].includes(source.format)) throw Error('Unsupported skin pack format.');
    const meta = files['skinpack.mcmeta'] ? readMetadata(files['skinpack.mcmeta']) : {};
    const icon = files['pack.png'];
    delete files['skinpack.mcmeta']; delete files['pack.png'];
    const skins = Object.entries(files).filter(([name]) => name.endsWith('.png'));
    if (skins.length > LIMITS.frames) throw Error('The pack exceeds 512 frames.');
    for (const [, png] of skins) validatePng(png);
    if (icon) validatePng(icon, true);
    const project = { version: 1, name: meta.name ?? source.name, description: meta.description ?? source.description ?? '', author: meta.author || '', packVersion: meta.version || '', icon: icon ? pngData(icon) : '', model: source.model || 'auto', fallback: source.default, useAliases: !!source.aliases, animations: [], rules: source.rules || [], wheel: Object.hasOwn(source,'wheel') ? source.wheel : [] };
    if (!Array.isArray(project.rules)) throw Error('rules must be an array.');
    for (const [id, a] of Object.entries(source.animations || {})) {
      const names = a.frames || Object.keys(files).filter(name => name.startsWith(a.folder.replace(/\/$/, '') + '/') && name.endsWith('.png') && !name.slice(a.folder.replace(/\/$/, '').length + 1).includes('/')).sort();
      if (!Array.isArray(names) || (a.frame_ms && (!Array.isArray(a.frame_ms) || a.frame_ms.length !== names.length))) throw Error('Each frame needs exactly one duration in frame_ms.');
      project.animations.push({ id, fps: a.fps ?? 10, loop: !!a.loop, playback: a.playback || 'forward', frames: names.map((name,i) => {
        if (!files[name]) throw Error('Missing frame: ' + name); validatePng(files[name]);
        return { key: uid(), name: name.split('/').pop(), data: pngData(files[name]), ...(a.frame_ms ? { ms: a.frame_ms[i] } : {}) };
      }) });
    }
    for (const [condition, definition] of Object.entries(source.aliases || {})) {
      if (definition && typeof definition === 'object' && !Array.isArray(definition) && Object.hasOwn(definition, 'when')) throw Error('An alias cannot override its own condition.');
      const rule = typeof definition === 'string' ? { animation: definition } : Array.isArray(definition) ? { animations: definition } : { ...definition };
      const normalized = normalize(condition);
      rule.when = condition;
      rule.priority ??= catalog.events.includes(normalized) ? 100 : normalized?.startsWith('health') ? 80 : normalized?.startsWith('food') ? 60 : normalized?.startsWith('effect:') ? 50 : 0;
      project.rules.push(rule);
    }
    const errors = validate(project); if (errors.length) throw Error(errors.join('\n'));
    return project;
  }
  function renameAnimation(project, oldId, newId) {
    if (!/^[a-z0-9_]{1,40}$/.test(newId) || project.animations.some(a => a.id === newId && a.id !== oldId)) throw Error('Use a unique lowercase animation ID.');
    project.animations.find(a => a.id === oldId).id = newId;
    if (project.fallback === oldId) project.fallback = newId;
    for (const entry of project.wheel || []) if(entry.animation===oldId)entry.animation=newId;
    for (const rule of project.rules) {
      if (rule.animation === oldId) rule.animation = newId;
      if (Array.isArray(rule.animations)) rule.animations = rule.animations.map(id => id === oldId ? newId : id);
      else if (rule.animations && Object.hasOwn(rule.animations, oldId)) rule.animations = Object.fromEntries(Object.entries(rule.animations).map(([id,weight])=>[id===oldId?newId:id,weight]));
    }
  }
  function wheelEntries(project) {
    const overrides=new Map((project.wheel || []).map(entry=>[entry.animation,entry]));
    return project.animations.slice(0,16).map((animation,index)=>({label:animation.id,preview:'head',yaw:30,pitch:-5,...overrides.get(animation.id),animation:animation.id,slot:index+1}));
  }
  const api = { catalog, LIMITS, WHEEL_PREVIEWS, wheelEntries, normalize, uid, pngData, pngBytes, validatePng, newProject, asList, choices, manifest, metadata, validate, exportZip, importZip, renameAnimation, base64, unbase64 };
  root.ExpressionfulCore = api; if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
