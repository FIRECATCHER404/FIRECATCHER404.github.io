export const G = 1;
export const SOFTENING = 0.025;
export const BASE_STEP = 1 / 240;
export const MAX_BODIES = 128;
export const MAX_MASS = 128000000;
export const BODY_TYPES = Object.freeze({
  planet: { name: "Planet", mass: 4, color: "#85bce5" },
  moon: { name: "Moon", mass: 0.1, color: "#d1d3c8" },
  star: { name: "Star", mass: 1000, color: "#f2cf81" }
});
export const radiusForMass = mass => 0.08 * Math.cbrt(mass);
const finite = (n, limit) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit;
function checkedBody(value, id) {
  if (!value || !finite(value.mass, MAX_MASS) || value.mass < 0.001) throw new Error("Mass must be between 0.001 and 128,000,000.");
  if (![value.x, value.y, value.z].every(n => finite(n, 1e8)) || ![value.vx, value.vy, value.vz].every(n => finite(n, 10000))) throw new Error("Position or velocity is outside the sandbox's numeric range.");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 32 || typeof value.color !== "string" || !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error("Give each body a name and a valid color.");
  return { id, name: value.name.trim(), mass: value.mass, x: value.x, y: value.y, z: value.z, vx: value.vx, vy: value.vy, vz: value.vz, color: value.color, radius: radiusForMass(value.mass) };
}
export function validateScene(scene) {
  if (!scene || ![1,2].includes(scene.version) || !Array.isArray(scene.bodies) || scene.bodies.length > MAX_BODIES || !finite(scene.time, 1e12) || scene.time < 0) throw new Error("This is not a valid Orbital Sandbox file.");
  const seen = new Set();
  const bodies = scene.bodies.map(body => {
    if (!Number.isInteger(body.id) || body.id < 1 || body.id > 1e9 || seen.has(body.id)) throw new Error("The file contains invalid or repeated body IDs.");
    seen.add(body.id); return checkedBody(scene.version===1?{z:0,vz:0,...body}:body, body.id);
  });
  if (bodies.reduce((sum,body)=>sum+body.mass,0)>MAX_MASS) throw new Error("The system's total mass exceeds the numeric limit.");
  return { version: 2, time: scene.time, bodies };
}
export function circularSpeed(primaryMass, newMass, distance) {
  return Math.sqrt(G * (primaryMass + newMass) * distance * distance / (distance * distance + SOFTENING * SOFTENING) ** 1.5);
}
export const orbitNormal = degrees => ({x:0,y:-Math.sin(degrees*Math.PI/180),z:Math.cos(degrees*Math.PI/180)});
export function orbitalTangent(radial, normal = {x:0,y:0,z:1}) {
  let x=normal.y*radial.z-normal.z*radial.y, y=normal.z*radial.x-normal.x*radial.z, z=normal.x*radial.y-normal.y*radial.x;
  let length=Math.hypot(x,y,z);
  if(length<1e-12){const fallback=Math.abs(radial.z)>Math.abs(radial.y)?{x:0,y:1,z:0}:{x:0,y:0,z:1};x=fallback.y*radial.z-fallback.z*radial.y;y=fallback.z*radial.x-fallback.x*radial.z;z=fallback.x*radial.y-fallback.y*radial.x;length=Math.hypot(x,y,z);}
  if(!length||!Number.isFinite(length))throw new Error("Choose a valid orbit plane and starting distance.");
  return {x:x/length,y:y/length,z:z/length};
}
export class Simulation {
  constructor(scene = { version: 2, time: 0, bodies: [] }) { this.restore(scene); }
  restore(scene) {
    const checked = validateScene(scene);
    this.time = checked.time;
    this.bodies = checked.bodies.map(body => ({ ...body, trail: [{ x: body.x, y: body.y, z: body.z }] }));
    this.nextId = Math.max(0, ...this.bodies.map(body => body.id)) + 1;
    this.nextTrail = this.time + 1 / 45;
    this.resolveCollisions();
  }
  toJSON() { return { version: 2, time: this.time, bodies: this.bodies.map(({ trail, radius, ...body }) => ({ ...body })) }; }
  canPlace(x, y, z, mass, except = 0) {
    const radius = radiusForMass(mass);
    return this.bodies.every(body => body.id === except || Math.hypot(body.x - x, body.y - y, body.z - z) > body.radius + radius);
  }
  add(config) {
    if (this.bodies.length >= MAX_BODIES) throw new Error(`The sandbox can contain up to ${MAX_BODIES} bodies.`);
    if (this.nextId>1e9) this.nextId=1;
    while(this.bodies.some(body=>body.id===this.nextId))this.nextId++;
    const body = checkedBody({ z:0, vx:0, vy:0, vz:0, ...config }, this.nextId);
    if (this.bodies.reduce((sum,item)=>sum+item.mass,0)+body.mass>MAX_MASS) throw new Error("The system's total mass exceeds the numeric limit.");
    if (!this.canPlace(body.x, body.y, body.z, body.mass)) throw new Error("Place the new body in free space.");
    this.nextId++; body.trail = [{ x: body.x, y: body.y, z: body.z }]; this.bodies.push(body); return body;
  }
  addOrbiter(primaryId, config, clockwise = false, normal = {x:0,y:0,z:1}) {
    const primary = this.bodies.find(body => body.id === primaryId);
    if (!primary) throw new Error("Select a body to orbit first.");
    const dx = config.x - primary.x, dy = config.y - primary.y, dz = (config.z??0) - primary.z, distance = Math.hypot(dx, dy, dz);
    if (distance <= primary.radius + radiusForMass(config.mass)) throw new Error("Start the orbit outside the selected body.");
    const speed = circularSpeed(primary.mass, config.mass, distance), sign = clockwise ? -1 : 1;
    const tangent=orbitalTangent({x:dx,y:dy,z:dz},normal);
    const relativeX=tangent.x*speed*sign, relativeY=tangent.y*speed*sign, relativeZ=tangent.z*speed*sign;
    const total = primary.mass + config.mass, vx = primary.vx, vy = primary.vy, vz=primary.vz;
    // The two bodies receive opposite recoil so their common velocity is unchanged.
    const body = this.add({ ...config, vx: vx + relativeX * primary.mass / total, vy: vy + relativeY * primary.mass / total, vz:vz+relativeZ*primary.mass/total });
    primary.vx = vx - relativeX * body.mass / total; primary.vy = vy - relativeY * body.mass / total; primary.vz=vz-relativeZ*body.mass/total;
    return body;
  }
  edit(id, changes) {
    const body = this.bodies.find(item => item.id === id);
    if (!body) throw new Error("Select a body first.");
    const next = checkedBody({ ...body, ...changes }, id);
    if (this.bodies.reduce((sum,item)=>sum+item.mass,0)-body.mass+next.mass>MAX_MASS) throw new Error("The system's total mass exceeds the numeric limit.");
    Object.assign(body, next);
    body.trail = [{ x: body.x, y: body.y, z:body.z }];
    return this.resolveCollisions();
  }
  remove(id) { this.bodies = this.bodies.filter(body => body.id !== id); }
  clearTrails() { for (const body of this.bodies) body.trail = [{ x: body.x, y: body.y, z:body.z }]; }
  resolveCollisions() {
    const merged = [];
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        if (Math.hypot(a.x - b.x, a.y - b.y, a.z-b.z) > a.radius + b.radius) continue;
        const keep = a.mass >= b.mass ? a : b, remove = keep === a ? b : a, total = a.mass + b.mass;
        for (const field of ["x", "y", "z", "vx", "vy", "vz"]) keep[field] = (a[field] * a.mass + b[field] * b.mass) / total;
        keep.mass = total; keep.radius = radiusForMass(total); keep.trail = [{ x: keep.x, y: keep.y, z:keep.z }];
        merged.push({ keep: keep.id, remove: remove.id }); this.bodies.splice(this.bodies.indexOf(remove), 1);
        changed = true; break outer;
      }
    }
    return merged;
  }
  accelerations() {
    const n = this.bodies.length, result = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = this.bodies[i], b = this.bodies[j], dx = b.x - a.x, dy = b.y - a.y, dz=b.z-a.z;
      const force = G / (dx * dx + dy * dy + dz*dz + SOFTENING * SOFTENING) ** 1.5;
      result[3*i] += dx * force * b.mass; result[3*i+1] += dy * force * b.mass; result[3*i+2]+=dz*force*b.mass;
      result[3*j] -= dx * force * a.mass; result[3*j+1] -= dy * force * a.mass; result[3*j+2]-=dz*force*a.mass;
    }
    return result;
  }
  safeStep(remaining) {
    let step = Math.min(BASE_STEP, remaining);
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j], dx = b.x - a.x, dy = b.y - a.y, dz=b.z-a.z, r2 = dx*dx + dy*dy+dz*dz;
      step = Math.min(step, 0.035 / Math.sqrt(G * (a.mass + b.mass) / (r2 + SOFTENING * SOFTENING) ** 1.5));
      const vx = b.vx - a.vx, vy = b.vy - a.vy, vz=b.vz-a.vz, dot = dx*vx + dy*vy+dz*vz, v2 = vx*vx + vy*vy+vz*vz, contact = a.radius + b.radius;
      if (dot < 0 && v2 > 0 && r2 - dot*dot/v2 < contact*contact*1.1) step = Math.min(step, 0.2 * Math.max(Math.sqrt(r2) - contact, contact * 0.1) / Math.sqrt(v2));
    }
    return Math.min(remaining, Math.max(1e-7, step));
  }
  step(dt) {
    const merged = this.resolveCollisions(), first = this.accelerations();
    this.bodies.forEach((body, i) => {
      body.vx += first[3*i] * dt/2; body.vy += first[3*i+1] * dt/2; body.vz+=first[3*i+2]*dt/2;
      body.x += body.vx * dt; body.y += body.vy * dt; body.z+=body.vz*dt;
    });
    merged.push(...this.resolveCollisions());
    const last = this.accelerations();
    this.bodies.forEach((body, i) => { body.vx += last[3*i] * dt/2; body.vy += last[3*i+1] * dt/2; body.vz+=last[3*i+2]*dt/2; });
    this.time += dt;
    if (this.time >= this.nextTrail) {
      for (const body of this.bodies) { body.trail.push({ x: body.x, y: body.y, z:body.z }); if (body.trail.length > 900) body.trail.shift(); }
      this.nextTrail = this.time + 1/45;
    }
    return merged;
  }
  advance(seconds, maxSteps = 256, deadline = Infinity) {
    if (!Number.isFinite(seconds) || seconds<0 || seconds>60) throw new Error("Invalid time interval.");
    let remaining = seconds, steps = 0;
    const merged = [];
    while (remaining > 1e-12 && steps < maxSteps) {
      if (steps % 8 === 0 && performance.now() > deadline) break;
      const dt = this.safeStep(remaining); merged.push(...this.step(dt)); remaining -= dt; steps++;
    }
    return { advanced: seconds - remaining, remaining, steps, merged };
  }
  invariants() {
    let mass = 0, px = 0, py = 0, pz=0, lx=0, ly=0, angular = 0, energy = 0;
    for (const a of this.bodies) { mass += a.mass; px += a.mass*a.vx; py += a.mass*a.vy; pz+=a.mass*a.vz;lx+=a.mass*(a.y*a.vz-a.z*a.vy);ly+=a.mass*(a.z*a.vx-a.x*a.vz);angular += a.mass*(a.x*a.vy-a.y*a.vx); energy += a.mass*(a.vx*a.vx+a.vy*a.vy+a.vz*a.vz)/2; }
    for (let i = 0; i < this.bodies.length; i++) for (let j = i+1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j]; energy -= G*a.mass*b.mass / Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2+SOFTENING**2);
    }
    return { mass, px, py, pz, lx, ly, lz:angular, angular, energy };
  }
}
function recenter(simulation) {
  const total = simulation.invariants().mass;
  if (!total) return;
  const center = { x: 0, y: 0, z:0, vx: 0, vy: 0, vz:0 };
  for (const body of simulation.bodies) for (const key of Object.keys(center)) center[key] += body[key] * body.mass / total;
  for (const body of simulation.bodies) { for (const key of Object.keys(center)) body[key] -= center[key]; body.trail = [{ x: body.x, y: body.y, z:body.z }]; }
}
export function preset(name) {
  const simulation = new Simulation();
  const body = (name, mass, x, y, color, z=0) => ({ name, mass, x, y, z, color });
  const tilted=(name,mass,distance,phase,tilt,color,center={x:0,y:0,z:0})=>body(name,mass,center.x+distance*Math.cos(phase),center.y+distance*Math.sin(phase)*Math.cos(tilt*Math.PI/180),color,center.z+distance*Math.sin(phase)*Math.sin(tilt*Math.PI/180));
  if (name === "solar") {
    const sun = simulation.add(body("Sun", 1000, 0, 0, "#f2cf81"));
    simulation.addOrbiter(sun.id, tilted("Ember",0.7,5,0,-12,"#e8a181"),false,orbitNormal(-12));
    const planet=simulation.addOrbiter(sun.id,tilted("Tidal",4,9,1.2,20,"#85bce5"),false,orbitNormal(20));
    simulation.addOrbiter(planet.id,tilted("Luna",0.06,.28,0,45,"#d1d3c8",planet),false,orbitNormal(45));
    simulation.addOrbiter(sun.id,tilted("Verdant",7,15,3.5,35,"#acd298"),false,orbitNormal(35));
  } else if (name === "moon") {
    const planet = simulation.add(body("Planet", 100, 0, 0, "#85bce5"));
    simulation.addOrbiter(planet.id, body("Moon", 1, 2.8, 0, "#d1d3c8"),false,orbitNormal(25));
  } else if (name === "binary") {
    const star = simulation.add(body("Amber", 400, -4, 0, "#f2cf81"));
    simulation.addOrbiter(star.id, body("Azure", 250, 4, 0, "#9fc9f3"),false,orbitNormal(35));
  } else if (name !== "empty") throw new Error("Unknown starting system.");
  recenter(simulation); return simulation.toJSON();
}
export const DEFAULT_CAMERA=Object.freeze({x:0,y:0,z:0,span:40,yaw:.55,pitch:.72});
export const FOV_TAN=Math.tan(Math.PI/8);
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const normalize=v=>{const length=Math.hypot(v.x,v.y,v.z);return{x:v.x/length,y:v.y/length,z:v.z/length};};
export function cameraBasis(camera) {
  const yaw=camera.yaw??DEFAULT_CAMERA.yaw,pitch=camera.pitch??DEFAULT_CAMERA.pitch,sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
  return {right:{x:cy,y:sy,z:0},up:{x:-sy*sp,y:cy*sp,z:cp},back:{x:sy*cp,y:-cy*cp,z:sp},distance:camera.span/(2*FOV_TAN)};
}
export function projectPoint(camera,point,width,height) {
  const basis=cameraBasis(camera),p={x:point.x-camera.x,y:point.y-camera.y,z:point.z-(camera.z??0)},depth=basis.distance-dot(p,basis.back),scale=height/(2*FOV_TAN*depth);
  return {x:width/2+dot(p,basis.right)*scale,y:height/2-dot(p,basis.up)*scale,depth,scale,visible:depth>Math.max(.001,basis.distance*.0001)};
}
export function screenRay(camera,point,width,height) {
  const basis=cameraBasis(camera),sx=(point.x-width/2)*camera.span/height,sy=(height/2-point.y)*camera.span/height;
  const origin={x:camera.x+basis.back.x*basis.distance,y:camera.y+basis.back.y*basis.distance,z:(camera.z??0)+basis.back.z*basis.distance};
  const direction=normalize({x:basis.right.x*sx+basis.up.x*sy-basis.back.x*basis.distance,y:basis.right.y*sx+basis.up.y*sy-basis.back.y*basis.distance,z:basis.right.z*sx+basis.up.z*sy-basis.back.z*basis.distance});
  return {origin,direction};
}
export function pickBody(camera,bodies,point,width,height,padding=7) {
  const ray=screenRay(camera,point,width,height);let nearest=Infinity,found=null;
  for(const body of bodies){
    const projected=projectPoint(camera,body,width,height);if(!projected.visible)continue;
    const radius=Math.max(body.radius,padding/projected.scale),r={x:body.x-ray.origin.x,y:body.y-ray.origin.y,z:body.z-ray.origin.z},along=dot(r,ray.direction),discriminant=radius*radius-(dot(r,r)-along*along);
    if(discriminant<0)continue;let hit=along-Math.sqrt(discriminant);if(hit<0)hit=along+Math.sqrt(discriminant);
    if(hit>=0&&hit<nearest){nearest=hit;found=body;}
  }
  return found;
}
export function intersectPlane(ray,point,normal) {
  const denominator=dot(ray.direction,normal);
  if(Math.abs(denominator)<1e-7)return null;
  const t=dot({x:point.x-ray.origin.x,y:point.y-ray.origin.y,z:point.z-ray.origin.z},normal)/denominator;
  if(t<=0||!Number.isFinite(t))return null;
  return {x:ray.origin.x+ray.direction.x*t,y:ray.origin.y+ray.direction.y*t,z:ray.origin.z+ray.direction.z*t};
}
export function screenToWorld(camera,point,width,height,planePoint={x:camera.x,y:camera.y,z:camera.z??0},normal=cameraBasis(camera).back) {
  return intersectPlane(screenRay(camera,point,width,height),planePoint,normal);
}
export function panCamera(camera,dx,dy,height) {
  const basis=cameraBasis(camera),units=camera.span/height;
  return {...camera,z:camera.z??0,...Object.fromEntries(["x","y","z"].map(key=>[key,(camera[key]??0)+(-basis.right[key]*dx+basis.up[key]*dy)*units]))};
}
export function zoomCamera(camera,factor,point,width,height) {
  const anchor=screenToWorld(camera,point,width,height),span=Math.max(.5,Math.min(1e7,camera.span*factor)),next={...DEFAULT_CAMERA,...camera,span};
  const after=screenToWorld(next,point,width,height);
  for(const key of ["x","y","z"])next[key]+=anchor[key]-after[key];
  return next;
}
export function fitCamera(bodies,width,height,orientation=DEFAULT_CAMERA) {
  const base={...DEFAULT_CAMERA,yaw:orientation.yaw,pitch:orientation.pitch};
  if(!bodies.length)return base;
  const mass=bodies.reduce((sum,b)=>sum+b.mass,0),center={x:0,y:0,z:0};
  for(const body of bodies)for(const key of ["x","y","z"])center[key]+=body[key]*body.mass/mass;
  const radius=Math.max(2,...bodies.map(b=>Math.hypot(b.x-center.x,b.y-center.y,b.z-center.z)+b.radius));
  return {...base,...center,span:Math.min(1e7,Math.max(8,radius*2.7*Math.max(1,height/width)))};
}
export function validateProject(value) {
  if(!value||value.format!=="neoj-orbit"||![1,2].includes(value.version))throw new Error("Choose an Orbital Sandbox .orbit file.");
  const next=new Simulation(value.scene),legacy=value.version===1,s=value.settings,c=s?.camera;
  const camera=c?{...c,z:legacy?(c.z??0):c.z,yaw:legacy?(c.yaw??DEFAULT_CAMERA.yaw):c.yaw,pitch:legacy?(c.pitch??DEFAULT_CAMERA.pitch):c.pitch}:null;
  const placementZ=legacy?(s?.placementZ??0):s?.placementZ,launchVz=legacy?(s?.launchVz??0):s?.launchVz,orbitTilt=legacy?(s?.orbitTilt??0):s?.orbitTilt,grid=legacy?(s?.grid??true):s?.grid;
  if(!s||!camera||![camera.x,camera.y,camera.z,camera.span,camera.yaw,camera.pitch].every(Number.isFinite)||[camera.x,camera.y,camera.z].some(n=>Math.abs(n)>1e8)||camera.span<.5||camera.span>1e7||Math.abs(camera.yaw)>1e6||Math.abs(camera.pitch)>1.5||![.25,.5,1,2,4,8,16].includes(s.speed)||!["place","orbit","select"].includes(s.tool)||!Object.keys(BODY_TYPES).includes(s.bodyType)||!finite(s.newMass,1e6)||s.newMass<.001||typeof s.newColor!=="string"||!/^#[0-9a-f]{6}$/i.test(s.newColor)||!["solar","moon","binary","empty"].includes(s.preset)||![s.paused,s.trails,s.follow,s.clockwise,grid].every(n=>typeof n==="boolean")||!finite(placementZ,1e6)||!finite(launchVz,10000)||!finite(orbitTilt,90))throw new Error("This file has invalid view or control settings.");
  const settings={camera:{x:camera.x,y:camera.y,z:camera.z,span:camera.span,yaw:camera.yaw,pitch:camera.pitch},selectedId:next.bodies.some(b=>b.id===s.selectedId)?s.selectedId:null,tool:s.tool,bodyType:s.bodyType,newMass:s.newMass,newColor:s.newColor,speed:s.speed,paused:s.paused,trails:s.trails,follow:s.follow,clockwise:s.clockwise,preset:s.preset,placementZ,launchVz,orbitTilt,grid};
  if(!settings.selectedId)settings.follow=false;
  return {simulation:next,settings};
}
