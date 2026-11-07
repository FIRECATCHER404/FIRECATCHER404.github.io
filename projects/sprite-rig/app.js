import * as C from './core.js';
import {exampleProject} from './demo.js';
import {Renderer,decodeImage,animationBounds} from './renderer.js';
import {encodeAPNG,zipStore} from './export.js';
const $=id=>document.getElementById(id),clone=value=>structuredClone(value),viewport=$('viewport'),overlay=$('overlay'),ctx=overlay.getContext('2d'),renderer=new Renderer($('art'));
let project,asset,selected=null,mode='pose',rigTool='draw',frame=0,playing=false,busy=false,unkeyed=false,db=null,saveTimer=0,saveSerial=0,disposed=false;
let camera={x:128,y:160,zoom:1},width=1,height=1,dpr=1,gesture=null,pointers=new Map(),brushPoint=null,lastTime=0,undoStack=[],redoStack=[];
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const snapshot=()=>({project:clone(project),frame,unkeyed});
function remember(before){if(!before)return;undoStack.push(before);let size=0;for(let i=undoStack.length-1;i>=0;i--){size+=JSON.stringify(undoStack[i]).length;if(size>50000000||undoStack.length-i>30){undoStack.splice(0,i+1);break;}}redoStack=[];}
function selectedBone(){return project.bones.find(b=>b.id===selected);}
function currentPose(){return mode==='pose'?project.pose:C.cleanPose(project.bones);}
function screen(p){return{x:(p.x-camera.x)*camera.zoom+width/2,y:(p.y-camera.y)*camera.zoom+height/2};}
function world(p){return{x:(p.x-width/2)/camera.zoom+camera.x,y:(p.y-height/2)/camera.zoom+camera.y};}
function local(event){const r=viewport.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
function boneLocations(){const matrices=C.worldMatrices(project.bones,currentPose());return project.bones.map(b=>({bone:b,...C.bonePoints(b,matrices.get(b.id))}));}
function rebuild(){renderer.setProject(project,asset);}
function finish(before,message='',poseEdit=false){if(poseEdit){if($('auto-key').checked){C.upsertKey(project,Math.round(frame),project.pose);unkeyed=false;}else unkeyed=true;}remember(before);rebuild();sync();scheduleSave();if(message)status(message);}
function mutate(action,message='',poseEdit=false){if(busy)return;stop();const before=snapshot();try{action();finish(before,message,poseEdit);}catch(error){project=before.project;frame=before.frame;unkeyed=before.unkeyed;rebuild();sync();status(error.message,true);}}
function sync(){
  $('project-name').value=project.name;$('image-size').textContent=`${project.image.width} × ${project.image.height}`;$('bone-count').textContent=`${project.bones.length} / 32`;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===rigTool)));
  $('rig-tools').hidden=mode!=='rig';$('pose-tools').hidden=mode!=='pose';$('weight-tools').hidden=mode!=='weights';
  const help={rig:rigTool==='draw'?'Drag to draw a bone. Start at an existing tip to grow a chain.':'Drag joints to change the rest shape. Attached children follow.',pose:'Drag a tip to pose it. Drag a root joint to move the whole rig.',weights:'Select a bone and paint the parts of the sprite it should move.'};$('mode-help').textContent=help[mode];$('canvas-hint').textContent=help[mode];
  $('weight-status').textContent=project.autoWeights?'Automatic':'Painted';$('no-bones').hidden=project.bones.length>0;
  const list=$('bone-list');list.replaceChildren();const depths=new Map(),depth=b=>{if(depths.has(b.id))return depths.get(b.id);const n=b.parent===null?0:depth(project.bones.find(p=>p.id===b.parent))+1;depths.set(b.id,n);return n;};
  for(const bone of project.bones){const b=document.createElement('button');b.type='button';b.textContent=(bone.parent===null?'◇ ':'↳ ')+bone.name;b.style.paddingLeft=`${8+depth(bone)*10}px`;b.setAttribute('aria-pressed',String(bone.id===selected));b.dataset.bone=bone.id;b.addEventListener('click',()=>{selected=bone.id;sync();draw();});list.append(b);}
  const bone=selectedBone();$('bone-form').hidden=!bone;
  if(bone){$('bone-name').value=bone.name;$('bone-radius').value=bone.radius;$('bone-angle').value=+(C.angleWrap(project.pose[bone.id].r)*180/Math.PI).toFixed(2);$('offset-x').value=+project.pose[bone.id].x.toFixed(2);$('offset-y').value=+project.pose[bone.id].y.toFixed(2);$('root-offset').hidden=bone.parent!==null;$('bone-angle').disabled=mode!=='pose';$('offset-x').disabled=mode!=='pose';$('offset-y').disabled=mode!=='pose';
    const options=$('bone-parent');options.replaceChildren(new Option('None (root)',''));const excluded=C.descendants(project.bones,bone.id);for(const other of project.bones)if(!excluded.has(other.id))options.add(new Option(other.name,String(other.id)));options.value=bone.parent===null?'':String(bone.parent);
  }
  $('frames').value=project.animation.frames;$('fps').value=project.animation.fps;$('loop').checked=project.animation.loop;$('smooth').checked=project.animation.smooth;$('unkeyed').hidden=!unkeyed;
  $('undo').disabled=busy||!undoStack.length;$('redo').disabled=busy||!redoStack.length;$('bind').disabled=busy||!project.bones.length;$('reset-pose').disabled=busy||!project.bones.length;$('export-sheet').disabled=busy||unkeyed;$('export-animation').disabled=busy||unkeyed;$('play').disabled=busy||unkeyed;$('play').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-pressed',String(playing));syncTimeline();draw();
}
function syncTimeline(){
  const now=Math.floor(frame);$('playhead').max=project.animation.frames-1;$('playhead').value=now;$('frame-label').textContent=`${now+1} / ${project.animation.frames}`;
  $('delete-key').disabled=busy||!project.animation.keys.some(k=>k.frame===Math.round(frame));const markers=$('key-markers');markers.replaceChildren();for(const key of project.animation.keys){const button=document.createElement('button');button.title=`Key at frame ${key.frame+1}`;button.setAttribute('aria-label',`Go to keyframe ${key.frame+1}`);button.style.left=`${key.frame/Math.max(1,project.animation.frames-1)*100}%`;button.classList.toggle('active',key.frame===now);button.addEventListener('click',()=>seek(key.frame));markers.append(button);}
}
function draw(){
  if(!project||disposed)return;renderer.draw(currentPose(),{...camera,zoom:camera.zoom*dpr},mode==='weights'?.38:1,$('pixelated').checked);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  if(mode==='weights'&&selected){const {points}=renderer.grid;const used=new Set(renderer.indices);for(let i=0;i<points.length;i++)if(used.has(i)){const p=screen(points[i]),weight=project.mesh.weights[i].find(e=>e.id===selected)?.w??0;ctx.fillStyle=`rgba(${Math.round(80+80*weight)},${Math.round(100+145*weight)},85,${.15+weight*.75})`;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,Math.min(6,camera.zoom*2.2)),0,Math.PI*2);ctx.fill();}}
  if($('show-bones').checked||mode!=='pose')for(const {bone,start,end}of boneLocations()){
    const a=screen(start),b=screen(end),active=bone.id===selected,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,thickness=Math.min(6,length*.13),mx=a.x+dx*.25,my=a.y+dy*.25;
    ctx.lineWidth=active?2:1.4;ctx.strokeStyle=active?'#e4f8c4':'#a7c895';ctx.fillStyle=active?'#447a41cc':'#263d2b99';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(mx-dy/length*thickness,my+dx/length*thickness);ctx.lineTo(b.x,b.y);ctx.lineTo(mx+dy/length*thickness,my-dx/length*thickness);ctx.closePath();ctx.fill();ctx.stroke();
    for(const [p,r]of [[a,bone.parent===null?5:3],[b,active?5:3]]){ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle='#263829';ctx.fill();ctx.stroke();}
    if(active){ctx.font='12px Atkinson Hyperlegible Next, sans-serif';const label=bone.name,tw=ctx.measureText(label).width;ctx.fillStyle='#20251ddd';ctx.fillRect(b.x+10,b.y-13,tw+12,23);ctx.fillStyle='#d4e8bd';ctx.fillText(label,b.x+16,b.y+3);}
  }
  if(gesture?.kind==='draw'){const a=screen(gesture.start),b=screen(gesture.end);ctx.strokeStyle='#e7ffbf';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
  if(mode==='weights'&&brushPoint){ctx.strokeStyle='#d8ebc3';ctx.lineWidth=1;ctx.beginPath();ctx.arc(brushPoint.x,brushPoint.y,+$('brush-radius').value*camera.zoom,0,Math.PI*2);ctx.stroke();}
  $('zoom-label').textContent=`${Math.round(camera.zoom*100)}%`;
}
function fit(){if(!project)return;const pose=currentPose(),bounds=animationBounds(project,renderer.grid,renderer.indices,[pose],1,false);camera={x:bounds.camera.x,y:bounds.camera.y,zoom:Math.max(.05,Math.min(8,Math.min((width-70)/(bounds.width+20),(height-80)/(bounds.height+20))))};draw();}
function resize(){const r=viewport.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);dpr=Math.min(2,devicePixelRatio||1);for(const canvas of [$('art'),overlay]){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}draw();}
function stop(){if(!playing)return;playing=false;frame=Math.min(project.animation.frames-1,Math.round(frame));project.pose=C.samplePose(project,frame);sync();scheduleSave();}
function seek(value){if(busy)return;stop();const discarded=unkeyed;frame=Math.max(0,Math.min(project.animation.frames-1,Math.round(value)));project.pose=C.samplePose(project,frame);unkeyed=false;sync();scheduleSave();if(discarded)status('Moved to another frame; the unkeyed pose was discarded.');}
function togglePlay(){if(busy||unkeyed||gesture)return;if(playing){stop();return;}if(mode!=='pose')mode='pose';if(!project.animation.loop&&frame>=project.animation.frames-1)frame=0;playing=true;lastTime=performance.now();sync();}
function tick(time){if(disposed)return;if(playing&&!document.hidden){const dt=Math.min(.1,(time-lastTime)/1000);frame+=dt*project.animation.fps;if(frame>=project.animation.frames){if(project.animation.loop)frame%=project.animation.frames;else{frame=project.animation.frames-1;playing=false;}}project.pose=C.samplePose(project,frame);syncTimeline();draw();if(!playing){sync();scheduleSave();}}lastTime=time;requestAnimationFrame(tick);}
async function restore(state){project=C.validateProject(state.project);asset=await decodeImage(project.image.data,project.image);frame=Math.max(0,Math.min(project.animation.frames-1,state.frame??0));unkeyed=!!state.unkeyed;selected=project.bones.some(b=>b.id===selected)?selected:project.bones[0]?.id??null;rebuild();sync();scheduleSave();}
async function history(back){if(busy)return;if(gesture){cancelEdit();pointers.clear();}const from=back?undoStack:redoStack,to=back?redoStack:undoStack;if(!from.length)return;await withBusy(async()=>{const next=from.pop();to.push(snapshot());await restore(next);status(back?'Undid last edit.':'Redid last edit.');});}
async function storage(){return new Promise((resolve,reject)=>{const request=indexedDB.open('neoj-sprite-rig',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function dbRequest(mode,action){return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),request=action(tx.objectStore('drafts'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function scheduleSave(){clearTimeout(saveTimer);$('storage-status').textContent='Saving draft…';saveTimer=setTimeout(saveDraft,450);}
async function saveDraft(){clearTimeout(saveTimer);const serial=++saveSerial;try{if(!db)throw new Error('Storage unavailable');await dbRequest('readwrite',store=>store.put({...snapshot(),mode},'current'));if(serial===saveSerial)$('storage-status').textContent='Draft saved on this device.';}catch{$('storage-status').textContent='Draft could not be saved. Use Save project to keep your work.';}}
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const fileName=()=>project.name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,50)||'sprite';
async function withBusy(action){if(busy)return;stop();busy=true;const controls=[...document.querySelectorAll('button,input,select')],previous=controls.map(b=>b.disabled);controls.forEach(b=>{b.disabled=true;});try{await action();}catch(error){status(error.message||'Something went wrong. Your current project is still here.',true);}finally{busy=false;controls.forEach((b,i)=>{b.disabled=previous[i];});sync();}}
async function replaceConfirmed(title){if(!undoStack.length&&!unkeyed)return true;stop();$('replace-title').textContent=title;const dialog=$('replace-dialog');dialog.showModal();return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='replace'),{once:true}));}
async function loadProject(next,nextAsset,editor={frame:0,unkeyed:false}){remember(snapshot());project=next;asset=nextAsset;frame=editor.frame;unkeyed=editor.unkeyed;selected=project.bones[0]?.id??null;mode=project.bones.length?'pose':'rig';rebuild();sync();fit();scheduleSave();$('controls').classList.remove('open');$('controls-toggle').setAttribute('aria-expanded','false');}
async function exportFrames(type){await withBusy(async()=>{
  if(type!=='png'&&unkeyed)throw new Error('Add a key for the current pose before exporting the animation.');
  const poses=type==='png'?[clone(project.pose)]:Array.from({length:project.animation.frames},(_,i)=>C.samplePose(project,i)),scale=+$('export-scale').value,bounds=animationBounds(project,renderer.grid,renderer.indices,poses,scale),canvas=document.createElement('canvas');canvas.width=bounds.width;canvas.height=bounds.height;const output=new Renderer(canvas);output.setProject(project,asset);
  const png=()=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create PNG.')),'image/png'));
  try{
    if(type==='png'){output.draw(poses[0],bounds.camera,1,$('pixelated').checked);download(await png(),fileName()+'-frame.png');}
    else if(type==='animation'){
      const frames=async function*(){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const context=copy.getContext('2d',{willReadFrequently:true});for(const pose of poses){output.draw(pose,bounds.camera,1,$('pixelated').checked);context.clearRect(0,0,copy.width,copy.height);context.drawImage(canvas,0,0);yield context.getImageData(0,0,copy.width,copy.height).data;await new Promise(resolve=>setTimeout(resolve,0));}};
      const bytes=await encodeAPNG(frames(),canvas.width,canvas.height,poses.length,project.animation.fps,project.animation.loop,(done,total)=>status(`Exporting animation… ${done} / ${total}`));download(new Blob([bytes],{type:'image/png'}),fileName()+'-animation.png');
    }else{
      const columns=Math.min(Math.ceil(Math.sqrt(poses.length)),Math.floor(8192/canvas.width)),rows=Math.ceil(poses.length/columns);if(columns<1||rows*canvas.height>8192||columns*canvas.width*rows*canvas.height>32000000)throw new Error('The sprite sheet is too large. Reduce frames or export scale.');
      const sheet=document.createElement('canvas');sheet.width=columns*canvas.width;sheet.height=rows*canvas.height;const context=sheet.getContext('2d'),frames=[];
      for(let i=0;i<poses.length;i++){output.draw(poses[i],bounds.camera,1,$('pixelated').checked);const x=i%columns*canvas.width,y=Math.floor(i/columns)*canvas.height;context.drawImage(canvas,x,y);frames.push({frame:i,index:i+1,x,y,width:canvas.width,height:canvas.height,duration:1000/project.animation.fps});status(`Exporting sprite sheet… ${i+1} / ${poses.length}`);await new Promise(resolve=>setTimeout(resolve,0));}
      const blob=await new Promise((resolve,reject)=>sheet.toBlob(b=>b?resolve(b):reject(new Error('Could not create sprite sheet.')),'image/png')),metadata={name:project.name,image:'sprite-sheet.png',fps:project.animation.fps,loop:project.animation.loop,scale,origin:{x:-bounds.left*scale,y:-bounds.top*scale},frameWidth:canvas.width,frameHeight:canvas.height,columns,rows,frames};
      download(new Blob([zipStore([['sprite-sheet.png',new Uint8Array(await blob.arrayBuffer())],['frames.json',JSON.stringify(metadata,null,2)]])],{type:'application/zip'}),fileName()+'-sprite-sheet.zip');
    }status(type==='png'?'Frame exported.':type==='animation'?'Animated PNG exported.':'Sprite sheet and frame data exported.');
  }finally{output.dispose();}
});}
// Pointer gestures are one undoable edit; a second finger cancels an unfinished edit before panning.
function hitTest(p){const hits=[];for(const item of boneLocations()){const a=screen(item.start),b=screen(item.end);if(Math.hypot(p.x-b.x,p.y-b.y)<16)hits.push({...item,handle:'tip',distance:Math.hypot(p.x-b.x,p.y-b.y)});if(Math.hypot(p.x-a.x,p.y-a.y)<13)hits.push({...item,handle:'base',distance:Math.hypot(p.x-a.x,p.y-a.y)+(item.bone.parent===null?0:3)});if(C.distanceToSegment(p,a,b)<9)hits.push({...item,handle:'body',distance:20});}hits.sort((a,b)=>a.distance-b.distance);return hits[0];}
function cancelEdit(){if(gesture?.before){project=gesture.before.project;frame=gesture.before.frame;unkeyed=gesture.before.unkeyed;rebuild();}gesture=null;sync();}
viewport.addEventListener('contextmenu',e=>e.preventDefault());
viewport.addEventListener('pointerdown',event=>{
  if(busy||!project)return;event.preventDefault();viewport.focus({preventScroll:true});stop();const p=local(event);pointers.set(event.pointerId,p);viewport.setPointerCapture(event.pointerId);
  if(pointers.size===2){cancelEdit();const [a,b]=[...pointers.values()];gesture={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),anchor:world({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),zoom:camera.zoom};return;}if(pointers.size>2)return;
  if(event.button===2||event.button===1||event.altKey){gesture={kind:'pan',start:p,camera:{...camera}};return;}
  const hit=hitTest(p),point=world(p);if(mode==='weights'){if(hit&&event.ctrlKey){selected=hit.bone.id;sync();return;}if(!selected){status('Select a bone before painting.',true);return;}gesture={kind:'paint',before:snapshot(),last:point};C.paintWeights(project,point,selected,+$('brush-radius').value,+$('brush-strength').value,$('erase').checked||event.shiftKey);rebuild();draw();return;}
  if(mode==='rig'&&rigTool==='draw'){
    let start=point,parent=$('attach').checked?selected:null;if(hit&&hit.handle==='tip'){parent=hit.bone.id;start=hit.end;selected=parent;}else if(parent!==null){const chosen=boneLocations().find(item=>item.bone.id===parent);if(chosen&&Math.hypot(p.x-screen(chosen.end).x,p.y-screen(chosen.end).y)<22)start=chosen.end;}
    gesture={kind:'draw',before:snapshot(),parent,start,end:point};draw();return;
  }
  if(!hit){selected=null;gesture={kind:'pan',start:p,camera:{...camera}};sync();return;}
  selected=hit.bone.id;gesture={kind:mode==='rig'?'joint':hit.handle==='base'&&hit.bone.parent===null?'root':'pose',before:snapshot(),hit,start:point,previous:p};sync();
});
viewport.addEventListener('pointermove',event=>{
  if(!project||busy)return;const p=local(event);brushPoint=p;if(pointers.has(event.pointerId))pointers.set(event.pointerId,p);if(!gesture){if(mode==='weights')draw();return;}
  if(gesture.kind==='pinch'){if(pointers.size<2)return;const [a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};camera.zoom=Math.max(.05,Math.min(32,gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));camera.x=gesture.anchor.x-(mid.x-width/2)/camera.zoom;camera.y=gesture.anchor.y-(mid.y-height/2)/camera.zoom;draw();return;}
  const point=world(p);if(gesture.kind==='pan'){camera.x=gesture.camera.x-(p.x-gesture.start.x)/camera.zoom;camera.y=gesture.camera.y-(p.y-gesture.start.y)/camera.zoom;}
  else if(gesture.kind==='draw')gesture.end=point;
  else if(gesture.kind==='joint'){
    project=clone(gesture.before.project);const {hit,start}=gesture;if(hit.handle==='base')C.setBoneWorld(project,hit.bone.id,{x:hit.start.x+point.x-start.x,y:hit.start.y+point.y-start.y},hit.end);else C.setBoneWorld(project,hit.bone.id,hit.start,point);C.refreshWeights(project);rebuild();
  }else if(gesture.kind==='root'){
    project.pose=clone(gesture.before.project.pose);project.pose[selected].x=Math.max(-32768,Math.min(32768,project.pose[selected].x+point.x-gesture.start.x));project.pose[selected].y=Math.max(-32768,Math.min(32768,project.pose[selected].y+point.y-gesture.start.y));
  }else if(gesture.kind==='pose')project.pose=C.solveIK(project.bones,gesture.before.project.pose,selected,point,$('reach').checked);
  else if(gesture.kind==='paint'){const distance=Math.hypot(point.x-gesture.last.x,point.y-gesture.last.y),steps=Math.max(1,Math.ceil(distance/(+$('brush-radius').value*.25)));for(let i=1;i<=Math.min(200,steps);i++){const t=i/Math.min(200,steps);C.paintWeights(project,{x:gesture.last.x+(point.x-gesture.last.x)*t,y:gesture.last.y+(point.y-gesture.last.y)*t},selected,+$('brush-radius').value,+$('brush-strength').value,$('erase').checked||event.shiftKey);}gesture.last=point;rebuild();}
  draw();
});
function pointerEnd(event,cancel=false){
  if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);if(cancel){cancelEdit();return;}if(gesture?.kind==='pinch'){if(!pointers.size)gesture=null;return;}if(pointers.size)return;const g=gesture;gesture=null;if(!g)return;
  if(g.kind==='draw'){try{const bone=C.addBone(project,g.parent,g.start,g.end);selected=bone.id;finish(g.before,`Added ${bone.name}.`);}catch(error){status(error.message,true);draw();}}
  else if(['pose','root','joint','paint'].includes(g.kind)){
    if(JSON.stringify(project)!==JSON.stringify(g.before.project))finish(g.before,g.kind==='paint'?'Weights painted.':g.kind==='joint'?'Rest joint updated.':'Pose updated.',g.kind==='pose'||g.kind==='root');else{sync();draw();}
  }else draw();
}
viewport.addEventListener('pointerup',e=>pointerEnd(e));viewport.addEventListener('pointercancel',e=>pointerEnd(e,true));viewport.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))pointerEnd(e,true);});viewport.addEventListener('pointerleave',()=>{brushPoint=null;if(!gesture)draw();});
viewport.addEventListener('wheel',event=>{if(busy)return;event.preventDefault();const p=local(event),anchor=world(p);camera.zoom=Math.max(.05,Math.min(32,camera.zoom*Math.exp(-event.deltaY*.0015)));camera.x=anchor.x-(p.x-width/2)/camera.zoom;camera.y=anchor.y-(p.y-height/2)/camera.zoom;draw();},{passive:false});
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{stop();mode=button.dataset.mode;sync();}));document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{rigTool=button.dataset.tool;sync();}));
$('controls-toggle').addEventListener('click',()=>{const open=$('controls').classList.toggle('open');$('controls-toggle').setAttribute('aria-expanded',String(open));});
$('play').addEventListener('click',togglePlay);$('fit').addEventListener('click',fit);$('undo').addEventListener('click',()=>history(true));$('redo').addEventListener('click',()=>history(false));$('playhead').addEventListener('input',event=>seek(+event.target.value));
$('previous-key').addEventListener('click',()=>seek([...project.animation.keys].reverse().find(k=>k.frame<frame)?.frame??project.animation.keys.at(-1)?.frame??0));$('next-key').addEventListener('click',()=>seek(project.animation.keys.find(k=>k.frame>frame)?.frame??project.animation.keys[0]?.frame??0));
$('add-key').addEventListener('click',()=>mutate(()=>{C.upsertKey(project,Math.round(frame),project.pose);unkeyed=false;},'Keyframe saved.'));
$('delete-key').addEventListener('click',()=>mutate(()=>{project.animation.keys=project.animation.keys.filter(k=>k.frame!==Math.round(frame));project.pose=C.samplePose(project,frame);unkeyed=false;},'Keyframe deleted.'));
$('reset-pose').addEventListener('click',()=>mutate(()=>{project.pose=C.cleanPose(project.bones);},'Pose reset.',true));
$('bind').addEventListener('click',()=>mutate(()=>{project.autoWeights=true;C.refreshWeights(project);},'Automatic weights rebound.'));
$('project-name').addEventListener('change',()=>{const name=$('project-name').value.trim()||'My sprite';mutate(()=>{project.name=name;});});
$('bone-form').addEventListener('submit',event=>{event.preventDefault();if(!$('bone-form').reportValidity()||!selectedBone())return;
  const name=$('bone-name').value.trim(),parent=$('bone-parent').value===''?null:+$('bone-parent').value,radius=+$('bone-radius').value,angle=+$('bone-angle').value*Math.PI/180,x=+$('offset-x').value,y=+$('offset-y').value;if(!name)return;const bone=selectedBone(),poseChanged=mode==='pose'&&(Math.abs(bone?project.pose[bone.id].r-angle:0)>.0001||(bone.parent===null&&(Math.abs(project.pose[bone.id].x-x)>.005||Math.abs(project.pose[bone.id].y-y)>.005)));
  mutate(()=>{const b=selectedBone();b.name=name;b.radius=radius;if(b.parent!==parent)C.reparent(project,b.id,parent);if(mode==='pose'){project.pose[b.id].r=angle;if(b.parent===null){project.pose[b.id].x=x;project.pose[b.id].y=y;}}C.refreshWeights(project);},'Bone updated.',poseChanged);
});
$('bone-form').addEventListener('focusin',()=>{if(playing)stop();});
$('delete-bone').addEventListener('click',()=>mutate(()=>{C.removeBranch(project,selected);selected=null;},'Bone branch deleted. Use Undo to restore it.'));
for(const id of ['frames','fps'])$(id).addEventListener('change',()=>{const input=$(id);if(!input.reportValidity()||!Number.isInteger(+input.value)){status('Use whole numbers within the displayed range.',true);sync();return;}const next=+input.value;mutate(()=>{project.animation[id]=next;if(id==='frames'){const removed=project.animation.keys.filter(k=>k.frame>=next).length;project.animation.keys=project.animation.keys.filter(k=>k.frame<next);frame=Math.min(frame,next-1);project.pose=C.samplePose(project,frame);unkeyed=false;if(removed)status(`${removed} keyframe(s) beyond the new length removed. Undo restores them.`);}},id==='fps'?'Playback speed updated.':'');});
for(const id of ['loop','smooth'])$(id).addEventListener('change',()=>{const value=$(id).checked;mutate(()=>{project.animation[id]=value;if(!unkeyed)project.pose=C.samplePose(project,frame);},'Animation settings updated.');});
for(const id of ['show-bones','pixelated'])$(id).addEventListener('change',draw);$('brush-radius').addEventListener('input',()=>{$('radius-value').textContent=$('brush-radius').value+' px';draw();});
$('save').addEventListener('click',()=>{stop();download(new Blob([JSON.stringify({...project,editor:{frame:Math.round(frame),unkeyed}})],{type:'application/json'}),fileName()+'.spriterig');status('Project saved, including the sprite, bones, weights, and animation.');});
$('open').addEventListener('click',()=>$('project-file').click());$('import-sprite').addEventListener('click',()=>$('sprite-file').click());
$('project-file').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>20000000){status('Project files can be up to 20 MB.',true);return;}let next,nextAsset,editor;try{const raw=JSON.parse(await file.text());next=C.validateProject(raw);editor=raw.editor??{frame:0,unkeyed:JSON.stringify(next.pose)!==JSON.stringify(C.samplePose(next,0))};if(!editor||!Number.isInteger(editor.frame)||editor.frame<0||editor.frame>=next.animation.frames||typeof editor.unkeyed!=='boolean')throw new Error('Invalid saved playhead or working pose.');nextAsset=await decodeImage(next.image.data,next.image);}catch(error){status(error.message,true);return;}if(!await replaceConfirmed('Open another project?'))return;await withBusy(async()=>{await loadProject(next,nextAsset,editor);status('Project opened.');});});
$('sprite-file').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10000000){status('Choose a PNG, JPEG, or WebP image up to 10 MB.',true);return;}let next,nextAsset;try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The file could not be read.'));reader.readAsDataURL(file);});nextAsset=await decodeImage(data);next=C.newProject({data,width:nextAsset.image.width,height:nextAsset.image.height,name:file.name});}catch(error){status(error.message,true);return;}if(!await replaceConfirmed('Start a rig for this sprite?'))return;await withBusy(async()=>{await loadProject(next,nextAsset);status('Sprite imported. Draw the first bone in Rig mode.');});});
$('example').addEventListener('click',async()=>{if(!await replaceConfirmed('Load the example character?'))return;await withBusy(async()=>{const next=await exampleProject();await loadProject(next,await decodeImage(next.image.data));status('Example loaded. Press Play or drag a bone tip to try it.');});});
$('export-png').addEventListener('click',()=>exportFrames('png'));$('export-sheet').addEventListener('click',()=>exportFrames('sheet'));$('export-animation').addEventListener('click',()=>exportFrames('animation'));
document.addEventListener('keydown',event=>{if(busy||event.target.closest('input,select,textarea,dialog'))return;if((event.ctrlKey||event.metaKey)&&event.code==='KeyZ'){event.preventDefault();history(!event.shiftKey);return;}if(event.code==='Space'){event.preventDefault();togglePlay();}else if(event.code==='Home'){event.preventDefault();fit();}else if(event.code==='ArrowLeft'||event.code==='ArrowRight'){event.preventDefault();seek(frame+(event.code==='ArrowRight'?1:-1));}else if(event.code==='Escape'){cancelEdit();pointers.clear();$('controls').classList.remove('open');$('controls-toggle').setAttribute('aria-expanded','false');}});
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(document.hidden&&project)saveDraft();});window.addEventListener('pagehide',()=>{if(project)saveDraft();});
new ResizeObserver(resize).observe(viewport);
Object.defineProperty(window,'spriteRig',{value:Object.freeze({snapshot:()=>project?clone({name:project.name,bones:project.bones,pose:project.pose,keys:project.animation.keys,animation:{...project.animation,keys:undefined},frame,mode,rigTool,selected,playing,unkeyed,autoWeights:project.autoWeights,weights:{vertices:project.mesh.weights.length,normalized:project.mesh.weights.every(entries=>!project.bones.length||Math.abs(entries.reduce((n,e)=>n+e.w,0)-1)<1e-6)},camera,viewport:{width,height,dpr},bonePoints:boneLocations(),renderer:renderer.kind,undo:undoStack.length,redo:redoStack.length}):null}),writable:false});
try{
  let draft;try{db=await storage();draft=await dbRequest('readonly',store=>store.get('current'));}catch{$('storage-status').textContent='Browser storage is unavailable. Save a project file to keep your work.';}
  if(draft){try{await restore(draft);mode=['rig','pose','weights'].includes(draft.mode)?draft.mode:'pose';status('Your saved draft is ready.');}catch{draft=null;status('The previous draft could not be opened. The example is ready instead.',true);}}
  if(!draft){project=await exampleProject();asset=await decodeImage(project.image.data);selected=project.bones[5].id;rebuild();status('Drag a bone tip to pose the robot, or press Play. Import a sprite to make your own.');scheduleSave();}
  resize();sync();fit();requestAnimationFrame(tick);
}catch(error){status('Could not start the editor: '+error.message,true);}
