import{stepperExample,stepperInfo}from'./stepper.js?v=4';
import{GearSimulation,ready}from'./physics.js?v=4';
import{GearView}from'./view.js?v=4';
import{MATERIALS,dimensions,defaultGear,blankScene,checkedScene,meshPhase,nextStackLayer,connectParts,disconnectParts,connections}from'./geometry.js?v=4';
import{V,add,sub,mul,dot,length,rotate,inverse,normal,mountRotation,mountPoint,gearPoint,wallSize,wallOnFloor,sameMountPlane,moveMount,wrap,FLOOR_Y}from'./space.js?v=4';
import{installTouchButtons}from'../svg-shared/touch.js?v=2';
const $=id=>document.getElementById(id),canvas=$('world'),view=new GearView(canvas);
let design=blankScene(),sim,selected=null,selection=new Set(),additive=false,tool='select',running=false,undo=[],redo=[],pointer=null,last=0,latched=null,stepper=null,previewTime=0;
const status=text=>$('status').textContent=text,serial=()=>JSON.stringify(design),current=()=>design.gears.find(g=>g.id===selected),currentWall=()=>design.walls.find(w=>w.id===selected),pegFor=id=>design.pegs.find(p=>p.id===id),pegCurrent=()=>pegFor(selected)||pegFor(current()?.peg);
function choose(id,extend=false){if(!extend)selection.clear();if(id!==null){if(extend&&selection.has(id))selection.delete(id);else selection.add(id);}selected=[...selection].at(-1)??null;}
const selectedGears=()=>design.gears.filter(g=>selection.has(g.id));
function mountRoots(){const walls=design.walls.filter(w=>selection.has(w.id)).map(w=>w.id),pegs=design.pegs.filter(p=>selection.has(p.id)||selectedGears().some(g=>g.peg===p.id)).filter(p=>!walls.includes(p.surface)).map(p=>p.id);return[...walls,...pegs];}
function partsList(){
 const list=$('parts'),entries=[...design.walls.map(w=>({id:w.id,label:'Wall #'+w.id,detail:w.axis.toUpperCase()})),...design.pegs.flatMap(p=>[{id:p.id,label:'Peg #'+p.id,detail:p.axis.toUpperCase()+(p.sign>0?'+':'−')},...design.gears.filter(g=>g.peg===p.id).sort((a,b)=>a.layer-b.layer).map(g=>({id:g.id,label:(g.kind==='motor'?'Motor #':'Gear #')+g.id,detail:'L'+g.layer+(g.crank?' / crank':'')+(connections(design).some(c=>c.a===g.id||c.b===g.id)?' / linked':'')}))])];
 list.replaceChildren(...entries.map(item=>{const b=document.createElement('button');b.type='button';b.dataset.part=item.id;b.setAttribute('aria-pressed',String(selection.has(item.id)));const title=document.createElement('span'),detail=document.createElement('small');title.textContent=item.label;detail.textContent=item.detail;b.append(title,detail);return b;}));$('parts-empty').hidden=!!entries.length;
}
const coordinate=p=>`${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
function persist(){try{localStorage.setItem('neoj-gear-lab-v2',serial());}catch{status('Draft storage unavailable. Save the design to a file.');}}
function release(){sim?.releaseCrank();latched=null;$('crank-banner').hidden=true;sync();}
function rebuild(){const next=new GearSimulation(design),previous=sim;running=false;latched=null;sim=next;previous?.dispose();sim.breaking=$('breaking').checked;sim.gravity=$('gravity').checked;view.setDesign(design,sim);stepper=stepperInfo(design);previewTime=0;if(!stepper)$('ideal-preview').checked=false;sync();}
function edit(fn){const before=serial(),old=selected,oldSelection=new Set(selection),previousUndo=[...undo],previousRedo=redo;try{fn();design=checkedScene(design);if(serial()!==before){undo.push(before);if(undo.length>40)undo.shift();redo=[];rebuild();persist();}else sync();return true;}catch(e){design=JSON.parse(before);selected=old;selection=oldSelection;undo=previousUndo;redo=previousRedo;view.design=design;status(e.message);sync();return false;}}
function history(forward=false){const from=forward?redo:undo,to=forward?undo:redo;if(!from.length)return;to.push(serial());design=checkedScene(JSON.parse(from.pop()));choose(null);persist();rebuild();}
function values(kind='gear'){
 return{...defaultGear(),teeth:Number($('teeth').value),module:Number($('module').value)/1000,thickness:Number($('thickness').value)/1000,layer:0,material:$('material').value,kind,motor:kind==='motor',drive:$('drive').value,rpm:Number($('rpm').value),torque:Number($('torque').value),brake:kind==='motor'&&$('drive').value==='ideal'?0:Number($('brake').value),link:null,handTorque:Number($('hand-torque').value)};
}
function sync(){
 const valid=new Set([...design.walls,...design.pegs,...design.gears].map(p=>p.id));selection=new Set([...selection].filter(id=>valid.has(id)));selected=selection.has(selected)?selected:[...selection].at(-1)??null;
 const many=selection.size>1,gears=selectedGears(),allGears=gears.length===selection.size&&gears.length>0;
 const g=current(),p=pegCurrent(),w=currentWall(),motor=selection.size?allGears&&gears.every(g=>g.kind==='motor'):tool==='motor';
 $('selection-title').textContent=many?selection.size+' parts selected':g?(g.kind==='motor'?'Motor #':'Gear #')+g.id:w?'Wall #'+w.id:p?'Peg #'+p.id:tool==='wall'?'New wall':tool==='motor'?'New motor':tool==='crank'?'Place a hand crank':'New gear';
 $('selected-info').textContent=many?'Shift-click to add or remove parts. Drag a selected part to move the selection.':g?'Peg #'+g.peg+' · layer '+g.layer+(g.crank?' · hand crank':''):w?'Axis-aligned '+w.axis.toUpperCase()+' support':p?`${p.axis.toUpperCase()}${p.sign>0?'+':'−'} shaft · ${coordinate(p)}`:'Place a peg on a surface, then put a gear on it.';
 $('apply').disabled=!allGears;$('apply').textContent=many?'Apply to selected gears':'Apply to selected part';$('apply-wall').disabled=!w||many;$('delete').disabled=!selection.size;$('fuse').disabled=!allGears||gears.length<2;$('sync-gears').disabled=!allGears||gears.length<2;$('disconnect').disabled=!gears.some(g=>connections(design).some(c=>c.a===g.id||c.b===g.id));$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
 $('run').textContent=running?'Pause':'Run';$('run').classList.toggle('running',running);$('empty').hidden=!!design.pegs.length||!!design.walls.length;$('crank-banner').hidden=!latched;
 document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
 $('wall-controls').hidden=many||tool!=='wall'&&!w;$('gear-controls').hidden=many&&!allGears||tool==='wall'||!!w;$('motor-controls').hidden=!motor;$('hand-controls').hidden=many||!g?.crank;
 $('latch-crank').textContent=latched?'Release handle':'Latch handle';$('torque-field').hidden=$('drive').value!=='torque';$('brake').disabled=motor&&$('drive').value==='ideal';
 if(g){for(const key of['teeth','material','rpm','torque','brake','drive'])$(key).value=g[key];$('module').value=g.module*1000;$('thickness').value=g.thickness*1000;$('hand-torque').value=g.handTorque;$('torque-field').hidden=g.drive!=='torque';$('brake').disabled=allGears&&gears.every(o=>o.kind==='motor'&&o.drive==='ideal');}
 $('multi-select').setAttribute('aria-pressed',String(additive));$('selection-actions').hidden=!selection.size;partsList();
 if(w){$('wall-axis').value=w.axis;$('wall-width').value=w.width;$('wall-height').value=w.height;$('wall-elevation').value=Math.max(0,w.y-(w.axis==='xz'?.03:w.height/2)-FLOOR_Y);}
}
function gearFits(g){
 const p=pegFor(g.peg),c=gearPoint(p,g),r=dimensions(g.teeth,g.module).outer,half=V(r,r,r);half[p.axis]=g.thickness/2;
 if(c.y-half.y<FLOOR_Y+.0001)throw Error('This gear would intersect the floor. Move the peg higher or reduce the gear size.');
 for(const w of design.walls){const s=wallSize(w);if(['x','y','z'].every(k=>Math.abs(c[k]-w[k])<half[k]+s[k]/2-.0001))throw Error('This gear would intersect a wall. Move the support or use a smaller gear.');}
}
function addGear(peg,kind='gear',config={}){
 const g={...values(kind),...config,id:design.nextId++,peg:peg.id};g.link=null;g.layer=nextStackLayer(design,peg.id,g);
 for(const host of design.gears){const hp=pegFor(host.peg);if(host.layer!==g.layer||Math.abs(host.module-g.module)>.000001||!sameMountPlane(peg,hp))continue;const delta=rotate(inverse(mountRotation(hp)),sub(peg,hp)),distance=Math.hypot(delta.x,delta.y),target=dimensions(host.teeth,host.module).pitch+dimensions(g.teeth,g.module).pitch;if(Math.abs(distance-target)<.006)g.angle=meshPhase(host,g.teeth,Math.atan2(delta.y,delta.x));}
 design.gears.push(g);gearFits(g);choose(g.id);status('Placed '+(kind==='motor'?'motor':'gear')+' on peg #'+peg.id+' / layer '+g.layer+'.');return g;
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
  const placed=edit(()=>{if(design.gears.some(o=>o.peg===g.peg&&o.layer>g.layer))throw Error('Put the crank on the outermost gear on this peg.');g.crank=true;g.handTorque=Number($('hand-torque').value);choose(g.id);tool='select';});if(placed)status('Click the grip to latch, then move around the shaft.');return;
 }
 if(tool==='wall'){
  const hit=view.surface(event);if(!hit||hit.normal.y<.9){status('Click the floor or the top of a platform to place an axis-aligned wall.');return;}
  edit(()=>{const wall=wallOnFloor(design.nextId++,$('wall-axis').value,hit.point,Number($('wall-width').value),Number($('wall-height').value),Number($('wall-elevation').value));design.walls.push(wall);for(const g of design.gears)gearFits(g);choose(wall.id);});return;
 }
 if(tool==='peg'||tool==='motor'){
  let peg=picked?.type==='peg'?pegFor(picked.id):['gear','motor','crank'].includes(picked?.type)?pegFor(design.gears.find(g=>g.id===picked.id)?.peg):null;
  if(tool==='peg'&&peg){choose(peg.id);sync();return;}
  edit(()=>{if(!peg){peg=snapPeg(surfacePeg(view.surface(event)),event);const existing=design.pegs.find(p=>sameMountPlane(p,peg)&&length(sub(p,peg))<.025);if(existing){design.nextId--;peg=existing;}else design.pegs.push(peg);}choose(peg.id);if(tool==='motor')addGear(peg,'motor');});
 }
}
function remove(){if(!selection.size)return;edit(()=>{const gonePegs=new Set(design.pegs.filter(p=>selection.has(p.id)||selection.has(p.surface)).map(p=>p.id)),gone=new Set(design.gears.filter(g=>selection.has(g.id)||gonePegs.has(g.peg)).map(g=>g.id));disconnectParts(design,gone);design.gears=design.gears.filter(g=>!gone.has(g.id));design.pegs=design.pegs.filter(p=>!gonePegs.has(p.id));design.walls=design.walls.filter(w=>!selection.has(w.id));choose(null);});}
function example(name){
 const d=blankScene(),peg=(x,z)=>{const p={id:d.nextId++,x,y:FLOOR_Y,z,axis:'y',sign:1,surface:'floor'};d.pegs.push(p);return p;},gear=(p,extra={})=>{const g={...defaultGear(),...extra,id:d.nextId++,peg:p.id};d.gears.push(g);return g;},motor={kind:'motor',motor:true};
 if(name==='stepper')return stepperExample(Number($('stepper-stages').value));
 if(name==='wall'){const w=wallOnFloor(d.nextId++,'xy',V(0,FLOOR_Y,-.35),1.6,1.2);d.walls.push(w);const pa={id:d.nextId++,x:-.15,y:.15,z:w.z+.03,axis:'z',sign:1,surface:w.id},pb={...pa,id:d.nextId++,x:.15};d.pegs.push(pa,pb);const a=gear(pa,motor),b=gear(pb,{teeth:30});b.angle=meshPhase(a,30,0);}
 else if(name==='overload'){const a=gear(peg(-.18,0),{...motor,teeth:40,material:'steel',rpm:120}),b=gear(peg(.18,0),{material:'wood',brake:500});b.angle=meshPhase(a,20,0);}
 else if(name==='compound'){const a=gear(peg(-.3,0),motor),p=peg(0,0),b=gear(p,{teeth:30});b.angle=meshPhase(a,30,0);const c=gear(p,{teeth:12,layer:1,link:b.id}),e=gear(peg(.252,0),{teeth:30,layer:1});e.angle=meshPhase(c,30,0);}
 else{const a=gear(peg(-.15,0),name==='crank'?{crank:true}:motor),b=gear(peg(.15,0),{teeth:30});b.angle=meshPhase(a,30,0);}
 return checkedScene(d);
}
const previewActive=()=>!!stepper&&$('ideal-preview').checked;
function previewAngles(){if(!previewActive())return null;const input=sim.gears.get(stepper.input),turn=previewTime*input.config.rpm*Math.PI/30,map=new Map([[input.config.id,input.config.angle+turn]]);for(const item of design.stepper.stages){const stage=stepper.stages.find(s=>s.id===item.big);for(const id of[item.small,item.big])map.set(id,sim.gears.get(id).config.angle+turn*stage.ratio);}return map;}
function previewRPM(id){if(!previewActive())return null;const input=sim.gears.get(stepper.input);if(id===stepper.input)return input.config.rpm;const index=design.stepper.stages.findIndex(s=>s.small===id||s.big===id);return index<0?null:input.config.rpm*stepper.stages[index].ratio;}
const rpmText=n=>n.toLocaleString('en-US',{maximumFractionDigits:2});
function updateStepper(){
 $('stepper-readout').hidden=!stepper;if(!stepper)return;
 const input=sim.gears.get(stepper.input),output=sim.gears.get(stepper.output),expected=input.config.rpm*stepper.ratio;
 $('stepper-summary').textContent=stepper.stages.length+' stages / '+Math.abs(stepper.ratio).toLocaleString('en-US')+'× ideal speed gain';
 $('stepper-rpm').textContent=previewActive()?'Ideal preview: '+rpmText(expected)+' RPM at the output':'Motor '+rpmText(sim.speed(input)*30/Math.PI)+' RPM / output '+rpmText(sim.speed(output)*30/Math.PI)+' RPM measured';
 $('stepper-ideal').textContent='Ideal output: '+rpmText(expected)+' RPM. '+(previewActive()?'Preview ignores inertia, loads and breakage.':'Real acceleration, tooth failure and simulation limits affect the measured result.');$('stepper-table-unit').textContent=previewActive()?'Preview turns':'Measured RPM';
 const body=$('stepper-rows');if(body.children.length!==stepper.stages.length)body.replaceChildren(...stepper.stages.map((stage,i)=>{const row=document.createElement('tr');for(const text of[i+1,'','']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}return row;}));
 stepper.stages.forEach((stage,i)=>{body.children[i].children[1].textContent=rpmText(previewActive()?previewTime*input.config.rpm*stage.ratio/60:sim.speed(sim.gears.get(stage.id))*30/Math.PI);body.children[i].children[2].textContent=rpmText(input.config.rpm*stage.ratio);});
}
function crankAngle(event,id){const g=sim.gears.get(id),center=gearPoint(pegFor(g.config.peg),g.config),point=view.planePoint(event,center,g.axis);if(!point)return null;const local=rotate(inverse(g.frame),sub(point,center));return Math.atan2(local.y,local.x);}
function latch(id,event=null){try{if(previewActive()){$('ideal-preview').checked=false;rebuild();}sim.latchCrank(id);const moved=view.revealCrank(sim.gears.get(id).axis);if(moved)$('view').textContent='Front view';latched={id,last:event&&!moved?crankAngle(event,id):null,target:sim.angle(sim.gears.get(id))};running=true;choose(id);tool='select';sync();status('Crank latched. Move around the shaft; click or Escape releases.');}catch(e){status(e.message);}}
function moveCrank(event){if(!latched)return;const angle=crankAngle(event,latched.id);if(angle===null)return;if(latched.last!==null)latched.target+=wrap(angle-latched.last);latched.last=angle;sim.setCrankTarget(latched.target);}
canvas.addEventListener('pointerdown',e=>{
 if(e.button>2)return;canvas.focus();canvas.setPointerCapture(e.pointerId);
 const hit=view.pick(e),extend=tool==='select'&&(e.shiftKey||additive),orbit=e.button===2||e.shiftKey&&!hit;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:view.yaw,pitch:view.pitch,moved:false,orbit,hit};
 if(orbit)return;
 if(extend){if(latched)release();choose(hit?.id??null,true);pointer.selectionOnly=true;sync();return;}
 if(latched){pointer.crank=true;pointer.wasLatched=true;moveCrank(e);return;}
 if(tool==='select'&&hit?.type==='crank'){latch(hit.id,e);pointer.crank=true;pointer.wasLatched=false;return;}
 if(tool==='select'){if(!selection.has(hit?.id))choose(hit?.id??null);else selected=hit.id;const wall=currentWall(),peg=pegCurrent();if(wall){pointer.mount=wall.id;pointer.plane=V(0,1,0);pointer.origin=V(wall.x,wall.y,wall.z);}else if(peg){pointer.mount=peg.id;pointer.plane=normal(peg);pointer.origin={...peg};}if(pointer.mount){const drag=view.dragPlane(e,pointer.origin,pointer.plane);pointer.at=drag.point;pointer.dragPlane=drag.normal;}sync();}
});
canvas.addEventListener('pointermove',e=>{
 if(pointer&&pointer.id===e.pointerId){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(dx,dy)>4)pointer.moved=true;if(pointer.orbit){view.yaw=pointer.yaw-dx*.007;view.pitch=Math.max(-1.2,Math.min(1.35,pointer.pitch+dy*.007));view.resize();return;}}
 if(latched)moveCrank(e);
});
canvas.addEventListener('pointerup',e=>{
 if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;if(p.orbit||p.selectionOnly)return;if(p.crank){if(p.wasLatched&&!p.moved)release();return;}
 if(tool==='select'&&p.moved&&p.mount&&p.at){const at=view.planePoint(e,p.origin,p.dragPlane);if(at)edit(()=>{const delta=sub(at,p.at),roots=mountRoots();let tangent=sub(delta,mul(p.plane,dot(delta,p.plane)));for(const id of roots){const peg=pegFor(id),n=peg?normal(peg):V(0,1,0);tangent=sub(tangent,mul(n,dot(tangent,n)));}for(const id of roots)moveMount(design,id,tangent);for(const g of design.gears)gearFits(g);});}else if(!p.moved&&tool!=='select')place(e);
});
canvas.addEventListener('pointercancel',()=>{pointer=null;release();});canvas.addEventListener('lostpointercapture',()=>pointer=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoom=Math.max(.15,Math.min(8,view.zoom*(e.deltaY<0?1.1:1/1.1)));view.resize();},{passive:false});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{release();tool=b.dataset.tool;choose(null);sync();status(tool==='gear'?'Click a peg or a gear on it to add the next gear to its stack.':tool==='peg'?'Click a floor or wall face to place a peg.':tool==='motor'?'Click a surface or peg to mount a motor.':tool==='crank'?'Click the outermost ordinary gear to attach a hand crank.':tool==='wall'?'Choose XY, YZ or XZ; click the floor to place.':'Click to select. Shift-click adds parts. Right-drag orbits.');});
$('apply').onclick=()=>{const gears=selectedGears();if(!gears.length||gears.length!==selection.size)return;const v=values();edit(()=>{for(const g of gears){const editMotor=gears.every(o=>o.kind==='motor'),drive=editMotor?v.drive:g.drive,props={teeth:v.teeth,module:v.module,thickness:v.thickness,material:v.material,brake:g.kind==='motor'&&drive==='ideal'?0:v.brake};if(gears.length===1)props.handTorque=v.handTorque;if(editMotor)Object.assign(props,{drive:v.drive,rpm:v.rpm,torque:v.torque});Object.assign(g,props);gearFits(g);}});};
$('multi-select').onclick=()=>{release();tool='select';additive=!additive;sync();};
$('parts').onclick=e=>{const button=e.target.closest('[data-part]');if(!button)return;release();tool='select';choose(Number(button.dataset.part),e.shiftKey||additive);sync();};
for(const [id,kind]of[['fuse','fuse'],['sync-gears','sync']])$(id).onclick=()=>{if(edit(()=>connectParts(design,[...selection],kind)))status(kind==='fuse'?'Selected stack fused into one shaft.':'Selected parallel shafts coupled at 1:1 with their starting phase preserved.');};
$('disconnect').onclick=()=>{if(edit(()=>disconnectParts(design,selectedGears().map(g=>g.id))))status('Selected parts disconnected.');};
$('drive').onchange=()=>{$('torque-field').hidden=$('drive').value!=='torque';$('brake').disabled=$('drive').value==='ideal';};
$('apply-wall').onclick=()=>{const w=currentWall();if(!w)return;edit(()=>{const attached=design.pegs.some(p=>p.surface===w.id),axis=$('wall-axis').value;if(axis!==w.axis&&attached)throw Error('Remove the wall pegs before changing its plane.');const next=wallOnFloor(w.id,axis,V(w.x,FLOOR_Y,w.z),Number($('wall-width').value),Number($('wall-height').value),Number($('wall-elevation').value)),delta=sub(next,w);moveMount(design,w.id,delta);Object.assign(w,next);for(const g of design.gears)gearFits(g);});};
$('latch-crank').onclick=()=>latched?release():current()?.crank&&latch(selected);$('release-crank').onclick=release;$('remove-crank').onclick=()=>{const g=current();if(g)edit(()=>g.crank=false);};
$('ideal-preview').onchange=()=>{rebuild();status(previewActive()?'Ideal motion preview ready. Press Run; forces and breakage are excluded.':'Physical simulation ready. Press Run to measure actual motion.');};
$('delete').onclick=remove;$('undo').onclick=()=>history();$('redo').onclick=()=>history(true);$('run').onclick=()=>{if(latched)release();running=!running;sync();status(running?(previewActive()?'Playing ideal motion without loads or breakage.':'Simulating physical contacts.'):'Paused.');};$('reset').onclick=()=>{rebuild();status('Mechanism reset; broken parts repaired.');};$('step').onclick=()=>{release();running=false;if(previewActive())previewTime+=1/240;else sim.step();sync();};$('fit').onclick=()=>view.fit();
$('view').onclick=()=>{const front=Math.abs(view.pitch)>.01||Math.abs(view.yaw)>.01;view.yaw=front?0:-.55;view.pitch=front?0:.62;view.resize();$('view').textContent=front?'3D view':'Front view';};$('breaking').onchange=()=>sim.breaking=$('breaking').checked;$('gravity').onchange=()=>sim.gravity=$('gravity').checked;
$('example').onchange=()=>{$('stepper-options').hidden=$('example').value!=='stepper';};
$('load-example').onclick=()=>{if(edit(()=>{design=example($('example').value);choose(design.gears[0].id);tool='select';})){view.fit();status(stepper?'Stepper loaded. Every stage doubles speed; compare measured output with the ideal ratio.':'Example loaded. Press Run, or latch the hand crank.');}};$('new').onclick=()=>{edit(()=>{design=blankScene();choose(null);});view.yaw=-.55;view.pitch=.62;view.fit();};
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([serial()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='mechanism.gears';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status('Mechanism design saved.');};$('open').onclick=()=>$('file').click();
$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>1000000)throw Error('Use a design smaller than 1 MB.');const d=checkedScene(JSON.parse(await f.text()));edit(()=>{design=d;choose(null);});view.fit();status('Design opened.');}catch(e){status(e.message);}finally{$('file').value='';}};
document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,summary'))return;if(e.code==='Space'){e.preventDefault();$('run').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();selection=new Set(design.gears.map(g=>g.id));selected=[...selection].at(-1)??null;sync();}if(e.key==='Delete')remove();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey);}if(e.key==='Escape'){if(latched)release();else{pointer=null;choose(null);additive=false;tool='select';sync();}}});
window.addEventListener('blur',()=>{running=false;pointer=null;release();});document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;release();}});
try{
 await ready;try{const saved=localStorage.getItem('neoj-gear-lab-v2')||localStorage.getItem('neoj-gear-lab-v1');if(saved)design=checkedScene(JSON.parse(saved));}catch{status('Saved draft was invalid. Starting with an empty floor.');}
 rebuild();new ResizeObserver(()=>view.resize()).observe($('viewport'));view.resize();installTouchButtons();status('Place pegs on the floor or wall faces, then mount gears.');
 window.gearLab=Object.freeze({snapshot:()=>({design:structuredClone(design),selected,selection:[...selection],additive,tool,running,undo:undo.length,redo:redo.length,latched:latched?{...latched}:null,view:{yaw:view.yaw,pitch:view.pitch,zoom:view.zoom},rendered:view.stats(),stepper:stepper?{...structuredClone(stepper),preview:previewActive(),previewTime}:null,runtime:sim.snapshot()}),worldPoint:(x,y,z=.06)=>view.point(V(x,y,z)),gearPoint:id=>{const g=design.gears.find(g=>g.id===id);return g?view.point(gearPoint(pegFor(g.peg),g)):null;},crankPoint:id=>{const g=sim.gears.get(id);if(!g?.config.crank)return null;const r=dimensions(g.config.teeth,g.config.module).outer*.72,p=add(mul(g.rb.translation(),.01),rotate(g.rb.rotation(),V(r,0,g.config.thickness/2+.04)));return view.point(p);}});
 const frame=time=>{const dt=last?(time-last)/1000:0;last=time;if(running){if(previewActive())previewTime+=Math.max(0,Math.min(.1,dt));else sim.advance(dt);}view.draw(selection,$('stress').checked,latched?.id,previewAngles());const g=sim.gears.get(selected);$('readout').style.whiteSpace='pre-line';$('readout').textContent=g&&previewRPM(selected)!==null?`${rpmText(previewRPM(selected))} RPM\nIdeal motion preview\nNo inertia, loads or fracture`:g?`${(sim.speed(g)*30/Math.PI).toFixed(2)} RPM\n${g.ideal?'Constant RPM motor':g.torque.toFixed(3)+' N·m drive'}\n${(g.stress/1e6).toFixed(2)} MPa tooth stress\n${(g.peak/1e6).toFixed(2)} MPa peak\n${sim.mass(g).toFixed(3)} kg · ${g.missing.length} broken parts`:'Select a part for measurements.';updateStepper();$('time').textContent=(previewActive()?previewTime:sim.time).toFixed(2)+' s';$('measure').textContent=`${previewActive()?'Ideal preview':'240 Hz'} · ${design.gears.length} gears · ${sim.fragments.length} fragments`;requestAnimationFrame(frame);};requestAnimationFrame(frame);
}catch(e){status('Could not start Gear Lab: '+e.message);console.error(e);}
