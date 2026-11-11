import R from'../void-lab/vendor/rapier.js';
import{MATERIALS,dimensions,gearParts,hullVertices,polygonProperties,toothStress,checkedScene,connections}from'./geometry.js?v=4';
import{V,Q,rotate,inverse,multiply,add,sub,mul,cross,dot,wrap,normal,mountRotation,gearPoint,wallSize,FLOOR_Y,FLOOR_SIZE}from'./space.js?v=4';
export const ready=R.init(),DT=1/240,SCALE=100;

export class GearSimulation{
 constructor(scene){
  this.design=checkedScene(scene);
  this.world=new R.World(V(0,-9.81*SCALE,0));
  this.world.timestep=DT;this.world.numSolverIterations=16;this.world.numInternalPgsIterations=2;this.world.maxCcdSubsteps=6;
  this.world.integrationParameters.normalizedAllowedLinearError=.00001;this.world.integrationParameters.normalizedPredictionDistance=.0001;
  this.queue=new R.EventQueue(true);this.pegs=new Map();this.gears=new Map();this.fragments=[];this.colliders=new Map();
  this.events=[];this.time=0;this.remainder=0;this.breaking=true;this.gravity=true;this.serial=0;this.crank=null;
  const floor=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,(FLOOR_Y-.04)*SCALE,0));
  this.floor=this.world.createCollider(R.ColliderDesc.cuboid(FLOOR_SIZE/2*SCALE,.04*SCALE,FLOOR_SIZE/2*SCALE).setFriction(.6).setRestitution(.02),floor);
  this.wallBodies=new Map();
  for(const w of this.design.walls){const size=wallSize(w),rb=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(w.x*SCALE,w.y*SCALE,w.z*SCALE));this.world.createCollider(R.ColliderDesc.cuboid(size.x/2*SCALE,size.y/2*SCALE,size.z/2*SCALE).setFriction(.5),rb);this.wallBodies.set(w.id,rb);}
  for(const p of this.design.pegs)this.pegs.set(p.id,this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x*SCALE,p.y*SCALE,p.z*SCALE).setRotation(mountRotation(p))));
  for(const config of this.design.gears)this.addGear(config);
  const linked=new Set();
  for(const c of connections(this.design)){
   const a=this.gears.get(c.a),b=this.gears.get(c.b),key=[c.a,c.b].sort().join(':');if(linked.has(key))continue;linked.add(key);
   if(c.kind==='fuse'){
    const dz=(b.config.layer-a.config.layer)*.05*SCALE,da=b.config.angle-a.config.angle;
    const joint=this.world.createImpulseJoint(R.JointData.fixed(V(0,0,dz),Q(da),V(),Q(0)),a.rb,b.rb,true);joint.setContactsEnabled(false);
   }else{
    // Only relative twist is locked. Bearing constraints keep each centre on its own peg.
    // Joint X is the shaft's local Z. Cancel starting angles to preserve their phase offset.
    const joint=this.world.createImpulseJoint(R.JointData.generic(V(),V(),V(0,0,1),R.JointAxesMask.AngX),a.rb,b.rb,true),xToZ={x:0,y:-Math.SQRT1_2,z:0,w:Math.SQRT1_2};
    joint.setLocalFrame1(V(),multiply(Q(-a.config.angle),xToZ));joint.setLocalFrame2(V(),multiply(Q(-b.config.angle),xToZ));
   }
  }
 }
 addGear(config){
  const peg=this.design.pegs.find(p=>p.id===config.peg),frame=mountRotation(peg),pos=gearPoint(peg,config),ideal=config.kind==='motor'&&config.drive==='ideal';
  const desc=(ideal?R.RigidBodyDesc.kinematicVelocityBased():R.RigidBodyDesc.dynamic()).setTranslation(pos.x*SCALE,pos.y*SCALE,pos.z*SCALE).setRotation(multiply(frame,Q(config.angle))).setCcdEnabled(true).setCanSleep(false).setAngularDamping(.015);
  const rb=this.world.createRigidBody(desc),g={config:structuredClone(config),rb,axis:normal(peg),frame,ideal,parts:[],extras:[],missing:[],stress:0,peak:0,torque:0,damage:Array(config.teeth).fill(0),revision:0,angleState:config.angle,lastWrapped:wrap(config.angle)};
  for(const part of gearParts(config.teeth,config.module)){const p={...part,collider:this.createCollider(rb,part.polygon,config.thickness,MATERIALS[config.material])};g.parts.push(p);this.colliders.set(p.collider.handle,{gear:g,part:p});}
  if(!ideal){
   const joint=this.world.createImpulseJoint(R.JointData.revolute(V(0,0,(.06+config.layer*.05)*SCALE),V(),V(0,0,1)),this.pegs.get(config.peg),rb,true);joint.setContactsEnabled(false);
   if(config.brake>0){joint.configureMotorModel(R.MotorModel.ForceBased);joint.configureMotorVelocity(0,1e6);joint.setMotorMaxForce(config.brake*SCALE**2);}g.joint=joint;
  }
  if(config.kind==='motor'){
   const r=dimensions(config.teeth,config.module).pitch*.92,base=this.pegs.get(config.peg),offset=.06+config.layer*.05;
   this.world.createCollider(R.ColliderDesc.cuboid(r*SCALE,r*SCALE,.017*SCALE).setTranslation(0,0,(offset-config.thickness/2-.02)*SCALE).setFriction(.4),base);
  }
  if(config.crank){
   const radius=dimensions(config.teeth,config.module).outer*.72,z=config.thickness/2;
   g.extras.push(this.world.createCollider(R.ColliderDesc.cuboid(radius/2*SCALE,.006*SCALE,.006*SCALE).setTranslation(radius/2*SCALE,0,(z+.014)*SCALE).setDensity(2700/SCALE**3),rb));
   g.extras.push(this.world.createCollider(R.ColliderDesc.cylinder(.018*SCALE,.009*SCALE).setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}).setTranslation(radius*SCALE,0,(z+.038)*SCALE).setDensity(900/SCALE**3),rb));
  }
  this.gears.set(config.id,g);return g;
 }
 createCollider(rb,polygon,thickness,material){
  const center=polygonProperties(polygon),local=polygon.map(p=>({x:p.x-center.x,y:p.y-center.y})),desc=R.ColliderDesc.convexHull(hullVertices(local.map(p=>({x:p.x*SCALE,y:p.y*SCALE})),thickness*SCALE));
  if(!desc)throw Error('Could not construct a gear tooth.');
  return this.world.createCollider(desc.setTranslation(center.x*SCALE,center.y*SCALE,0).setDensity(material.density/SCALE**3).setFriction(material.friction).setRestitution(.015).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.01).setContactSkin(0),rb);
 }
 angle(g){return g.angleState;}
 speed(g){return dot(g.rb.angvel(),g.axis);}
 mass(g){return g.parts.reduce((s,p)=>s+p.collider.mass(),0)+g.extras.reduce((s,c)=>s+c.mass(),0);}
 latchCrank(id){const g=this.gears.get(id);if(!g?.config.crank||g.ideal)throw Error('Place a hand crank on an ordinary gear first.');this.crank={id,target:this.angle(g)};return this.crank;}
 setCrankTarget(angle){if(this.crank&&Number.isFinite(angle))this.crank.target=angle;}
 releaseCrank(){this.crank=null;}
 step(){
  for(const g of this.gears.values()){
   g.stress=0;g.rb.resetTorques(false);const w=this.speed(g),goal=g.config.rpm*Math.PI/30;
   if(g.ideal){g.rb.setLinvel(V(),false);g.rb.setAngvel(mul(g.axis,goal),true);g.torque=0;continue;}
   const d=dimensions(g.config.teeth,g.config.module),inertia=Math.max(1e-7,g.rb.mass()*(d.pitch*SCALE)**2*.5);
   let drive=g.config.motor?Math.max(-g.config.torque*SCALE**2,Math.min(g.config.torque*SCALE**2,(goal-w)*inertia*45)):0;
   if(this.crank?.id===g.config.id){const err=this.crank.target-this.angle(g),limit=g.config.handTorque*SCALE**2;drive+=Math.max(-limit,Math.min(limit,(err*400-w*40)*inertia));}
   g.torque=drive/SCALE**2;g.rb.addTorque(mul(g.axis,drive),true);
  }
  this.world.gravity=V(0,this.gravity?-9.81*SCALE:0,0);this.world.step(this.queue);this.time+=DT;
  for(const g of this.gears.values()){const local=multiply(inverse(g.frame),g.rb.rotation()),a=wrap(2*Math.atan2(local.z,local.w));g.angleState+=wrap(a-g.lastWrapped);g.lastWrapped=a;}
  const loads=new Map();
  this.queue.drainContactForceEvents(event=>{for(const handle of[event.collider1(),event.collider2()]){
   const ref=this.colliders.get(handle);if(!ref||ref.part.type==='hub')continue;const{gear:g,part}=ref,sigma=toothStress(event.totalForceMagnitude()/SCALE,g.config.teeth,g.config.module,g.config.thickness);
   g.stress=Math.max(g.stress,sigma);g.peak=Math.max(g.peak,sigma);const key=g.config.id+':'+part.index,old=loads.get(key);if(!old||old.sigma<sigma)loads.set(key,{g,part,sigma});
  }});
  const failures=[];
  for(const{g,part,sigma}of loads.values()){const mat=MATERIALS[g.config.material],ratio=sigma/mat.strength;if(ratio>1&&this.breaking){g.damage[part.index]+=DT*(ratio**(mat.ductile?2:3)-1)/(mat.ductile?.08:.008);if(g.damage[part.index]>=1)failures.push({g,part,sigma});}}
  for(const f of failures){if(!f.g.parts.includes(f.part))continue;const sector=!MATERIALS[f.g.config.material].ductile&&f.sigma>MATERIALS[f.g.config.material].strength*4;this.detach(f.g,sector?f.g.parts.filter(p=>p.index===f.part.index):[f.part],sector?'rim fracture':'tooth fracture');}
  for(const f of this.fragments)f.age+=DT;
 }
 advance(seconds){this.remainder+=Math.max(0,Math.min(.1,seconds));let n=0;while(this.remainder>=DT-1e-12&&n<24){this.step();this.remainder-=DT;n++;}return n;}
 detach(g,parts,cause){
  if(!parts.length||this.fragments.length>=192)return null;
  const total=parts.reduce((s,p)=>s+polygonProperties(p.polygon).area,0),center=parts.reduce((s,p)=>{const v=polygonProperties(p.polygon);return V(s.x+v.x*v.area/total,s.y+v.y*v.area/total,0);},V()),q={...g.rb.rotation()},oldCom={...g.rb.worldCom()},omega={...g.rb.angvel()},velocity={...g.rb.linvel()},position=add(g.rb.translation(),rotate(q,V(center.x*SCALE,center.y*SCALE,0))),rb=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(q).setAngvel(omega).setCcdEnabled(true));
  const fragment={id:++this.serial,rb,material:g.config.material,thickness:g.config.thickness,age:0,parts:parts.map(p=>({type:p.type,index:p.index,polygon:p.polygon.map(v=>({x:v.x-center.x,y:v.y-center.y}))}))};
  for(const p of fragment.parts)this.createCollider(rb,p.polygon,g.config.thickness,MATERIALS[g.config.material]);rb.recomputeMassPropertiesFromColliders();rb.setLinvel(add(velocity,cross(omega,sub(rb.worldCom(),oldCom))),true);
  for(const p of parts){this.colliders.delete(p.collider.handle);this.world.removeCollider(p.collider,true);g.parts=g.parts.filter(v=>v!==p);g.missing.push(p.type+':'+p.index);}
  g.rb.recomputeMassPropertiesFromColliders();if(!g.ideal)g.rb.setLinvel(add(velocity,cross(omega,sub(g.rb.worldCom(),oldCom))),true);
  g.revision++;this.fragments.push(fragment);this.events.push({time:this.time,gear:g.config.id,cause,parts:parts.map(p=>p.type+':'+p.index)});if(this.events.length>50)this.events.shift();return fragment;
 }
 snapshot(){return{time:this.time,crank:this.crank?{...this.crank}:null,gears:[...this.gears.values()].map(g=>({id:g.config.id,angle:this.angle(g),rpm:this.speed(g)*30/Math.PI,stress:g.stress,peak:g.peak,torque:g.torque,mass:this.mass(g),missing:[...g.missing],position:mul(g.rb.translation(),1/SCALE),axis:{...g.axis}})),fragments:this.fragments.length,fragmentPositions:this.fragments.map(f=>mul(f.rb.translation(),1/SCALE)),events:structuredClone(this.events)};}
 dispose(){this.queue.free();this.world.free();}
}
