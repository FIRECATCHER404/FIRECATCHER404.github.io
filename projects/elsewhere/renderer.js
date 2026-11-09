import * as THREE from '../isometric/vendor/three.module.js';
import {PALETTES} from './model.js';
import {frame,polygon,local,mapPoint,mapVector,destination} from './space.js';
const V=a=>new THREE.Vector3(...a);
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.88,...extra});
function box(group,w,h,d,pos,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));mesh.position.set(...pos);group.add(mesh);return mesh;}
function cylinder(group,r,h,pos,color,r2=r){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,h,32),material(color));mesh.position.set(...pos);group.add(mesh);return mesh;}
function surface(points){const path=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));return new THREE.ShapeGeometry(path);}
function orient(object,f){const matrix=new THREE.Matrix4().makeBasis(V(f.right),V(f.up),V(f.n));object.quaternion.setFromRotationMatrix(matrix);object.position.copy(V(f.origin));}
function textSprite(text,color='#314740'){
 const c=document.createElement('canvas');c.width=768;c.height=96;const x=c.getContext('2d');x.clearRect(0,0,768,96);x.fillStyle=color;x.font='500 34px Arial';x.textAlign='center';x.fillText(text,384,58);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,transparent:true}));sprite.scale.set(4,.5,1);return sprite;
}
function propMesh(o){
 const g=new THREE.Group(),s=o.size,c=o.color;
 if(o.type==='plinth'){box(g,s,s*1.1,s,[0,s*.55,0],c);box(g,s*1.12,.08,s*1.12,[0,s*1.1,0],c);}
 if(o.type==='orb'){cylinder(g,s*.38,.12,[0,.06,0],'#8b9285');const mesh=new THREE.Mesh(new THREE.SphereGeometry(s*.48,40,24),material(c,{roughness:.28,metalness:.18}));mesh.position.y=s*.61;g.add(mesh);}
 if(o.type==='column'){cylinder(g,s*.37,s*2.3,[0,s*1.15,0],c);cylinder(g,s*.49,.15,[0,.075,0],c);cylinder(g,s*.49,.14,[0,s*2.3,0],c);}
 if(o.type==='bench'){box(g,s*1.6,s*.18,s*.64,[0,s*.55,0],c);for(const x of [-s*.55,s*.55])box(g,s*.12,s*.5,s*.42,[x,s*.25,0],c);}
 if(o.type==='stairs')for(let i=0;i<6;i++)box(g,s,s*(i+1)/7,s/3,[0,s*(i+1)/14,(2.5-i)*s/3],c);
 if(o.type==='ring'){cylinder(g,s*.55,s*.2,[0,s*.1,0],c);const mesh=new THREE.Mesh(new THREE.TorusGeometry(s*.55,s*.13,12,56),material(c,{roughness:.4,metalness:.15}));mesh.position.y=s*.87;g.add(mesh);}
 if(o.type==='plant'){cylinder(g,s*.28,s*.6,[0,s*.3,0],'#b59c80',s*.4);for(let i=0;i<7;i++){const a=i*2.4,leaf=new THREE.Mesh(new THREE.SphereGeometry(s*.32,12,8),material(c));leaf.scale.set(.55,1.7,.8);leaf.position.set(Math.cos(a)*s*.22,s*(.85+i*.06),Math.sin(a)*s*.22);leaf.rotation.z=Math.sin(a)*.6;g.add(leaf);}}
 // Grounding patches are inexpensive even when the room is drawn through a portal.
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(s*.8,32),new THREE.MeshBasicMaterial({color:'#344b48',transparent:true,opacity:.11,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.008;g.add(shadow);
 g.position.set(o.x,o.y,o.z);g.rotation.y=o.angle*Math.PI/180;g.userData.object=o.id;return g;
}
function portalMaterial(color){return new THREE.ShaderMaterial({
 uniforms:{view:{value:null},ready:{value:0},tint:{value:new THREE.Color(color)}},side:THREE.FrontSide,clipping:true,
 vertexShader:`varying vec4 screenPosition;
 #include <clipping_planes_pars_vertex>
 void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;screenPosition=gl_Position;
 #include <clipping_planes_vertex>
 }`,
 fragmentShader:`uniform sampler2D view;uniform float ready;uniform vec3 tint;varying vec4 screenPosition;
 #include <clipping_planes_pars_fragment>
 void main(){vec4 diffuseColor=vec4(1.0);
 #include <clipping_planes_fragment>
 vec2 uv=screenPosition.xy/screenPosition.w*.5+.5;
 gl_FragColor=ready>.5?texture2D(view,uv):vec4(tint*.38,1.0);
 #include <colorspace_fragment>
 }`
 });}
export class SpaceRenderer{
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
  this.camera=new THREE.PerspectiveCamera(60,1,.025,250);this.camera.rotation.order='YXZ';this.rooms=new Map();this.targets=[];this.depth=2;this.draws=0;this.selected=null;this.pick=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.orbit={yaw:.4,phi:1.04,radius:19};this.target=new THREE.Vector3(0,1.7,0);this.width=1;this.height=1;this.resize();
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,Math.floor(r.width));this.height=Math.max(1,Math.floor(r.height));this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();for(const t of this.targets)t.dispose();this.targets=[];}
 disposeRooms(){for(const {scene}of this.rooms.values())scene.traverse(o=>{o.geometry?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material])){m?.map?.dispose();m?.dispose();}});this.rooms.clear();}
 rebuild(project){
  this.project=project;this.disposeRooms();
  for(const r of project.rooms){
   const palette=PALETTES[r.palette],scene=new THREE.Scene();scene.background=new THREE.Color('#e7e8de');scene.add(new THREE.HemisphereLight('#fff4df','#6b8582',2.5));const sun=new THREE.DirectionalLight('#fff0d3',2.4);sun.position.set(-4,10,5);scene.add(sun);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(r.width,r.depth),material(palette.floor,{side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.userData.floor=true;scene.add(floor);
   if(r.pattern!=='plain'){
    const tile=material(palette.wall,{transparent:true,opacity:.15,depthWrite:false}),n=Math.ceil(r.width/1.2),m=Math.ceil(r.depth/1.2),w=r.width/n,d=r.depth/m;
    const positions=[];for(let x=0;x<n;x++)for(let z=0;z<m;z++)if(r.pattern==='bands'?z%3===0:(x+z)%2===0)positions.push([-r.width/2+(x+.5)*w,.006,-r.depth/2+(z+.5)*d]);
    const tiles=new THREE.InstancedMesh(new THREE.PlaneGeometry(w-.015,d-.015),tile,positions.length),dummy=new THREE.Object3D();positions.forEach((p,i)=>{dummy.position.set(...p);dummy.rotation.x=-Math.PI/2;dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);});scene.add(tiles);
   }
   const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(r.width,r.depth),material(palette.wall));ceiling.rotation.x=Math.PI/2;ceiling.position.y=r.height;scene.add(ceiling);
   for(const wall of ['north','east','south','west']){
    const span=['north','south'].includes(wall)?r.width:r.depth,f=frame(r,{wall,u:0,base:0,height:r.height}),wallMesh=new THREE.Mesh(new THREE.PlaneGeometry(span,r.height),material(palette.wall));orient(wallMesh,f);wallMesh.userData.wall=wall;scene.add(wallMesh);
    const trim=new THREE.Group();orient(trim,frame(r,{wall,u:0,base:0,height:.18}));trim.position.addScaledVector(V(f.n),.015);box(trim,span,.18,.045,[0,0,0],palette.accent);scene.add(trim);
    const cornice=new THREE.Group();orient(cornice,frame(r,{wall,u:0,base:r.height-.17,height:.1}));cornice.position.addScaledVector(V(f.n),.02);box(cornice,span,.035,.04,[0,0,0],palette.accent);scene.add(cornice);
   }
   const portals=[];
   for(const p of r.portals){
    const poly=polygon(p),mat=portalMaterial(p.color),mesh=new THREE.Mesh(surface(poly),mat),f=frame(r,p);orient(mesh,f);mesh.position.addScaledVector(V(f.n),.038);mesh.userData.portal=p.id;mesh.renderOrder=2;scene.add(mesh);
    const rim=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(poly.map(a=>new THREE.Vector3(...a,.06))),new THREE.LineBasicMaterial({color:p.color,linewidth:2}));orient(rim,f);scene.add(rim);
    // The attachment points make custom quadrilateral surfaces read as a taut sheet.
    if(p.shape==='tarp')for(const [x,y]of poly){const pin=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),material(p.color));pin.position.set(x,y,.09);const holder=new THREE.Group();orient(holder,f);holder.add(pin);scene.add(holder);}
    const title=textSprite(p.name,palette.accent);title.position.copy(V(f.origin)).add(new THREE.Vector3(0,p.height/2+.28,0)).addScaledVector(V(f.n),.12);scene.add(title);
    portals.push({data:p,mesh,rim,title,frame:f});
   }
   const objects=[];for(const o of r.props){const mesh=propMesh(o);scene.add(mesh);objects.push(mesh);}
   this.rooms.set(r.id,{data:r,scene,ceiling,floor,portals,objects});
  }
 }
 setCamera(roomId,mode,visitor){
  if(mode==='walk'){this.camera.position.fromArray(visitor.position);this.camera.rotation.set(visitor.pitch,visitor.yaw,0,'YXZ');this.camera.near=.025*visitor.scale;}
  else{const{yaw,phi,radius}=this.orbit;this.camera.position.set(Math.sin(yaw)*Math.sin(phi)*radius,Math.cos(phi)*radius,Math.cos(yaw)*Math.sin(phi)*radius).add(this.target);this.camera.lookAt(this.target);this.camera.near=.025;}
  this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 }
 mappedCamera(camera,r,p,target){
  const c=camera.clone(),position=mapPoint(r,p,target.room,target.portal,camera.position.toArray()),direction=new THREE.Vector3();camera.getWorldDirection(direction);const dir=V(mapVector(r,p,target.room,target.portal,direction.toArray()));c.position.fromArray(position);c.up.set(0,1,0);c.lookAt(c.position.clone().add(dir));c.near=Math.max(.005,camera.near*(p.scale?target.portal.width/p.width:1));c.updateProjectionMatrix();c.updateMatrixWorld();return c;
 }
 render(roomId,mode,visitor,selected){this.selected=selected;this.setCamera(roomId,mode,visitor);this.draws=0;this.used=0;const room=this.rooms.get(roomId);if(!room)return;
  this.view(room,this.camera,0,null,null,mode);this.renderer.setRenderTarget(null);this.renderer.clippingPlanes=[];
 }
 visible(p,camera){const v=local(p.frame,camera.position.toArray());if(v[2]<.008)return false;p.mesh.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));return frustum.intersectsObject(p.mesh);}
 view(room,camera,depth,target,clip,mode){
  const maps=[];
  for(const entry of room.portals){let texture=null;const dest=destination(this.project,entry.data);
   if(dest&&depth<this.depth&&this.draws<12&&this.visible(entry,camera)){
    const i=this.used++,tw=Math.min(this.width,1100),th=Math.round(tw*this.height/this.width);
    if(!this.targets[i]){const t=new THREE.WebGLRenderTarget(tw,th,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});t.texture.colorSpace=THREE.LinearSRGBColorSpace;this.targets[i]=t;}
    const next=this.mappedCamera(camera,room.data,entry.data,dest),f=frame(dest.room,dest.portal),plane=new THREE.Plane(V(f.n),-dotFrame(f)-.045);
    this.draws++;this.view(this.rooms.get(dest.room.id),next,depth+1,this.targets[i],plane,'walk');texture=this.targets[i].texture;
   }maps.push([entry,texture]);
  }
  for(const [entry,texture]of maps){entry.mesh.material.uniforms.view.value=texture;entry.mesh.material.uniforms.ready.value=texture?1:0;entry.rim.material.color.set(this.selected?.type==='portal'&&this.selected.id===entry.data.id?'#f1ffac':entry.data.color);entry.rim.visible=local(entry.frame,camera.position.toArray())[2]>0;entry.title.visible=mode!=='walk'&&entry.rim.visible;}
  room.ceiling.visible=mode==='walk';this.renderer.clippingPlanes=clip?[clip]:[];this.renderer.setRenderTarget(target);this.renderer.clear();this.renderer.render(room.scene,camera);
 }
 hit(clientX,clientY,roomId,floorOnly=false){const rect=this.canvas.getBoundingClientRect();this.pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);this.pick.setFromCamera(this.pointer,this.camera);const r=this.rooms.get(roomId),objects=floorOnly?[r.floor]:[...r.portals.map(p=>p.mesh),...r.objects,r.floor];const hits=this.pick.intersectObjects(objects,true);for(const h of hits){let o=h.object;while(o&&!o.userData.object&&!o.userData.portal&&!o.userData.floor)o=o.parent;if(o)return{portal:o.userData.portal,object:o.userData.object,floor:o.userData.floor,point:h.point.toArray()};}return null;}
 screenshot(){return this.canvas.toDataURL('image/png');}
 stats(){return{views:this.draws,targets:this.targets.length,triangles:this.renderer.info.render.triangles};}
}
function dotFrame(f){return f.n[0]*f.origin[0]+f.n[1]*f.origin[1]+f.n[2]*f.origin[2];}
