/* Reusable gate circuits, typed buses and circuit-controlled keyboard input. */
(function(root){'use strict';const L=typeof module==='object'&&module.exports?require('./engine.js'):root.Logic;
const {Circuit,inputWidth,outputWidth,comparePosition}=L;
function pins(data){
 const list=(data.nodes||[]).map(n=>({...n,x:BigInt(n.x||0),y:BigInt(n.y||0)})).sort(comparePosition);
 const get=(types,prefix)=>{const seen=new Set();return list.filter(n=>types.includes(n.type)).map((n,i)=>{const name=n.label?.trim()||prefix+(i+1);if(seen.has(name))throw Error('Give each chip pin a unique label.');seen.add(name);return {nodeId:n.id,name,width:n.type.startsWith('BUS')?(n.bits||8):1};});};
 const inputs=get(['INPUT','BUSINPUT'],'IN'),outputs=get(['OUTPUT','BUSOUTPUT'],'OUT');
 if(inputs.length>16||!outputs.length||outputs.length>16)throw Error('A chip needs 1–16 outputs and up to 16 inputs. Use INPUT / OUTPUT or BUSINPUT / BUSOUTPUT as pins.');
 return {inputs,outputs};
}
L.chipPins=pins;
Circuit.prototype.prepareChip=function(n){if(n.type!=='CHIP')return;const d=this.chips.get(n.chipId);if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>80||!d.circuit)throw Error('Chip definition is missing or invalid.');const p=pins(d.circuit);n.pinsIn=p.inputs;n.pinsOut=p.outputs;};
Circuit.prototype.prepareChips=function(){
 this.advancedNodes=[...this.nodes.values()].filter(n=>['CHIP','COMMAND'].includes(n.type));
 for(const id of this.children.keys())if(this.nodes.get(id)?.type!=='CHIP')this.children.delete(id);
 for(const n of this.nodes.values())if(n.type==='CHIP'){this.prepareChip(n);if(!this.children.has(n.id)){const d=this.chips.get(n.chipId),child=Circuit.fromJSON(n.chipState||d.circuit);for(const p of [...n.pinsIn,...n.pinsOut]){const q=child.nodes.get(p.nodeId);if(!q||q.type!==d.circuit.nodes.find(q=>q.id===p.nodeId)?.type||(q.bits||1)!==p.width)throw Error('Chip state has an incompatible interface.');}this.children.set(n.id,child);delete n.chipState;}}
};
let depth=0;const load=Circuit.fromJSON;Circuit.fromJSON=function(data){if(++depth>16){depth--;throw Error('Chip nesting exceeds 16 levels.');}try{return load.call(this,data);}finally{depth--;}};
Circuit.prototype.signal=function(id,p=0,values=this.values){const n=this.nodes.get(id);if(!n)return 0;if(n.type==='SPLIT')return ((values.get(id)||0)>>p)&1;if(n.type==='CHIP')return this.children.get(id)?.values.get(n.pinsOut[p]?.nodeId)||0;return values.get(id)||0;};
Circuit.prototype.word=function(id,p=0,values=this.values){const w=this.incoming.get(id)?.[p];return w?this.signal(w.from,w.fromPort||0,values):0;};
Circuit.prototype.evaluateAdvanced=function(n,values){switch(n.type){
 case 'BUSINPUT':return n.driven??n.busValue;
 case 'BUSOUTPUT':case 'SPLIT':return this.word(n.id,0,values);
 case 'JOIN':{let v=0;for(let b=0;b<n.bits;b++)v|=this.bit(n.id,b,values)<<b;return v;}
 case 'KEYBOARD':return +(this.keyboardCaptured&&this.keyDown.has(n.keyCode));
 case 'COMMAND':return +this.keyboardCaptured;
 case 'CHIP':{const c=this.children.get(n.id);if(!c)return 0;const before=n.pinsOut.map(p=>c.values.get(p.nodeId)||0);n.pinsIn.forEach((p,i)=>{const q=c.nodes.get(p.nodeId),v=this.word(n.id,i,values);if(q.driven!==v){q.driven=v;c.needsSettle=true;}});if(c.needsSettle){const r=c.settle(undefined,false);if(!r.stable)this.childUnstable=true;}this.portsChanged=n.pinsOut.some((p,i)=>(c.values.get(p.nodeId)||0)!==before[i]);return c.values.get(n.pinsOut[0].nodeId)||0;}
}};
Circuit.prototype.captureOnly=function(){
 const rs=[...this.registers].map(id=>{const n=this.nodes.get(id);return [n,this.sampleRegister(n)];});
 const ms=[...this.memories].map(id=>{const n=this.nodes.get(id);return [n,this.sampleMemory(n)];});
 let changed=this.captureAdvanced().length>0;
 for(const[n,s]of rs){n.clock=s.clock;if((this.values.get(n.id)||0)!==s.value){this.values.set(n.id,s.value);changed=true;}}
 for(const[n,s]of ms)if(this.commitMemory(n,s))changed=true;
 if(changed)this.needsSettle=true;return changed;
};
Circuit.prototype.captureAdvanced=function(){const changed=[];for(const n of this.advancedNodes||[]){
 if(n.type==='COMMAND'){const clk=this.bit(n.id,0);if(clk&&!n.clock)this.commands.push(n.command);n.clock=clk;}
 if(n.type==='CHIP'&&this.children.get(n.id).captureOnly())changed.push(n.id);
}return changed;};
Circuit.prototype.flipSources=function(){for(const id of this.pulses)this.values.set(id,1-(this.values.get(id)||0));for(const c of this.children.values())c.flipSources();this.needsSettle=true;};
Circuit.prototype.flipChildren=function(){const ids=[];for(const[id,c]of this.children)if(c.hasPulses()){c.flipSources();ids.push(id);}return ids;};
Circuit.prototype.hasPulses=function(){return this.pulses.size>0||[...this.children.values()].some(c=>c.hasPulses());};
Circuit.prototype.setKeyboard=function(captured,keys=[]){this.keyboardCaptured=!!captured;this.keyDown=new Set(keys);this.needsSettle=true;for(const c of this.children.values())c.setKeyboard(captured,keys);};
Circuit.prototype.takeCommands=function(){const q=this.commands.splice(0);for(const c of this.children.values())q.push(...c.takeCommands());return q;};
Circuit.prototype.createChip=function(name,ids){
 if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('Use a chip name of 1–80 characters.');
 const chosen=new Set(ids);if(!chosen.size)throw Error('Select the circuit nodes first. Left-drag empty canvas to select all node types.');
 const data=this.toJSON();data.nodes=data.nodes.filter(n=>chosen.has(n.id));data.wires=data.wires.filter(w=>chosen.has(w.from)&&chosen.has(w.to));data.signals=data.signals.filter(([id])=>chosen.has(id));data.groups=data.groups.filter(g=>g.nodeIds.every(id=>chosen.has(id)));data.name=name.trim();if(data.chips){const used=new Set(data.nodes.filter(n=>n.type==='CHIP').map(n=>n.chipId));data.chips=data.chips.filter(d=>used.has(d.id));}
 const p=pins(data);Circuit.fromJSON(data);const id=this.id('chip');const def={id,name:name.trim(),circuit:data};this.chips.set(id,def);return def;
};
L.validateChip=function(def){if(!def||typeof def.name!=='string'||!def.name.trim()||def.name.length>80)throw Error('Invalid chip file.');pins(def.circuit);Circuit.fromJSON(def.circuit);return def;};
if(typeof module==='object'&&module.exports)module.exports=L;
})(typeof globalThis!=='undefined'?globalThis:this);
