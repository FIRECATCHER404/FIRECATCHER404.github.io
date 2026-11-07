import * as M from './geometry.js?v=2';

function random(seed){let x=seed|0;return()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const inside=(faces,p)=>faces.every(f=>M.dot(M.unit(M.cross(M.sub(f[1],f[0]),M.sub(f[2],f[0]))),M.sub(p,f[0]))<1e-7);
function pointsIn(faces,count,rng){
  const points=M.uniquePoints(faces),lo=M.V(...['x','y','z'].map(a=>Math.min(...points.map(p=>p[a])))),hi=M.V(...['x','y','z'].map(a=>Math.max(...points.map(p=>p[a])))),out=[];
  for(let tries=0;tries<6000&&out.length<count;tries++){const p=M.V(...['x','y','z'].map(a=>lo[a]+rng()*(hi[a]-lo[a])));if(inside(faces,p)&&out.every(q=>M.length(M.sub(p,q))>1e-4))out.push(p);}
  return out;
}
export function voronoi(faces,count,seed,grain=false){
  const sites=pointsIn(faces,count,random(seed)),weight=grain?M.V(1,.12,1):M.V(1,1,1),metric=p=>M.V(p.x*weight.x,p.y*weight.y,p.z*weight.z),square=p=>M.dot(p,metric(p)),out=[];
  for(let i=0;i<sites.length;i++){let cell=faces;for(let j=0;j<sites.length&&cell;j++)if(i!==j){const n=metric(M.sub(sites[j],sites[i]));cell=M.clipPoly(cell,n,(square(sites[j])-square(sites[i]))/2);}if(cell)out.push(cell);}
  return out;
}
export function fractureGeometry(faces,{point,normal,energy,toughness,material,seed=1,manual=false}){
  const radius=M.polyRadius(faces),volume=M.volumeProperties(faces).volume,parentArea=M.surfaceArea(faces),n=M.unit(normal),surface=M.dot(point,n),ratio=energy/Math.max(1e-9,toughness*radius*radius);
  if(radius<.12||volume<.004)return null;
  // A shallow struck cap chips first. Stronger hits reach into the intact core.
  for(let attempt=0;attempt<6;attempt++){
    const fraction=manual?2.2:Math.min(2.2,(.10+Math.sqrt(ratio)*.18)*(.68**attempt)),depth=radius*fraction,offset=surface-depth;
    const core=M.clipPoly(faces,n,offset),cap=M.clipPoly(faces,M.mul(n,-1),-offset);if(!cap)continue;
    const count=manual?9:Math.max(2,Math.min(material==='glass'?18:material==='ice'?13:8,Math.floor(2+Math.sqrt(ratio)*2)))-Math.min(attempt,2);
    const split=voronoi(cap,Math.max(2,count),seed,material==='wood'),polys=[...(core?[core]:[]),...split];if(polys.length<2)continue;
    const total=polys.reduce((sum,f)=>sum+M.volumeProperties(f).volume,0);if(Math.abs(total-volume)>volume*1e-5)continue;
    if(polys.some(f=>M.volumeProperties(f).volume<volume*.0001))continue;
    const newArea=Math.max(0,(polys.reduce((sum,f)=>sum+M.surfaceArea(f),0)-parentArea)/2),cost=newArea*toughness;
    if(!manual&&cost>energy)continue;
    return{cells:polys.map((poly,id)=>{const p=M.volumeProperties(poly);return{id,volume:p.volume,offset:p.center,faces:poly.map(f=>f.map(v=>M.sub(v,p.center)))};}),newArea,cost,depth};
  }
  return null;
}
