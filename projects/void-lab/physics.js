import R from './vendor/rapier.js';
import * as M from './geometry.js?v=2';
import {MATERIALS,SHAPES} from './materials.js?v=2';
import {G,MAX_MASS,schwarzschildRadius} from './relativity.js?v=2';
import {fractureGeometry} from './fracture.js?v=2';
import {massProperties} from './mass.js?v=2';
export {MATERIALS,SHAPES};
export const STEP=1/120,MAX_BODIES=256,MAX_CELLS=512;
export const ready=R.init();
const copy=structuredClone,point=p=>M.V(p.x,p.y,p.z),rotation=q=>M.Q(q.x,q.y,q.z,q.w),cache=new Map();
export function template(shape,size){
  const key=shape+':'+size;
  if(!cache.has(key)){const outer=M.shapePoly(shape,size),v=M.volumeProperties(outer).volume;cache.set(key,{outer,cells:[{id:0,volume:v,offset:M.V(),faces:outer}]});}
  return cache.get(key);
}
export function gravityForces(samples,centers,g=G){
  const forces=new Map(samples.map(s=>[s.bodyId,{force:M.V(),torque:M.V()}]));let potential=0;
  for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++){
    const a=samples[i],b=samples[j];if(a.bodyId===b.bodyId)continue;
    const d=M.sub(b.position,a.position),distance=M.length(d),radius=Math.max(a.fieldRadius||0,b.fieldRadius||0,1e-6),r=Math.max(distance,radius),f=M.mul(d,g*a.mass*b.mass/(r*r*r));
    forces.get(a.bodyId).force=M.add(forces.get(a.bodyId).force,f);forces.get(b.bodyId).force=M.sub(forces.get(b.bodyId).force,f);
    potential-=distance>=radius?g*a.mass*b.mass/r:g*a.mass*b.mass*(3-distance*distance/(radius*radius))/(2*radius);
  }
  return{forces,potential};
}
function inertiaFrame(b){return M.multiplyQ(rotation(b.rb.rotation()),b.massProps.frame);}
function inverseInertia(b,vector){const q=inertiaFrame(b),v=M.rotate(M.inverseQ(q),vector),I=b.massProps.principal;return M.rotate(q,M.V(I.x>1e-12?v.x/I.x:0,I.y>1e-12?v.y/I.y:0,I.z>1e-12?v.z/I.z:0));}
function spinMomentum(b,omega){const q=inertiaFrame(b),v=M.rotate(M.inverseQ(q),omega),I=b.massProps.principal;return M.rotate(q,M.V(I.x*v.x,I.y*v.y,I.z*v.z));}
export class Simulation{
  constructor(){
    this.world=new R.World(M.V());this.world.timestep=STEP;this.world.numSolverIterations=12;this.world.numInternalPgsIterations=2;this.world.maxCcdSubsteps=4;
    this.queue=new R.EventQueue(true);this.bodies=new Map();this.colliderMap=new Map();this.nextId=1;this.origin=M.V();this.time=0;this.events=[];
    this.params={gravity:true,g:G,breaking:true,strength:1};this.grab=null;this.lastPotential=0;this.lastContacts=0;this.lastDt=STEP;
  }
  get cellCount(){return this.bodies.size;}
  dispose(){this.queue.free();this.world.free();}
  descriptor(faces,density,material,roundRadius=0){const desc=roundRadius?R.ColliderDesc.ball(roundRadius):R.ColliderDesc.convexHull(M.polyVertices(faces));if(!desc)throw Error('Could not construct the shape.');const p=massProperties(faces,density);return desc.setMassProperties(p.mass,p.center,p.principal,p.frame).setFriction(material.friction).setRestitution(material.restitution).setRestitutionCombineRule(R.CoefficientCombineRule.Max).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0);}
  canPlace(faces,globalPosition,q=M.Q(),exclude=null,roundRadius=0){
    const position=M.sub(globalPosition,this.origin),radius=M.polyRadius(faces),shape=(roundRadius?R.ColliderDesc.ball(roundRadius):R.ColliderDesc.convexHull(M.polyVertices(faces))).shape;
    this.world.propagateModifiedBodyPositionsToColliders();
    for(const b of this.bodies.values()){if(b.id===exclude||b.compact||M.length(M.sub(b.rb.translation(),position))>radius+b.radius+.01)continue;const contact=b.colliders[0].contactShape(shape,position,q,0);if(contact&&contact.distance<-.0001)return false;}
    return true;
  }
  add(config={},check=true,replacing=0){
    const shape=config.shape??'box',size=config.size??1,material=config.material??'wood';
    if(!Object.hasOwn(SHAPES,shape)||!Object.hasOwn(MATERIALS,material)||!Number.isFinite(size)||size<.25||size>8)throw Error('Choose a valid shape, material and size.');
    const outer=config.outer??template(shape,size).outer,volume=M.volumeProperties(outer).volume,density=config.mass!==undefined?config.mass/volume:(config.density??MATERIALS[material].density);
    const position=config.position??M.V(),q=config.rotation??M.Q(),velocity=config.velocity??M.V(),spin=config.spin??M.V(),pinned=!!config.pinned;
    if(![position,velocity,spin].every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite))||![q.x,q.y,q.z,q.w].every(Number.isFinite)||Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>.01||!Number.isFinite(density)||density<=0||density>1e15)throw Error('Enter valid object properties.');
    if(config.mass!==undefined&&(!Number.isFinite(config.mass)||config.mass<1e-6||config.mass>MAX_MASS))throw Error('Mass must be between 0.000001 and 100000000.');
    if(this.bodies.size>=MAX_BODIES+(replacing?1:0))throw Error('Object limit reached. Delete objects to make room.');
    if(check&&!this.canPlace(outer,position,q,null,shape==='sphere'&&!config.fragment?size:0))throw Error('Place the object in free space.');
    const p=M.sub(position,this.origin),desc=(pinned?R.RigidBodyDesc.fixed():R.RigidBodyDesc.dynamic()).setTranslation(p.x,p.y,p.z).setRotation(q).setLinvel(velocity.x,velocity.y,velocity.z).setAngvel(spin).setCcdEnabled(true).setCanSleep(false),rb=this.world.createRigidBody(desc),id=config.id??this.nextId++;
    this.nextId=Math.max(this.nextId,id+1);let collider;
    try{collider=this.world.createCollider(this.descriptor(outer,density,MATERIALS[material],shape==='sphere'&&!config.fragment?size:0),rb);rb.recomputeMassPropertiesFromColliders();if(!Number.isFinite(collider.mass())||collider.mass()<=0)throw Error('Invalid object mass.');}catch(error){this.world.removeRigidBody(rb);throw error;}
    const b={id,name:String(config.name??'').trim().slice(0,72)||`${MATERIALS[material].name} ${SHAPES[shape]}`,shape,size,material,density,pinned,rb,outer:copy(outer),volume,massProps:massProperties(outer,density),cells:[{id:0,volume,offset:M.V(),faces:copy(outer)}],colliders:[collider],damage:config.damage??0,fractureEnergy:config.fractureEnergy??0,compressionPeak:0,pressure:0,lastImpact:0,fragment:!!config.fragment,generation:config.generation??0,family:config.family??id,age:0,radius:M.polyRadius(outer)};
    this.bodies.set(id,b);this.colliderMap.set(collider.handle,b);this.refreshCompact(b);return b;
  }
  mass(b){return b.colliders[0].mass();}
  refreshCompact(b){b.horizon=schwarzschildRadius(this.mass(b));b.compact=b.horizon>=b.radius;b.colliders[0].setSensor(b.compact);}
  globalPosition(b){return M.add(b.rb.translation(),this.origin);}
  massSamples(){return[...this.bodies.values()].map(b=>({bodyId:b.id,position:point(b.rb.worldCom()),mass:this.mass(b),fieldRadius:b.compact?0:Math.cbrt(3*b.volume/(4*Math.PI))}));}
  remove(id){const b=this.bodies.get(id);if(!b)return;this.colliderMap.delete(b.colliders[0].handle);this.world.removeRigidBody(b.rb);this.bodies.delete(id);if(this.grab?.id===id)this.grab=null;}
  fracture(id,cause='manual',hit={}){
    const b=this.bodies.get(id);if(!b||b.pinned||b.compact||b.generation>=3||MATERIALS[b.material].unbreakable)return[];
    const q=rotation(b.rb.rotation()),origin=point(b.rb.translation()),com=point(b.rb.worldCom()),v=point(b.rb.linvel()),omega=point(b.rb.angvel()),energy=hit.energy??b.fractureEnergy;
    const pointLocal=hit.point?M.rotate(M.inverseQ(q),M.sub(hit.point,origin)):M.V(b.radius,0,0),normalLocal=hit.normal?M.rotate(M.inverseQ(q),hit.normal):M.V(1,0,0);
    const split=fractureGeometry(b.outer,{point:pointLocal,normal:normalLocal,energy,toughness:MATERIALS[b.material].toughness*this.params.strength,material:b.material,seed:b.id*19391+Math.round((pointLocal.x+pointLocal.y*3+pointLocal.z*7)*1000),manual:cause==='manual'});
    if(!split)return[];
    if(this.bodies.size+split.cells.length-1>MAX_BODIES){b.damage=.99;if(!b.limitWarned){this.events.push({type:'limit',id,message:'Not enough room for the fragments.'});b.limitWarned=true;}return[];}
    const ids=[];
    try{for(const cell of split.cells){const pos=M.add(M.add(origin,M.rotate(q,cell.offset)),this.origin),child=this.add({shape:b.shape,size:b.size,material:b.material,density:b.density,position:pos,rotation:q,velocity:v,spin:omega,outer:cell.faces,fragment:true,generation:b.generation+1,family:b.family,name:b.name.replace(/ fragment$/,'').slice(0,63)+' fragment'},false,split.cells.length);child.rb.setLinvel(M.add(v,M.cross(omega,M.sub(child.rb.worldCom(),com))),true);ids.push(child.id);}}
    catch(error){for(const child of ids)this.remove(child);throw error;}
    // A contact-pressure gradient can disperse shards using some of the collision
    // energy that was dissipated. Remove its net P and L before scaling its energy.
    const available=cause==='manual'?0:Math.max(0,energy-split.cost)*.18;
    if(available>1e-8&&hit.point&&hit.normal){
      const parts=ids.map(id=>this.bodies.get(id)),total=this.mass(b),push=M.mul(hit.normal,-1),weights=parts.map(p=>1/(M.dot(M.sub(p.rb.worldCom(),hit.point),M.sub(p.rb.worldCom(),hit.point))+.05*b.radius*b.radius));
      const mean=parts.reduce((sum,p,i)=>sum+weights[i]*this.mass(p),0)/total;
      const deltas=parts.map((p,i)=>M.mul(push,weights[i]-mean)),angular=parts.reduce((sum,p,i)=>M.add(sum,M.cross(M.sub(p.rb.worldCom(),com),M.mul(deltas[i],this.mass(p)))),M.V()),correction=inverseInertia(b,angular);
      let k=0;for(let i=0;i<parts.length;i++){deltas[i]=M.sub(deltas[i],M.cross(correction,M.sub(parts[i].rb.worldCom(),com)));k+=.5*this.mass(parts[i])*M.dot(deltas[i],deltas[i])+.5*M.dot(correction,spinMomentum(parts[i],correction));}
      const scale=k>1e-12?Math.sqrt(available/k):0;for(let i=0;i<parts.length;i++){const p=parts[i];p.rb.setLinvel(M.add(p.rb.linvel(),M.mul(deltas[i],scale)),true);p.rb.setAngvel(M.sub(omega,M.mul(correction,scale)),true);}
    }
    this.remove(id);this.events.push({type:'fracture',id,parts:ids,cause,time:this.time,point:M.add(hit.point??origin,this.origin),area:split.newArea,cost:split.cost,releasedEnergy:available});return ids;
  }
  update(id,values){
    const b=this.bodies.get(id);if(!b)throw Error('Select an object.');const position=values.position??this.globalPosition(b),q=values.rotation??rotation(b.rb.rotation()),velocity=values.velocity??point(b.rb.linvel()),spin=values.spin??point(b.rb.angvel()),material=values.material??b.material,density=values.mass!==undefined?values.mass/b.volume:(values.density??b.density),name=values.name??b.name;
    if(!Object.hasOwn(MATERIALS,material)||!Number.isFinite(density)||density<=0||density>1e15||typeof name!=='string'||!name.trim()||name.length>72||![position,velocity,spin].every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite))||![q.x,q.y,q.z,q.w].every(Number.isFinite)||Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>.01)throw Error('Enter valid object properties.');
    if(values.mass!==undefined&&(values.mass<1e-6||values.mass>MAX_MASS))throw Error('Mass is outside the supported range.');if(!this.canPlace(b.outer,position,q,id,b.shape==='sphere'&&!b.fragment?b.size:0))throw Error('Move the object into free space.');
    b.rb.setTranslation(M.sub(position,this.origin),true);b.rb.setRotation(q,true);b.material=material;b.density=density;b.name=name.trim();if(values.pinned!==undefined){b.pinned=values.pinned;b.rb.setBodyType(b.pinned?R.RigidBodyType.Fixed:R.RigidBodyType.Dynamic,true);}const m=MATERIALS[material],c=b.colliders[0];b.massProps=massProperties(b.outer,density);c.setMassProperties(b.massProps.mass,b.massProps.center,b.massProps.principal,b.massProps.frame);c.setFriction(m.friction);c.setRestitution(m.restitution);b.rb.recomputeMassPropertiesFromColliders();b.rb.setLinvel(b.pinned?M.V():velocity,true);b.rb.setAngvel(b.pinned?M.V():spin,true);this.refreshCompact(b);this.world.propagateModifiedBodyPositionsToColliders();
  }
  rebase(shift){if(M.length(shift)<1)return;for(const b of this.bodies.values())b.rb.setTranslation(M.sub(b.rb.translation(),shift),false);this.origin=M.add(this.origin,shift);if(this.grab)this.grab.target=M.sub(this.grab.target,shift);this.world.propagateModifiedBodyPositionsToColliders();}
  setGrab(id,localAnchor,target){this.grab={id,localAnchor:point(localAnchor),target:M.sub(target,this.origin)};}
  kick(dt){const field=gravityForces(this.massSamples(),null,G);this.lastPotential=field.potential;for(const [id,f]of field.forces){const b=this.bodies.get(id);if(!b.pinned)b.rb.setLinvel(M.add(b.rb.linvel(),M.mul(f.force,dt/this.mass(b))),true);}}
  step(maxDt=STEP){
    if(!Number.isFinite(maxDt)||maxDt<=0)throw Error('Invalid integration step.');let dt=Math.min(STEP,maxDt);const list=[...this.bodies.values()];
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j],distance=Math.max(.01,M.length(M.sub(a.rb.worldCom(),b.rb.worldCom()))),speed=M.length(M.sub(a.rb.linvel(),b.rb.linvel()));if(this.params.gravity)dt=Math.min(dt,.035*Math.sqrt(distance**3/(G*(this.mass(a)+this.mass(b)))));if(speed>0&&distance<a.radius+b.radius+speed*maxDt*2)dt=Math.min(dt,.3*Math.max(.05,Math.min(a.radius,b.radius))/speed);}
    this.world.timestep=dt;this.lastDt=dt;const positions=new Map(list.map(b=>[b.id,point(b.rb.translation())]));if(this.params.gravity)this.kick(dt/2);
    const before=new Map();for(const b of list){b.rb.resetForces(false);b.rb.resetTorques(false);before.set(b.id,{velocity:point(b.rb.linvel()),spin:point(b.rb.angvel()),com:point(b.rb.worldCom())});b.age+=dt;}
    if(this.grab){const b=this.bodies.get(this.grab.id);if(b&&!b.pinned){const at=M.add(b.rb.translation(),M.rotate(b.rb.rotation(),this.grab.localAnchor)),v=b.rb.velocityAtPoint(at),mass=this.mass(b);let f=M.mul(M.sub(M.mul(M.sub(this.grab.target,at),65),M.mul(v,14)),mass);if(M.length(f)>mass*800)f=M.mul(M.unit(f),mass*800);b.rb.addForceAtPoint(f,at,true);}}
    this.world.step(this.queue);this.time+=dt;const loads=new Map(),hits=new Map();this.lastContacts=0;
    const load=(id,other,force)=>{if(!loads.has(id))loads.set(id,new Map());const row=loads.get(id);row.set(other,M.add(row.get(other)??M.V(),force));};
    this.queue.drainContactForceEvents(event=>{
      const a=this.colliderMap.get(event.collider1()),b=this.colliderMap.get(event.collider2());if(!a||!b||a.id===b.id)return;const force=event.totalForceMagnitude();if(!Number.isFinite(force)||force<=0)return;this.lastContacts++;
      this.world.contactPair(a.colliders[0],b.colliders[0],(manifold,flipped)=>{
        let normal=point(manifold.normal());if(flipped)normal=M.mul(normal,-1);const contacts=[];let impulse=0;
        for(let i=0;i<manifold.numContacts();i++){const local=flipped?manifold.localContactPoint2(i):manifold.localContactPoint1(i);if(!local||manifold.contactDist(i)>.01)continue;const at=M.add(a.rb.translation(),M.rotate(a.rb.rotation(),local)),j=manifold.contactImpulse(i);contacts.push({at,j:Math.max(0,j)});impulse+=Math.max(0,j);}
        if(!contacts.length)return;const at=impulse>1e-8?M.mul(contacts.reduce((sum,c)=>M.add(sum,M.mul(c.at,c.j)),M.V()),1/impulse):M.mul(contacts.reduce((sum,c)=>M.add(sum,c.at),M.V()),1/contacts.length);
        if(impulse<=1e-8)impulse=force*dt;load(a.id,b.id,M.mul(normal,-impulse/dt));load(b.id,a.id,M.mul(normal,impulse/dt));
        const pa=before.get(a.id),pb=before.get(b.id),ra=M.sub(at,pa.com),rb=M.sub(at,pb.com),va=M.add(pa.velocity,M.cross(pa.spin,ra)),vb=M.add(pb.velocity,M.cross(pb.spin,rb)),closing=Math.max(0,M.dot(M.sub(va,vb),normal));
        if(closing<.15)return;
        const inv=bdy=>bdy.pinned?0:1/this.mass(bdy),angular=(bdy,r)=>bdy.pinned?0:M.dot(normal,M.cross(inverseInertia(bdy,M.cross(r,normal)),r)),inverse=inv(a)+inv(b)+angular(a,ra)+angular(b,rb);
        if(inverse<=0)return;const e=Math.max(MATERIALS[a.material].restitution,MATERIALS[b.material].restitution),lost=.5*closing*closing/inverse*(1-e*e),complianceA=a.pinned?0:1/MATERIALS[a.material].toughness,complianceB=b.pinned?0:1/MATERIALS[b.material].toughness,total=complianceA+complianceB;
        for(const [body,share,outward]of [[a,complianceA,normal],[b,complianceB,M.mul(normal,-1)]]){const energy=total>0?lost*share/total:0;const old=hits.get(body.id);if(!old||energy>old.energy)hits.set(body.id,{point:at,normal:outward,energy});}
      });
    });
    if(this.params.gravity)this.kick(dt/2);else this.lastPotential=0;
    const failures=[];
    for(const b of this.bodies.values()){
      const vectors=[...(loads.get(b.id)?.values()??[])];let balanced=0;for(let i=0;i<vectors.length;i++)for(let j=i+1;j<vectors.length;j++)if(M.dot(M.unit(vectors[i]),M.unit(vectors[j]))<-.65)balanced=Math.max(balanced,Math.min(M.length(vectors[i]),M.length(vectors[j])));
      const area=Math.max(.01,Math.PI*Math.cbrt(3*b.volume/(4*Math.PI))**2);b.pressure=balanced/area;const m=MATERIALS[b.material],hit=hits.get(b.id);b.lastImpact=hit?.energy??0;
      if(this.params.breaking&&!b.pinned&&!b.compact&&!m.unbreakable&&b.generation<3&&(b.generation===0||b.age>.06)){
        const compression=b.pressure>m.crush*this.params.strength;
        b.fractureEnergy+=hit?.energy??0;b.damage=Math.min(.99,b.fractureEnergy/(m.toughness*this.params.strength*b.radius*b.radius*3));
        if((hit||compression)&&b.fractureEnergy>m.toughness*this.params.strength*b.radius*b.radius*.015)failures.push([b.id,compression?'compression':'impact',{...(hit??{point:point(b.rb.translation()),normal:M.unit(vectors[0]??M.V(1,0,0))}),energy:b.fractureEnergy}]);
      }
      if(![b.rb.translation(),b.rb.linvel(),b.rb.angvel()].every(v=>[v.x,v.y,v.z].every(Number.isFinite)))throw Error('Numerical range exceeded. Pause and undo the last edit.');
    }
    this.absorb(positions);for(const [id,cause,hit]of failures)this.fracture(id,cause,hit);if(this.events.length>80)this.events.splice(0,this.events.length-80);return dt;
  }
  absorb(before=null){
    for(const hole of [...this.bodies.values()].filter(b=>b.compact).sort((a,b)=>this.mass(b)-this.mass(a))){if(!this.bodies.has(hole.id))continue;
      for(const other of [...this.bodies.values()]){if(other.id===hole.id||other.pinned||!this.bodies.has(other.id)||other.compact&&this.mass(other)>this.mass(hole))continue;
        const p=point(hole.rb.translation()),op=point(other.rb.translation()),end=M.sub(op,p),start=before?.has(hole.id)&&before.has(other.id)?M.sub(before.get(other.id),before.get(hole.id)):end,delta=M.sub(end,start),t=Math.max(0,Math.min(1,-M.dot(start,delta)/Math.max(1e-20,M.dot(delta,delta))));if(M.length(M.add(start,M.mul(delta,t)))>=hole.horizon)continue;
        const m=this.mass(hole),n=this.mass(other),v=M.mul(M.add(M.mul(hole.rb.linvel(),m),M.mul(other.rb.linvel(),n)),1/(m+n)),center=M.mul(M.add(M.mul(p,m),M.mul(op,n)),1/(m+n));hole.density*=(m+n)/m;hole.massProps=massProperties(hole.outer,hole.density);hole.colliders[0].setMassProperties(hole.massProps.mass,hole.massProps.center,hole.massProps.principal,hole.massProps.frame);hole.rb.recomputeMassPropertiesFromColliders();if(!hole.pinned){hole.rb.setTranslation(center,true);hole.rb.setLinvel(v,true);}this.remove(other.id);this.refreshCompact(hole);this.events.push({type:'capture',id:hole.id,other:other.id,mass:n,time:this.time});
      }
    }
  }
  invariants(){let mass=0,center=M.V(),momentum=M.V(),angular=M.V(),kinetic=0;for(const b of this.bodies.values()){const m=this.mass(b),com=M.add(b.rb.worldCom(),this.origin),v=b.pinned?M.V():point(b.rb.linvel()),omega=b.pinned?M.V():point(b.rb.angvel()),spin=spinMomentum(b,omega);mass+=m;center=M.add(center,M.mul(com,m));momentum=M.add(momentum,M.mul(v,m));angular=M.add(angular,M.add(M.cross(com,M.mul(v,m)),spin));kinetic+=.5*m*M.dot(v,v)+.5*M.dot(omega,spin);}return{mass,center:mass?M.mul(center,1/mass):M.V(),momentum,angular,kinetic,potential:this.params.gravity?gravityForces(this.massSamples(),null).potential:0};}
  toJSON(){return{origin:point(this.origin),time:this.time,nextId:this.nextId,params:{...this.params},bodies:[...this.bodies.values()].map(b=>({id:b.id,name:b.name,shape:b.shape,size:b.size,material:b.material,density:b.density,pinned:b.pinned,position:this.globalPosition(b),rotation:rotation(b.rb.rotation()),velocity:point(b.rb.linvel()),spin:point(b.rb.angvel()),outer:copy(b.outer),damage:b.damage,fractureEnergy:b.fractureEnergy,fragment:b.fragment,generation:b.generation,family:b.family}))};}
  snapshot(){return{engine:'Rapier 0.21.0',model:'contact-fracture-2',time:this.time,lastDt:this.lastDt,origin:point(this.origin),params:{...this.params},count:this.bodies.size,cells:this.cellCount,contacts:this.lastContacts,events:copy(this.events),invariants:this.invariants(),bodies:[...this.bodies.values()].map(b=>({id:b.id,name:b.name,shape:b.shape,material:b.material,pinned:b.pinned,mass:this.mass(b),density:b.density,volume:b.volume,radius:b.radius,position:this.globalPosition(b),velocity:point(b.rb.linvel()),spin:point(b.rb.angvel()),rotation:rotation(b.rb.rotation()),pieces:1,damage:b.damage,pressure:b.pressure,fragment:b.fragment,generation:b.generation,horizon:b.horizon,compact:b.compact}))};}
}
export function checkedScene(value){
  const finite=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=max,vector=(p,max)=>{if(!p||![p.x,p.y,p.z].every(v=>finite(v,max)))throw Error('Invalid coordinates.');return point(p);},budget={count:0};
  if(!value||!Array.isArray(value.bodies)||value.bodies.length>MAX_BODIES||!finite(value.time,1e12)||value.time<0)throw Error('Invalid Void Lab scene.');const origin=vector(value.origin,1e12),ids=new Set();
  const bodies=value.bodies.map(b=>{
    if(!Number.isInteger(b.id)||b.id<1||b.id>1e9||ids.has(b.id)||!Object.hasOwn(MATERIALS,b.material)||!Object.hasOwn(SHAPES,b.shape)||!finite(b.size,8)||b.size<.25||!finite(b.density,1e15)||b.density<=0||typeof b.pinned!=='boolean'||typeof b.fragment!=='boolean'||!finite(b.damage,1)||b.damage<0||typeof b.name!=='string'||!b.name.trim()||b.name.length>72)throw Error('Invalid object data.');ids.add(b.id);
    const q=b.rotation;if(!q||![q.x,q.y,q.z,q.w].every(v=>finite(v,1.001))||Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>.01)throw Error('Invalid rotation.');if(b.generation!==undefined&&(!Number.isInteger(b.generation)||b.generation<0||b.generation>3)||b.fractureEnergy!==undefined&&(!finite(b.fractureEnergy,1e20)||b.fractureEnergy<0))throw Error('Invalid fracture data.');
    return{id:b.id,name:b.name,shape:b.shape,size:b.size,material:b.material,density:b.density,pinned:b.pinned,fragment:b.fragment,damage:b.damage,fractureEnergy:b.fractureEnergy??0,generation:b.generation??(b.fragment?1:0),family:Number.isInteger(b.family)&&b.family>0?b.family:b.id,position:vector(b.position,1e12),velocity:vector(b.velocity,1e6),spin:vector(b.spin,1e6),rotation:M.normalizeQ(q),outer:M.checkedPoly(b.outer,budget)};
  });
  const p=value.params;if(!p||typeof p.gravity!=='boolean'||typeof p.breaking!=='boolean'||p.g!==G||!finite(p.strength,100)||p.strength<.1)throw Error('Invalid simulation settings.');return{origin,time:value.time,nextId:Math.max(1,...bodies.map(b=>b.id+1)),params:{gravity:p.gravity,breaking:p.breaking,g:G,strength:p.strength},bodies};
}
export function restoreScene(value){const checked=checkedScene(value),s=new Simulation();try{s.origin=checked.origin;s.time=checked.time;s.params=checked.params;for(const body of checked.bodies)s.add(body,false);s.nextId=checked.nextId;return s;}catch(error){s.dispose();throw error;}}
export function preset(name){const s=new Simulation();s.params.gravity=name==='empty';
  if(name==='impact'){s.add({shape:'box',size:1.3,material:'glass',position:M.V(2,0,0)});s.add({shape:'sphere',size:.65,material:'steel',position:M.V(-8,.45,.3),velocity:M.V(18,0,0)});}
  else if(name==='crush'){s.add({shape:'box',size:1,material:'glass'});for(const sign of [-1,1])s.add({size:1.3,material:'steel',density:150,position:M.V(sign*3.6,0,0),velocity:M.V(-sign*2,0,0)});}
  else if(name==='orbit'){s.params.gravity=true;s.params.breaking=false;const a=s.add({shape:'sphere',size:2,material:'steel'}),b=s.add({shape:'sphere',size:.55,material:'stone',position:M.V(8,0,0)}),ma=s.mass(a),mb=s.mass(b),v=Math.sqrt(G*(ma+mb)/8);a.rb.setLinvel(M.V(0,0,-v*mb/(ma+mb)),true);b.rb.setLinvel(M.V(0,0,v*ma/(ma+mb)),true);}
  else if(name==='materials'){for(const [i,material]of Object.keys(MATERIALS).entries())s.add({shape:i%2?'sphere':'box',material,size:.75,position:M.V((i-2.5)*3,0,0)});}
  else if(name!=='empty'){s.dispose();throw Error('Unknown scene.');}return s;
}
