import{terrain,depthAt,heightAt}from'./terrain.js?v=3';
const cache=new WeakMap(),EPS=1e-7;
export function invalidateSpace(r){cache.delete(r);}
export function roomSpace(r){let s=cache.get(r);if(s)return s;const t=terrain(r),columns=Array.from({length:r.width},()=>[]),walls=[];
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const i=y*r.width+x,h=t.heights[i],d=t.depths[i];if(r.cells[i]===2)walls.push({x,depth:d+1,bottom:h,top:h+t.rise});else if(r.cells[i]!==0)columns[x].push({depth:d,height:h,tile:r.cells[i],mapY:y});}
 for(const col of columns)col.sort((a,b)=>a.depth-b.depth);s={columns,walls};cache.set(r,s);return s;
}
export function support(g,r,x,depth,maxHeight=Infinity){
 const s=roomSpace(r),left=x-g.body.w/2,right=x+g.body.w/2,front=depth-g.body.h/2,back=depth+g.body.h/2;if(left<-EPS||right>r.width+EPS)return null;let top=-Infinity,tile=1;
 for(let col=Math.floor(left+EPS);col<=Math.floor(right-EPS);col++){const intervals=s.columns[col].filter(f=>f.height<=maxHeight+EPS&&f.depth<back-EPS&&f.depth+1>front+EPS);let cursor=front;
  for(const f of intervals){if(f.depth>cursor+EPS)break;cursor=Math.max(cursor,f.depth+1);if(f.height>top){top=f.height;tile=f.tile;}}
  if(cursor<back-EPS)return null;
 }return{height:top,tile};
}
export function blocks(g,r,x,depth,height){const a=x-g.body.w/2,b=x+g.body.w/2,c=depth-g.body.h/2,d=depth+g.body.h/2,head=height+(g.body.height??1);
 for(const w of roomSpace(r).walls)if(b>w.x+EPS&&a<w.x+1-EPS&&w.depth>c+EPS&&w.depth<d-EPS&&head>w.bottom+EPS&&height<w.top-EPS)return true;
 for(const door of r.doors)if(!g.doors[door.id]){const z=heightAt(r,door.x+door.w/2,door.y+door.h/2),dep=depthAt(r,door.x+door.w/2,door.y+door.h/2);if(b>door.x+EPS&&a<door.x+door.w-EPS&&d>dep-door.h/2+EPS&&c<dep+door.h/2-EPS&&head>z+EPS&&height<z+(door.height??door.h)+EPS)return true;}
 for(let col=Math.max(0,Math.floor(a+EPS));col<Math.min(r.width,Math.ceil(b-EPS));col++)for(const f of roomSpace(r).columns[col])if(f.height>height+EPS&&f.height<head-EPS&&f.depth<d-EPS&&f.depth+1>c+EPS)return true;
 return false;
}
export function screenY(r,depth,height){return depth-height/(r.wallRise??1);}
export function positionAt(g,r,x,y){const depth=depthAt(r,x,y),z=heightAt(r,x,y),floor=support(g,r,x,depth,z+.001);if(!floor||Math.abs(floor.height-z)>.001||blocks(g,r,x,depth,z))return null;return{x,y:screenY(r,depth,z),depth,z,vz:0,grounded:true,tile:floor.tile};}
export function move3D(g,r,dx,dy,dt,jump=false){
 if(jump&&g.grounded){g.vz=7;g.grounded=false;}
 for(const[axis,delta]of[['x',dx],['depth',dy]]){const x=axis==='x'?g.x+delta:g.x,depth=axis==='depth'?g.depth+delta:g.depth,floor=support(g,r,x,depth,g.z+(g.grounded?.26:0));if(!floor)continue;const height=g.grounded&&floor.height>g.z?floor.height:g.z;if(!blocks(g,r,x,depth,height)){g.x=x;g.depth=depth;if(height>g.z)g.z=height;}}
 const before=g.z;g.vz-=18*dt;let next=g.z+g.vz*dt;const floor=support(g,r,g.x,g.depth,before+.001);g.grounded=false;
 if(g.vz<=0&&floor&&next<=floor.height){next=floor.height;g.vz=0;g.grounded=true;g.tile=floor.tile;}
 if(g.vz>0){const head=before+g.body.height,nextHead=next+g.body.height;for(const col of roomSpace(r).columns.slice(Math.max(0,Math.floor(g.x-g.body.w/2)),Math.ceil(g.x+g.body.w/2)))for(const f of col)if(f.height>head+EPS&&f.height<nextHead&&f.depth<g.depth+g.body.h/2-EPS&&f.depth+1>g.depth-g.body.h/2+EPS){next=Math.min(next,f.height-g.body.height);g.vz=0;}}
 g.z=next;g.y=screenY(r,g.depth,g.z);
}
