import {ASSETS,TERRAIN,THEMES} from './catalog.js';
import {defaultEnvironment,checkedEnvironment} from './lighting.js';
export const VERSION=3,MAX_PROPS=256,MAX_HEIGHT=12,clone=value=>structuredClone(value);
export const key=(x,z)=>x+','+z;
export const isWater=tile=>Boolean(tile&&(tile.material==='water'||TERRAIN[tile.material]?.water));
export const top=tile=>.35+tile.height*.5-(isWater(tile)?.08:0);
export function createMap(width=12,depth=12){if(![width,depth].every(v=>Number.isInteger(v)&&v>=4&&v<=32))throw Error('Map dimensions must be 4 to 32 tiles.');return{format:'isometric-map',version:VERSION,name:'Untitled map',width,depth,theme:'day',environment:defaultEnvironment(),nextId:1,tiles:Array.from({length:width*depth},()=>({material:'grass',height:0})),props:[]};}
export const inBounds=(p,x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<p.width&&z<p.depth;
export const tileAt=(p,x,z)=>inBounds(p,x,z)?p.tiles[z*p.width+x]:null;
export function rotateCell(x,z,w,d,r){if(r===1)return{x:z,z:w-1-x};if(r===2)return{x:w-1-x,z:d-1-z};if(r===3)return{x:d-1-z,z:x};return{x,z};}
export function localSize(e){const a=ASSETS[e.type];return e.size??{w:a.w,d:a.d};}
export function validSize(e){if(e.size===undefined)return true;const a=ASSETS[e.type];return Boolean(a?.resize&&e.size&&['w','d'].every(k=>Number.isInteger(e.size[k])&&e.size[k]>=a.resize[k][0]&&e.size[k]<=a.resize[k][1]));}
export function dimensions(type,r,size=null){const a=size??ASSETS[type];return r%2?{w:a.d,d:a.w}:{w:a.w,d:a.d};}
export function footprint(e){const a=localSize(e),cells=[];for(let z=0;z<a.d;z++)for(let x=0;x<a.w;x++){const c=rotateCell(x,z,a.w,a.d,e.rotation);cells.push({x:e.x+c.x,z:e.z+c.z,localX:x,localZ:z});}return cells;}
export function support(p,e){
  if(!Object.hasOwn(ASSETS,e.type)||!Number.isInteger(e.x)||!Number.isInteger(e.z)||!Number.isInteger(e.rotation)||e.rotation<0||e.rotation>3||e.tint!=null&&!/^#[0-9a-f]{6}$/i.test(e.tint)||!validSize(e))return{ok:false,error:'Invalid prop settings.'};const a=ASSETS[e.type],cells=footprint(e);if(cells.some(c=>!inBounds(p,c.x,c.z)))return{ok:false,error:'Keep the whole prop inside the map.'};
  const tiles=cells.map(c=>tileAt(p,c.x,c.z));
  if(e.type==='bridge'||e.type==='dock'){
    const d=localSize(e).d,ends=cells.filter(c=>c.localZ===0||e.type==='bridge'&&c.localZ===d-1).map(c=>tileAt(p,c.x,c.z));if(ends.some(t=>!t||isWater(t))||ends.some(t=>t.height!==ends[0].height))return{ok:false,error:e.type==='bridge'?'Bridge ends need two level, dry banks.':'The jetty starts on a level, dry bank.'};
    if(tiles.some(t=>t&&top(t)>top(ends[0])+.001))return{ok:false,error:'The span needs clear space below it.'};return{ok:true,y:top(ends[0]),height:ends[0].height};
  }
  if(tiles.some(t=>!t))return{ok:false,error:'This prop needs ground beneath it.'};
  if(a.water&&tiles.some(t=>!isWater(t)))return{ok:false,error:'This piece belongs on water.'};
  if(!a.water&&!a.any&&tiles.some(isWater))return{ok:false,error:'This prop needs dry ground.'};
  if(e.type==='stairs'){
    const low=tiles[0].height,high=tiles.at(-1).height;if(high!==low&&high!==low+1||cells.some((c,i)=>tiles[i].height!==(c.localZ===0?low:high)))return{ok:false,error:'Stairs need two level rows with at most a one-level rise.'};
    return{ok:true,y:top(tiles[0]),height:low};
  }
  if(tiles.some(t=>t.height!==tiles[0].height))return{ok:false,error:'This prop needs level ground.'};
  return{ok:true,y:Math.max(...tiles.map(top)),height:tiles[0].height};
}
export function canPlace(p,e,exclude=null){
  const s=support(p,e);if(!s.ok)return s;const wanted=new Set(footprint(e).map(c=>key(c.x,c.z)));
  if(p.props.some(other=>other.id!==exclude&&footprint(other).some(c=>wanted.has(key(c.x,c.z)))))return{ok:false,error:'That space is already occupied.'};
  return s;
}
export function addProp(p,config){if(p.props.length>=MAX_PROPS)throw Error('The map already has 256 props.');if(!Number.isInteger(p.nextId)||p.nextId<1||p.nextId>1e9||p.props.some(e=>e.id===p.nextId))throw Error('This map has no more available piece IDs.');const e={id:p.nextId,type:config.type,x:config.x,z:config.z,rotation:config.rotation??0,tint:config.tint??null,...(config.size?{size:{w:config.size.w,d:config.size.d}}:{}),...(config.name?{name:config.name.slice(0,40)}:{})},s=canPlace(p,e);if(!s.ok)throw Error(s.error);p.nextId++;p.props.push(e);return e;}
export function moveProp(p,id,values){const old=p.props.find(e=>e.id===id);if(!old)throw Error('Select a prop.');if(old.locked)throw Error('Unlock this piece before editing it.');const next={...old,...values,id},s=canPlace(p,next,id);if(!s.ok)throw Error(s.error);Object.assign(old,next);return old;}
export function propAt(p,x,z){return p.props.find(e=>!e.hidden&&footprint(e).some(c=>c.x===x&&c.z===z))??null;}
export function paint(p,cells,{material=null,delta=0,remove=false,tint,edge,detail,height,smoothSource}={}){
  if(material!==null&&!Object.hasOwn(TERRAIN,material))throw Error('Unknown terrain.');if([tint,edge].some(v=>v!==undefined&&v!==null&&!/^#[0-9a-f]{6}$/i.test(v)))throw Error('Choose a valid terrain color.');if(detail!==undefined&&!['auto','plain','grain','pavers','planks'].includes(detail))throw Error('Unknown surface detail.');if(height!==undefined&&(!Number.isInteger(height)||height<0||height>MAX_HEIGHT))throw Error('Invalid terrain height.');const before=[],seen=new Set(),lockedSupports=new Map(p.props.filter(e=>e.locked).map(e=>[e.id,support(p,e).y]));
  for(const {x,z}of cells){if(!inBounds(p,x,z)||seen.has(key(x,z)))continue;seen.add(key(x,z));const index=z*p.width+x,old=p.tiles[index];let level=height??Math.max(0,Math.min(MAX_HEIGHT,(old?.height??0)+delta));if(smoothSource){const neighbors=[{x,z},{x:x-1,z},{x:x+1,z},{x,z:z-1},{x,z:z+1}].map(c=>tileAt(smoothSource,c.x,c.z)).filter(Boolean);if(!old)continue;level=Math.round(neighbors.reduce((n,t)=>n+t.height,0)/neighbors.length);}const next=remove?null:{...old,material:material??old?.material??'grass',height:level};if(next){for(const [k,v]of Object.entries({tint,edge,detail}))if(v!==undefined){if(v===null||v==='auto')delete next[k];else next[k]=v;}}
    if(JSON.stringify(old)===JSON.stringify(next))continue;before.push({index,old});p.tiles[index]=next;
  }
  for(const e of p.props){const s=support(p,e);if(!s.ok||e.locked&&s.y!==lockedSupports.get(e.id)){for(const b of before)p.tiles[b.index]=b.old;return{changed:false,error:(e.locked?'Unlock':'Move')+' the '+ASSETS[e.type].name.toLowerCase()+' before changing its support.'};}}
  return{changed:before.length>0};
}
export function brushCells(p,x,z,size=1,shape='square'){const cells=[],r=[3,5].includes(size)?(size-1)/2:0;for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)if(inBounds(p,x+dx,z+dz)&&(shape!=='circle'||dx*dx+dz*dz<=r*r+.25))cells.push({x:x+dx,z:z+dz});return cells;}
export function lineCells(a,b){const out=[];let x=a.x,z=a.z,dx=Math.abs(b.x-x),dz=-Math.abs(b.z-z),sx=x<b.x?1:-1,sz=z<b.z?1:-1,error=dx+dz;for(let i=0;i<128;i++){out.push({x,z});if(x===b.x&&z===b.z)break;const e=2*error;if(e>=dz){error+=dz;x+=sx;}if(e<=dx){error+=dx;z+=sz;}}return out;}
export function shapeCells(p,a,b,mode='line',filled=true,size=1,shape='square'){const cells=new Map();const add=c=>{if(inBounds(p,c.x,c.z))cells.set(key(c.x,c.z),c);};if(mode==='line'){for(const c of lineCells(a,b))for(const q of brushCells(p,c.x,c.z,size,shape))add(q);}else for(let z=Math.max(0,Math.min(a.z,b.z));z<=Math.min(p.depth-1,Math.max(a.z,b.z));z++)for(let x=Math.max(0,Math.min(a.x,b.x));x<=Math.min(p.width-1,Math.max(a.x,b.x));x++)if(filled||x===a.x||x===b.x||z===a.z||z===b.z)add({x,z});return[...cells.values()];}
export function floodCells(p,x,z){const t=tileAt(p,x,z),same=v=>t?v&&['material','height','tint','edge','detail'].every(k=>v[k]===t[k]):!v,queue=[{x,z}],seen=new Set([key(x,z)]);if(!inBounds(p,x,z))return[];for(let i=0;i<queue.length;i++)for(const c of [{x:queue[i].x-1,z:queue[i].z},{x:queue[i].x+1,z:queue[i].z},{x:queue[i].x,z:queue[i].z-1},{x:queue[i].x,z:queue[i].z+1}])if(inBounds(p,c.x,c.z)&&!seen.has(key(c.x,c.z))&&same(tileAt(p,c.x,c.z))){seen.add(key(c.x,c.z));queue.push(c);}return queue;}
export function resizeMap(p,width,depth){if(!Number.isInteger(width)||!Number.isInteger(depth)||width<4||depth<4||width>32||depth>32)throw Error('Map dimensions must be 4 to 32 tiles.');const tiles=Array.from({length:width*depth},(_,i)=>{const x=i%width,z=Math.floor(i/width);return x<p.width&&z<p.depth?p.tiles[z*p.width+x]:{material:'grass',height:0};}),stage={...p,width,depth,tiles};if(p.props.some(e=>e.locked&&!support(stage,e).ok))throw Error('Unlock pieces outside the new map before resizing.');p.width=width;p.depth=depth;p.tiles=tiles;p.props=p.props.filter(e=>support(p,e).ok);}
export function checkedMap(value){
  const integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
  if(!value||value.format!=='isometric-map'||![1,2,VERSION].includes(value.version)||typeof value.name!=='string'||!value.name.trim()||value.name.length>64||!integer(value.width,4,32)||!integer(value.depth,4,32)||!Object.hasOwn(THEMES,value.theme)||!Array.isArray(value.tiles)||value.tiles.length!==value.width*value.depth||!Array.isArray(value.props)||value.props.length>MAX_PROPS)throw Error('This is not a valid Isometric map.');
  const p={format:'isometric-map',version:VERSION,name:value.name.trim(),width:value.width,depth:value.depth,theme:value.theme,environment:checkedEnvironment(value.environment,value.theme),nextId:1,tiles:value.tiles.map(t=>{if(t===null)return null;if(!t||!Object.hasOwn(TERRAIN,t.material)||!integer(t.height,0,MAX_HEIGHT)||['tint','edge'].some(k=>t[k]!==undefined&&(typeof t[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(t[k])))||t.detail!==undefined&&!['plain','grain','pavers','planks'].includes(t.detail))throw Error('Invalid terrain data.');return{material:t.material,height:t.height,...(t.tint?{tint:t.tint}:{}),...(t.edge?{edge:t.edge}:{}),...(t.detail?{detail:t.detail}:{})};}),props:[]},ids=new Set();
  for(const e of value.props){if(!e||!integer(e.id,1,1e9)||ids.has(e.id)||!Object.hasOwn(ASSETS,e.type)||!integer(e.x,0,31)||!integer(e.z,0,31)||!integer(e.rotation,0,3)||e.tint!==null&&(typeof e.tint!=='string'||!/^#[0-9a-f]{6}$/i.test(e.tint))||!validSize(e)||['hidden','locked'].some(k=>e[k]!==undefined&&typeof e[k]!=='boolean')||e.name!==undefined&&(typeof e.name!=='string'||e.name.length>40))throw Error('Invalid prop data.');const next={id:e.id,type:e.type,x:e.x,z:e.z,rotation:e.rotation,tint:e.tint,...(e.size?{size:{w:e.size.w,d:e.size.d}}:{}),...(e.name?{name:e.name}:{}),...(e.hidden?{hidden:true}:{}),...(e.locked?{locked:true}:{})};const s=canPlace(p,next);if(!s.ok)throw Error('Invalid prop layout: '+s.error);p.props.push(next);ids.add(next.id);p.nextId=Math.max(p.nextId,next.id+1);}
  if(integer(value.nextId,1,1e9))p.nextId=Math.max(p.nextId,value.nextId);return p;
}
export function preset(name='village'){
  const p=createMap();p.name='Willow Bend';
  const set=(x,z,material,height=0)=>{p.tiles[z*p.width+x]={material,height};};
  if(name==='empty'){p.name='New island';return p;}
  if(name==='village'){
    for(let z=0;z<12;z++)set(5,z,'water');for(let z=0;z<12;z++){set(7,z,'path');set(8,z,'path');}
    for(let x=0;x<12;x++)set(x,7,x===5?'water':'path');
    for(const [x,z]of [[0,0],[11,0],[0,11],[11,11]])p.tiles[z*12+x]=null;
    addProp(p,{type:'house',x:1,z:2});addProp(p,{type:'cabin',x:9,z:2,rotation:3});addProp(p,{type:'bridge',x:4,z:7,rotation:1});
    for(const [x,z]of [[1,0],[3,0],[0,4],[3,4],[1,9],[3,10],[9,0],[11,5],[10,8],[8,10]])addProp(p,{type:(x+z)%3?'oak':'pine',x,z});
    addProp(p,{type:'bench',x:9,z:6});addProp(p,{type:'lamp',x:6,z:3});addProp(p,{type:'flowers',x:3,z:6});addProp(p,{type:'flowers',x:9,z:5,tint:'#d99694'});addProp(p,{type:'lily',x:5,z:2});addProp(p,{type:'duck',x:5,z:9});addProp(p,{type:'rock',x:0,z:8});
  }else if(name==='garden'){
    p.name='Quiet Garden';for(let z=3;z<9;z++)for(let x=3;x<9;x++)set(x,z,'water');for(let z=0;z<12;z++)set(1,z,'path');for(let x=0;x<12;x++)set(x,10,'path');
    for(const [x,z]of [[0,1],[2,0],[10,2],[11,4],[2,6],[9,9],[11,11],[4,0]])addProp(p,{type:'oak',x,z});for(const [x,z]of [[4,4],[7,6],[6,8]])addProp(p,{type:'lily',x,z});addProp(p,{type:'duck',x:5,z:5});addProp(p,{type:'bench',x:4,z:1});addProp(p,{type:'flowers',x:2,z:9});
  }else if(name==='street'){
    p.name='Sunday Street';for(let z=0;z<12;z++)for(let x=4;x<8;x++)set(x,z,'road');for(let z=0;z<12;z++){set(3,z,'stone');set(8,z,'stone');}
    addProp(p,{type:'shop',x:0,z:2});addProp(p,{type:'house',x:9,z:2,rotation:2});addProp(p,{type:'house',x:0,z:7,tint:'#92aaa2'});addProp(p,{type:'car',x:5,z:3});addProp(p,{type:'car',x:6,z:8,rotation:2,tint:'#c38c80'});for(const [x,z]of [[2,1],[9,0],[10,7],[1,10]])addProp(p,{type:'oak',x,z});for(const z of [1,6,10])addProp(p,{type:'lamp',x:3,z});
  }else if(name==='coast'){
    p.name='Little Coast';for(let z=0;z<12;z++)for(let x=0;x<12;x++){const shore=6+Math.floor(Math.sin(z*.6));set(x,z,x>=shore?'water':x>=shore-2?'sand':'grass');}addProp(p,{type:'dock',x:3,z:7,rotation:1,size:{w:2,d:6}});addProp(p,{type:'boat',x:9,z:6,rotation:2});addProp(p,{type:'tent',x:1,z:2});for(const [x,z]of [[1,0],[3,5],[1,9],[4,10]])addProp(p,{type:'palm',x,z});addProp(p,{type:'umbrella',x:4,z:2});addProp(p,{type:'flowerpot',x:3,z:4});addProp(p,{type:'reeds',x:6,z:3});addProp(p,{type:'duck',x:9,z:2});
  }else if(name==='woodland'){
    p.name='Woodland';for(let z=0;z<12;z++)for(let x=0;x<12;x++){set(x,z,(x*7+z*11)%9<2?'moss':'grass',x>7&&z<5?1:0);}for(let z=0;z<12;z++)set(5+Math.round(Math.sin(z*.6)),z,'path');for(const [type,x,z]of [['birch',1,1],['cherry',3,3],['pine',9,1],['cypress',10,3],['oak',1,8],['birch',3,10],['pine',8,9],['cherry',10,10],['mushrooms',2,2],['log',3,7],['stump',9,7],['tallgrass',0,5],['flowers',7,6]])addProp(p,{type,x,z});addProp(p,{type:'hedge',x:8,z:5,size:{w:3,d:1}});addProp(p,{type:'picnic',x:1,z:4});
  }else if(name==='farm'){
    p.name='Sunday Farm';for(let z=0;z<12;z++)set(5,z,'path');for(let x=0;x<12;x++)set(x,6,'path');for(let z=4;z<=5;z++)for(let x=0;x<4;x++)set(x,z,'farmland');for(let z=5;z<=6;z++)for(let x=9;x<12;x++)set(x,z,'water');
    for(const [type,x,z]of [['barn',1,1],['greenhouse',8,1],['windmill',8,8],['pergola',1,8],['hay',0,1],['barrels',4,2],['beehive',7,4],['trough',6,8],['pumpkins',0,4],['sunflowers',1,4],['sunflowers',2,4],['lavenderplant',3,4],['flowerpot',4,9],['maple',0,10],['willow',10,9],['lily',10,5]])addProp(p,{type,x,z});addProp(p,{type:'fence',x:6,z:11,size:{w:4,d:1},name:'Field fence'});
  }else if(name==='terrace'){
    p.name='Hilltop';for(let z=6;z<12;z++)for(let x=0;x<12;x++)set(x,z,'grass',1);for(let z=9;z<12;z++)for(let x=0;x<12;x++)set(x,z,'grass',2);addProp(p,{type:'stairs',x:5,z:5});addProp(p,{type:'stairs',x:5,z:8});addProp(p,{type:'house',x:7,z:9});for(const [x,z]of [[1,2],[3,5],[1,8],[2,10],[10,6],[9,1]])addProp(p,{type:'pine',x,z});
  }else throw Error('Unknown starting scene.');return p;
}
export const filename=p=>p.name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60)||'isometric-map';
