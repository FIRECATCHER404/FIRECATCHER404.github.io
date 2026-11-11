import{GearSimulation,ready}from'./physics.js?v=2';
import{GearView}from'./view.js?v=2';
import{MATERIALS,dimensions,defaultGear,blankScene,checkedScene,meshPhase}from'./geometry.js?v=2';
import{V,add,sub,mul,dot,length,rotate,inverse,normal,mountRotation,mountPoint,gearPoint,wallSize,wallOnFloor,sameMountPlane,moveMount,wrap,FLOOR_Y}from'./space.js?v=2';
import{installTouchButtons}from'../svg-shared/touch.js?v=2';
const $=id=>document.getElementById(id),canvas=$('world'),view=new GearView(canvas);
let design=blankScene(),sim,selected=null,tool='select',running=false,undo=[],redo=[],pointer=null,last=0,latched=null;
const status=text=>$('status').textContent=text,serial=()=>JSON.stringify(design),current=()=>design.gears.find(g=>g.id===selected),currentWall=()=>design.walls.find(w=>w.id===selected),pegFor=id=>design.pegs.find(p=>p.id===id),pegCurrent=()=>pegFor(selected)||pegFor(current()?.peg);
const coordinate=p=>`${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
function persist(){try{localStorage.setItem('neoj-gear-lab-v2',serial());}catch{status('Draft storage unavailable. Save the design to a file.');}}
function release(){sim?.releaseCrank();latched=null;$('crank-banner').hidden=true;sync();}
function rebuild(){const next=new GearSimulation(design),previous=sim;running=false;latched=null;sim=next;previous?.dispose();sim.breaking=$('breaking').checked;sim.gravity=$('gravity').checked;view.setDesign(design,sim);sync();}
function edit(fn){const before=serial(),old=selected,previousUndo=[...undo],previousRedo=redo;try{fn();design=checkedScene(design);if(serial()!==before){undo.push(before);if(undo.length>40)undo.shift();redo=[];rebuild();persist();}else sync();return true;}catch(e){design=JSON.parse(before);selected=old;undo=previousUndo;redo=previousRedo;view.design=design;status(e.message);sync();return false;}}
function history(forward=false){const from=forward?redo:undo,to=forward?undo:redo;if(!from.length)return;to.push(serial());design=checkedScene(JSON.parse(from.pop()));selected=null;persist();rebuild();}
function values(kind='gear'){
 return{...defaultGear(),teeth:Number($('teeth').value),module:Number($('module').value)/1000,thickness:Number($('thickness').value)/1000,layer:Number($('layer').value),material:$('material').value,kind,motor:kind==='motor',drive:$('drive').value,rpm:Number($('rpm').value),torque:Number($('torque').value),brake:kind==='motor'&&$('drive').value==='ideal'?0:Number($('brake').value),link:$('link').value?Number($('link').value):null,handTorque:Number($('hand-torque').value)};
}
function sync(){
 const g=current(),p=pegCurrent(),w=currentWall(),motor=g?.kind==='motor'||!g&&tool==='motor';
 $('selection-title').textContent=g?(g.kind==='motor'?'Motor #':'Gear #')+g.id:w?'Wall #'+w.id:p?'Peg #'+p.id:tool==='wall'?'New wall':tool==='motor'?'New motor':tool==='crank'?'Place a hand crank':'New gear';
 $('selected-info').textContent=g?'Peg #'+g.peg+' · layer '+g.layer+(g.crank?' · hand crank':''):w?'Axis-aligned '+w.axis.toUpperCase()+' support':p?`${p.axis.toUpperCase()}${p.sign>0?'+':'−'} shaft · ${coordinate(p)}`:'Place a peg on a surface, then put a gear on it.';
 $('apply').disabled=!g;$('apply-wall').disabled=!w;$('stack').disabled=!g||g.crank;$('delete').disabled=selected===null;$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
 $('run').textContent=running?'Pause':'Run';$('run').classList.toggle('running',running);$('empty').hidden=!!design.pegs.length||!!design.walls.length;$('crank-banner').hidden=!latched;
 document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
 $('wall-controls').hidden=tool!=='wall'&&!w;$('gear-controls').hidden=tool==='wall'||!!w;$('motor-controls').hidden=!motor;$('hand-controls').hidden=!g?.crank;
 $('latch-crank').textContent=latched?'Release handle':'Latch handle';$('torque-field').hidden=$('drive').value!=='torque';$('brake').disabled=motor&&$('drive').value==='ideal';
 const link=$('link').value;$('link').replaceChildren(new Option('Free on peg',''),...design.gears.filter(o=>g&&o.id!==g.id&&o.peg===g.peg&&o.layer!==g.layer).map(o=>new Option('Part #'+o.id+' · layer '+o.layer,String(o.id))));
 if(g){for(const key of['teeth','layer','material','rpm','torque','brake','drive'])$(key).value=g[key];$('module').value=g.module*1000;$('thickness').value=g.thickness*1000;$('hand-torque').value=g.handTorque;$('link').value=g.link??'';$('torque-field').hidden=g.drive!=='torque';$('brake').disabled=g.kind==='motor'&&g.drive==='ideal';}else $('link').value=link;
 if(w){$('wall-axis').value=w.axis;$('wall-width').value=w.width;$('wall-height').value=w.height;$('wall-elevation').value=Math.max(0,w.y-(w.axis==='xz'?.03:w.height/2)-FLOOR_Y);}
}
function gearFits(g){
 const p=pegFor(g.peg),c=gearPoint(p,g),r=dimensions(g.teeth,g.module).outer,half=V(r,r,r);half[p.axis]=g.thickness/2;
 if(c.y-half.y<FLOOR_Y+.0001)throw Error('This gear would intersect the floor. Move the peg higher or reduce the gear size.');
 for(const w of design.walls){const s=wallSize(w);if(['x','y','z'].every(k=>Math.abs(c[k]-w[k])<half[k]+s[k]/2-.0001))throw Error('This gear would intersect a wall. Move the support or choose another layer.');}
}
function addGear(peg,kind='gear',config={}){
 const g={...values(kind),...config,id:design.nextId++,peg:peg.id};g.link=null;if(design.gears.some(o=>o.peg===peg.id&&o.layer===g.layer))throw Error('That peg already has a part here. Choose another layer or Stack a gear.');
 for(const host of design.gears){const hp=pegFor(host.peg);if(host.layer!==g.layer||Math.abs(host.module-g.module)>.000001||!sameMountPlane(peg,hp))continue;const delta=rotate(inverse(mountRotation(hp)),sub(peg,hp)),distance=Math.hypot(delta.x,delta.y),target=dimensions(host.teeth,host.module).pitch+dimensions(g.teeth,g.module).pitch;if(Math.abs(distance-target)<.006)g.angle=meshPhase(host,g.teeth,Math.atan2(delta.y,delta.x));}
 design.gears.push(g);gearFits(g);selected=g.id;return g;
}
function surfacePeg(hit){
 if(!hit)throw Error('Click the floor or a wall face.');const n=hit.normal;let axis=['x','y','z'].sort((a,b)=>Math.abs(n[b])-Math.abs(n[a]))[0],sign=n[axis]>=0?1:-1;
 if(hit.type==='floor'){axis='y';sign=1;hit.point.y=FLOOR_Y;}
 const p={id:design.nextId++,x:hit.point.x,y:hit.point.y,z:hit.point.z,axis,sign,surface:hit.type==='floor'?'floor':hit.id};
 // Keep the root exactly on the clicked face, even after floating point ray hits.
 if(hit.type==='wall'){const w=design.walls.find(w=>w.id===hit.id),size=wallSize(w);p[axis]=w[axis]+sign*size[axis]/2;}
 return p;
}
function snapPeg(p,event){
 if(!$('snap').checked||event.altKey)return p;const v=values();let best=.055,result=p;
 for(const host of design.gears){const hp=pegFor(host.peg);if(host.layer!==v.layer||Math.abs(host.module-v.module)>.000001||!sameMountPlane(p,hp))continue;const delta=sub(p,hp),distance=length(delta),target=dimensions(host.teeth,host.module).pitch+dimensions(v.teeth,v.module).pitch,diff=Math.abs(distance-target);if(distance>.001&&diff<best){best=diff;result={...p,...add(hp,mul(delta,target/distance))};}}
 return result;
}
function place(event){
 const picked=view.pick(event);
 if(tool==='gear'){
  const peg=picked?.type==='peg'?pegFor(picked.id):['gear','motor','crank'].includes(picked?.type)?pegFor(design.gears.find(g=>g.id===picked.id)?.peg):null;
  if(!peg){status('Gears go on pegs. Place a peg on the floor or a wall first.');return;}edit(()=>addGear(peg));return;
 }
 if(tool==='crank'){
  const g=design.gears.find(g=>g.id===picked?.id);if(!g||g.kind!=='gear'){status('Put a hand crank on an ordinary gear.');return;}
  const placed=edit(()=>{if(design.gears.some(o=>o.peg===g.peg&&o.layer>g.layer))throw Error('Put the crank on the outermost gear on this peg.');g.crank=true;g.handTorque=Number($('hand-torque').value);selected=g.id;tool='select';});if(placed)status('Click the grip to latch, then move around the shaft.');return;
 }
 if(tool==='wall'){
  const hit=view.surface(event);if(!hit||hit.normal.y<.9){status('Click the floor or the top of a platform to place an axis-aligned wall.');return;}
  edit(()=>{const wall=wallOnFloor(design.nextId++,$('wall-axis').value,hit.point,Number($('wall-width').value),Number($('wall-height').value),Number($('wall-elevation').value));design.walls.push(wall);for(const g of design.gears)gearFits(g);selected=wall.id;});return;
 }
 if(tool==='peg'||tool==='motor'){
  let peg=picked?.type==='peg'?pegFor(picked.id):['gear','motor','crank'].includes(picked?.type)?pegFor(design.gears.find(g=>g.id===picked.id)?.peg):null;
  if(tool==='peg'&&peg){selected=peg.id;sync();return;}
  edit(()=>{if(!peg){peg=snapPeg(surfacePeg(view.surface(event)),event);const existing=design.pegs.find(p=>sameMountPlane(p,peg)&&length(sub(p,peg))<.025);if(existing){design.nextId--;peg=existing;}else design.pegs.push(peg);}selected=peg.id;if(tool==='motor')addGear(peg,'motor');});
 }
}
function remove(){if(selected===null)return;edit(()=>{const wall=currentWall(),peg=design.pegs.some(p=>p.id===selected),gonePegs=new Set(design.pegs.filter(p=>p.id===selected||wall&&p.surface===wall.id).map(p=>p.id)),gone=new Set(design.gears.filter(g=>g.id===selected||gonePegs.has(g.peg)).map(g=>g.id));design.gears=design.gears.filter(g=>!gone.has(g.id));design.pegs=design.pegs.filter(p=>!gonePegs.has(p.id));design.walls=design.walls.filter(w=>w.id!==selected);for(const g of design.gears)if(gone.has(g.link))g.link=null;selected=null;});}
function example(name){
 const d=blankScene(),peg=(x,z)=>{const p={id:d.nextId++,x,y:FLOOR_Y,z,axis:'y',sign:1,surface:'floor'};d.pegs.push(p);return p;},gear=(p,extra={})=>{const g={...defaultGear(),...extra,id:d.nextId++,peg:p.id};d.gears.push(g);return g;},motor={kind:'motor',motor:true};
 if(name==='wall'){const w=wallOnFloor(d.nextId++,'xy',V(0,FLOOR_Y,-.35),1.6,1.2);d.walls.push(w);const pa={id:d.nextId++,x:-.15,y:.15,z:w.z+.03,axis:'z',sign:1,surface:w.id},pb={...pa,id:d.nextId++,x:.15};d.pegs.push(pa,pb);const a=gear(pa,motor),b=gear(pb,{teeth:30});b.angle=meshPhase(a,30,0);}
 else if(name==='overload'){const a=gear(peg(-.18,0),{...motor,teeth:40,material:'steel',rpm:120}),b=gear(peg(.18,0),{material:'wood',brake:500});b.angle=meshPhase(a,20,0);}
 else if(name==='compound'){const a=gear(peg(-.3,0),motor),p=peg(0,0),b=gear(p,{teeth:30});b.angle=meshPhase(a,30,0);const c=gear(p,{teeth:12,layer:1,link:b.id}),e=gear(peg(.252,0),{teeth:30,layer:1});e.angle=meshPhase(c,30,0);}
 else{const a=gear(peg(-.15,0),name==='crank'?{crank:true}:motor),b=gear(peg(.15,0),{teeth:30});b.angle=meshPhase(a,30,0);}
 return checkedScene(d);
}
function crankAngle(event,id){const g=sim.gears.get(id),center=gearPoint(pegFor(g.config.peg),g.config),point=view.planePoint(event,center,g.axis);if(!point)return null;const local=rotate(inverse(g.frame),sub(point,center));return Math.atan2(local.y,local.x);}
function latch(id,event=null){try{sim.latchCrank(id);const moved=view.revealCrank(sim.gears.get(id).axis);if(moved)$('view').textContent='Front view';latched={id,last:event&&!moved?crankAngle(event,id):null,target:sim.angle(sim.gears.get(id))};running=true;selected=id;tool='select';sync();status('Crank latched. Move around the shaft; click or Escape releases.');}catch(e){status(e.message);}}
function moveCrank(event){if(!latched)return;const angle=crankAngle(event,latched.id);if(angle===null)return;if(latched.last!==null)latched.target+=wrap(angle-latched.last);latched.last=angle;sim.setCrankTarget(latched.target);}
canvas.addEventListener('pointerdown',e=>{
 if(e.button>2)return;canvas.focus();canvas.setPointerCapture(e.pointerId);
 const orbit=e.button===2||e.shiftKey,hit=view.pick(e);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:view.yaw,pitch:view.pitch,moved:false,orbit,hit};
 if(orbit)return;
 if(latched){pointer.crank=true;pointer.wasLatched=true;moveCrank(e);return;}
 if(tool==='select'&&hit?.type==='crank'){latch(hit.id,e);pointer.crank=true;pointer.wasLatched=false;return;}
 if(tool==='select'){selected=hit?.id??null;const wall=currentWall(),peg=pegCurrent();if(wall){pointer.mount=wall.id;pointer.plane=V(0,1,0);pointer.origin=V(wall.x,wall.y,wall.z);}else if(peg){pointer.mount=peg.id;pointer.plane=normal(peg);pointer.origin={...peg};}if(pointer.mount){const drag=view.dragPlane(e,pointer.origin,pointer.plane);pointer.at=drag.point;pointer.dragPlane=drag.normal;}sync();}
});
canvas.addEventListener('pointermove',e=>{
 if(pointer&&pointer.id===e.pointerId){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(dx,dy)>4)pointer.moved=true;if(pointer.orbit){view.yaw=pointer.yaw-dx*.007;view.pitch=Math.max(-1.2,Math.min(1.35,pointer.pitch+dy*.007));view.resize();return;}}
 if(latched)moveCrank(e);
});
canvas.addEventListener('pointerup',e=>{
 if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;if(p.orbit)return;if(p.crank){if(p.wasLatched&&!p.moved)release();return;}
 if(tool==='select'&&p.moved&&p.mount&&p.at){const at=view.planePoint(e,p.origin,p.dragPlane);if(at)edit(()=>{const delta=sub(at,p.at),tangent=sub(delta,mul(p.plane,dot(delta,p.plane)));moveMount(design,p.mount,tangent);for(const g of design.gears)gearFits(g);});}else if(!p.moved&&tool!=='select')place(e);
});
canvas.addEventListener('pointercancel',()=>{pointer=null;release();});canvas.addEventListener('lostpointercapture',()=>pointer=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoom=Math.max(.15,Math.min(8,view.zoom*(e.deltaY<0?1.1:1/1.1)));view.resize();},{passive:false});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{release();tool=b.dataset.tool;selected=null;sync();status(tool==='gear'?'Click an existing peg to mount a gear.':tool==='peg'?'Click a floor or wall face to place a peg.':tool==='motor'?'Click a surface or peg to mount a motor.':tool==='crank'?'Click the outermost ordinary gear to attach a hand crank.':tool==='wall'?'Choose XY, YZ or XZ; click the floor to place.':'Click a part. Right-drag or Shift-drag to orbit.');});
$('apply').onclick=()=>{const g=current();if(!g)return;const v=values(g.kind);edit(()=>{Object.assign(g,v,{angle:g.angle,crank:g.crank});gearFits(g);});};
$('drive').onchange=()=>{$('torque-field').hidden=$('drive').value!=='torque';$('brake').disabled=$('drive').value==='ideal';};
$('apply-wall').onclick=()=>{const w=currentWall();if(!w)return;edit(()=>{const attached=design.pegs.some(p=>p.surface===w.id),axis=$('wall-axis').value;if(axis!==w.axis&&attached)throw Error('Remove the wall pegs before changing its plane.');const next=wallOnFloor(w.id,axis,V(w.x,FLOOR_Y,w.z),Number($('wall-width').value),Number($('wall-height').value),Number($('wall-elevation').value)),delta=sub(next,w);moveMount(design,w.id,delta);Object.assign(w,next);for(const g of design.gears)gearFits(g);});};
$('stack').onclick=()=>{const g=current();if(!g||g.crank)return;edit(()=>{let layer=0;while(design.gears.some(o=>o.peg===g.peg&&o.layer===layer))layer++;if(layer>6)throw Error('All seven stack layers are occupied.');const copy={...g,id:design.nextId++,layer,kind:'gear',motor:false,link:null,crank:false,brake:0};design.gears.push(copy);gearFits(copy);selected=copy.id;});};
$('latch-crank').onclick=()=>latched?release():current()?.crank&&latch(selected);$('release-crank').onclick=release;$('remove-crank').onclick=()=>{const g=current();if(g)edit(()=>g.crank=false);};
$('delete').onclick=remove;$('undo').onclick=()=>history();$('redo').onclick=()=>history(true);$('run').onclick=()=>{if(latched)release();running=!running;sync();status(running?'Simulating physical contacts.':'Paused.');};$('reset').onclick=()=>{rebuild();status('Mechanism reset; broken parts repaired.');};$('step').onclick=()=>{release();running=false;sim.step();sync();};$('fit').onclick=()=>view.fit();
$('view').onclick=()=>{const front=Math.abs(view.pitch)>.01||Math.abs(view.yaw)>.01;view.yaw=front?0:-.55;view.pitch=front?0:.62;view.resize();$('view').textContent=front?'3D view':'Front view';};$('breaking').onchange=()=>sim.breaking=$('breaking').checked;$('gravity').onchange=()=>sim.gravity=$('gravity').checked;
$('load-example').onclick=()=>{edit(()=>{design=example($('example').value);selected=design.gears[0].id;tool='select';});view.fit();status('Example loaded. Press Run, or latch the hand crank.');};$('new').onclick=()=>{edit(()=>{design=blankScene();selected=null;});view.yaw=-.55;view.pitch=.62;view.fit();};
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([serial()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='mechanism.gears';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status('Mechanism design saved.');};$('open').onclick=()=>$('file').click();
$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>1000000)throw Error('Use a design smaller than 1 MB.');const d=checkedScene(JSON.parse(await f.text()));edit(()=>{design=d;selected=null;});view.fit();status('Design opened.');}catch(e){status(e.message);}finally{$('file').value='';}};
document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,summary'))return;if(e.code==='Space'){e.preventDefault();$('run').click();}if(e.key==='Delete')remove();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey);}if(e.key==='Escape'){if(latched)release();else{pointer=null;selected=null;tool='select';sync();}}});
window.addEventListener('blur',()=>{running=false;pointer=null;release();});document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;release();}});
try{
 await ready;try{const saved=localStorage.getItem('neoj-gear-lab-v2')||localStorage.getItem('neoj-gear-lab-v1');if(saved)design=checkedScene(JSON.parse(saved));}catch{status('Saved draft was invalid. Starting with an empty floor.');}
 rebuild();new ResizeObserver(()=>view.resize()).observe($('viewport'));view.resize();installTouchButtons();status('Place pegs on the floor or wall faces, then mount gears.');
 window.gearLab=Object.freeze({snapshot:()=>({design:structuredClone(design),selected,tool,running,undo:undo.length,redo:redo.length,latched:latched?{...latched}:null,view:{yaw:view.yaw,pitch:view.pitch,zoom:view.zoom},rendered:view.stats(),runtime:sim.snapshot()}),worldPoint:(x,y,z=.06)=>view.point(V(x,y,z)),gearPoint:id=>{const g=design.gears.find(g=>g.id===id);return g?view.point(gearPoint(pegFor(g.peg),g)):null;},crankPoint:id=>{const g=sim.gears.get(id);if(!g?.config.crank)return null;const r=dimensions(g.config.teeth,g.config.module).outer*.72,p=add(mul(g.rb.translation(),.01),rotate(g.rb.rotation(),V(r,0,g.config.thickness/2+.04)));return view.point(p);}});
 const frame=time=>{const dt=last?(time-last)/1000:0;last=time;if(running)sim.advance(dt);view.draw(selected,$('stress').checked,latched?.id);const g=sim.gears.get(selected);$('readout').style.whiteSpace='pre-line';$('readout').textContent=g?`${(sim.speed(g)*30/Math.PI).toFixed(2)} RPM\n${g.ideal?'Constant RPM motor':g.torque.toFixed(3)+' N·m drive'}\n${(g.stress/1e6).toFixed(2)} MPa tooth stress\n${(g.peak/1e6).toFixed(2)} MPa peak\n${sim.mass(g).toFixed(3)} kg · ${g.missing.length} broken parts`:'Select a part for measurements.';$('time').textContent=sim.time.toFixed(2)+' s';$('measure').textContent=`240 Hz · ${design.gears.length} gears · ${sim.fragments.length} fragments`;requestAnimationFrame(frame);};requestAnimationFrame(frame);
}catch(e){status('Could not start Gear Lab: '+e.message);console.error(e);}
