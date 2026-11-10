export const clone=x=>structuredClone(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createDocument(){return{format:'svg-paint',version:1,width:960,height:640,background:null,nextId:1,items:[]};}
const hex=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
export function checkedDocument(d){if(!d||d.format!=='svg-paint'||d.version!==1||![d.width,d.height].every(v=>Number.isFinite(v)&&v>=1&&v<=4096)||!(d.background===null||hex(d.background))||!Number.isInteger(d.nextId)||d.nextId<1||!Array.isArray(d.items)||d.items.length>64)throw Error('Invalid SVG Paint project.');let total=0;const ids=new Set();for(const s of d.items){if(!s||!Number.isInteger(s.id)||s.id<1||ids.has(s.id)||s.id>=d.nextId||typeof s.name!=='string'||s.name.length>100||!hex(s.fill)||!hex(s.stroke)||![s.radius,s.strokeWidth].every(v=>Number.isFinite(v)&&v>=0&&v<=512)||![s.opacity,s.fillAlpha,s.strokeAlpha].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||(s.roundingOverride!==undefined&&typeof s.roundingOverride!=='boolean')||!Number.isFinite(s.rotation)||typeof s.fillEnabled!=='boolean'||typeof s.strokeEnabled!=='boolean'||typeof s.hidden!=='boolean'||!['nonzero','evenodd'].includes(s.fillRule)||!['round','miter','bevel'].includes(s.lineJoin)||!['round','butt','square'].includes(s.lineCap)||!Array.isArray(s.contours)||!s.contours.length)throw Error('Invalid shape.');ids.add(s.id);for(const c of s.contours){if(typeof c.closed!=='boolean'||!Array.isArray(c.points)||c.points.length<2||c.points.length>4096||c.points.some(p=>!p||![p.x,p.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=100000)))throw Error('Invalid shape points.');total+=c.points.length;}}if(total>32768)throw Error('Project has too many points.');return clone(d);}
export function bounds(s){const p=s.contours.flatMap(c=>c.points),xs=p.map(p=>p.x),ys=p.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};}
const n=v=>Number(v.toFixed(3)),point=p=>`${n(p.x)} ${n(p.y)}`;
// Imports and Boolean operations may sample a straight edge or an existing
// rounded corner into many vertices. Treat those samples as one logical edge /
// corner before applying a new rounding amount. Keep the stored points intact.
const roundingCache=new WeakMap();
function roundingPoints(contour){
 const cached=roundingCache.get(contour),raw=contour.points;
 if(cached&&cached.closed===contour.closed&&cached.coords.length===raw.length*2&&raw.every((p,i)=>p.x===cached.coords[i*2]&&p.y===cached.coords[i*2+1]))return cached.points;
 const box=bounds({contours:[contour]}),eps=Math.max(1e-6,Math.min(.01,Math.max(box.w,box.h)*1e-6)),length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),cross=(a,b)=>a.x*b.y-a.y*b.x;
 let points=[];for(const p of raw)if(!points.length||length(points.at(-1),p)>eps)points.push({...p});if(contour.closed&&points.length>1&&length(points[0],points.at(-1))<=eps)points.pop();
 const straight=(a,b,c)=>{const u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y},chord=length(a,c);return chord>eps&&Math.abs(cross(u,v))/chord<=eps&&u.x*v.x+u.y*v.y>=0;};
 function compact(input){const out=[];for(const p of input){out.push(p);while(out.length>2&&straight(out.at(-3),out.at(-2),out.at(-1)))out.splice(out.length-2,1);}if(contour.closed){let changed=true;while(changed&&out.length>3){changed=false;if(straight(out.at(-1),out[0],out[1])){out.shift();changed=true;}if(out.length>3&&straight(out.at(-2),out.at(-1),out[0])){out.pop();changed=true;}}}return out;}
 points=compact(points);
 for(let pass=0;pass<raw.length&&points.length>3;pass++){
  const count=points.length,edges=points.map((p,i)=>length(p,points[(i+1)%count])),turns=points.map((p,i)=>{if(!contour.closed&&(i===0||i===count-1))return 0;const a=points[(i+count-1)%count],b=points[(i+1)%count],u={x:p.x-a.x,y:p.y-a.y},v={x:b.x-p.x,y:b.y-p.y};return Math.atan2(cross(u,v),u.x*v.x+u.y*v.y);});let recovered=false;
  for(let i=contour.closed?0:1;i<(contour.closed?count:count-2)&&!recovered;i++){
   const incoming=edges[(i+count-1)%count];let longest=0,travel=0,turn=turns[i],sign=Math.sign(turn);
   for(let span=1;span<=Math.min(256,count-3,contour.closed?count-3:count-2-i);span++){
    const j=(i+span)%count;longest=Math.max(longest,edges[(i+span-1)%count]);travel+=edges[(i+span-1)%count];if(longest>incoming/4)break;
    const nextTurn=turns[j];if(Math.abs(nextTurn)>1e-5){if(sign&&Math.sign(nextTurn)!==sign)break;sign=Math.sign(nextTurn);}turn+=nextTurn;if(Math.abs(turn)>Math.PI*8/9)break;
    const outgoing=edges[j];if(outgoing<longest*4||travel>Math.min(incoming,outgoing)*.75||Math.abs(turn)<Math.PI/12)continue;
    const prev=points[(i+count-1)%count],a=points[i],b=points[j],next=points[(j+1)%count],u={x:a.x-prev.x,y:a.y-prev.y},v={x:next.x-b.x,y:next.y-b.y},den=cross(u,v);
    if(Math.abs(den)<=incoming*outgoing*1e-7)continue;const delta={x:b.x-prev.x,y:b.y-prev.y},t=cross(delta,v)/den,q=cross(delta,u)/den;if(t<1-1e-6||q>1e-6)continue;
    const corner={x:prev.x+t*u.x,y:prev.y+t*u.y};if(Math.max(length(corner,a),length(corner,b))>Math.min(incoming,outgoing)*.5)continue;
    if(contour.closed){const rotated=[...points.slice(i),...points.slice(0,i)];points=compact([corner,...rotated.slice(span+1)]);}else{points.splice(i,span+1,corner);points=compact(points);}recovered=true;break;
   }
  }if(!recovered)break;
 }
 if(points.length<(contour.closed?3:2))points=raw.map(p=>({...p}));roundingCache.set(contour,{closed:contour.closed,coords:new Float64Array(raw.flatMap(p=>[p.x,p.y])),points});return points;
}
function cornersFor(contour,radius,override=false){const p=radius||override?roundingPoints(contour):contour.points;return p.map((v,i)=>{if(!contour.closed&&(i===0||i===p.length-1))return{a:v,b:v,v};const prev=p[(i+p.length-1)%p.length],next=p[(i+1)%p.length],a=Math.hypot(v.x-prev.x,v.y-prev.y),b=Math.hypot(v.x-next.x,v.y-next.y),cut=Math.min(radius,a/2,b/2),at=(q,l)=>l?{x:v.x+(q.x-v.x)*cut/l,y:v.y+(q.y-v.y)*cut/l}:v;return{a:at(prev,a),b:at(next,b),v};});}
export function roundedPath(contours,radius=0,override=false){return contours.map(c=>{const corners=cornersFor(c,radius,override);if(!radius)return corners.map((q,i)=>(i?'L':'M')+point(q.v)).join(' ')+(c.closed?' Z':'');let d='M'+point(corners[0].b);for(let i=1;i<corners.length;i++){const q=corners[i];d+=' L'+point(q.a)+' Q'+point(q.v)+' '+point(q.b);}if(c.closed){const q=corners[0];d+=' L'+point(q.a)+' Q'+point(q.v)+' '+point(q.b)+' Z';}return d;}).join(' ');}
export const SHAPES=[['rectangle','Rectangle'],['ellipse','Ellipse'],['triangle','Triangle'],['right-triangle','Right triangle'],['diamond','Diamond'],['parallelogram','Parallelogram'],['trapezoid','Trapezoid'],['pentagon','Pentagon'],['hexagon','Hexagon'],['octagon','Octagon'],['regular-polygon','Regular polygon'],['star','Star'],['burst','Burst'],['arrow','Arrow'],['double-arrow','Double arrow'],['chevron','Chevron'],['heart','Heart'],['cross','Cross'],['ring','Ring'],['arc','Arc'],['line','Line']];
export function makeShape(id,kind,a,b,style){
 const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y),unit=p=>p.map(([u,v])=>({x:x+u*w,y:y+v*h}));let points,closed=true,contours;
 const regular=(count,inner=1)=>{const raw=Array.from({length:count},(_,i)=>{const t=i/count*Math.PI*2-Math.PI/2,r=i%2?inner:1;return{x:Math.cos(t)*r,y:Math.sin(t)*r};}),box=bounds({contours:[{points:raw}]});return raw.map(p=>({x:x+(p.x-box.x)/box.w*w,y:y+(p.y-box.y)/box.h*h}));};
 const count=(value,fallback,max=16)=>Number.isFinite(value)?Math.round(clamp(value,3,max)):fallback,ratio=(value,fallback)=>Number.isFinite(value)?clamp(value,.1,.9):fallback;
 if(kind==='line'){points=[{...a},{...b}];closed=false;}
 else if(kind==='arc'){points=Array.from({length:65},(_,i)=>{const t=Math.PI+i/64*Math.PI;return{x:x+w/2+Math.cos(t)*w/2,y:y+h+Math.sin(t)*h};});closed=false;}
 else if(kind==='triangle')points=unit([[.5,0],[1,1],[0,1]]);
 else if(kind==='right-triangle')points=unit([[0,0],[1,1],[0,1]]);
 else if(kind==='diamond')points=unit([[.5,0],[1,.5],[.5,1],[0,.5]]);
 else if(kind==='parallelogram')points=unit([[.25,0],[1,0],[.75,1],[0,1]]);
 else if(kind==='trapezoid')points=unit([[.25,0],[.75,0],[1,1],[0,1]]);
 else if(['pentagon','hexagon','octagon','regular-polygon'].includes(kind))points=regular(kind==='regular-polygon'?count(style.polygonSides,6):{pentagon:5,hexagon:6,octagon:8}[kind]);
 else if(kind==='ellipse'||kind==='ring'){points=Array.from({length:64},(_,i)=>({x:x+w/2+Math.cos(i/64*Math.PI*2)*w/2,y:y+h/2+Math.sin(i/64*Math.PI*2)*h/2}));if(kind==='ring'){const r=ratio(style.ringHole,.55);contours=[{points,closed:true},{points:[...points].reverse().map(p=>({x:x+w/2+(p.x-x-w/2)*r,y:y+h/2+(p.y-y-h/2)*r})),closed:true}];}}
 else if(kind==='star'||kind==='burst'){const star=kind==='star';points=regular(count(star?style.starPoints:style.burstPoints,star?5:12,star?16:24)*2,ratio(star?style.starInner:style.burstInner,star?.43:.75));}
 else if(kind==='arrow')points=unit([[0,.3],[.58,.3],[.58,0],[1,.5],[.58,1],[.58,.7],[0,.7]]);
 else if(kind==='double-arrow')points=unit([[0,.5],[.25,0],[.25,.3],[.75,.3],[.75,0],[1,.5],[.75,1],[.75,.7],[.25,.7],[.25,1]]);
 else if(kind==='chevron')points=unit([[0,0],[.45,0],[1,.5],[.45,1],[0,1],[.55,.5]]);
 else if(kind==='cross')points=unit([[1/3,0],[2/3,0],[2/3,1/3],[1,1/3],[1,2/3],[2/3,2/3],[2/3,1],[1/3,1],[1/3,2/3],[0,2/3],[0,1/3],[1/3,1/3]]);
 else if(kind==='heart'){const raw=Array.from({length:96},(_,i)=>{const t=i/96*Math.PI*2;return{x:16*Math.sin(t)**3,y:-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))};}),box=bounds({contours:[{points:raw}]});points=raw.map(p=>({x:x+(p.x-box.x)/box.w*w,y:y+(p.y-box.y)/box.h*h}));}
 else points=unit([[0,0],[1,0],[1,1],[0,1]]);
 const open=kind==='line'||kind==='arc';return{id,name:(SHAPES.find(s=>s[0]===kind)?.[1]||kind[0].toUpperCase()+kind.slice(1))+' '+id,contours:contours||[{points,closed}],fill:style.fill,stroke:style.stroke,fillEnabled:open?false:style.fillEnabled,strokeEnabled:style.strokeEnabled,fillAlpha:style.fillAlpha??1,strokeAlpha:style.strokeAlpha??1,strokeWidth:style.strokeWidth,radius:['ellipse','ring'].includes(kind)?512:style.radius,roundingOverride:false,opacity:style.opacity,rotation:0,hidden:false,fillRule:kind==='ring'?'evenodd':'nonzero',lineJoin:style.lineJoin||'round',lineCap:style.lineCap||'round'};
}
export function alignToCanvas(s,width,height,alignment){const b=bounds(s);let dx=0,dy=0;if(alignment==='left')dx=-b.x;else if(alignment==='center')dx=(width-b.w)/2-b.x;else if(alignment==='right')dx=width-b.w-b.x;else if(alignment==='top')dy=-b.y;else if(alignment==='middle')dy=(height-b.h)/2-b.y;else if(alignment==='bottom')dy=height-b.h-b.y;else throw Error('Unknown alignment.');for(const c of s.contours)for(const p of c.points){p.x+=dx;p.y+=dy;}return s;}
export function resize(s,box){const old=bounds(s);for(const c of s.contours)for(const p of c.points){p.x=box.x+(old.w?(p.x-old.x)/old.w:.5)*box.w;p.y=box.y+(old.h?(p.y-old.y)/old.h:.5)*box.h;}return s;}
export function rotate(s,degrees){const b=bounds(s),cx=b.x+b.w/2,cy=b.y+b.h/2,a=degrees*Math.PI/180;for(const c of s.contours)for(const p of c.points){const x=p.x-cx,y=p.y-cy;p.x=cx+x*Math.cos(a)-y*Math.sin(a);p.y=cy+x*Math.sin(a)+y*Math.cos(a);}s.rotation+=degrees;return s;}
export function simplify(points,tolerance){if(points.length<3||tolerance<=0)return clone(points);const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];while(stack.length){const[a,b]=stack.pop(),p=points[a],q=points[b],dx=q.x-p.x,dy=q.y-p.y,l=dx*dx+dy*dy;let index=-1,best=tolerance;for(let i=a+1;i<b;i++){const v=points[i],t=l?clamp(((v.x-p.x)*dx+(v.y-p.y)*dy)/l,0,1):0,d=Math.hypot(v.x-p.x-t*dx,v.y-p.y-t*dy);if(d>best){best=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}return points.filter((_,i)=>keep.has(i)).map(p=>({...p}));}
export function exportSVG(d){checkedDocument(d);const paths=d.items.filter(s=>!s.hidden).map(s=>`<path d="${roundedPath(s.contours,s.radius,s.roundingOverride===true)}" fill="${s.fillEnabled?s.fill:'none'}" stroke="${s.strokeEnabled?s.stroke:'none'}" stroke-width="${s.strokeWidth}" fill-opacity="${s.fillAlpha}" stroke-opacity="${s.strokeAlpha}" opacity="${s.opacity}" fill-rule="${s.fillRule}" stroke-linejoin="${s.lineJoin}" stroke-linecap="${s.lineCap}"/>`).join('');return`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}">${d.background?`<rect width="${d.width}" height="${d.height}" fill="${d.background}"/>`:''}${paths}</svg>`;}

export function selectionBounds(shapes){return shapes.length?bounds({contours:shapes.flatMap(s=>s.contours)}):null;}
export function boxSelection(shapes,box){const r={x:Math.min(box.x,box.x+box.w),y:Math.min(box.y,box.y+box.h),w:Math.abs(box.w),h:Math.abs(box.h)};return shapes.filter(s=>{if(s.hidden)return false;const b=bounds(s);return b.x<=r.x+r.w&&b.x+b.w>=r.x&&b.y<=r.y+r.h&&b.y+b.h>=r.y;}).map(s=>s.id);}
export function moveSelection(shapes,dx,dy){for(const s of shapes)for(const c of s.contours)for(const p of c.points){p.x+=dx;p.y+=dy;}return shapes;}
export function resizeSelection(shapes,target){const old=selectionBounds(shapes);if(!old)return shapes;for(const s of shapes)for(const c of s.contours)for(const p of c.points){p.x=target.x+(old.w?(p.x-old.x)/old.w:.5)*target.w;p.y=target.y+(old.h?(p.y-old.y)/old.h:.5)*target.h;}return shapes;}
export function rotateSelection(shapes,degrees){const b=selectionBounds(shapes);if(!b)return shapes;const cx=b.x+b.w/2,cy=b.y+b.h/2,a=degrees*Math.PI/180;for(const s of shapes){for(const c of s.contours)for(const p of c.points){const x=p.x-cx,y=p.y-cy;p.x=cx+x*Math.cos(a)-y*Math.sin(a);p.y=cy+x*Math.sin(a)+y*Math.cos(a);}s.rotation+=degrees;}return shapes;}
export function flipSelection(shapes,axis){if(!['x','y'].includes(axis))throw Error('Choose X or Y.');const b=selectionBounds(shapes);if(!b)return shapes;const center=b[axis]+b[axis==='x'?'w':'h']/2;for(const s of shapes)for(const c of s.contours)for(const p of c.points)p[axis]=2*center-p[axis];return shapes;}
export function alignSelection(shapes,width,height,direction,within=false){const b=selectionBounds(shapes);if(!b)return shapes;if(within){for(const s of shapes){const own=bounds(s);let dx=0,dy=0;if(direction==='left')dx=b.x-own.x;else if(direction==='center')dx=b.x+(b.w-own.w)/2-own.x;else if(direction==='right')dx=b.x+b.w-own.w-own.x;else if(direction==='top')dy=b.y-own.y;else if(direction==='middle')dy=b.y+(b.h-own.h)/2-own.y;else if(direction==='bottom')dy=b.y+b.h-own.h-own.y;else throw Error('Unknown alignment.');moveSelection([s],dx,dy);}}else{let dx=0,dy=0;if(direction==='left')dx=-b.x;else if(direction==='center')dx=(width-b.w)/2-b.x;else if(direction==='right')dx=width-b.w-b.x;else if(direction==='top')dy=-b.y;else if(direction==='middle')dy=(height-b.h)/2-b.y;else if(direction==='bottom')dy=height-b.h-b.y;else throw Error('Unknown alignment.');moveSelection(shapes,dx,dy);}return shapes;}
export function distributeSelection(shapes,axis){if(shapes.length<3)return shapes;if(!['x','y'].includes(axis))throw Error('Choose X or Y.');const size=axis==='x'?'w':'h',sorted=shapes.map(s=>({s,b:bounds(s)})).sort((a,b)=>a.b[axis]-b.b[axis]||a.s.id-b.s.id),first=sorted[0].b[axis],last=sorted.at(-1).b,span=last[axis]+last[size]-first,gap=(span-sorted.reduce((n,v)=>n+v.b[size],0))/(sorted.length-1);let at=first;for(let i=0;i<sorted.length;i++){const{s,b}=sorted[i];if(i&&i<sorted.length-1)moveSelection([s],axis==='x'?at-b.x:0,axis==='y'?at-b.y:0);at+=b[size]+gap;}return shapes;}

// Bake the editor's quadratic corner rounding to vector segments for Boolean
// operations. This keeps merge independent of display zoom and raster pixels.
export function flattenedContours(shape,tolerance=.05){return shape.contours.map(c=>{
 if(!shape.radius&&!shape.roundingOverride)return clone(c);const corners=cornersFor(c,shape.radius,shape.roundingOverride===true);if(!shape.radius)return{closed:c.closed,points:corners.map(q=>({...q.v}))};
 const out=[],add=p=>{if(!out.length||Math.hypot(out.at(-1).x-p.x,out.at(-1).y-p.y)>1e-8)out.push({...p});if(out.length>4097)throw Error('Too many points after merging. Simplify the selected shapes first.');};
 const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 function quad(a,b,d,depth=0){const dx=d.x-a.x,dy=d.y-a.y,length=Math.hypot(dx,dy),error=length?Math.abs(dx*(a.y-b.y)-(a.x-b.x)*dy)/length:Math.hypot(b.x-a.x,b.y-a.y);if(error<=tolerance||depth>=14){add(d);return;}const ab=mid(a,b),bd=mid(b,d),m=mid(ab,bd);quad(a,ab,m,depth+1);quad(m,bd,d,depth+1);}
 add(corners[0].b);for(let i=1;i<corners.length;i++){const q=corners[i];add(q.a);quad(q.a,q.v,q.b);}if(c.closed){const q=corners[0];add(q.a);quad(q.a,q.v,q.b);if(out.length>1&&Math.hypot(out[0].x-out.at(-1).x,out[0].y-out.at(-1).y)<1e-8)out.pop();}return{closed:c.closed,points:out};
});}
const signedArea=points=>points.reduce((n,p,i)=>{const q=points[(i+1)%points.length];return n+p.x*q.y-q.x*p.y;},0)/2;
function filledGeometry(shape,clip){
 const rings=flattenedContours(shape).filter(c=>c.closed&&c.points.length>=3).map(c=>({coords:c.points.map(p=>[p.x,p.y]),sign:signedArea(c.points)<0?-1:1}));
 if(!rings.length)return[];if(shape.fillRule==='evenodd')return clip.xor(...rings.map(r=>[r.coords]));
 // Keep disjoint winding regions so opposite contours cancel while equally
 // wound nested contours stay filled, matching SVG's nonzero fill rule.
 let regions=[];for(const ring of rings){const geometry=clip.union([ring.coords]);if(!geometry.length)continue;const outside=regions.length?clip.difference(geometry,...regions.map(r=>r.geometry)):geometry,next=[];
  for(const r of regions){const rest=clip.difference(r.geometry,geometry),overlap=clip.intersection(r.geometry,geometry);if(rest.length)next.push({level:r.level,geometry:rest});if(overlap.length&&r.level+ring.sign)next.push({level:r.level+ring.sign,geometry:overlap});}
  if(outside.length)next.push({level:ring.sign,geometry:outside});const levels=new Map();for(const r of next){if(!levels.has(r.level))levels.set(r.level,[]);levels.get(r.level).push(r.geometry);}regions=[...levels].map(([level,list])=>({level,geometry:clip.union(...list)}));
 }return regions.length?clip.union(...regions.map(r=>r.geometry)):[];
}
export function mergedShape(shapes,id,clip=globalThis.polygonClipping){
 if(shapes.length<2)throw Error('Select at least two shapes.');if(!clip)throw Error('Merge could not load. Reload the editor.');
 if(shapes.some(s=>!s.fillEnabled||s.contours.some(c=>!c.closed||c.points.length<3)))throw Error('Merge needs filled, closed shapes. Use Combine paths for open outlines.');
 const result=clip.union(...shapes.map(s=>filledGeometry(s,clip)));if(!result.length)throw Error('These shapes have no filled area to merge.');
 const shape=clone(shapes.at(-1));shape.id=id;shape.name='Merged '+id;shape.radius=0;shape.roundingOverride=false;shape.rotation=0;shape.hidden=false;shape.fillRule='evenodd';shape.contours=result.flatMap(polygon=>polygon.map(ring=>({closed:true,points:ring.slice(0,-1).map(([x,y])=>({x,y}))})));
 if(shape.contours.some(c=>c.points.length>4096)||shape.contours.reduce((n,c)=>n+c.points.length,0)>32768)throw Error('Merge creates too many points. Simplify the selection first.');return shape;
}
export function combinedShape(shapes,id){if(shapes.length<2)throw Error('Select at least two shapes.');const shape=clone(shapes.at(-1));shape.id=id;shape.name='Combined '+id;shape.radius=0;shape.roundingOverride=false;shape.rotation=0;shape.hidden=false;shape.contours=shapes.flatMap(s=>flattenedContours(s));return shape;}
