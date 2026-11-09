import {TYPES,extents,overlaps} from './geometry.js';
export const WIDTH=1000,HEIGHT=700,MAX_SHAPES=48,STEP=1/120;
export const VOICES={bell:'Bell',pluck:'Pluck',soft:'Soft sine',wood:'Wood'};
export const COLORS=['#e7aa7a','#b2b8e7','#98c9ba','#e2c785','#cf9fb9','#8eb8d4'];
export const clone=v=>structuredClone(v);
export const noteName=m=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][m%12]+(Math.floor(m/12)-1);
export function frequency(midi){return 440*2**((midi-69)/12);}
export function createProject(){return{format:'music-canvas',version:1,name:'First conversation',tempo:112,volume:.55,quantize:false,wallNotes:false,script:'select 1, 2\nmove yes\n\nselect 3\nmove no',shapes:[]};}
export function clampShape(s){const e=extents(s);s.x=Math.max(e.left,Math.min(WIDTH-e.right,s.x));s.y=Math.max(e.top,Math.min(HEIGHT-e.bottom,s.y));return s;}
export function addShape(p,values={}){if(p.shapes.length>=MAX_SHAPES)throw Error('The canvas holds up to 48 shapes.');const id=Array.from({length:99},(_,i)=>i+1).find(id=>!p.shapes.some(s=>s.id===id));if(!id)throw Error('No shape IDs are available.');const type=values.type??'circle',s={id,type,x:500,y:350,radius:48,angle:0,vx:90,vy:0,moving:true,note:60,voice:type==='circle'?'bell':type==='square'?'pluck':type==='triangle'?'soft':'wood',color:COLORS[p.shapes.length%COLORS.length],gain:.7,...values};s.id=id;const checked=checkedShape(clampShape(s));p.shapes.push(checked);return checked;}
export function checkedShape(s){const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;if(!s||!Number.isInteger(s.id)||s.id<1||s.id>99||!Object.hasOwn(TYPES,s.type)||!finite(s.x,0,WIDTH)||!finite(s.y,0,HEIGHT)||!finite(s.radius,18,100)||!finite(s.angle,0,359)||!finite(s.vx,-300,300)||!finite(s.vy,-300,300)||Math.hypot(s.vx,s.vy)>300.00001||typeof s.moving!=='boolean'||!Number.isInteger(s.note)||s.note<36||s.note>96||!Object.hasOwn(VOICES,s.voice)||typeof s.color!=='string'||!/^#[0-9a-f]{6}$/i.test(s.color)||!finite(s.gain,0,1))throw Error('Invalid shape data.');const result={id:s.id,type:s.type,x:s.x,y:s.y,radius:s.radius,angle:s.angle,vx:s.vx,vy:s.vy,moving:s.moving,note:s.note,voice:s.voice,color:s.color,gain:s.gain},e=extents(result);if(s.x<e.left-1e-6||s.x>WIDTH-e.right+1e-6||s.y<e.top-1e-6||s.y>HEIGHT-e.bottom+1e-6)throw Error('A shape is outside the canvas.');return result;}
export function checkedProject(p){if(!p||p.format!=='music-canvas'||p.version!==1||typeof p.name!=='string'||!p.name.trim()||p.name.length>64||!Number.isFinite(p.tempo)||p.tempo<40||p.tempo>200||!Number.isFinite(p.volume)||p.volume<0||p.volume>1||typeof p.quantize!=='boolean'||typeof p.wallNotes!=='boolean'||typeof p.script!=='string'||p.script.length>12000||!Array.isArray(p.shapes)||p.shapes.length>MAX_SHAPES)throw Error('This is not a valid Music Canvas file.');const shapes=p.shapes.map(checkedShape);if(new Set(shapes.map(s=>s.id)).size!==shapes.length)throw Error('Shape IDs must be unique.');return{format:p.format,version:1,name:p.name.trim(),tempo:p.tempo,volume:p.volume,quantize:p.quantize,wallNotes:p.wallNotes,script:p.script,shapes};}
export function preset(name='conversation'){
  const p=createProject();if(name==='empty'){p.name='Untitled canvas';p.script='select all\nmove yes';return p;}
  if(name==='conversation'){
    addShape(p,{type:'circle',x:230,y:245,radius:62,vx:110,vy:48,note:60});addShape(p,{type:'square',x:760,y:285,radius:68,vx:-88,vy:30,note:67});addShape(p,{type:'triangle',x:500,y:465,radius:74,vx:24,vy:-82,moving:false,note:64});addShape(p,{type:'hexagon',x:470,y:210,radius:52,vx:-28,vy:72,note:72});
  }else if(name==='pendulum'){
    p.name='Passing notes';for(let i=0;i<5;i++)addShape(p,{type:i===2?'hexagon':'circle',x:150+i*170,y:350,radius:40,vx:0,vy:0,moving:false,note:[60,62,64,67,69][i],voice:'bell'});addShape(p,{type:'square',x:80,y:350,radius:30,vx:160,vy:0,note:48,voice:'wood'});p.script='select 1, 2, 3, 4, 5\nmove no\n\nselect 6\nmove yes';
  }else if(name==='constellation'){
    p.name='A small constellation';for(let i=0;i<8;i++)addShape(p,{type:['circle','square','triangle','hexagon'][i%4],x:260+(i%4)*160,y:230+Math.floor(i/4)*250,radius:45,vx:Math.cos(i*1.3)*75,vy:Math.sin(i*1.3)*75,note:[60,64,67,71,72,76,79,83][i],voice:i%2?'soft':'bell'});p.quantize=true;p.script='select all\nmove yes';
  }else throw Error('Unknown starting canvas.');return p;
}
export function pairKey(a,b){return Math.min(a,b)+':'+Math.max(a,b);}
export function createRuntime(){return{beat:0,time:0,pairs:new Set(),events:0,lastEvents:[],schedule:[],cursor:0,scriptActive:false,scriptLine:0};}
export function forgetShape(state,id){state.pairs=new Set([...state.pairs].filter(key=>!key.split(':').map(Number).includes(id)));for(let i=state.cursor;i<state.schedule.length;i++)state.schedule[i].ids=state.schedule[i].ids.filter(target=>target!==id);}
export function primeContacts(p,state){state.pairs.clear();for(let i=0;i<p.shapes.length;i++)for(let j=i+1;j<p.shapes.length;j++)if(overlaps(p.shapes[i],p.shapes[j]))state.pairs.add(pairKey(p.shapes[i].id,p.shapes[j].id));}
export const filename=p=>p.name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60)||'music-canvas';
