export const TAU=Math.PI*2;
export const MATERIALS={
 acetal:{name:'Acetal',density:1410,strength:65e6,friction:.12,color:'#d7dfdf',ductile:true},
 wood:{name:'Hardwood',density:700,strength:35e6,friction:.3,color:'#bd9264',ductile:false},
 glass:{name:'Glass',density:2500,strength:25e6,friction:.16,color:'#91bec8',ductile:false},
 aluminium:{name:'Aluminium',density:2700,strength:180e6,friction:.2,color:'#b1bdc6',ductile:true},
 steel:{name:'Steel',density:7850,strength:450e6,friction:.18,color:'#778b9d',ductile:true}
};
export function dimensions(teeth,module){const pitch=teeth*module/2;return{pitch,root:pitch-1.25*module,outer:pitch+module,base:pitch*Math.cos(20*Math.PI/180)};}
export function polygonProperties(p){let area=0,x=0,y=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],c=a.x*b.y-b.x*a.y;area+=c;x+=(a.x+b.x)*c;y+=(a.y+b.y)*c;}return{area:Math.abs(area/2),x:x/(3*area),y:y/(3*area)};}
const at=(r,a)=>({x:r*Math.cos(a),y:r*Math.sin(a)});
export function gearParts(teeth,module){
 const d=dimensions(teeth,module),half=Math.PI/(2*teeth)*.96,inv=a=>Math.tan(a)-a,ip=inv(Math.acos(d.base/d.pitch)),angle=r=>half+ip-inv(Math.acos(Math.min(1,d.base/r))),start=Math.max(d.root,d.base),ha=angle(start),tooth=[at(d.root,-ha)];
 for(let i=0;i<=8;i++){const r=start+(d.outer-start)*i/8;tooth.push(at(r,-angle(r)));}
 const top=angle(d.outer);for(let i=1;i<=4;i++)tooth.push(at(d.outer,-top+top*2*i/4));
 for(let i=7;i>=0;i--){const r=start+(d.outer-start)*i/8;tooth.push(at(r,angle(r)));}tooth.push(at(d.root,ha));
 const parts=[],hub=d.root*.3,rotate=(p,a)=>p.map(v=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)}));
 parts.push({type:'hub',index:-1,polygon:Array.from({length:teeth},(_,i)=>at(hub,(i-.5)/teeth*TAU))});
 for(let i=0;i<teeth;i++){const a=(i-.5)/teeth*TAU,b=(i+.5)/teeth*TAU;parts.push({type:'rim',index:i,polygon:[at(hub,a),at(d.root,a),at(d.root,b),at(hub,b)]});parts.push({type:'tooth',index:i,polygon:rotate(tooth,i/teeth*TAU)});}
 return parts;
}
export function hullVertices(p,thickness){return new Float32Array([-thickness/2,thickness/2].flatMap(z=>p.flatMap(v=>[v.x,v.y,z])));}
export function meshPhase(host,newTeeth,phi,hostAngle=host.angle||0){return(host.teeth*(phi-hostAngle)+newTeeth*(phi+Math.PI)-Math.PI)/newTeeth;}
export function toothStress(force,teeth,module,thickness){const d=dimensions(teeth,module),rootWidth=Math.PI*module*.58;return Math.abs(force)*.94*6*(d.outer-d.root)/(thickness*rootWidth**2);}
export function checkedScene(raw){
 const d=structuredClone(raw),num=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b,int=(v,a,b)=>Number.isInteger(v)&&num(v,a,b),fail=()=>{throw Error('Invalid Gear Lab file.');};
 if(!d||d.format!=='gear-lab'||d.version!==1||!Array.isArray(d.pegs)||d.pegs.length>48||!Array.isArray(d.gears)||d.gears.length>24||!int(d.nextId,1,1000000))fail();const ids=new Set();
 for(const p of d.pegs){if(!int(p.id,1,d.nextId-1)||ids.has(p.id)||!num(p.x,-5,5)||!num(p.y,-5,5))fail();ids.add(p.id);}
 for(const g of d.gears){if(!int(g.id,1,d.nextId-1)||ids.has(g.id)||!d.pegs.some(p=>p.id===g.peg)||!int(g.teeth,8,48)||!num(g.module,.005,.03)||!num(g.thickness,.006,.04)||!int(g.layer,0,6)||!Object.hasOwn(MATERIALS,g.material)||!num(g.angle,-1e6,1e6)||!num(g.rpm,-240,240)||!num(g.torque,0,500)||!num(g.brake,0,500)||typeof g.motor!=='boolean'||!(g.link===null||int(g.link,1,d.nextId-1)))fail();ids.add(g.id);}
 for(const g of d.gears){if(g.link!==null&&!d.gears.some(other=>other.id===g.link&&other.peg===g.peg&&other.layer!==g.layer))fail();if(d.gears.some(other=>other.id!==g.id&&other.peg===g.peg&&other.layer===g.layer))fail();}
 return d;
}
export const blankScene=()=>({format:'gear-lab',version:1,nextId:1,pegs:[],gears:[]});
export const defaultGear=()=>({teeth:20,module:.012,thickness:.012,layer:0,material:'acetal',angle:0,motor:false,rpm:30,torque:1,brake:0,link:null});
