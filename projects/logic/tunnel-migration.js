/* Upgrade old bus-width directional tunnels without dropping any bus bits. */
(function(root){
 'use strict';
 function migrate(data){
  const wide=n=>['SENDTUNNEL','RECEIVETUNNEL'].includes(n.type)&&[8,16].includes(n.channelBits);
  if(!Array.isArray(data?.nodes)||!data.nodes.some(wide))return data;
  const j=JSON.parse(JSON.stringify(data)),original=j.nodes,oldWires=j.wires||[],ids=new Set([...original,...oldWires,...(j.groups||[]),...(j.chips||[])].map(n=>n.id));
  let sequence=j.nextId||1;const fresh=()=>{let id;do{id='tunnelbit'+sequence++;}while(ids.has(id));ids.add(id);return id;};
  const occupied=new Set(),key=(l,x,y)=>`${l}:${x}:${y}`;
  for(const n of original)if(n.type!=='COMMENT'){const size=n.type==='SCREEN'&&n.screenPixels!==1?8:1;for(let y=0;y<size;y++)for(let x=0;x<size;x++)occupied.add(key(n.layer||0,BigInt(n.x||0)+BigInt(x),BigInt(n.y||0)+BigInt(y)));}
  const near=n=>{for(let radius=1;radius<=1024;radius++)for(let k=-radius;k<=radius;k++)for(const[dx,dy]of[[k,-radius],[k,radius],[-radius,k],[radius,k]]){const x=BigInt(n.x||0)+BigInt(dx),y=BigInt(n.y||0)+BigInt(dy),at=key(n.layer||0,x,y);if(!occupied.has(at)){occupied.add(at);return{x:String(x),y:String(y)};}}throw Error('No free space to convert an old bus tunnel.');};
  for(const n of original)if(wide(n)){n.inputs??=2;if(!Number.isInteger(n.inputs)||n.inputs<1||n.inputs>16)throw Error('Invalid old tunnel channel count.');if(n.portValues&&(!Array.isArray(n.portValues)||n.portValues.length!==n.inputs||n.portValues.some(v=>!Number.isInteger(v)||v<0||v>=2**n.channelBits)))throw Error('Invalid old tunnel channel state.');}
  const senders=new Map(),splits=new Map(),joins=new Map(),extra=[],wires=[],signals=new Map(j.signals||[]),nodes=original.filter(n=>!wide(n));
  const wire=(from,to,port=0,fromPort=0)=>wires.push({id:fresh(),from,to,port,fromPort});
  for(const n of original)if(n.type==='SENDTUNNEL'&&wide(n)){
   const group=[];senders.set(n.id,{node:n,group});
   for(let p=0;p<n.inputs;p++){
    const id=p?fresh():n.id,sender={...n,id,...(p?near(n):{}),inputs:n.channelBits,channelBits:1,portValues:Array.from({length:n.channelBits},(_,bit)=>((n.portValues?.[p]??(p?0:signals.get(n.id)||0))>>bit)&1),label:(n.label||'Send')+(n.inputs>1?' '+(p+1):'')};nodes.push(sender);group.push(id);signals.set(id,sender.portValues[0]);
    if(oldWires.some(w=>w.to===n.id&&(w.port??0)===p)){
     const split=fresh();splits.set(`${n.id}:${p}`,split);extra.push({id:split,type:'SPLIT',bits:n.channelBits,layer:n.layer||0,...near(n),label:'Split '+(p+1)});
     for(let bit=0;bit<n.channelBits;bit++)wire(split,id,bit,bit);
    }
   }
  }
  for(const n of original)if(n.type==='RECEIVETUNNEL'&&wide(n)){
   const source=senders.get(n.sourceId),linked=source&&source.node.inputs===n.inputs&&source.node.channelBits===n.channelBits&&(source.node.layer||0)+(source.node.direction??(source.node.layer===255?-1:1))===(n.layer||0),group=[];joins.set(n.id,group);
   for(let p=0;p<n.inputs;p++){
    const join=p?fresh():n.id,receive=fresh(),value=n.portValues?.[p]??(p?0:signals.get(n.id)||0);group.push(join);
    nodes.push({id:join,type:'JOIN',bits:n.channelBits,layer:n.layer||0,...(p?near(n):{x:n.x||'0',y:n.y||'0'}),label:(n.label||'Receive')+(n.inputs>1?' '+(p+1):'')});signals.set(join,value);
    extra.push({id:receive,type:'RECEIVETUNNEL',sourceId:linked?source.group[p]:'',inputs:n.channelBits,channelBits:1,layer:n.layer||0,direction:n.direction??(n.layer===255?-1:1),...near(n),portValues:Array.from({length:n.channelBits},(_,bit)=>(value>>bit)&1)});signals.set(receive,value&1);
    for(let bit=0;bit<n.channelBits;bit++)wire(receive,join,bit,bit);
   }
  }
  for(const old of oldWires){const w={...old};if(senders.has(w.to)){const split=splits.get(`${w.to}:${w.port??0}`);if(!split)throw Error('Invalid old tunnel input.');w.to=split;w.port=0;}if(joins.has(w.from)){w.from=joins.get(w.from)[w.fromPort||0];w.fromPort=0;if(!w.from)throw Error('Invalid old tunnel output.');}wires.push(w);}
  j.nodes=[...nodes,...extra];j.wires=wires;j.signals=[...signals];j.nextId=sequence;return j;
 }
 root.LogicTunnelMigration={migrate};if(typeof module==='object'&&module.exports)module.exports={migrate};
})(globalThis);
