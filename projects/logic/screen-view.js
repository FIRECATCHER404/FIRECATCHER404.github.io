/* RAM-backed displays. Pixel nodes share source lookup and color caches. */
(function(root){
 const circuits=new WeakMap(),textures=new WeakMap();
 function state(c){let s=circuits.get(c);if(!s){s={frame:0,sources:new Map()};circuits.set(c,s);}return s;}
 function source(c,n){const s=state(c),prefix=n.screenPrefix??'DATA';let t=s.sources.get(prefix);if(!t){t={frame:-1,topology:-1,stamp:0,keys:[],colors:new Uint32Array(65536),stamps:new Uint32Array(65536)};s.sources.set(prefix,t);}
  if(t.frame!==s.frame||t.topology!==c.topologyVersion){let changed=t.topology!==c.topologyVersion;if(changed){const byLabel=new Map([...c.nodes.values()].filter(m=>m.type==='RAM'&&m.addressBits===16).map(m=>[m.label,m]));t.planes=Array.from({length:16},(_,b)=>byLabel.get(`${prefix} bit${b}`));t.topology=c.topologyVersion;}
   const keys=t.planes.map(m=>m?[m.storage,m.memoryVersion]:null);changed=changed||keys.some((k,i)=>k===null?t.keys[i]!==null:!t.keys[i]||k[0]!==t.keys[i][0]||k[1]!==t.keys[i][1]);if(changed){t.stamp++;if(t.stamp===0xffffffff){t.stamps.fill(0);t.stamp=1;}t.keys=keys;}t.connected=t.planes.every(Boolean);t.frame=s.frame;
  }return t;
 }
 function color(c,t,a){if(t.stamps[a]!==t.stamp){let v=0;if(t.connected)for(let b=0;b<16;b++)v|=c.memoryBit(t.planes[b],a)<<b;t.colors[a]=(Math.floor(((v>>11)&31)*255/31)<<16)|(Math.floor(((v>>5)&63)*255/63)<<8)|Math.floor((v&31)*255/31);t.stamps[a]=t.stamp;}return t.colors[a];}
 root.LogicScreens={beginFrame(c){state(c).frame++;},draw(ctx,c,n,p,size,end={x:p.x+size,y:p.y+size}){const t=source(c,n),base=n.screenBase??49152;
  if(n.screenPixels===1){const v=color(c,t,base),hex='#'+v.toString(16).padStart(6,'0');ctx.fillStyle=hex;const ratio=Math.min(devicePixelRatio||1,2),x=Math.round(p.x*ratio)/ratio,y=Math.round(p.y*ratio)/ratio;ctx.fillRect(x,y,Math.round(end.x*ratio)/ratio-x,Math.round(end.y*ratio)/ratio-y);if(size>=40){ctx.fillStyle=(((v>>16)&255)*299+((v>>8)&255)*587+(v&255)*114)>128000?'#222':'#fff';ctx.textAlign='center';ctx.font=`${size*.12}px Arial`;ctx.fillText(hex.toUpperCase(),p.x+size/2,p.y+size*.55);}return;}
  let image=textures.get(n);if(!image){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;image={canvas,context:canvas.getContext('2d')};textures.set(n,image);}if(image.stamp!==t.stamp||image.source!==t||image.base!==base){const pixels=image.context.createImageData(128,128);for(let a=0;a<16384;a++){const v=color(c,t,base+a),i=a*4;pixels.data[i]=v>>16;pixels.data[i+1]=(v>>8)&255;pixels.data[i+2]=v&255;pixels.data[i+3]=255;}image.context.putImageData(pixels,0,0);image.stamp=t.stamp;image.source=t;image.base=base;}ctx.imageSmoothingEnabled=false;const ratio=Math.min(devicePixelRatio||1,2),x=Math.round(p.x*ratio)/ratio,y=Math.round(p.y*ratio)/ratio;ctx.drawImage(image.canvas,x,y,Math.round(end.x*ratio)/ratio-x,Math.round(end.y*ratio)/ratio-y);
 }};
})(globalThis);
