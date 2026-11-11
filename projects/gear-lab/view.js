import{CameraRig,CAMERA_FOV}from'./camera.js?v=8';
import*as T from'../isometric/vendor/three.module.js';
import{MATERIALS,dimensions}from'./geometry.js?v=6';
import{SCALE}from'./physics.js?v=6';
import{V,Q,multiply,rotate,mountRotation,gearPoint,pegLength,wallSize,FLOOR_Y,FLOOR_SIZE}from'./space.js?v=6';

function dispose(group){for(const child of[...group.children]){group.remove(child);child.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.dispose();});}}
const material=(color,metalness=.15)=>new T.MeshStandardMaterial({color,metalness,roughness:.55});
function box(w,h,d,color){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material(color));m.castShadow=true;m.receiveShadow=true;return m;}
function cylinder(radius,height,color){const m=new T.Mesh(new T.CylinderGeometry(radius,radius,height,20),material(color,.55));m.rotation.x=Math.PI/2;m.castShadow=true;m.receiveShadow=true;return m;}
function bodyMesh(parts,thickness,color){
 const positions=[],normals=[];
 for(const part of parts){const shape=new T.Shape();part.polygon.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();let geo=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});geo.translate(0,0,-thickness/2);if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);geo.dispose();}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.computeBoundingSphere();const mesh=new T.Mesh(geo,material(color));mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export class GearView{
 constructor(canvas){
  this.canvas=canvas;this.rig=new CameraRig();
  this.scene=new T.Scene();this.scene.background=new T.Color('#171b20');this.camera=new T.PerspectiveCamera(CAMERA_FOV,1,.005,1000);
  this.renderer=new T.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene.add(new T.HemisphereLight(0xe9f2ff,0x3b4149,2));const light=new T.DirectionalLight(0xfff1da,2.5);light.position.set(-3,5,4);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;light.shadow.normalBias=.002;this.scene.add(light);
  this.environment=new T.Group();this.mounts=new T.Group();this.rotors=new T.Group();this.fragments=new T.Group();this.scene.add(this.environment,this.mounts,this.rotors,this.fragments);
  this.gearMeshes=new Map();this.fragmentMeshes=new Map();this.raycaster=new T.Raycaster();this.mouse=new T.Vector2();this.resize();
 }
 get yaw(){return this.rig.yaw;}get pitch(){return this.rig.pitch;}get zoom(){return this.rig.zoom;}
 cameraState(){return this.rig.snapshot();}
 updateCamera(){this.camera.position.copy(this.rig.position);this.camera.quaternion.copy(this.rig.rotation);this.camera.up.copy(this.rig.up);this.camera.updateMatrixWorld();}
 orient(yaw,pitch){this.rig.orient(yaw,pitch);this.updateCamera();}
 look(start,end,rect,anchor,initial){this.rig.look(start,end,rect,anchor,initial);this.updateCamera();}
 pan(dx,dy,height,initial){this.rig.pan(dx,dy,height,initial);this.updateCamera();}
 wheel(delta,mode,height){this.rig.wheel(delta,mode,height);this.updateCamera();}
 dolly(factor){this.rig.dolly(factor);this.updateCamera();}
 resize(){const r=this.canvas.getBoundingClientRect();this.camera.aspect=Math.max(.1,r.width/r.height);this.camera.updateProjectionMatrix();this.updateCamera();this.renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);}
 setDesign(design,sim){
  this.design=design;this.sim=sim;for(const g of[this.environment,this.mounts,this.rotors,this.fragments])dispose(g);this.gearMeshes.clear();this.fragmentMeshes.clear();
  const floor=box(FLOOR_SIZE,.08,FLOOR_SIZE,'#2c333a');floor.position.y=FLOOR_Y-.04;floor.castShadow=false;floor.userData={type:'floor',id:'floor'};this.environment.add(floor);
  for(const w of design.walls){const size=wallSize(w),m=box(size.x,size.y,size.z,'#525e68');m.position.set(w.x,w.y,w.z);m.userData={type:'wall',id:w.id};this.environment.add(m);}
  for(const p of design.pegs){const group=new T.Group(),size=pegLength(design,p.id),pole=cylinder(.008,size,'#a7b2b8');pole.position.z=size/2;group.add(pole);const base=cylinder(.024,.012,'#687784');base.position.z=.006;group.add(base);group.position.set(p.x,p.y,p.z);group.quaternion.copy(mountRotation(p));group.userData={type:'peg',id:p.id};this.mounts.add(group);}
  for(const g of sim.gears.values()){
   if(g.config.kind==='motor'){const peg=design.pegs.find(p=>p.id===g.config.peg),housing=new T.Group(),r=dimensions(g.config.teeth,g.config.module).pitch*.92,z=.06+g.config.layer*.05;const base=box(r*2,r*2,.034,'#b39a61');base.position.z=z-g.config.thickness/2-.02;housing.add(base);const cap=cylinder(r*.7,.006,'#655b43');cap.position.z=z-g.config.thickness/2-.004;housing.add(cap);housing.position.set(peg.x,peg.y,peg.z);housing.quaternion.copy(mountRotation(peg));housing.userData={type:'motor',id:g.config.id};this.mounts.add(housing);}
   const group=this.rotor(g);this.gearMeshes.set(g.config.id,group);this.rotors.add(group);
  }
  this.draw();
 }
 rotor(g){
  const group=new T.Group(),body=bodyMesh(g.parts,g.config.thickness,MATERIALS[g.config.material].color);body.userData={type:'gear',id:g.config.id};group.add(body);
  const collar=cylinder(.014,.008,g.config.kind==='motor'?'#b39a61':'#697881');collar.position.z=g.config.thickness/2+.004;group.add(collar);
  if(g.config.crank){const radius=dimensions(g.config.teeth,g.config.module).outer*.72,z=g.config.thickness/2,arm=box(radius,.012,.012,'#aab9bd');arm.position.set(radius/2,0,z+.014);group.add(arm);const handle=cylinder(.012,.04,'#b79958');handle.position.set(radius,0,z+.04);handle.userData={type:'crank',id:g.config.id};group.add(handle);}
  group.userData={type:'gear',id:g.config.id,revision:g.revision};return group;
 }
 draw(selected=null,stress=false,latched=null,preview=null){
  if(!this.sim)return;const has=id=>selected instanceof Set?selected.has(id):selected===id;
  for(const g of this.sim.gears.values()){
   let mesh=this.gearMeshes.get(g.config.id);if(mesh.userData.revision!==g.revision){this.rotors.remove(mesh);dispose(mesh);mesh=this.rotor(g);this.gearMeshes.set(g.config.id,mesh);this.rotors.add(mesh);}
   const p=g.rb.translation();mesh.position.set(p.x/SCALE,p.y/SCALE,p.z/SCALE);mesh.quaternion.copy(preview?.has(g.config.id)?multiply(g.frame,Q(preview.get(g.config.id))):g.rb.rotation());
   const body=mesh.children[0];body.material.color.set(MATERIALS[g.config.material].color);if(stress){const ratio=Math.min(1,g.stress/MATERIALS[g.config.material].strength);body.material.color.setHSL(.33*(1-ratio),.65,.5);}body.material.emissive.set(has(g.config.id)?'#76531a':'#000000');
   const handle=mesh.children.find(m=>m.userData.type==='crank');if(handle)handle.material.color.set(latched===g.config.id?'#80c89b':'#b79958');
  }
  for(const f of this.sim.fragments){let mesh=this.fragmentMeshes.get(f.id);if(!mesh){mesh=bodyMesh(f.parts,f.thickness,MATERIALS[f.material].color);this.fragmentMeshes.set(f.id,mesh);this.fragments.add(mesh);}const p=f.rb.translation();mesh.position.set(p.x/SCALE,p.y/SCALE,p.z/SCALE);mesh.quaternion.copy(f.rb.rotation());}
  for(const wall of this.environment.children)if(wall.userData.type==='wall')wall.material.emissive.set(has(wall.userData.id)?'#55451e':'#000000');
  for(const mount of this.mounts.children)mount.traverse(o=>{if(o.material)o.material.emissive.set(has(mount.userData.id)?'#55451e':'#000000');});this.highlighted=[...this.design.gears,...this.design.pegs,...this.design.walls].filter(p=>has(p.id)).map(p=>p.id);this.renderer.render(this.scene,this.camera);
 }
 ray(event){const r=this.canvas.getBoundingClientRect();this.mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.mouse,this.camera);return this.raycaster;}
 hits(event){return this.ray(event).intersectObjects([...this.environment.children,...this.mounts.children,...this.rotors.children],true).map(hit=>{let o=hit.object;while(o&&!o.userData.type)o=o.parent;if(!o)return null;return{type:o.userData.type,id:o.userData.id,point:{x:hit.point.x,y:hit.point.y,z:hit.point.z},normal:hit.face?new T.Vector3().copy(hit.face.normal).transformDirection(hit.object.matrixWorld):null,distance:hit.distance};}).filter(Boolean);}
 surface(event){return this.hits(event).find(h=>h.type==='floor'||h.type==='wall')||null;}
 pick(event){return this.hits(event).find(h=>h.type!=='floor')||null;}
 rotationAnchor(event){const hit=this.ray(event).intersectObjects([...this.environment.children,...this.mounts.children,...this.rotors.children,...this.fragments.children],true)[0],p=hit?.point||this.planePoint(event,this.rig.center,this.rig.forward);return p?V(p.x,p.y,p.z):{...this.rig.center};}
 planePoint(event,point,normal){return this.ray(event).ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(normal.x,normal.y,normal.z),new T.Vector3(point.x,point.y,point.z)),new T.Vector3());}
 dragPlane(event,point,normal){const ray=this.ray(event).ray,n=new T.Vector3(normal.x,normal.y,normal.z),forward=this.camera.getWorldDirection(new T.Vector3()),chosen=Math.abs(forward.dot(n))<.15||Math.abs(ray.direction.dot(n))<.05?forward:n;return{point:this.planePoint(event,point,chosen),normal:{x:chosen.x,y:chosen.y,z:chosen.z}};}
 revealCrank(axis){if(Math.abs(this.rig.forward.x*axis.x+this.rig.forward.y*axis.y+this.rig.forward.z*axis.z)>=.15)return false;if(Math.abs(axis.y)>.9)this.orient(-.55,axis.y*.95);else this.orient(Math.atan2(axis.x,axis.z),.35);return true;}
 point(p){const v=new T.Vector3(p.x,p.y,p.z).project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
 fit(){
  const points=[],bounds=(p,s)=>{for(const x of[-1,1])for(const y of[-1,1])for(const z of[-1,1])points.push(V(p.x+x*s.x,p.y+y*s.y,p.z+z*s.z));};
  for(const w of this.design.walls){const s=wallSize(w);bounds(w,V(s.x/2,s.y/2,s.z/2));}
  for(const p of this.design.pegs){const tip=rotate(mountRotation(p),V(0,0,pegLength(this.design,p.id)));points.push(V(p.x,p.y,p.z),V(p.x+tip.x,p.y+tip.y,p.z+tip.z));}
  for(const g of this.design.gears){const p=gearPoint(this.design.pegs.find(p=>p.id===g.peg),g),r=dimensions(g.teeth,g.module).outer;bounds(p,V(r,r,r));}
  const r=this.canvas.getBoundingClientRect();this.rig.fit(points,r.width/r.height);this.updateCamera();
 }
 stats(){return{gears:this.gearMeshes.size,fragments:this.fragmentMeshes.size,walls:this.design.walls.length,floor:true,poses:[...this.gearMeshes].map(([id,m])=>({id,rotation:{x:m.quaternion.x,y:m.quaternion.y,z:m.quaternion.z,w:m.quaternion.w}})),pegLengths:this.design.pegs.map(p=>({id:p.id,length:pegLength(this.design,p.id)})),highlighted:this.highlighted||[]};}
}
