import * as THREE from './vendor/three.module.js';
export const ELEVATION=Math.atan(1/Math.sqrt(2));
export const defaultView=()=>({quarter:0,span:15,target:{x:0,y:.6,z:0}});
export function configureCamera(camera,view,width,height,inset=0,yaw=null){
  const angle=yaw??Math.PI/4+view.quarter*Math.PI/2,span=view.span,aspect=width/height,shift=inset/2*span/height;
  camera.left=-span*aspect/2-shift;camera.right=span*aspect/2-shift;camera.top=span/2;camera.bottom=-span/2;camera.near=.1;camera.far=500;
  const t=view.target,cp=Math.cos(ELEVATION);camera.position.set(t.x+Math.sin(angle)*cp*80,t.y+Math.sin(ELEVATION)*80,t.z+Math.cos(angle)*cp*80);camera.lookAt(t.x,t.y,t.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
export function fitView(box,quarter,aspect){
  if(box.isEmpty())return defaultView();const center=box.getCenter(new THREE.Vector3()),angle=Math.PI/4+quarter*Math.PI/2,right=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle)),up=new THREE.Vector3(-Math.sin(angle)*Math.sin(ELEVATION),Math.cos(ELEVATION),-Math.cos(angle)*Math.sin(ELEVATION));let w=0,h=0;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const d=new THREE.Vector3(x,y,z).sub(center);w=Math.max(w,Math.abs(d.dot(right))*2);h=Math.max(h,Math.abs(d.dot(up))*2);}
  return{quarter,span:Math.max(4,Math.min(150,Math.max(h,w/aspect)*1.22)),target:{x:center.x,y:center.y,z:center.z}};
}
export function checkedView(v){if(!v)return defaultView();if(!Number.isInteger(v.quarter)||v.quarter<0||v.quarter>3||!Number.isFinite(v.span)||v.span<4||v.span>150||!v.target||!['x','y','z'].every(k=>Number.isFinite(v.target[k])&&Math.abs(v.target[k])<=250))throw Error('Invalid saved view.');return{quarter:v.quarter,span:v.span,target:{x:v.target.x,y:v.target.y,z:v.target.z}};}
