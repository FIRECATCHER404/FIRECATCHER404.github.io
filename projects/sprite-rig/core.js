export const MAX_BONES=32, MAX_FRAMES=240;
export const IDENTITY=[1,0,0,1,0,0];
export const angleWrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
export const transform=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
export const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function inverse(m){const determinant=m[0]*m[3]-m[1]*m[2];if(Math.abs(determinant)<1e-12)throw new Error("Invalid bone transform.");return[m[3]/determinant,-m[1]/determinant,-m[2]/determinant,m[0]/determinant,(m[2]*m[5]-m[3]*m[4])/determinant,(m[1]*m[4]-m[0]*m[5])/determinant];}
export const distanceToSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
export function worldMatrices(bones,pose={}){
  const result=new Map(),visiting=new Set(),byId=new Map(bones.map(b=>[b.id,b]));
  const visit=id=>{if(result.has(id))return result.get(id);if(visiting.has(id))throw new Error("Bones cannot form a parent loop.");const bone=byId.get(id);if(!bone)throw new Error("A bone's parent is missing.");visiting.add(id);const p=pose[id]??{r:0,x:0,y:0},angle=bone.angle+p.r,c=Math.cos(angle),s=Math.sin(angle),local=[c,s,-s,c,bone.x+p.x,bone.y+p.y],matrix=bone.parent===null?local:multiply(visit(bone.parent),local);visiting.delete(id);result.set(id,matrix);return matrix;};
  for(const bone of bones)visit(bone.id);return result;
}
export function bonePoints(bone,matrix){return{start:transform(matrix,{x:0,y:0}),end:transform(matrix,{x:bone.length,y:0})};}
export function cleanPose(bones,source={}){return Object.fromEntries(bones.map(b=>{const p=source[b.id]??{};return[b.id,{r:p.r??0,x:p.x??0,y:p.y??0}];}));}
export function skinMatrices(bones,pose){const rest=worldMatrices(bones),posed=worldMatrices(bones,pose);return new Map(bones.map(b=>[b.id,multiply(posed.get(b.id),inverse(rest.get(b.id)))]));}
export function makeGrid(width,height,columns=28,rows=Math.max(4,Math.min(48,Math.round(columns*height/width)))){
  const points=[],indices=[];for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)points.push({x:x/columns*width,y:y/rows*height});
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b);}
  return{points,indices,columns,rows,width,height};
}
export function activeTriangles(grid,rgba){
  const indices=[],{width,height,columns,rows}=grid;
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    let active=false;const left=Math.max(0,Math.floor(x*width/columns)-1),right=Math.min(width,Math.ceil((x+1)*width/columns)+1),top=Math.max(0,Math.floor(y*height/rows)-1),bottom=Math.min(height,Math.ceil((y+1)*height/rows)+1);
    outer:for(let py=top;py<bottom;py++)for(let px=left;px<right;px++)if(rgba[(py*width+px)*4+3]){active=true;break outer;}
    if(active){const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  return indices;
}
export function normalizeWeights(entries,bones,fallback=null){
  const valid=new Set(bones.map(b=>b.id)),merged=new Map();
  for(const entry of entries)if(valid.has(entry.id)&&Number.isFinite(entry.w)&&entry.w>0)merged.set(entry.id,(merged.get(entry.id)??0)+entry.w);
  const top=[...merged].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,e)=>n+e[1],0);
  if(!sum)return fallback&&valid.has(fallback)?[{id:fallback,w:1}]:bones.length?[{id:bones[0].id,w:1}]:[];
  return top.map(([id,w])=>({id,w:w/sum}));
}
export function automaticWeights(grid,bones){
  if(!bones.length)return grid.points.map(()=>[]);const matrices=worldMatrices(bones),segments=bones.map(b=>({bone:b,...bonePoints(b,matrices.get(b.id))}));
  return grid.points.map(p=>normalizeWeights(segments.map(({bone,start,end})=>({id:bone.id,w:(bone.radius**2/(distanceToSegment(p,start,end)**2+bone.radius**2))**3})),bones));
}
export function deformPoints(grid,bones,pose,weights){
  const matrices=skinMatrices(bones,pose);
  return grid.points.map((p,index)=>{if(!bones.length||!weights[index]?.length)return{...p};let x=0,y=0,total=0;for(const entry of weights[index]){const matrix=matrices.get(entry.id);if(!matrix)continue;const q=transform(matrix,p);x+=q.x*entry.w;y+=q.y*entry.w;total+=entry.w;}return total?{x:x/total,y:y/total}:{...p};});
}
export function paintWeights(project,point,boneId,radius,strength,erase=false){
  const grid=makeGrid(project.image.width,project.image.height,project.mesh.columns,project.mesh.rows);let changed=false;
  grid.points.forEach((p,index)=>{const distance=Math.hypot(p.x-point.x,p.y-point.y);if(distance>=radius)return;const current=project.mesh.weights[index],old=current.find(e=>e.id===boneId)?.w??0,amount=strength*(1-distance/radius),next=Math.max(0,Math.min(1,erase?old-amount:old+(1-old)*amount)),others=current.filter(e=>e.id!==boneId),sum=others.reduce((n,e)=>n+e.w,0);let entries;
    if(sum>0)entries=[...others.map(e=>({id:e.id,w:e.w/sum*(1-next)})),{id:boneId,w:next}];
    else if(erase){const fallback=project.bones.find(b=>b.id!==boneId);entries=fallback?[{id:boneId,w:next},{id:fallback.id,w:1-next}]:[{id:boneId,w:1}];}
    else entries=[{id:boneId,w:1}];
    project.mesh.weights[index]=normalizeWeights(entries,project.bones,boneId);changed=true;
  });
  if(changed)project.autoWeights=false;return changed;
}
export function newProject(image){const grid=makeGrid(image.width,image.height);return{format:"neoj-sprite-rig",version:1,name:image.name.replace(/\.[^.]+$/,"").slice(0,48)||"My sprite",image:{...image},bones:[],pose:{},mesh:{columns:grid.columns,rows:grid.rows,weights:grid.points.map(()=>[])},autoWeights:true,animation:{frames:48,fps:24,loop:true,smooth:true,keys:[]}};}
export function addBone(project,parent,start,end,name=""){
  if(project.bones.length>=MAX_BONES)throw new Error(`A rig can contain up to ${MAX_BONES} bones.`);
  const length=Math.hypot(end.x-start.x,end.y-start.y);if(!Number.isFinite(length)||length<2||length>8192)throw new Error("Draw a bone between 2 and 8192 sprite pixels long.");
  const id=Math.max(0,...project.bones.map(b=>b.id))+1,parentMatrix=parent===null?IDENTITY:worldMatrices(project.bones).get(parent);if(!parentMatrix)throw new Error("Select a valid parent joint.");
  const local=transform(inverse(parentMatrix),start),angle=angleWrap(Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(parentMatrix[1],parentMatrix[0]));
  if(Math.abs(local.x)>32768||Math.abs(local.y)>32768)throw new Error('This joint is too far from its parent. Move closer to the sprite.');
  const bone={id,name:name||`Bone ${id}`,parent,x:local.x,y:local.y,length,angle,radius:Math.max(8,Math.min(40,length*.4))};project.bones.push(bone);project.pose=cleanPose(project.bones,project.pose);for(const key of project.animation.keys)key.pose=cleanPose(project.bones,key.pose);
  refreshWeights(project);return bone;
}
export function refreshWeights(project){const grid=makeGrid(project.image.width,project.image.height,project.mesh.columns,project.mesh.rows);if(project.autoWeights)project.mesh.weights=automaticWeights(grid,project.bones);else project.mesh.weights=project.mesh.weights.map(entries=>normalizeWeights(entries,project.bones));}
export function setBoneWorld(project,id,start,end){
  const bone=project.bones.find(b=>b.id===id),matrix=bone.parent===null?IDENTITY:worldMatrices(project.bones).get(bone.parent),local=transform(inverse(matrix),start),length=Math.max(2,Math.min(8192,Math.hypot(end.x-start.x,end.y-start.y))),oldLength=bone.length;local.x=Math.max(-32768,Math.min(32768,local.x));local.y=Math.max(-32768,Math.min(32768,local.y));
  bone.x=local.x;bone.y=local.y;bone.angle=angleWrap(Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(matrix[1],matrix[0]));bone.length=length;
  for(const child of project.bones)if(child.parent===id&&Math.abs(child.x-oldLength)<.01&&Math.abs(child.y)<.01)child.x=length;
}
export function descendants(bones,id){const result=new Set([id]);let size=0;while(size!==result.size){size=result.size;for(const bone of bones)if(result.has(bone.parent))result.add(bone.id);}return result;}
export function reparent(project,id,parent){
  const bone=project.bones.find(b=>b.id===id);if(parent!==null&&descendants(project.bones,id).has(parent))throw new Error("A bone cannot be attached to itself or its descendants.");
  const matrices=worldMatrices(project.bones),global=matrices.get(id),base=parent===null?IDENTITY:matrices.get(parent);if(!base)throw new Error("The parent bone does not exist.");const local=multiply(inverse(base),global);if(Math.abs(local[4])>32768||Math.abs(local[5])>32768)throw new Error('This parent is too far from the joint.');bone.parent=parent;bone.x=local[4];bone.y=local[5];bone.angle=Math.atan2(local[1],local[0]);
}
export function removeBranch(project,id){const removed=descendants(project.bones,id);project.bones=project.bones.filter(b=>!removed.has(b.id));project.pose=cleanPose(project.bones,project.pose);for(const key of project.animation.keys)key.pose=cleanPose(project.bones,key.pose);refreshWeights(project);}
export function solveIK(bones,pose,id,target,reach=true){
  const result=cleanPose(bones,pose),byId=new Map(bones.map(b=>[b.id,b])),chain=[id];let current=byId.get(id);
  while(reach&&current.parent!==null){const parent=byId.get(current.parent);if(parent.parent===null||bones.filter(b=>b.parent===parent.id).length>1)break;chain.push(parent.id);current=parent;}
  for(let iteration=0;iteration<(reach?10:1);iteration++)for(const boneId of chain){const matrices=worldMatrices(bones,result),joint=transform(matrices.get(boneId),{x:0,y:0}),end=transform(matrices.get(id),{x:byId.get(id).length,y:0}),ax=end.x-joint.x,ay=end.y-joint.y,bx=target.x-joint.x,by=target.y-joint.y;if(Math.hypot(ax,ay)>1e-8&&Math.hypot(bx,by)>1e-8)result[boneId].r=angleWrap(result[boneId].r+Math.atan2(ax*by-ay*bx,ax*bx+ay*by));}
  return result;
}
export function upsertKey(project,frame,pose){const key={frame,pose:cleanPose(project.bones,pose)},index=project.animation.keys.findIndex(k=>k.frame===frame);if(index>=0)project.animation.keys[index]=key;else project.animation.keys.push(key);project.animation.keys.sort((a,b)=>a.frame-b.frame);}
export function samplePose(project,frame){
  const {keys,frames,loop,smooth}=project.animation;if(!keys.length)return cleanPose(project.bones,project.pose);if(keys.length===1)return cleanPose(project.bones,keys[0].pose);
  const time=loop?((frame%frames)+frames)%frames:Math.max(0,Math.min(frames-1,frame));let a=keys[0],b=keys.at(-1),ta=a.frame,tb=b.frame;
  if(time<keys[0].frame){if(!loop)return cleanPose(project.bones,keys[0].pose);a=keys.at(-1);ta=a.frame-frames;b=keys[0];tb=b.frame;}
  else if(time>=keys.at(-1).frame){if(!loop)return cleanPose(project.bones,keys.at(-1).pose);a=keys.at(-1);ta=a.frame;b=keys[0];tb=b.frame+frames;}
  else for(let i=0;i<keys.length-1;i++)if(time>=keys[i].frame&&time<keys[i+1].frame){a=keys[i];b=keys[i+1];ta=a.frame;tb=b.frame;break;}
  let mix=Math.max(0,Math.min(1,(time-ta)/(tb-ta||1)));if(smooth)mix=mix*mix*(3-2*mix);
  return Object.fromEntries(project.bones.map(bone=>{const p=a.pose[bone.id]??{r:0,x:0,y:0},q=b.pose[bone.id]??{r:0,x:0,y:0};return[bone.id,{r:p.r+angleWrap(q.r-p.r)*mix,x:p.x+(q.x-p.x)*mix,y:p.y+(q.y-p.y)*mix}];}));
}
export function validateProject(value){
  if(!value||value.format!=="neoj-sprite-rig"||value.version!==1)throw new Error("Choose a Sprite Rig .spriterig file.");
  const {image,mesh,animation}=value,finite=(n,max)=>typeof n==="number"&&Number.isFinite(n)&&Math.abs(n)<=max;
  if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||Math.min(image.width,image.height)<1||Math.max(image.width,image.height)>2048||typeof image.data!=="string"||image.data.length>15000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image.data))throw new Error("The embedded sprite is missing or invalid (maximum 2048 × 2048).");
  if(!Array.isArray(value.bones)||value.bones.length>MAX_BONES)throw new Error("This project has too many bones.");const ids=new Set();
  const bones=value.bones.map(b=>{if(!Number.isInteger(b.id)||b.id<1||b.id>1e9||ids.has(b.id)||typeof b.name!=="string"||!b.name.trim()||b.name.length>48||!(b.parent===null||Number.isInteger(b.parent))||![b.x,b.y].every(n=>finite(n,32768))||!finite(b.angle,Math.PI*100)||!finite(b.length,8192)||b.length<2||!finite(b.radius,2048)||b.radius<1)throw new Error("The rig contains an invalid bone.");ids.add(b.id);return{id:b.id,name:b.name,parent:b.parent,x:b.x,y:b.y,length:b.length,angle:b.angle,radius:b.radius};});worldMatrices(bones);
  const pose=source=>{if(!source||typeof source!=="object"||Array.isArray(source))throw new Error("Invalid pose data.");for(const p of Object.values(source))if(!p||!finite(p.r,Math.PI*100)||!finite(p.x,32768)||!finite(p.y,32768))throw new Error("Invalid pose values.");return cleanPose(bones,source);};
  if(!mesh||!Number.isInteger(mesh.columns)||!Number.isInteger(mesh.rows)||Math.min(mesh.columns,mesh.rows)<4||Math.max(mesh.columns,mesh.rows)>48||!Array.isArray(mesh.weights)||mesh.weights.length!==(mesh.columns+1)*(mesh.rows+1))throw new Error("Invalid sprite mesh.");
  const weights=mesh.weights.map(entries=>{if(!Array.isArray(entries)||entries.length>4||entries.some(e=>!e||!ids.has(e.id)||!finite(e.w,1)||e.w<0))throw new Error("Invalid skin weights.");return normalizeWeights(entries,bones);});
  if(!animation||!Number.isInteger(animation.frames)||animation.frames<1||animation.frames>MAX_FRAMES||!Number.isInteger(animation.fps)||animation.fps<1||animation.fps>60||typeof animation.loop!=="boolean"||typeof animation.smooth!=="boolean"||!Array.isArray(animation.keys)||animation.keys.length>MAX_FRAMES)throw new Error("Invalid animation settings.");
  const used=new Set(),keys=animation.keys.map(k=>{if(!Number.isInteger(k.frame)||k.frame<0||k.frame>=animation.frames||used.has(k.frame))throw new Error("Invalid or repeated keyframes.");used.add(k.frame);return{frame:k.frame,pose:pose(k.pose)};}).sort((a,b)=>a.frame-b.frame);
  if(typeof value.autoWeights!=="boolean")throw new Error("Invalid weight settings.");
  return{format:value.format,version:1,name:typeof value.name==="string"?value.name.slice(0,48):"My sprite",image:{data:image.data,width:image.width,height:image.height,name:typeof image.name==="string"?image.name.slice(0,128):"sprite.png"},bones,pose:pose(value.pose),mesh:{columns:mesh.columns,rows:mesh.rows,weights},autoWeights:value.autoWeights,animation:{frames:animation.frames,fps:animation.fps,loop:animation.loop,smooth:animation.smooth,keys}};
}
