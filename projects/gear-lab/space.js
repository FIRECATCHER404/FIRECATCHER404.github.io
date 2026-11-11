export const V=(x=0,y=0,z=0)=>({x,y,z});
export const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z),sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z),mul=(p,s)=>V(p.x*s,p.y*s,p.z*s),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x),length=p=>Math.hypot(p.x,p.y,p.z);
export const Q=a=>({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)}),inverse=q=>({x:-q.x,y:-q.y,z:-q.z,w:q.w});
export const multiply=(a,b)=>({x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z});
export function rotate(q,p){const v=V(q.x,q.y,q.z),t=mul(cross(v,p),2);return add(p,add(mul(t,q.w),cross(v,t)));}
export const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const FLOOR_Y=-.5,FLOOR_SIZE=6,WALL_THICKNESS=.06;
export const normal=p=>V(p.axis==='x'?p.sign:0,p.axis==='y'?p.sign:0,p.axis==='z'?p.sign:0);
export function mountRotation(p){const h=Math.SQRT1_2;if(p.axis==='x')return{x:0,y:p.sign*h,z:0,w:h};if(p.axis==='y')return{x:-p.sign*h,y:0,z:0,w:h};return p.sign===1?Q(0):{x:0,y:1,z:0,w:0};}
export const mountPoint=(p,d=0)=>add(p,mul(normal(p),d));
export const gearPoint=(p,g)=>mountPoint(p,.06+g.layer*.05);
export function wallSize(w){return w.axis==='xy'?V(w.width,w.height,WALL_THICKNESS):w.axis==='yz'?V(WALL_THICKNESS,w.height,w.width):V(w.width,WALL_THICKNESS,w.height);}
export function wallOnFloor(id,axis,point,width=1.4,height=1,elevation=0){return{id,axis,x:point.x,y:axis==='xz'?point.y+elevation+WALL_THICKNESS/2:point.y+elevation+height/2,z:point.z,width,height};}
export function mountedOnSurface(peg,walls,tolerance=.0001){
 if(peg.surface==='floor')return peg.axis==='y'&&peg.sign===1&&Math.abs(peg.y-FLOOR_Y)<tolerance&&Math.abs(peg.x)<=FLOOR_SIZE/2-.025&&Math.abs(peg.z)<=FLOOR_SIZE/2-.025;
 const w=walls.find(w=>w.id===peg.surface);if(!w)return false;const size=wallSize(w),axis=peg.axis;if(Math.abs(peg[axis]-w[axis]-peg.sign*size[axis]/2)>tolerance)return false;
 return ['x','y','z'].filter(k=>k!==axis).every(k=>Math.abs(peg[k]-w[k])<=size[k]/2-.015+tolerance);
}
export function sameMountPlane(a,b){return a.axis===b.axis&&a.sign===b.sign&&Math.abs(dot(sub(a,b),normal(a)))<.0001;}
export function moveMount(scene,id,delta){const wall=scene.walls.find(w=>w.id===id);if(wall){for(const k of['x','y','z'])wall[k]+=delta[k];for(const p of scene.pegs.filter(p=>p.surface===id))for(const k of['x','y','z'])p[k]+=delta[k];return;}const peg=scene.pegs.find(p=>p.id===id);if(peg)for(const k of['x','y','z'])peg[k]+=delta[k];}
