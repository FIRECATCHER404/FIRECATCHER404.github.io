import{Simulation}from'./model.js?v=1';
import{Budget}from'./core.js?v=1';
import{Viewport}from'./viewport.js?v=1';
import{renderRects}from'./render.js?v=1';
let sim,view,running=false,rate=.01,credit=0,last=performance.now(),lastFrame=0,dirty=true,timer=null,revision=0,steps=[],busy=false,lastError='';
const reply=(id,data)=>postMessage({type:'reply',id,data}),fail=(id,e)=>postMessage({type:'reply',id,error:e.message||String(e)});
function cancelSteps(){for(const id of steps.splice(0))fail(id,Error('The pending step was cancelled by replacing the map.'));busy=false;}
function stats(){return{kind:sim.kind,generation:String(sim.world.generation),population:String(sim.world.root.pop),ants:sim.ant?.ants.length||0,nodes:sim.world.factory.cache.size,cacheHits:sim.world.factory.hits,revision,busy,error:lastError};}
function frame(){const result=renderRects(sim.world,view),markers=(sim.ant?.ants||[]).map(a=>{const p=view.centerOf(a.x,a.y);return{x:p.x,y:p.y};}).filter(p=>p.x>=-1&&p.y>=-1&&p.x<=view.width+1&&p.y<=view.height+1);postMessage({type:'frame',rects:result.rects,view:view.export(),markers,visited:result.visited,stats:stats()},[result.rects.buffer]);dirty=false;lastFrame=performance.now();}
function wake(){if(timer===null)timer=setTimeout(tick,0);}
function tick(){
 timer=null;if(!sim)return;const now=performance.now(),elapsed=Math.min(1000,now-last);last=now;if(running)credit=Math.min(Number.MAX_SAFE_INTEGER,credit+elapsed*rate);const deadline=now+12;busy=false;
 try{while(performance.now()<deadline&&(steps.length||running&&credit>=1)){
  const single=!!steps.length,exponent=sim.ant||single?0:Math.min(40,Math.floor(Math.log2(Math.floor(credit)))),count=2**exponent;
  try{sim.advance(exponent,deadline);}catch(e){if(e instanceof Budget){busy=true;break;}throw e;}
  revision++;dirty=true;if(single)reply(steps.shift(),stats());else credit-=count;
 }if(sim.world.factory.cache.size>250000&&!busy)sim.world.factory.collect(sim.world.root);
 }catch(e){running=false;lastError=e.message;for(const id of steps.splice(0))fail(id,e);postMessage({type:'error',message:e.message,stats:stats()});dirty=true;}
 if(dirty&&(performance.now()-lastFrame>24||!running))frame();if(running||steps.length||busy||dirty)timer=setTimeout(tick,busy?0:running?4:16);
}
onmessage=event=>{const m=event.data;try{
 if(m.type==='init'){sim=new Simulation(m.kind);view=Viewport.from(m.view);rate=m.rate;reply(m.id,stats());dirty=true;wake();return;}
 if(!sim)throw Error('Simulation is not ready.');
 if(m.type==='view'){view=Viewport.from(m.view);dirty=true;wake();return;}
 if(m.type==='run'){running=!!m.running;credit=0;dirty=true;last=performance.now();reply(m.id,{running});wake();return;}
 if(m.type==='rate'){if(!Number.isFinite(m.rate)||m.rate<=0||m.rate>1e9)throw Error('Use a positive speed up to 1,000,000,000 steps/ms.');rate=m.rate;credit=0;last=performance.now();reply(m.id,{rate});return;}
 if(m.type==='step'){running=false;credit=0;steps.push(m.id);wake();return;}
 if(m.type==='place'){if(!Number.isInteger(m.rotation)||m.rotation<0||m.rotation>3)throw Error('Invalid rotation.');sim.place(m.tool,m.x,m.y,m.rotation);revision++;lastError='';dirty=true;reply(m.id,stats());wake();return;}
 if(m.type==='clear'){cancelSteps();sim=new Simulation(sim.kind);running=false;credit=0;lastError='';revision++;dirty=true;reply(m.id,stats());wake();return;}
 if(m.type==='bounds'){reply(m.id,sim.bounds());return;}
 if(m.type==='probe'){reply(m.id,{on:sim.world.get(m.x,m.y)});return;}
 if(m.type==='ants'){reply(m.id,(sim.ant?.ants||[]).map(a=>({...a,x:String(a.x),y:String(a.y)})));return;}
 if(m.type==='export'){reply(m.id,sim.pack(m.meta));return;}
 if(m.type==='load'){const parsed=Simulation.unpack(m.map,sim.kind);cancelSteps();sim=parsed.simulation;running=false;credit=0;rate=parsed.meta.rate;lastError='';revision++;dirty=true;reply(m.id,{stats:stats(),meta:parsed.meta});wake();return;}
 throw Error('Unknown command.');
 }catch(e){fail(m.id,e);}};
