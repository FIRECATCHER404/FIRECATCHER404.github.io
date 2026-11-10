// A release can change the layout before the browser dispatches compatibility
// mouse events. Block that whole sequence so it cannot hit a newly exposed input.
export function installTouchButtons(){
 let tap=null,last=null;
 document.addEventListener('keydown',()=>last=null,true);
 document.addEventListener('pointerdown',e=>{last=null;tap=null;if(e.pointerType==='touch'){const button=e.target.closest('button');if(button)tap={button,id:e.pointerId,x:e.clientX,y:e.clientY};}},true);
 document.addEventListener('pointercancel',()=>{tap=null;last=null;},true);
 document.addEventListener('pointerup',e=>{const t=tap;if(e.pointerType!=='touch'||!t||e.pointerId!==t.id)return;tap=null;if(t.button===e.target.closest('button')&&Math.hypot(e.clientX-t.x,e.clientY-t.y)<8&&!t.button.disabled){last={x:e.clientX,y:e.clientY,time:performance.now()};t.button.click();}},true);
 const suppress=e=>{if(e.isTrusted&&last&&performance.now()-last.time<800&&(e.sourceCapabilities?.firesTouchEvents||e.pointerType==='touch'||Math.hypot(e.clientX-last.x,e.clientY-last.y)<12)){e.preventDefault();e.stopImmediatePropagation();}};
 for(const type of['mousedown','mouseup','click'])document.addEventListener(type,suppress,true);
}
