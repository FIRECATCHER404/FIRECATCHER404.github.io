import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source=await readFile(new URL("../projects/orbit/physics.js",import.meta.url));
const {Simulation,preset,SOFTENING,G,BASE_STEP,MAX_BODIES,MAX_MASS,validateScene,validateProject,circularSpeed,orbitNormal,orbitalTangent,DEFAULT_CAMERA,cameraBasis,projectPoint,screenRay,pickBody,panCamera,fitCamera,screenToWorld,zoomCamera}=await import(`data:text/javascript;base64,${source.toString("base64")}`);
let groups=0;
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function test(name,run){run();groups++;console.log(`PASS ${name}`);}
function runFor(simulation,seconds){let left=seconds;while(left>1e-10){const chunk=Math.min(left,.1),result=simulation.advance(chunk,100000);assert.ok(result.remaining<1e-10);left-=chunk;}}
const body=(name,mass,x,y,vx=0,vy=0)=>({name,mass,x,y,vx,vy,color:"#85bce5"});
const separation=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test("isolated bodies preserve their launch velocity",()=>{
 const s=new Simulation();s.add(body("Probe",1,2,-3,4,-2));runFor(s,5);
 close(s.bodies[0].x,22);close(s.bodies[0].y,-13);close(s.bodies[0].vx,4);close(s.bodies[0].vy,-2);close(s.time,5);
});
test("pair accelerations match softened Newtonian gravity and are equal/opposite forces",()=>{
 const s=new Simulation();s.add(body("A",12,-2,0));s.add(body("B",3,2,0));const a=s.accelerations(),factor=G*4/(16+SOFTENING**2)**1.5;
 close(a[0],3*factor);close(a[3],-12*factor);close(12*a[0]+3*a[3],0);close(a[1],0);close(a[4],0);close(a[2],0);close(a[5],0);
});
test("circular two-body orbit stays bounded over 100 revolutions",()=>{
 const s=new Simulation(preset("moon")),initial=s.invariants(),distance=separation(s.bodies[0],s.bodies[1]);
 const period=2*Math.PI*distance/circularSpeed(100,1,distance);
 let min=Infinity,max=0;
 for(let i=0;i<1000;i++){runFor(s,period/10);const r=separation(s.bodies[0],s.bodies[1]);min=Math.min(min,r);max=Math.max(max,r);}
 const end=s.invariants();assert.equal(s.bodies.length,2);assert.ok((max-min)/distance<0.0002,`radial variation ${(max-min)/distance}`);
 assert.ok(Math.abs((end.energy-initial.energy)/initial.energy)<1e-6);for(const key of ["px","py","pz","lx","ly","lz"])close(end[key],initial[key],1e-8);
 console.log(`  100 orbits: radial variation ${((max-min)/distance*100).toFixed(5)}%, relative energy error ${Math.abs((end.energy-initial.energy)/initial.energy).toExponential(2)}`);
});
test("binary stars orbit their shared center of mass",()=>{
 const s=new Simulation(preset("binary")),before=s.invariants(),r=8,period=2*Math.PI*r/circularSpeed(400,250,r);runFor(s,period*30);
 const after=s.invariants();close(after.px,0,1e-8);close(after.py,0,1e-8);assert.equal(s.bodies.length,2);assert.ok(Math.abs(after.energy/before.energy-1)<1e-6);
 const cx=s.bodies.reduce((sum,b)=>sum+b.mass*b.x,0)/after.mass,cy=s.bodies.reduce((sum,b)=>sum+b.mass*b.y,0)/after.mass;
 close(cx,0,1e-8);close(cy,0,1e-8);close(s.bodies.reduce((sum,b)=>sum+b.mass*b.z,0)/after.mass,0,1e-8);close(after.pz,0,1e-8);
});
test("mini solar system retains its moon and planets through repeated orbits",()=>{
 const s=new Simulation(preset("solar"));runFor(s,60);assert.equal(s.bodies.length,5);
 const sun=s.bodies.find(b=>b.name==="Sun"),tidal=s.bodies.find(b=>b.name==="Tidal"),moon=s.bodies.find(b=>b.name==="Luna");
 for(const planet of s.bodies.filter(b=>["Ember","Tidal","Verdant"].includes(b.name)))assert.ok(separation(planet,sun)<18);
 assert.ok(separation(moon,tidal)<.4);
});
test("fast head-on impacts cannot tunnel, and merges conserve mass and momentum",()=>{
 const s=new Simulation();s.add(body("Fast",2,-3,0,900,0));s.add(body("Slow",3,3,0,-600,0));const before=s.invariants();runFor(s,.02);
 assert.equal(s.bodies.length,1);const after=s.invariants();close(after.mass,before.mass);close(after.px,before.px,1e-8);close(after.py,before.py,1e-8);assert.ok(Number.isFinite(s.bodies[0].x));
});
test("overlap cascades resolve fully and editing mass merges contacts",()=>{
 const s=new Simulation();s.add(body("A",1,0,0));s.add(body("B",1,.3,0));s.add(body("C",1,-.3,0));
 const merged=s.edit(1,{mass:1000});assert.equal(s.bodies.length,1);assert.equal(merged.length,2);close(s.bodies[0].mass,1002);
});
test("invalid placement and edits leave an existing system unchanged",()=>{
 const s=new Simulation(preset("moon")),before=JSON.stringify(s.toJSON());
 assert.throws(()=>s.addOrbiter(1,{...body("Bad",1,s.bodies[0].x,s.bodies[0].y)}));assert.equal(JSON.stringify(s.toJSON()),before);
 assert.throws(()=>s.edit(1,{mass:-1}));assert.equal(JSON.stringify(s.toJSON()),before);
 assert.throws(()=>s.advance(NaN));
});
test("body limits, save round-trips, and corrupt-file validation",()=>{
 const s=new Simulation(preset("solar")),saved=JSON.parse(JSON.stringify(s.toJSON()));assert.deepEqual(new Simulation(saved).toJSON(),saved);
 for(const changed of [{version:3},{time:NaN},{bodies:[{...saved.bodies[0],mass:-2}]},{bodies:[saved.bodies[0],saved.bodies[0]]},{bodies:[{...saved.bodies[0],color:"red;evil"}]}])assert.throws(()=>validateScene({...saved,...changed}));
 const full=new Simulation();for(let i=0;i<MAX_BODIES;i++)full.add(body(`Body ${i}`,1,i*2,0));assert.throws(()=>full.add(body("Extra",1,-10,0)),/128/);
 const giant=new Simulation();giant.add(body("Giant",MAX_MASS,0,0));assert.throws(()=>giant.add(body("Extra",1,1000,0)),/total mass/);
});
test("camera zoom preserves the cursor anchor and fit handles portrait screens",()=>{
 const c={x:3,y:-2,span:20},p={x:125,y:514},before=screenToWorld(c,p,900,700),after=screenToWorld(zoomCamera(c,.3,p,900,700),p,900,700);
 close(before.x,after.x);close(before.y,after.y);
 close(before.z,after.z);
 const fitted=fitCamera(new Simulation(preset("solar")).bodies,320,800);assert.ok(fitted.span*320/800>30);
});
test("trails remain bounded and step limits return unadvanced time honestly",()=>{
 const s=new Simulation();s.add(body("Probe",1,0,0,1,0));const result=s.advance(1,2);assert.equal(result.steps,2);assert.ok(result.remaining>.9);close(result.advanced,BASE_STEP*2);
 runFor(s,30);assert.ok(s.bodies[0].trail.length<=900&&s.bodies[0].trail.length>100);s.clearTrails();assert.equal(s.bodies[0].trail.length,1);
});
test("all bodies exert mutual gravity in all three dimensions",()=>{
 const s=new Simulation();s.add({...body("A",7,-3,1),z:2});s.add({...body("B",3,4,-2),z:-1});s.add({...body("C",20,0,2),z:6});
 const a=s.accelerations(),axes=["x","y","z"];
 for(let i=0;i<s.bodies.length;i++)for(let axis=0;axis<3;axis++){
  let expected=0;for(let j=0;j<s.bodies.length;j++)if(i!==j){const p=s.bodies[i],q=s.bodies[j],distance=separation(p,q);expected+=G*q.mass*(q[axes[axis]]-p[axes[axis]])/(distance*distance+SOFTENING**2)**1.5;}
  close(a[3*i+axis],expected,1e-12);
 }
 for(let axis=0;axis<3;axis++)close(s.bodies.reduce((sum,b,i)=>sum+b.mass*a[3*i+axis],0),0,1e-12);
 const without=new Simulation(s.toJSON());without.remove(3);const other=without.accelerations();
 for(let i=0;i<6;i++)assert.ok(Math.abs(a[i]-other[i])>1e-5,"The third body must influence both other bodies.");
 runFor(s,.2);for(const b of s.bodies)assert.ok(Math.hypot(b.vx,b.vy,b.vz)>0,"No body is fixed.");
 const momentum=s.invariants();for(const key of ["px","py","pz"])close(momentum[key],0,1e-10);
});
test("bodies with identical X/Y but separated in Z do not merge",()=>{
 const s=new Simulation();s.add({...body("Below",2,0,0),z:-3});s.add({...body("Above",3,0,0),z:3});
 assert.equal(s.resolveCollisions().length,0);const a=s.accelerations();assert.ok(a[2]>0&&a[5]<0);close(a[0],0);close(a[1],0);runFor(s,.2);assert.equal(s.bodies.length,2);assert.ok(s.bodies[0].z>-3&&s.bodies[1].z<3);
});
test("inclined and vertical circular orbits remain in their true 3D planes",()=>{
 for(const tilt of [-45,35,75,90]){
  const s=new Simulation(),p=s.add(body("Primary",100,0,0));s.addOrbiter(p.id,{...body("Moon",1,2.8,0),z:0},false,orbitNormal(tilt));
  const normal=orbitNormal(tilt),initial=s.invariants(),period=2*Math.PI*2.8/circularSpeed(100,1,2.8);runFor(s,period*20);
  const r={x:s.bodies[1].x-s.bodies[0].x,y:s.bodies[1].y-s.bodies[0].y,z:s.bodies[1].z-s.bodies[0].z};
  close(r.x*normal.x+r.y*normal.y+r.z*normal.z,0,1e-8);assert.ok(Math.abs(Math.hypot(r.x,r.y,r.z)-2.8)<.001);
  for(const key of ["px","py","pz","lx","ly","lz"])close(s.invariants()[key],initial[key],1e-8);
 }
 const tangent=orbitalTangent({x:0,y:0,z:4});assert.ok(Number.isFinite(tangent.x));close(tangent.z,0);
});
test("fast Z-axis contacts merge and conserve all momentum components",()=>{
 const s=new Simulation();s.add({...body("A",2,0,0,4,-3),z:-3,vz:900});s.add({...body("B",3,0,0,4,-3),z:3,vz:-600});
 const before=s.invariants();runFor(s,.02);assert.equal(s.bodies.length,1);for(const key of ["mass","px","py","pz"])close(s.invariants()[key],before[key],1e-8);
});
test("old 2D files migrate, 3D files round-trip, and invalid Z is rejected",()=>{
 const old={version:1,time:5,bodies:[{id:1,...body("Old",2,1,3,4,5)}]},migrated=validateScene(old);
 assert.equal(migrated.version,2);assert.equal(migrated.bodies[0].z,0);assert.equal(migrated.bodies[0].vz,0);close(migrated.bodies[0].vx,4);
 for(const bad of [{z:NaN},{vz:10001},{z:undefined}])assert.throws(()=>validateScene({...migrated,bodies:[{...migrated.bodies[0],...bad}]}));
 const legacy={format:"neoj-orbit",version:1,scene:old,settings:{camera:{x:0,y:0,span:40},selectedId:1,tool:"place",bodyType:"planet",newMass:4,newColor:"#85bce5",speed:1,paused:true,trails:true,follow:false,clockwise:false,preset:"solar"}};
 const checked=validateProject(legacy);assert.equal(checked.settings.camera.z,0);assert.equal(checked.settings.orbitTilt,0);assert.equal(checked.simulation.bodies[0].vz,0);
 const saved={format:"neoj-orbit",version:2,scene:new Simulation(preset("solar")).toJSON(),settings:{...checked.settings,camera:{...DEFAULT_CAMERA},orbitTilt:45,placementZ:3,launchVz:2}};
 const restored=validateProject(JSON.parse(JSON.stringify(saved)));assert.deepEqual(restored.simulation.toJSON(),saved.scene);assert.deepEqual(restored.settings,saved.settings);
});
test("perspective projection, ray picking, depth order, and camera controls agree",()=>{
 const camera={...DEFAULT_CAMERA,x:2,y:-1,z:3},point={x:5,y:3,z:7},pixel=projectPoint(camera,point,1000,700),ray=screenRay(camera,pixel,1000,700);
 const vector={x:point.x-ray.origin.x,y:point.y-ray.origin.y,z:point.z-ray.origin.z},length=Math.hypot(vector.x,vector.y,vector.z);
 for(const axis of ["x","y","z"])close(vector[axis]/length,ray.direction[axis],1e-12);
 const basis=cameraBasis(camera),center={x:camera.x,y:camera.y,z:camera.z};
 const far={id:1,...center,radius:.5},near={id:2,x:center.x+basis.back.x*4,y:center.y+basis.back.y*4,z:center.z+basis.back.z*4,radius:.5};
 assert.equal(pickBody(camera,[far,near],{x:500,y:350},1000,700,0).id,2);
 assert.ok(projectPoint(camera,near,1000,700).scale>projectPoint(camera,far,1000,700).scale);
 const moved=panCamera(camera,100,40,700);assert.ok(Math.abs(moved.z-camera.z)>.01);
});
console.log(`${groups} orbital sandbox test groups passed.`);
