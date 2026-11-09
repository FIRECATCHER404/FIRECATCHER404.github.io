// Room-local coordinates keep the building's topology independent of its layout.
export const WALLS=['north','east','south','west'];
export const SHAPES=['tarp','rectangle','arch','oval'];
export const PROPS=['plinth','orb','column','bench','plant','stairs','ring'];
export const clone=x=>structuredClone(x);
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const mul=(a,s)=>a.map(v=>v*s);
export const sub=(a,b)=>add(a,mul(b,-1));
export function frame(room,p){
  const i=WALLS.indexOf(p.wall),n=[[0,0,1],[-1,0,0],[0,0,-1],[1,0,0]][i],right=[[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]][i];
  const edge=[[0,0,-room.depth/2],[room.width/2,0,0],[0,0,room.depth/2],[-room.width/2,0,0]][i];
  return{n,right,up:[0,1,0],origin:add(add(edge,mul(right,p.u)),[0,p.base+p.height/2,0])};
}
export function local(f,pos){const v=sub(pos,f.origin);return[dot(v,f.right),v[1],dot(v,f.n)];}
export function world(f,p){return add(f.origin,add(add(mul(f.right,p[0]),[0,p[1],0]),mul(f.n,p[2])));}
export function polygon(p){
  if(p.shape==='oval')return Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return[Math.cos(a)*p.width/2,Math.sin(a)*p.height/2];});
  if(p.shape==='arch'){
    const r=Math.min(p.width/2,p.height*.48),cy=p.height/2-r;
    return[[-p.width/2,-p.height/2],[p.width/2,-p.height/2],[p.width/2,cy],...Array.from({length:25},(_,i)=>{const a=i/24*Math.PI;return[Math.cos(a)*p.width/2,cy+Math.sin(a)*r];})];
  }
  return(p.shape==='tarp'?p.corners:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]).map(([x,y])=>[x*p.width,y*p.height]);
}
export function inside(poly,x,y){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if(((b>y)!==(d>y))&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;}
export function convex(points){let sign=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],c=points[(i+2)%points.length],v=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(v)<.005)return false;if(sign&&Math.sign(v)!==sign)return false;sign=Math.sign(v);}return sign>0;}
export function ratio(source,target){return source.scale?target.width/source.width:1;}
export function mapPoint(sourceRoom,source,targetRoom,target,pos){const a=local(frame(sourceRoom,source),pos),s=ratio(source,target);return world(frame(targetRoom,target),[-a[0]*s,(a[1]+source.height/2)*s-target.height/2,-a[2]*s]);}
export function mapVector(sourceRoom,source,targetRoom,target,v){const a=frame(sourceRoom,source),b=frame(targetRoom,target);return add(add(mul(b.right,-dot(v,a.right)),[0,v[1],0]),mul(b.n,-dot(v,a.n)));}
export const wallSpan=(r,p)=>['north','south'].includes(p.wall)?r.width:r.depth;
export function fitPortal(r,p){p.width=clamp(p.width,.7,wallSpan(r,p)-.3);p.height=clamp(p.height,1,r.height-.12);p.u=clamp(p.u,-wallSpan(r,p)/2+p.width/2+.08,wallSpan(r,p)/2-p.width/2-.08);p.base=clamp(p.base,0,r.height-p.height-.06);return p;}
export function aperture(room,p,pos,radius=.2,height=1.7){
  const q=local(frame(room,p),pos),poly=polygon(p);
  return[-radius,radius].every(dx=>[.07-height,height*.06].every(dy=>inside(poly,q[0]+dx,q[1]+dy)));
}
export function portalAt(project,roomId,id){return project.rooms.find(r=>r.id===roomId)?.portals.find(p=>p.id===id);}
export function destination(project,p){if(!p.link)return null;const room=project.rooms.find(r=>r.id===p.link.room),portal=room?.portals.find(x=>x.id===p.link.portal);return room&&portal?{room,portal}:null;}
export function portalCrossing(project,room,from,to,body){
  let best=null;
  for(const p of room.portals){const f=frame(room,p),a=local(f,from),b=local(f,to),target=destination(project,p);if(!target||a[2]<-.001||b[2]>.00001||a[2]===b[2])continue;
    const t=a[2]/(a[2]-b[2]),hit=add(from,mul(sub(to,from),t));if(!aperture(room,p,hit,body.radius,body.height))continue;
    const newScale=body.scale*ratio(p,target.portal);if(newScale<.15||newScale>5)continue;
    const mapped=mapPoint(room,p,target.room,target.portal,to),f2=frame(target.room,target.portal),r=.2*newScale,h=1.65*newScale;
    // A connection can be seen through even when its exit cannot fit the visitor.
    if(target.room.height<h+.2*newScale||!aperture(target.room,target.portal,mapPoint(room,p,target.room,target.portal,hit),r,h)||target.room.props.some(o=>collidesProp(o,mapped,r,h)))continue;
    if(!best||t<best.t)best={t,source:p,room:target.room,portal:target.portal,scale:newScale,position:add(mapped,mul(f2.n,.035))};
  }return best;
}
export function moveVisitor(project,state,delta){
  let room=project.rooms.find(r=>r.id===state.room),pos=state.position;
  const target=add(pos,delta),cross=portalCrossing(project,room,pos,target,{scale:state.scale,radius:.2*state.scale,height:1.65*state.scale});
  if(cross){const forward=[-Math.sin(state.yaw),0,-Math.cos(state.yaw)],v=mapVector(room,cross.source,cross.room,cross.portal,forward);state.yaw=Math.atan2(-v[0],-v[2]);state.scale=cross.scale;state.position=cross.position;state.room=cross.room.id;state.crossings++;state.lastPortal=cross.source.id;room=cross.room;}
  else{
    const radius=.2*state.scale;
    for(const axis of [0,2]){
      const candidate=[...pos];candidate[axis]=target[axis];let permit=false;
      for(const p of room.portals){if(!destination(project,p)||(axis===0?!['east','west'].includes(p.wall):!['north','south'].includes(p.wall)))continue;const q=local(frame(room,p),candidate);if(q[2]>=-.002&&aperture(room,p,candidate,radius,1.65*state.scale))permit=true;}
      const bound=(axis===0?room.width:room.depth)/2;
      candidate[axis]=clamp(candidate[axis],-bound+(permit?0:radius),bound-(permit?0:radius));
      if(!room.props.some(o=>collidesProp(o,candidate,radius,1.65*state.scale)))pos=candidate;
    }
    const nextY=state.fly?clamp(target[1],1.65*state.scale,room.height-.15*state.scale):1.65*state.scale;
    if(!state.fly||!room.props.some(o=>collidesProp(o,[pos[0],nextY,pos[2]],radius,1.65*state.scale)))pos[1]=nextY;
    state.position=pos;
  }
  const r=.2*state.scale;state.position[0]=clamp(state.position[0],-room.width/2+r*.05,room.width/2-r*.05);state.position[2]=clamp(state.position[2],-room.depth/2+r*.05,room.depth/2-r*.05);state.position[1]=clamp(state.position[1],1.65*state.scale,room.height-.1*state.scale);
  return cross;
}
export function collidesProp(o,pos,r,height=1.65){if(!o.solid)return false;const a=o.angle*Math.PI/180,dx=pos[0]-o.x,dz=pos[2]-o.z,x=Math.cos(a)*dx-Math.sin(a)*dz,z=Math.sin(a)*dx+Math.cos(a)*dz,[w,d,h]={plinth:[.56,.56,1.18],orb:[.48,.48,1.09],column:[.49,.49,2.44],bench:[.8,.32,.64],plant:[.5,.5,1.9],stairs:[.5,1,.86],ring:[.68,.55,1.55]}[o.type];return Math.abs(x)<o.size*w+r&&Math.abs(z)<o.size*d+r&&pos[1]+height*.06>o.y&&pos[1]-height<o.y+o.size*h;}
export function visitor(room){return{room:room.id,position:[0,1.65,Math.min(room.depth/2-1,room.depth*.32)],yaw:0,pitch:0,scale:1,fly:false,crossings:0,lastPortal:null};}
