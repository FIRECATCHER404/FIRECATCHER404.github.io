import{V,add,sub,mul,dot,cross,length,rotate,multiply}from'./space.js?v=5';

export const CAMERA_FOV=45,DEFAULT_DISTANCE=1.12/Math.tan(CAMERA_FOV*Math.PI/360);
const unit=v=>mul(v,1/Math.max(1e-12,length(v))),identity=()=>({x:0,y:0,z:0,w:1});
const normalized=q=>{const n=Math.hypot(q.x,q.y,q.z,q.w);return{x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n};};
function between(a,b){
 const w=1+dot(a,b);if(w<1e-7){const axis=unit(Math.abs(a.x)>.9?cross(a,V(0,1,0)):cross(a,V(1,0,0)));return{...axis,w:0};}
 return normalized({...cross(a,b),w});
}
function ball(p,r){
 const size=Math.max(1,Math.min(r.width,r.height)),x=(2*(p.x-r.left)-r.width)/size,y=(r.height-2*(p.y-r.top))/size,s=x*x+y*y;
 return unit(V(x,y,s<=.5?Math.sqrt(1-s):.5/Math.sqrt(s)));
}
export class CameraRig{
 constructor(){this.center=V(0,-.15,0);this.distance=DEFAULT_DISTANCE;this.rotation=identity();this.orient(-.55,.62);}
 orient(yaw=0,pitch=0){this.rotation=multiply({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},{x:-Math.sin(pitch/2),y:0,z:0,w:Math.cos(pitch/2)});}
 get backward(){return rotate(this.rotation,V(0,0,1));}
 get forward(){return mul(this.backward,-1);}
 get up(){return rotate(this.rotation,V(0,1,0));}
 get right(){return rotate(this.rotation,V(1,0,0));}
 get position(){return add(this.center,mul(this.backward,this.distance));}
 get yaw(){const b=this.backward;return Math.atan2(b.x,b.z);}
 get pitch(){return Math.asin(Math.max(-1,Math.min(1,this.backward.y)));}
 get zoom(){return DEFAULT_DISTANCE/this.distance;}
 isFront(){return Math.abs(this.rotation.w)>1-1e-8;}
 orbit(start,end,rect,initial=this.rotation){this.rotation=normalized(multiply(initial,between(ball(end,rect),ball(start,rect))));}
 pan(dx,dy,height,initial=this.center){const scale=2*this.distance*Math.tan(CAMERA_FOV*Math.PI/360)/Math.max(1,height);this.center=add(initial,add(mul(this.right,-dx*scale),mul(this.up,dy*scale)));}
 dolly(factor){if(Number.isFinite(factor)&&factor>0)this.distance=Math.max(.035,Math.min(300,this.distance*factor));}
 wheel(delta,mode=0,height=800){const pixels=delta*(mode===1?16:mode===2?height:1);this.dolly(Math.exp(Math.max(-1000,Math.min(1000,pixels))*.0012));}
 fit(points,aspect=1){
  if(!points.length){this.center=V(0,-.15,0);this.distance=DEFAULT_DISTANCE;return;}
  this.center=V(...['x','y','z'].map(k=>(Math.min(...points.map(p=>p[k]))+Math.max(...points.map(p=>p[k])))/2));
  const tan=Math.tan(CAMERA_FOV*Math.PI/360),right=this.right,up=this.up,back=this.backward;
  this.distance=Math.max(.6,...points.map(p=>{const d=sub(p,this.center);return dot(d,back)+Math.max(Math.abs(dot(d,right))/(tan*Math.max(.1,aspect)),Math.abs(dot(d,up))/tan)+.15;}));
 }
 snapshot(){return{yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,distance:this.distance,center:{...this.center},position:this.position,forward:this.forward,up:this.up,rotation:{...this.rotation},fov:CAMERA_FOV};}
}
