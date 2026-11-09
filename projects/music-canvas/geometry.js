export const TYPES={circle:'Circle',square:'Square',triangle:'Triangle',hexagon:'Hexagon'};
export function vertices(s){if(s.type==='circle')return null;const n=s.type==='triangle'?3:s.type==='square'?4:6,start=s.angle*Math.PI/180+(s.type==='square'?Math.PI/4:-Math.PI/2);return Array.from({length:n},(_,i)=>({x:s.x+Math.cos(start+i*Math.PI*2/n)*s.radius,y:s.y+Math.sin(start+i*Math.PI*2/n)*s.radius}));}
export function extents(s){const v=vertices({...s,x:0,y:0});return v?{left:-Math.min(...v.map(p=>p.x)),right:Math.max(...v.map(p=>p.x)),top:-Math.min(...v.map(p=>p.y)),bottom:Math.max(...v.map(p=>p.y))}:{left:s.radius,right:s.radius,top:s.radius,bottom:s.radius};}
const dot=(p,a)=>p.x*a.x+p.y*a.y;
function axes(v){return v.map((p,i)=>{const q=v[(i+1)%v.length],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy);return{x:-dy/l,y:dx/l};});}
function project(s,v,a){if(!v){const c=dot(s,a);return[c-s.radius,c+s.radius];}const values=v.map(p=>dot(p,a));return[Math.min(...values),Math.max(...values)];}
export function overlaps(a,b){
  const dx=a.x-b.x,dy=a.y-b.y;if(dx*dx+dy*dy>(a.radius+b.radius+1e-7)**2)return false;if(a.type==='circle'&&b.type==='circle')return dx*dx+dy*dy<=(a.radius+b.radius+1e-7)**2;
  const av=vertices(a),bv=vertices(b),all=[...(av?axes(av):[]),...(bv?axes(bv):[])];
  if(!av||!bv){const c=av?b:a,v=av??bv,nearest=v.reduce((best,p)=>Math.hypot(p.x-c.x,p.y-c.y)<Math.hypot(best.x-c.x,best.y-c.y)?p:best),x=nearest.x-c.x,y=nearest.y-c.y,l=Math.hypot(x,y);if(l>1e-9)all.push({x:x/l,y:y/l});}
  return all.every(axis=>{const x=project(a,av,axis),y=project(b,bv,axis);return x[0]<=y[1]+1e-7&&y[0]<=x[1]+1e-7;});
}
export function contains(s,p){if(s.type==='circle')return Math.hypot(p.x-s.x,p.y-s.y)<=s.radius;const v=vertices(s);let sign=0;for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length],cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(Math.abs(cross)<1e-8)continue;const next=Math.sign(cross);if(sign&&sign!==next)return false;sign=next;}return true;}
export function reflectAxis(position,velocity,dt,lo,hi){const length=hi-lo,raw=position+velocity*dt,phase=((raw-lo)%(2*length)+2*length)%(2*length);let value=phase<=length?lo+phase:hi-(phase-length),v=phase<=length?velocity:-velocity;if(value<=lo+1e-8&&v<0)v=-v;if(value>=hi-1e-8&&v>0)v=-v;return{value,velocity:v,bounced:raw<lo-1e-8||raw>hi+1e-8||v!==velocity};}
