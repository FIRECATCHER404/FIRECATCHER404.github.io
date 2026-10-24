/* Byte-oriented programming controls for the real gate-built CPU. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./assembler16.js'):root.LogicAssembler16);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicMachine=api;})(globalThis,function(assembler){
 'use strict';
 const samples=[
  {name:'RAM calculation: 6 × 7',source:'LDX 6\nLDI 0\nloop:\nADD 7\nSTA $8000\nDEX\nTXA\nJZ done\nLDA $8000\nJMP loop\ndone:\nLDA $8000\nOUT\nHLT'},
  {name:'Live input → RAM and OUT',source:'loop:\nIN\nSTA $8000\nOUT\nJMP loop'},
  {name:'Moving screen pixel',source:'CLEAR 0\nLDX 0\nloop:\nPLOT $F800\nLDY 300\nwait:\nTYA\nSUB 1\nTAY\nJNZ wait\nPLOT 0\nINX\nTXA\nAND $3FFF\nTAX\nJMP loop'},
  {name:'Screen gradient',source:assembler.DEMO16}
 ].map(s=>({...s,words:assembler.assemble16(s.source).words}));
 function trim(words){let end=words.length;while(end>2&&words[end-1]===0)end--;return words.slice(0,Math.min(words.length,(end+1)&~1));}
 function parse(text,bits=16){if(typeof text!=='string'||text.length>1048576)throw Error('Program text is too large.');const tokens=text.split(/\r?\n/).map(s=>s.split(';')[0]).join(' ').trim().split(/[\s,]+/).filter(Boolean);if(!tokens.length||tokens.some(s=>!/^(?:0x)?[\da-f]{1,2}$/i.test(s)))throw Error('Enter individual hex bytes 00–FF. Select Hex words for values such as BEEF.');const bytes=tokens.map(s=>parseInt(s.replace(/^0x/i,''),16));if(bits!==16)return bytes;if(bytes.length%4)throw Error('Each instruction needs four bytes: OP 00 LOW HIGH.');if(bytes.length>131072)throw Error('The program ROM holds 131072 bytes.');return Array.from({length:bytes.length/2},(_,i)=>bytes[i*2]|bytes[i*2+1]<<8);}
 function bytes(words,bits=16){return bits===16?words.flatMap(v=>[v&255,v>>8]):[...words];}
 function format(words,bits=16){return bytes(words,bits).map((v,i)=>v.toString(16).padStart(2,'0').toUpperCase()+((i+1)%(bits===16?4:8)?' ':'\n')).join('').trim();}
 const cache=new WeakMap();
 function layout(c){let t=cache.get(c);if(!t||t.version!==c.topologyVersion){t={version:c.topologyVersion,labels:new Map([...c.nodes.values()].map(n=>[n.label,n])),groups:new Map([...c.groups.values()].map(g=>[g.title,g]))};cache.set(c,t);}return t;}
 function settle(c){if(!c.settle().stable)throw Error('The CPU circuit did not settle.');}
 function running(c,on){const g=layout(c).groups.get('01 RUN');if(!g)throw Error('Open the programmable computer first.');c.setGroupBits(g.id,on?'1':'0');const step=[...c.groups.values()].find(g=>g.title.startsWith('03 STEP'));if(step)c.setGroupBits(step.id,'0');settle(c);}
 function step(c){running(c,false);const g=[...c.groups.values()].find(g=>g.title.startsWith('03 STEP'));if(!g)throw Error('The CPU step input is missing.');c.setGroupBits(g.id,'1');settle(c);c.setGroupBits(g.id,'0');settle(c);}
 function input(c,value,bits=16){const g=layout(c).groups.get('04 INPUT WORD');if(!g||!Number.isInteger(value)||value<0||value>=2**bits)throw Error('Use an input word from 0000 to FFFF.');c.setGroupBits(g.id,value.toString(2).padStart(bits,'0'));settle(c);}
 function ram(c,address,bits=16){if(!Number.isInteger(address)||address<0||address>=2**bits)throw Error('Invalid RAM word address.');let value=0;for(let b=0;b<bits;b++){const n=layout(c).labels.get('DATA bit'+b);if(!n||n.type!=='RAM')throw Error('This computer needs its RAM planes.');value|=c.memoryBit(n,address)<<b;}return value;}
 function status(c,bits=16){const t=layout(c),word=prefix=>{let v=0;for(let b=0;b<bits;b++)v|=(c.values.get(t.labels.get(prefix+b)?.id)||0)<<b;return v;};return {pc:word('PC'),a:word('A'),x:word('X'),y:word('Y'),out:word('OUT'),carry:c.values.get(t.labels.get('CARRY0')?.id)||0,halted:!!c.values.get(t.labels.get('HALT0')?.id),running:!!t.groups.get('01 RUN')&&/1/.test(c.groupBits(t.groups.get('01 RUN').id))};}
 return {samples,trim,parse,bytes,format,running,step,input,ram,status};
});
