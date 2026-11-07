import { BODY_TYPES, DEFAULT_CAMERA, Simulation, fitCamera, orbitNormal, panCamera, preset, screenToWorld, validateProject, zoomCamera } from "./physics.js?v=2";
import { SpaceRenderer } from "./renderer.js?v=2";

const $ = id => document.getElementById(id), viewport = $("viewport"), canvas = $("space"), form = $("body-form");
const renderer = new SpaceRenderer(canvas,$("overlay")), STORAGE = "neoj.orbit.draft.v1";
let simulation = new Simulation(preset("solar"));
let settings = { camera:{...DEFAULT_CAMERA}, selectedId:1, tool:"select", bodyType:"planet", newMass:4, newColor:BODY_TYPES.planet.color, speed:1, paused:false, trails:true, follow:false, clockwise:false, preset:"solar", placementZ:0, launchVz:0, orbitTilt:0, grid:true };
let restored = false, dirty = false, undo = [], accumulator = 0, previousFrame = 0, lastUI = 0, lastSave = 0, saveTimer = 0, noticeUntil = 0, preview = null, gesture = null, pinch = null, capacity = false;
const pointers = new Map();
const selected = () => simulation.bodies.find(body=>body.id===settings.selectedId);
function pack() { return { format:"neoj-orbit", version:2, scene:simulation.toJSON(), settings:structuredClone(settings) }; }
try { const value = localStorage.getItem(STORAGE); if (value) { const checked = validateProject(JSON.parse(value)); simulation = checked.simulation; settings = checked.settings; restored = true; } }
catch { $("storage-status").textContent = "The previous draft could not be opened. A fresh system is ready."; }
function persist() {
  try { localStorage.setItem(STORAGE,JSON.stringify(pack())); }
  catch { $("storage-status").textContent = "This browser could not save the draft. Use Save system to keep a file."; }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(persist,200); }
function notify(message, seconds = 4) { $("notice").textContent = message; noticeUntil = performance.now()+seconds*1000; }
function recordEdit() { undo.push(pack()); if (undo.length>30) undo.shift(); $("undo").disabled = false; }
function followMerges(events) { for (const event of events) if (settings.selectedId===event.remove) { settings.selectedId=event.keep; dirty=false; } }
function restoreProject(value) {
  const next = validateProject(value); simulation = next.simulation; settings = next.settings;
  accumulator = 0; preview = null; gesture = null; dirty = false; pointers.clear(); syncControls(); scheduleSave();
}
function syncControls() {
  $("pause").textContent = settings.paused ? "Play" : "Pause";
  $("speed").value = settings.speed; $("preset").value = settings.preset; $("body-type").value = settings.bodyType;
  $("new-mass").value = settings.newMass; $("new-color").value = settings.newColor;
  $("trails").checked = settings.trails; $("clockwise").checked = settings.clockwise;
  $("grid").checked=settings.grid;$("placement-z").value=settings.placementZ;$("launch-vz").value=settings.launchVz;$("orbit-tilt").value=settings.orbitTilt;
  $("placement-controls").hidden=settings.tool!=="place";$("tilt-controls").hidden=settings.tool!=="orbit";
  $("clockwise-row").hidden = settings.tool!=="orbit";
  document.querySelectorAll("[data-tool]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.tool===settings.tool)));
  viewport.classList.toggle("select-tool",settings.tool==="select");
  const primary = selected();
  $("tool-help").textContent = settings.tool==="place" ? "Drag on the height plane to launch. Height Z and launch velocity Z control depth. Right-drag rotates." : settings.tool==="orbit" ? primary ? `Click the tilted grid to add an orbit around ${primary.name}. Right-drag rotates the view.` : "Select a body first, then click its tilted orbit plane. Right-drag rotates the view." : "Drag to rotate the view. Click a body to inspect it. Shift-drag or two fingers pans; scroll or pinch zooms.";
  syncInspector(!dirty); updateUI();
}
function syncInspector(force = false) {
  const body = selected();
  $("selection-empty").hidden = !!body; form.hidden = !body;
  if (!body) { settings.follow = false; return; }
  $("follow").checked = settings.follow;
  $("body-info").textContent = `speed ${Math.hypot(body.vx,body.vy,body.vz).toFixed(3)} · radius ${body.radius.toFixed(3)}`;
  if (force || (!dirty && !form.contains(document.activeElement))) {
    $("body-name").value = body.name; $("body-mass").value = body.mass;
    for(const key of ["x","y","z","vx","vy","vz"])$("body-"+key).value=Number(body[key].toPrecision(8));
    dirty = false; $("apply-body").textContent = "Apply changes";
  }
}
function updateUI() {
  $("empty-hint").hidden = simulation.bodies.length!==0;
  $("stats").textContent = `${simulation.bodies.length} ${simulation.bodies.length===1?"body":"bodies"} · t ${simulation.time.toFixed(1)}${settings.paused?" · paused":capacity?" · at capacity":""}`;
  const desired = 75*settings.camera.span/Math.max(1,renderer.height), power = 10**Math.floor(Math.log10(desired)), scale = [1,2,5,10].find(n=>n*power>=desired)*power;
  $("scale").textContent = `${Number(scale.toPrecision(3))} units`; $("scale").style.width = `${scale*renderer.height/settings.camera.span}px`;
  syncInspector();
}
function choose(id) { settings.selectedId = id; dirty=false; if (!id) settings.follow=false; syncControls(); scheduleSave(); }
function newBodySettings() {
  for(const id of ["new-mass",...(settings.tool==="place"?["placement-z","launch-vz"]:["orbit-tilt"])])if(!$(id).checkValidity()){$(id).reportValidity();throw new Error("Enter valid settings for the new body.");}
  return { mass:settings.newMass, color:settings.newColor, name:`${BODY_TYPES[settings.bodyType].name} ${simulation.nextId}` };
}
function place(world, end = world) {
  try {
    const config = {...newBodySettings(),x:world.x,y:world.y,z:world.z};
    if (!simulation.canPlace(world.x,world.y,world.z,config.mass)) throw new Error("Place the new body in free space.");
    if (settings.tool==="orbit" && !selected()) throw new Error("Select the body you want to orbit first.");
    const before = pack();
    const body = settings.tool==="orbit" ? simulation.addOrbiter(settings.selectedId,config,settings.clockwise,orbitNormal(settings.orbitTilt)) : simulation.add({...config,vx:(end.x-world.x)*2,vy:(end.y-world.y)*2,vz:settings.launchVz});
    undo.push(before); if (undo.length>30) undo.shift(); $("undo").disabled=false;
    if (settings.tool==="place") choose(body.id);
    notify(settings.tool==="orbit"?`${body.name} added around ${selected().name}.`:`${body.name} placed.`);
    syncControls(); scheduleSave();
  } catch (error) { notify(error.message); }
}
function togglePause() { settings.paused=!settings.paused; accumulator=0; syncControls(); scheduleSave(); }
$("pause").addEventListener("click",togglePause);
$("step").addEventListener("click",()=>{ settings.paused=true; followMerges(simulation.advance(1/60).merged); syncControls(); scheduleSave(); });
$("speed").addEventListener("change",()=>{ settings.speed=Number($("speed").value); accumulator=0; scheduleSave(); });
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>{ settings.tool=button.dataset.tool; preview=null; syncControls(); scheduleSave(); }));
$("body-type").addEventListener("change",()=>{ settings.bodyType=$("body-type").value; const type=BODY_TYPES[settings.bodyType]; settings.newMass=type.mass; settings.newColor=type.color; syncControls(); scheduleSave(); });
$("new-mass").addEventListener("input",()=>{ if ($("new-mass").checkValidity()) { settings.newMass=$("new-mass").valueAsNumber; scheduleSave(); } });
$("new-color").addEventListener("input",()=>{ settings.newColor=$("new-color").value; scheduleSave(); });
$("clockwise").addEventListener("change",()=>{ settings.clockwise=$("clockwise").checked; scheduleSave(); });
for(const [id,key]of [["placement-z","placementZ"],["launch-vz","launchVz"],["orbit-tilt","orbitTilt"]])$(id).addEventListener("input",()=>{if($(id).checkValidity()){settings[key]=$(id).valueAsNumber;scheduleSave();}});
$("grid").addEventListener("change",()=>{settings.grid=$("grid").checked;scheduleSave();});
$("trails").addEventListener("change",()=>{ settings.trails=$("trails").checked; scheduleSave(); });
$("clear-trails").addEventListener("click",()=>{ simulation.clearTrails(); notify("Trails cleared."); });
$("load-preset").addEventListener("click",()=>{
  recordEdit(); settings.preset=$("preset").value; simulation=new Simulation(preset(settings.preset));
  settings.selectedId=simulation.bodies[0]?.id??null; settings.follow=false; settings.camera=fitCamera(simulation.bodies,renderer.width,renderer.height);
  settings.bodyType=settings.preset==="empty"?"star":settings.preset==="moon"?"moon":"planet";
  settings.newMass=BODY_TYPES[settings.bodyType].mass; settings.newColor=BODY_TYPES[settings.bodyType].color;
  settings.tool=settings.preset==="empty"?"place":"select";settings.placementZ=0;settings.launchVz=0;settings.orbitTilt=0; dirty=false; preview=null; accumulator=0; syncControls(); scheduleSave(); notify("Starting system loaded.");
});
$("undo").addEventListener("click",()=>{ if (undo.length) { restoreProject(undo.pop()); $("undo").disabled=!undo.length; notify("Last edit undone."); } });
form.addEventListener("input",event=>{ if(event.target.type!=="checkbox")dirty=true; });
form.addEventListener("submit",event=>{
  event.preventDefault(); if (!selected() || !form.reportValidity()) return;
  try {
    const before=pack(), merged=simulation.edit(settings.selectedId,{name:$("body-name").value.trim(),mass:$("body-mass").valueAsNumber,...Object.fromEntries(["x","y","z","vx","vy","vz"].map(key=>[key,$("body-"+key).valueAsNumber]))});
    undo.push(before); if (undo.length>30) undo.shift(); $("undo").disabled=false;
    followMerges(merged); dirty=false; syncControls(); scheduleSave(); notify("Body updated.");
  } catch (error) { notify(error.message); }
});
$("follow").addEventListener("change",()=>{ settings.follow=$("follow").checked; scheduleSave(); });
$("delete-body").addEventListener("click",()=>{ if (!selected()) return; recordEdit(); simulation.remove(settings.selectedId); choose(null); notify("Body deleted."); });
function closeControls() { document.body.classList.remove("controls-open"); $("controls-toggle").setAttribute("aria-expanded","false"); }
$("controls-toggle").addEventListener("click",()=>{ const open=document.body.classList.toggle("controls-open"); $("controls-toggle").setAttribute("aria-expanded",String(open)); });
document.addEventListener("keydown",event=>{ if (event.key==="Escape") { closeControls(); preview=null; gesture=null; pointers.clear(); viewport.classList.remove("is-panning"); } });
function fit() { settings.follow=false; settings.camera=fitCamera(simulation.bodies,renderer.width,renderer.height); $("follow").checked=false; scheduleSave(); }
$("fit").addEventListener("click",fit);
const center = () => ({x:renderer.width/2,y:renderer.height/2});
function zoom(factor,point=center()) { settings.camera=zoomCamera(settings.camera,factor,settings.follow?center():point,renderer.width,renderer.height); scheduleSave(); }
$("zoom-in").addEventListener("click",()=>zoom(.5)); $("zoom-out").addEventListener("click",()=>zoom(2));
const local = event => { const rect=viewport.getBoundingClientRect(); return {x:event.clientX-rect.left,y:event.clientY-rect.top}; };
const placementPlane=()=>settings.tool==="orbit"?{point:selected()??{x:0,y:0,z:0},normal:orbitNormal(settings.orbitTilt)}:{point:{x:0,y:0,z:settings.placementZ},normal:{x:0,y:0,z:1}};
const world=(point,plane=placementPlane())=>screenToWorld(settings.camera,point,renderer.width,renderer.height,plane.point,plane.normal);
const pinchState = () => { const [a,b]=[...pointers.values()]; return {middle:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}; };
viewport.addEventListener("wheel",event=>{ if(event.target.closest("button"))return; event.preventDefault(); const scale=event.deltaMode===1?16:event.deltaMode===2?renderer.height:1; zoom(Math.exp(Math.max(-400,Math.min(400,event.deltaY*scale))*.0016),local(event)); },{passive:false});
viewport.addEventListener("pointerdown",event=>{
  if (![0,1,2].includes(event.button) || event.target.closest("button"))return;
  if (document.body.classList.contains("controls-open")&&matchMedia("(max-width:800px)").matches) { closeControls(); return; }
  event.preventDefault(); viewport.focus({preventScroll:true}); const point=local(event); pointers.set(event.pointerId,point); viewport.setPointerCapture(event.pointerId);
  if (pointers.size>=2) { gesture=null; preview=null; pinch=pinchState(); settings.follow=false; return; }
  const hit=renderer.hit(settings.camera,simulation.bodies,point),mode=event.shiftKey||event.button===1?"pan":event.button===2||settings.tool==="select"?"rotate":"place",plane=placementPlane();
  const position=mode==="place"&&!hit?world(point,plane):null;
  if(mode==="place"&&!hit&&!position){gesture=null;notify("The placement plane is edge-on or behind the view. Rotate the view and try again.");return;}
  gesture={id:event.pointerId,start:point,last:point,world:position,plane,hit:hit?.id??null,mode,moved:false};
  if(mode!=="place")viewport.classList.add("is-panning");
  else if(!hit)preview={world:position,end:position};
});
viewport.addEventListener("pointermove",event=>{
  const point=local(event), previous=pointers.get(event.pointerId);
  if (!previous) { if (event.pointerType==="mouse" && settings.tool!=="select" && !renderer.hit(settings.camera,simulation.bodies,point)) preview={world:world(point)}; else preview=null; return; }
  pointers.set(event.pointerId,point);
  if (pointers.size>=2&&pinch) {
    const next=pinchState();
    settings.camera=zoomCamera(settings.camera,pinch.distance/next.distance,pinch.middle,renderer.width,renderer.height);
    settings.camera=panCamera(settings.camera,next.middle.x-pinch.middle.x,next.middle.y-pinch.middle.y,renderer.height);
    settings.follow=false; pinch=next; scheduleSave(); return;
  }
  if (!gesture) return;
  if (Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y)>5) gesture.moved=true;
  if(gesture.mode==="pan"){settings.camera=panCamera(settings.camera,point.x-previous.x,point.y-previous.y,renderer.height);settings.follow=false;scheduleSave();}
  else if(gesture.mode==="rotate"){settings.camera.yaw=(settings.camera.yaw-(point.x-previous.x)*.008)%(Math.PI*2);settings.camera.pitch=Math.max(-1.5,Math.min(1.5,settings.camera.pitch+(point.y-previous.y)*.008));scheduleSave();}
  else if(!gesture.hit)preview={world:gesture.world,end:world(point,gesture.plane)??gesture.world};
  gesture.last=point;
});
function finishPointer(event,cancelled) {
  if (!pointers.has(event.pointerId))return;
  const action=gesture; pointers.delete(event.pointerId);
  if (!cancelled&&action&&action.id===event.pointerId&&pointers.size===0) {
    if (action.hit&&!action.moved) choose(action.hit);
    else if (action.mode==="place"&&!action.hit&&action.world) place(action.world,action.moved?(world(action.last,action.plane)??action.world):action.world);
    else if (!action.moved&&!action.hit) choose(null);
  }
  gesture=null; preview=null; if(pointers.size<2)pinch=null; if(!pointers.size)viewport.classList.remove("is-panning");
}
viewport.addEventListener("pointerup",event=>finishPointer(event,false));
for (const type of ["pointercancel","lostpointercapture"])viewport.addEventListener(type,event=>finishPointer(event,true));
viewport.addEventListener("pointerleave",()=>{if(!pointers.size)preview=null;});
viewport.addEventListener("contextmenu",event=>event.preventDefault());
viewport.addEventListener("keydown",event=>{
  if(event.target!==viewport)return;
  if(event.code==="Space")togglePause();
  else if(event.key==="Home")fit();
  else if(["+","="].includes(event.key))zoom(.5);
  else if(event.key==="-")zoom(2);
  else if(event.key.startsWith("Arrow")) {
    if(event.shiftKey){const amount=renderer.height*.05,dx=event.key==="ArrowLeft"?amount:event.key==="ArrowRight"?-amount:0,dy=event.key==="ArrowUp"?amount:event.key==="ArrowDown"?-amount:0;settings.camera=panCamera(settings.camera,dx,dy,renderer.height);settings.follow=false;}
    else{if(event.key==="ArrowLeft")settings.camera.yaw-=.1;if(event.key==="ArrowRight")settings.camera.yaw+=.1;if(event.key==="ArrowUp")settings.camera.pitch=Math.min(1.5,settings.camera.pitch+.1);if(event.key==="ArrowDown")settings.camera.pitch=Math.max(-1.5,settings.camera.pitch-.1);}
    scheduleSave();
  }
  else return; event.preventDefault();
});
$("save-file").addEventListener("click",()=>{ const url=URL.createObjectURL(new Blob([JSON.stringify(pack(),null,2)],{type:"application/json"})),link=document.createElement("a"); link.href=url; link.download="orbital-system.orbit"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); notify("System saved to a file."); });
$("open-file").addEventListener("click",()=>$("file-input").click());
$("file-input").addEventListener("change",async()=>{
  const file=$("file-input").files[0]; $("file-input").value=""; if(!file)return;
  try { if(file.size>1000000)throw new Error("Choose a system file smaller than 1 MB."); const value=JSON.parse(await file.text()); validateProject(value); recordEdit(); restoreProject(value); notify("System opened."); }
  catch(error){notify(error instanceof SyntaxError?"This file is not valid JSON.":error.message);}
});
// Some touch browsers omit the compatibility click just after a canvas drag.
// Handle taps on the view controls directly while keeping mouse/keyboard clicks.
for (const id of ["controls-toggle","pause","fit","zoom-in","zoom-out"]) {
  const button=$(id); let press=null, handledAt=-Infinity;
  button.addEventListener("pointerdown",event=>{if(event.pointerType==="touch")press={id:event.pointerId,x:event.clientX,y:event.clientY};else{press=null;handledAt=-Infinity;}});
  button.addEventListener("pointercancel",()=>{press=null;});
  button.addEventListener("pointerup",event=>{
    if(!press||event.pointerId!==press.id)return;
    const start=press;press=null;
    if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;
    handledAt=event.timeStamp;button.click();
  });
  button.addEventListener("click",event=>{if(event.isTrusted&&event.detail!==0&&event.timeStamp-handledAt<1000){event.preventDefault();event.stopImmediatePropagation();}},true);
}
function resize() { renderer.resize(viewport.clientWidth,viewport.clientHeight); if(!restored){settings.camera=fitCamera(simulation.bodies,renderer.width,renderer.height);restored=true;} }
new ResizeObserver(resize).observe(viewport); resize(); syncControls();
document.addEventListener("visibilitychange",()=>{ previousFrame=0; accumulator=0; if(document.hidden)persist(); });
window.addEventListener("pagehide",persist);
Object.defineProperty(window,"orbitalSandbox",{value:Object.freeze({snapshot:()=>({scene:simulation.toJSON(),settings:structuredClone(settings),invariants:simulation.invariants(),trails:simulation.bodies.map(body=>({id:body.id,points:body.trail.length})),undoCount:undo.length,capacity,renderer:renderer.kind,viewport:{width:renderer.width,height:renderer.height}})})});
function frame(now) {
  const raw=previousFrame?(now-previousFrame)/1000:0; previousFrame=now;
  if(!document.hidden) {
    if(!settings.paused) {
      accumulator=Math.min(2,accumulator+Math.min(raw,.08)*settings.speed);
      const result=simulation.advance(accumulator,256,performance.now()+9); accumulator=result.remaining; followMerges(result.merged); capacity=accumulator>.05||raw>.1;
    } else capacity=false;
    const body=selected(); if(settings.follow&&body){settings.camera.x=body.x;settings.camera.y=body.y;settings.camera.z=body.z;}
    for(const key of ["x","y","z"])settings.camera[key]=Math.max(-1e8,Math.min(1e8,settings.camera[key]));
    renderer.draw(simulation,settings,preview);
    if(now-lastUI>150){updateUI();lastUI=now;}
    if(now-lastSave>2500){persist();lastSave=now;}
    if(now>noticeUntil)$("notice").textContent="";
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
