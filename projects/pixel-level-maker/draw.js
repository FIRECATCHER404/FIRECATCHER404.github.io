import{MATERIALS,colorHex}from'./model.js';
const artCache=new WeakMap();
export function invalidateArt(r){artCache.delete(r);}
export function artwork(r){let c=artCache.get(r);if(c)return c;c=document.createElement('canvas');c.width=r.width*r.artScale;c.height=r.height*r.artScale;const ctx=c.getContext('2d'),data=ctx.createImageData(c.width,c.height);for(let i=0;i<r.art.length;i++){const n=r.art[i];if(!n)continue;const rgb=n-1;data.data[i*4]=rgb>>16&255;data.data[i*4+1]=rgb>>8&255;data.data[i*4+2]=rgb&255;data.data[i*4+3]=255;}ctx.putImageData(data,0,0);artCache.set(r,c);return c;}
function rect(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function marker(ctx,t,active=true){if(t.marker==='none')return;ctx.save();if(!active)ctx.globalAlpha=.4;const x=t.x+t.w/2,y=t.y+t.h/2,c=t.color;
 if(t.marker==='lever'){rect(ctx,x-.65,y-.1,1.3,.9,'#4a4344');rect(ctx,x-.45,y-.3,.9,.4,'#bd9e65');rect(ctx,x-.1,y-1,.2,1,'#ecd4a0');rect(ctx,x-.35,y-1.15,.7,.4,active?c:'#8d8790');}
 if(t.marker==='chest'){rect(ctx,x-1.4,y-.8,2.8,1.8,'#533e39');rect(ctx,x-1.2,y-.6,2.4,1.3,'#a8734f');rect(ctx,x-1.2,y-.6,2.4,.4,c);rect(ctx,x-.18,y-.05,.36,.5,'#f0d387');rect(ctx,x-1.35,y+.65,2.7,.25,'#382e35');}
 if(t.marker==='rune'){rect(ctx,x-.85,y-.85,1.7,1.7,'#516165');rect(ctx,x-.15,y-.7,.3,1.4,c);rect(ctx,x-.7,y-.15,1.4,.3,c);rect(ctx,x-.4,y-.4,.8,.8,c);rect(ctx,x-.15,y-.15,.3,.3,'#f4e3ab');}
 if(t.marker==='doorway'){const w=Math.min(t.w,4),h=Math.min(t.h,6),l=x-w/2,top=t.y+t.h-h;rect(ctx,l,top+.4,w,h-.4,'#202631');rect(ctx,l+.35,top,w-.7,h,'#202631');rect(ctx,l,top+.6,.4,h-.6,c);rect(ctx,l+w-.4,top+.6,.4,h-.6,c);rect(ctx,l+.4,top,w-.8,.4,c);rect(ctx,l+.15,top+.3,.5,.4,c);rect(ctx,l+w-.65,top+.3,.5,.4,c);rect(ctx,l+.6,top+h-.4,w-1.2,.3,active?'#cfbd86':'#747379');}
 ctx.restore();}
export function drawRoom(ctx,r,options={}){
 const{physics=false,opacity=1,showEntities=true,game=null}=options;
 rect(ctx,0,0,r.width,r.height,r.background);
 if(physics){ctx.save();ctx.globalAlpha=.2;ctx.drawImage(artwork(r),0,0,r.width,r.height);ctx.restore();for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){ctx.fillStyle=MATERIALS[r.cells[y*r.width+x]].color;ctx.globalAlpha=opacity;ctx.fillRect(x,y,1,1);}ctx.globalAlpha=1;}
 else ctx.drawImage(artwork(r),0,0,r.width,r.height);
 if(!showEntities)return;
 for(const d of r.doors){const open=game?game.doors[d.id]:d.open;if(physics){rect(ctx,d.x,d.y,d.w,d.h,open?'#8c7153':'#f0b55e');continue;}if(!d.visible)continue;if(open){rect(ctx,d.x,d.y,.25,d.h,d.color);rect(ctx,d.x+d.w-.25,d.y,.25,d.h,d.color);continue;}rect(ctx,d.x,d.y,d.w,d.h,'#544739');rect(ctx,d.x+.15,d.y+.1,d.w-.3,d.h-.2,d.color);for(let x=d.x+.5;x<d.x+d.w;x+=.6)rect(ctx,x,d.y+.1,.08,d.h-.2,'#95704b');rect(ctx,d.x+.1,d.y+.5,d.w-.2,.15,'#564a43');rect(ctx,d.x+.1,d.y+d.h-.7,d.w-.2,.15,'#564a43');rect(ctx,d.x+d.w-.65,d.y+d.h*.55,.24,.24,'#f4d98b');}
 for(const t of r.triggers){if(physics){ctx.globalAlpha=t.enabled?.66:.28;rect(ctx,t.x,t.y,t.w,t.h,t.color);ctx.globalAlpha=1;}else marker(ctx,t,game?game.enabled[t.id]&&!(t.once&&game.fired.includes(t.id)):t.enabled);}
}
export function drawPhysicalOverlay(ctx,r,opacity=.35){ctx.save();ctx.globalAlpha=opacity;for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){ctx.fillStyle=MATERIALS[r.cells[y*r.width+x]].color;ctx.fillRect(x,y,1,1);}ctx.restore();}
const playerPixels=['...hhhh...','..hhhhhh..','..hffffh..','...ffff...','...ssss...','..cccccc..','.cccccccc.','.fccccccf.','..cccccc..','...bbbb...','...b..b...','...k..k...'];
export function drawPlayer(ctx,g,ghost=false){const unit=.22,x=g.x-1.1,y=g.y-2.45;ctx.save();ctx.globalAlpha=ghost?.7:g.cooldown>0&&Math.floor(g.cooldown*12)%2?.45:1;rect(ctx,g.x-.65,g.y-.05,1.3,.3,'#222b32');const colors={h:'#453a43',f:'#e7b782',s:'#f2d7a0',c:'#a3c7af',b:'#526476',k:'#333a4c'};const bob=g.moving&&Math.sin(g.time*14)>0?.12:0;for(let j=0;j<playerPixels.length;j++)for(let i=0;i<10;i++){const v=playerPixels[j][i];if(v!=='.')rect(ctx,x+i*unit,y+j*unit-bob,unit,unit,colors[v]);}if(g.direction==='down'){rect(ctx,x+3*unit,y+2.6*unit,unit*.65,unit*.7,'#403a42');rect(ctx,x+6*unit,y+2.6*unit,unit*.65,unit*.7,'#403a42');}ctx.restore();}
export function selectionBox(ctx,o,unit,color='#f8e3a2'){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2/unit;ctx.setLineDash([5/unit,4/unit]);ctx.strokeRect(o.x,o.y,o.w,o.h);ctx.setLineDash([]);ctx.restore();}
