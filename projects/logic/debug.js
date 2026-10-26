/* Non-driving signal observers and session component-library management. */
(function(root){
 'use strict';
 const L=typeof module==='object'&&module.exports?require('./engine.js'):root.Logic;
 const C=L.Circuit,limit=2000;
 const observable=n=>n&&!['LOG','COMMENT','SCREEN'].includes(n.type)&&(L.outputCount(n)>0||['OUTPUT','BUSOUTPUT','RGB','RGBTUNNEL','SENDTUNNEL'].includes(n.type));
 const rebuild=C.prototype.rebuild;
 C.prototype.rebuild=function(){
  for(const n of this.nodes.values())if(n.type==='LOG'&&n.targetId){const t=this.nodes.get(n.targetId);if(t){n.x=t.x;n.y=t.y;n.layer=t.layer;}else{n.targetId='';n.logHigh=0;}}
  rebuild.call(this);this.logNodes=[...this.nodes.values()].filter(n=>n.type==='LOG');this.logs??=[];
  for(const n of this.logNodes)if(n.targetId){const t=this.nodes.get(n.targetId);if(!observable(t)||n.targetPort>=Math.max(1,L.outputCount(t))){n.targetId='';n.logHigh=0;}}
 };
 C.prototype.attachLog=function(id,targetId,port=0){
  const n=this.nodes.get(id),t=this.nodes.get(targetId);
  if(n?.type!=='LOG'||!observable(t)||t.layer!==n.layer||!Number.isInteger(port)||port<0||port>=Math.max(1,L.outputCount(t)))throw Error('Attach the log handle to a signal node on this layer.');
  this.updateNode(id,{targetId,targetPort:port,logHigh:0,x:t.x,y:t.y});
 };
 C.prototype.detachLog=function(id,x,y){const n=this.nodes.get(id);if(n?.type!=='LOG')throw Error('Log node not found.');this.updateNode(id,{targetId:'',targetPort:0,logHigh:0,x:x??n.x,y:y??n.y});};
 C.prototype.observeLogs=function(){
  for(const n of this.logNodes||[]){const t=this.nodes.get(n.targetId),value=t?this.signal(t.id,n.targetPort):0,high=+(value===1);
   if(t&&high&&!n.logHigh){this.logs.push({message:n.label,nodeId:t.id,nodeLabel:t.label||t.type,logId:n.id,layer:t.layer,port:n.targetPort,value});if(this.logs.length>limit)this.logs.splice(0,this.logs.length-limit);}
   n.logHigh=high;
  }
 };
 for(const name of ['settle','step']){const original=C.prototype[name];C.prototype[name]=function(...args){const result=original.apply(this,args);this.observeLogs();return result;};}
 C.prototype.takeLogs=function(){const rows=(this.logs||[]).splice(0);for(const[id,c]of this.children){for(const row of c.takeLogs())rows.push({...row,path:id+(row.path?'/'+row.path:'')});}return rows.slice(-limit);};
 C.prototype.removeChip=function(id){const d=this.chips.get(id);if(!d)throw Error('Chip not found.');if([...this.nodes.values()].some(n=>n.type==='CHIP'&&n.chipId===id))d.hidden=true;else this.chips.delete(id);};
 L.logObservable=observable;
})(globalThis);
