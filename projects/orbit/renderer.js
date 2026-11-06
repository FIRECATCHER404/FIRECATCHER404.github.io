import { circularSpeed, radiusForMass } from "./physics.js?v=1";

export class SpaceRenderer {
  constructor(canvas) { this.canvas = canvas; this.context = canvas.getContext("2d"); this.width = 1; this.height = 1; }
  resize(width, height) {
    this.width = Math.max(1,width); this.height = Math.max(1,height);
    const ratio = Math.min(devicePixelRatio || 1,2);
    this.canvas.width = Math.round(this.width*ratio); this.canvas.height = Math.round(this.height*ratio);
    this.context.setTransform(ratio,0,0,ratio,0,0);
  }
  project(camera, point) { return { x: this.width/2+(point.x-camera.x)*this.height/camera.span, y: this.height/2-(point.y-camera.y)*this.height/camera.span }; }
  hit(camera, bodies, point) {
    let found = null, closest = Infinity;
    for (const body of bodies) {
      const p = this.project(camera,body), distance = Math.hypot(p.x-point.x,p.y-point.y), radius = Math.max(7,body.radius*this.height/camera.span+4);
      if (distance < radius && distance < closest) { closest = distance; found = body; }
    }
    return found;
  }
  draw(simulation, settings, preview) {
    const ctx = this.context, width = this.width, height = this.height, camera = settings.camera, pixels = height/camera.span;
    ctx.fillStyle = "#101517"; ctx.fillRect(0,0,width,height);
    for (let i = 0; i < 95; i++) {
      const x = ((i*0.61803398875)%1)*width, y = ((i*i*0.41421356237)%1)*height;
      ctx.fillStyle = i%7===0 ? "#b8c9b036" : "#b8c9b01b"; ctx.fillRect(x,y,i%7===0?1.2:.7,i%7===0?1.2:.7);
    }
    if (settings.trails) for (const body of simulation.bodies) {
      ctx.strokeStyle = body.color+"78"; ctx.lineWidth = 1.15; ctx.beginPath();
      body.trail.forEach((point,index) => { const p = this.project(camera,point); if (index===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      const p = this.project(camera,body); ctx.lineTo(p.x,p.y); ctx.stroke();
    }
    const labels = [];
    for (const body of [...simulation.bodies].sort((a,b)=>b.mass-a.mass)) {
      const p = this.project(camera,body), radius = Math.max(2,body.radius*pixels);
      if (p.x < -radius*4 || p.y < -radius*4 || p.x > width+radius*4 || p.y > height+radius*4) continue;
      if (body.mass >= 150) {
        const glow = ctx.createRadialGradient(p.x,p.y,radius*.5,p.x,p.y,Math.max(radius*4,22));
        glow.addColorStop(0,body.color+"65"); glow.addColorStop(1,body.color+"00"); ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(radius*4,22),0,Math.PI*2); ctx.fill();
        const fill = ctx.createRadialGradient(p.x-radius*.2,p.y-radius*.2,0,p.x,p.y,radius);
        fill.addColorStop(0,"#fff6d5"); fill.addColorStop(1,body.color); ctx.fillStyle = fill;
      } else ctx.fillStyle = body.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fill();
      if (body.id===settings.selectedId) {
        ctx.strokeStyle = "#b2cfad"; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
        ctx.beginPath(); ctx.arc(p.x,p.y,radius+7,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (simulation.bodies.length < 15 || body.id===settings.selectedId) {
        ctx.font = '12px "Atkinson Hyperlegible Next",sans-serif'; ctx.fillStyle = body.id===settings.selectedId?"#d7e6d2":"#b7c1bd";
        const textWidth = ctx.measureText(body.name).width, x = Math.max(8,Math.min(width-textWidth-8,p.x+radius+10));
        let y = Math.max(14,Math.min(height-45,p.y-5));
        for(let attempt=0;attempt<6&&labels.some(label=>x<label.x+label.width&&x+textWidth>label.x&&y-11<label.y+14&&y+3>label.y);attempt++)y+=15;
        labels.push({x,y:y-11,width:textWidth}); ctx.fillText(body.name,x,y);
      }
    }
    if (preview && preview.world) {
      const p = this.project(camera,preview.world), radius = Math.max(2,radiusForMass(settings.newMass)*pixels);
      const free = simulation.canPlace(preview.world.x,preview.world.y,settings.newMass), primary = simulation.bodies.find(body=>body.id===settings.selectedId);
      ctx.strokeStyle = free ? settings.newColor : "#e0a39a"; ctx.lineWidth = 1.3; ctx.setLineDash([4,5]);
      if (settings.tool==="orbit" && primary) {
        const center = this.project(camera,primary), distance = Math.hypot(preview.world.x-primary.x,preview.world.y-primary.y);
        ctx.globalAlpha = .45; ctx.beginPath(); ctx.arc(center.x,center.y,distance*pixels,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.font = '11px Consolas,monospace'; ctx.fillStyle = "#c4d6bf";
        ctx.fillText(`orbit v ${circularSpeed(primary.mass,settings.newMass,distance).toFixed(2)}`,p.x+12,p.y+22);
      }
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      if (preview.end && settings.tool==="place") {
        const end = this.project(camera,preview.end), dx = end.x-p.x, dy = end.y-p.y, angle = Math.atan2(dy,dx);
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(end.x,end.y); ctx.stroke();
        if (Math.hypot(dx,dy)>5) {
          ctx.beginPath(); ctx.moveTo(end.x-9*Math.cos(angle-.4),end.y-9*Math.sin(angle-.4)); ctx.lineTo(end.x,end.y); ctx.lineTo(end.x-9*Math.cos(angle+.4),end.y-9*Math.sin(angle+.4)); ctx.stroke();
          ctx.font = '11px Consolas,monospace'; ctx.fillStyle = "#c4d6bf"; ctx.fillText(`v ${(Math.hypot(preview.end.x-preview.world.x,preview.end.y-preview.world.y)*2).toFixed(2)}`,end.x+10,end.y-8);
        }
      }
    }
  }
}
