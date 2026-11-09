export class ScriptError extends Error{constructor(line,message){super('Line '+line+': '+message);this.line=line;}}
export function compile(source,shapes){
  if(typeof source!=='string'||source.length>12000)throw new ScriptError(1,'Keep the script under 12,000 characters.');const lines=source.split(/\r?\n/);if(lines.length>256)throw new ScriptError(257,'Use at most 256 lines.');const ids=new Set(shapes.map(s=>s.id)),events=[];let selected=null,beat=0;
  lines.forEach((raw,i)=>{const line=i+1,text=raw.replace(/#.*/,'').trim().toLowerCase();if(!text)return;const match=/^(\S+)(?:\s+(.*))?$/.exec(text),command=match[1],args=(match[2]??'').trim();
    if(command==='select'){
      if(args==='all')selected=[...ids];else{if(!/^\d+(?:\s*,\s*\d+|\s+\d+)*$/.test(args))throw new ScriptError(line,'Use select 1, 2 or select all.');selected=[...new Set(args.split(/[\s,]+/).map(Number))];if(selected.some(id=>!Number.isInteger(id)||id<1||id>99))throw new ScriptError(line,'IDs are whole numbers from 1 to 99.');for(const id of selected)if(!ids.has(id))throw new ScriptError(line,'Shape '+id+' does not exist.');}return;
    }
    if(command==='wait'){if(!/^(?:\d+(?:\.\d+)?|\.\d+)(?:\s+beats?)?$/.test(args))throw new ScriptError(line,'Use wait 2 (in beats).');const amount=Number(args.split(/\s+/)[0]);if(!Number.isFinite(amount)||amount<0||amount>64||beat+amount>256)throw new ScriptError(line,'Waits must be 0–64 beats, totaling at most 256.');beat+=amount;return;}
    if(command==='move'||command==='stop'){
      if(selected===null)throw new ScriptError(line,'Select shapes before changing their movement.');let moving;if(command==='stop'){if(args)throw new ScriptError(line,'stop takes no arguments.');moving=false;}else{if(!['','yes','no','on','off','true','false'].includes(args))throw new ScriptError(line,'Use move yes or move no.');moving=!['no','off','false'].includes(args);}events.push({beat,line,ids:[...selected],moving});return;
    }
    throw new ScriptError(line,'Unknown command '+command+'. Use select, move, stop, or wait.');
  });
  if(!events.length)throw new ScriptError(1,'Add a movement command after selecting shapes.');return events;
}
export function dispatch(p,state){while(state.cursor<state.schedule.length&&state.schedule[state.cursor].beat<=state.beat+1e-9){const event=state.schedule[state.cursor++];for(const s of p.shapes)if(event.ids.includes(s.id))s.moving=event.moving;state.scriptLine=event.line;}state.scriptActive=state.cursor<state.schedule.length;}
export function install(p,state,schedule){state.schedule=schedule.map(e=>({...e,ids:[...e.ids],beat:e.beat+state.beat}));state.cursor=0;state.scriptActive=true;state.scriptLine=0;dispatch(p,state);}
export function stopScript(state){state.schedule=[];state.cursor=0;state.scriptActive=false;state.scriptLine=0;}
