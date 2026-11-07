import {STEP} from './physics.js?v=2';

export function stepBacklog(simulation,backlog,{maxSteps=80,budgetMs=12,now=()=>performance.now()}={}){
  const started=now();let steps=0,advanced=0;
  // Carry the sub-frame remainder forward. Tiny variable remainder steps disrupt
  // contact warm starting; adapt only when the physics itself requires it.
  while(backlog+1e-12>=STEP&&steps<maxSteps&&now()-started<budgetMs){
    const dt=simulation.step(STEP);
    if(!Number.isFinite(dt)||dt<=0||dt>STEP+1e-10)throw Error('Invalid physics timestep.');
    backlog=Math.max(0,backlog-dt);advanced+=dt;steps++;
  }
  return{backlog,steps,advanced};
}
