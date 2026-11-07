import * as M from './geometry.js';
import {Simulation,ready,preset,restoreScene,MATERIALS,SHAPES,template,STEP,MAX_BODIES,MAX_CELLS} from './physics.js';
import {VoidRenderer,DEFAULT_CAMERA} from './renderer.js';
import {DEFAULT_SETTINGS,checkedProject} from './project.js';
import {schwarzschildRadius,C} from './relativity.js';

const $=id=>document.getElementById(id),clone=structuredClone,viewport=$('viewport');
let sim,state=clone(DEFAULT_SETTINGS),view,gesture=null,preview=null,lastFollow=null,accumulator=0,lastFrame=0,uiAt=0,saveAt=0,saveTimer,db,editing=false;
const pointers=new Map(),undo=[],redo=[];
const vectorInput=(prefix,axes=['x','y','z'])=>M.V(...axes.map(axis=>number(prefix+axis)));
function number(id){const input=$(id);if(!input.checkValidity()||input.value.trim()===''){input.reportValidity();throw new Error('Enter a valid '+(input.labels?.[0]?.textContent||'number')+'.');}return input.valueAsNumber;}
const fmt=n=>Math.abs(n)>=1e5||Math.abs(n)>0&&Math.abs(n)<.001?n.toExponential(3):Number(n.toFixed(3)).toString();
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function safely(action){try{return action();}catch(error){notice(error.message,true);return null;}}
function pack(){return{format:'neoj-void',version:1,scene:sim.toJSON(),settings:{...clone(state),camera:{...clone(state.camera),target:M.add(state.camera.target,sim.origin)}}};}
function checkpoint(){undo.push(pack());if(undo.length>20)undo.shift();let bytes=0;for(let i=undo.length-1;i>=0;i--){bytes+=JSON.stringify(undo[i]).length;if(bytes>32e6){undo.splice(0,i+1);break;}}redo.length=0;historyUI();}
function historyUI(){$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;}
function swap(next,settings){sim?.dispose();sim=next;state=clone(settings);state.camera.target=M.sub(state.camera.target,sim.origin);lastFollow=null;gesture=null;pointers.clear();preview=null;accumulator=0;view.clear();view.hideGhost();editing=false;sync();scheduleSave();}
function restore(value){const checked=checkedProject(value),next=restoreScene(checked.scene);swap(next,checked.settings);}
function materialOptions(id){for(const [key,m]of Object.entries(MATERIALS))$(id).add(new Option(m.name,key));}
function sync(){
  for(const key of ['shape','material','size','mass','plane','depth','speed','strength'])if($(key))$(key).value=key==='strength'?sim.params.strength:state[key];
  $('preset').value=state.preset;$('velocity-mode').value=state.velocityMode;
  for(const [prefix,v]of [['v',state.velocity],['w',state.spin],['p',state.position]])for(const axis of ['x','y','z'])$(prefix+axis).value=v[axis];
  for(const key of ['pinned','grid','trails','stress','follow'])$(key).checked=state[key];
  $('gravity').checked=sim.params.gravity;$('breaking').checked=sim.params.breaking;
  $('pause').textContent=state.paused?'Run':'Pause';$('pause').setAttribute('aria-pressed',String(state.paused));
  $('velocity-fields').hidden=state.velocityMode!=='xyz';
  for(const button of document.querySelectorAll('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===state.tool));
  $('tool-help').textContent=state.tool==='place'?'Click to place; drag to launch. Right-drag rotates. Scroll zooms.':state.tool==='grab'?'Drag an object to pull or throw it. Right-drag rotates.':'Drag to rotate. Shift-drag pans. Scroll or pinch zooms.';
  const material=MATERIALS[state.material],volume=template(state.shape,state.size).cells.reduce((n,c)=>n+c.volume,0),radius=M.polyRadius(template(state.shape,state.size).outer),rs=schwarzschildRadius(state.mass);
  $('material-info').textContent=`${material.unbreakable?'Bouncy rigid material':material.name+' impact / compression response'} · density ${fmt(state.mass/volume)} · horizon radius ${fmt(rs)}${rs>=radius?' · mass fits inside its event horizon':''}.`;
  selectionUI(true);historyUI();
}
function selectionUI(force=false){
  if(!sim.bodies.has(state.selected)){state.selected=null;state.follow=false;}
  const signature=[...sim.bodies.values()].map(b=>b.id+':'+b.name).join('|');
  if($('body-select').dataset.signature!==signature){$('body-select').replaceChildren(new Option('None',''));for(const b of sim.bodies.values())$('body-select').add(new Option(`#${b.id} ${b.name}`,b.id));$('body-select').dataset.signature=signature;}
  $('body-select').value=state.selected??'';const b=sim.bodies.get(state.selected);$('body-form').hidden=!b;$('selection-empty').hidden=!!b;
  if(!b)return;
  if(force||!editing){$('body-name').value=b.name;$('body-material').value=b.material;$('body-mass').value=fmt(sim.mass(b));$('body-pinned').checked=b.pinned;for(const [prefix,v]of [['body-',sim.globalPosition(b)],['body-v',b.rb.linvel()],['body-w',b.rb.angvel()]])for(const axis of ['x','y','z'])$(prefix+axis).value=Number(v[axis].toPrecision(9));}
  $('body-info').textContent=`Mass ${fmt(sim.mass(b))} · damage ${Math.round(b.damage*100)}% · pressure ${fmt(b.pressure)}${b.compact?' · event horizon r = '+fmt(b.horizon):''}`;
  $('fracture').disabled=b.pinned||b.compact||b.cells.length<2||!!MATERIALS[b.material].unbreakable;$('follow').checked=state.follow;
}
function select(id){const next=sim.bodies.has(id)?id:null;if(next!==state.selected)state.follow=false;state.selected=next;lastFollow=null;editing=false;selectionUI(true);scheduleSave();}
function pause(value=!state.paused){state.paused=value;accumulator=0;$('pause').textContent=value?'Run':'Pause';$('pause').setAttribute('aria-pressed',String(value));scheduleSave();}
function readNew(){state.size=number('size');state.mass=number('mass');state.depth=number('depth');state.velocity=vectorInput('v');state.spin=vectorInput('w');state.position=vectorInput('p');}
function place(position,velocity){
  readNew();if(!position)throw new Error('That plane is behind the camera. Rotate the view or change its offset.');
  if(Math.max(...Object.values(velocity).map(Math.abs))>150)throw new Error('Launch speed is too high. Use a shorter drag.');
  const config={shape:state.shape,size:state.size,material:state.material,mass:state.mass,pinned:state.pinned,position,velocity:state.pinned?M.V():velocity,spin:state.spin};
  if(!sim.canPlace(template(state.shape,state.size).outer,position))throw new Error('Place the shape in free space.');
  checkpoint();const body=sim.add(config);select(body.id);notice(body.compact?'This mass is inside its own event horizon. Its gravity and light bending follow from the mass.':'Object placed.');scheduleSave();
}
function loadPreset(name){checkpoint();const next=preset(name),settings={...clone(state),selected:null,follow:false,paused:false,preset:name,camera:clone(DEFAULT_CAMERA)};swap(next,settings);fit();notice(name==='empty'?'Empty void. Click to place a shape.':'Starting scene loaded.');}
function fit(){
  if(!sim.bodies.size){state.camera=clone(DEFAULT_CAMERA);scheduleSave();return;}
  const bodies=[...sim.bodies.values()],center=M.mul(bodies.reduce((sum,b)=>M.add(sum,b.rb.translation()),M.V()),1/bodies.length);let radius=1;for(const b of bodies)radius=Math.max(radius,M.length(M.sub(b.rb.translation(),center))+Math.max(b.radius,b.compact?b.horizon:0));state.camera.target=center;state.camera.distance=Math.max(6,radius*2.8/Math.min(1,view.width/view.height));lastFollow=null;scheduleSave();
}
function focus(){const b=sim.bodies.get(state.selected);if(!b){notice('Select an object first.');return;}state.camera.target={...b.rb.translation()};state.camera.distance=Math.max(4,Math.max(b.radius,b.compact?b.horizon:0)*5);lastFollow=null;scheduleSave();}
function zoom(factor,x=view.width/2,y=view.height/2){const plane=view.plane('view',0,sim.origin),before=view.onPlane(x,y,plane);state.camera.distance=Math.max(.3,Math.min(1e7,state.camera.distance*factor));view.setCamera(state.camera);const after=view.onPlane(x,y,plane);if(before&&after)state.camera.target=M.add(state.camera.target,M.sub(before,after));scheduleSave();}
function pan(dx,dy,camera){const units=2*camera.distance*Math.tan(25*Math.PI/180)/view.height,e=view.camera.matrixWorld.elements,right=M.V(e[0],e[1],e[2]),up=M.V(e[4],e[5],e[6]);state.camera.target=M.add(camera.target,M.add(M.mul(right,-dx*units),M.mul(up,dy*units)));}
function point(event){const r=viewport.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
function cancelGesture(){sim.grab=null;gesture=null;preview=null;view.hideGhost();}
function previewAt(position,velocity=M.V()){if(!position)return;const global=M.add(position,sim.origin),valid=sim.canPlace(template(state.shape,state.size).outer,global);preview={position:global,velocity,valid};view.setGhost(state.shape,state.size,position,M.Q(),valid,velocity);}
function launchVelocity(g){return state.velocityMode==='xyz'?state.velocity:state.velocityMode==='drag'&&g.end?M.mul(M.sub(g.end,g.start),3):M.V();}
viewport.addEventListener('contextmenu',e=>e.preventDefault());
viewport.addEventListener('pointerdown',event=>{
  if(event.target.closest('button')||!sim)return;event.preventDefault();viewport.focus({preventScroll:true});const p=point(event);pointers.set(event.pointerId,p);viewport.setPointerCapture(event.pointerId);
  if(pointers.size>=2){cancelGesture();const a=[...pointers.values()];gesture={kind:'pinch',distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mid:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2},camera:clone(state.camera)};return;}
  const hit=view.pick(p.x,p.y),camera=clone(state.camera),base={pointer:event.pointerId,x:p.x,y:p.y,camera,moved:false};
  if(event.button===1||event.shiftKey){gesture={...base,kind:'pan'};return;}
  if(event.button===2||event.altKey||state.tool==='view'){gesture={...base,kind:'orbit',hit};return;}
  if(hit){select(hit.id);const b=sim.bodies.get(hit.id);if(state.tool==='grab'&&!b.pinned){checkpoint();const plane=view.plane('view',0,sim.origin);plane.constant=-M.dot(plane.normal,hit.point);const local=M.rotate(M.inverseQ(b.rb.rotation()),M.sub(hit.point,b.rb.translation()));sim.setGrab(b.id,local,M.add(hit.point,sim.origin));gesture={...base,kind:'grab',plane};notice(state.paused?'Run the scene to pull the object.':'Pull and release to throw.');}else gesture={...base,kind:'select'};return;}
  if(state.tool!=='place'){select(null);return;}
  safely(()=>{readNew();const plane=view.plane(state.plane,state.depth,sim.origin),start=view.onPlane(p.x,p.y,plane);if(!start)throw new Error('This plane is behind the camera.');gesture={...base,kind:'place',plane,start,end:start};previewAt(start);});
});
viewport.addEventListener('pointermove',event=>{
  if(!sim)return;const p=point(event);if(pointers.has(event.pointerId))pointers.set(event.pointerId,p);
  const g=gesture;
  if(g?.kind==='pinch'&&pointers.size>=2){const a=[...pointers.values()],mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2},distance=Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y));state.camera.distance=Math.max(.3,Math.min(1e7,g.camera.distance*g.distance/distance));pan(mid.x-g.mid.x,mid.y-g.mid.y,g.camera);return;}
  if(g&&g.pointer!==event.pointerId)return;
  if(g){const dx=p.x-g.x,dy=p.y-g.y;g.moved||=Math.hypot(dx,dy)>4;
    if(g.kind==='orbit'){state.camera.yaw=(g.camera.yaw-dx*.007)%(Math.PI*2);state.camera.pitch=Math.max(-1.55,Math.min(1.55,g.camera.pitch+dy*.007));}
    if(g.kind==='pan')pan(dx,dy,g.camera);
    if(g.kind==='place'){g.end=view.onPlane(p.x,p.y,g.plane)??g.end;previewAt(g.start,launchVelocity(g));}
    if(g.kind==='grab'){const target=view.onPlane(p.x,p.y,g.plane);if(target&&sim.grab)sim.grab.target=target;}
  }else if(state.tool==='place'&&event.pointerType!=='touch'&&!event.target.closest('button')){const at=view.onPlane(p.x,p.y,view.plane(state.plane,state.depth,sim.origin));previewAt(at);}else{preview=null;view.hideGhost();}
});
function pointerEnd(event){const g=gesture;pointers.delete(event.pointerId);if(g?.kind==='pinch'){if(pointers.size<2){cancelGesture();pointers.clear();scheduleSave();}return;}if(!g||g.pointer!==event.pointerId)return;if(event.type==='pointerup'){if(g.kind==='place')safely(()=>place(M.add(g.start,sim.origin),g.moved?launchVelocity(g):state.velocityMode==='xyz'?state.velocity:M.V()));if(g.kind==='orbit'&&!g.moved)select(g.hit?.id??null);}cancelGesture();scheduleSave();}
for(const name of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(name,pointerEnd);
viewport.addEventListener('pointerleave',()=>{if(!gesture){preview=null;view.hideGhost();}});
viewport.addEventListener('wheel',event=>{event.preventDefault();const p=point(event);cancelGesture();zoom(Math.exp(Math.max(-500,Math.min(500,event.deltaY))*.0015),p.x,p.y);},{passive:false});
window.addEventListener('blur',()=>{if(sim)cancelGesture();});

// Some Android/Chromium combinations delay compatibility clicks after using a
// captured canvas pointer. Handle a stationary touch tap on controls immediately.
let touchButton=null,handledTap=-Infinity;
document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){const button=event.target.closest('button');touchButton=button?{button,x:event.clientX,y:event.clientY}:null;}else handledTap=-Infinity;},true);
document.addEventListener('pointerup',event=>{if(event.pointerType==='touch'&&touchButton){const t=touchButton;touchButton=null;if(t.button===event.target.closest('button')&&Math.hypot(event.clientX-t.x,event.clientY-t.y)<8&&!t.button.disabled){handledTap=performance.now();t.button.click();}}},true);
document.addEventListener('click',event=>{if(event.isTrusted&&event.detail!==0&&performance.now()-handledTap<800){event.preventDefault();event.stopImmediatePropagation();}},true);

for(const [key,label]of Object.entries(SHAPES))$('shape').add(new Option(label,key));materialOptions('material');materialOptions('body-material');
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{cancelGesture();state.tool=button.dataset.tool;sync();scheduleSave();});
$('controls-toggle').onclick=()=>{const open=$('controls').classList.toggle('open');$('controls-toggle').setAttribute('aria-expanded',String(open));};
$('pause').onclick=()=>pause();$('step').onclick=()=>safely(()=>{pause(true);checkpoint();sim.step();scheduleSave();});
$('load-preset').onclick=()=>safely(()=>loadPreset($('preset').value));$('try-impact').onclick=()=>safely(()=>loadPreset('impact'));
$('shape').onchange=()=>safely(()=>{state.shape=$('shape').value;sync();scheduleSave();});
$('material').onchange=()=>safely(()=>{state.material=$('material').value;sync();scheduleSave();});
for(const key of ['size','mass','depth'])$(key).onchange=()=>safely(()=>{state[key]=number(key);sync();scheduleSave();});
for(const prefix of ['v','w','p'])for(const axis of ['x','y','z'])$(prefix+axis).onchange=()=>safely(()=>{readNew();scheduleSave();});
for(const [id,key]of [['velocity-mode','velocityMode'],['plane','plane']])$(id).onchange=()=>{state[key]=$(id).value;cancelGesture();sync();scheduleSave();};
for(const key of ['pinned','grid','trails','stress','follow'])$(key).onchange=()=>{state[key]=$(key).checked;lastFollow=null;scheduleSave();};
for(const key of ['gravity','breaking'])$(key).onchange=()=>{checkpoint();sim.params[key]=$(key).checked;scheduleSave();};
$('strength').onchange=()=>safely(()=>{const value=number('strength');checkpoint();sim.params.strength=value;scheduleSave();});
$('speed').onchange=()=>{state.speed=Number($('speed').value);scheduleSave();};
$('place-coordinates').onclick=()=>safely(()=>{readNew();place(state.position,state.velocityMode==='xyz'?state.velocity:M.V());});
$('clear-trails').onclick=()=>view.clearTrails();$('fit').onclick=fit;$('focus').onclick=focus;$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);
$('body-select').onchange=()=>select(Number($('body-select').value)||null);
$('body-form').addEventListener('focusin',event=>{if(event.target.matches('input,select')&&event.target.id!=='follow'){pause(true);if(!editing){selectionUI(true);editing=true;}}});
$('body-form').onsubmit=event=>{event.preventDefault();safely(()=>{if(!$('body-form').reportValidity())return;const values={name:$('body-name').value.trim(),material:$('body-material').value,mass:number('body-mass'),position:vectorInput('body-'),velocity:vectorInput('body-v'),spin:vectorInput('body-w'),pinned:$('body-pinned').checked};checkpoint();sim.update(state.selected,values);editing=false;selectionUI(true);scheduleSave();notice('Object updated.');});};
$('delete-body').onclick=()=>{checkpoint();sim.remove(state.selected);select(null);scheduleSave();notice('Object deleted.');};
$('fracture').onclick=()=>safely(()=>{checkpoint();const parts=sim.fracture(state.selected);select(parts[0]??state.selected);scheduleSave();notice(parts.length?'Released the connected pieces.':'This object cannot break apart.');});
function history(from,to){if(!from.length)return;safely(()=>{const saved=from.pop();to.push(pack());restore(saved);historyUI();notice('Scene restored.');});}
$('undo').onclick=()=>history(undo,redo);$('redo').onclick=()=>history(redo,undo);
$('save').onclick=()=>safely(()=>{const blob=new Blob([JSON.stringify(pack())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='void-lab.void';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Scene file saved.');});
$('open').onclick=()=>$('scene-file').click();$('scene-file').onchange=async()=>{const file=$('scene-file').files[0];if(!file)return;try{if(file.size>32e6)throw new Error('Scene file is too large (32 MB maximum).');const value=JSON.parse(await file.text());checkedProject(value);checkpoint();restore(value);notice('Scene opened.');}catch(error){notice(error.message,true);}finally{$('scene-file').value='';}};
document.addEventListener('keydown',event=>{if(event.target.matches('input,select,textarea')||event.target.closest('summary'))return;if(event.code==='Space'){event.preventDefault();pause();}else if(event.key==='Home'){event.preventDefault();fit();}else if(event.key.toLowerCase()==='f')focus();else if(event.key==='Delete'&&state.selected){event.preventDefault();$('delete-body').click();}else if(event.key==='Escape'){cancelGesture();$('controls').classList.remove('open');$('controls-toggle').setAttribute('aria-expanded','false');}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?$('redo').click():$('undo').click();}});

function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open('neoj-void-lab',1);request.onupgradeneeded=()=>request.result.createObjectStore('draft');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});}
function readDraft(){return new Promise((resolve,reject)=>{const request=db.transaction('draft').objectStore('draft').get('current');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function saveDraft(){if(!db||!sim)return;try{const transaction=db.transaction('draft','readwrite');transaction.objectStore('draft').put(pack(),'current');transaction.oncomplete=()=>$('storage-status').textContent='Draft saved on this device.';transaction.onerror=()=>$('storage-status').textContent='Draft storage is unavailable. Use Save scene.';}catch{$('storage-status').textContent='Draft storage is unavailable. Use Save scene.';}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,500);}
document.addEventListener('visibilitychange',()=>{lastFrame=0;accumulator=0;if(document.hidden){cancelGesture();saveDraft();}});window.addEventListener('pagehide',saveDraft);
function rebase(){const target=state.camera.target;if(M.length(target)<4096)return;const shift=M.V(...['x','y','z'].map(axis=>Math.round(target[axis]/512)*512));sim.rebase(shift);state.camera.target=M.sub(target,shift);if(lastFollow)lastFollow=M.sub(lastFollow,shift);if(gesture){gesture.camera.target=M.sub(gesture.camera.target,shift);if(gesture.start)gesture.start=M.sub(gesture.start,shift);if(gesture.end)gesture.end=M.sub(gesture.end,shift);if(gesture.plane)gesture.plane.constant+=M.dot(shift,gesture.plane.normal);}view.hideGhost();preview=null;}
function frame(now){
  requestAnimationFrame(frame);if(document.hidden){lastFrame=0;return;}const elapsed=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;
  if(!state.paused){accumulator=Math.min(.25,accumulator+elapsed*state.speed);let count=0;const start=performance.now();try{while(accumulator>=STEP&&count<16&&performance.now()-start<12){sim.step();accumulator-=STEP;count++;}}catch(error){pause(true);notice(error.message,true);}}
  const selected=sim.bodies.get(state.selected);if(state.follow&&selected&&gesture?.kind!=='grab'){const current={...selected.rb.translation()};if(lastFollow)state.camera.target=M.add(state.camera.target,M.sub(current,lastFollow));lastFollow=current;}else lastFollow=null;
  rebase();view.draw(sim,state);$('empty-hint').hidden=sim.bodies.size!==0;
  if(now-uiAt>200){uiAt=now;selectionUI();const tiny=sim.lastDt&&sim.lastDt<STEP*.95;let totalMass=0;for(const b of sim.bodies.values())totalMass+=sim.mass(b);$('stats').textContent=`${sim.bodies.size}/${MAX_BODIES} objects · ${sim.cellCount}/${MAX_CELLS} pieces · t ${fmt(sim.time)} · mass ${fmt(totalMass)}${tiny?' · adaptive slow time':''}`;const p=M.add(state.camera.target,sim.origin);$('coordinates').textContent=`view ${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}`;}
  if(now-saveAt>5000){saveAt=now;if(!state.paused&&sim.bodies.size)saveDraft();}
}
async function start(){
  try{await ready;view=new VoidRenderer($('space'),viewport);sim=new Simulation();view.draw(sim,state);sync();new ResizeObserver(()=>view.resize()).observe(viewport);
    try{db=await openDB();const draft=await readDraft();if(draft){restore(draft);notice('Restored your scene from this device.');}else notice('Click to place. Drag to launch. Right-drag rotates; scroll zooms.');}catch{$('storage-status').textContent='Draft storage is unavailable. Use Save scene.';notice('Click to place. Drag to launch.');}
    Object.defineProperty(window,'voidLab',{value:Object.freeze({snapshot:()=>clone({...sim.snapshot(),settings:state,cameraGlobal:M.add(state.camera.target,sim.origin),preview})}),writable:false});requestAnimationFrame(frame);
  }catch(error){notice('Could not start the 3D sandbox: '+error.message,true);$('pause').disabled=true;}
}
start();
