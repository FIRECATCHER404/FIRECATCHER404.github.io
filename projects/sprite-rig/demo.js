import {newProject,addBone,cleanPose,upsertKey,makeGrid} from './core.js';
export async function exampleProject(){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="320" viewBox="0 0 256 320"><g stroke="#21372b" stroke-width="5" stroke-linejoin="round"><g fill="none" stroke-linecap="round"><path d="M98 118L73 157L57 205M158 118L183 157L199 205" stroke-width="26"/><path d="M111 180L104 232L99 283M145 180L152 232L157 283" stroke-width="30"/><path d="M98 118L73 157L57 205M158 118L183 157L199 205" stroke="#8fae78" stroke-width="17"/><path d="M111 180L104 232L99 283M145 180L152 232L157 283" stroke="#71925f" stroke-width="21"/></g><g fill="#c1d5a4"><circle cx="73" cy="157" r="12"/><circle cx="183" cy="157" r="12"/><circle cx="104" cy="232" r="13"/><circle cx="152" cy="232" r="13"/><circle cx="57" cy="205" r="13"/><circle cx="199" cy="205" r="13"/></g><path fill="#88aa72" d="M109 95H147V124H109Z"/><rect x="94" y="106" width="68" height="82" rx="19" fill="#8fae78"/><rect x="106" y="123" width="44" height="36" rx="9" fill="#d6e3bf"/><path d="M115 142h8l5-10 5 18 5-8h5" fill="none" stroke="#447a41" stroke-width="3"/><rect x="91" y="32" width="74" height="67" rx="25" fill="#c1d5a4"/><path d="M128 32V20" fill="none"/><circle cx="128" cy="17" r="6" fill="#b5cb8f"/><rect x="100" y="49" width="56" height="27" rx="12" fill="#273c30"/><g fill="#d7f0b3" stroke="none"><rect x="111" y="57" width="7" height="11" rx="3"/><rect x="138" y="57" width="7" height="11" rx="3"/></g><path d="M119 86h18" fill="none" stroke-width="3" stroke-linecap="round"/><path d="M83 278Q97 270 108 280L109 294H80Z M148 280Q160 270 174 278L177 294H147Z" fill="#c1d5a4"/></g></svg>`;
  const source=new Image();source.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await source.decode();const canvas=document.createElement('canvas');canvas.width=256;canvas.height=320;canvas.getContext('2d').drawImage(source,0,0);
  const project=newProject({width:256,height:320,data:canvas.toDataURL('image/png'),name:'Moss robot.png'});project.name='Moss robot';
  const definitions=[['Torso',null,128,190,128,110],['Head',0,128,110,128,55],['Left upper arm',0,98,118,73,157],['Left forearm',2,73,157,57,205],['Right upper arm',0,158,118,183,157],['Right forearm',4,183,157,199,205],['Left thigh',0,111,180,104,232],['Left shin',6,104,232,99,283],['Right thigh',0,145,180,152,232],['Right shin',8,152,232,157,283]];
  for(const [name,parent,x,y,ex,ey] of definitions)addBone(project,parent===null?null:project.bones[parent].id,{x,y},{x:ex,y:ey},name);
  // The example includes hand-tuned weights, just like a saved user rig.
  const blend=(a,b,t)=>[{id:a,w:1-Math.max(0,Math.min(1,t))},{id:b,w:Math.max(0,Math.min(1,t))}].filter(e=>e.w>0);
  project.mesh.weights=makeGrid(256,320,project.mesh.columns,project.mesh.rows).points.map(({x,y})=>{
    if(y<106)return blend(2,1,(y-96)/13);
    if((x<86||x>170)&&y<224&&(y<190||x<82||x>174))return blend(x<128?3:5,x<128?4:6,(y-145)/24);
    if(y>188)return blend(x<128?7:9,x<128?8:10,(y-220)/24);
    return[{id:1,w:1}];
  });project.autoWeights=false;
  for(const [frame,head,upper,lower]of [[0,-.05,-.85,-1.4],[12,.07,-1.2,-.7],[24,-.05,-.85,-1.4],[36,.07,-1.2,-.7]]){const pose=cleanPose(project.bones);pose[2].r=head;pose[5].r=upper;pose[6].r=lower;upsertKey(project,frame,pose);}
  project.pose=structuredClone(project.animation.keys[0].pose);return project;
}
