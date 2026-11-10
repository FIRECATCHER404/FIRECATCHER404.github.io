import{createDocument,checkedDocument,clone,clamp,bounds,roundedPath,makeShape,simplify,exportSVG,SHAPES,selectionBounds,boxSelection,moveSelection,resizeSelection,rotateSelection,flipSelection,alignSelection,distributeSelection,mergedShape,combinedShape}from'./core.js?v=4';
import{readSVG}from'../svg-shared/import.js?v=2';
import{installTouchButtons}from'../svg-shared/touch.js?v=2';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',svg=$('canvas'),stage=$('stage');
let doc=createDocument(),selection=[],selectionAngle=0,pointSelection=null,tool='select',addSelection=false,gesture=null,polygon=[],undo=[],redo=[],zoom=1,rangeEdit=null;
let defaults={fill:'#427ee8',stroke:'#20242a',fillEnabled:true,strokeEnabled:true,strokeWidth:2,fillAlpha:1,strokeAlpha:1,lineCap:'round',lineJoin:'round',radius:0,opacity:1,polygonSides:6,starPoints:5,starInner:.43,burstPoints:12,burstInner:.75,ringHole:.55};
const serial=()=>JSON.stringify(doc),items=()=>doc.items.filter(s=>selection.includes(s.id)),current=()=>doc.items.find(s=>s.id===selection.at(-1)),status=t=>$('status').textContent=t;
function setSelection(ids,angle=0){selection=[...new Set(ids)].filter(id=>doc.items.some(s=>s.id===id));selectionAngle=angle;pointSelection=null;}
function snapshot(){return{doc:serial(),selection:[...selection],angle:selectionAngle};}
function restore(state){doc=checkedDocument(JSON.parse(state.doc));setSelection(state.selection,state.angle);}
function persist(){try{localStorage.setItem('neoj-svg-paint-v1',serial());}catch{status('Draft storage is unavailable. Save a project file.');}}
function record(before){if(before.doc===serial())return;undo.push(before);while(undo.length>60||undo.length>1&&undo.reduce((n,s)=>n+s.doc.length,0)>4000000)undo.shift();redo=[];persist();}
function change(fn){finishRange();cancelGesture();const before=snapshot();try{fn();doc=checkedDocument(doc);selection=selection.filter(id=>doc.items.some(s=>s.id===id));record(before);sync();return true;}catch(e){restore(before);sync();status(e.message);return false;}}
function history(forward=false){finishRange();cancelGesture();polygon=[];const from=forward?redo:undo,to=forward?undo:redo;if(!from.length)return;to.push(snapshot());restore(from.pop());persist();sync();status(forward?'Redone.':'Undone.');}
function element(tag,attrs={}){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}
function path(s){return element('path',{d:roundedPath(s.contours,s.radius),fill:s.fillEnabled?s.fill:'none',stroke:s.strokeEnabled?s.stroke:'none','stroke-width':s.strokeWidth,'fill-opacity':s.fillAlpha,'stroke-opacity':s.strokeAlpha,opacity:s.opacity,'fill-rule':s.fillRule,'stroke-linejoin':s.lineJoin,'stroke-linecap':s.lineCap,'data-id':s.id});}
function paint(){
 const artwork=$('artwork'),guides=$('guides'),visible=doc.items.filter(s=>!s.hidden),ids=new Set(visible.map(s=>String(s.id)));
 for(const el of [...artwork.children])if(!ids.has(el.getAttribute('data-id')))el.remove();
 visible.forEach((s,i)=>{const fresh=path(s);let el=artwork.querySelector('[data-id="'+s.id+'"]');if(el){for(const a of fresh.attributes)el.setAttribute(a.name,a.value);}else el=fresh;if(artwork.children[i]!==el)artwork.insertBefore(el,artwork.children[i]||null);});
 guides.replaceChildren();const line={stroke:'#2580dc','stroke-width':1/zoom,fill:'none'};
 if(polygon.length){guides.append(element('path',{d:polygon.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),...line}));for(const p of polygon)guides.append(element('circle',{cx:p.x,cy:p.y,r:3/zoom,fill:'#2580dc'}));}
 const selected=items(),s=current();
 if(selected.length&&selected.some(s=>!s.hidden)){
  const b=selectionBounds(selected);
  if(tool==='points'&&selected.length===1){s.contours.forEach((c,ci)=>c.points.forEach((p,i)=>guides.append(element('circle',{cx:p.x,cy:p.y,r:(pointSelection?.ci===ci&&pointSelection.i===i?4:2.5)/zoom,fill:pointSelection?.ci===ci&&pointSelection.i===i?'#2580dc':'#fff',stroke:'#2580dc','stroke-width':1/zoom,'data-point':ci+':'+i}))));}
  else{
   if(selected.length>1)for(const item of selected){if(item.hidden)continue;const own=bounds(item);guides.append(element('rect',{x:own.x,y:own.y,width:own.w,height:own.h,...line,opacity:.45}));}
   guides.append(element('rect',{x:b.x,y:b.y,width:b.w,height:b.h,...line,'stroke-dasharray':4/zoom+' '+3/zoom}));
   for(const[k,x,y]of[['tl',b.x,b.y],['tr',b.x+b.w,b.y],['br',b.x+b.w,b.y+b.h],['bl',b.x,b.y+b.h]])guides.append(element('rect',{x:x-4/zoom,y:y-4/zoom,width:8/zoom,height:8/zoom,fill:'#fff',stroke:'#2580dc','stroke-width':1/zoom,'data-handle':k}));
   const cx=b.x+b.w/2,ry=b.y-23/zoom;guides.append(element('line',{x1:cx,y1:b.y,x2:cx,y2:ry,...line}),element('circle',{cx,cy:ry,r:5/zoom,fill:'#fff',stroke:'#2580dc','stroke-width':1/zoom,'data-handle':'rotate'}));
  }
 }
 if(gesture?.kind==='box'){const b=dragBox(gesture.p0,gesture.latest);guides.append(element('rect',{x:b.x,y:b.y,width:b.w,height:b.h,fill:'rgba(37,128,220,.1)',stroke:'#2580dc','stroke-width':1/zoom,'stroke-dasharray':4/zoom+' '+3/zoom,'data-marquee':'true'}));}
}
const mixed=(chosen,key)=>chosen.length>1&&chosen.some(s=>s[key]!==chosen[0][key]);
function field(id,value,isMixed=false){const el=$(id);el.value=isMixed?'':value;el.placeholder=isMixed?'Mixed':'';el.dataset.mixed=String(isMixed);}
function check(id,values){const el=$(id);el.checked=values.every(Boolean);el.indeterminate=values.some(Boolean)&&!values.every(Boolean);}
function drawConfig(){return tool==='regular-polygon'?{count:'polygonSides',max:16}:tool==='star'?{count:'starPoints',ratio:'starInner',max:16}:tool==='burst'?{count:'burstPoints',ratio:'burstInner',max:24}:tool==='ring'?{ratio:'ringHole'}:null;}
function syncAppearance(chosen){const style=chosen.at(-1)||defaults;
 for(const key of['fill','stroke']){$(key).value=style[key];field(key+'-hex',style[key],mixed(chosen,key));}
 for(const key of['fillAlpha','strokeAlpha'])field(key,Number((style[key]*100).toFixed(1)),mixed(chosen,key));
 field('strokeWidth',style.strokeWidth,mixed(chosen,'strokeWidth'));for(const key of['lineCap','lineJoin'])$(key).value=mixed(chosen,key)?'':style[key];
 for(const[key,id]of[['fillEnabled','fill-enabled'],['strokeEnabled','stroke-enabled']])check(id,chosen.length?chosen.map(s=>s[key]):[defaults[key]]);
 $('outline-width-slider').max=Math.max(64,...chosen.map(s=>Math.ceil(s.strokeWidth/64)*64),Math.ceil(style.strokeWidth/64)*64);$('outline-width-slider').value=style.strokeWidth;
 $('outline-width-slider').title=mixed(chosen,'strokeWidth')?'Mixed widths. Drag to set all selected outlines.':'Outline width';
 $('style-target').textContent=chosen.length>1?chosen.length+' selected':chosen.length?'Selected shape':'New shapes';
 $('shape-name').textContent=SHAPES.find(s=>s[0]===tool)?.[1]||'Shapes';$('polygon-actions').hidden=tool!=='polygon';
 const cfg=drawConfig();$('draw-options').hidden=!cfg;if(cfg){$('count-option').hidden=!cfg.count;$('ratio-option').hidden=!cfg.ratio;if(cfg.count){$('count-option').firstChild.textContent=cfg.count==='polygonSides'?'Sides ':'Points ';$('shape-count').max=cfg.max;$('shape-count').value=defaults[cfg.count];}if(cfg.ratio){$('ratio-option').firstChild.textContent=cfg.ratio==='ringHole'?'Hole size ':'Inner size ';$('shape-ratio').value=Math.round(defaults[cfg.ratio]*100);}}
}
function sync(){
 const chosen=items(),s=current(),multi=chosen.length>1,b=selectionBounds(chosen);$('properties').hidden=!chosen.length;$('no-selection').hidden=!!chosen.length;
 $('selection-heading').textContent=multi?'Selection':'Shape';$('selection-info').textContent=multi?chosen.length+' shapes selected':chosen.length?'1 shape selected':'Drag a box or click a shape.';
 for(const button of document.querySelectorAll('[data-tool]')){button.setAttribute('aria-pressed',String(button.dataset.tool===tool));if(button.dataset.tool==='points')button.disabled=multi;}
 $('add-select').setAttribute('aria-pressed',String(addSelection));syncAppearance(chosen);$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('finish').disabled=polygon.length<3;$('cancel-draw').disabled=!polygon.length;
 for(const id of['duplicate','delete','flip-x','flip-y','back','front','simplify','hide-selected'])$(id).disabled=!chosen.length;
 $('merge').disabled=chosen.length<2||chosen.some(s=>!s.fillEnabled||s.contours.some(c=>!c.closed||c.points.length<3));$('combine').disabled=chosen.length<2;
 for(const button of document.querySelectorAll('[data-align]'))button.disabled=!chosen.length;
 for(const id of['distribute-x','distribute-y'])$(id).disabled=chosen.length<3;
 if(chosen.length){
  $('name').disabled=multi;$('name').value=multi?chosen.length+' shapes':s.name;for(const key of['x','y','w','h'])field(key,Number(b[key].toFixed(2)));
  field('rotation',Number((multi?selectionAngle:s.rotation).toFixed(2)));field('radius',s.radius,mixed(chosen,'radius'));$('round-slider').value=Math.min(160,s.radius);
  $('opacity').value=s.opacity;$('opacity-value').textContent=mixed(chosen,'opacity')?'Mixed':Math.round(s.opacity*100)+'%';
  check('closed',chosen.flatMap(s=>s.contours.map(c=>c.closed)));const p=chosen.length===1&&pointSelection&&s.contours[pointSelection.ci]?.points[pointSelection.i];$('point-fields').hidden=!p;if(p){field('point-x',Number(p.x.toFixed(2)));field('point-y',Number(p.y.toFixed(2)));}
 }
 $('canvas-width').value=doc.width;$('canvas-height').value=doc.height;$('background-enabled').checked=!!doc.background;$('background').value=doc.background||'#ffffff';svg.setAttribute('viewBox',`0 0 ${doc.width} ${doc.height}`);$('paper').style.width=doc.width*zoom+'px';$('paper').style.height=doc.height*zoom+'px';$('paper').style.background=doc.background||'#fff';$('zoom-label').textContent=Math.round(zoom*100)+'%';
 $('layers').replaceChildren(...[...doc.items].reverse().map(item=>{const row=document.createElement('div');row.className='layer'+(selection.includes(item.id)?' selected':'');const label=document.createElement('button');label.textContent=item.name;label.setAttribute('aria-pressed',String(selection.includes(item.id)));label.onclick=e=>{finishRange();cancelGesture();polygon=[];tool='select';choose(item.id,e.shiftKey||e.ctrlKey||e.metaKey||addSelection);sync();};const visibility=document.createElement('button');visibility.textContent=item.hidden?'Show':'Hide';visibility.setAttribute('aria-label',(item.hidden?'Show ':'Hide ')+item.name);visibility.onclick=()=>change(()=>{item.hidden=!item.hidden;if(item.hidden)setSelection(selection.filter(id=>id!==item.id));});row.append(label,visibility);return row;}));paint();
}
function choose(id,add=false){if(add)setSelection(selection.includes(id)?selection.filter(v=>v!==id):[...selection,id]);else setSelection([id]);}
function position(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return{x:p.x,y:p.y};}
function dragBox(a,b){return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)};}
function cancelGesture(){if(!gesture)return;const before=gesture.before;gesture=null;restore(before);paint();}
function finishPolygon(){if(polygon.length<3)return;const points=polygon.filter((p,i)=>!i||Math.hypot(p.x-polygon[i-1].x,p.y-polygon[i-1].y)>.1);if(points.length<3)return;change(()=>{const s=makeShape(doc.nextId++,'polygon',points[0],points.at(-1),defaults);s.contours=[{points:clone(points),closed:true}];doc.items.push(s);setSelection([s.id]);});polygon=[];tool='select';sync();status('Polygon created. Use Corner rounding to soften its corners.');}
function begin(e){
 if(e.button!==0||gesture||e.target.closest('button,input,select'))return;finishRange();const p=position(e),onPaper=svg.contains(e.target);if(!onPaper&&!['select','points'].includes(tool))return;svg.focus({preventScroll:true});
 if(tool==='polygon'){polygon.push(p);sync();return;}
 const id=Number(e.target.closest('[data-id]')?.getAttribute('data-id')),handle=e.target.getAttribute('data-handle'),point=e.target.getAttribute('data-point'),add=e.shiftKey||e.ctrlKey||e.metaKey||addSelection;
 if(tool==='select'&&!id&&!handle){const before=snapshot(),base=add?[...selection]:[];setSelection(base);gesture={kind:'box',id:e.pointerId,before,p0:p,latest:p,base,moved:false};}
 else if(tool==='select'||tool==='points'){
  let toggleOnClick=null;if(id){if(add&&tool==='select'){if(selection.includes(id))toggleOnClick=id;else choose(id,true);}else if(!selection.includes(id))setSelection([id]);}
  const chosen=items(),s=current();if(!chosen.length){sync();return;}
  let index=point?.split(':').map(Number);if(tool==='points'&&chosen.length===1&&!index){let best=12/zoom;s.contours.forEach((c,ci)=>c.points.forEach((v,i)=>{const d=Math.hypot(v.x-p.x,v.y-p.y);if(d<best){best=d;index=[ci,i];}}));}
  if(tool==='points'&&(!index||chosen.length!==1)){if(!id&&!point){setSelection([]);}sync();return;}if(index)pointSelection={ci:index[0],i:index[1]};
  const box=selectionBounds(chosen);gesture={kind:index?'point':handle==='rotate'?'rotate':handle?'resize':'move',id:e.pointerId,before:snapshot(),p0:p,box,shapes:clone(chosen),handle,index,pointId:s?.id,angle:selectionAngle,moved:false,toggleOnClick};
 }else gesture={kind:'draw',before:snapshot(),id:e.pointerId,p0:p,raw:[p],shapeId:doc.nextId,moved:false};
 stage.setPointerCapture(e.pointerId);sync();
}
function move(e){
 if(!gesture||gesture.id!==e.pointerId)return;const g=gesture,p=position(e),distance=Math.hypot(p.x-g.p0.x,p.y-g.p0.y)*zoom;
 if(g.kind==='box'){g.latest=p;if(distance>=3)g.moved=true;if(g.moved)setSelection([...g.base,...boxSelection(doc.items,dragBox(g.p0,p))]);sync();return;}
 if(distance>=2)g.moved=true;if(!g.moved)return;
 if(g.kind==='draw'){
  let end={...p};if(e.shiftKey){if(tool==='line'){const r=Math.hypot(p.x-g.p0.x,p.y-g.p0.y),a=Math.round(Math.atan2(p.y-g.p0.y,p.x-g.p0.x)/(Math.PI/4))*Math.PI/4;end={x:g.p0.x+Math.cos(a)*r,y:g.p0.y+Math.sin(a)*r};}else{const size=Math.max(Math.abs(p.x-g.p0.x),Math.abs(p.y-g.p0.y));end={x:g.p0.x+Math.sign(p.x-g.p0.x)*size,y:g.p0.y+Math.sign(p.y-g.p0.y)*size};}}
  const s=makeShape(g.shapeId,tool,g.p0,end,defaults);if(tool==='pencil'){if(Math.hypot(p.x-g.raw.at(-1).x,p.y-g.raw.at(-1).y)>1/zoom&&g.raw.length<4096)g.raw.push(p);s.contours=[{points:clone(g.raw.length>1?g.raw:[g.p0,p]),closed:false}];s.fillEnabled=false;s.strokeEnabled=defaults.strokeEnabled;s.radius=0;}
  doc.items=JSON.parse(g.before.doc).items.concat(s);setSelection([s.id]);
 }else{
  const shapes=clone(g.shapes);let dx=p.x-g.p0.x,dy=p.y-g.p0.y;
  if(g.kind==='point')shapes.find(s=>s.id===g.pointId).contours[g.index[0]].points[g.index[1]]=p;
  else if(g.kind==='move'){if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}moveSelection(shapes,dx,dy);}
  else if(g.kind==='rotate'){const cx=g.box.x+g.box.w/2,cy=g.box.y+g.box.h/2;let delta=(Math.atan2(p.y-cy,p.x-cx)-Math.atan2(g.p0.y-cy,g.p0.x-cx))*180/Math.PI;if(e.shiftKey)delta=Math.round(delta/15)*15;rotateSelection(shapes,delta);selectionAngle=g.angle+delta;}
  else{const b=g.box,left=g.handle.includes('l'),top=g.handle.includes('t'),anchor={x:left?b.x+b.w:b.x,y:top?b.y+b.h:b.y};let w=Math.max(.1,left?anchor.x-p.x:p.x-anchor.x),h=Math.max(.1,top?anchor.y-p.y:p.y-anchor.y);if(e.shiftKey&&b.w&&b.h){const scale=Math.max(w/b.w,h/b.h);w=b.w*scale;h=b.h*scale;}resizeSelection(shapes,{x:left?anchor.x-w:anchor.x,y:top?anchor.y-h:anchor.y,w,h});}
  const replacements=new Map(shapes.map(s=>[s.id,s]));doc.items=doc.items.map(s=>replacements.get(s.id)||s);
 }paint();
}
function end(e){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;
 if(g.kind==='box'){sync();status(selection.length?selection.length+' shape'+(selection.length===1?'':'s')+' selected.':'Selection cleared.');return;}
 try{if(g.kind==='move'&&!g.moved&&g.toggleOnClick)setSelection(selection.filter(id=>id!==g.toggleOnClick));if(g.kind==='draw'){const s=current();if(!g.moved||!s||s.contours[0].points.length<2||bounds(s).w+bounds(s).h<1)restore(g.before);else{doc.nextId=g.shapeId+1;if(tool==='pencil')s.contours[0].points=simplify(s.contours[0].points,1.2);tool='select';}}doc=checkedDocument(doc);record(g.before);sync();}catch(err){restore(g.before);sync();status(err.message);}}
svg.setAttribute('tabindex','0');for(const[type,fn]of[['pointerdown',begin],['pointermove',move],['pointerup',end]])stage.addEventListener(type,fn);stage.addEventListener('pointercancel',()=>{cancelGesture();sync();});stage.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId){cancelGesture();sync();}});
svg.addEventListener('dblclick',e=>{if(tool==='polygon'){finishPolygon();return;}if(tool!=='points'||items().length!==1)return;const p=position(e),s=current();let best=24/zoom,chosen=null;for(let ci=0;ci<s.contours.length;ci++){const c=s.contours[ci];for(let i=0;i<c.points.length-(c.closed?0:1);i++){const a=c.points[i],b=c.points[(i+1)%c.points.length],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0,q={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(p.x-q.x,p.y-q.y);if(d<best){best=d;chosen={ci,i:i+1,q};}}}if(chosen)change(()=>{s.contours[chosen.ci].points.splice(chosen.i,0,chosen.q);pointSelection={ci:chosen.ci,i:chosen.i};});});
for(const[kind,label]of SHAPES){const b=document.createElement('button');b.dataset.tool=kind;b.title=label;b.setAttribute('aria-label',label);const icon=element('svg',{viewBox:'0 0 32 24','aria-hidden':'true',focusable:'false'}),sample=makeShape(0,kind,{x:3,y:3},{x:29,y:21},defaults);icon.append(element('path',{d:roundedPath(sample.contours,sample.radius),fill:'none',stroke:'currentColor','stroke-width':1.4,'stroke-linejoin':'round','stroke-linecap':'round','fill-rule':sample.fillRule}));b.append(icon);$('shape-gallery').append(b);}
const appearanceKeys=['fill','stroke','fillEnabled','strokeEnabled','fillAlpha','strokeAlpha','strokeWidth','lineCap','lineJoin'];
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{finishRange();cancelGesture();const old=current();polygon=[];pointSelection=null;tool=b.dataset.tool;if(!['select','points'].includes(tool)){if(old)for(const key of appearanceKeys)defaults[key]=old[key];setSelection([]);if(['line','arc','pencil'].includes(tool))defaults.strokeEnabled=true;}sync();status(tool==='polygon'?'Click each corner. Enter or Finish polygon to close it.':tool==='points'?'Drag points. Double-click an edge to add a point.':tool==='select'?'Drag a box to select shapes. Shift-click to add or remove.':'Drag to draw. Hold Shift to constrain.');});
$('finish').onclick=finishPolygon;$('cancel-draw').onclick=()=>{polygon=[];sync();};
function selectAll(){finishRange();cancelGesture();polygon=[];tool='select';setSelection(doc.items.filter(s=>!s.hidden).map(s=>s.id));sync();status(selection.length+' shapes selected.');}
$('select-all').onclick=selectAll;$('add-select').onclick=()=>{finishRange();cancelGesture();polygon=[];tool='select';addSelection=!addSelection;sync();status(addSelection?'Add selection: click shapes or drag another box.':'Replace selection: click a shape or drag a box.');};
function applyStyles(values){finishRange();for(const[key,value]of Object.entries(values)){const valid=['fill','stroke'].includes(key)?/^#[0-9a-f]{6}$/i.test(value):key==='strokeWidth'?Number.isFinite(value)&&value>=0&&value<=512:['fillAlpha','strokeAlpha'].includes(key)?Number.isFinite(value)&&value>=0&&value<=1:key==='lineCap'?['round','butt','square'].includes(value):key==='lineJoin'?['round','miter','bevel'].includes(value):['fillEnabled','strokeEnabled'].includes(key)&&typeof value==='boolean';if(!valid){status('Enter a valid color, opacity, or outline width (0-512 px).');sync();return;}}
 const chosen=items();if(!chosen.length||change(()=>chosen.forEach(s=>Object.assign(s,values)))){Object.assign(defaults,values);sync();status(chosen.length?chosen.length+' selected shape'+(chosen.length===1?'':'s')+' updated.':'New shape style updated.');}}
for(const key of['fill','stroke','strokeWidth','lineCap','lineJoin'])$(key).onchange=e=>applyStyles({[key]:key==='strokeWidth'?Number(e.target.value):e.target.value});for(const key of['fillAlpha','strokeAlpha'])$(key).onchange=e=>applyStyles({[key]:Number(e.target.value)/100});$('fill-enabled').onchange=e=>applyStyles({fillEnabled:e.target.checked});$('stroke-enabled').onchange=e=>applyStyles({strokeEnabled:e.target.checked});
for(const key of['fill','stroke'])$(key+'-hex').onchange=e=>{let value=e.target.value.trim().replace(/^#/,'');if(/^[0-9a-f]{3}$/i.test(value))value=[...value].map(c=>c+c).join('');applyStyles({[key]:'#'+value.toLowerCase()});};
function previewRange(key,value){if(!rangeEdit)rangeEdit={before:snapshot(),defaults:clone(defaults)};if(key==='strokeWidth')defaults.strokeWidth=value;for(const s of items())s[key]=value;if(key==='strokeWidth')$('strokeWidth').value=value;if(key==='radius')$('radius').value=value;if(key==='opacity')$('opacity-value').textContent=Math.round(value*100)+'%';paint();}
function finishRange(cancel=false){if(!rangeEdit)return;const edit=rangeEdit;rangeEdit=null;if(cancel){restore(edit.before);defaults=edit.defaults;}else{doc=checkedDocument(doc);record(edit.before);}sync();}
for(const[id,key]of[['outline-width-slider','strokeWidth'],['round-slider','radius'],['opacity','opacity']]){$(id).oninput=e=>previewRange(key,Number(e.target.value));$(id).onchange=()=>finishRange();$(id).onpointercancel=()=>finishRange(true);}
$('shape-count').onchange=e=>{const cfg=drawConfig(),value=Number(e.target.value);if(cfg?.count&&Number.isFinite(value))defaults[cfg.count]=Math.round(clamp(value,3,cfg.max));sync();};$('shape-ratio').onchange=e=>{const cfg=drawConfig(),value=Number(e.target.value);if(cfg?.ratio&&Number.isFinite(value))defaults[cfg.ratio]=clamp(value/100,.1,.9);sync();};
for(const color of['#20242a','#ffffff','#db4646','#eb9b36','#f2d456','#57a76d','#4ca9aa','#427ee8','#8054ba','#d376ae']){const b=document.createElement('button');b.style.background=color;b.title=color;b.setAttribute('aria-label','Use '+color);b.onclick=()=>{const key=$('palette-target').value;applyStyles({[key]:color,[key==='fill'?'fillEnabled':'strokeEnabled']:true});};$('palette').append(b);}
$('swap-colors').onclick=()=>{const chosen=items();if(chosen.length){if(change(()=>{for(const s of chosen)[s.fill,s.stroke]=[s.stroke,s.fill];})){const s=current();defaults.fill=s.fill;defaults.stroke=s.stroke;}}else{[defaults.fill,defaults.stroke]=[defaults.stroke,defaults.fill];sync();}};
$('name').onchange=e=>{const value=e.target.value;if(items().length===1)change(()=>current().name=value);};$('radius').onchange=e=>{const value=Number(e.target.value);change(()=>items().forEach(s=>s.radius=value));};
for(const key of['x','y','w','h'])$(key).onchange=e=>{const value=Number(e.target.value);change(()=>{if(!Number.isFinite(value)||(key==='w'||key==='h')&&value<0)throw Error('Enter a valid size or position.');resizeSelection(items(),{...selectionBounds(items()),[key]:value});});};
$('rotation').onchange=e=>{const value=Number(e.target.value),chosen=items(),before=chosen.length>1?selectionAngle:chosen[0]?.rotation||0;change(()=>{rotateSelection(chosen,value-before);selectionAngle=value;});};
$('closed').onchange=e=>{const value=e.target.checked;change(()=>{const chosen=items();if(value&&chosen.some(s=>s.contours.some(c=>c.points.length<3)))throw Error('Add a third point before closing these outlines.');for(const s of chosen)for(const c of s.contours)c.closed=value;});};
for(const key of['x','y'])$('point-'+key).onchange=e=>{const value=Number(e.target.value);if(items().length===1&&pointSelection)change(()=>current().contours[pointSelection.ci].points[pointSelection.i][key]=value);};
$('remove-point').onclick=()=>{if(items().length!==1||!pointSelection)return;change(()=>{const c=current().contours[pointSelection.ci];if(c.points.length<=(c.closed?3:2))throw Error('This outline needs its remaining points.');c.points.splice(pointSelection.i,1);pointSelection=null;});};
$('simplify').onclick=()=>{const t=Number($('tolerance').value);change(()=>{if(!Number.isFinite(t)||t<0||t>100)throw Error('Choose a threshold from 0 to 100.');for(const s of items())for(const c of s.contours){const p=simplify(c.points,t);if(p.length>=(c.closed?3:2))c.points=p;}pointSelection=null;});};
function duplicate(){const chosen=items();if(!chosen.length)return;change(()=>{const copies=chosen.map(s=>{const copy=clone(s);copy.id=doc.nextId++;copy.name=(s.name+' copy').slice(0,100);return copy;});moveSelection(copies,16,16);doc.items.push(...copies);setSelection(copies.map(s=>s.id));});}
function remove(){if(!selection.length)return;change(()=>{doc.items=doc.items.filter(s=>!selection.includes(s.id));setSelection([]);});}
function joinSelection(union){const chosen=items();if(chosen.length<2)return;change(()=>{const shape=union?mergedShape(chosen,doc.nextId):combinedShape(chosen,doc.nextId);const at=doc.items.slice(0,doc.items.findIndex(s=>s.id===chosen.at(-1).id)+1).filter(s=>!selection.includes(s.id)).length;doc.nextId++;doc.items=doc.items.filter(s=>!selection.includes(s.id));doc.items.splice(at,0,shape);setSelection([shape.id]);});if(selection.length===1)status((union?'Merged':'Combined')+' paths use the topmost shape\'s fill and outline.');}
$('duplicate').onclick=duplicate;$('delete').onclick=remove;$('merge').onclick=()=>joinSelection(true);$('combine').onclick=()=>joinSelection(false);
for(const axis of['x','y'])$('flip-'+axis).onclick=()=>change(()=>flipSelection(items(),axis));
for(const b of document.querySelectorAll('[data-align]'))b.onclick=()=>{if(change(()=>alignSelection(items(),doc.width,doc.height,b.dataset.align,$('align-target').value==='selection')))status('Selection aligned.');};
for(const axis of['x','y'])$('distribute-'+axis).onclick=()=>change(()=>distributeSelection(items(),axis));
for(const direction of['front','back'])$(direction).onclick=()=>change(()=>{const chosen=items(),rest=doc.items.filter(s=>!selection.includes(s.id));doc.items=direction==='front'?[...rest,...chosen]:[...chosen,...rest];});
$('hide-selected').onclick=()=>change(()=>{for(const s of items())s.hidden=true;setSelection([]);});$('undo').onclick=()=>history();$('redo').onclick=()=>history(true);
for(const key of['width','height'])$('canvas-'+key).onchange=e=>{const value=Number(e.target.value);change(()=>doc[key]=value);};$('background-enabled').onchange=e=>{const value=e.target.checked;change(()=>doc.background=value?$('background').value:null);};$('background').onchange=e=>{const value=e.target.value;change(()=>doc.background=value);};
function setZoom(value){zoom=clamp(value,.025,32);sync();}function fit(){const padding=innerWidth<=700?36:64;setZoom(Math.min(32,(stage.clientWidth-padding)/doc.width,(stage.clientHeight-padding)/doc.height));}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('fit').onclick=fit;$('zoom-in').onclick=()=>setZoom(zoom*1.25);$('zoom-out').onclick=()=>setZoom(zoom/1.25);stage.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1));}},{passive:false});
$('new').onclick=()=>{polygon=[];change(()=>{doc=createDocument();setSelection([]);});fit();status('New canvas. Undo restores the previous drawing.');};
$('save').onclick=()=>{finishRange();cancelGesture();persist();download(new Blob([serial()],{type:'application/json'}),'drawing.svgpaint');status('Project saved.');};$('export').onclick=()=>{finishRange();cancelGesture();download(new Blob([exportSVG(doc)],{type:'image/svg+xml'}),'drawing.svg');status('SVG exported.');};$('open').onclick=()=>$('project-file').click();$('import').onclick=()=>$('svg-file').click();
$('project-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>3000000)throw Error('Project is too large.');const next=checkedDocument(JSON.parse(await f.text()));change(()=>{doc=next;setSelection([]);polygon=[];});fit();status('Project opened.');}catch(err){status(err.message);}finally{e.target.value='';}};
async function importSVG(file){if(!file)return;try{if(file.size>1000000)throw Error('Use an SVG smaller than 1 MB.');const data=readSVG(await file.text(),{square:false}),next=createDocument();next.width=clamp(data.width,1,4096);next.height=clamp(data.height,1,4096);const hex=c=>'#'+c.slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');for(const shape of data.shapes){const s=makeShape(next.nextId++,'path',{x:0,y:0},{x:1,y:1},defaults);s.contours=shape.contours.map(c=>({closed:c.closed,points:c.points.map(p=>({x:p.x*data.width,y:p.y*data.height}))}));s.fillEnabled=!!shape.fill;s.strokeEnabled=!!shape.stroke;s.fill=shape.fill?hex(shape.fill):'#000000';s.stroke=shape.stroke?hex(shape.stroke):'#000000';s.fillAlpha=shape.fill?.[3]??1;s.strokeAlpha=shape.stroke?.[3]??1;s.strokeWidth=shape.strokeWidth*data.width;s.fillRule=shape.fillRule;s.lineJoin=shape.lineJoin;s.lineCap=shape.lineCap;s.radius=0;next.items.push(s);}const validated=checkedDocument(next);change(()=>{doc=validated;setSelection([]);polygon=[];});fit();status('SVG imported as editable points. Undo restores your previous drawing.');}catch(e){status(e.message);}}
$('svg-file').onchange=async e=>{await importSVG(e.target.files[0]);e.target.value='';};stage.ondragover=e=>e.preventDefault();stage.ondrop=e=>{e.preventDefault();importSVG(e.dataTransfer.files[0]);};
function setTheme(theme){document.documentElement.dataset.theme=theme;$('theme').textContent=theme==='dark'?'Light':'Dark';$('theme').setAttribute('aria-label','Switch to '+(theme==='dark'?'light':'dark')+' theme');document.querySelector('meta[name=theme-color]').content=theme==='dark'?'#202124':'#f3f3f3';try{localStorage.setItem('neoj-svg-paint-theme',theme);}catch{}}
$('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&rangeEdit){e.preventDefault();finishRange(true);return;}const command=e.ctrlKey||e.metaKey;
 if(command&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();return;}if(e.target.closest('input,select,textarea'))return;
 if(command&&e.key.toLowerCase()==='a'){e.preventDefault();selectAll();}else if(command&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey);}else if(command&&e.key.toLowerCase()==='y'){e.preventDefault();history(true);}else if(command&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
 else if(e.key==='Enter'&&polygon.length){e.preventDefault();finishPolygon();}else if(e.key==='Escape'){const active=!!gesture;cancelGesture();polygon=[];if(!active)setSelection([]);sync();}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();pointSelection&&items().length===1?$('remove-point').click():remove();}
 else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selection.length){e.preventDefault();const step=e.shiftKey?10:1,dx=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,dy=e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0;change(()=>{if(pointSelection&&items().length===1){const p=current().contours[pointSelection.ci].points[pointSelection.i];p.x+=dx;p.y+=dy;}else moveSelection(items(),dx,dy);});}
});
window.addEventListener('blur',()=>{finishRange();cancelGesture();sync();});window.addEventListener('pagehide',()=>{finishRange();cancelGesture();persist();});
try{const saved=localStorage.getItem('neoj-svg-paint-v1');if(saved)doc=checkedDocument(JSON.parse(saved));setTheme(localStorage.getItem('neoj-svg-paint-theme')==='dark'?'dark':'light');}catch{status('Saved draft could not be restored.');}
for(const id of['lineCap','lineJoin']){const option=document.createElement('option');option.value='';option.textContent='Mixed';option.disabled=true;option.hidden=true;$(id).prepend(option);}
installTouchButtons();sync();requestAnimationFrame(fit);
window.svgPaint=Object.freeze({snapshot:()=>({document:clone(doc),selected:selection.at(-1)||null,selection:[...selection],selectionBounds:selectionBounds(items()),selectionAngle,pointSelection:clone(pointSelection),tool,addSelection,polygon:clone(polygon),zoom,undo:undo.length,redo:redo.length}),point:(x,y)=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return{x:p.x,y:p.y};}});
