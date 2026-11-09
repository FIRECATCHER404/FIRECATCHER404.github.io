import {createMap,clone,checkedMap,addProp,canPlace,isWater,tileAt,MAX_PROPS} from './model.js';

export const LANDFORMS={island:'Island',river:'River valley',hills:'Rolling hills',archipelago:'Little islands',flat:'Open meadow'};
export const BIOMES={meadow:'Meadow',autumn:'Autumn',desert:'Desert',snow:'Snow'};
export function seededRandom(seed){let state=2166136261;for(const char of String(seed)){state^=char.charCodeAt(0);state=Math.imul(state,16777619);}return()=>{state+=0x6d2b79f5;let x=state;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296;};}
export function checkedOptions(value={}){const o={kind:'island',biome:'meadow',seed:'little-world',width:20,depth:20,relief:3,density:35,...value};if(!Object.hasOwn(LANDFORMS,o.kind)||!Object.hasOwn(BIOMES,o.biome)||typeof o.seed!=='string'||!o.seed.trim()||o.seed.length>80||![o.width,o.depth].every(v=>Number.isInteger(v)&&v>=4&&v<=32)||!Number.isInteger(o.relief)||o.relief<0||o.relief>8||!Number.isInteger(o.density)||o.density<0||o.density>100)throw Error('Choose valid landscape settings.');return o;}
const foliage={meadow:['oak','birch','cherry','fern','flowers','tallgrass','rock','willow'],autumn:['maple','birch','pumpkins','mushrooms','log','oak','fern'],desert:['cactus','palm','rock','succulent','shells'],snow:['pine','spruce','birch','rock','deadtree']};
export function scatterNature(source,options={}){const o=checkedOptions({...options,width:source.width,depth:source.depth}),p=clone(source),random=seededRandom(o.seed+':plants'),types=foliage[o.biome];if(o.density===0)return p;
  const spots=Array.from({length:p.width*p.depth},(_,i)=>({x:i%p.width,z:Math.floor(i/p.width),order:random(),chance:random(),choice:random(),rotation:Math.floor(random()*4)})).sort((a,b)=>a.order-b.order);
  for(const c of spots){if(p.props.length>=MAX_PROPS)break;if(c.chance>o.density/100*.55)continue;const tile=tileAt(p,c.x,c.z);if(!tile||tile.material==='ice')continue;let type=types[Math.floor(c.choice*types.length)];if(isWater(tile)){if(o.biome==='snow'||c.choice<.65)continue;type=c.choice>.92?'duck':c.choice>.8?'coral':'lily';}const e={type,x:c.x,z:c.z,rotation:c.rotation,tint:null};if(canPlace(p,e).ok)addProp(p,e);}
  return p;
}
export function generateLandscape(value){
  const o=checkedOptions(value),p=createMap(o.width,o.depth),random=seededRandom(o.seed+':land'),phases=Array.from({length:6},()=>random()*Math.PI*2),blobs=Array.from({length:5},()=>({x:random()*1.4-.7,z:random()*1.4-.7,r:.25+random()*.22}));p.name=BIOMES[o.biome]+' '+LANDFORMS[o.kind].toLowerCase();
  for(let z=0;z<p.depth;z++)for(let x=0;x<p.width;x++){
    const nx=(x+.5)/p.width*2-1,nz=(z+.5)/p.depth*2-1,wave=(Math.sin(nx*3+phases[0])+Math.cos(nz*4+phases[1])+Math.sin((nx+nz)*5+phases[2]))/3,noise=(Math.sin(nx*8+nz*3+phases[3])+Math.cos(nz*7-nx*2+phases[4]))/2;let land=true,height=0;
    if(o.kind==='island')land=Math.hypot(nx,nz)<.77+wave*.16;
    if(o.kind==='archipelago')land=blobs.some(b=>Math.hypot(nx-b.x,nz-b.z)<b.r+noise*.06);
    if(o.kind==='river')land=Math.abs(nx-Math.sin(nz*3+phases[5])*.23)>Math.max(.12,1.1/p.width)+.03*Math.cos(nz*7);
    if(land&&o.relief>0&&o.kind!=='flat'){const interior=o.kind==='island'?Math.max(0,1-Math.hypot(nx,nz)/.9):o.kind==='archipelago'?.4:1;height=Math.max(0,Math.min(o.relief,Math.round((wave*.35+.3+noise*.08)*o.relief*interior)));}
    let material=land?(o.biome==='snow'?'snow':o.biome==='desert'?'sand':o.biome==='autumn'?'leaves':'grass'):(o.biome==='snow'?'ice':'water');
    if(land&&height>=Math.max(2,o.relief-1)&&o.relief>3)material=o.biome==='snow'?'snow':'stone';if(land&&noise>.65&&o.biome==='meadow')material='moss';p.tiles[z*p.width+x]={material,height};
  }
  // A one-tile shore separates water from dry slopes; all water shares one level.
  if(o.biome!=='snow')for(let z=0;z<p.depth;z++)for(let x=0;x<p.width;x++){const t=tileAt(p,x,z);if(!isWater(t)&&t.material!=='stone'&&[{x:x-1,z},{x:x+1,z},{x,z:z-1},{x,z:z+1}].some(c=>isWater(tileAt(p,c.x,c.z)))){t.material='sand';t.height=0;}}
  return checkedMap(scatterNature(p,o));
}
