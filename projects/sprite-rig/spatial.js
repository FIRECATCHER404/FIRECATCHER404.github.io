// Right-handed world: X right, Y down, Z away from the front camera.
export const V=(x=0,y=0,z=0)=>({x,y,z});
export const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
export const mul=(a,n)=>V(a.x*n,a.y*n,a.z*n);
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const unit=(a,fallback=V(1,0,0))=>length(a)>1e-10?mul(a,1/length(a)):{...fallback};
export const Q=()=>[0,0,0,1];
export function qUnit(q){const l=Math.hypot(...q);return l>1e-10?q.map(v=>v/l):Q();}
export const qInverse=q=>[-q[0],-q[1],-q[2],q[3]];
export function qMul(a,b){return qUnit([a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]);}
export function rotate(q,p){const u=V(q[0],q[1],q[2]),t=mul(cross(u,p),2);return add(p,add(mul(t,q[3]),cross(u,t)));}
export function axisAngle(axis,angle){const u=unit(axis),s=Math.sin(angle/2);return[u.x*s,u.y*s,u.z*s,Math.cos(angle/2)];}
export function fromTo(a,b){a=unit(a);b=unit(b);const d=Math.max(-1,Math.min(1,dot(a,b)));if(d<-.999999){const perpendicular=cross(a,Math.abs(a.x)<.8?V(1,0,0):V(0,1,0));return axisAngle(perpendicular,Math.PI);}const c=cross(a,b);return qUnit([c.x,c.y,c.z,1+d]);}
export function fromEuler(x,y,z){return qMul(axisAngle(V(0,0,1),z),qMul(axisAngle(V(0,1,0),y),axisAngle(V(1,0,0),x)));}
export function toEuler(q){const [x,y,z,w]=q;return V(Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y)),Math.asin(Math.max(-1,Math.min(1,2*(w*y-z*x)))),Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z)));}
export function slerp(a,b,t){let d=a.reduce((n,v,i)=>n+v*b[i],0);if(d<0){b=b.map(v=>-v);d=-d;}if(d>.9995)return qUnit(a.map((v,i)=>v+(b[i]-v)*t));const theta=Math.acos(Math.max(-1,Math.min(1,d))),s=Math.sin(theta);return a.map((v,i)=>(v*Math.sin((1-t)*theta)+b[i]*Math.sin(t*theta))/s);}
export const DEFAULT_CAMERA={target:V(128,160,0),yaw:.42,pitch:.24,distance:600};
export function validateCamera(value,fallback=DEFAULT_CAMERA){if(value===undefined)return structuredClone(fallback);if(!value||!value.target||![value.target.x,value.target.y,value.target.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6)||!Number.isFinite(value.yaw)||Math.abs(value.yaw)>Math.PI*100||!Number.isFinite(value.pitch)||Math.abs(value.pitch)>Math.PI/2||!Number.isFinite(value.distance)||value.distance<5||value.distance>1e6)throw new Error('Invalid saved 3D camera.');return{target:{...value.target},yaw:value.yaw,pitch:Math.max(-Math.PI/2+.001,Math.min(Math.PI/2-.001,value.pitch)),distance:value.distance};}
export function cameraBasis(camera,width,height){const sy=Math.sin(camera.yaw),cy=Math.cos(camera.yaw),sp=Math.sin(camera.pitch),cp=Math.cos(camera.pitch),eye=add(camera.target,mul(V(sy*cp,-sp,-cy*cp),camera.distance)),forward=unit(sub(camera.target,eye)),right=V(cy,0,sy),down=unit(cross(forward,right));return{eye,forward,right,down,focal:camera.focal??height/(2*Math.tan(21*Math.PI/180)),originX:camera.originX??width/2,originY:camera.originY??height/2,near:Math.max(.05,camera.distance/2000),far:Math.max(10000,camera.distance*100)};}
export function projectPoint(point,camera,width,height){return projectWithBasis(point,cameraBasis(camera,width,height));}
export function projectWithBasis(point,basis){const p=sub(point,basis.eye),depth=dot(p,basis.forward);if(depth<=basis.near)return null;return{x:basis.originX+dot(p,basis.right)*basis.focal/depth,y:basis.originY+dot(p,basis.down)*basis.focal/depth,depth};}
export function screenOnPlane(point,anchor,camera,width,height){const b=cameraBasis(camera,width,height),ray=unit(add(b.forward,add(mul(b.right,(point.x-b.originX)/b.focal),mul(b.down,(point.y-b.originY)/b.focal)))),den=dot(ray,b.forward),t=dot(sub(anchor,b.eye),b.forward)/den;return add(b.eye,mul(ray,t));}
export function fitCamera(points,width,height,previous=DEFAULT_CAMERA){if(!points.length)return structuredClone(previous);const min=V(Infinity,Infinity,Infinity),max=V(-Infinity,-Infinity,-Infinity);for(const p of points)for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],p[axis]);max[axis]=Math.max(max[axis],p[axis]);}const target=mul(add(min,max),.5),radius=Math.max(16,...points.map(p=>length(sub(p,target)))),aspect=Math.min(1,width/Math.max(1,height)),distance=Math.max(50,Math.min(1e6,radius/(Math.sin(21*Math.PI/180)*aspect)*1.28));return{target,yaw:previous.yaw,pitch:previous.pitch,distance};}
