// Scaled units: the length/time/mass units are chosen so G=.18 and c=40.
// These constants are fixed, including when the mutual-force experiment is paused.
export const G=.18,C=40,MAX_MASS=1e8;
export const schwarzschildRadius=mass=>2*G*mass/(C*C);
export const compactness=(mass,radius)=>schwarzschildRadius(mass)/radius;
export const shadowImpact=mass=>Math.sqrt(27)/2*schwarzschildRadius(mass);
export const weakDeflection=(mass,impact)=>4*G*mass/(C*C*impact);

// Schwarzschild null geodesic in its orbital plane, u=r_s/r:
// u'' + u = 3u²/2. Used independently to verify the GPU ray equation.
export function tracePhoton(impact,rs,{step=.002,maxAngle=20}={}){
  let u=0,v=rs/impact,phi=0,started=false;
  const acceleration=x=>1.5*x*x-x;
  while(phi<maxAngle){
    const h=step,a=acceleration(u),ub=u+h*v/2,vb=v+h*a/2,uc=u+h*vb/2,vc=v+h*acceleration(ub)/2,ud=u+h*vc,vd=v+h*acceleration(uc);
    u+=h*(v+2*vb+2*vc+vd)/6;v+=h*(a+2*acceleration(ub)+2*acceleration(uc)+acceleration(ud))/6;phi+=h;
    if(u>=1)return{captured:true,angle:phi};
    if(u>0)started=true;
    if(started&&u<0){const crossing=phi-u/v;return{captured:false,angle:crossing-Math.PI};}
  }
  return{captured:false,angle:phi-Math.PI,unresolved:true};
}
