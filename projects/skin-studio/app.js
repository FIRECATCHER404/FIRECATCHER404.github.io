(async function () {
  'use strict';
  const C = ExpressionfulCore, $ = id => document.getElementById(id);
  const localHost = location.protocol === 'file:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  document.querySelector('.local-badge').textContent = localHost ? 'LOCALHOST' : 'WEB EDITOR';
  $('workspaceLocation').textContent = localHost ? 'Running on your computer.' : 'Skins stay on this device.';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const pretty = value => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  let project, selectedId, selectedFrame = 0, view = '3d', playing = true, started = performance.now(), activeTab = 'frames', draggedFrame = -1;
  let database, saveTimer, toastTimer;
  let wheelSlot=1;
  const images = new Map();
  const preview = new ExpressionfulPlayerPreview($('playerPreview'),$('previewStage'));
  if (!preview.available) view = 'texture';
  const selected = () => project.animations.find(animation => animation.id === selectedId) || project.animations[0];
  const options = (values, current) => values.map(value => `<option value="${escape(typeof value === 'string' ? value : value.value)}" ${(typeof value === 'string' ? value : value.value) === current ? 'selected' : ''}>${escape(typeof value === 'string' ? value : value.label)}</option>`).join('');
  function setValue(id, value) { if (document.activeElement !== $(id)) $(id).value = value ?? ''; }
  function toast(message, error = false) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 7000 : 3500);
  }
  function failure(error) { console.warn(error); toast(error.message || String(error), true); }
  async function openDatabase() {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open('expressionful-studio',1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  function databaseAction(mode, action) {
    return new Promise((resolve,reject) => {
      const transaction = database.transaction('drafts',mode); const request = action(transaction.objectStore('drafts'));
      transaction.oncomplete = () => resolve(request.result); transaction.onerror = () => reject(transaction.error);
    });
  }
  function scheduleSave() {
    $('saveState').textContent = 'Saving…'; clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        if (!database) throw Error('Browser storage is unavailable. Export your pack before closing.');
        await databaseAction('readwrite',store => store.put(project,'current'));
        $('saveState').textContent = 'Saved on this device';
      } catch (error) { $('saveState').textContent = 'Draft not saved'; toast(error.message,true); }
    },250);
  }
  function updateManifest() {
    $('manifestPreview').textContent = JSON.stringify($('jsonFile').value === 'skinpack.mcmeta' ? C.metadata(project) : C.manifest(project),null,2);
    const errors = C.validate(project);
    $('validationPanel').hidden = !errors.length || activeTab !== 'manifest';
    $('validationErrors').replaceChildren(...errors.slice(0,8).map(message => { const item = document.createElement('li'); item.textContent = message; return item; }));
    const frames = project.animations.reduce((total,a) => total + a.frames.length,0);
    $('packSummary').textContent = `${project.animations.length} animations · ${frames} frames · ${project.rules.length} rules`;
    $('ruleCount').textContent = project.rules.length;
    $('sidebarPackName').textContent = project.name || 'Untitled pack';
    $('packIconPreview').hidden = !project.icon; $('packIconPlaceholder').hidden = !!project.icon; $('removePackIcon').hidden = !project.icon;
    if (project.icon) $('packIconPreview').src = project.icon; else $('packIconPreview').removeAttribute('src');
    $('exportAnimationCount').textContent = project.animations.length;
    $('exportFrameCount').textContent = frames;
    $('exportRuleCount').textContent = project.rules.length;
    $('exportPack').disabled = !!errors.length;
    $('exportStatus').textContent = errors.length ? `${errors.length} ${errors.length === 1 ? 'issue' : 'issues'} to fix before exporting. See below.` : 'All checks passed. Your pack is ready.';
    $('exportStatus').classList.toggle('invalid',!!errors.length);
  }
  function changed(redraw = true) { if (redraw) render(); else updateManifest(); scheduleSave(); }
  function resetPlayback() { started = performance.now(); selectedFrame = 0; playing = true; $('playPause').textContent = 'Ⅱ'; $('playPause').setAttribute('aria-label','Pause preview'); }
  function getImage(frame) {
    if (!frame) return null;
    if (images.has(frame.data)) return images.get(frame.data);
    const image = new Image(); image.src = frame.data; images.set(frame.data,image);
    image.onload = () => { renderThumbnails(); drawPreview(); };
    return image;
  }
  function drawHead(canvas, frame) {
    const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false; context.clearRect(0,0,canvas.width,canvas.height);
    const image = getImage(frame); if (!image?.complete || !image.naturalWidth) return;
    context.drawImage(image,8,8,8,8,0,0,canvas.width,canvas.height);
    context.drawImage(image,40,8,8,8,0,0,canvas.width,canvas.height);
  }
  function renderThumbnails() {
    document.querySelectorAll('[data-animation-head]').forEach(canvas => { const animation = project.animations.find(a => a.id === canvas.dataset.animationHead); drawHead(canvas,animation?.frames[0]); });
  }
  function renderAnimations() {
    $('animationCount').textContent = project.animations.length;
    $('animationList').innerHTML = project.animations.map(a => `<button class="animation-row ${a.id === selectedId ? 'selected' : ''}" data-select-animation="${escape(a.id)}" aria-pressed="${a.id === selectedId}"><canvas width="32" height="32" data-animation-head="${escape(a.id)}" aria-hidden="true"></canvas><span><strong>${escape(a.id)}</strong><small>${a.frames.length} frame${a.frames.length === 1 ? '' : 's'} · ${a.fps} fps</small></span>${a.id === selectedId ? '<i class="row-dot" aria-hidden="true"></i>' : ''}</button>`).join('');
    $('packDefault').innerHTML = options(project.animations.map(a=>a.id),project.fallback);
    renderThumbnails();
  }
  function renderFrames() {
    const animation = selected(); if (!animation) return;
    selectedFrame = Math.max(0,Math.min(selectedFrame,animation.frames.length - 1));
    $('frameCount').textContent = animation.frames.length;
    $('noFrames').hidden = !!animation.frames.length;
    $('frameList').innerHTML = animation.frames.map((frame,index) => `<button class="frame-card ${index === selectedFrame ? 'selected' : ''}" data-frame="${index}" draggable="true" aria-label="Frame ${index + 1}: ${escape(frame.name)}"><img src="${escape(frame.data)}" alt="Skin frame ${index + 1}"><span>${String(index + 1).padStart(2,'0')} · ${frame.ms ? Number(frame.ms.toFixed(1)) + ' ms' : 'auto'}</span></button>`).join('') + '<button class="frame-card add-frame-card" data-upload-frames aria-label="Upload more frames">+<small>Add frames</small></button>';
    $('frameScrubber').max = Math.max(0,animation.frames.length - 1);
    $('frameInspector').hidden = !animation.frames.length;
    updateInspector();
  }
  function updateInspector() {
    const frame = selected()?.frames[selectedFrame]; if (!frame) return;
    $('frameName').textContent = frame.name; setValue('frameDuration',frame.ms == null ? undefined : Number(frame.ms.toFixed(3)));
    $('moveFrameLeft').disabled = selectedFrame <= 0; $('moveFrameRight').disabled = selectedFrame >= selected().frames.length - 1;
  }
  function render() {
    if (!selected()) return;
    const animation = selected(); selectedId = animation.id;
    setValue('packName',project.name); setValue('packDescription',project.description); setValue('packModel',project.model);
    setValue('packAuthor',project.author); setValue('packVersion',project.packVersion);
    $('useAliases').checked = !!project.useAliases;
    renderAnimations(); renderFrames();
    $('selectedTitle').textContent = animation.id;
    $('selectedSubtitle').textContent = `${animation.frames.length} frames · ${animation.loop ? 'Looping' : 'Plays once'} · ${pretty(animation.playback || 'forward')}`;
    setValue('animationId',animation.id); setValue('animationFps',animation.fps); setValue('animationPlayback',animation.playback || 'forward'); $('animationLoop').checked = animation.loop;
    renderRules(); renderWheel(); updateManifest(); drawPreview();
  }
  function openTab(name) {
    if (!['pack','frames','rules','wheel','manifest'].includes(name)) return;
    activeTab = name;
    document.querySelectorAll('[data-tab]').forEach(button => { button.setAttribute('aria-selected',button.dataset.tab === name);button.tabIndex = button.dataset.tab === name ? 0 : -1; });
    for (const key of ['pack','frames','rules','wheel','manifest']) $('panel-' + key).hidden = key !== name;
    const copy = {pack:['Make it your pack.','Set a name, arm model, and default animation.'],frames:['Animate your skin.','Upload frames and see them on your player.'],rules:['Give each moment a look.','Choose when each animation should play.'],manifest:['Take your pack into Minecraft.','Review, download, and add it to your game.']};
    copy.wheel=['Put expressions at your fingertips.','Your animations fill the wheel automatically. Customize their previews here.'];
    $('pageTitle').textContent = copy[name][0]; $('pageDescription').textContent = copy[name][1];
    updateManifest();
    drawPreview();
  }
  function frameAt(animation, elapsed) {
    if (!animation.frames.length) return 0;
    let sequence = animation.frames.map((_,i)=>i);
    if (animation.playback === 'reverse') sequence.reverse();
    if (animation.playback === 'ping_pong' && sequence.length > 1) sequence.push(...sequence.slice(1,-1).reverse());
    const durations = sequence.map(i => animation.frames[i].ms ?? 1000 / animation.fps);
    const total = durations.reduce((a,b)=>a+b,0);
    if (animation.loop) elapsed %= total;
    else if (elapsed >= total) return animation.playback === 'ping_pong' ? 0 : sequence.at(-1);
    for (let i=0;i<sequence.length;i++) { if (elapsed < durations[i]) return sequence[i]; elapsed -= durations[i]; }
    return sequence.at(-1);
  }
  function drawPreview() {
    const is3d = view !== 'texture' && preview.available;
    $('playerPreview').hidden = !is3d; $('skinPreview').hidden = is3d; $('orbitHint').hidden = !is3d;
    $('outerLayer').disabled = !is3d; $('autoRotate').disabled = !is3d; $('resetCamera').disabled = !is3d;
    preview.setActive(activeTab === 'frames' && is3d);
    if (activeTab !== 'frames') return;
    const animation = selected(), image = getImage(animation?.frames[selectedFrame]);
    if (is3d) { preview.show(image,project.model); return; }
    $('previewModel').textContent = 'SKIN MAP · 64 × 64';
    const canvas = $('skinPreview'), context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false; context.clearRect(0,0,canvas.width,canvas.height);
    if (image?.complete && image.naturalWidth) context.drawImage(image,0,0,64,64,20,20,280,280);
  }
  function animate(now) {
    if (project) {
      if (playing) {
        const next = frameAt(selected(),now-started);
        if (next !== selectedFrame) { selectedFrame = next; updateInspector(); }
      }
      $('frameScrubber').value = selectedFrame;
      $('framePosition').textContent = `${String(selected().frames.length ? selectedFrame+1 : 0).padStart(2,'0')} / ${String(selected().frames.length).padStart(2,'0')}`;
      document.querySelectorAll('[data-frame]').forEach(button=>button.classList.toggle('selected',Number(button.dataset.frame) === selectedFrame));
      drawPreview();
      if(activeTab==='wheel')ExpressionfulWheelPreview.draw($('wheelPreview'),project,wheelSlot,now,getImage);
    }
    requestAnimationFrame(animate);
  }
  function pauseAt(index) { playing = false; selectedFrame = index; $('playPause').textContent = '▶'; $('playPause').setAttribute('aria-label','Play preview'); updateInspector(); drawPreview(); }
  function conditionType(rule) {
    const name = C.asList(rule.when)[0] || 'always', normalized = C.normalize(name) || '';
    if (/^[a-z_]+\s*(?:==|!=|<=|>=|=|<|>)/.test(name) || /^[a-z_]+(?:==|!=|<=|>=|<|>)/.test(normalized)) return 'attribute';
    if (normalized.startsWith('effect:')) return 'effect';
    if (C.catalog.states.includes(normalized) || C.catalog.events.includes(normalized)) return 'trigger';
    return 'custom';
  }
  function triggerOptions(current) {
    return `<optgroup label="Common moments">${options([{value:'wasdamaged',label:'Take damage'},{value:'idle',label:'Standing idle'},{value:'sneaking',label:'Sneaking'},{value:'attack',label:'Swing / attack'},{value:'jump',label:'Jump'},{value:'land',label:'Land'}],current)}</optgroup><optgroup label="All player states">${options(C.catalog.states.map(value=>({value,label:pretty(value)})),current)}</optgroup><optgroup label="All events">${options(C.catalog.events.map(value=>({value,label:pretty(value)})),current)}</optgroup>`;
  }
  function rangeFields(index,name,label,def,min,max) {
    const value = project.rules[index][name] ?? def, pair = Array.isArray(value) ? value : [value,value];
    return `<label class="field">${label}<div class="range-inputs"><input type="number" data-rule="${index}" data-range="${name}" data-bound="0" value="${pair[0]}" min="${min}" max="${max}" step="any" aria-label="Rule ${index+1} ${label} minimum"><span>to</span><input type="number" data-rule="${index}" data-range="${name}" data-bound="1" value="${pair[1]}" min="${min}" max="${max}" step="any" aria-label="Rule ${index+1} ${label} maximum"></div></label>`;
  }
  function renderRules() {
    const open = new Set([...document.querySelectorAll('.rule-advanced[open]')].map(node=>node.dataset.details));
    $('noRules').hidden = !!project.rules.length;
    $('ruleList').innerHTML = project.rules.map((rule,index) => {
      const type = conditionType(rule), raw = C.asList(rule.when)[0] || 'always';
      const normalized = C.normalize(raw), targets = C.choices(rule);
      let input = '';
      if (type === 'trigger') input = `<select data-rule="${index}" data-condition="trigger" aria-label="Rule ${index+1} trigger">${triggerOptions(normalized === 'damaged' ? 'wasdamaged' : normalized)}</select>`;
      if (type === 'attribute') {
        const match = /^([a-z_]+)\s*(==|!=|<=|>=|=|<|>)\s*(.+)$/.exec(raw) || /^([a-z_]+)\s*(==|!=|<=|>=|=|<|>)\s*(.+)$/.exec(normalized) || ['','health','==','1'];
        const attributeOptions = [...new Set(['health','hearts','hunger','hunger_bars','health_percent',...C.catalog.values])].map(value=>({value,label:C.catalog.attributes[value]?.label || pretty(value)}));
        input = `<select data-rule="${index}" data-condition="attribute" aria-label="Rule ${index+1} attribute">${options(attributeOptions,match[1])}</select><select class="operator" data-rule="${index}" data-condition="operator" aria-label="Rule ${index+1} comparison">${options(['==','<=','>=','<','>','!='],match[2] === '=' ? '==' : match[2])}</select><input type="number" step="any" data-rule="${index}" data-condition="value" value="${escape(match[3])}" aria-label="Rule ${index+1} attribute value">`;
      }
      if (type === 'effect') input = `<select data-rule="${index}" data-condition="effect" aria-label="Rule ${index+1} effect">${options([...C.catalog.effects.map(name=>({value:'effect:minecraft:'+name,label:pretty(name)})),...(!C.catalog.effects.some(name=>'effect:minecraft:'+name === normalized) ? [{value:normalized,label:normalized}] : [])],normalized)}</select>`;
      if (type === 'custom') input = `<input data-rule="${index}" data-condition="custom" value="${escape(raw)}" placeholder="e.g. biome:minecraft:desert" aria-label="Rule ${index+1} condition expression">`;
      return `<article class="rule-card" data-rule-card="${index}"><div class="rule-topline"><span class="rule-number">RULE ${String(index+1).padStart(2,'0')}</span><div class="inline-actions"><button class="text-button" data-duplicate-rule="${index}" aria-label="Duplicate rule ${index+1}">Duplicate</button><button class="icon-button" data-delete-rule="${index}" aria-label="Delete rule ${index+1}">×</button></div></div><div class="rule-main"><div><label class="field">When<select data-rule="${index}" data-condition-type aria-label="Rule ${index+1} condition type">${options([{value:'trigger',label:'Player state or event'},{value:'attribute',label:'Attribute comparison'},{value:'effect',label:'Has status effect'},{value:'custom',label:'Custom condition / alias'}],type)}</select></label><div class="rule-condition">${input}</div>${type === 'attribute' ? '<p class="rule-help">Health: 1 HP = ½ heart. Hunger: 2 points = one food icon.</p>' : ''}</div><label class="field">Play animation<select data-rule="${index}" data-field="animation" aria-label="Rule ${index+1} animation">${options(project.animations.map(a=>a.id),targets[0]?.animation)}</select></label></div>
        <details class="rule-advanced" data-details="${index}" ${open.has(String(index)) ? 'open' : ''}><summary>Timing, chance & advanced controls</summary><div class="rule-options"><label class="field">Playback mode<select data-rule="${index}" data-field="mode" aria-label="Rule ${index+1} mode">${options([{value:'',label:'Automatic'},{value:'state',label:'While true'},{value:'event',label:'When event happens'},{value:'enter',label:'On entering'},{value:'exit',label:'On leaving'},{value:'random',label:'Random intervals'}],rule.mode || '')}</select></label><label class="field">Priority<input data-rule="${index}" data-field="priority" type="number" step="1" value="${rule.priority ?? 0}" aria-label="Rule ${index+1} priority"></label><label class="field">Chance (%)<input data-rule="${index}" data-field="chance" type="number" min="0" max="100" step="1" value="${(rule.chance ?? 1)*100}" aria-label="Rule ${index+1} chance"></label>${rangeFields(index,'interval','Interval (seconds)',3,.05,86400)}${rangeFields(index,'cooldown','Cooldown (seconds)',0,0,86400)}${rangeFields(index,'delay','Delay (seconds)',0,0,3600)}${rangeFields(index,'speed','Speed multiplier',1,.1,8)}${rangeFields(index,'duration','Hold duration (seconds)',0,0,86400)}<label class="field">Repeats<input data-rule="${index}" data-field="repeats" type="number" min="1" max="100" value="${rule.repeats ?? 1}" aria-label="Rule ${index+1} repeats"></label><label class="field wide">Also require (comma-separated)<input data-rule="${index}" data-field="all" value="${escape(C.asList(rule.all).join(', '))}" placeholder="e.g. grounded, health <= 5" aria-label="Rule ${index+1} required conditions"></label><label class="field wide">Except when (comma-separated)<input data-rule="${index}" data-field="not" value="${escape(C.asList(rule.not).join(', '))}" placeholder="e.g. burning, in_gui" aria-label="Rule ${index+1} excluded conditions"></label><label class="check-field"><input data-rule="${index}" data-field="avoid_repeat" type="checkbox" ${rule.avoid_repeat !== false ? 'checked' : ''}>Avoid repeated variants</label><label class="check-field"><input data-rule="${index}" data-field="interruptible" type="checkbox" ${rule.interruptible !== false ? 'checked' : ''}>Allow interruption</label></div><div class="weights">${targets.map((target,choice)=>`<div class="weight-row"><select data-rule="${index}" data-choice="${choice}" aria-label="Rule ${index+1} variant ${choice+1}">${options(project.animations.map(a=>a.id),target.animation)}</select><input data-rule="${index}" data-weight="${choice}" type="number" min="0.01" max="1000000" step="any" value="${target.weight}" aria-label="Rule ${index+1} variant ${choice+1} weight"><button class="icon-button" data-remove-choice="${index}:${choice}" aria-label="Remove variant ${choice+1}" ${targets.length === 1 ? 'disabled' : ''}>×</button></div>`).join('')}<button class="text-button" data-add-choice="${index}">+ Add weighted variant</button></div></details><p class="rule-summary">${escape(raw)} <span aria-hidden="true">→</span> ${escape(targets.map(t=>t.animation).join(' / '))}</p></article>`;
    }).join('');
  }
  function setChoices(rule,targets) {
    delete rule.animation; delete rule.animations;
    if (targets.length === 1 && targets[0].weight === 1) rule.animation = targets[0].animation;
    else rule.animations = Object.fromEntries(targets.map(t=>[t.animation,t.weight]));
  }
  function addRule(preset = 'damage') {
    const target = selectedId || project.fallback;
    const defaults = {
      damage:{when:'wasdamaged',animation:target,priority:100}, hunger:{when:'hunger == 2',animation:target,priority:60},
      health:{when:'health == 1',animation:target,priority:80}, speed:{when:'has_speed',animation:target,priority:50},
      random:{when:'idle',animation:target,mode:'random',interval:[3,8],priority:5,not:['in_gui']}
    };
    if (project.rules.length >= C.LIMITS.rules) return toast('A pack supports at most 256 rules.',true);
    project.rules.push({...defaults[preset]}); openTab('rules'); changed();
    requestAnimationFrame(()=>$('ruleList').lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'}));
  }
  async function decodeFrame(file) {
    if (!file.name.toLowerCase().endsWith('.png')) throw Error('Choose PNG skin files.');
    const bytes = new Uint8Array(await file.arrayBuffer()); C.validatePng(bytes);
    const data = C.pngData(bytes), image = new Image(); image.src = data;
    await image.decode(); if (image.width !== 64 || image.height !== 64) throw Error('Each skin must be 64 × 64 pixels.');
    return { key:C.uid(),name:file.name,data };
  }
  async function uploadFrames(files, replace = false) {
    if (!files.length) return;
    try {
      const list = [...files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
      if (!replace && project.animations.reduce((n,a)=>n+a.frames.length,0)+list.length > C.LIMITS.frames) throw Error('A pack supports at most 512 frames.');
      const frames = await Promise.all(list.map(decodeFrame));
      if (replace) selected().frames.splice(selectedFrame,1,{...frames[0],...(selected().frames[selectedFrame]?.ms != null ? {ms:selected().frames[selectedFrame].ms} : {})}); else selected().frames.push(...frames);
      images.clear(); if (replace) pauseAt(selectedFrame); else resetPlayback(); changed(); toast(replace ? 'Frame replaced.' : `${frames.length} frame${frames.length === 1 ? '' : 's'} added.`);
    } catch (error) { failure(error); }
    $('frameUpload').value = ''; $('replaceUpload').value = '';
  }
  function download(bytes,name,type) {
    const url = URL.createObjectURL(new Blob([bytes],{type})); const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function exportPack() {
    try { const bytes = C.exportZip(project); download(bytes,(project.name.trim().replace(/[^a-z0-9_-]+/gi,'-') || 'skin-pack')+'.zip','application/zip'); toast('Skin pack exported. Put the ZIP in Minecraft’s skinpacks folder.'); }
    catch (error) { openTab('manifest'); $('validationPanel').scrollIntoView({behavior:'smooth',block:'nearest'}); failure(error); }
  }
  function loadProject(value) { project=value; selectedId=project.animations[0].id; images.clear(); resetPlayback(); render(); scheduleSave(); }
  function renderWheel(){
    const entries=C.wheelEntries(project);if(wheelSlot>entries.length)wheelSlot=1;
    const entry=entries[wheelSlot-1];
    $('wheelSlotTitle').textContent=entry ? pretty(entry.animation) : 'Expression preview';
    $('wheelCount').textContent=project.animations.length>16 ? `Showing the first 16 of ${project.animations.length} animations, in pack order.` : `${entries.length} expression${entries.length===1?'':'s'} from your pack. Add or remove animations in the Animations tab; the wheel resizes automatically.`;
    $('wheelPreview').setAttribute('aria-label',`${entries.length}-expression wheel preview`);
    setValue('wheelLabel',entry?.label ?? entry?.animation ?? '');setValue('wheelPreviewType',entry?.preview ?? 'head');
    setValue('wheelYaw',entry?.yaw ?? 30);setValue('wheelPitch',entry?.pitch ?? -5);
    for(const key of ['wheelLabel','wheelPreviewType','wheelYaw','wheelPitch','clearWheelSlot'])$(key).disabled=!entry;
    const flat=['face','skin'].includes(entry?.preview);$('wheelYaw').disabled=!entry||flat;$('wheelPitch').disabled=!entry||flat;
    $('wheelSlotButtons').innerHTML=entries.map(entry=>`<button data-wheel-slot="${entry.slot}" aria-pressed="${entry.slot===wheelSlot}" title="${escape(entry.animation)}">${escape(entry.label)}</button>`).join('');
  }
  $('wheelSlotButtons').addEventListener('click',event=>{const button=event.target.closest('[data-wheel-slot]');if(button){wheelSlot=Number(button.dataset.wheelSlot);renderWheel();}});
  $('wheelPreview').addEventListener('click',event=>{const r=event.target.getBoundingClientRect(),slot=ExpressionfulWheelPreview.hit((event.clientX-r.left)*480/r.width,(event.clientY-r.top)*360/r.height,C.wheelEntries(project).length);if(slot){wheelSlot=slot;renderWheel();}});
  for(const [id,key] of [['wheelLabel','label'],['wheelPreviewType','preview'],['wheelYaw','yaw'],['wheelPitch','pitch']])$(id).addEventListener(id==='wheelPreviewType'?'change':'input',()=>{
    const animation=C.wheelEntries(project)[wheelSlot-1]?.animation;if(!animation)return;
    project.wheel ??=[];let entry=project.wheel.find(e=>e.animation===animation);
    if(!entry){entry={animation};project.wheel.push(entry);}
    entry[key]=['yaw','pitch'].includes(key)?Number($(id).value):$(id).value;
    renderWheel();changed(false);
  });
  $('clearWheelSlot').addEventListener('click',()=>{const animation=C.wheelEntries(project)[wheelSlot-1]?.animation;project.wheel=(project.wheel || []).filter(e=>e.animation!==animation);changed();});
  function uniqueId(base) { let id=base.slice(0,40), number=2; while(project.animations.some(a=>a.id===id)) { const suffix='_'+number++; id=base.slice(0,40-suffix.length)+suffix; } return id; }
  function reference() {
    const query=$('referenceSearch').value.toLowerCase();
    const entries=[...Object.entries(C.catalog.aliases),...C.catalog.states.map(s=>[s,'Player state']),...C.catalog.events.map(s=>[s,'Event']),...Object.entries(C.catalog.attributes).map(([key,value])=>[key+' == number',value.label || value.value])];
    $('referenceList').innerHTML=entries.filter(([a,b])=>(a+' '+b).toLowerCase().includes(query)).map(([a,b])=>`<div class="reference-row"><code>${escape(a)}</code><span>${escape(b)}</span></div>`).join('');
  }
  $('packName').addEventListener('input',()=>{project.name=$('packName').value;changed(false);});
  $('packDescription').addEventListener('input',()=>{project.description=$('packDescription').value;changed(false);});
  $('packAuthor').addEventListener('input',()=>{project.author=$('packAuthor').value;changed(false);});
  $('packVersion').addEventListener('input',()=>{project.packVersion=$('packVersion').value;changed(false);});
  $('choosePackIcon').addEventListener('click',()=>$('packIconUpload').click());
  $('packIconUpload').addEventListener('change',async event=>{
    try {
      const file=event.target.files[0]; if(!file)return;
      if(file.size>C.LIMITS.file)throw Error('Pack icons must be at most 64 KiB.');
      const bytes=new Uint8Array(await file.arrayBuffer()); C.validatePng(bytes,true);
      const data=C.pngData(bytes), image=new Image(); image.src=data; await image.decode();
      project.icon=data; changed(false); toast('Pack icon updated.');
    } catch(error){failure(error);} finally{event.target.value='';}
  });
  $('removePackIcon').addEventListener('click',()=>{project.icon='';changed(false);});
  $('packModel').addEventListener('change',()=>{project.model=$('packModel').value;changed();});
  $('packDefault').addEventListener('change',()=>{project.fallback=$('packDefault').value;changed();});
  $('useAliases').addEventListener('change',()=>{project.useAliases=$('useAliases').checked;changed(false);});
  $('animationId').addEventListener('change',()=>{try{const next=$('animationId').value.trim();C.renameAnimation(project,selectedId,next);selectedId=next;changed();}catch(error){$('animationId').value=selectedId;failure(error);}});
  $('animationFps').addEventListener('change',()=>{const fps=Number($('animationFps').value);if(fps<.1||fps>120||!Number.isFinite(fps)){failure(Error('FPS must be 0.1–120.'));$('animationFps').value=selected().fps;return;}selected().fps=fps;resetPlayback();changed();});
  $('animationPlayback').addEventListener('change',()=>{selected().playback=$('animationPlayback').value;resetPlayback();changed();});
  $('animationLoop').addEventListener('change',()=>{selected().loop=$('animationLoop').checked;resetPlayback();changed();});
  $('frameDuration').addEventListener('change',()=>{const frame=selected().frames[selectedFrame];if(!$('frameDuration').value)delete frame.ms;else{const ms=Number($('frameDuration').value);if(ms<1||ms>60000){failure(Error('Frame duration must be 1–60000 ms.'));return;}frame.ms=ms;}changed();});
  $('frameDuration').addEventListener('focus',()=>pauseAt(selectedFrame));
  $('playPause').addEventListener('click',()=>{if(playing)pauseAt(selectedFrame);else resetPlayback();});
  $('frameScrubber').addEventListener('input',()=>pauseAt(Number($('frameScrubber').value)));
  for(const [id,value]of [['view3d','3d'],['viewFront','front'],['viewBack','back'],['viewTexture','texture']])$(id).addEventListener('click',()=>{view=preview.available ? value : 'texture';for(const key of ['view3d','viewFront','viewBack','viewTexture'])$(key).setAttribute('aria-pressed',key===(view==='texture'?'viewTexture':id));if(view!=='texture')preview.setView(view);drawPreview();});
  $('outerLayer').addEventListener('change',()=>preview.setOuterLayer($('outerLayer').checked));
  $('autoRotate').addEventListener('change',()=>{preview.rotating=$('autoRotate').checked;});
  $('resetCamera').addEventListener('click',()=>{$('view3d').click();});
  $('playerPreview').addEventListener('pointerdown',()=>{for(const id of ['view3d','viewFront','viewBack'])$(id).setAttribute('aria-pressed',id==='view3d');});
  $('frameUpload').addEventListener('change',event=>uploadFrames(event.target.files));
  $('replaceUpload').addEventListener('change',event=>uploadFrames(event.target.files,true));
  $('replaceFrame').addEventListener('click',()=>$('replaceUpload').click());
  $('duplicateFrame').addEventListener('click',()=>{if(project.animations.reduce((n,a)=>n+a.frames.length,0)>=512)return failure(Error('Frame limit reached.'));selected().frames.splice(selectedFrame+1,0,{...selected().frames[selectedFrame],key:C.uid()});selectedFrame++;pauseAt(selectedFrame);changed();});
  $('removeFrame').addEventListener('click',()=>{selected().frames.splice(selectedFrame,1);selectedFrame=Math.max(0,selectedFrame-1);pauseAt(selectedFrame);changed();});
  function moveFrame(direction){const frames=selected().frames,index=selectedFrame+direction;if(index<0||index>=frames.length)return;[frames[index],frames[selectedFrame]]=[frames[selectedFrame],frames[index]];pauseAt(index);changed();}
  $('moveFrameLeft').addEventListener('click',()=>moveFrame(-1));$('moveFrameRight').addEventListener('click',()=>moveFrame(1));
  $('frameList').addEventListener('click',event=>{const frame=event.target.closest('[data-frame]');if(frame)pauseAt(Number(frame.dataset.frame));if(event.target.closest('[data-upload-frames]'))$('frameUpload').click();});
  $('frameList').addEventListener('dragstart',event=>{const card=event.target.closest('[data-frame]');if(card){draggedFrame=Number(card.dataset.frame);event.dataTransfer.setData('text/plain',String(draggedFrame));event.dataTransfer.effectAllowed='move';}});
  $('frameList').addEventListener('dragend',()=>{draggedFrame=-1;});
  $('frameList').addEventListener('dragover',event=>event.preventDefault());
  $('frameList').addEventListener('drop',event=>{event.preventDefault();const card=event.target.closest('[data-frame]');if(!card||draggedFrame<0)return;const target=Number(card.dataset.frame),[frame]=selected().frames.splice(draggedFrame,1);selected().frames.splice(target,0,frame);draggedFrame=-1;pauseAt(target);changed();});
  $('dropZone').addEventListener('dragover',event=>{event.preventDefault();$('dropZone').classList.add('drag-over');});
  $('dropZone').addEventListener('dragleave',()=>$('dropZone').classList.remove('drag-over'));
  $('dropZone').addEventListener('drop',event=>{event.preventDefault();$('dropZone').classList.remove('drag-over');uploadFrames(event.dataTransfer.files);});
  $('dropZone').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('frameUpload').click();}});
  $('animationList').addEventListener('click',event=>{const button=event.target.closest('[data-select-animation]');if(button){selectedId=button.dataset.selectAnimation;resetPlayback();render();openTab('frames');}});
  $('addAnimation').addEventListener('click',()=>{if(project.animations.length>=128)return failure(Error('Animation limit reached.'));$('newAnimationId').value='';$('animationDialog').showModal();$('newAnimationId').focus();});
  $('animationForm').addEventListener('submit',event=>{event.preventDefault();const id=$('newAnimationId').value.trim();if(project.animations.some(a=>a.id===id))return failure(Error('That animation ID already exists.'));project.animations.push({id,fps:10,loop:false,playback:'forward',frames:[]});selectedId=id;resetPlayback();$('animationDialog').close();changed();openTab('frames');});
  $('duplicateAnimation').addEventListener('click',()=>{if(project.animations.length>=128)return failure(Error('Animation limit reached.'));const copy=JSON.parse(JSON.stringify(selected()));copy.id=uniqueId(copy.id+'_copy');copy.frames.forEach(f=>f.key=C.uid());project.animations.push(copy);selectedId=copy.id;resetPlayback();changed();});
  $('deleteAnimation').addEventListener('click',()=>{if(project.animations.length===1)return failure(Error('Keep at least one animation in your pack.'));if(!confirm('Delete this animation and remove its rule assignments?'))return;const id=selectedId;project.animations=project.animations.filter(a=>a.id!==id);project.wheel=(project.wheel || []).filter(e=>e.animation!==id);project.rules=project.rules.filter(rule=>{const remaining=C.choices(rule).filter(t=>t.animation!==id);if(!remaining.length)return false;setChoices(rule,remaining);return true;});if(project.fallback===id)project.fallback=project.animations[0].id;selectedId=project.animations[0].id;resetPlayback();changed();});
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.tab)));
  document.querySelectorAll('[data-go-tab]').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.goTab)));
  document.querySelectorAll('.no-frames [data-upload-frames]').forEach(button=>button.addEventListener('click',()=>$('frameUpload').click()));
  document.querySelector('.tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.findIndex(button=>button.dataset.tab===activeTab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();});
  $('reviewExport').addEventListener('click',()=>openTab('manifest'));
  $('assignRule').addEventListener('click',()=>addRule());
  document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>addRule(button.dataset.preset)));
  $('addRule').addEventListener('click',()=>addRule());
  $('ruleList').addEventListener('change',event=>{
    const target=event.target,index=Number(target.dataset.rule);if(!Number.isInteger(index)||!project.rules[index])return;const rule=project.rules[index];
    if(target.hasAttribute('data-condition-type')){rule.when=({trigger:'wasdamaged',attribute:'health == 1',effect:'has_speed',custom:'always'})[target.value];delete rule.mode;}
    else if(target.dataset.condition){const card=target.closest('.rule-card');if(target.dataset.condition==='attribute'||target.dataset.condition==='operator'||target.dataset.condition==='value'){const a=card.querySelector('[data-condition="attribute"]').value,o=card.querySelector('[data-condition="operator"]').value,v=card.querySelector('[data-condition="value"]').value;rule.when=`${a} ${o} ${v}`;}else rule.when=target.value;}
    else if(target.dataset.range){const existing=rule[target.dataset.range]??(target.dataset.range==='speed'?1:target.dataset.range==='interval'?3:0),range=Array.isArray(existing)?[...existing]:[existing,existing];range[Number(target.dataset.bound)]=Number(target.value);rule[target.dataset.range]=range[0]===range[1]?range[0]:range;}
    else if(target.hasAttribute('data-choice')||target.hasAttribute('data-weight')){const choices=C.choices(rule),i=Number(target.dataset.choice??target.dataset.weight);if(target.hasAttribute('data-choice')){if(choices.some((c,j)=>j!==i&&c.animation===target.value)){failure(Error('Each variant must use a different animation.'));renderRules();return;}choices[i].animation=target.value;}else choices[i].weight=Number(target.value);setChoices(rule,choices);}
    else if(target.dataset.field){const field=target.dataset.field;if(field==='animation'){const choices=C.choices(rule);choices[0].animation=target.value;if(new Set(choices.map(c=>c.animation)).size!==choices.length){failure(Error('That animation is already a variant.'));renderRules();return;}setChoices(rule,choices);}else if(target.type==='checkbox')rule[field]=target.checked;else if(field==='all'||field==='not'){const list=target.value.split(',').map(v=>v.trim()).filter(Boolean);if(list.length)rule[field]=list;else delete rule[field];}else if(target.type==='number')rule[field]=Number(target.value)/(field==='chance'?100:1);else if(target.value)rule[field]=target.value;else delete rule[field];}
    changed();
  });
  $('ruleList').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-delete-rule'))project.rules.splice(Number(button.dataset.deleteRule),1);
    else if(button.hasAttribute('data-duplicate-rule')){if(project.rules.length>=256)return;const i=Number(button.dataset.duplicateRule);project.rules.splice(i+1,0,JSON.parse(JSON.stringify(project.rules[i])));}
    else if(button.hasAttribute('data-add-choice')){const rule=project.rules[Number(button.dataset.addChoice)],targets=C.choices(rule),next=project.animations.find(a=>!targets.some(t=>t.animation===a.id));if(!next)return failure(Error('Add another animation before adding a new variant.'));if(targets.length>=32)return failure(Error('Use at most 32 variants.'));targets.push({animation:next.id,weight:1});setChoices(rule,targets);}
    else if(button.hasAttribute('data-remove-choice')){const [i,j]=button.dataset.removeChoice.split(':').map(Number),targets=C.choices(project.rules[i]);targets.splice(j,1);setChoices(project.rules[i],targets);}else return;
    changed();
  });
  $('importPack').addEventListener('click',()=>$('packUpload').click());
  $('packUpload').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;const next=C.importZip(new Uint8Array(await file.arrayBuffer()));if(!confirm('Replace the current draft with this skin pack?'))return;loadProject(next);toast('Pack imported. Frames and rules are ready to edit.');}catch(error){failure(error);}finally{event.target.value='';}});
  $('exportPack').addEventListener('click',exportPack);
  $('jsonFile').addEventListener('change',updateManifest);
  $('downloadManifest').addEventListener('click',()=>download($('manifestPreview').textContent+'\n',$('jsonFile').value,'application/json'));
  $('newPack').addEventListener('click',()=>{if(confirm('Start a new pack? Export your current draft first if you want to keep it.')){loadProject(C.newProject());openTab('pack');}});
  $('loadDemo').addEventListener('click',()=>{if(confirm('Replace the current draft with the example pack?'))loadProject(C.importZip(C.unbase64(ExpressionfulDemo)));});
  $('openReference').addEventListener('click',()=>{reference();$('referenceDialog').showModal();});$('referenceSearch').addEventListener('input',reference);
  document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();exportPack();}});
  try { database=await openDatabase(); project=await databaseAction('readonly',store=>store.get('current')); }
  catch(error){console.warn('Draft storage unavailable',error);}
  if(!project?.animations?.length)project=C.importZip(C.unbase64(ExpressionfulDemo));
  selectedId=project.animations[0].id;render();openTab('frames');scheduleSave();requestAnimationFrame(animate);
  if(!preview.available)$('viewTexture').click();
  window.addEventListener('pagehide',()=>preview.dispose(),{once:true});
  window.ExpressionfulStudio={getProject:()=>JSON.parse(JSON.stringify(project)),loadProject,exportZip:()=>C.exportZip(project),openTab,previewState:()=>preview.state()};
})();
