import R from'../void-lab/vendor/rapier.js';
import{MATERIALS,dimensions,gearParts,hullVertices,polygonProperties,toothStress,checkedScene}from'./geometry.js?v=1';
export const ready=R.init(),DT=1/240,SCALE=100;
const V=(x=0,y=0,z=0)=>({x,y,z}),Q=a=>({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)}),rotate=(q,p)=>{const x=q.x,y=q.y,z=q.z,w=q.w,tx=2*(y*p.z-z*p.y),ty=2*(z*p.x-x*p.z),tz=2*(x*p.y-y*p.x);return V(p.x+w*tx+y*tz-z*ty,p.y+w*ty+z*tx-x*tz,p.z+w*tz+x*ty-y*tx);},cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x),add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z),sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
export class GearSimulation{
 constructor(scene){
  this.design=checkedScene(scene);this.world=new R.World(V());this.world.timestep=DT;this.world.numSolverIterations=16;this.world.numInternalPgsIterations=2;this.world.maxCcdSubsteps=6;this.world.integrationParameters.normalizedAllowedLinearError=.00001;this.world.integrationParameters.normalizedPredictionDistance=.0001;
  this.queue=new R.EventQueue(true);this.pegs=new Map();this.gears=new Map();this.fragments=[];this.colliders=new Map();this.events=[];this.time=0;this.remainder=0;this.breaking=true;this.gravity=false;this.serial=0;
  for(const p of scene.pegs)this.pegs.set(p.id,this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x*SCALE,p.y*SCALE,0)));
  for(const config of scene.gears)this.addGear(config);
  const linked=new Set();for(const g of this.gears.values())if(g.config.link!==null){const other=this.gears.get(g.config.link),key=[g.config.id,other.config.id].sort().join(':');if(!linked.has(key)){linked.add(key);const dz=g.rb.translation().z-other.rb.translation().z,da=g.config.angle-other.config.angle,j=this.world.createImpulseJoint(R.JointData.fixed(V(0,0,dz),Q(da),V(),Q(0)),other.rb,g.rb,true);j.setContactsEnabled(false);}}
 }
 addGear(config){const peg=this.design.pegs.find(p=>p.id===config.peg),rb=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(peg.x*SCALE,peg.y*SCALE,(.06+config.layer*.05)*SCALE).setRotation(Q(config.angle)).setCcdEnabled(true).setCanSleep(false).setAngularDamping(.015));const g={config:structuredClone(config),rb,parts:[],missing:[],stress:0,peak:0,torque:0,damage:Array(config.teeth).fill(0),revision:0};
  for(const part of gearParts(config.teeth,config.module)){const p={...part,collider:this.createCollider(rb,part.polygon,config.thickness,MATERIALS[config.material])};g.parts.push(p);this.colliders.set(p.collider.handle,{gear:g,part:p});}
  const joint=this.world.createImpulseJoint(R.JointData.revolute(V(0,0,(.06+config.layer*.05)*SCALE),V(),V(0,0,1)),this.pegs.get(config.peg),rb,true);joint.setContactsEnabled(false);if(config.brake>0){joint.configureMotorModel(R.MotorModel.ForceBased);joint.configureMotorVelocity(0,1e6);joint.setMotorMaxForce(config.brake*SCALE**2);}g.joint=joint;this.gears.set(config.id,g);return g;
 }
 createCollider(rb,polygon,thickness,material){const center=polygonProperties(polygon),local=polygon.map(p=>({x:p.x-center.x,y:p.y-center.y})),desc=R.ColliderDesc.convexHull(hullVertices(local.map(p=>({x:p.x*SCALE,y:p.y*SCALE})),thickness*SCALE));if(!desc)throw Error('Could not construct a gear tooth.');return this.world.createCollider(desc.setTranslation(center.x*SCALE,center.y*SCALE,0).setDensity(material.density/SCALE**3).setFriction(material.friction).setRestitution(.015).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.01).setContactSkin(0),rb);}
 angle(g){const q=g.rb.rotation();return 2*Math.atan2(q.z,q.w);}
 step(){
  for(const g of this.gears.values()){
   g.rb.resetTorques(false);const w=g.rb.angvel().z,goal=g.config.rpm*Math.PI/30,d=dimensions(g.config.teeth,g.config.module),inertia=Math.max(1e-7,g.rb.mass()*(d.pitch*SCALE)**2*.5),drive=g.config.motor?Math.max(-g.config.torque*SCALE**2,Math.min(g.config.torque*SCALE**2,(goal-w)*inertia*45)):0,brake=0;g.torque=(drive-brake)/SCALE**2;g.rb.addTorque(V(0,0,g.torque*SCALE**2),true);g.stress=0;
  }
  this.world.gravity=V(0,this.gravity?-9.81*SCALE:0,0);this.world.step(this.queue);this.time+=DT;
  const loads=new Map();this.queue.drainContactForceEvents(event=>{for(const handle of[event.collider1(),event.collider2()]){const ref=this.colliders.get(handle);if(!ref||ref.part.type==='hub')continue;const {gear:g,part}=ref,sigma=toothStress(event.totalForceMagnitude()/SCALE,g.config.teeth,g.config.module,g.config.thickness);g.stress=Math.max(g.stress,sigma);g.peak=Math.max(g.peak,sigma);const key=g.config.id+':'+part.index,old=loads.get(key);if(!old||old.sigma<sigma)loads.set(key,{g,part,sigma});}});
  const failures=[];for(const {g,part,sigma}of loads.values()){const mat=MATERIALS[g.config.material],ratio=sigma/mat.strength;if(ratio>1&&this.breaking){g.damage[part.index]+=DT*(ratio**(mat.ductile?2:3)-1)/(mat.ductile?.08:.008);if(g.damage[part.index]>=1)failures.push({g,part,sigma});}}
  for(const f of failures){if(!f.g.parts.includes(f.part))continue;const sector=!MATERIALS[f.g.config.material].ductile&&f.sigma>MATERIALS[f.g.config.material].strength*4;this.detach(f.g,sector?f.g.parts.filter(p=>p.index===f.part.index):[f.part],sector?'rim fracture':'tooth fracture');}
  for(const f of this.fragments)f.age+=DT;
 }
 advance(seconds){this.remainder+=Math.max(0,Math.min(.1,seconds));let n=0;while(this.remainder>=DT-1e-12&&n<24){this.step();this.remainder-=DT;n++;}return n;}
 detach(g,parts,cause){
  if(!parts.length||this.fragments.length>=192)return null;const total=parts.reduce((s,p)=>s+polygonProperties(p.polygon).area,0),center=parts.reduce((s,p)=>{const v=polygonProperties(p.polygon);return V(s.x+v.x*v.area/total,s.y+v.y*v.area/total,0);},V()),q={...g.rb.rotation()},oldCom={...g.rb.worldCom()},omega={...g.rb.angvel()},velocity={...g.rb.linvel()},position=add(g.rb.translation(),rotate(q,V(center.x*SCALE,center.y*SCALE,0))),rb=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(q).setAngvel(omega).setCcdEnabled(true));
  const fragment={id:++this.serial,rb,material:g.config.material,thickness:g.config.thickness,age:0,parts:parts.map(p=>({type:p.type,index:p.index,polygon:p.polygon.map(v=>({x:v.x-center.x,y:v.y-center.y}))}))};
  for(const p of fragment.parts)this.createCollider(rb,p.polygon,g.config.thickness,MATERIALS[g.config.material]);rb.recomputeMassPropertiesFromColliders();rb.setLinvel(add(velocity,cross(omega,sub(rb.worldCom(),oldCom))),true);
  for(const p of parts){this.colliders.delete(p.collider.handle);this.world.removeCollider(p.collider,true);g.parts=g.parts.filter(v=>v!==p);g.missing.push(p.type+':'+p.index);}g.rb.recomputeMassPropertiesFromColliders();g.rb.setLinvel(add(velocity,cross(omega,sub(g.rb.worldCom(),oldCom))),true);g.revision++;this.fragments.push(fragment);this.events.push({time:this.time,gear:g.config.id,cause,parts:parts.map(p=>p.type+':'+p.index)});if(this.events.length>50)this.events.shift();return fragment;
 }
 snapshot(){return{time:this.time,gears:[...this.gears.values()].map(g=>({id:g.config.id,angle:this.angle(g),rpm:g.rb.angvel().z*30/Math.PI,stress:g.stress,peak:g.peak,torque:g.torque,mass:g.rb.mass(),missing:[...g.missing],position:{x:g.rb.translation().x/SCALE,y:g.rb.translation().y/SCALE,z:g.rb.translation().z/SCALE}})),fragments:this.fragments.length,events:structuredClone(this.events)};}
 dispose(){this.queue.free();this.world.free();}
}
