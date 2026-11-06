import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source=await readFile(new URL("../projects/orbit/physics.js",import.meta.url));
const {Simulation,preset,SOFTENING,G,BASE_STEP,MAX_BODIES,MAX_MASS,validateScene,circularSpeed,fitCamera,screenToWorld,zoomCamera}=await import(`data:text/javascript;base64,${source.toString("base64")}`);
let groups=0;
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function test(name,run){run();groups++;console.log(`PASS ${name}`);}
function runFor(simulation,seconds){let left=seconds;while(left>1e-10){const chunk=Math.min(left,.1),result=simulation.advance(chunk,100000);assert.ok(result.remaining<1e-10);left-=chunk;}}
const body=(name,mass,x,y,vx=0,vy=0)=>({name,mass,x,y,vx,vy,color:"#85bce5"});

test("isolated bodies preserve their launch velocity",()=>{
 const s=new Simulation();s.add(body("Probe",1,2,-3,4,-2));runFor(s,5);
 close(s.bodies[0].x,22);close(s.bodies[0].y,-13);close(s.bodies[0].vx,4);close(s.bodies[0].vy,-2);close(s.time,5);
});
test("pair accelerations match softened Newtonian gravity and are equal/opposite forces",()=>{
 const s=new Simulation();s.add(body("A",12,-2,0));s.add(body("B",3,2,0));const a=s.accelerations(),factor=G*4/(16+SOFTENING**2)**1.5;
 close(a[0],3*factor);close(a[2],-12*factor);close(12*a[0]+3*a[2],0);close(a[1],0);close(a[3],0);
});
test("circular two-body orbit stays bounded over 100 revolutions",()=>{
 const s=new Simulation(preset("moon")),initial=s.invariants(),distance=Math.hypot(s.bodies[0].x-s.bodies[1].x,s.bodies[0].y-s.bodies[1].y);
 const period=2*Math.PI*distance/circularSpeed(100,1,distance);
 let min=Infinity,max=0;
 for(let i=0;i<1000;i++){runFor(s,period/10);const r=Math.hypot(s.bodies[0].x-s.bodies[1].x,s.bodies[0].y-s.bodies[1].y);min=Math.min(min,r);max=Math.max(max,r);}
 const end=s.invariants();assert.equal(s.bodies.length,2);assert.ok((max-min)/distance<0.0002,`radial variation ${(max-min)/distance}`);
 assert.ok(Math.abs((end.energy-initial.energy)/initial.energy)<1e-6);close(end.px,initial.px,1e-9);close(end.py,initial.py,1e-9);close(end.angular,initial.angular,1e-8);
 console.log(`  100 orbits: radial variation ${((max-min)/distance*100).toFixed(5)}%, relative energy error ${Math.abs((end.energy-initial.energy)/initial.energy).toExponential(2)}`);
});
test("binary stars orbit their shared center of mass",()=>{
 const s=new Simulation(preset("binary")),before=s.invariants(),r=8,period=2*Math.PI*r/circularSpeed(400,250,r);runFor(s,period*30);
 const after=s.invariants();close(after.px,0,1e-8);close(after.py,0,1e-8);assert.equal(s.bodies.length,2);assert.ok(Math.abs(after.energy/before.energy-1)<1e-6);
 const cx=s.bodies.reduce((sum,b)=>sum+b.mass*b.x,0)/after.mass,cy=s.bodies.reduce((sum,b)=>sum+b.mass*b.y,0)/after.mass;
 close(cx,0,1e-8);close(cy,0,1e-8);
});
test("mini solar system retains its moon and planets through repeated orbits",()=>{
 const s=new Simulation(preset("solar"));runFor(s,60);assert.equal(s.bodies.length,5);
 const sun=s.bodies.find(b=>b.name==="Sun"),tidal=s.bodies.find(b=>b.name==="Tidal"),moon=s.bodies.find(b=>b.name==="Luna");
 for(const planet of s.bodies.filter(b=>["Ember","Tidal","Verdant"].includes(b.name)))assert.ok(Math.hypot(planet.x-sun.x,planet.y-sun.y)<18);
 assert.ok(Math.hypot(moon.x-tidal.x,moon.y-tidal.y)<.4);
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
 for(const changed of [{version:2},{time:NaN},{bodies:[{...saved.bodies[0],mass:-2}]},{bodies:[saved.bodies[0],saved.bodies[0]]},{bodies:[{...saved.bodies[0],color:"red;evil"}]}])assert.throws(()=>validateScene({...saved,...changed}));
 const full=new Simulation();for(let i=0;i<MAX_BODIES;i++)full.add(body(`Body ${i}`,1,i*2,0));assert.throws(()=>full.add(body("Extra",1,-10,0)),/128/);
 const giant=new Simulation();giant.add(body("Giant",MAX_MASS,0,0));assert.throws(()=>giant.add(body("Extra",1,1000,0)),/total mass/);
});
test("camera zoom preserves the cursor anchor and fit handles portrait screens",()=>{
 const c={x:3,y:-2,span:20},p={x:125,y:514},before=screenToWorld(c,p,900,700),after=screenToWorld(zoomCamera(c,.3,p,900,700),p,900,700);
 close(before.x,after.x);close(before.y,after.y);
 const fitted=fitCamera(new Simulation(preset("solar")).bodies,320,800);assert.ok(fitted.span*320/800>30);
});
test("trails remain bounded and step limits return unadvanced time honestly",()=>{
 const s=new Simulation();s.add(body("Probe",1,0,0,1,0));const result=s.advance(1,2);assert.equal(result.steps,2);assert.ok(result.remaining>.9);close(result.advanced,BASE_STEP*2);
 runFor(s,30);assert.ok(s.bodies[0].trail.length<=900&&s.bodies[0].trail.length>100);s.clearTrails();assert.equal(s.bodies[0].trail.length,1);
});
console.log(`${groups} orbital sandbox test groups passed.`);
