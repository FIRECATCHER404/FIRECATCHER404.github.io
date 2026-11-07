import R from './vendor/rapier.js';
import * as M from './geometry.js';
import {MATERIALS,SHAPES} from './materials.js';
import {G,C,MAX_MASS,schwarzschildRadius} from './relativity.js';
export {MATERIALS,SHAPES};
export const STEP=1/120,MAX_BODIES=256,MAX_CELLS=512;
export const ready=R.init();
const templateCache=new Map(),copy=value=>structuredClone(value);
export function template(shape,size){const key=shape+':'+size;if(!templateCache.has(key))templateCache.set(key,M.partition(shape,size));return templateCache.get(key);}
const point=value=>M.V(value.x,value.y,value.z),rotation=value=>M.Q(value.x,value.y,value.z,value.w);
const forceAt=(force,at,center)=>({force,torque:M.cross(M.sub(at,center),force)});
export function gravityForces(samples,centers,g=.18,softening=.15){
  const result=new Map([...centers.keys()].map(id=>[id,{force:M.V(),torque:M.V()}]));let potential=0;
  for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++){const a=samples[i],b=samples[j],d=M.sub(b.position,a.position),r2=M.dot(d,d)+softening*softening,coefficient=g*a.mass*b.mass/(r2*Math.sqrt(r2));potential-=g*a.mass*b.mass/Math.sqrt(r2);if(a.bodyId===b.bodyId)continue;const f=M.mul(d,coefficient),pa=forceAt(f,a.position,centers.get(a.bodyId)),pb=forceAt(M.mul(f,-1),b.position,centers.get(b.bodyId));const ra=result.get(a.bodyId),rb=result.get(b.bodyId);ra.force=M.add(ra.force,pa.force);ra.torque=M.add(ra.torque,pa.torque);rb.force=M.add(rb.force,pb.force);rb.torque=M.add(rb.torque,pb.torque);}
  return{forces:result,potential};
}
export class Simulation{
  constructor(){this.world=new R.World(M.V());this.world.timestep=STEP;this.world.numSolverIterations=8;this.world.numInternalPgsIterations=2;this.world.maxCcdSubsteps=4;this.queue=new R.EventQueue(true);this.bodies=new Map();this.colliderMap=new Map();this.nextId=1;this.origin=M.V();this.time=0;this.events=[];this.params={gravity:true,g:G,softening:.15,breaking:true,strength:1};this.grab=null;this.lastPotential=0;this.lastContacts=0;}
  get cellCount(){let count=0;for(const body of this.bodies.values())count+=body.cells.length;return count;}
  dispose(){this.queue.free();this.world.free();}
  descriptor(faces,density,material,offset=M.V()){const desc=R.ColliderDesc.convexHull(M.polyVertices(faces));if(!desc)throw new Error('Could not construct this convex shape.');return desc.setTranslation(offset.x,offset.y,offset.z).setDensity(density).setFriction(material.friction).setRestitution(material.restitution).setRestitutionCombineRule(R.CoefficientCombineRule.Max).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0).setContactSkin(0);}
  canPlace(faces,globalPosition,q=M.Q(),exclude=null){const position=M.sub(globalPosition,this.origin),radius=M.polyRadius(faces),shape=R.ColliderDesc.convexHull(M.polyVertices(faces)).shape;this.world.propagateModifiedBodyPositionsToColliders();for(const body of this.bodies.values()){if(body.id===exclude)continue;if(M.length(M.sub(point(body.rb.translation()),position))>radius+body.radius+.01)continue;for(const collider of body.colliders){const contact=collider.contactShape(shape,position,q,0);if(contact&&contact.distance<-.0001)return false;}}return true;}
  add(config={},check=true,replacing=0){
    const shape=config.shape??'box',size=config.size??1,material=config.material??'wood',density=config.mass!==undefined?config.mass/(config.cells?config.cells.reduce((sum,c)=>sum+c.volume,0):template(shape,size).cells.reduce((sum,c)=>sum+c.volume,0)):(config.density??MATERIALS[material]?.density),position=config.position??M.V(),q=config.rotation??M.Q(),velocity=config.velocity??M.V(),spin=config.spin??M.V(),pinned=!!config.pinned;
    if(![position,velocity,spin].every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite))||![q.x,q.y,q.z,q.w].every(Number.isFinite)||Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>.01)throw new Error('Enter finite positions, velocities and a valid rotation.');
    if(!Object.hasOwn(SHAPES,shape)||!Object.hasOwn(MATERIALS,material)||!Number.isFinite(size)||size<.25||size>8||!Number.isFinite(density)||density<=0||density>1e15)throw new Error('Choose valid shape, material, size, and density.');
    if(config.mass!==undefined&&(!Number.isFinite(config.mass)||config.mass<1e-6||config.mass>MAX_MASS))throw new Error('Mass must be between 0.000001 and 100000000.');
    const parts=config.cells?{outer:config.outer,cells:config.cells}:template(shape,size);if(this.bodies.size>=MAX_BODIES+(replacing?1:0)||this.cellCount+parts.cells.length>MAX_CELLS+replacing)throw new Error('Object limit reached. Remove objects to make room.');if(check&&!this.canPlace(parts.outer,position,q))throw new Error('Place the shape in free space.');
    const desc=(pinned?R.RigidBodyDesc.fixed():R.RigidBodyDesc.dynamic()).setTranslation(...Object.values(M.sub(position,this.origin))).setRotation(q).setLinvel(velocity.x,velocity.y,velocity.z).setAngvel(spin).setCcdEnabled(true).setCanSleep(false).setLinearDamping(0).setAngularDamping(0),rb=this.world.createRigidBody(desc),id=config.id??this.nextId++;
    this.nextId=Math.max(this.nextId,id+1);const cells=copy(parts.cells),record={id,name:String(config.name??'').trim().slice(0,72)||`${MATERIALS[material].name} ${SHAPES[shape]}`,shape,size,material,density,pinned,rb,cells,outer:copy(parts.outer),colliders:[],damage:config.damage??0,pressure:0,lastImpact:0,fragment:!!config.fragment,family:config.family??id,age:0,radius:M.polyRadius(parts.outer)};
    for(let i=0;i<cells.length;i++){const cell=cells[i],collider=this.world.createCollider(this.descriptor(cell.faces,density,MATERIALS[material],cell.offset),rb);record.colliders.push(collider);this.colliderMap.set(collider.handle,{record,cell,index:i});}rb.recomputeMassPropertiesFromColliders();if(!Number.isFinite(rb.mass())||rb.mass()<=0){this.world.removeRigidBody(rb);throw new Error('This shape has invalid mass.');}this.bodies.set(id,record);this.refreshCompact(record);return record;
  }
  refreshCompact(b){b.horizon=schwarzschildRadius(this.mass(b));b.compact=b.horizon>=b.radius;for(const c of b.colliders)c.setSensor(b.compact);}
  remove(id){const body=this.bodies.get(id);if(!body)return;for(const c of body.colliders)this.colliderMap.delete(c.handle);this.world.removeRigidBody(body.rb);this.bodies.delete(id);if(this.grab?.id===id)this.grab=null;}
  globalPosition(body){return M.add(point(body.rb.translation()),this.origin);}
  massSamples(){const samples=[];for(const body of this.bodies.values()){const p=point(body.rb.translation()),q=rotation(body.rb.rotation());if(body.compact){samples.push({bodyId:body.id,position:point(body.rb.worldCom()),mass:this.mass(body)});continue;}body.cells.forEach((cell,i)=>samples.push({bodyId:body.id,position:M.add(p,M.rotate(q,cell.offset)),mass:body.colliders[i].mass()}));}return samples;}
  mass(body){return body.colliders.reduce((sum,c)=>sum+c.mass(),0);}
  fracture(id,cause='manual'){
    const body=this.bodies.get(id);if(!body||body.pinned||body.compact||body.cells.length<2||MATERIALS[body.material].unbreakable)return[];
    if(this.bodies.size+body.cells.length-1>MAX_BODIES){body.damage=.99;if(!body.limitWarned){this.events.push({type:'limit',id,message:'Fragment limit reached; the object is held together.'});body.limitWarned=true;}return[];}
    const p=point(body.rb.translation()),q=rotation(body.rb.rotation()),com=point(body.rb.worldCom()),velocity=point(body.rb.linvel()),omega=point(body.rb.angvel()),parts=[];
    // No separation kicks or gaps: the exact existing colliders become the pieces.
    try{for(const cell of body.cells){const position=M.add(M.add(p,M.rotate(q,cell.offset)),this.origin),child=this.add({shape:body.shape,size:body.size,material:body.material,density:body.density,position,rotation:q,velocity,spin:omega,cells:[{...copy(cell),offset:M.V()}],outer:cell.faces,fragment:true,family:body.family,name:body.name.slice(0,63)+' fragment'},false,body.cells.length),childCom=point(child.rb.worldCom());child.rb.setLinvel(M.add(velocity,M.cross(omega,M.sub(childCom,com))),true);child.rb.setAngvel(omega,true);parts.push(child.id);}}catch(error){for(const child of parts)this.remove(child);throw error;}
    this.remove(id);this.events.push({type:'fracture',id,parts,cause,time:this.time});return parts;
  }
  update(id,values){
    const b=this.bodies.get(id);if(!b)throw new Error('Select an object.');
    const position=values.position??this.globalPosition(b),q=values.rotation??rotation(b.rb.rotation()),velocity=values.velocity??point(b.rb.linvel()),spin=values.spin??point(b.rb.angvel()),material=values.material??b.material,density=values.mass!==undefined?values.mass/b.cells.reduce((n,c)=>n+c.volume,0):(values.density??b.density),name=values.name??b.name;
    if(!Object.hasOwn(MATERIALS,material)||!Number.isFinite(density)||density<=0||density>1e15||typeof name!=='string'||!name.trim()||name.length>72||![position,velocity,spin].every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite))||![q.x,q.y,q.z,q.w].every(Number.isFinite)||Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>.01)throw new Error('Enter valid object properties.');
    if(values.mass!==undefined&&(values.mass<1e-6||values.mass>MAX_MASS))throw new Error('Mass is outside the supported range.');
    if(!this.canPlace(b.outer,position,q,id))throw new Error('Move the object into free space.');
    b.rb.setTranslation(M.sub(position,this.origin),true);b.rb.setRotation(q,true);b.material=material;b.density=density;b.name=name.trim();if(values.pinned!==undefined){b.pinned=values.pinned;b.rb.setBodyType(b.pinned?R.RigidBodyType.Fixed:R.RigidBodyType.Dynamic,true);}const m=MATERIALS[material];for(const c of b.colliders){c.setDensity(density);c.setFriction(m.friction);c.setRestitution(m.restitution);}b.rb.recomputeMassPropertiesFromColliders();b.rb.setLinvel(b.pinned?M.V():velocity,true);b.rb.setAngvel(b.pinned?M.V():spin,true);this.refreshCompact(b);this.world.propagateModifiedBodyPositionsToColliders();
  }
  rebase(shift){if(M.length(shift)<1)return;for(const b of this.bodies.values())b.rb.setTranslation(M.sub(point(b.rb.translation()),shift),false);this.origin=M.add(this.origin,shift);if(this.grab)this.grab.target=M.sub(this.grab.target,shift);this.world.propagateModifiedBodyPositionsToColliders();}
  setGrab(id,localAnchor,target){this.grab={id,localAnchor:point(localAnchor),target:M.sub(target,this.origin)};}
  step(maxDt=STEP){
    // Resolve the shortest local gravitational time scale; extreme masses slow
    // simulation time instead of integrating a giant unstable fixed step.
    let dt=maxDt;const list=[...this.bodies.values()];
    if(this.params.gravity)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j],r=Math.max(.05,M.length(M.sub(point(a.rb.translation()),point(b.rb.translation()))));dt=Math.min(dt,.04*Math.sqrt(r*r*r/(G*(this.mass(a)+this.mass(b)))));}
    this.world.timestep=dt;this.lastDt=dt;
    const before=new Map();for(const b of this.bodies.values()){b.rb.resetForces(false);b.rb.resetTorques(false);before.set(b.id,{velocity:point(b.rb.linvel()),spin:point(b.rb.angvel()),com:point(b.rb.worldCom())});b.age+=dt;}
    const samples=this.massSamples(),centers=new Map([...this.bodies.values()].map(b=>[b.id,point(b.rb.worldCom())]));if(this.params.gravity){const field=gravityForces(samples,centers,this.params.g,this.params.softening);this.lastPotential=field.potential;for(const [id,f]of field.forces){const b=this.bodies.get(id);if(!b.pinned){b.rb.addForce(f.force,true);b.rb.addTorque(f.torque,true);}}}else this.lastPotential=0;
    if(this.grab){const b=this.bodies.get(this.grab.id);if(b&&!b.pinned){const at=M.add(point(b.rb.translation()),M.rotate(rotation(b.rb.rotation()),this.grab.localAnchor)),v=point(b.rb.velocityAtPoint(at)),mass=this.mass(b);let f=M.mul(M.sub(M.mul(M.sub(this.grab.target,at),65),M.mul(v,14)),mass);if(M.length(f)>mass*800)f=M.mul(M.unit(f),mass*800);b.rb.addForceAtPoint(f,at,true);}}
    this.world.step(this.queue);this.time+=dt;const loads=new Map(),impact=new Map();this.lastContacts=0;
    const load=(id,other,force)=>{if(!loads.has(id))loads.set(id,new Map());const map=loads.get(id);map.set(other,M.add(map.get(other)??M.V(),force));};
    this.queue.drainContactForceEvents(event=>{
      const a=this.colliderMap.get(event.collider1()),b=this.colliderMap.get(event.collider2());if(!a||!b||a.record.id===b.record.id)return;const f=event.totalForceMagnitude();if(!Number.isFinite(f)||f<=0)return;this.lastContacts++;
      let normal=M.unit(point(event.maxForceDirection()));const ca=M.add(point(a.record.rb.translation()),M.rotate(rotation(a.record.rb.rotation()),a.cell.offset)),cb=M.add(point(b.record.rb.translation()),M.rotate(rotation(b.record.rb.rotation()),b.cell.offset));if(M.dot(normal,M.sub(cb,ca))<0)normal=M.mul(normal,-1);load(a.record.id,b.record.id,M.mul(normal,-f));load(b.record.id,a.record.id,M.mul(normal,f));
      const contact=M.mul(M.add(ca,cb),.5),pa=before.get(a.record.id),pb=before.get(b.record.id),va=M.add(pa.velocity,M.cross(pa.spin,M.sub(contact,pa.com))),vb=M.add(pb.velocity,M.cross(pb.spin,M.sub(contact,pb.com))),speed=Math.max(0,M.dot(M.sub(va,vb),normal));if(speed<3.5)return;
      const ma=this.mass(a.record),mb=this.mass(b.record),reduced=a.record.pinned?mb:b.record.pinned?ma:ma*mb/(ma+mb),area=Math.max(.02,Math.min(a.record.radius,b.record.radius)**2),energy=.5*reduced*speed*speed/area;
      for(const info of [a,b]){const value=energy/(MATERIALS[info.record.material].impact*this.params.strength);impact.set(info.record.id,Math.max(impact.get(info.record.id)??0,value));}
    });
    const breaking=[];for(const b of this.bodies.values()){
      const vectors=[...(loads.get(b.id)?.values()??[])];let balanced=0;for(let i=0;i<vectors.length;i++)for(let j=i+1;j<vectors.length;j++)if(M.dot(M.unit(vectors[i]),M.unit(vectors[j]))<-.6)balanced=Math.max(balanced,Math.min(M.length(vectors[i]),M.length(vectors[j])));
      const area=Math.max(.02,b.radius*b.radius),pressure=balanced/area;b.pressure+=(pressure-b.pressure)*(1-Math.exp(-dt/.025));b.lastImpact=impact.get(b.id)??0;
      if(this.params.breaking&&!b.pinned&&!b.compact&&b.cells.length>1&&!MATERIALS[b.material].unbreakable){const material=MATERIALS[b.material],compression=Math.max(0,b.pressure/(material.crush*this.params.strength)-1)*dt*3;b.damage=Math.min(1,b.damage+(impact.get(b.id)??0)+compression);if(b.damage>=1)breaking.push([b.id,compression>0?'compression':'impact']);}
      const position=b.rb.translation(),velocity=b.rb.linvel(),spin=b.rb.angvel();if(![position.x,position.y,position.z,velocity.x,velocity.y,velocity.z,spin.x,spin.y,spin.z].every(Number.isFinite)||M.length(velocity)>5000||M.length(spin)>5000)throw new Error('Numerical speed limit reached. Lower mass or velocity, or undo the last edit.');
    }
    this.absorb();for(const [id,cause]of breaking)this.fracture(id,cause);if(this.events.length>50)this.events.splice(0,this.events.length-50);
  }
  absorb(){
    // A finite-size object is captured when its centre crosses the horizon.
    // This sink approximation conserves rest mass and linear momentum, not GR energy.
    for(const hole of [...this.bodies.values()].filter(b=>b.compact).sort((a,b)=>this.mass(b)-this.mass(a))){
      if(!this.bodies.has(hole.id))continue;
      for(const other of [...this.bodies.values()]){
        if(other.id===hole.id||other.pinned||!this.bodies.has(other.id))continue;
        if(other.compact&&this.mass(other)>this.mass(hole))continue;
        const p=point(hole.rb.translation()),op=point(other.rb.translation());
        if(M.length(M.sub(op,p))>=hole.horizon)continue;
        const m=this.mass(hole),n=this.mass(other),v=M.mul(M.add(M.mul(point(hole.rb.linvel()),m),M.mul(point(other.rb.linvel()),n)),1/(m+n));
        hole.density*=(m+n)/m;for(const c of hole.colliders)c.setDensity(hole.density);hole.rb.recomputeMassPropertiesFromColliders();if(!hole.pinned)hole.rb.setLinvel(v,true);this.remove(other.id);this.refreshCompact(hole);this.events.push({type:'capture',id:hole.id,other:other.id,mass:n,time:this.time});
      }
    }
  }
  invariants(){let mass=0,center=M.V(),momentum=M.V(),angular=M.V(),kinetic=0;for(const b of this.bodies.values()){const m=this.mass(b),com=M.add(point(b.rb.worldCom()),this.origin),v=b.pinned?M.V():point(b.rb.linvel()),omega=b.pinned?M.V():point(b.rb.angvel()),q=M.multiplyQ(rotation(b.rb.rotation()),rotation(b.rb.principalInertiaLocalFrame())),local=M.rotate(M.inverseQ(q),omega),inertia=b.rb.principalInertia(),spinMomentum=M.rotate(q,M.V(inertia.x*local.x,inertia.y*local.y,inertia.z*local.z));mass+=m;center=M.add(center,M.mul(com,m));momentum=M.add(momentum,M.mul(v,m));angular=M.add(angular,M.add(M.cross(com,M.mul(v,m)),spinMomentum));kinetic+=.5*m*M.dot(v,v)+.5*M.dot(omega,spinMomentum);}return{mass,center:mass?M.mul(center,1/mass):M.V(),momentum,angular,kinetic,potential:this.lastPotential};}
  toJSON(){return{origin:point(this.origin),time:this.time,nextId:this.nextId,params:{...this.params},bodies:[...this.bodies.values()].map(b=>({id:b.id,name:b.name,shape:b.shape,size:b.size,material:b.material,density:b.density,pinned:b.pinned,position:this.globalPosition(b),rotation:rotation(b.rb.rotation()),velocity:point(b.rb.linvel()),spin:point(b.rb.angvel()),cells:copy(b.cells),outer:copy(b.outer),damage:b.damage,fragment:b.fragment,family:b.family}))};}
  snapshot(){return{engine:'Rapier 0.21.0',time:this.time,origin:point(this.origin),params:{...this.params},count:this.bodies.size,cells:this.cellCount,contacts:this.lastContacts,events:copy(this.events),invariants:this.invariants(),bodies:[...this.bodies.values()].map(b=>({id:b.id,name:b.name,shape:b.shape,material:b.material,pinned:b.pinned,mass:this.mass(b),density:b.density,position:this.globalPosition(b),velocity:point(b.rb.linvel()),spin:point(b.rb.angvel()),rotation:rotation(b.rb.rotation()),pieces:b.cells.length,damage:b.damage,pressure:b.pressure,fragment:b.fragment,horizon:b.horizon,compact:b.compact}))};}
}
export function checkedScene(value){
  const finite=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=max,vector=(p,max)=>{if(!p||![p.x,p.y,p.z].every(v=>finite(v,max)))throw new Error('Invalid position or velocity.');return M.V(p.x,p.y,p.z);},budget={count:0};
  if(!value||!Array.isArray(value.bodies)||value.bodies.length>MAX_BODIES||!finite(value.time,1e12)||value.time<0)throw new Error('Invalid Void Lab scene.');const origin=vector(value.origin,1e12),ids=new Set();let cells=0;
  const bodies=value.bodies.map(b=>{if(!Number.isInteger(b.id)||b.id<1||b.id>1e9||ids.has(b.id)||!Object.hasOwn(MATERIALS,b.material)||!Object.hasOwn(SHAPES,b.shape)||!finite(b.size,8)||b.size<.25||!finite(b.density,1e15)||b.density<=0||typeof b.pinned!=='boolean'||typeof b.fragment!=='boolean'||!finite(b.damage,1)||b.damage<0||typeof b.name!=='string'||!b.name.trim()||b.name.length>72||!Array.isArray(b.cells)||b.cells.length<1||b.cells.length>8)throw new Error('Invalid object data.');ids.add(b.id);cells+=b.cells.length;const q=b.rotation;if(!q||![q.x,q.y,q.z,q.w].every(v=>finite(v,1.001))||Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>.01)throw new Error('Invalid object rotation.');const fragments=b.cells.map((c,i)=>{const faces=M.checkedPoly(c.faces,budget),properties=M.volumeProperties(faces);return{id:i,faces,offset:vector(c.offset,32),volume:properties.volume};});return{id:b.id,name:b.name,shape:b.shape,size:b.size,material:b.material,density:b.density,pinned:b.pinned,fragment:b.fragment,damage:b.damage,family:Number.isInteger(b.family)&&b.family>0?b.family:b.id,position:vector(b.position,1e12),velocity:vector(b.velocity,1e6),spin:vector(b.spin,1e6),rotation:M.normalizeQ(q),cells:fragments,outer:M.checkedPoly(b.outer,budget)};});
  const p=value.params;if(cells>MAX_CELLS||!p||typeof p.gravity!=='boolean'||typeof p.breaking!=='boolean'||!finite(p.g,5)||p.g!==G||!finite(p.softening,2)||p.softening<.05||!finite(p.strength,100)||p.strength<.1)throw new Error('Invalid simulation settings.');return{origin,time:value.time,nextId:Math.max(1,...bodies.map(b=>b.id+1)),params:{gravity:p.gravity,breaking:p.breaking,g:p.g,softening:p.softening,strength:p.strength},bodies};
}
export function restoreScene(value){const checked=checkedScene(value),s=new Simulation();try{s.origin=checked.origin;s.time=checked.time;s.params=checked.params;for(const body of checked.bodies)s.add(body,false);s.nextId=checked.nextId;return s;}catch(error){s.dispose();throw error;}}
export function preset(name){const s=new Simulation();s.params.gravity=name==='empty';if(name==='impact'){s.add({shape:'box',size:1.3,material:'glass',position:M.V(2,0,0)});s.add({shape:'sphere',size:.7,material:'steel',position:M.V(-9,.25,.15),velocity:M.V(20,0,0)});}
  else if(name==='crush'){s.add({shape:'box',size:1,material:'glass',position:M.V()});for(const sign of [-1,1])s.add({shape:'box',size:1.3,material:'steel',density:150,position:M.V(sign*3.6,0,0),velocity:M.V(-sign*2,0,0)});}
  else if(name==='orbit'){s.params.gravity=true;s.params.g=G;s.params.breaking=false;s.add({shape:'sphere',size:2,material:'steel',position:M.V()});s.add({shape:'sphere',size:.55,material:'stone',position:M.V(8,0,0),velocity:M.V(0,0,Math.sqrt(G*s.mass([...s.bodies.values()][0])/8))});}
  else if(name==='materials'){for(const [i,material]of Object.keys(MATERIALS).entries())s.add({shape:i%2?'sphere':'box',material,size:.75,position:M.V((i-2.5)*3,0,0)});}
  else if(name!=='empty'){s.dispose();throw new Error('Unknown starting scene.');}return s;}
