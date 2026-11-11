import{heightAt}from'./terrain.js?v=3';
import{positionAt,move3D,blocks}from'./space.js?v=3';
import{TILE,clone,clamp}from'./model.js?v=3';
export const SPEED=6.4;
export const currentRoom=g=>g.project.rooms.find(r=>r.id===g.room);
export const contains=(o,x,y,pad=0)=>x>=o.x-pad&&x<o.x+o.w+pad&&y>=o.y-pad&&y<o.y+o.h+pad;
export function walkable(g,r,x,y){return !!positionAt(g,r,x,y);}
export function safePosition(g,r,x,y){if(g.body.w>r.width||g.body.h>r.height)return null;let p=positionAt(g,r,x,y);if(p)return p;const hw=g.body.w/2,hh=g.body.h/2,queue=[[clamp(Math.floor(x-hw),0,r.width-g.body.w),clamp(Math.floor(y-hh),0,r.height-g.body.h)]],seen=new Set();for(let k=0;k<queue.length;k++){const[a,b]=queue[k],key=a+','+b;if(seen.has(key))continue;seen.add(key);p=positionAt(g,r,a+hw,b+hh);if(p)return p;for(const[i,j]of[[a+1,b],[a-1,b],[a,b+1],[a,b-1]])if(i>=0&&j>=0&&i<=r.width-g.body.w&&j<=r.height-g.body.h&&!seen.has(i+','+j))queue.push([i,j]);}return null;}
const touches=(g,r,t,pad=0)=>contains(t,g.x,g.y,pad)&&Math.abs(g.z-heightAt(r,t.x+t.w/2,t.y+t.h/2))<.5;
export function createGame(project){const entrance=project.rooms.find(r=>r.id===project.start);if(!entrance?.spawn)throw Error('Paint a green player region in the starting room first.');const s=entrance.spawn,scale=entrance.artScale,pixels=[];for(let y=0;y<s.h*scale;y++)for(let x=0;x<s.w*scale;x++)pixels.push(entrance.art[(s.y*scale+y)*entrance.width*scale+s.x*scale+x]);
 const g={project:clone(project),room:project.start,x:0,y:0,body:{w:s.w,h:s.h,height:entrance.playerHeight??s.h},pixels:{width:s.w*scale,height:s.h*scale,scale,data:pixels},time:0,moving:false,doors:{},enabled:{},fired:[],flags:Object.create(null),contacts:[],messages:[],checkpoint:null,health:3,cooldown:0,won:false,ending:'',events:[],error:null};for(const r of g.project.rooms){for(const d of r.doors)g.doors[d.id]=d.open;for(const t of r.triggers)g.enabled[t.id]=t.enabled;}const r=currentRoom(g),start=safePosition(g,r,s.x+s.w/2,s.y+s.h/2);if(!start)throw Error('The starting room needs floor wide enough for the player region.');Object.assign(g,start);g.checkpoint={room:r.id,...start};g.contacts=r.triggers.filter(t=>touches(g,r,t)).map(t=>t.id);return g;}
export function available(g,t){return g.enabled[t.id]&&!(t.once&&g.fired.includes(t.id))&&(!t.condition||!!g.flags[t.condition]===t.conditionValue);}
export function activate(g,id){
 const queue=[id],visited=new Set();let count=0;while(queue.length){const key=queue.shift();if(visited.has(key))continue;visited.add(key);const t=g.project.rooms.flatMap(r=>r.triggers).find(t=>t.id===key);if(!t||!available(g,t))continue;g.fired.push(t.id);g.events.push({type:'trigger',id:t.id,time:g.time});
  for(const a of t.actions){if(++count>128){g.error='Trigger chain stopped after 128 actions.';return;}if(a.type==='message')g.messages.push(a.text);
   if(a.type==='door'){const open=g.doors[a.target];g.doors[a.target]=a.op==='open'||a.op==='toggle'&&!open;const r=currentRoom(g);if(!g.doors[a.target]&&blocks(g,r,g.x,g.depth,g.z)){const safe=safePosition(g,r,g.x,g.y);if(safe)Object.assign(g,safe);else{g.doors[a.target]=open;g.messages.push('The door cannot close while it would trap the player.');}}}
   if(a.type==='trigger'){if(a.op==='fire')queue.push(a.target);else g.enabled[a.target]=a.op==='enable'||a.op==='toggle'&&!g.enabled[a.target];}
   if(a.type==='flag')g.flags[a.key]=a.value;
   if(a.type==='checkpoint')g.checkpoint={room:g.room,x:g.x,y:g.y};
   if(a.type==='goto'){const r=g.project.rooms.find(r=>r.id===a.room),s=r.spawn,p=safePosition(g,r,a.useSpawn?(s?s.x+s.w/2:r.width/2):a.x,a.useSpawn?(s?s.y+s.h/2:r.height/2):a.y);if(!p){g.messages.push('That room needs walkable floor before you can enter.');continue;}g.room=r.id;Object.assign(g,p);g.contacts=r.triggers.filter(t=>touches(g,r,t)).map(t=>t.id);g.events.push({type:'room',id:r.id,time:g.time});}
   if(a.type==='end'){g.won=true;g.ending=a.text;queue.length=0;break;}
  }
 }
 if(g.events.length>80)g.events.splice(0,g.events.length-80);if(g.fired.length>1000)g.fired=[...new Set(g.fired)];if(g.messages.length>16)g.messages.splice(0,g.messages.length-16);
}
export function nearby(g){const r=currentRoom(g);return r.triggers.filter(t=>t.when==='interact'&&available(g,t)&&touches(g,r,t,1)).sort((a,b)=>Math.hypot(g.x-a.x-a.w/2,g.y-a.y-a.h/2)-Math.hypot(g.x-b.x-b.w/2,g.y-b.y-b.h/2))[0]||null;}
export function interact(g){if(g.won)return;if(g.messages.length){g.messages.shift();return;}const t=nearby(g);if(t)activate(g,t.id);}
export function stepGame(g,input,dt){
 if(g.won||g.messages.length)return;dt=clamp(dt,0,.25);const steps=Math.max(1,Math.ceil(dt*SPEED/.13));g.moving=!!(input.x||input.y);for(let i=0;i<steps;i++){const tick=dt/steps;g.time+=tick;g.cooldown=Math.max(0,g.cooldown-tick);let r=currentRoom(g),v=g.tile,speed=SPEED*(v===TILE.WATER?.55:1),len=Math.max(1,Math.hypot(input.x,input.y)),dx=input.x/len*speed*tick,dy=input.y/len*speed*tick;move3D(g,r,dx,dy,tick,!!input.jump&&i===0);
  const touching=r.triggers.filter(t=>touches(g,r,t));const old=g.contacts;g.contacts=touching.map(t=>t.id);for(const t of touching)if(t.when==='enter'&&!old.includes(t.id)&&available(g,t)){activate(g,t.id);if(g.room!==r.id||g.messages.length||g.won)break;}
  if(g.room!==r.id||g.messages.length||g.won)break;
  if(g.grounded&&g.tile===TILE.HAZARD&&g.cooldown===0){g.health--;g.cooldown=1.1;const c=g.checkpoint;r=g.project.rooms.find(r=>r.id===c.room);const safe=safePosition(g,r,c.x,c.y);if(safe){g.room=r.id;Object.assign(g,safe);g.contacts=r.triggers.filter(t=>touches(g,r,t)).map(t=>t.id);}if(g.health<=0){g.health=3;g.messages.push('You ran out of hearts. Your checkpoint gives you another try.');}g.events.push({type:'hurt',time:g.time});break;}
 }
}
