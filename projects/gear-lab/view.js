import*as T from'../isometric/vendor/three.module.js';
import{MATERIALS,dimensions}from'./geometry.js?v=3';
import{SCALE}from'./physics.js?v=3';
import{V,rotate,mountRotation,gearPoint,wallSize,FLOOR_Y,FLOOR_SIZE}from'./space.js?v=3';

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
  this.canvas=canvas;this.yaw=-.55;this.pitch=.62;this.zoom=1;this.center=new T.Vector3(0,-.15,0);
  this.scene=new T.Scene();this.scene.background=new T.Color('#171b20');this.camera=new T.OrthographicCamera(-1.5,1.5,1,-1,.01,80);
  this.renderer=new T.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene.add(new T.HemisphereLight(0xe9f2ff,0x3b4149,2));const light=new T.DirectionalLight(0xfff1da,2.5);light.position.set(-3,5,4);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;light.shadow.normalBias=.002;this.scene.add(light);
  this.environment=new T.Group();this.mounts=new T.Group();this.rotors=new T.Group();this.fragments=new T.Group();this.scene.add(this.environment,this.mounts,this.rotors,this.fragments);
  this.gearMeshes=new Map();this.fragmentMeshes=new Map();this.raycaster=new T.Raycaster();this.mouse=new T.Vector2();this.resize();
 }
 resize(){const r=this.canvas.getBoundingClientRect(),aspect=Math.max(.1,r.width/r.height),h=1.12/this.zoom;this.camera.left=-h*aspect;this.camera.right=h*aspect;this.camera.top=h;this.camera.bottom=-h;this.camera.position.set(this.center.x+6*Math.sin(this.yaw)*Math.cos(this.pitch),this.center.y+6*Math.sin(this.pitch),this.center.z+6*Math.cos(this.yaw)*Math.cos(this.pitch));this.camera.up.set(0,1,0);this.camera.lookAt(this.center);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);}
 setDesign(design,sim){
  this.design=design;this.sim=sim;for(const g of[this.environment,this.mounts,this.rotors,this.fragments])dispose(g);this.gearMeshes.clear();this.fragmentMeshes.clear();
  const floor=box(FLOOR_SIZE,.08,FLOOR_SIZE,'#2c333a');floor.position.y=FLOOR_Y-.04;floor.castShadow=false;floor.userData={type:'floor',id:'floor'};this.environment.add(floor);
  for(const w of design.walls){const size=wallSize(w),m=box(size.x,size.y,size.z,'#525e68');m.position.set(w.x,w.y,w.z);m.userData={type:'wall',id:w.id};this.environment.add(m);}
  for(const p of design.pegs){const group=new T.Group(),pole=cylinder(.008,.43,'#a7b2b8');pole.position.z=.215;group.add(pole);const base=cylinder(.024,.012,'#687784');base.position.z=.006;group.add(base);group.position.set(p.x,p.y,p.z);group.quaternion.copy(mountRotation(p));group.userData={type:'peg',id:p.id};this.mounts.add(group);}
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
 draw(selected=null,stress=false,latched=null){
  if(!this.sim)return;const has=id=>selected instanceof Set?selected.has(id):selected===id;
  for(const g of this.sim.gears.values()){
   let mesh=this.gearMeshes.get(g.config.id);if(mesh.userData.revision!==g.revision){this.rotors.remove(mesh);dispose(mesh);mesh=this.rotor(g);this.gearMeshes.set(g.config.id,mesh);this.rotors.add(mesh);}
   const p=g.rb.translation();mesh.position.set(p.x/SCALE,p.y/SCALE,p.z/SCALE);mesh.quaternion.copy(g.rb.rotation());
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
 planePoint(event,point,normal){return this.ray(event).ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(normal.x,normal.y,normal.z),new T.Vector3(point.x,point.y,point.z)),new T.Vector3());}
 dragPlane(event,point,normal){const ray=this.ray(event).ray,n=new T.Vector3(normal.x,normal.y,normal.z),chosen=Math.abs(ray.direction.dot(n))<.02?this.camera.getWorldDirection(new T.Vector3()):n;return{point:this.planePoint(event,point,chosen),normal:{x:chosen.x,y:chosen.y,z:chosen.z}};}
 revealCrank(axis){const forward=this.camera.getWorldDirection(new T.Vector3());if(Math.abs(forward.dot(new T.Vector3(axis.x,axis.y,axis.z)))>=.15)return false;if(Math.abs(axis.y)>.9){this.pitch=axis.y*.95;this.yaw=-.55;}else{this.yaw=Math.atan2(axis.x,axis.z);this.pitch=.35;}this.resize();return true;}
 point(p){const v=new T.Vector3(p.x,p.y,p.z).project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
 fit(){
  const points=[];for(const w of this.design.walls){const s=wallSize(w);points.push(new T.Vector3(w.x-s.x/2,w.y-s.y/2,w.z-s.z/2),new T.Vector3(w.x+s.x/2,w.y+s.y/2,w.z+s.z/2));}
  for(const p of this.design.pegs){const tip=rotate(mountRotation(p),V(0,0,.43));points.push(new T.Vector3(p.x,p.y,p.z),new T.Vector3(p.x+tip.x,p.y+tip.y,p.z+tip.z));}
  for(const g of this.design.gears){const p=gearPoint(this.design.pegs.find(p=>p.id===g.peg),g),r=dimensions(g.teeth,g.module).outer;points.push(new T.Vector3(p.x-r,p.y-r,p.z-r),new T.Vector3(p.x+r,p.y+r,p.z+r));}
  if(!points.length){this.center.set(0,-.15,0);this.zoom=1;}else{const b=new T.Box3().setFromPoints(points),size=b.getSize(new T.Vector3());b.getCenter(this.center);const extent=Math.max(.6,size.length()+.18);this.zoom=Math.max(.15,Math.min(5,2.24/extent));}this.resize();
 }
 stats(){return{gears:this.gearMeshes.size,fragments:this.fragmentMeshes.size,walls:this.design.walls.length,floor:true,highlighted:this.highlighted||[]};}
}
