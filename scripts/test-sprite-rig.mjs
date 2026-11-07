import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const url=path=>new URL(path,import.meta.url),moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const spatialURL=moduleURL(await readFile(url('../projects/sprite-rig/spatial.js'),'utf8')),S=await import(spatialURL);
const coreURL=moduleURL((await readFile(url('../projects/sprite-rig/core.js'),'utf8')).replace("'./spatial.js?v=3'",JSON.stringify(spatialURL))),C=await import(coreURL);
const E=await import(moduleURL(await readFile(url('../projects/sprite-rig/export.js'),'utf8')));
const R=await import(moduleURL((await readFile(url('../projects/sprite-rig/renderer.js'),'utf8')).replace("'./core.js?v=3'",JSON.stringify(coreURL)).replace("'./spatial.js?v=3'",JSON.stringify(spatialURL))));
let groups=0;const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),point=(p,x,y,z=0,t=1e-8)=>{close(p.x,x,t);close(p.y,y,t);close(p.z,z,t);},qClose=(a,b)=>close(Math.abs(a.reduce((n,v,i)=>n+v*b[i],0)),1);
async function test(name,run){await run();console.log('PASS '+name);groups++;}
const fresh=()=>C.newProject({name:'test.png',width:100,height:100,data:'data:image/png;base64,AA=='});
await test('quaternions rotate all three axes, compose, invert and round-trip Euler angles',()=>{
 point(S.rotate(S.axisAngle(S.V(1,0,0),Math.PI/2),S.V(0,1,0)),0,0,1);
 point(S.rotate(S.axisAngle(S.V(0,1,0),Math.PI/2),S.V(1,0,0)),0,0,-1);
 point(S.rotate(S.axisAngle(S.V(0,0,1),Math.PI/2),S.V(1,0,0)),0,1,0);
 for(let i=0;i<200;i++){const q=S.fromEuler(Math.sin(i)*3,Math.cos(i*.7)*1.5,Math.sin(i*.3)*3),angles=S.toEuler(q);qClose(q,S.fromEuler(angles.x,angles.y,angles.z));const v=S.V(i%11-5,i%7-3,i%13-6),rotated=S.rotate(q,v);close(S.length(rotated),S.length(v));point(S.rotate(S.qInverse(q),rotated),v.x,v.y,v.z);qClose(S.qMul(q,S.qInverse(q)),S.Q());}
 point(S.rotate(S.fromTo(S.V(1,0,0),S.V(-1,0,0)),S.V(1,0,0)),-1,0,0);
});
await test('3D hierarchy and inverse binds preserve rest geometry',()=>{
 const p=fresh(),a=C.addBone(p,null,S.V(10,20,30),S.V(50,20,30)),b=C.addBone(p,a.id,S.V(50,20,30),S.V(50,60,30));point(C.bonePoints(b,C.worldTransforms(p.bones).get(b.id)).end,50,60,30);const grid=C.makeGrid(100,100,4,4),deformed=C.deformPoints(grid,p.bones,p.pose,C.automaticWeights(grid,p.bones));deformed.forEach((v,i)=>point(v,grid.points[i].x,grid.points[i].y,0));p.pose[a.id].q=S.axisAngle(S.V(0,1,0),Math.PI/2);point(C.bonePoints(b,C.worldTransforms(p.bones,p.pose).get(b.id)).end,10,60,-10);
});
await test('world translations and rotations correctly convert through a rotated parent',()=>{
 const p=fresh(),a=C.addBone(p,null,S.V(),S.V(0,20,0)),b=C.addBone(p,a.id,S.V(0,20,0),S.V(0,40,0));const before=C.bonePoints(b,C.worldTransforms(p.bones,p.pose).get(b.id));C.translateWorld(p.bones,p.pose,b.id,S.V(10,0,15));const after=C.bonePoints(b,C.worldTransforms(p.bones,p.pose).get(b.id));point(S.sub(after.start,before.start),10,0,15);point(S.sub(after.end,before.end),10,0,15);C.rotateWorld(p.bones,p.pose,b.id,S.axisAngle(S.V(1,0,0),Math.PI/2));point(C.bonePoints(b,C.worldTransforms(p.bones,p.pose).get(b.id)).end,10,20,35);
});
await test('3D linear skinning moves texture vertices out of the image plane',()=>{
 const p=fresh(),b=C.addBone(p,null,S.V(25,25,0),S.V(75,25,0));p.pose[b.id].q=S.axisAngle(S.V(0,1,0),Math.PI/2);const result=C.deformPoints({points:[S.V(75,25,0)]},p.bones,p.pose,[[{id:b.id,w:1}]]);point(result[0],25,25,-50);
});
await test('3D IK reaches a depth target while preserving the shared root and bone lengths',()=>{
 const p=fresh(),root=C.addBone(p,null,S.V(),S.V(0,10,0)),arm=C.addBone(p,root.id,S.V(0,10,0),S.V(30,10,0)),tip=C.addBone(p,arm.id,S.V(30,10,0),S.V(60,10,0)),target=S.V(35,35,25),pose=C.solveIK(p.bones,p.pose,tip.id,target,true),transforms=C.worldTransforms(p.bones,pose),end=C.bonePoints(tip,transforms.get(tip.id)).end;qClose(pose[root.id].q,S.Q());assert.ok(S.length(S.sub(end,target))<.15);for(const b of p.bones){const points=C.bonePoints(b,transforms.get(b.id));close(S.length(S.sub(points.end,points.start)),b.length);}const fk=C.solveIK(p.bones,p.pose,tip.id,target,false);qClose(fk[arm.id].q,S.Q());assert.ok(Math.abs(fk[tip.id].q[1])>0);
});
await test('3D reparenting preserves world rest transforms; deletion cleans keys and weights',()=>{
 const p=fresh(),a=C.addBone(p,null,S.V(5,5,5),S.V(35,5,5)),b=C.addBone(p,a.id,S.V(35,5,5),S.V(35,35,25)),c=C.addBone(p,null,S.V(80,80,-20),S.V(90,90,0));const before=C.worldTransforms(p.bones).get(b.id);C.reparent(p,b.id,c.id);const after=C.worldTransforms(p.bones).get(b.id);point(after.position,before.position.x,before.position.y,before.position.z);qClose(after.rotation,before.rotation);assert.throws(()=>C.reparent(p,c.id,b.id),/descendants/);C.upsertKey(p,0,p.pose);C.removeBranch(p,c.id);assert.equal(p.bones.length,1);assert.equal(p.animation.keys[0].pose[b.id],undefined);assert.ok(p.mesh.weights.every(e=>e.every(w=>w.id===a.id)));
});
await test('rest tip edits in depth keep attached child joints connected',()=>{
 const p=fresh(),a=C.addBone(p,null,S.V(),S.V(20,0,0)),b=C.addBone(p,a.id,S.V(20,0,0),S.V(40,0,0));C.setBoneWorld(p,a.id,S.V(),S.V(0,20,30));point(C.bonePoints(b,C.worldTransforms(p.bones).get(b.id)).start,0,20,30);
});
await test('sprite vertices remain on one fixed XY plane for 3D poses and every editor angle',()=>{
 const p=fresh(),b=C.addBone(p,null,S.V(50,80,0),S.V(50,20,0)),grid=C.makeGrid(100,100,4,4),weights=grid.points.map(()=>[{id:b.id,w:1}]);p.pose[b.id].q=S.fromEuler(.6,.9,.2);p.pose[b.id].z=35;
 const vertices=C.spritePlanePoints(grid,p.bones,p.pose,weights);assert.ok(vertices.every(p=>p.z===0));assert.ok(vertices.some(p=>Math.abs(p.skinDepth)>1));const normal=S.unit(S.cross(S.sub(vertices[1],vertices[0]),S.sub(vertices[5],vertices[0])));close(Math.abs(normal.z),1);
 for(const camera of [{target:S.V(50,50,0),yaw:0,pitch:0,distance:300},{target:S.V(50,50,0),yaw:1.4,pitch:.4,distance:500}]){const same=C.spritePlanePoints(grid,p.bones,p.pose,weights,camera);assert.deepEqual(same,vertices);}
 const plain=C.spritePlanePoints(grid,[],{},grid.points.map(()=>[]));plain.forEach((p,i)=>point(p,grid.points[i].x,grid.points[i].y,0));
});
await test('3D depth produces 2D perspective changes with stable rest coordinates',()=>{
 const p=fresh(),b=C.addBone(p,null,S.V(50,50,0),S.V(80,50,0)),grid={points:[S.V(70,50,0),S.V(30,50,0)],width:100,height:100},weights=[[{id:b.id,w:1}],[{id:b.id,w:1}]];const rest=C.spritePlanePoints(grid,p.bones,p.pose,weights);point(rest[0],70,50);point(rest[1],30,50);
 p.pose[b.id].z=100;const far=C.spritePlanePoints(grid,p.bones,p.pose,weights);point(far[0],50+20*2/3,50);point(far[1],50-20*2/3,50);assert.ok(far[0].x-far[1].x<rest[0].x-rest[1].x);p.pose[b.id].z=-100;const near=C.spritePlanePoints(grid,p.bones,p.pose,weights);point(near[0],90,50);point(near[1],10,50);assert.ok(near.every(p=>p.z===0));
 p.pose[b.id].z=0;p.pose[b.id].q=S.axisAngle(S.V(0,1,0),Math.PI/3);const foreshortened=C.spritePlanePoints(grid,p.bones,p.pose,weights);assert.ok(foreshortened[0].x-foreshortened[1].x<rest[0].x-rest[1].x);assert.ok(foreshortened.every(p=>p.z===0));
});
await test('camera projection, unprojection, perspective depth and fit work in XYZ',()=>{
 const camera={target:S.V(40,50,20),yaw:.7,pitch:.4,distance:500},basis=S.cameraBasis(camera,900,600);for(const [x,y]of [[0,0],[450,300],[790,550]]){const world=S.screenOnPlane({x,y},camera.target,camera,900,600),screen=S.projectPoint(world,camera,900,600);close(screen.x,x);close(screen.y,y);close(S.dot(S.sub(world,camera.target),basis.forward),0);}const f={target:S.V(),yaw:0,pitch:0,distance:300},near=S.projectPoint(S.V(20,0,0),f,600,600),far=S.projectPoint(S.V(20,0,150),f,600,600);assert.ok(far.x-300<near.x-300);const points=[S.V(-100,-100,-100),S.V(100,100,100)],fit=S.fitCamera(points,320,600,f);for(const point of points){const s=S.projectPoint(point,fit,320,600);assert.ok(s&&s.x>0&&s.x<320&&s.y>0&&s.y<600);}assert.throws(()=>S.validateCamera({...f,distance:0}),/camera/);
});
await test('automatic and painted 3D rig weights remain normalized and local',()=>{
 const p=fresh();C.addBone(p,null,S.V(10,10,0),S.V(30,10,0));const b=C.addBone(p,null,S.V(80,80,40),S.V(90,80,40)),outside=structuredClone(p.mesh.weights.at(-1)),old=p.mesh.weights[0].find(e=>e.id===b.id)?.w??0;C.paintWeights(p,{x:0,y:0},b.id,20,.8);assert.equal(p.autoWeights,false);assert.ok(p.mesh.weights[0].find(e=>e.id===b.id).w>old);assert.deepEqual(p.mesh.weights.at(-1),outside);const painted=p.mesh.weights[0].find(e=>e.id===b.id).w;C.paintWeights(p,{x:0,y:0},b.id,20,.5,true);assert.ok(p.mesh.weights[0].find(e=>e.id===b.id).w<painted);assert.ok(p.mesh.weights.every(e=>e.length<=4&&Math.abs(e.reduce((s,w)=>s+w.w,0)-1)<1e-10));
});
await test('quaternion keyframes take the short arc and interpolate depth; looping and replacement work',()=>{
 const p=fresh(),b=C.addBone(p,null,S.V(),S.V(30,0,0));p.animation.frames=20;p.animation.smooth=false;p.pose[b.id].q=S.fromEuler(0,170*Math.PI/180,0);C.upsertKey(p,0,p.pose);p.pose[b.id].q=S.fromEuler(0,-170*Math.PI/180,0);p.pose[b.id].z=100;C.upsertKey(p,10,p.pose);qClose(C.samplePose(p,5)[b.id].q,S.fromEuler(0,Math.PI,0));close(C.samplePose(p,5)[b.id].z,50);qClose(C.samplePose(p,20)[b.id].q,p.animation.keys[0].pose[b.id].q);p.animation.loop=false;close(C.samplePose(p,19)[b.id].z,100);C.upsertKey(p,10,C.cleanPose(p.bones));assert.equal(p.animation.keys.length,2);qClose(C.samplePose(p,19)[b.id].q,S.Q());
});
await test('v1 projects upgrade losslessly to 3D; malformed XYZ/quaternion projects are rejected',()=>{
 const old={format:'neoj-sprite-rig',version:1,name:'old rig',image:fresh().image,bones:[{id:1,name:'Root',parent:null,x:10,y:20,length:40,angle:Math.PI/2,radius:20}],pose:{1:{x:3,y:4,r:Math.PI/2}},autoWeights:true,mesh:{columns:4,rows:4,weights:Array.from({length:25},()=>[{id:1,w:1}])},animation:{frames:20,fps:24,loop:true,smooth:true,keys:[{frame:0,pose:{1:{x:3,y:4,r:Math.PI/2}}}]}};const p=C.validateProject(old);assert.equal(p.version,2);point(C.bonePoints(p.bones[0],C.worldTransforms(p.bones,p.pose).get(1)).end,-27,24,0);assert.deepEqual(C.validateProject(p),p);
 for(const change of [q=>q.bones[0].parent=1,q=>q.pose[1].z=NaN,q=>q.pose[1].q=[0,0,0,0],q=>q.bones[0].q=[0,0,5,1],q=>q.mesh.weights[0][0].id=999,q=>q.animation.keys.push(structuredClone(q.animation.keys[0])),q=>q.image.width=2049,q=>q.animation.frames=0,q=>q.mesh.weights.pop()]){const q=structuredClone(p);change(q);assert.throws(()=>C.validateProject(q));}
});
await test('export bounds cover all 3D poses on a fixed front plane, independent of editor camera',()=>{
 const p=fresh(),bone=C.addBone(p,null,S.V(),S.V(20,0,0)),grid=C.makeGrid(100,100,4,4),rgba=new Uint8Array(100*100*4);rgba[(10*100+10)*4+3]=255;const indices=C.activeTriangles(grid,rgba);assert.ok(indices.length>0&&indices.length<grid.indices.length);const moved=C.cleanPose(p.bones);moved[bone.id].x=50;moved[bone.id].z=20;p.mesh.weights=grid.points.map(()=>[{id:bone.id,w:1}]);const camera={target:S.V(50,50,0),yaw:.4,pitch:.2,distance:300},bounds=R.animationBounds(p,grid,indices,[p.pose,moved],2,true,camera);assert.ok(bounds.width>100);close(bounds.camera.yaw,0);close(bounds.camera.pitch,0);assert.deepEqual(R.animationBounds(p,grid,indices,[p.pose,moved],2,true,{...camera,yaw:1.5,distance:800}),bounds);
 const behind=C.cleanPose(p.bones);behind[bone.id].z=-1000;const clipped=C.spritePlanePoints(grid,p.bones,behind,p.mesh.weights);assert.ok(clipped.every(p=>p.clipped&&p.z===0&&Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.throws(()=>R.animationBounds(p,grid,indices,[behind],1,true),/sprite projection/);
});
await test('PNG animation and ZIP output decode with independent Python libraries',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sprite-rig-test-'));try{const a=new Uint8Array(8*8*4),b=new Uint8Array(8*8*4);for(let y=2;y<6;y++)for(let x=1;x<4;x++){a.set([100,200,80,255],(y*8+x)*4);b.set([240,100,20,255],(y*8+x+2)*4);}const apng=await E.encodeAPNG([a,b],8,8,2,24,true);await writeFile(join(dir,'test.png'),apng);const archive=E.zipStore([['sprite-sheet.png',apng],['frames.json','{"frames":2,"name":"moss"}']]);await writeFile(join(dir,'test.zip'),archive);
    const result=execFileSync('python',['-c',`import sys, pathlib, zipfile, json, zlib, struct\nfrom PIL import Image\np=pathlib.Path(sys.argv[1]); data=(p/'test.png').read_bytes(); at=8; seq=[]\nwhile at<len(data):\n n=struct.unpack('>I',data[at:at+4])[0]; kind=data[at+4:at+8]; payload=data[at+8:at+8+n]; crc=struct.unpack('>I',data[at+8+n:at+12+n])[0]; assert zlib.crc32(kind+payload)==crc\n if kind in (b'fcTL',b'fdAT'): seq.append(struct.unpack('>I',payload[:4])[0])\n at+=12+n\nassert seq==[0,1,2]\nim=Image.open(p/'test.png'); assert im.n_frames==2 and im.info['loop']==0\nim.seek(0); f0=im.convert('RGBA'); assert f0.getpixel((1,2))==(100,200,80,255) and f0.getpixel((0,0))[3]==0\nassert abs(im.info['duration']-1000/24)<.01\nim.seek(1); f1=im.convert('RGBA'); assert f1.getpixel((3,2))==(240,100,20,255) and f1.getpixel((1,2))[3]==0\nwith zipfile.ZipFile(p/'test.zip') as z:\n assert z.testzip() is None and z.namelist()==['sprite-sheet.png','frames.json']; assert z.read('sprite-sheet.png')==data; assert json.loads(z.read('frames.json'))['frames']==2\nprint('Pillow: 2 RGBA frames, timing, loop, alpha; zipfile: payloads and CRCs verified')`,dir],{encoding:'utf8'});console.log('  '+result.trim());
    await assert.rejects(()=>E.encodeAPNG([a],8,8,2,24),/missing/);await assert.rejects(()=>E.encodeAPNG([a,b],8,8,1,24),/Invalid/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
console.log(`\n${groups} Sprite Rig checks passed.`);
