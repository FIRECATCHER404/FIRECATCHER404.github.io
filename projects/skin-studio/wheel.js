/* Orthographic skin cuboids for wheel thumbnails, using Minecraft skin UVs. */
(function(root){
  'use strict';
  const X=240,Y=179,INNER=59,OUTER=142,RADIUS=103;
  const PADDING=3,layouts=new Map();
  function fits(x,y,size,angle,count){
    const cx=x+size/2-X,cy=y+size/2-Y,half=size/2;
    if(Math.hypot(Math.abs(cx)+half,Math.abs(cy)+half)>OUTER-PADDING)return false;
    if(Math.hypot(Math.max(0,Math.abs(cx)-half),Math.max(0,Math.abs(cy)-half))<INNER+PADDING)return false;
    if(count>1)for(const side of [-1,1]){const boundary=angle+side*Math.PI/count,nx=-side*Math.cos(boundary),ny=-side*Math.sin(boundary);if(cx*nx+cy*ny-half*(Math.abs(nx)+Math.abs(ny))<PADDING)return false;}
    return true;
  }
  function bounds(slot,count){
    count=Math.min(16,count);if(count<=0||slot<1||slot>count)return {x:X,y:Y,size:0};
    if(!layouts.has(count)){
      const entries=[];
      for(let index=1;index<=count;index++){
        const angle=(index-1)*Math.PI*2/count,sx=Math.sin(angle),sy=-Math.cos(angle);let best={x:X,y:Y,size:0},bestDistance=Infinity;
        for(let radius=INNER+PADDING;radius<=OUTER-PADDING;radius++){
          let low=0,high=OUTER-INNER;
          while(low<high){const size=Math.floor((low+high+1)/2),x=Math.round(X+sx*radius-size/2),y=Math.round(Y+sy*radius-size/2);if(fits(x,y,size,angle,count))low=size;else high=size-1;}
          const distance=Math.abs(radius-(INNER+OUTER)/2);
          if(low>best.size||low===best.size&&distance<bestDistance){best={x:Math.round(X+sx*radius-low/2),y:Math.round(Y+sy*radius-low/2),size:low};bestDistance=distance;}
        }
        entries.push(best);
      }
      layouts.set(count,entries);
    }
    return layouts.get(count)[slot-1];
  }
  function hit(x,y,count){count=Math.min(16,count);const dx=x-X,dy=y-Y,r=Math.hypot(dx,dy);return !count||r<INNER||r>OUTER?0:((Math.floor((Math.atan2(dx,-dy)+Math.PI/count)*count/(Math.PI*2))%count+count)%count)+1;}
  function thumbnail(ctx,image,entry,x,y,size,slim){
    if(!image?.complete||!image.naturalWidth)return;
    ctx.save();ctx.imageSmoothingEnabled=false;
    const mode=entry.preview || 'head';
    if(mode==='skin'){ctx.drawImage(image,0,0,64,64,x,y,size,size);ctx.restore();return;}
    if(mode==='face'){ctx.drawImage(image,8,8,8,8,x,y,size,size);ctx.drawImage(image,40,8,8,8,x,y,size,size);ctx.restore();return;}
    const parts=[['head',-4,-8,-4,8,8,8,0,0,32,0],['torso',-4,0,-2,8,12,4,16,16,0,16],
      ['right_arm',slim?-7:-8,0,-2,slim?3:4,12,4,40,16,0,16],['left_arm',4,0,-2,slim?3:4,12,4,32,48,16,0],
      ['right_leg',-4,12,-2,4,12,4,0,16,0,16],['left_leg',0,12,-2,4,12,4,16,48,-16,0]];
    const yaw=(entry.yaw??30)*Math.PI/180,pitch=(entry.pitch??-5)*Math.PI/180,faces=[];
    const project=([a,b,c])=>{const xx=a*Math.cos(yaw)+c*Math.sin(yaw),z=-a*Math.sin(yaw)+c*Math.cos(yaw);return [xx,b*Math.cos(pitch)-z*Math.sin(pitch),b*Math.sin(pitch)+z*Math.cos(pitch)];};
    for(const [name,a,b,c,w,h,d,u,v,ou,ov] of parts){
      if(mode!=='body' && mode!==name && !(mode==='legs'&&name.endsWith('_leg')))continue;
      for(let layer=0;layer<2;layer++){
        const pad=layer?(name==='head'?.5:.25):0,xx=a-pad,yy=b-pad,zz=c-pad,W=w+2*pad,H=h+2*pad,D=d+2*pad,U=u+layer*ou,V=v+layer*ov;
        const definitions=[
          [[[xx,yy,zz],[xx+W,yy,zz],[xx+W,yy+H,zz],[xx,yy+H,zz]],[U+d,V+d,w,h]],
          [[[xx+W,yy,zz],[xx+W,yy,zz+D],[xx+W,yy+H,zz+D],[xx+W,yy+H,zz]],[U+d+w,V+d,d,h]],
          [[[xx+W,yy,zz+D],[xx,yy,zz+D],[xx,yy+H,zz+D],[xx+W,yy+H,zz+D]],[U+d+w+d,V+d,w,h]],
          [[[xx,yy,zz+D],[xx,yy,zz],[xx,yy+H,zz],[xx,yy+H,zz+D]],[U,V+d,d,h]],
          [[[xx,yy,zz+D],[xx+W,yy,zz+D],[xx+W,yy,zz],[xx,yy,zz]],[U+d,V,w,d]],
          [[[xx,yy+H,zz],[xx+W,yy+H,zz],[xx+W,yy+H,zz+D],[xx,yy+H,zz+D]],[U+d+w,V,w,d]]
        ];
        for(const [points,uv] of definitions){const p=points.map(project);faces.push({p,uv,z:p.reduce((s,v)=>s+v[2],0)/4,layer});}
      }
    }
    const points=faces.flatMap(f=>f.p),minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    const scale=(size-3)/Math.max(maxX-minX,maxY-minY),cx=x+size/2,cy=y+size/2;
    faces.sort((a,b)=>b.z-a.z||a.layer-b.layer);
    for(const face of faces){
      const p=face.p.map(v=>[cx+(v[0]-(minX+maxX)/2)*scale,cy+(v[1]-(minY+maxY)/2)*scale]);
      ctx.save();ctx.beginPath();ctx.moveTo(...p[0]);p.slice(1).forEach(v=>ctx.lineTo(...v));ctx.closePath();ctx.clip();
      ctx.transform(p[1][0]-p[0][0],p[1][1]-p[0][1],p[3][0]-p[0][0],p[3][1]-p[0][1],p[0][0],p[0][1]);
      ctx.drawImage(image,...face.uv,0,0,1,1);ctx.restore();
    }
    ctx.restore();
  }
  function draw(canvas,project,selected,elapsed,getImage){
    const ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,480,360);
    const entries=ExpressionfulCore.wheelEntries(project),count=entries.length;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='10px system-ui';
    for(let slot=1;slot<=count;slot++){
      const angle=(slot-1)*Math.PI*2/count,gap=count===1?0:.009,start=angle-Math.PI/count-Math.PI/2+gap,end=angle+Math.PI/count-Math.PI/2-gap,entry=entries[slot-1];
      ctx.beginPath();ctx.arc(X,Y,OUTER,start,end);ctx.arc(X,Y,INNER,end,start,true);ctx.closePath();ctx.fillStyle=slot===selected?'#48633a':'#29313c';ctx.fill();
      const box=bounds(slot,count);
      const a=project.animations.find(animation=>animation.id===entry.animation);if(a?.frames.length){const index=ExpressionfulCore.frameAt(a,elapsed,true);thumbnail(ctx,getImage(a.frames[index]),entry,box.x,box.y,box.size,project.model==='slim');}
    }
    const entry=entries[selected-1];ctx.fillStyle='#edf1f5';ctx.font='bold 12px system-ui';
    let label=entry?.label || entry?.animation || 'Expressions';while(ctx.measureText(label).width>108)label=label.slice(0,-2)+'…';
    ctx.fillText(label,X,Y-9);ctx.font='10px system-ui';ctx.fillStyle='#9daebe';ctx.fillText('Click to edit preview',X,Y+11);
  }
  root.ExpressionfulWheelPreview={draw,hit,thumbnail,bounds};
})(globalThis);
