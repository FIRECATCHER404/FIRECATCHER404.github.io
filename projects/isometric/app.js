import {ASSETS,TERRAIN,SWATCHES,THEMES} from './catalog.js';
import {clone,preset,checkedMap,filename,paint,addProp,moveProp,canPlace,footprint,dimensions,localSize,tileAt,propAt,brushCells,lineCells,floodCells,resizeMap,key} from './model.js';
import {defaultEnvironment} from './lighting.js';
import {defaultView,checkedView} from './camera.js';
import {MapRenderer,thumbnails} from './renderer.js';

const $=id=>document.getElementById(id),canvas=$('world'),small=()=>matchMedia('(max-width:620px)').matches;
let project=preset(),view=defaultView(),engine,tool='paint',category='terrain',material='grass',asset='oak',rotation=0,tint=null,brush=1,fill=false,selected=null,hover=null,stroke=null,space=false,blockedTouch=false,pinch=null;
const undo=[],redo=[],pointers=new Map();let saveTimer,toastTimer,db;
let pieceSize=null,terrainTint=null,terrainEdge=null,terrainDetail='auto',brushShape='square',terrainLevel=0,lightingBefore=null;
function toast(text,error=false){$('toast').textContent=text;$('toast').className='visible'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',error?5000:2800);}
const snapshot=()=>({project:clone(project),view:clone(view)});
function queueSave(){clearTimeout(saveTimer);const saved=snapshot();saveTimer=setTimeout(async()=>{try{const d=await database();const tx=d.transaction('draft','readwrite');tx.objectStore('draft').put(saved,'current');await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject;});}catch{toast('Your browser could not save the draft. Use Scene → Save map to keep a copy.',true);}},350);}
function database(){if(!db)db=new Promise((resolve,reject)=>{const r=indexedDB.open('neoj-isometric-map',1);r.onupgradeneeded=()=>r.result.createObjectStore('draft');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return db;}
function updateUI(){
  $('map-title').textContent=project.name+' · '+project.width+' × '+project.depth;$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
  document.querySelectorAll('button[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===tool||b.dataset.tool==='paint'&&tool==='stamp'));
  document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.category===category));
  document.querySelectorAll('[data-brush]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.brush)===brush));$('fill').setAttribute('aria-pressed',fill);
  document.querySelectorAll('[data-piece]').forEach(b=>b.setAttribute('aria-pressed',category==='terrain'?b.dataset.piece===material:b.dataset.piece===asset));
  $('brush-options').hidden=category!=='terrain';$('prop-options').hidden=category==='terrain';$('tint-options').hidden=category==='terrain';const d=dimensions(asset,rotation,pieceSize);$('footprint').textContent=d.w+' × '+d.d+' tiles';syncSize('piece',ASSETS[asset],pieceSize??ASSETS[asset]);$('piece-color').value=tint??ASSETS[asset].color;
  $('palette-toggle').setAttribute('aria-expanded',!$('palette').hidden);canvas.dataset.tool=tool;$('palette-help').textContent=category==='terrain'?'Paint a path. Raise a hill. Make it yours.':small()?'Tap to place. Use two fingers to move the view.':'Click to place. Press R to turn a piece.';
  const e=project.props.find(e=>e.id===selected);$('inspector').hidden=!e||!$('settings').hidden;if(e){$('selected-name').textContent=ASSETS[e.type].name;syncSize('selected',ASSETS[e.type],localSize(e));$('selected-color').value=e.tint??ASSETS[e.type].color;}
  $('brush-shape').setAttribute('aria-pressed',brushShape==='circle');$('use-terrain-tint').checked=terrainTint!==null;$('use-terrain-edge').checked=terrainEdge!==null;$('terrain-tint').value=terrainTint??TERRAIN[material].color;$('terrain-edge').value=terrainEdge??TERRAIN[material].side;$('terrain-detail').value=terrainDetail;$('terrain-level').value=terrainLevel;$('terrain-level-value').value=terrainLevel;syncSun();
  document.querySelectorAll('[data-tint]').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.tint||null)===tint));
}
function draw(omit=null){engine.rebuild(project,omit);engine.setView(view);updateUI();guides();}
function commit(before){if(JSON.stringify(before.project)===JSON.stringify(project))return false;undo.push(before);while(undo.length>40)undo.shift();redo.length=0;queueSave();updateUI();return true;}
function edit(action){finishLighting();if(stroke)cancelGesture();const before=snapshot();try{action();commit(before);draw();}catch(e){project=before.project;view=before.view;draw();toast(e.message,true);}}
function restore(s){project=s.project;view=s.view;selected=null;hover=null;draw();queueSave();}
function history(direction){finishLighting();cancelGesture();const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;if(!from.length)return;to.push(snapshot());restore(from.pop());}
function setTool(value){tool=value;fill=false;hover=null;if(['raise','lower','level','smooth','sample'].includes(value)&&category!=='terrain'){category='terrain';pieces();}engine.clearGuides();updateUI();}
function setPalette(open){$('palette').hidden=!open;resize();updateUI();}
function resize(){engine.resize(view,!small()&&!$('palette').hidden?296:0);$('hint').textContent=small()?'Tap to build · pinch to zoom · two fingers to pan':'Drag to build · scroll to zoom · space to pan';}
function fitMap(){view=engine.fitted(view.quarter);engine.setView(view,true);queueSave();}
function candidate(cell){return{type:asset,x:cell.x,z:cell.z,rotation,tint,...(pieceSize?{size:clone(pieceSize)}:{})};}
function guides(){
  const chosen=project.props.find(e=>e.id===selected);if(!hover){engine.showGuides([],null,true,chosen);return;}
  if(stroke?.kind==='move'&&stroke.moving){const c=stroke.candidate,ok=c&&canPlace(project,c,selected).ok;engine.showGuides(c?footprint(c):[],c,ok,chosen);return;}
  if(tool==='stamp'){const e=candidate(hover),s=canPlace(project,e);engine.showGuides(footprint(e),e,s.ok,chosen);}
  else if(['paint','raise','lower','level','smooth','erase','sample'].includes(tool))engine.showGuides(brushCells(project,hover.x,hover.z,tool==='sample'?1:brush,brushShape),null,true,chosen);
  else engine.showGuides([],null,true,chosen);
}
function applyAt(cell){
  if(!cell)return;const visited=stroke.visited;
  for(const c of stroke.last?lineCells(stroke.last,cell):[cell]){
    if(tool==='stamp'){if(visited.has(key(c.x,c.z)))continue;visited.add(key(c.x,c.z));try{addProp(project,candidate(c));stroke.changed=true;}catch(e){stroke.error=e.message;}continue;}
    if(tool==='erase'&&stroke.eraseProps){const e=propAt(project,c.x,c.z);if(e){project.props=project.props.filter(p=>p.id!==e.id);if(selected===e.id)selected=null;stroke.changed=true;}continue;}
    const cells=(fill&&tool==='paint'?floodCells(project,c.x,c.z):brushCells(project,c.x,c.z,brush,brushShape)).filter(v=>!visited.has(key(v.x,v.z)));
    cells.forEach(v=>visited.add(key(v.x,v.z)));const result=paint(project,cells,{material:tool==='paint'?material:null,delta:tool==='raise'?1:tool==='lower'?-1:0,remove:tool==='erase',...(tool==='paint'?{tint:terrainTint,edge:terrainEdge,detail:terrainDetail}:{}),...(tool==='level'?{height:stroke.level}:{}),...(tool==='smooth'?{smoothSource:stroke.before.project}:{})});stroke.changed||=result.changed;if(result.error)stroke.error=result.error;
  }
  stroke.last={x:cell.x,z:cell.z};draw();
}
function cancelGesture(){if(stroke?.before&&stroke.changed)project=stroke.before.project;if(stroke){stroke=null;draw();}pinch=null;hover=null;engine.clearGuides();}
function pan(dx,dy){const a=engine.groundPoint(0,0),b=engine.groundPoint(dx,dy);if(a&&b){view.target.x+=a.x-b.x;view.target.z+=a.z-b.z;view.target.x=Math.max(-100,Math.min(100,view.target.x));view.target.z=Math.max(-100,Math.min(100,view.target.z));engine.setView(view);}}
function zoom(factor,x=canvas.clientWidth/2,y=canvas.clientHeight/2+canvas.getBoundingClientRect().top){const a=engine.groundPoint(x,y);view.span=Math.max(4,Math.min(150,view.span*factor));engine.setView(view);const b=engine.groundPoint(x,y);if(a&&b){view.target.x+=a.x-b.x;view.target.z+=a.z-b.z;}engine.setView(view);queueSave();}
function turn(delta){view.quarter=(view.quarter+delta+4)%4;engine.setView(view);queueSave();}
function begin(event){
  if(event.button>2)return;finishLighting();event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size>1){cancelGesture();blockedTouch=true;const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};return;}
  if(blockedTouch)return;hover=engine.pick(event.clientX,event.clientY);
  if(event.button===1||event.button===2||space||tool==='hand'){stroke={kind:'pan',x:event.clientX,y:event.clientY};return;}
  if(tool==='sample'){const t=hover&&tileAt(project,hover.x,hover.z);if(t){material=t.material;terrainTint=t.tint??null;terrainEdge=t.edge??null;terrainDetail=t.detail??'auto';terrainLevel=t.height;category='terrain';setTool('paint');pieces();setPalette(true);toast('Terrain style picked.');}return;}
  if(tool==='select'){
    selected=hover?.id??null;const e=project.props.find(e=>e.id===selected);stroke=e?{kind:'move',before:snapshot(),x:event.clientX,y:event.clientY,offset:{x:hover.x-e.x,z:hover.z-e.z},original:clone(e),moving:false}:null;updateUI();guides();return;
  }
  if(!hover)return;stroke={kind:'paint',before:snapshot(),visited:new Set(),changed:false,error:null,last:null,level:terrainLevel,eraseProps:tool==='erase'&&Boolean(propAt(project,hover.x,hover.z))};applyAt(hover);
}
function move(event){
  if(pointers.has(event.pointerId))pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pinch&&pointers.size>1){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;if(distance>5&&pinch.distance>5)zoom(pinch.distance/distance,x,y);pan(x-pinch.x,y-pinch.y);pinch={distance,x,y};return;}
  if(blockedTouch)return;
  if(stroke?.kind==='pan'){pan(event.clientX-stroke.x,event.clientY-stroke.y);stroke.x=event.clientX;stroke.y=event.clientY;return;}
  if(stroke?.kind==='move'){
    if(!stroke.moving&&Math.hypot(event.clientX-stroke.x,event.clientY-stroke.y)>5){stroke.moving=true;draw(selected);}
    if(stroke.moving){hover=engine.pick(event.clientX,event.clientY,true);stroke.candidate=hover?{...stroke.original,x:hover.x-stroke.offset.x,z:hover.z-stroke.offset.z}:null;guides();}return;
  }
  hover=engine.pick(event.clientX,event.clientY);if(stroke?.kind==='paint'&&hover){if(!stroke.last||stroke.last.x!==hover.x||stroke.last.z!==hover.z)applyAt(hover);}guides();
}
function end(event,cancel=false){
  pointers.delete(event.pointerId);if(cancel){cancelGesture();if(!pointers.size)blockedTouch=false;return;}
  if(blockedTouch){if(!pointers.size){blockedTouch=false;pinch=null;queueSave();}return;}
  if(stroke?.kind==='move'&&stroke.moving){const before=stroke.before,c=stroke.candidate;stroke=null;if(c){try{moveProp(project,selected,{x:c.x,z:c.z});commit(before);}catch(e){toast(e.message,true);}}draw();}
  else if(stroke?.kind==='paint'){const before=stroke.before,error=stroke.error;stroke=null;commit(before);draw();if(error)toast(error,true);}
  else{stroke=null;queueSave();}
  if(event.pointerType==='touch'){hover=null;engine.clearGuides();}
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
function save(){download(new Blob([JSON.stringify({...project,view},null,2)],{type:'application/json'}),filename(project)+'.isomap');toast('Map saved. You can open it here again.');}
async function openFile(file){if(!file)return;try{if(file.size>3*1024*1024)throw Error('Choose a map file smaller than 3 MB.');const parsed=JSON.parse(await file.text()),next=checkedMap(parsed),nextView=checkedView(parsed.view);edit(()=>{project=next;view=nextView;selected=null;hover=null;});toast('Opened '+project.name+'.');}catch(e){toast('Could not open map: '+e.message,true);}finally{$('file').value='';}}
let images={};
function pieces(){
  $('pieces').replaceChildren();const list=category==='terrain'?TERRAIN:Object.fromEntries(Object.entries(ASSETS).filter(([,v])=>v.category===category)),query=$('piece-search').value.trim().toLowerCase();
  for(const [id,a]of Object.entries(list)){if(query&&!a.name.toLowerCase().includes(query))continue;const b=document.createElement('button');b.className='piece';b.dataset.piece=id;b.setAttribute('aria-label',a.name);b.setAttribute('aria-pressed','false');if(category==='terrain'){const s=document.createElement('span');s.className='terrain-swatch';s.style.background=a.color;b.append(s);}else{const image=document.createElement('img');image.src=images[id];image.alt='';b.append(image);}const name=document.createElement('span');name.className='piece-name';name.textContent=a.name;b.append(name);b.addEventListener('click',()=>{if(category==='terrain'){material=id;setTool('paint');}else{if(asset!==id)pieceSize=null;asset=id;setTool('stamp');}updateUI();if(small())setPalette(false);});$('pieces').append(b);}$('pieces-empty').hidden=$('pieces').childElementCount>0;updateUI();
}
function rotateSelected(){if(selected)edit(()=>{const e=project.props.find(e=>e.id===selected);moveProp(project,selected,{rotation:(e.rotation+1)%4});});}
function swatches(){for(const color of [null,...SWATCHES]){const b=document.createElement('button');b.dataset.tint=color??'';b.setAttribute('aria-label',color?'Use color '+color:'Original colors');b.title=color??'Original colors';if(color)b.style.background=color;else b.textContent='↺';b.onclick=()=>{tint=color;updateUI();guides();};$('swatches').append(b);}}

function syncSize(prefix,definition,size){
  $(prefix+'-size').hidden=!definition.resize;for(const [key,suffix]of [['w','width'],['d','length']]){const input=$(prefix+'-'+suffix),limits=definition.resize?.[key]??[definition[key],definition[key]];input.min=limits[0];input.max=limits[1];input.disabled=limits[0]===limits[1];input.value=size[key];}
}
function syncSun(){
  const env=project.environment,angle=env.azimuth*Math.PI/180,radius=(85-env.elevation)/70*62,x=80+Math.sin(angle)*radius,y=80-Math.cos(angle)*radius;
  $('sun-knob').setAttribute('cx',x);$('sun-knob').setAttribute('cy',y);$('sun-ray').setAttribute('d',`M80 80L${x} ${y}`);$('sun-readout').value=Math.round(env.elevation)+'° high';$('sun-azimuth').value=env.azimuth;$('sun-elevation').value=env.elevation;$('azimuth-value').value=Math.round(env.azimuth)+'°';$('elevation-value').value=Math.round(env.elevation)+'°';$('sun-description').textContent=env.elevation<32?'Warm, long shadows':env.elevation>65?'Bright, short shadows':'Soft afternoon light';$('ground-shadow').checked=env.groundShadow;$('void-color').value=env.background??THEMES[project.theme].background;$('theme').value=project.theme;
}
function startLighting(){lightingBefore??=snapshot();}
function previewLighting(values){startLighting();Object.assign(project.environment,values);engine.applyLighting(project);syncSun();}
function finishLighting(){if(lightingBefore){const before=lightingBefore;lightingBefore=null;commit(before);updateUI();}}
function cancelLighting(){if(lightingBefore){project.environment=lightingBefore.project.environment;lightingBefore=null;engine.applyLighting(project);updateUI();}}
function bindWorldSettings(){
  const wheel=$('sun-wheel');let wheelPointer=null;
  const position=e=>{const rect=wheel.getBoundingClientRect(),dx=(e.clientX-rect.left)/rect.width*160-80,dy=(e.clientY-rect.top)/rect.height*160-80,distance=Math.min(62,Math.hypot(dx,dy));previewLighting({azimuth:distance<2?project.environment.azimuth:(Math.atan2(dx,-dy)*180/Math.PI+360)%360,elevation:Math.max(15,Math.min(85,85-distance/62*70))});};
  wheel.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();wheel.focus({preventScroll:true});wheel.setPointerCapture(e.pointerId);wheelPointer=e.pointerId;startLighting();position(e);});wheel.addEventListener('pointermove',e=>{if(wheelPointer===e.pointerId)position(e);});wheel.addEventListener('pointerup',e=>{if(wheelPointer===e.pointerId){wheelPointer=null;finishLighting();}});wheel.addEventListener('pointercancel',()=>{wheelPointer=null;cancelLighting();});wheel.addEventListener('lostpointercapture',e=>{if(wheelPointer===e.pointerId){wheelPointer=null;cancelLighting();}});
  wheel.addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();e.stopPropagation();const env=project.environment;previewLighting({azimuth:(env.azimuth+(e.key==='ArrowRight'?5:e.key==='ArrowLeft'?-5:0)+360)%360,elevation:Math.max(15,Math.min(85,env.elevation+(e.key==='ArrowUp'?2:e.key==='ArrowDown'?-2:0)))});finishLighting();});
  for(const [id,field]of [['sun-azimuth','azimuth'],['sun-elevation','elevation'],['void-color','background']]){const input=$(id);input.addEventListener('input',()=>previewLighting({[field]:field==='background'?input.value:Number(input.value)}));input.addEventListener('change',finishLighting);input.addEventListener('pointercancel',cancelLighting);}
  $('ground-shadow').onchange=()=>edit(()=>{project.environment.groundShadow=$('ground-shadow').checked;});$('void-reset').onclick=()=>edit(()=>{project.environment.background=null;});$('theme').onchange=()=>{const value=$('theme').value;edit(()=>{project.theme=value;const e=defaultEnvironment(value);Object.assign(project.environment,{azimuth:e.azimuth,elevation:e.elevation});});};
}
function toolIcons(){const paths={paint:'M4 16 16 4l4 4L8 20H4Z M13 7l4 4',raise:'M3 20h6v-5h6v-5h6 M7 8l5-5 5 5 M12 3v10',lower:'M3 10h6v5h6v5h6 M7 4l5 5 5-5 M12 0v9',level:'M3 17h18 M5 12h14 M8 7h8',smooth:'M2 15c4-9 6-9 10 0s6 9 10 0 M2 8c4-5 6-5 10 0s6 5 10 0',erase:'m4 13 9-9 7 7-9 9H8Z M9 8l7 7 M11 20h10',select:'M5 3v17l5-6 8-1Z M12 15l4 6',hand:'M7 12V7a1.5 1.5 0 0 1 3 0v4-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7c0 8-10 8-13 3l-3-5a1.5 1.5 0 0 1 2-2l2 2'};document.querySelectorAll('button[data-tool]').forEach(b=>{b.querySelector('span').innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[b.dataset.tool]}"/></svg>`;});}

// Captured canvas gestures can suppress later native touch clicks in some browsers.
// Activate only the tapped control and suppress its matching compatibility click.
let controlTap=null;const handledTaps=new WeakMap();const tapControl=target=>target.closest('button,summary,input[type=checkbox]');
document.addEventListener('pointerdown',event=>{const control=tapControl(event.target);if(event.pointerType==='touch')controlTap=control?{control,id:event.pointerId,x:event.clientX,y:event.clientY}:null;else if(control)handledTaps.delete(control);},true);
document.addEventListener('pointercancel',()=>{controlTap=null;},true);
document.addEventListener('pointerup',event=>{const tap=controlTap;if(event.pointerType!=='touch'||!tap||tap.id!==event.pointerId)return;controlTap=null;if(tap.control===tapControl(event.target)&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<8&&!tap.control.disabled){handledTaps.set(tap.control,performance.now());tap.control.click();}},true);
document.addEventListener('click',event=>{const control=tapControl(event.target);if(event.isTrusted&&event.detail!==0&&control&&performance.now()-(handledTaps.get(control)??-Infinity)<800){event.preventDefault();event.stopImmediatePropagation();}},true);

async function start(){
  try{engine=new MapRenderer(canvas);}catch(e){$('unavailable').hidden=false;$('palette').hidden=true;document.querySelectorAll('button,summary').forEach(b=>{if(b.tagName==='BUTTON')b.disabled=true;else b.style.pointerEvents='none';});return;}
  let recovered=false;try{const d=await database(),saved=await new Promise((resolve,reject)=>{const r=d.transaction('draft').objectStore('draft').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(saved){const next=checkedMap(saved.project),nextView=checkedView(saved.view);project=next;view=nextView;recovered=true;}}catch{toast('Draft unavailable. You can still save and open map files.',true);}
  images=thumbnails();$('palette').hidden=small();engine.rebuild(project);resize();if(!recovered)fitMap();pieces();swatches();updateUI();
  canvas.addEventListener('pointerdown',begin);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))end(e,true);});canvas.addEventListener('pointerleave',()=>{if(!stroke){hover=null;engine.clearGuides();}});canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();if(stroke)return;zoom(Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.0018),e.clientX,e.clientY);},{passive:false});
  window.addEventListener('resize',resize);window.addEventListener('blur',()=>{space=false;pointers.clear();blockedTouch=false;finishLighting();cancelGesture();});
  $('palette-toggle').onclick=()=>setPalette($('palette').hidden);$('palette-close').onclick=()=>setPalette(false);
  document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;$('piece-search').value='';if(category!=='terrain'&&ASSETS[asset].category!==category){asset=Object.keys(ASSETS).find(k=>ASSETS[k].category===category);pieceSize=null;}setTool(category==='terrain'?'paint':'stamp');pieces();});$('piece-search').oninput=pieces;
  document.querySelectorAll('button[data-tool]').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool==='paint'&&category!=='terrain'?'stamp':b.dataset.tool);});
  document.querySelectorAll('[data-brush]').forEach(b=>b.onclick=()=>{brush=Number(b.dataset.brush);fill=false;updateUI();});$('fill').onclick=()=>{fill=!fill;tool='paint';category='terrain';pieces();};
  $('brush-shape').onclick=()=>{brushShape=brushShape==='circle'?'square':'circle';updateUI();};$('terrain-level').oninput=()=>{terrainLevel=Number($('terrain-level').value);setTool('level');};$('sample-terrain').onclick=()=>{setTool('sample');setPalette(false);toast('Click terrain to pick its color, material, and height.');};$('reset-terrain').onclick=()=>{terrainTint=null;terrainEdge=null;terrainDetail='auto';updateUI();};
  for(const id of ['use-terrain-tint','use-terrain-edge','terrain-tint','terrain-edge','terrain-detail'])$(id).addEventListener('input',()=>{if(id==='terrain-tint')$('use-terrain-tint').checked=true;if(id==='terrain-edge')$('use-terrain-edge').checked=true;terrainTint=$('use-terrain-tint').checked?$('terrain-tint').value:null;terrainEdge=$('use-terrain-edge').checked?$('terrain-edge').value:null;terrainDetail=$('terrain-detail').value;});
  for(const id of ['piece-width','piece-length'])$(id).onchange=()=>{const a=ASSETS[asset],size={w:Number($('piece-width').value),d:Number($('piece-length').value)};if(!['w','d'].every(k=>Number.isInteger(size[k])&&size[k]>=a.resize[k][0]&&size[k]<=a.resize[k][1])){toast('Keep the size within the shown range.',true);updateUI();return;}pieceSize=size;updateUI();guides();};$('piece-color').oninput=()=>{tint=$('piece-color').value;updateUI();guides();};
  for(const id of ['selected-width','selected-length'])$(id).onchange=()=>{const size={w:Number($('selected-width').value),d:Number($('selected-length').value)};edit(()=>moveProp(project,selected,{size}));};$('selected-color').onchange=()=>{const color=$('selected-color').value;edit(()=>moveProp(project,selected,{tint:color}));};$('selected-color-reset').onclick=()=>edit(()=>moveProp(project,selected,{tint:null}));
  $('rotate-piece').onclick=()=>{rotation=(rotation+1)%4;updateUI();guides();};$('rotate-selected').onclick=rotateSelected;$('deselect').onclick=()=>{selected=null;updateUI();guides();};$('delete-selected').onclick=()=>edit(()=>{project.props=project.props.filter(e=>e.id!==selected);selected=null;});$('duplicate').onclick=()=>{const e=project.props.find(e=>e.id===selected);asset=e.type;pieceSize=e.size?clone(e.size):null;rotation=e.rotation;tint=e.tint;category=ASSETS[asset].category;selected=null;setTool('stamp');pieces();toast('Click a free space to place the copy.');};$('clear-props').onclick=()=>{edit(()=>{project.props=[];selected=null;});$('scene-menu').open=false;};
  $('undo').onclick=()=>history('undo');$('redo').onclick=()=>history('redo');$('fit').onclick=fitMap;$('turn-left').onclick=()=>turn(-1);$('turn-right').onclick=()=>turn(1);$('zoom-in').onclick=()=>zoom(.82);$('zoom-out').onclick=()=>zoom(1/.82);
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{edit(()=>{project=preset(b.dataset.preset);selected=null;hover=null;engine.rebuild(project);view=engine.fitted(view.quarter);});$('scene-menu').open=false;toast('A fresh starting point. Undo brings your previous map back.');});
  $('save').onclick=()=>{save();$('scene-menu').open=false;};$('open').onclick=()=>{$('file').click();$('scene-menu').open=false;};$('file').onchange=()=>openFile($('file').files[0]);
  $('settings-toggle').onclick=()=>{finishLighting();$('map-name').value=project.name;$('map-width').value=project.width;$('map-depth').value=project.depth;$('settings').hidden=!$('settings').hidden;$('scene-menu').open=false;updateUI();};$('settings-close').onclick=()=>{finishLighting();$('settings').hidden=true;updateUI();};$('settings').onsubmit=e=>{e.preventDefault();finishLighting();const name=$('map-name').value.trim();if(!name){toast('Give your map a name.',true);return;}edit(()=>{resizeMap(project,Number($('map-width').value),Number($('map-depth').value));project.name=name;engine.rebuild(project);view=engine.fitted(view.quarter);});$('settings').hidden=true;updateUI();};bindWorldSettings();toolIcons();
  $('export').onclick=async()=>{const b=$('export');b.disabled=true;const label=b.innerHTML;b.textContent='Rendering…';try{const blob=await engine.exportPNG(Number($('resolution').value),$('transparent').checked);download(blob,filename(project)+'.png');toast('Your world, ready to share.');}catch(e){toast('Export failed: '+e.message,true);}finally{b.disabled=false;b.innerHTML=label;}};
  document.querySelectorAll('details.menu').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('details.menu').forEach(other=>{if(other!==d)other.open=false;});}));document.addEventListener('pointerdown',e=>{document.querySelectorAll('details.menu[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
  document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&['s','z','y'].includes(k)){e.preventDefault();if(k==='s')save();else history(k==='y'||e.shiftKey?'redo':'undo');return;}if(e.code==='Space'&&!e.target.closest('button,summary')){e.preventDefault();space=true;return;}if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(k==='r'){if(selected&&tool==='select')rotateSelected();else{rotation=(rotation+1)%4;updateUI();guides();}}else if(k==='i')$('sample-terrain').click();else if(k==='b')setTool(category==='terrain'?'paint':'stamp');else if(k==='e')setTool('erase');else if(k==='v')setTool('select');else if(k==='h')setTool('hand');else if(k==='home'){e.preventDefault();fitMap();}else if(k==='delete'&&selected)$('delete-selected').click();else if(k==='escape'){cancelGesture();finishLighting();selected=null;$('settings').hidden=true;document.querySelectorAll('details').forEach(d=>d.open=false);updateUI();}});
  document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});
  window.isometric=Object.freeze({snapshot:()=>({...snapshot(),editor:{tool,category,material,asset,rotation,tint,brush,brushShape,terrainLevel,terrainTint,terrainEdge,terrainDetail,pieceSize:clone(pieceSize),selected,undo:undo.length,redo:redo.length},hover:hover?{x:hover.x,z:hover.z,id:hover.id}:null}),cellScreen:(x,z,y)=>engine.projectPoint(x,z,y)});
}
start();
