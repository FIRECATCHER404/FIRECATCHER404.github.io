export function defaultEnvironment(theme='day'){
  return{azimuth:theme==='dusk'?285:theme==='night'?40:320,elevation:theme==='dusk'?25:theme==='night'?35:55,groundShadow:true,background:null};
}
export function checkedEnvironment(value,theme='day'){
  if(value===undefined)return defaultEnvironment(theme);
  if(!value||!Number.isFinite(value.azimuth)||value.azimuth<0||value.azimuth>=360||!Number.isFinite(value.elevation)||value.elevation<15||value.elevation>85||typeof value.groundShadow!=='boolean'||value.background!==null&&(typeof value.background!=='string'||!/^#[0-9a-f]{6}$/i.test(value.background)))throw Error('Invalid world lighting.');
  return{azimuth:value.azimuth,elevation:value.elevation,groundShadow:value.groundShadow,background:value.background};
}
export function sunState(environment,theme='day'){
  const e=checkedEnvironment(environment,theme),az=e.azimuth*Math.PI/180,el=e.elevation*Math.PI/180,t=Math.min(1,(e.elevation-15)/45),warm=[255,185,119],cool=[255,247,221],rgb=warm.map((c,i)=>Math.round(c+(cool[i]-c)*t));
  return{direction:{x:Math.sin(az)*Math.cos(el),y:Math.sin(el),z:Math.cos(az)*Math.cos(el)},color:'#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join(''),intensity:(theme==='night'?1.1:2.2)+t*.8,ambient:theme==='night'?1.65:2.4};
}
