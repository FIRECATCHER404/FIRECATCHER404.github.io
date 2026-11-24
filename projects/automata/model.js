import{World,AntWorld}from'./core.js?v=1';
import{Viewport}from'./viewport.js?v=1';
import{stampCells}from'./patterns.js?v=1';
export class Simulation{
 constructor(kind){if(!['life','ant'].includes(kind))throw Error('Unknown simulation.');this.kind=kind;this.ant=kind==='ant'?new AntWorld():null;this.world=this.ant?.world||new World();}
 place(tool,x,y,rotation=0){x=BigInt(x);y=BigInt(y);if(this.kind==='ant'){
  if(tool==='ant'){this.ant.add(x,y,rotation);return;}
  if(tool==='remove-ant'){this.ant.ants=this.ant.ants.filter(a=>a.x!==x||a.y!==y);return;}
  if(!['cell','erase'].includes(tool))throw Error('Unknown ant tool.');
 }for(const[dx,dy]of stampCells(tool,rotation))this.world.set(x+BigInt(dx),y+BigInt(dy),tool!=='erase');}
 advance(exponent,deadline){if(this.ant)this.ant.step();else this.world.advance(exponent,deadline);}
 bounds(){const b=this.world.bounds(),ants=this.ant?.ants||[];if(!b&&!ants.length)return null;const xs=ants.map(a=>a.x),ys=ants.map(a=>a.y);if(b){xs.push(b.minX,b.maxX);ys.push(b.minY,b.maxY);}return{minX:String(xs.reduce((a,b)=>a<b?a:b)),maxX:String(xs.reduce((a,b)=>a>b?a:b)),minY:String(ys.reduce((a,b)=>a<b?a:b)),maxY:String(ys.reduce((a,b)=>a>b?a:b))};}
 pack(meta){return{format:'neoj-cellular-map',version:1,kind:this.kind,tree:this.world.pack(),ants:(this.ant?.ants||[]).map(a=>({...a,x:String(a.x),y:String(a.y)})),...checkedMeta(meta)};}
 static unpack(raw,kind){
  if(!raw||raw.format!=='neoj-cellular-map'||raw.version!==1||raw.kind!==kind)throw Error('This ZIP is not a '+(kind==='ant'?"Langton’s Ant":'Game of Life')+' map.');const meta=checkedMeta(raw),s=new Simulation(kind),world=World.unpack(raw.tree);if(!Array.isArray(raw.ants)||raw.ants.length>5000||kind==='life'&&raw.ants.length)throw Error('Invalid ant list.');
  const ids=new Set(),ants=raw.ants.map(a=>{if(!Number.isSafeInteger(a.id)||a.id<1||a.id>=Number.MAX_SAFE_INTEGER||ids.has(a.id)||!Number.isInteger(a.direction)||a.direction<0||a.direction>3)throw Error('Invalid ant.');ids.add(a.id);for(const key of['x','y'])if(typeof a[key]!=='string'||!/^(-?)(0|[1-9]\d*)$/.test(a[key])||a[key].length>20000)throw Error('Invalid ant coordinate.');return{id:a.id,x:BigInt(a.x),y:BigInt(a.y),direction:a.direction};});s.world=world;if(s.ant){s.ant.world=world;s.ant.ants=ants;s.ant.nextId=Math.max(0,...ids)+1;}return{simulation:s,meta};
 }
}
export function checkedMeta(raw){if(!raw||!['dark','light'].includes(raw.theme)||!Number.isFinite(raw.rate)||raw.rate<=0||raw.rate>1e9||typeof raw.markAnts!=='boolean')throw Error('Invalid map settings.');const view=Viewport.from(raw.view);return{theme:raw.theme,rate:raw.rate,markAnts:raw.markAnts,view:view.export()};}
