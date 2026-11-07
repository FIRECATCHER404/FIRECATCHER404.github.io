export const V=(x=0,y=0,z=0)=>({x,y,z});
export const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z),sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z),mul=(a,s)=>V(a.x*s,a.y*s,a.z*s),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x),length=a=>Math.hypot(a.x,a.y,a.z),unit=(a,fallback=V(1,0,0))=>length(a)>1e-10?mul(a,1/length(a)):{...fallback};
export const Q=(x=0,y=0,z=0,w=1)=>({x,y,z,w});
export function normalizeQ(q){const n=Math.hypot(q.x,q.y,q.z,q.w);return Q(q.x/n,q.y/n,q.z/n,q.w/n);}
export const inverseQ=q=>Q(-q.x,-q.y,-q.z,q.w);
export function multiplyQ(a,b){return normalizeQ(Q(a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z));}
export function rotate(q,p){const u=V(q.x,q.y,q.z),t=mul(cross(u,p),2);return add(p,add(mul(t,q.w),cross(u,t)));}
export function fromEuler(x,y,z){const ax=Q(Math.sin(x/2),0,0,Math.cos(x/2)),ay=Q(0,Math.sin(y/2),0,Math.cos(y/2)),az=Q(0,0,Math.sin(z/2),Math.cos(z/2));return multiplyQ(az,multiplyQ(ay,ax));}
export function uniquePoints(faces){const points=[],seen=new Set();for(const face of faces)for(const p of face){const key=[p.x,p.y,p.z].map(v=>Math.round(v*1e7)).join(',');if(!seen.has(key)){seen.add(key);points.push(p);}}return points;}
export function volumeProperties(faces){let volume=0,weighted=V();for(const face of faces)for(let i=1;i<face.length-1;i++){const a=face[0],b=face[i],c=face[i+1],v=dot(a,cross(b,c))/6;volume+=v;weighted=add(weighted,mul(add(add(a,b),c),v/4));}if(volume<1e-10)throw new Error('Invalid convex volume.');return{volume,center:mul(weighted,1/volume)};}
function oriented(faces){const points=uniquePoints(faces),center=mul(points.reduce(add,V()),1/points.length);return faces.map(face=>{const normal=cross(sub(face[1],face[0]),sub(face[2],face[0])),mid=mul(face.reduce(add,V()),1/face.length);return dot(normal,sub(mid,center))<0?[...face].reverse():face;});}
export function shapePoly(shape,size=1){
  let faces=[];if(shape==='box'){const p=[V(-1,-1,-1),V(1,-1,-1),V(1,1,-1),V(-1,1,-1),V(-1,-1,1),V(1,-1,1),V(1,1,1),V(-1,1,1)];faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].map(f=>f.map(i=>p[i]));}
  else if(shape==='tetra'){const p=[V(1,1,1),V(-1,-1,1),V(-1,1,-1),V(1,-1,-1)];faces=[[0,1,2],[0,3,1],[0,2,3],[1,3,2]].map(f=>f.map(i=>p[i]));}
  else if(shape==='cylinder'){const n=16,bottom=[],top=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;bottom.push(V(Math.cos(a),-1,Math.sin(a)));top.push(V(Math.cos(a),1,Math.sin(a)));}faces.push(bottom,top);for(let i=0;i<n;i++)faces.push([bottom[i],bottom[(i+1)%n],top[(i+1)%n],top[i]]);}
  else if(shape==='sphere'){const n=16,rings=[];for(let j=1;j<8;j++){const polar=j/8*Math.PI,ring=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;ring.push(V(Math.sin(polar)*Math.cos(a),Math.cos(polar),Math.sin(polar)*Math.sin(a)));}rings.push(ring);}for(let i=0;i<n;i++){const next=(i+1)%n;faces.push([V(0,1,0),rings[0][i],rings[0][next]],[V(0,-1,0),rings.at(-1)[next],rings.at(-1)[i]]);for(let j=0;j<rings.length-1;j++)faces.push([rings[j][i],rings[j][next],rings[j+1][next],rings[j+1][i]]);}}
  else throw new Error('Unknown shape.');return oriented(faces).map(face=>face.map(p=>mul(p,size)));
}
function tidy(face){const result=[];for(const p of face)if(!result.length||length(sub(p,result.at(-1)))>1e-7)result.push(p);if(result.length>1&&length(sub(result[0],result.at(-1)))<1e-7)result.pop();return result;}
export function clipPoly(faces,normal,offset){
  const output=[],cut=[];for(const face of faces){const polygon=[];for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],da=dot(a,normal)-offset,db=dot(b,normal)-offset,insideA=da<=1e-8,insideB=db<=1e-8;if(insideA)polygon.push(a);if(insideA!==insideB){const p=add(a,mul(sub(b,a),da/(da-db)));polygon.push(p);cut.push(p);}}const cleaned=tidy(polygon);if(cleaned.length>=3)output.push(cleaned);}
  const points=uniquePoints([cut]);if(points.length>=3){const center=mul(points.reduce(add,V()),1/points.length),u=unit(cross(Math.abs(normal.y)>.8?V(1,0,0):V(0,1,0),normal)),v=cross(normal,u);points.sort((a,b)=>Math.atan2(dot(sub(a,center),v),dot(sub(a,center),u))-Math.atan2(dot(sub(b,center),v),dot(sub(b,center),u)));output.push(points);}
  if(output.length<4)return null;try{volumeProperties(output);return output;}catch{return null;}
}
export function partition(shape,size){const outer=shapePoly(shape,size);let pieces=[outer];for(const [normal,offset]of [[V(1,0,0),.07*size],[V(0,1,0),-.04*size],[V(0,0,1),.03*size]]){const next=[];for(const piece of pieces)for(const side of [1,-1]){const clipped=clipPoly(piece,mul(normal,side),offset*side);if(clipped)next.push(clipped);}pieces=next;}const cells=pieces.map((faces,id)=>{const {center,volume}=volumeProperties(faces);return{id,offset:center,volume,faces:faces.map(face=>face.map(p=>sub(p,center)))};});return{outer,cells};}
export function polyRadius(faces){return Math.max(...uniquePoints(faces).map(length));}
export function surfaceArea(faces){let area=0;for(const f of faces)for(let i=1;i<f.length-1;i++)area+=length(cross(sub(f[i],f[0]),sub(f[i+1],f[0])))/2;return area;}
export function polyVertices(faces){return new Float32Array(uniquePoints(faces).flatMap(p=>[p.x,p.y,p.z]));}
export function checkedPoly(value,budget){if(!Array.isArray(value)||value.length<4||value.length>256)throw new Error('Invalid fragment geometry.');const faces=value.map(face=>{if(!Array.isArray(face)||face.length<3||face.length>96)throw new Error('Invalid fragment face.');budget.count+=face.length;if(budget.count>200000)throw new Error('Scene geometry is too large.');return face.map(p=>{if(!p||![p.x,p.y,p.z].every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=32))throw new Error('Invalid fragment vertex.');return V(p.x,p.y,p.z);});});volumeProperties(faces);return faces;}
