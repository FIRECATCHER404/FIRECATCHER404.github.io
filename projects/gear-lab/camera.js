import{V,add,sub,mul,dot,rotate,multiply}from'./space.js?v=6';

export const CAMERA_FOV=45,DEFAULT_DISTANCE=1.12/Math.tan(CAMERA_FOV*Math.PI/360),LOOK_SPEED=.005,PITCH_LIMIT=Math.PI/2-.01;
export class CameraRig{
 constructor(){this.center=V(0,-.15,0);this.distance=DEFAULT_DISTANCE;this.rotation={x:0,y:0,z:0,w:1};this.orient(-.55,.62);}
 orient(yaw=0,pitch=0){this._yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));this._pitch=Math.max(-PITCH_LIMIT,Math.min(PITCH_LIMIT,pitch));yaw=this._yaw;pitch=this._pitch;this.rotation=multiply({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},{x:-Math.sin(pitch/2),y:0,z:0,w:Math.cos(pitch/2)});}
 get backward(){return rotate(this.rotation,V(0,0,1));}
 get forward(){return mul(this.backward,-1);}
 get up(){return rotate(this.rotation,V(0,1,0));}
 get right(){return rotate(this.rotation,V(1,0,0));}
 get position(){return add(this.center,mul(this.backward,this.distance));}
 get yaw(){return this._yaw;}
 get pitch(){return this._pitch;}
 get zoom(){return DEFAULT_DISTANCE/this.distance;}
 isFront(){return Math.abs(this.rotation.w)>1-1e-8;}
 look(start,end,initial=this.snapshot()){
  this.orient(initial.yaw-(end.x-start.x)*LOOK_SPEED,initial.pitch+(end.y-start.y)*LOOK_SPEED);
  this.center=sub(initial.position,mul(this.backward,this.distance));
 }
 pan(dx,dy,height,initial=this.center){const scale=2*this.distance*Math.tan(CAMERA_FOV*Math.PI/360)/Math.max(1,height);this.center=add(initial,add(mul(this.right,-dx*scale),mul(this.up,dy*scale)));}
 dolly(factor){if(Number.isFinite(factor)&&factor>0)this.distance=Math.max(.035,Math.min(300,this.distance*factor));}
 wheel(delta,mode=0,height=800){const pixels=delta*(mode===1?16:mode===2?height:1);const travel=Math.max(-1000,Math.min(1000,pixels))*.0012*Math.max(.05,this.distance);this.center=add(this.center,mul(this.backward,travel));}
 fit(points,aspect=1){
  if(!points.length){this.center=V(0,-.15,0);this.distance=DEFAULT_DISTANCE;return;}
  this.center=V(...['x','y','z'].map(k=>(Math.min(...points.map(p=>p[k]))+Math.max(...points.map(p=>p[k])))/2));
  const tan=Math.tan(CAMERA_FOV*Math.PI/360),right=this.right,up=this.up,back=this.backward;
  this.distance=Math.max(.6,...points.map(p=>{const d=sub(p,this.center);return dot(d,back)+Math.max(Math.abs(dot(d,right))/(tan*Math.max(.1,aspect)),Math.abs(dot(d,up))/tan)+.15;}));
 }
 snapshot(){return{yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,distance:this.distance,center:{...this.center},position:this.position,forward:this.forward,up:this.up,right:this.right,rotation:{...this.rotation},fov:CAMERA_FOV};}
}
