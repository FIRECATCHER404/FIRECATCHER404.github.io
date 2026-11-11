import{mountedOnSurface,wallSize,FLOOR_Y}from'./space.js?v=2';
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
export function axialEnvelope(g){const z=.06+g.layer*.05;return{min:z-g.thickness/2-(g.kind==='motor'?.037:0),max:z+g.thickness/2+(g.crank?.056:0)};}
export function checkedScene(raw){
 const d=structuredClone(raw),num=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b,int=(v,a,b)=>Number.isInteger(v)&&num(v,a,b),fail=(message='Invalid Gear Lab file.')=>{throw Error(message);};
 if(!d||d.format!=='gear-lab'||![1,2].includes(d.version)||!Array.isArray(d.pegs)||d.pegs.length>48||!Array.isArray(d.gears)||d.gears.length>24||!int(d.nextId,1,1000000))fail();
 if(d.version===1){if(d.pegs.some(p=>!p||!num(p.x,-5,5)||!num(p.y,-5,5)))fail();
  const maxRadius=Math.max(.15,...d.gears.map(g=>dimensions(g.teeth,g.module).outer)),lift=Math.max(0,FLOOR_Y+.06+maxRadius-Math.min(0,...d.pegs.map(p=>p.y)));for(const p of d.pegs)p.y+=lift;const xs=d.pegs.map(p=>p.x),ys=d.pegs.map(p=>p.y),maxY=Math.max(.5,...ys),bottom=FLOOR_Y,top=maxY+maxRadius+.1;
  d.walls=[];if(d.pegs.length){const id=d.nextId++;d.walls.push({id,axis:'xy',x:(Math.min(...xs)+Math.max(...xs))/2,y:(bottom+top)/2,z:-.03,width:Math.max(1.6,Math.max(...xs)-Math.min(...xs)+2*maxRadius+.2),height:top-bottom});for(const p of d.pegs)Object.assign(p,{z:0,axis:'z',sign:1,surface:id});}
  for(const g of d.gears)Object.assign(g,{kind:g.motor?'motor':'gear',drive:'torque',crank:false,handTorque:5});d.version=2;
 }
 if(!Array.isArray(d.walls)||d.walls.length>24)fail();const ids=new Set(),claim=id=>{if(!int(id,1,d.nextId-1)||ids.has(id))fail();ids.add(id);};
 for(const w of d.walls){claim(w.id);if(!['xy','yz','xz'].includes(w.axis)||!['x','y','z'].every(k=>num(w[k],-20,20))||!num(w.width,.2,20)||!num(w.height,.2,20))fail('Walls need valid axis-aligned dimensions.');}
 for(const p of d.pegs){claim(p.id);if(!['x','y','z'].every(k=>num(p[k],-20,20))||!['x','y','z'].includes(p.axis)||![1,-1].includes(p.sign)||!mountedOnSurface(p,d.walls))fail('Each peg must sit flush on the floor or a wall face.');}
 for(const g of d.gears){claim(g.id);if(!d.pegs.some(p=>p.id===g.peg)||!int(g.teeth,8,48)||!num(g.module,.005,.03)||!num(g.thickness,.006,.04)||!int(g.layer,0,6)||!Object.hasOwn(MATERIALS,g.material)||!num(g.angle,-1e6,1e6)||!num(g.rpm,-240,240)||!num(g.torque,0,500)||!num(g.brake,0,500)||typeof g.motor!=='boolean'||!['gear','motor'].includes(g.kind)||!['ideal','torque'].includes(g.drive)||typeof g.crank!=='boolean'||!num(g.handTorque,.1,50)||!(g.link===null||int(g.link,1,d.nextId-1)))fail();if(g.kind==='gear'&&g.motor||g.kind==='motor'&&!g.motor||g.crank&&g.kind==='motor')fail('A motor and a hand crank are separate parts.');}
 for(const g of d.gears){if(g.link!==null&&!d.gears.some(other=>other.id===g.link&&other.peg===g.peg&&other.layer!==g.layer))fail();if(d.gears.some(other=>other.id!==g.id&&other.peg===g.peg&&other.layer===g.layer))fail('That peg already has a part on this layer.');if(g.crank&&d.gears.some(other=>other.peg===g.peg&&other.layer>g.layer))fail('Put the hand crank on the outermost gear.');const a=axialEnvelope(g);for(const other of d.gears){if(other.id===g.id||other.peg!==g.peg)continue;const b=axialEnvelope(other);if(Math.min(a.max,b.max)-Math.max(a.min,b.min)>.00001)fail('These parts overlap along the peg. Leave more space around the motor housing.');}}
 return d;
}
export const blankScene=()=>({format:'gear-lab',version:2,nextId:1,walls:[],pegs:[],gears:[]});
export const defaultGear=()=>({teeth:20,module:.012,thickness:.012,layer:0,material:'acetal',angle:0,kind:'gear',drive:'ideal',motor:false,rpm:30,torque:1,brake:0,link:null,crank:false,handTorque:5});
