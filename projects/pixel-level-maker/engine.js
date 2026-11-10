import{TILE,clone,clamp}from'./model.js';
export const RADIUS=.34,SPEED=6.4;
export const currentRoom=g=>g.project.rooms.find(r=>r.id===g.room);
export const contains=(o,x,y,pad=0)=>x>=o.x-pad&&x<o.x+o.w+pad&&y>=o.y-pad&&y<o.y+o.h+pad;
export function walkable(g,r,x,y){
 const rad=RADIUS;for(let j=Math.floor(y-rad);j<=Math.floor(y+rad);j++)for(let i=Math.floor(x-rad);i<=Math.floor(x+rad);i++){const v=i<0||j<0||i>=r.width||j>=r.height?0:r.cells[j*r.width+i];if(v===TILE.VOID||v===TILE.WALL){const dx=x-clamp(x,i,i+1),dy=y-clamp(y,j,j+1);if(dx*dx+dy*dy<rad*rad-1e-9)return false;}}
 for(const d of r.doors)if(!g.doors[d.id]){const dx=x-clamp(x,d.x,d.x+d.w),dy=y-clamp(y,d.y,d.y+d.h);if(dx*dx+dy*dy<rad*rad-1e-9)return false;}return true;
}
export function safePosition(g,r,x,y){if(walkable(g,r,x,y))return{x,y};const queue=[[clamp(Math.floor(x),0,r.width-1),clamp(Math.floor(y),0,r.height-1)]],seen=new Set();for(let k=0;k<queue.length;k++){const[a,b]=queue[k],key=a+','+b;if(seen.has(key))continue;seen.add(key);if(walkable(g,r,a+.5,b+.5))return{x:a+.5,y:b+.5};for(const[i,j]of[[a+1,b],[a-1,b],[a,b+1],[a,b-1]])if(i>=0&&j>=0&&i<r.width&&j<r.height&&!seen.has(i+','+j))queue.push([i,j]);}return null;}
export function createGame(project){const g={project:clone(project),room:project.start,x:0,y:0,time:0,direction:'down',moving:false,doors:{},enabled:{},fired:[],flags:Object.create(null),contacts:[],messages:[],checkpoint:null,health:3,cooldown:0,won:false,ending:'',events:[],error:null};for(const r of g.project.rooms){for(const d of r.doors)g.doors[d.id]=d.open;for(const t of r.triggers)g.enabled[t.id]=t.enabled;}const r=currentRoom(g),start=safePosition(g,r,r.spawn.x,r.spawn.y);if(!start)throw Error('The entrance room needs some walkable floor.');Object.assign(g,start);g.checkpoint={room:r.id,...start};g.contacts=r.triggers.filter(t=>contains(t,g.x,g.y)).map(t=>t.id);return g;}
export function available(g,t){return g.enabled[t.id]&&!(t.once&&g.fired.includes(t.id))&&(!t.condition||!!g.flags[t.condition]===t.conditionValue);}
export function activate(g,id){
 const queue=[id],visited=new Set();let count=0;while(queue.length){const key=queue.shift();if(visited.has(key))continue;visited.add(key);const t=g.project.rooms.flatMap(r=>r.triggers).find(t=>t.id===key);if(!t||!available(g,t))continue;g.fired.push(t.id);g.events.push({type:'trigger',id:t.id,time:g.time});
  for(const a of t.actions){if(++count>128){g.error='Trigger chain stopped after 128 actions.';return;}if(a.type==='message')g.messages.push(a.text);
   if(a.type==='door'){const open=g.doors[a.target];g.doors[a.target]=a.op==='open'||a.op==='toggle'&&!open;const r=currentRoom(g);if(!g.doors[a.target]&&!walkable(g,r,g.x,g.y)){const safe=safePosition(g,r,g.x,g.y);if(safe)Object.assign(g,safe);else{g.doors[a.target]=open;g.messages.push('The door cannot close while it would trap the player.');}}}
   if(a.type==='trigger'){if(a.op==='fire')queue.push(a.target);else g.enabled[a.target]=a.op==='enable'||a.op==='toggle'&&!g.enabled[a.target];}
   if(a.type==='flag')g.flags[a.key]=a.value;
   if(a.type==='checkpoint')g.checkpoint={room:g.room,x:g.x,y:g.y};
   if(a.type==='goto'){const r=g.project.rooms.find(r=>r.id===a.room),p=safePosition(g,r,a.useSpawn?r.spawn.x:a.x,a.useSpawn?r.spawn.y:a.y);if(!p){g.messages.push('That room needs walkable floor before you can enter.');continue;}g.room=r.id;Object.assign(g,p);g.contacts=r.triggers.filter(t=>contains(t,g.x,g.y)).map(t=>t.id);g.events.push({type:'room',id:r.id,time:g.time});}
   if(a.type==='end'){g.won=true;g.ending=a.text;queue.length=0;break;}
  }
 }
 if(g.events.length>80)g.events.splice(0,g.events.length-80);if(g.fired.length>1000)g.fired=[...new Set(g.fired)];if(g.messages.length>16)g.messages.splice(0,g.messages.length-16);
}
export function nearby(g){const r=currentRoom(g);return r.triggers.filter(t=>t.when==='interact'&&available(g,t)&&contains(t,g.x,g.y,1)).sort((a,b)=>Math.hypot(g.x-a.x-a.w/2,g.y-a.y-a.h/2)-Math.hypot(g.x-b.x-b.w/2,g.y-b.y-b.h/2))[0]||null;}
export function interact(g){if(g.won)return;if(g.messages.length){g.messages.shift();return;}const t=nearby(g);if(t)activate(g,t.id);}
export function stepGame(g,input,dt){
 if(g.won||g.messages.length)return;dt=clamp(dt,0,.25);const steps=Math.max(1,Math.ceil(dt*SPEED/.13));g.moving=!!(input.x||input.y);for(let i=0;i<steps;i++){const tick=dt/steps;g.time+=tick;g.cooldown=Math.max(0,g.cooldown-tick);let r=currentRoom(g),v=r.cells[Math.floor(g.y)*r.width+Math.floor(g.x)],speed=SPEED*(v===TILE.WATER?.55:1),len=Math.max(1,Math.hypot(input.x,input.y)),dx=input.x/len*speed*tick,dy=input.y/len*speed*tick;if(Math.abs(dx)>Math.abs(dy)&&dx)g.direction=dx<0?'left':'right';else if(dy)g.direction=dy<0?'up':'down';if(walkable(g,r,g.x+dx,g.y))g.x+=dx;if(walkable(g,r,g.x,g.y+dy))g.y+=dy;
  const touching=r.triggers.filter(t=>contains(t,g.x,g.y));const old=g.contacts;g.contacts=touching.map(t=>t.id);for(const t of touching)if(t.when==='enter'&&!old.includes(t.id)&&available(g,t)){activate(g,t.id);if(g.room!==r.id||g.messages.length||g.won)break;}
  if(g.room!==r.id||g.messages.length||g.won)break;
  if(r.cells[Math.floor(g.y)*r.width+Math.floor(g.x)]===TILE.HAZARD&&g.cooldown===0){g.health--;g.cooldown=1.1;const c=g.checkpoint;r=g.project.rooms.find(r=>r.id===c.room);const safe=safePosition(g,r,c.x,c.y);if(safe){g.room=r.id;Object.assign(g,safe);g.contacts=r.triggers.filter(t=>contains(t,g.x,g.y)).map(t=>t.id);}if(g.health<=0){g.health=3;g.messages.push('You ran out of hearts. Your checkpoint gives you another try.');}g.events.push({type:'hurt',time:g.time});break;}
 }
}
