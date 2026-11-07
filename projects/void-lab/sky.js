export const skyShader=`precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform mat3 u_camera;
uniform vec3 u_eye;
uniform vec4 u_masses[8];
uniform float u_compact[8];
uniform int u_dominant;
uniform float u_tan;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 stars(vec3 ray){
  vec2 sky=vec2(atan(ray.z,ray.x)/6.2831853+.5,asin(clamp(ray.y,-1.,1.))/3.14159265+.5)*vec2(720.,360.);
  vec2 cell=floor(sky),local=fract(sky);float h=hash(cell);
  vec2 center=vec2(hash(cell+4.),hash(cell+7.));float size=mix(.04,.15,hash(cell+13.));
  float light=(1.-smoothstep(size*.25,size,length(local-center)))*step(.84,h)*mix(.18,.8,hash(cell+19.));
  return vec3(.055,.071,.061)+vec3(.7,.82,.74)*light;
}
vec3 accel(vec3 p,float coefficient){float r2=dot(p,p);return -coefficient*p/(r2*r2*sqrt(r2));}
// For a static Schwarzschild source the affine-parameter path obeys
// r'' = -(3/2) r_s L² r / |r|^5. RK4 follows this, rather than a screen warp.
vec3 trace(vec3 ray,vec4 source,out bool captured){
  vec3 p=u_eye-source.xyz;float rs=source.w,D=length(p);captured=false;
  if(D<=rs){captured=true;return ray;}
  vec3 radial=p/D;float mu=dot(ray,radial),f=1.-rs/D;
  vec3 tangent=ray-radial*mu;float L=D*length(tangent)/sqrt(f);
  if(mu<0.&&D>1.5*rs&&L<2.598076211*rs){captured=true;return ray;}
  vec3 v=radial*mu+tangent/sqrt(f);float coefficient=1.5*rs*L*L;
  for(int step=0;step<112;step++){
    float r=length(p);if(r<=rs*1.0002){captured=true;return v;}
    if(step>0&&dot(p,v)>0.&&r>max(D,40.*rs))return normalize(v);
    float h=.11*r/max(length(v),.1);
    vec3 a1=accel(p,coefficient),p2=p+v*h*.5,v2=v+a1*h*.5;
    vec3 a2=accel(p2,coefficient),p3=p+v2*h*.5,v3=v+a2*h*.5;
    vec3 a3=accel(p3,coefficient),p4=p+v3*h,v4=v+a3*h;
    p+=h*(v+2.*v2+2.*v3+v4)/6.;v+=h*(a1+2.*a2+2.*a3+accel(p4,coefficient))/6.;
  }
  return normalize(v);
}
void main(){
  vec2 p=(v_uv-.5)*2.;p.x*=u_resolution.x/u_resolution.y;
  vec3 ray=normalize(u_camera*vec3(p*u_tan,-1.));bool captured=false;
  for(int i=0;i<8;i++){
    vec4 source=u_masses[i];if(source.w<=0.)continue;
    vec3 toward=source.xyz-u_eye;float D=length(toward),along=dot(toward,ray);
    vec3 side=toward-ray*along;float b=length(side);
    if(i==u_dominant&&u_compact[i]>.5&&(b<12.*source.w||D<4.*source.w)){
      ray=trace(ray,source,captured);if(captured){gl_FragColor=vec4(0.,0.,0.,1.);return;}
    }else{
      // Finite-observer, weak-field deflection; mass sets the strength.
      float alpha=source.w*(1.+along/max(D,.000001))/max(b,.000001);
      if(b>.000001)ray=normalize(ray+side/b*alpha);
    }
  }
  gl_FragColor=vec4(stars(ray),1.);
}`;
