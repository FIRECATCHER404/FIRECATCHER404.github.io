/* Bare gate schematics. Interface nodes and nested chip boundaries are wires. */
(function(root){
 'use strict';
 const cache=new WeakMap(),ioIn=n=>['INPUT','BUSINPUT'].includes(n.type),ioOut=n=>['OUTPUT','BUSOUTPUT'].includes(n.type);
 const tunnels=new Set(['TUNNEL','MULTITUNNEL','SENDTUNNEL','RECEIVETUNNEL']);
 const sortPins=(a,b)=>a.x<b.x?-1:a.x>b.x?1:a.y<b.y?-1:a.y>b.y?1:a.id.localeCompare(b.id);
 const endpoint=(path,id,side,index)=>JSON.stringify([...path,id,side,index]);
 function port(n,out,index){
  const count=out?root.Logic.outputCount(n):root.Logic.inputCount(n);
  if(!out&&n.type==='RGBTUNNEL'){const side=Math.floor(index/6),f=.18+(index%6)*.128;return {x:side===0?f:side===1?.92:side===2?1-f:.08,y:side===0?.08:side===1?f:side===2?.92:1-f};}
  return {x:out?.92:.08,y:out&&count===1?.5:.17+.66*((index+.5)/Math.max(1,count))};
 }
 function axis(slots,coordinate,size){
  const widths=new Map();for(const s of slots)widths.set(s.n[coordinate],Math.max(widths.get(s.n[coordinate])||0,s.body[size]));
  const values=[...widths.keys()].sort((a,b)=>a<b?-1:a>b?1:0),positions=new Map();let end=0;
  values.forEach((v,i)=>{if(i)end+=Math.max(Math.min(4,Number(v-values[i-1])),widths.get(values[i-1]));positions.set(v,end);});
  return {positions,widths,size:values.length?end+widths.get(values.at(-1)):0};
 }
 function layout(c){
  const old=cache.get(c);if(old&&old.dependencies.every(([model,v])=>model.topologyVersion===v))return old;
  const graph=new Map(),sources=[],sinks=new Map(),dependencies=[],allNodes=new Map();
  const link=(a,b)=>{if(!graph.has(a))graph.set(a,[]);graph.get(a).push(b);};
  function visit(model,path,depth){
   dependencies.push([model,model.topologyVersion]);const inputs=[...model.nodes.values()].filter(ioIn).sort(sortPins),outputs=[...model.nodes.values()].filter(ioOut).sort(sortPins),slots=[];
   for(const w of model.wires.values())link(endpoint(path,w.from,'out',w.fromPort||0),endpoint(path,w.to,'in',w.port));
   for(const n of model.nodes.values()){
    if(ioIn(n)||ioOut(n)||n.type==='COMMENT')continue;
    if(n.type==='CHIP'&&depth<16){const child=model.children.get(n.id);if(!child)continue;const body=visit(child,[...path,n.id],depth+1);
     n.pinsIn.forEach((pin,i)=>link(endpoint(path,n.id,'in',i),endpoint([...path,n.id],pin.nodeId,'out',0)));
     n.pinsOut.forEach((pin,i)=>link(endpoint([...path,n.id],pin.nodeId,'in',0),endpoint(path,n.id,'out',i)));
     if(body.nodes.length)slots.push({n,body});continue;
    }
    if(tunnels.has(n.type)){
     const peer=model.peers.get(n.id);
     if(n.type==='RECEIVETUNNEL'){if(peer)for(let i=0;i<n.inputs;i++)link(endpoint(path,peer,'in',i),endpoint(path,n.id,'out',i));}
     else if(n.type!=='SENDTUNNEL')for(let i=0;i<root.Logic.inputCount(n);i++){const from=model.incoming.get(n.id)?.[i]?n.id:peer;if(from)link(endpoint(path,from,'in',i),endpoint(path,n.id,'out',i));}
     continue;
    }
    const key=JSON.stringify([...path,n.id]),visual={key,id:n.id,path:[...path],type:n.type,x:0,y:0,w:1,h:1};allNodes.set(key,visual);
    for(let i=0;i<root.Logic.outputCount(n);i++)sources.push({vertex:endpoint(path,n.id,'out',i),kind:'node',node:key,port:i,path:[...path],id:n.id});
    for(let i=0;i<root.Logic.inputCount(n);i++)sinks.set(endpoint(path,n.id,'in',i),{kind:'node',node:key,port:i});
    slots.push({n,body:{nodes:[visual],w:1,h:1}});
   }
   const groups=new Map();for(const s of slots){if(!groups.has(s.n.layer))groups.set(s.n.layer,[]);groups.get(s.n.layer).push(s);}
   const panels=[...groups].sort((a,b)=>a[0]-b[0]).map(([layer,items])=>({layer,items,ax:axis(items,'x','w'),ay:axis(items,'y','h')}));
   const cols=Math.max(1,Math.ceil(Math.sqrt(panels.length))),rows=Math.ceil(panels.length/cols),cw=Array(cols).fill(0),rh=Array(rows).fill(0),gap=panels.length>1?1:0,header=panels.length>1?.5:0;
   panels.forEach((p,i)=>{cw[i%cols]=Math.max(cw[i%cols],p.ax.size+gap);rh[Math.floor(i/cols)]=Math.max(rh[Math.floor(i/cols)],p.ay.size+gap+header);});
   const sum=(a,end)=>a.slice(0,end).reduce((v,n)=>v+n,0),nodes=[];
   panels.forEach((p,i)=>{p.x=sum(cw,i%cols);p.y=sum(rh,Math.floor(i/cols));p.w=p.ax.size;p.h=p.ay.size+header;
    for(const s of p.items){const dx=p.x+p.ax.positions.get(s.n.x)+(p.ax.widths.get(s.n.x)-s.body.w)/2,dy=p.y+header+p.ay.positions.get(s.n.y)+(p.ay.widths.get(s.n.y)-s.body.h)/2;for(const node of s.body.nodes){node.x+=dx;node.y+=dy;nodes.push(node);}}
   });
   return {nodes,inputs,outputs,panels,w:Math.max(1,sum(cw,cw.length)-gap),h:Math.max(1,sum(rh,rh.length)-gap)};
  }
  const body=visit(c,[],0);
  body.inputs.forEach((n,i)=>sources.push({vertex:endpoint([],n.id,'out',0),kind:'input',port:i,path:[],id:n.id}));
  body.outputs.forEach((n,i)=>sinks.set(endpoint([],n.id,'in',0),{kind:'output',port:i}));
  const wires=[];
  for(const source of sources){const queue=[source.vertex],seen=new Set(queue);for(let head=0;head<queue.length;head++){
   const at=queue[head],sink=sinks.get(at);if(sink){wires.push({from:source,to:sink});continue;}
   for(const next of graph.get(at)||[])if(!seen.has(next)){seen.add(next);queue.push(next);}
  }}
  const result={...body,nodes:allNodes,wires,dependencies,version:c.topologyVersion};cache.set(c,result);return result;
 }
 function circuitAt(c,path){for(const id of path){c=c?.children.get(id);if(!c)return null;}return c;}
 function inputLeads(ctx,model,n,x,y,size,colors){
  const count=root.Logic.inputCount(n);ctx.lineWidth=Math.max(.85,size*.017);ctx.lineCap='round';ctx.lineJoin='round';
  for(let i=0;i<count;i++){
   const yy=17+66*((i+.5)/count),entry=count>4?26+48*((i+.5)/count):yy,t=(entry-25)/50,isAnd=n.type==='AND'||n.type==='NAND',xx=n.type==='NOT'?32:n.type==='REGISTER'||isAnd?28:(n.type==='XOR'?18:25)+40*t*(1-t);
   ctx.strokeStyle=model.word(n.id,i)?colors.on:colors.off;ctx.beginPath();ctx.moveTo(x+size*.08,y+size*yy/100);
   if(count>4){ctx.lineTo(x+size*.12,y+size*yy/100);ctx.lineTo(x+size*.17,y+size*entry/100);}ctx.lineTo(x+size*xx/100,y+size*entry/100);ctx.stroke();
  }
 }
 function draw(ctx,c,owner,x,y,size,colors){
  if(!c||size<3)return;const d=layout(c),scale=Math.min(size*.68/d.w,size*.68/d.h),left=x+(size-d.w*scale)/2,top=y+(size-d.h*scale)/2;
  const point=(end,out)=>{if(end.kind==='input'||end.kind==='output'){const p=port(owner,end.kind==='output',end.port);return{x:x+p.x*size,y:y+p.y*size};}const r=d.nodes.get(end.node),n=circuitAt(c,r.path)?.nodes.get(r.id),p=port(n,out,end.port);return {x:left+(r.x+p.x)*scale,y:top+(r.y+p.y)*scale};};
  ctx.save();ctx.beginPath();ctx.rect(x+size*.08,y+size*.08,size*.84,size*.84);ctx.clip();
  for(const wire of d.wires){const a=point(wire.from,true),b=point(wire.to,false),model=circuitAt(c,wire.from.path),on=model?.signal(wire.from.id,wire.from.port)||0;ctx.strokeStyle=on?colors.on:colors.off;ctx.lineWidth=Math.max(.6,Math.min(1.6,scale*.035));ctx.beginPath();ctx.moveTo(a.x,a.y);
   if(Math.abs(a.y-b.y)<.5)ctx.lineTo(b.x,b.y);else{const bend=a.x<=b.x?(a.x+b.x)/2:a.x+scale*.3;ctx.lineTo(bend,a.y);ctx.lineTo(bend,b.y);ctx.lineTo(b.x,b.y);}ctx.stroke();
  }
  if(d.panels.length>1&&scale>=12){ctx.fillStyle=colors.muted;ctx.font=`${Math.min(11,scale*.22)}px Arial`;ctx.textAlign='left';ctx.textBaseline='top';for(const p of d.panels)ctx.fillText('L'+(p.layer+1),left+p.x*scale,top+p.y*scale);}
  for(const r of d.nodes.values()){
   const model=circuitAt(c,r.path),n=model?.nodes.get(r.id);if(!n)continue;const value=model.values.get(n.id)||0,nx=left+r.x*scale,ny=top+r.y*scale,ink=value?colors.on:colors.text;
   if(root.Logic.GATES.includes(n.type)||n.type==='PULSE'||n.type==='REGISTER'){root.GateSymbols.draw(ctx,n.type,root.Logic.inputCount(n),nx,ny,scale,ink);inputLeads(ctx,model,n,nx,ny,scale,colors);continue;}
   if(n.type==='RGB'){ctx.beginPath();ctx.arc(nx+scale*.5,ny+scale*.5,scale*.22,0,Math.PI*2);ctx.fillStyle='#'+value.toString(16).padStart(6,'0');ctx.fill();ctx.strokeStyle=colors.line;ctx.stroke();continue;}
   ctx.strokeStyle=ink;ctx.lineWidth=Math.max(.6,scale*.015);ctx.beginPath();for(const output of [false,true]){const count=output?root.Logic.outputCount(n):root.Logic.inputCount(n);for(let i=0;i<count;i++){const p=port(n,output,i);ctx.moveTo(nx+p.x*scale,ny+p.y*scale);ctx.lineTo(nx+scale*(output?.72:.28),ny+p.y*scale);}}ctx.stroke();
   if(scale>=7){ctx.fillStyle=ink;ctx.font=`${scale*.13}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.type,nx+scale*.5,ny+scale*.5,scale*.5);}
  }
  ctx.restore();
 }
 function render(ctx,c,x,y,w,h,colors){const d=layout(c);draw(ctx,c,{pinsIn:d.inputs,pinsOut:d.outputs},x,y,Math.min(w,h),colors);}
 root.LogicChipView={layout,render,draw};if(typeof module!=='undefined')module.exports=root.LogicChipView;
})(globalThis);
