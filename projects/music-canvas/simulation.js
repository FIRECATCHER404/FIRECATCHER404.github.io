import {WIDTH,HEIGHT,pairKey} from './model.js';
import {extents,overlaps,reflectAxis} from './geometry.js';
import {dispatch} from './script.js';
export function step(p,state,dt,onNote=()=>{},heldId=null){
  if(!Number.isFinite(dt)||dt<0)throw Error('Invalid simulation step.');dispatch(p,state);let remaining=dt;
  const hit=(s,reason)=>{if(s.gain<=0)return;const event={id:s.id,note:s.note,voice:s.voice,gain:s.gain,x:s.x/WIDTH,beat:state.beat,time:state.time,reason};state.events++;state.lastEvents.push(event);if(state.lastEvents.length>32)state.lastEvents.shift();onNote(event);};
  while(remaining>1e-10){const next=state.schedule[state.cursor],until=next?Math.max(0,(next.beat-state.beat)*60/p.tempo):Infinity,slice=Math.min(remaining,until>1e-10?until:remaining),walls=[];
    for(const s of p.shapes){if(!s.moving||s.id===heldId)continue;const e=extents(s),x=reflectAxis(s.x,s.vx,slice,e.left,WIDTH-e.right),y=reflectAxis(s.y,s.vy,slice,e.top,HEIGHT-e.bottom);s.x=x.value;s.y=y.value;s.vx=x.velocity;s.vy=y.velocity;if(p.wallNotes&&(x.bounced||y.bounced))walls.push(s);}
    state.time+=slice;state.beat+=slice*p.tempo/60;for(const s of walls)hit(s,'wall');
    const active=new Set();for(let i=0;i<p.shapes.length;i++)for(let j=i+1;j<p.shapes.length;j++){const a=p.shapes[i],b=p.shapes[j];if(!overlaps(a,b))continue;const key=pairKey(a.id,b.id);active.add(key);if(!state.pairs.has(key)){hit(a,'overlap');hit(b,'overlap');}}
    state.pairs=active;remaining-=slice;dispatch(p,state);
  }
}
