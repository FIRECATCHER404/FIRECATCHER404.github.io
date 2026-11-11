// Hidden physics interprets the drawing as a folded surface: wall rows rise vertically instead of
// consuming ground depth. Floors north of them move up AND forward in 3D.
const cache=new WeakMap();
export function invalidateTerrain(room){cache.delete(room);}
export function terrain(room){
 let result=cache.get(room);if(result)return result;
 const heights=new Float32Array(room.width*room.height),depths=new Float32Array(heights.length),rise=room.wallRise??1;
 for(let x=0;x<room.width;x++){let height=0;for(let y=room.height-1;y>=0;y--){const i=y*room.width+x,manual=room.elevations?.[i];if(manual!==null&&manual!==undefined)height=manual;heights[i]=height;depths[i]=y+height/rise;if(room.cells[i]===2){height+=rise;}}}
 result={heights,depths,rise};cache.set(room,result);return result;
}
export function heightAt(room,x,y){const i=Math.max(0,Math.min(room.height-1,Math.floor(y)))*room.width+Math.max(0,Math.min(room.width-1,Math.floor(x)));return terrain(room).heights[i];}
export function depthAt(room,x,y){const row=Math.max(0,Math.min(room.height-1,Math.floor(y))),col=Math.max(0,Math.min(room.width-1,Math.floor(x)));return terrain(room).depths[row*room.width+col]+y-row;}
export function surfacePoint(room,x,y){return{x,y:heightAt(room,x,y),z:depthAt(room,x,y)};}
