import * as THREE from './vendor/three.module.js';
import {THEMES,TERRAIN,ASSETS} from './catalog.js';
import {top,tileAt,footprint} from './model.js';
import {assetTemplate,buildProps,buildTerrain,entityMatrix} from './geometry.js';
import {configureCamera,fitView} from './camera.js';
import {sunState} from './lighting.js';

export function shadowBounds(bounds,direction){const out=bounds.clone();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const distance=(y+.48)/direction.y;out.expandByPoint(new THREE.Vector3(x-direction.x*distance,-.48,z-direction.z*distance));}return out;}

function lightScene(scene){
  const ambient=new THREE.HemisphereLight('#ffffff','#a0ab92',2.5),sun=new THREE.DirectionalLight('#fff5dd',3);
  sun.position.set(-12,24,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:.1,far:200});sun.shadow.bias=-.00015;sun.shadow.normalBias=.018;sun.shadow.radius=3;scene.add(ambient,sun,sun.target);return{ambient,sun};
}
function makeRenderer(canvas){const r=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.16;return r;}
export class MapRenderer{
  constructor(canvas){
    this.canvas=canvas;this.renderer=makeRenderer(canvas);this.renderer.shadowMap.autoUpdate=false;this.scene=new THREE.Scene();Object.assign(this,lightScene(this.scene));this.camera=new THREE.OrthographicCamera();this.content=new THREE.Group();this.scene.add(this.content);this.guides=new THREE.Group();this.scene.add(this.guides);this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.35);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.ShadowMaterial({color:'#64705b',opacity:.16,depthWrite:false}));this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-.48;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.terrainMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});this.yaw=Math.PI/4;this.yawTarget=this.yaw;this.dirty=true;this.last=performance.now();this.running=true;
    const frame=now=>{if(!this.running)return;const dt=Math.min(.1,(now-this.last)/1000);this.last=now;const diff=this.yawTarget-this.yaw;if(Math.abs(diff)>.0001){this.yaw+=diff*Math.min(1,dt*15);this.dirty=true;}else this.yaw=this.yawTarget;if(this.dirty&&this.view){this.updateCamera();this.renderer.render(this.scene,this.camera);this.dirty=false;}requestAnimationFrame(frame);};requestAnimationFrame(frame);
  }
  rebuild(project,omit=null){
    this.project=project;if(this.terrain){this.content.remove(this.terrain);this.terrain.geometry.dispose();}if(this.props){this.content.remove(this.props);this.props.children.forEach(m=>m.dispose());}
    const t=buildTerrain(project);this.terrain=new THREE.Mesh(t.geometry,this.terrainMaterial);this.terrain.userData.faceCells=t.faceCells;this.terrain.receiveShadow=true;this.terrain.castShadow=true;this.props=buildProps(project,omit);this.content.add(this.terrain,this.props);this.content.updateMatrixWorld(true);this.bounds=new THREE.Box3().setFromObject(this.content);if(this.bounds.isEmpty())this.bounds.set(new THREE.Vector3(-project.width/2,0,-project.depth/2),new THREE.Vector3(project.width/2,.35,project.depth/2));
    this.applyLighting(project);
  }
  applyLighting(project=this.project){
    this.project=project;const env=project.environment,state=sunState(env,project.theme),dir=new THREE.Vector3(state.direction.x,state.direction.y,state.direction.z),center=this.bounds.getCenter(new THREE.Vector3());this.sunDirection=dir;this.scene.background=new THREE.Color(env.background??THEMES[project.theme].background);this.sun.color.set(state.color);this.sun.intensity=state.intensity;this.ambient.intensity=state.ambient;this.ground.visible=env.groundShadow;this.sun.target.position.copy(center);this.sun.target.updateMatrixWorld();this.sun.position.copy(center).addScaledVector(dir,80);
    const az=env.azimuth*Math.PI/180,el=env.elevation*Math.PI/180,right=new THREE.Vector3(Math.cos(az),0,-Math.sin(az)),up=new THREE.Vector3(-Math.sin(az)*Math.sin(el),Math.cos(el),-Math.cos(az)*Math.sin(el));let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const x of [this.bounds.min.x,this.bounds.max.x])for(const y of [this.bounds.min.y,this.bounds.max.y])for(const z of [this.bounds.min.z,this.bounds.max.z]){const p=new THREE.Vector3(x,y,z).sub(center),xx=p.dot(right),yy=p.dot(up);minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);}
    Object.assign(this.sun.shadow.camera,{left:minX-2,right:maxX+2,bottom:minY-2,top:maxY+2});this.sun.shadow.camera.updateProjectionMatrix();this.scene.updateMatrixWorld(true);this.renderer.shadowMap.needsUpdate=true;this.dirty=true;
  }
  worldBounds(){return this.project.environment.groundShadow?shadowBounds(this.bounds,this.sunDirection):this.bounds;}
  resize(view,inset=0){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.inset=inset;this.renderer.setSize(this.width,this.height,false);this.setView(view,true);}
  setView(view,immediate=false){this.view=view;let target=Math.PI/4+view.quarter*Math.PI/2;while(target-this.yaw>Math.PI)target-=Math.PI*2;while(target-this.yaw<-Math.PI)target+=Math.PI*2;this.yawTarget=target;if(immediate)this.yaw=target;this.updateCamera();this.dirty=true;}
  updateCamera(){configureCamera(this.camera,this.view,this.width,this.height,this.inset,this.yaw);}
  fitted(quarter=0){return fitView(this.worldBounds(),quarter,Math.max(160,this.width-this.inset-(this.width<620?24:80))/this.height);}
  cast(x,y){const rect=this.canvas.getBoundingClientRect();this.pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);this.updateCamera();this.ray.setFromCamera(this.pointer,this.camera);}
  groundPoint(x,y){this.cast(x,y);return this.ray.ray.intersectPlane(this.plane,new THREE.Vector3());}
  pick(x,y,groundOnly=false){
    this.cast(x,y);const hits=this.ray.intersectObjects(groundOnly?[this.terrain]:[this.terrain,...this.props.children],false);let cell=null,id=null,point;
    if(hits.length){const h=hits[0];point=h.point;if(h.object===this.terrain)cell=h.object.userData.faceCells[h.faceIndex];else{id=h.object.userData.ids[h.instanceId];const e=this.project.props.find(e=>e.id===id),cells=footprint(e);cell=cells.find(c=>c.x===Math.floor(point.x+this.project.width/2)&&c.z===Math.floor(point.z+this.project.depth/2))??cells[0];}}
    if(!cell){point=this.ray.ray.intersectPlane(this.plane,new THREE.Vector3());if(!point)return null;cell={x:Math.floor(point.x+this.project.width/2),z:Math.floor(point.z+this.project.depth/2)};}
    if(cell.x<0||cell.z<0||cell.x>=this.project.width||cell.z>=this.project.depth)return null;return{x:cell.x,z:cell.z,id,point};
  }
  projectPoint(x,z,y=null){const p=new THREE.Vector3(x+.5-this.project.width/2,y??top(tileAt(this.project,x,z)??{material:'grass',height:0}),z+.5-this.project.depth/2).project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};}
  clearGuides(){for(const c of [...this.guides.children]){this.guides.remove(c);c.traverse(o=>{if(o.userData.guideGeometry)o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});}this.dirty=true;}
  showGuides(cells=[],entity=null,valid=true,selected=null){
    this.clearGuides();const outline=(list,color)=>{const vertices=[];for(const c of list){if(c.x<0||c.z<0||c.x>=this.project.width||c.z>=this.project.depth)continue;const y=(tileAt(this.project,c.x,c.z)?top(tileAt(this.project,c.x,c.z)):.35)+.025,x=c.x-this.project.width/2,z=c.z-this.project.depth/2;for(const [a,b]of [[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[0,1]],[[0,1],[0,0]]])vertices.push(x+a[0],y,z+a[1],x+b[0],y,z+b[1]);}const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),m=new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.85});const lines=new THREE.LineSegments(g,m);lines.userData.guideGeometry=true;lines.renderOrder=20;this.guides.add(lines);};
    if(selected)outline(footprint(selected),'#fbf7d8');if(cells.length)outline(cells,valid?'#ffffff':'#b85145');
    if(entity){const ghost=assetTemplate(entity.type,entity.tint,entity.size).clone();ghost.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=valid?.43:.3;if(!valid)o.material.color.set('#cf6c59');o.material.depthWrite=false;o.castShadow=false;o.receiveShadow=false;}});ghost.matrix.copy(entityMatrix(this.project,entity));if(!valid)ghost.matrix.elements[13]=tileAt(this.project,entity.x,entity.z)?top(tileAt(this.project,entity.x,entity.z)):.35;ghost.matrixAutoUpdate=false;this.guides.add(ghost);}
    this.dirty=true;
  }
  async exportPNG(size,transparent){
    const canvas=document.createElement('canvas'),r=makeRenderer(canvas);r.setPixelRatio(1);r.setSize(size,size,false);this.scene.updateMatrixWorld(true);const scene=this.scene.clone(true),guides=scene.children[this.scene.children.indexOf(this.guides)];guides.visible=false;if(transparent){scene.background=null;r.setClearColor(0,0);}const camera=new THREE.OrthographicCamera();configureCamera(camera,fitView(this.worldBounds(),this.view.quarter,1),size,size,0);try{r.render(scene,camera);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the PNG.')),'image/png'));}finally{scene.traverse(o=>{if(o.isLight)o.shadow?.dispose();});r.dispose();r.forceContextLoss();}
  }
}
export function thumbnails(){
  const canvas=document.createElement('canvas'),r=makeRenderer(canvas);r.setPixelRatio(1);r.setSize(144,120,false);r.shadowMap.enabled=false;const result={},scene=new THREE.Scene();lightScene(scene);const camera=new THREE.OrthographicCamera();
  for(const [type,a]of Object.entries(ASSETS)){const model=assetTemplate(type).clone();scene.add(model);const b=new THREE.Box3().setFromObject(model),view=fitView(b,0,1.2);view.span=Math.max(1.6,view.span*.7);configureCamera(camera,view,144,120);r.render(scene,camera);result[type]=canvas.toDataURL();scene.remove(model);}
  r.dispose();r.forceContextLoss();return result;
}
