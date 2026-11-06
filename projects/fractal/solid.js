// Orthographic, pixel-sized detail shared by the GPU and double-precision worker.
export const isSolid = mode => mode === "menger" || mode === "tetra";
export const DEFAULT_ORBIT = Object.freeze({ yaw: 0.65, pitch: 0.38 });
export const TETRA_VERTICES = Object.freeze([[1, 1, 1], [-1, -1, 1], [1, -1, -1], [-1, 1, -1]]);

export function solidDetail(mode, span, height) {
  const pixel = span / height;
  return { pixel, epsilon: Math.max(1e-12, pixel * 0.4), levels: Math.max(1, Math.min(48, Math.ceil(Math.log(2 / pixel) / Math.log(mode === "menger" ? 3 : 2)) + 1)) };
}
export function solidBasis(orbit = DEFAULT_ORBIT) {
  const sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw), sp = Math.sin(orbit.pitch), cp = Math.cos(orbit.pitch);
  return { right: [cy, 0, -sy], up: [-sy * sp, cp, -cy * sp], back: [sy * cp, sp, cy * cp] };
}
const mod = (x, y) => x - y * Math.floor(x / y);
export function solidDistance(x, y, z, mode, levels) {
  if (mode === "menger") {
    const ax = Math.abs(x) - 1, ay = Math.abs(y) - 1, az = Math.abs(z) - 1;
    let distance = Math.hypot(Math.max(ax, 0), Math.max(ay, 0), Math.max(az, 0)) + Math.min(Math.max(ax, ay, az), 0), half = 1;
    for (let i = 0; i < levels; i++) {
      const a = Math.abs(mod(x + half, 2 * half) - half), b = Math.abs(mod(y + half, 2 * half) - half), c = Math.abs(mod(z + half, 2 * half) - half);
      const median = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
      distance = Math.max(distance, half / 3 - median);
      half /= 3;
    }
    return distance;
  }
  let scale = 1;
  for (let i = 0; i < levels; i++) {
    let chosen = TETRA_VERTICES[0], best = -Infinity;
    for (const v of TETRA_VERTICES) {
      const dot = x * v[0] + y * v[1] + z * v[2];
      if (dot > best) { best = dot; chosen = v; }
    }
    x = 2 * x - chosen[0]; y = 2 * y - chosen[1]; z = 2 * z - chosen[2]; scale *= 2;
  }
  return Math.max(...TETRA_VERTICES.map(v => -x * v[0] - y * v[1] - z * v[2] - 1)) / (Math.sqrt(3) * scale);
}
export function rayBounds(origin, direction) {
  let near = -Infinity, far = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]) < 1e-14) { if (Math.abs(origin[i]) > 1) return null; continue; }
    const a = (-1 - origin[i]) / direction[i], b = (1 - origin[i]) / direction[i];
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
  }
  return far >= Math.max(near, 0) ? [Math.max(near, 0), far] : null;
}
export function traceSolid(origin, direction, mode, detail) {
  const bounds = rayBounds(origin, direction);
  if (!bounds) return null;
  let travel = bounds[0];
  for (let step = 0; step < 384 && travel <= bounds[1]; step++) {
    const point = origin.map((n, i) => n + direction[i] * travel);
    const distance = solidDistance(...point, mode, detail.levels);
    if (distance < detail.epsilon) {
      const e = detail.epsilon * 1.5;
      const normal = point.map((_, axis) => {
        const a = [...point], b = [...point]; a[axis] += e; b[axis] -= e;
        return solidDistance(...a, mode, detail.levels) - solidDistance(...b, mode, detail.levels);
      });
      const length = Math.hypot(...normal);
      return { point, normal: length > 1e-20 ? normal.map(n => n / length) : direction.map(n => -n), steps: step + 1, travel };
    }
    travel += Math.max(distance * 0.95, detail.epsilon * 0.25);
  }
  return null;
}
export function solidPixel(column, row, width, height, state, basis, detail, colors) {
  const sx = state.camera.x + (column + 0.5 - width / 2) * detail.pixel, sy = state.camera.y + (height / 2 - row - 0.5) * detail.pixel;
  const origin = basis.back.map((n, i) => n * 6 + basis.right[i] * sx + basis.up[i] * sy);
  const hit = traceSolid(origin, basis.back.map(n => -n), state.mode, detail);
  if (!hit) return [16, 21, 23];
  const light = [-0.444444, 0.777778, 0.444444];
  const diffuse = Math.max(0, hit.normal.reduce((sum, n, i) => sum + n * light[i], 0));
  let ao = 0;
  for (const factor of [8, 32]) {
    const distance = detail.epsilon * factor, p = hit.point.map((n, i) => n + hit.normal[i] * distance);
    ao += Math.max(0, Math.min(1, solidDistance(...p, state.mode, detail.levels) / distance));
  }
  const shade = (0.3 + 0.7 * diffuse) * (0.6 + 0.2 * ao), t = Math.max(0, Math.min(0.9999, (hit.point[1] + 1) * 0.5)) * 3;
  const index = Math.floor(t) + 1, mix = t % 1;
  return colors[index].map((n, channel) => Math.round((n + (colors[index + 1][channel] - n) * mix) * shade));
}

export const solidFragmentSource = `precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_span;
uniform int u_mode;
uniform int u_levels;
uniform vec3 u_right;
uniform vec3 u_up;
uniform vec3 u_back;
uniform vec3 u_colors[5];
float field(vec3 p){
  if(u_mode==0){
    vec3 q=abs(p)-1.0;
    float d=length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
    float h=1.0;
    for(int i=0;i<32;i++){
      if(i>=u_levels)break;
      vec3 a=abs(mod(p+h,2.0*h)-h);
      float middle=max(min(a.x,a.y),min(max(a.x,a.y),a.z));
      d=max(d,h/3.0-middle); h/=3.0;
    }
    return d;
  }
  float scale=1.0;
  for(int i=0;i<32;i++){
    if(i>=u_levels)break;
    vec3 v=vec3(1.0); float best=dot(p,v);
    vec3 candidate=vec3(-1.0,-1.0,1.0); float score=dot(p,candidate);
    if(score>best){best=score;v=candidate;}
    candidate=vec3(1.0,-1.0,-1.0); score=dot(p,candidate);
    if(score>best){best=score;v=candidate;}
    candidate=vec3(-1.0,1.0,-1.0); score=dot(p,candidate);
    if(score>best)v=candidate;
    p=2.0*p-v; scale*=2.0;
  }
  return (max(max(-p.x-p.y-p.z,p.x+p.y-p.z),max(-p.x+p.y+p.z,p.x-p.y+p.z))-1.0)/(1.732050808*scale);
}
void main(){
  vec2 uv=u_center+(gl_FragCoord.xy-u_resolution*0.5)*u_span/u_resolution.y;
  vec3 ro=u_back*6.0+u_right*uv.x+u_up*uv.y, rd=-u_back;
  vec3 safeDirection=vec3(abs(rd.x)<1e-8?1e-8:rd.x,abs(rd.y)<1e-8?1e-8:rd.y,abs(rd.z)<1e-8?1e-8:rd.z);
  vec3 a=(-1.0-ro)/safeDirection,b=(1.0-ro)/safeDirection;
  vec3 lo=min(a,b),hi=max(a,b);
  float t=max(0.0,max(lo.x,max(lo.y,lo.z))),far=min(hi.x,min(hi.y,hi.z));
  float epsilon=max(1e-7,u_span/u_resolution.y*0.4);
  vec3 p=ro; bool hit=false;
  for(int i=0;i<384;i++){
    if(t>far)break;
    p=ro+rd*t; float d=field(p);
    if(d<epsilon){hit=true;break;}
    t+=max(d*0.95,epsilon*0.25);
  }
  if(!hit){gl_FragColor=vec4(16.0,21.0,23.0,255.0)/255.0;return;}
  vec2 e=vec2(epsilon*1.5,0.0);
  vec3 n=vec3(field(p+e.xyy)-field(p-e.xyy),field(p+e.yxy)-field(p-e.yxy),field(p+e.yyx)-field(p-e.yyx));
  n=length(n)>1e-15?normalize(n):-rd;
  float diffuse=max(0.0,dot(n,vec3(-0.444444,0.777778,0.444444)));
  float ao=clamp(field(p+n*epsilon*8.0)/(epsilon*8.0),0.0,1.0)+clamp(field(p+n*epsilon*32.0)/(epsilon*32.0),0.0,1.0);
  float shade=(0.3+0.7*diffuse)*(0.6+0.2*ao),v=clamp((p.y+1.0)*0.5,0.0,0.9999)*3.0;
  vec3 c=v<1.0?mix(u_colors[1],u_colors[2],v):v<2.0?mix(u_colors[2],u_colors[3],v-1.0):mix(u_colors[3],u_colors[4],v-2.0);
  gl_FragColor=vec4(c*shade,1.0);
}`;
