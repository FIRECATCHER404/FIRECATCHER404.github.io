import { circularSpeed, radiusForMass, projectPoint, pickBody, cameraBasis, orbitalTangent, orbitNormal, normalize } from "./physics.js?v=2";
import {GLRenderer,sceneGuides} from "./gl.js?v=2";

export class SpaceRenderer {
  constructor(canvas,overlay) { this.canvas=canvas;this.overlay=overlay;this.context=overlay.getContext("2d");this.gpu=new GLRenderer(canvas);this.width=1;this.height=1; }
  resize(width, height) {
    this.width = Math.max(1,width); this.height = Math.max(1,height);
    const ratio = Math.min(devicePixelRatio || 1,2);
    this.canvas.width = Math.round(this.width*ratio); this.canvas.height = Math.round(this.height*ratio);
    this.overlay.width=this.canvas.width;this.overlay.height=this.canvas.height;
    this.context.setTransform(ratio,0,0,ratio,0,0);
  }
  project(camera, point) { return projectPoint(camera,point,this.width,this.height); }
  hit(camera, bodies, point) {
    return pickBody(camera,bodies,point,this.width,this.height);
  }
  path(camera,points) {
    const ctx=this.context;ctx.beginPath();let active=false;
    for(const point of points){const p=this.project(camera,point);if(!p.visible){active=false;continue;}if(active)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);active=true;}
    ctx.stroke();
  }
  draw(simulation, settings, preview) {
    const ctx = this.context, width = this.width, height = this.height, camera = settings.camera;
    const gpu=this.gpu.draw(simulation,settings,width,height,point=>this.project(camera,point));this.kind=gpu?"webgl":"canvas";this.canvas.hidden=!gpu;
    ctx.clearRect(0,0,width,height);
    if(!gpu){
    ctx.fillStyle = "#101517"; ctx.fillRect(0,0,width,height);
    for (let i = 0; i < 95; i++) {
      const x = ((i*0.61803398875)%1)*width, y = ((i*i*0.41421356237)%1)*height;
      ctx.fillStyle = i%7===0 ? "#b8c9b036" : "#b8c9b01b"; ctx.fillRect(x,y,i%7===0?1.2:.7,i%7===0?1.2:.7);
    }
    for(const guide of sceneGuides(simulation,settings)){ctx.strokeStyle=`rgba(${guide.color.slice(0,3).map(n=>Math.round(n*255)).join(",")},${guide.color[3]})`;ctx.lineWidth=1;this.path(camera,guide.points);}
    if (settings.trails) for (const body of simulation.bodies) {
      ctx.strokeStyle = body.color+"78"; ctx.lineWidth = 1.15; ctx.beginPath();
      this.path(camera,[...body.trail,body]);
    }
    }
    const labels = [];
    for (const body of [...simulation.bodies].sort((a,b)=>this.project(camera,b).depth-this.project(camera,a).depth)) {
      const p = this.project(camera,body), radius = Math.max(1.6,body.radius*p.scale);
      if(!p.visible)continue;
      if (p.x < -radius*4 || p.y < -radius*4 || p.x > width+radius*4 || p.y > height+radius*4) continue;
      if(!gpu){
      if (body.mass >= 150) {
        const glow = ctx.createRadialGradient(p.x,p.y,radius*.5,p.x,p.y,Math.max(radius*4,22));
        glow.addColorStop(0,body.color+"65"); glow.addColorStop(1,body.color+"00"); ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(radius*4,22),0,Math.PI*2); ctx.fill();
        const fill = ctx.createRadialGradient(p.x-radius*.2,p.y-radius*.2,0,p.x,p.y,radius);
        fill.addColorStop(0,"#fff6d5"); fill.addColorStop(1,body.color); ctx.fillStyle = fill;
      } else {const fill=ctx.createRadialGradient(p.x-radius*.3,p.y-radius*.3,0,p.x,p.y,radius);fill.addColorStop(0,body.color);fill.addColorStop(1,"#172322");ctx.fillStyle=fill;}
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fill();
      }
      const annotated=body.id===settings.selectedId||(width>=500&&simulation.bodies.length<15)||(width<500&&body.mass>=150&&simulation.bodies.length<9);
      if(!annotated)continue;
      const front=pickBody(camera,simulation.bodies,p,width,height,1.6);if(front&&front.id!==body.id)continue;
      if (body.id===settings.selectedId) {
        ctx.strokeStyle = "#b2cfad"; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
        ctx.beginPath(); ctx.arc(p.x,p.y,radius+7,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (annotated) {
        ctx.font = '12px "Atkinson Hyperlegible Next",sans-serif'; ctx.fillStyle = body.id===settings.selectedId?"#d7e6d2":"#b7c1bd";
        const textWidth = ctx.measureText(body.name).width, x = Math.max(8,Math.min(width-textWidth-8,p.x+radius+10));
        let y = Math.max(14,Math.min(height-45,p.y-5));
        for(let attempt=0;attempt<6&&labels.some(label=>x<label.x+label.width&&x+textWidth>label.x&&y-11<label.y+14&&y+3>label.y);attempt++)y+=15;
        labels.push({x,y:y-11,width:textWidth}); ctx.fillText(body.name,x,y);
      }
    }
    if (preview && preview.world) {
      const p = this.project(camera,preview.world), radius = Math.max(2,radiusForMass(settings.newMass)*p.scale);
      const free = simulation.canPlace(preview.world.x,preview.world.y,preview.world.z,settings.newMass), primary = simulation.bodies.find(body=>body.id===settings.selectedId);
      if(!p.visible)return;
      ctx.strokeStyle = free ? settings.newColor : "#e0a39a"; ctx.lineWidth = 1.3; ctx.setLineDash([4,5]);
      if (settings.tool==="orbit" && primary) {
        const radial={x:preview.world.x-primary.x,y:preview.world.y-primary.y,z:preview.world.z-primary.z},distance=Math.hypot(radial.x,radial.y,radial.z);
        if(distance>1e-8){const u=normalize(radial),v=orbitalTangent(radial,orbitNormal(settings.orbitTilt)),points=[];for(let i=0;i<=160;i++){const angle=i/160*Math.PI*2;points.push({x:primary.x+distance*(u.x*Math.cos(angle)+v.x*Math.sin(angle)),y:primary.y+distance*(u.y*Math.cos(angle)+v.y*Math.sin(angle)),z:primary.z+distance*(u.z*Math.cos(angle)+v.z*Math.sin(angle))});}ctx.globalAlpha=.45;this.path(camera,points);ctx.globalAlpha=1;}
        ctx.font = '11px Consolas,monospace'; ctx.fillStyle = "#c4d6bf";
        ctx.fillText(`orbit v ${circularSpeed(primary.mass,settings.newMass,distance).toFixed(2)}`,p.x+12,p.y+22);
      }
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      if (preview.end && settings.tool==="place") {
        const end = this.project(camera,preview.end), dx = end.x-p.x, dy = end.y-p.y, angle = Math.atan2(dy,dx);
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(end.x,end.y); ctx.stroke();
        if (Math.hypot(dx,dy)>5) {
          ctx.beginPath(); ctx.moveTo(end.x-9*Math.cos(angle-.4),end.y-9*Math.sin(angle-.4)); ctx.lineTo(end.x,end.y); ctx.lineTo(end.x-9*Math.cos(angle+.4),end.y-9*Math.sin(angle+.4)); ctx.stroke();
          ctx.font = '11px Consolas,monospace'; ctx.fillStyle = "#c4d6bf"; ctx.fillText(`v ${Math.hypot((preview.end.x-preview.world.x)*2,(preview.end.y-preview.world.y)*2,settings.launchVz).toFixed(2)}`,end.x+10,end.y-8);
        }
      }
    }
    const basis=cameraBasis(camera),origin={x:width-43,y:height-72};ctx.font='11px Consolas,monospace';ctx.lineWidth=1.5;
    for(const [axis,color]of [["x","#dca59a"],["y","#b2cfad"],["z","#8bbce7"]]){const x=origin.x+basis.right[axis]*24,y=origin.y-basis.up[axis]*24;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(x,y);ctx.stroke();ctx.fillText(axis.toUpperCase(),x+3,y-3);}
  }
}
