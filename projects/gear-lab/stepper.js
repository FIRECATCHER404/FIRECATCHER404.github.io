import{blankScene,defaultGear,checkedScene,meshPhase,connections,dimensions}from'./geometry.js?v=5';
import{FLOOR_Y,gearPoint,length,sub,wrap}from'./space.js?v=5';

export function stepperExample(stages=20){
 if(!Number.isInteger(stages)||stages<1||stages>20)throw Error('Choose 1 to 20 stepper stages.');
 const d=blankScene(),spacing=.18,start=-stages*spacing/2;
 const peg=i=>{const p={id:d.nextId++,x:start+i*spacing,y:FLOOR_Y,z:0,axis:'y',sign:1,surface:'floor'};d.pegs.push(p);return p;};
 const gear=(p,extra={})=>{const g={...defaultGear(),material:'steel',...extra,id:d.nextId++,peg:p.id};d.gears.push(g);return g;};
 let driver=gear(peg(0),{kind:'motor',motor:true,rpm:6});d.stepper={input:driver.id,stages:[]};
 for(let i=1;i<=stages;i++){
  const p=peg(i),small=gear(p,{teeth:10,layer:i-1,angle:wrap(meshPhase(driver,10,0))}),big=gear(p,{layer:i,angle:small.angle});
  d.couplings.push({a:small.id,b:big.id,kind:'fuse'});d.stepper.stages.push({small:small.id,big:big.id});driver=big;
 }
 return checkedScene(d);
}

// Measurements remain attached to saved presets, but disappear if edits break the train.
export function stepperInfo(d){
 const spec=d.stepper;if(!spec||!Array.isArray(spec.stages)||!spec.stages.length||spec.stages.length>20)return null;
 const input=d.gears.find(g=>g.id===spec.input);if(input?.kind!=='motor'||input.teeth!==20)return null;
 let previous=input,ratio=1;const stages=[],used=new Set([input.id]),links=connections(d);
 for(const item of spec.stages){
  const small=d.gears.find(g=>g.id===item?.small),big=d.gears.find(g=>g.id===item?.big);if(!small||!big||small===big||used.has(small.id)||used.has(big.id)||small.teeth!==10||big.teeth!==20||small.peg!==big.peg||big.layer!==small.layer+1||previous.layer!==small.layer||small.module!==previous.module)return null;
  if(!links.some(c=>c.kind==='fuse'&&(c.a===small.id&&c.b===big.id||c.b===small.id&&c.a===big.id)))return null;
  const p=d.pegs.find(p=>p.id===small.peg),q=d.pegs.find(p=>p.id===previous.peg);if(!p||!q||p.axis!=='y'||q.axis!=='y'||p.sign!==1||q.sign!==1||Math.abs(length(sub(gearPoint(p,small),gearPoint(q,previous)))-dimensions(small.teeth,small.module).pitch-dimensions(previous.teeth,previous.module).pitch)>.0001)return null;
  ratio*=-previous.teeth/small.teeth;stages.push({id:big.id,ratio});used.add(small.id);used.add(big.id);previous=big;
 }
 return{input:input.id,stages,ratio,output:previous.id};
}
