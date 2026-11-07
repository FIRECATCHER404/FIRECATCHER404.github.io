import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const url=path=>new URL(path,import.meta.url),moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const coreURL=moduleURL(await readFile(url('../projects/sprite-rig/core.js'),'utf8')),C=await import(coreURL);
const E=await import(moduleURL(await readFile(url('../projects/sprite-rig/export.js'),'utf8')));
const R=await import(moduleURL((await readFile(url('../projects/sprite-rig/renderer.js'),'utf8')).replace("'./core.js'",JSON.stringify(coreURL))));
let groups=0;const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),point=(p,x,y)=>{close(p.x,x);close(p.y,y);};
async function test(name,run){await run();console.log('PASS '+name);groups++;}
const fresh=()=>C.newProject({name:'test.png',width:100,height:100,data:'data:image/png;base64,AA=='});
await test('hierarchical transforms and inverse binds preserve rest geometry',()=>{
  const p=fresh(),a=C.addBone(p,null,{x:10,y:20},{x:50,y:20}),b=C.addBone(p,a.id,{x:50,y:20},{x:50,y:60}),mat=C.worldMatrices(p.bones);point(C.bonePoints(b,mat.get(b.id)).end,50,60);
  const grid=C.makeGrid(100,100,4,4),deformed=C.deformPoints(grid,p.bones,p.pose,C.automaticWeights(grid,p.bones));deformed.forEach((v,i)=>point(v,grid.points[i].x,grid.points[i].y));
  p.pose[a.id].r=Math.PI/2;point(C.bonePoints(b,C.worldMatrices(p.bones,p.pose).get(b.id)).end,-30,60);
});
await test('linear blend skinning rotates vertices around the actual joint',()=>{
  const p=fresh(),b=C.addBone(p,null,{x:25,y:25},{x:75,y:25});p.pose[b.id].r=Math.PI/2;const grid={points:[{x:75,y:25},{x:25,y:75}]};const result=C.deformPoints(grid,p.bones,p.pose,[[{id:b.id,w:1}],[{id:b.id,w:1}]]);point(result[0],25,75);point(result[1],-25,25);
});
await test('IK reaches through a chain without rotating the shared root',()=>{
  const p=fresh(),root=C.addBone(p,null,{x:0,y:0},{x:0,y:10}),arm=C.addBone(p,root.id,{x:0,y:10},{x:30,y:10}),tip=C.addBone(p,arm.id,{x:30,y:10},{x:60,y:10});const pose=C.solveIK(p.bones,p.pose,tip.id,{x:35,y:40},true),end=C.bonePoints(tip,C.worldMatrices(p.bones,pose).get(tip.id)).end;close(pose[root.id].r,0);assert.ok(Math.hypot(end.x-35,end.y-40)<.15);
  const fk=C.solveIK(p.bones,p.pose,tip.id,{x:35,y:40},false);close(fk[arm.id].r,0);assert.notEqual(fk[tip.id].r,0);
});
await test('reparenting preserves rest position, rejects loops, and branch deletion cleans keys',()=>{
  const p=fresh(),a=C.addBone(p,null,{x:5,y:5},{x:35,y:5}),b=C.addBone(p,a.id,{x:35,y:5},{x:35,y:35}),c=C.addBone(p,null,{x:80,y:80},{x:90,y:90});const before=C.bonePoints(b,C.worldMatrices(p.bones).get(b.id));C.reparent(p,b.id,c.id);const after=C.bonePoints(b,C.worldMatrices(p.bones).get(b.id));point(after.start,before.start.x,before.start.y);point(after.end,before.end.x,before.end.y);assert.throws(()=>C.reparent(p,c.id,b.id),/descendants/);C.upsertKey(p,0,p.pose);C.removeBranch(p,c.id);assert.equal(p.bones.length,1);assert.equal(p.animation.keys[0].pose[b.id],undefined);assert.ok(p.mesh.weights.every(e=>e.every(w=>w.id===a.id)));
});
await test('rest tip edits keep attached child joints connected',()=>{
  const p=fresh(),a=C.addBone(p,null,{x:0,y:0},{x:20,y:0}),b=C.addBone(p,a.id,{x:20,y:0},{x:40,y:0});C.setBoneWorld(p,a.id,{x:0,y:0},{x:0,y:30});point(C.bonePoints(b,C.worldMatrices(p.bones).get(b.id)).start,0,30);
});
await test('automatic and painted weights stay normalized, bounded, and local',()=>{
  const p=fresh(),a=C.addBone(p,null,{x:10,y:10},{x:30,y:10}),b=C.addBone(p,null,{x:80,y:80},{x:90,y:80});assert.ok(p.mesh.weights.every(e=>e.length<=4&&Math.abs(e.reduce((s,w)=>s+w.w,0)-1)<1e-10));const grid=C.makeGrid(100,100,p.mesh.columns,p.mesh.rows),i=grid.points.findIndex(v=>v.x===0&&v.y===0),outside=structuredClone(p.mesh.weights.at(-1)),old=p.mesh.weights[i].find(e=>e.id===b.id)?.w??0;
  C.paintWeights(p,{x:0,y:0},b.id,20,.8);assert.equal(p.autoWeights,false);assert.ok(p.mesh.weights[i].find(e=>e.id===b.id).w>old);assert.deepEqual(p.mesh.weights.at(-1),outside);const painted=p.mesh.weights[i].find(e=>e.id===b.id).w;C.paintWeights(p,{x:0,y:0},b.id,20,.5,true);assert.ok(p.mesh.weights[i].find(e=>e.id===b.id).w<painted);assert.ok(p.mesh.weights.every(e=>Math.abs(e.reduce((s,w)=>s+w.w,0)-1)<1e-10));
});
await test('keyframes interpolate short rotation arcs, loop, clamp, and replace',()=>{
  const p=fresh(),b=C.addBone(p,null,{x:0,y:0},{x:30,y:0});p.animation.frames=20;p.animation.smooth=false;p.pose[b.id].r=170*Math.PI/180;C.upsertKey(p,0,p.pose);p.pose[b.id].r=-170*Math.PI/180;C.upsertKey(p,10,p.pose);close(Math.abs(C.samplePose(p,5)[b.id].r),Math.PI);close(C.samplePose(p,20)[b.id].r,170*Math.PI/180);p.animation.loop=false;close(C.samplePose(p,19)[b.id].r,-170*Math.PI/180);C.upsertKey(p,10,C.cleanPose(p.bones));assert.equal(p.animation.keys.length,2);close(C.samplePose(p,19)[b.id].r,0);
});
await test('project validation rejects corrupt rigs, weights, animation, and oversized sprites',()=>{
  const p=fresh();C.addBone(p,null,{x:0,y:0},{x:20,y:0});C.upsertKey(p,0,p.pose);assert.deepEqual(C.validateProject(p),p);
  for(const change of [q=>q.bones[0].parent=q.bones[0].id,q=>q.pose[1].r=NaN,q=>q.mesh.weights[0][0].id=999,q=>q.animation.keys.push(structuredClone(q.animation.keys[0])),q=>q.image.width=2049,q=>q.animation.frames=0,q=>q.mesh.weights.pop(),q=>q.bones.push({...q.bones[0]})]){const q=structuredClone(p);change(q);assert.throws(()=>C.validateProject(q));}
});
await test('alpha-aware geometry and common bounds include all posed frames',()=>{
  const p=fresh(),bone=C.addBone(p,null,{x:0,y:0},{x:20,y:0}),grid=C.makeGrid(100,100,4,4),rgba=new Uint8Array(100*100*4);rgba[(10*100+10)*4+3]=255;const indices=C.activeTriangles(grid,rgba);assert.ok(indices.length>0&&indices.length<grid.indices.length);const moved=C.cleanPose(p.bones);moved[bone.id].x=50;const weights=grid.points.map(()=>[{id:bone.id,w:1}]);p.mesh.weights=weights;const bounds=R.animationBounds(p,grid,indices,[p.pose,moved],2);assert.ok(bounds.width>=150);assert.ok(bounds.left<=0);assert.throws(()=>R.animationBounds(p,grid,indices,[{1:{r:0,x:10000,y:0}},p.pose],2),/too large/);
});
await test('PNG animation and ZIP output decode with independent Python libraries',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sprite-rig-test-'));try{const a=new Uint8Array(8*8*4),b=new Uint8Array(8*8*4);for(let y=2;y<6;y++)for(let x=1;x<4;x++){a.set([100,200,80,255],(y*8+x)*4);b.set([240,100,20,255],(y*8+x+2)*4);}const apng=await E.encodeAPNG([a,b],8,8,2,24,true);await writeFile(join(dir,'test.png'),apng);const archive=E.zipStore([['sprite-sheet.png',apng],['frames.json','{"frames":2,"name":"moss"}']]);await writeFile(join(dir,'test.zip'),archive);
    const result=execFileSync('python',['-c',`import sys, pathlib, zipfile, json, zlib, struct\nfrom PIL import Image\np=pathlib.Path(sys.argv[1]); data=(p/'test.png').read_bytes(); at=8; seq=[]\nwhile at<len(data):\n n=struct.unpack('>I',data[at:at+4])[0]; kind=data[at+4:at+8]; payload=data[at+8:at+8+n]; crc=struct.unpack('>I',data[at+8+n:at+12+n])[0]; assert zlib.crc32(kind+payload)==crc\n if kind in (b'fcTL',b'fdAT'): seq.append(struct.unpack('>I',payload[:4])[0])\n at+=12+n\nassert seq==[0,1,2]\nim=Image.open(p/'test.png'); assert im.n_frames==2 and im.info['loop']==0\nim.seek(0); f0=im.convert('RGBA'); assert f0.getpixel((1,2))==(100,200,80,255) and f0.getpixel((0,0))[3]==0\nassert abs(im.info['duration']-1000/24)<.01\nim.seek(1); f1=im.convert('RGBA'); assert f1.getpixel((3,2))==(240,100,20,255) and f1.getpixel((1,2))[3]==0\nwith zipfile.ZipFile(p/'test.zip') as z:\n assert z.testzip() is None and z.namelist()==['sprite-sheet.png','frames.json']; assert z.read('sprite-sheet.png')==data; assert json.loads(z.read('frames.json'))['frames']==2\nprint('Pillow: 2 RGBA frames, timing, loop, alpha; zipfile: payloads and CRCs verified')`,dir],{encoding:'utf8'});console.log('  '+result.trim());
    await assert.rejects(()=>E.encodeAPNG([a],8,8,2,24),/missing/);await assert.rejects(()=>E.encodeAPNG([a,b],8,8,1,24),/Invalid/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
console.log(`\n${groups} Sprite Rig checks passed.`);
