/* Compact, live schematics for custom nodes. Layouts survive signal changes. */
(function(root){
 'use strict';
 const cache=new WeakMap();
 function axis(values){
  const sorted=[...new Set(values)].sort((a,b)=>a<b?-1:a>b?1:0),positions=new Map();let offset=0;
  for(let i=0;i<sorted.length;i++){if(i)offset+=Math.min(4,Number(sorted[i]-sorted[i-1]));positions.set(sorted[i],offset);}
  return {positions,size:Math.max(1,offset)};
 }
 function extent(n){return n.type==='COMMENT'?{w:Math.ceil((n.commentWidth||3)+(n.commentOX||0)),h:Math.ceil((n.commentHeight||1.5)+(n.commentOY||0))}:{w:root.Logic.nodeSize(n),h:root.Logic.nodeSize(n)};}
 function port(n,output,index){
  const count=output?root.Logic.outputCount(n):root.Logic.inputCount(n);
  if(!output&&n.type==='RGBTUNNEL'){const side=Math.floor(index/6),f=.18+(index%6)*.128;return {x:side===0?f:side===1?.92:side===2?1-f:.08,y:side===0?.08:side===1?f:side===2?.92:1-f};}
  return {x:output?.92:.08,y:output&&count===1?.5:.17+.66*((index+.5)/Math.max(1,count))};
 }
 function layout(c){
  const old=cache.get(c);if(old&&old.version===c.topologyVersion)return old;
  const groups=new Map();for(const n of c.nodes.values()){if(!groups.has(n.layer))groups.set(n.layer,[]);groups.get(n.layer).push(n);}
  const panels=[...groups].sort((a,b)=>a[0]-b[0]).map(([layer,nodes])=>{
   const xs=[],ys=[];for(const n of nodes){const e=extent(n);xs.push(n.x,n.x+BigInt(e.w));ys.push(n.y,n.y+BigInt(e.h));}
   return {layer,nodes,ax:axis(xs),ay:axis(ys)};
  });
  const columns=Math.max(1,Math.ceil(Math.sqrt(panels.length))),rows=Math.ceil(panels.length/columns),cw=Array(columns).fill(0),rh=Array(rows).fill(0),head=panels.length>1?.6:0;
  panels.forEach((p,i)=>{cw[i%columns]=Math.max(cw[i%columns],p.ax.size+1);rh[Math.floor(i/columns)]=Math.max(rh[Math.floor(i/columns)],p.ay.size+1+head);});
  const sum=(a,end)=>a.slice(0,end).reduce((s,n)=>s+n,0),nodes=new Map();
  panels.forEach((p,i)=>{p.x=sum(cw,i%columns);p.y=sum(rh,Math.floor(i/columns));p.w=cw[i%columns];p.h=rh[Math.floor(i/columns)];
   for(const n of p.nodes){const e=extent(n),ox=n.type==='COMMENT'?(n.commentOX||0):0,oy=n.type==='COMMENT'?(n.commentOY||0):0,x=p.ax.positions.get(n.x),y=p.ay.positions.get(n.y);
    nodes.set(n.id,{id:n.id,x:p.x+.5+x+ox,y:p.y+.5+head+y+oy,w:Math.max(.1,p.ax.positions.get(n.x+BigInt(e.w))-x-ox),h:Math.max(.1,p.ay.positions.get(n.y+BigInt(e.h))-y-oy)});
   }
  });
  const wires=[];for(const w of c.wires.values()){const a=nodes.get(w.from),b=nodes.get(w.to);if(!a||!b)continue;const p=port(c.nodes.get(w.from),true,w.fromPort||0),q=port(c.nodes.get(w.to),false,w.port);wires.push({id:w.id,from:w.from,fromPort:w.fromPort||0,x1:a.x+p.x*a.w,y1:a.y+p.y*a.h,x2:b.x+q.x*b.w,y2:b.y+q.y*b.h});}
  const ordered=[...nodes.values()].sort((a,b)=>(c.nodes.get(a.id).type!=='COMMENT')-(c.nodes.get(b.id).type!=='COMMENT'));
  const result={version:c.topologyVersion,nodes,ordered,wires,panels,w:Math.max(1,sum(cw,cw.length)),h:Math.max(1,sum(rh,rh.length))};cache.set(c,result);return result;
 }
 function render(ctx,c,x,y,w,h,colors,depth=0){
  if(!c||depth>16||w<2||h<2)return;const d=layout(c),scale=Math.min(w/d.w,h/d.h),left=x+(w-d.w*scale)/2,top=y+(h-d.h*scale)/2;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  if(d.panels.length>1)for(const p of d.panels){ctx.strokeStyle=colors.line;ctx.lineWidth=.6;ctx.strokeRect(left+(p.x+.15)*scale,top+(p.y+.15)*scale,(p.w-.3)*scale,(p.h-.3)*scale);if(scale>=9){ctx.fillStyle=colors.muted;ctx.font=`${Math.min(12,scale*.36)}px Arial`;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText('L'+(p.layer+1),left+(p.x+.3)*scale,top+(p.y+.2)*scale);}}
  if(scale>=1.5)for(const wire of d.wires){ctx.strokeStyle=c.signal(wire.from,wire.fromPort)?colors.on:colors.off;ctx.lineWidth=Math.max(.5,Math.min(1.5,scale*.045));const a={x:left+wire.x1*scale,y:top+wire.y1*scale},b={x:left+wire.x2*scale,y:top+wire.y2*scale},bend=Math.max(scale*.25,Math.abs(b.x-a.x)*.45);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(a.x+bend,a.y,b.x-bend,b.y,b.x,b.y);ctx.stroke();}
  // Comments are behind the circuit, just as on the full canvas.
  for(const r of d.ordered){const n=c.nodes.get(r.id),v=c.values.get(n.id)||0,nx=left+r.x*scale,ny=top+r.y*scale,nw=r.w*scale,nh=r.h*scale,size=Math.min(nw,nh),ink=v?'#222222':colors.text;
   ctx.lineWidth=Math.max(.5,Math.min(1,scale*.025));ctx.fillStyle=n.type==='RGB'?'#'+v.toString(16).padStart(6,'0'):n.type==='COMMENT'?colors.bg:v?colors.on:colors.bg;ctx.strokeStyle=colors.line;
   ctx.beginPath();if(n.type==='RGB'||n.type==='SCREEN')ctx.rect(nx,ny,nw,nh);else ctx.roundRect(nx+nw*.08,ny+nh*.08,nw*.84,nh*.84,size*.055);ctx.fill();if(size>=2&&n.type!=='RGB')ctx.stroke();
   if(n.type==='CHIP'){render(ctx,c.children.get(n.id),nx+nw*.15,ny+nh*.15,nw*.7,nh*.7,colors,depth+1);continue;}
   if(size<5)continue;
   if(root.Logic.GATES.includes(n.type)||n.type==='PULSE'||n.type==='REGISTER')root.GateSymbols.draw(ctx,n.type,root.Logic.inputCount(n),nx,ny,size,ink);
   else if(size>=12){ctx.fillStyle=ink;ctx.font=`${size*(n.type==='INPUT'||n.type==='OUTPUT'?.22:.13)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.type==='COMMENT'?n.label:n.type==='INPUT'||n.type==='OUTPUT'?String(v):n.type,nx+nw/2,ny+nh/2,nw*.8);}
   if(size>=24&&n.type!=='COMMENT'&&n.label){ctx.fillStyle=colors.muted;ctx.font=`${Math.min(10,size*.1)}px Arial`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(n.label,nx+nw/2,ny+nh*.04,nw*1.5);}
   if(size>=12)for(const output of [false,true]){const count=output?root.Logic.outputCount(n):root.Logic.inputCount(n);for(let i=0;i<count;i++){const p=port(n,output,i),on=output?c.signal(n.id,i):c.word(n.id,i);ctx.beginPath();ctx.arc(nx+p.x*nw,ny+p.y*nh,Math.max(.7,Math.min(2,size*.03)),0,Math.PI*2);ctx.fillStyle=output?colors.bg:on?colors.on:colors.off;ctx.strokeStyle=on?colors.on:colors.off;ctx.fill();ctx.stroke();}}
  }
  ctx.restore();
 }
 function draw(ctx,c,owner,x,y,size,colors){
  if(!c)return;const d=layout(c),box={x:x+size*.145,y:y+size*.145,w:size*.71,h:size*.71},scale=Math.min(box.w/d.w,box.h/d.h),left=box.x+(box.w-d.w*scale)/2,top=box.y+(box.h-d.h*scale)/2;
  ctx.save();ctx.beginPath();ctx.rect(x+size*.085,y+size*.085,size*.83,size*.83);ctx.clip();
  for(const output of [false,true]){const pins=output?owner.pinsOut:owner.pinsIn;for(let i=0;i<(pins?.length||0);i++){const n=d.nodes.get(pins[i].nodeId);if(!n)continue;const p=port(owner,output,i);ctx.lineWidth=Math.max(.5,Math.min(1.2,size*.008));ctx.strokeStyle=c.values.get(pins[i].nodeId)?colors.on:colors.off;ctx.beginPath();ctx.moveTo(x+p.x*size,y+p.y*size);ctx.lineTo(left+(n.x+(output?.92:.08)*n.w)*scale,top+(n.y+n.h*.5)*scale);ctx.stroke();}}
  render(ctx,c,box.x,box.y,box.w,box.h,colors);ctx.restore();
 }
 root.LogicChipView={layout,render,draw};if(typeof module!=='undefined')module.exports=root.LogicChipView;
})(globalThis);
