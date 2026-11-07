import {cameraBasis,FOV_TAN,orbitNormal,normalize} from "./physics.js?v=2";

export function sceneGuides(simulation,settings) {
  if(!settings.grid)return [];
  const primary=simulation.bodies.find(b=>b.id===settings.selectedId),normal=settings.tool==="orbit"?orbitNormal(settings.orbitTilt):{x:0,y:0,z:1};
  const horizontal={x:1,y:0,z:0},vertical=normalize({x:0,y:normal.z,z:-normal.y});
  const desired=settings.camera.span/14,power=10**Math.floor(Math.log10(desired)),spacing=[1,2,5,10].find(n=>n*power>=desired)*power;
  const center=settings.tool==="orbit"&&primary?primary:{x:Math.round(settings.camera.x/spacing)*spacing,y:Math.round(settings.camera.y/spacing)*spacing,z:settings.tool==="place"?settings.placementZ:0};
  const point=(u,v)=>({x:center.x+horizontal.x*u+vertical.x*v,y:center.y+horizontal.y*u+vertical.y*v,z:center.z+horizontal.z*u+vertical.z*v});
  const lines=[];
  for(let i=-8;i<=8;i++){
    lines.push({points:[point(i*spacing,-8*spacing),point(i*spacing,8*spacing)],color:[.4,.6,.46,i===0?.35:.11]});
    lines.push({points:[point(-8*spacing,i*spacing),point(8*spacing,i*spacing)],color:[.4,.6,.46,i===0?.35:.11]});
  }
  if(primary)lines.push({points:[{x:primary.x,y:primary.y,z:0},primary],color:[.45,.65,.85,.5]});
  return lines;
}

const common=`uniform vec3 u_right,u_up,u_back; uniform float u_distance,u_tan,u_aspect,u_near,u_far;
vec4 project(vec3 p){float d=u_distance-dot(p,u_back);return vec4(dot(p,u_right)/(u_tan*u_aspect),dot(p,u_up)/u_tan,((u_far+u_near)*d-2.0*u_far*u_near)/(u_far-u_near),d);}`;
const sphereVertex=`attribute vec3 a_position; uniform vec3 u_center; uniform float u_radius; varying vec3 v_normal,v_world; ${common}
void main(){v_normal=a_position;v_world=u_center+a_position*u_radius;gl_Position=project(v_world);}`;
const sphereFragment=`precision highp float; uniform vec3 u_color,u_light,u_eye; uniform float u_star,u_hasLight; varying vec3 v_normal,v_world;
void main(){vec3 n=normalize(v_normal),l=u_hasLight>0.5?normalize(u_light-v_world):normalize(vec3(-.4,-.5,.8)),v=normalize(u_eye-v_world);float diffuse=max(0.0,dot(n,l));float spec=pow(max(0.0,dot(reflect(-l,n),v)),18.0)*.12;vec3 color=u_color*(.22+.78*diffuse)+spec;if(u_star>.5)color=mix(u_color,vec3(1.0,.97,.84),pow(max(0.0,dot(n,v)),2.0)*.65);gl_FragColor=vec4(color,1.0);}`;
const lineVertex=`attribute vec3 a_position;uniform float u_size;${common}
void main(){gl_Position=project(a_position);gl_PointSize=u_size;}`;
const lineFragment=`precision mediump float;uniform vec4 u_color;uniform float u_glow;
void main(){float a=u_color.a;if(u_glow>.5){float r=length(gl_PointCoord-vec2(.5))*2.0;if(r>1.0)discard;a*=pow(1.0-r,2.0);}gl_FragColor=vec4(u_color.rgb,a);}`;
const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255);
export class GLRenderer {
  constructor(canvas){
    this.canvas=canvas;this.gl=null;this.init();
    canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();this.gl=null;});
    canvas.addEventListener("webglcontextrestored",()=>this.init());
  }
  init(){
    try{
      const gl=this.canvas.getContext("webgl",{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)return;
      const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
      const program=(vertex,fragment,extra)=>{const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragment));gl.bindAttribLocation(p,0,"a_position");gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return{program:p,uniforms:Object.fromEntries(["right","up","back","distance","tan","aspect","near","far",...extra].map(key=>[key,gl.getUniformLocation(p,"u_"+key)]))};};
      this.sphere=program(sphereVertex,sphereFragment,["center","radius","color","light","eye","star","hasLight"]);
      this.line=program(lineVertex,lineFragment,["color","size","glow"]);
      const vertices=[],indices=[],rows=20,columns=32;
      for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){const latitude=row/rows*Math.PI,longitude=column/columns*Math.PI*2;vertices.push(Math.sin(latitude)*Math.cos(longitude),Math.sin(latitude)*Math.sin(longitude),Math.cos(latitude));}
      for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){const a=row*(columns+1)+column,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
      this.sphereBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.sphereBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
      this.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);this.indexCount=indices.length;
      this.lineBuffer=gl.createBuffer();this.maxPointSize=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];this.gl=gl;
    }catch(error){console.warn("Using simplified 3D rendering:",error.message);this.gl=null;}
  }
  use(bundle,camera,width,height){
    const gl=this.gl,u=bundle.uniforms,b=cameraBasis(camera),array=v=>[v.x,v.y,v.z];
    gl.useProgram(bundle.program);gl.uniform3fv(u.right,array(b.right));gl.uniform3fv(u.up,array(b.up));gl.uniform3fv(u.back,array(b.back));
    gl.uniform1f(u.distance,b.distance);gl.uniform1f(u.tan,FOV_TAN);gl.uniform1f(u.aspect,width/height);gl.uniform1f(u.near,Math.max(.001,b.distance*.0001));gl.uniform1f(u.far,Math.max(1000,b.distance*100));
    gl.enableVertexAttribArray(0);return u;
  }
  path(points,color,camera,mode=this.gl.LINE_STRIP,size=1,glow=0){
    if(!points.length)return;const gl=this.gl,u=this.line.uniforms;
    const vertices=new Float32Array(points.length*3);points.forEach((p,i)=>vertices.set([p.x-camera.x,p.y-camera.y,p.z-camera.z],i*3));
    gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STREAM_DRAW);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.uniform4fv(u.color,color);gl.uniform1f(u.size,size);gl.uniform1f(u.glow,glow);gl.drawArrays(mode,0,points.length);
  }
  draw(simulation,settings,width,height,project){
    const gl=this.gl;if(!gl)return false;
    const camera=settings.camera,basis=cameraBasis(camera),ratio=this.canvas.width/width;
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(16/255,21/255,23/255,1);gl.clearDepth(1);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    this.use(this.line,camera,width,height);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    const stars=[],radius=Math.max(80,basis.distance*12);
    for(let i=0;i<350;i++){const z=1-2*(i+.5)/350,angle=i*2.399963229728653,r=Math.sqrt(1-z*z);stars.push({x:camera.x+basis.back.x*basis.distance+r*Math.cos(angle)*radius,y:camera.y+basis.back.y*basis.distance+r*Math.sin(angle)*radius,z:camera.z+basis.back.z*basis.distance+z*radius});}
    this.path(stars,[.65,.74,.68,.35],camera,gl.POINTS,ratio);
    for(const guide of sceneGuides(simulation,settings))this.path(guide.points,guide.color,camera,gl.LINES);
    gl.depthMask(true);gl.disable(gl.BLEND);
    const u=this.use(this.sphere,camera,width,height),light=simulation.bodies.filter(b=>b.mass>=150).sort((a,b)=>b.mass-a.mass)[0];
    gl.uniform1f(u.hasLight,light?1:0);gl.uniform3fv(u.light,light?[light.x-camera.x,light.y-camera.y,light.z-camera.z]:[0,0,0]);gl.uniform3fv(u.eye,[basis.back.x*basis.distance,basis.back.y*basis.distance,basis.back.z*basis.distance]);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.sphereBuffer);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);
    for(const body of simulation.bodies){const p=project(body);if(!p.visible)continue;gl.uniform3f(u.center,body.x-camera.x,body.y-camera.y,body.z-camera.z);gl.uniform1f(u.radius,Math.max(body.radius,1.6/p.scale));gl.uniform3fv(u.color,rgb(body.color));gl.uniform1f(u.star,body.mass>=150?1:0);gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);}
    this.use(this.line,camera,width,height);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    if(settings.trails)for(const body of simulation.bodies)this.path([...body.trail,body],[...rgb(body.color),.58],camera);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    for(const body of simulation.bodies)if(body.mass>=150){const p=project(body);if(p.visible)this.path([body],[...rgb(body.color),.32],camera,gl.POINTS,Math.min(this.maxPointSize,512,Math.max(24,body.radius*p.scale*8)*ratio),1);}
    gl.depthMask(true);gl.disable(gl.BLEND);return true;
  }
}
