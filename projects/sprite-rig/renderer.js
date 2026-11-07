import {makeGrid,activeTriangles,skinMatrices,deformPoints} from './core.js';
export async function decodeImage(data,expected){
  const image=new Image();image.src=data;try{await image.decode();}catch{throw new Error('This image could not be decoded. Try PNG, JPEG, or WebP.');}
  if(!image.width||!image.height||image.width>2048||image.height>2048)throw new Error('Sprites can be up to 2048 × 2048 pixels.');
  if(expected&&(image.width!==expected.width||image.height!==expected.height))throw new Error('The embedded sprite dimensions do not match the project.');
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,image.width,image.height).data;
  if(!rgba.some((v,i)=>i%4===3&&v>0))throw new Error('This image is completely transparent. Choose a visible sprite.');return{image,rgba};
}
export class Renderer{
  constructor(canvas){
    this.canvas=canvas;const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:true});this.gl=gl;
    if(!gl){this.ctx=canvas.getContext('2d');this.kind='Canvas 2D';return;}
    this.kind='WebGL';const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    const vertex=shader(gl.VERTEX_SHADER,`attribute vec2 a_position;attribute vec4 a_bones;attribute vec4 a_weights;uniform mat3 u_bones[32];uniform vec2 u_image;uniform vec2 u_view;uniform vec3 u_camera;varying vec2 v_uv;void main(){vec3 p=vec3(a_position,1.0);vec3 q=(u_bones[int(a_bones.x)]*p)*a_weights.x+(u_bones[int(a_bones.y)]*p)*a_weights.y+(u_bones[int(a_bones.z)]*p)*a_weights.z+(u_bones[int(a_bones.w)]*p)*a_weights.w;vec2 screen=(q.xy-u_camera.xy)*u_camera.z+u_view*.5;gl_Position=vec4(screen.x/u_view.x*2.0-1.0,1.0-screen.y/u_view.y*2.0,0,1);v_uv=a_position/u_image;}`);
    const fragment=shader(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D u_texture;uniform float u_opacity;varying vec2 v_uv;void main(){gl_FragColor=texture2D(u_texture,v_uv)*u_opacity;}`);
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vertex);gl.deleteShader(fragment);this.program=program;gl.useProgram(program);
    this.uniforms=Object.fromEntries(['bones[0]','image','view','camera','opacity','texture'].map(n=>[n,gl.getUniformLocation(program,'u_'+n)]));this.buffers=[];
    for(const [name,size]of [['position',2],['bones',4],['weights',4]]){const buffer=gl.createBuffer();this.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const location=gl.getAttribLocation(program,'a_'+name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);}
    this.indexBuffer=gl.createBuffer();this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  }
  setProject(project,asset){
    this.project=project;this.asset=asset;this.grid=makeGrid(project.image.width,project.image.height,project.mesh.columns,project.mesh.rows);this.indices=activeTriangles(this.grid,asset.rgba);
    const gl=this.gl;if(!gl)return;gl.useProgram(this.program);const idMap=new Map(project.bones.map((b,i)=>[b.id,i])),ids=[],weights=[];
    for(const entries of project.mesh.weights){for(let i=0;i<4;i++){ids.push(idMap.get(entries[i]?.id)??0);weights.push(entries.length?(entries[i]?.w??0):(i===0?1:0));}}
    [this.grid.points.flatMap(p=>[p.x,p.y]),ids,weights].forEach((data,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[i]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);});gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(this.indices),gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);if(this.loadedImage!==asset.image){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,asset.image);this.loadedImage=asset.image;}
  }
  draw(pose,camera,opacity=1,pixelated=false){
    const {canvas,project,gl,grid}=this;if(!project)return;
    if(!gl){this.drawCPU(pose,camera,opacity,pixelated);return;}
    gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);const matrices=skinMatrices(project.bones,pose),uniform=new Float32Array(32*9);
    for(let i=0;i<32;i++){const m=matrices.get(project.bones[i]?.id)??[1,0,0,1,0,0];uniform.set([m[0],m[1],0,m[2],m[3],0,m[4],m[5],1],i*9);}
    gl.uniformMatrix3fv(this.uniforms['bones[0]'],false,uniform);gl.uniform2f(this.uniforms.image,grid.width,grid.height);gl.uniform2f(this.uniforms.view,canvas.width,canvas.height);gl.uniform3f(this.uniforms.camera,camera.x,camera.y,camera.zoom);gl.uniform1f(this.uniforms.opacity,opacity);gl.uniform1i(this.uniforms.texture,0);gl.bindTexture(gl.TEXTURE_2D,this.texture);const filter=pixelated?gl.NEAREST:gl.LINEAR;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.drawElements(gl.TRIANGLES,this.indices.length,gl.UNSIGNED_SHORT,0);
  }
  drawCPU(pose,camera,opacity,pixelated){
    const {ctx,canvas,grid,project,indices,asset}=this,points=deformPoints(grid,project.bones,pose,project.mesh.weights).map(p=>({x:(p.x-camera.x)*camera.zoom+canvas.width/2,y:(p.y-camera.y)*camera.zoom+canvas.height/2}));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=opacity;ctx.imageSmoothingEnabled=!pixelated;
    for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(j=>grid.points[j]),[p,q,r]=indices.slice(i,i+3).map(j=>points[j]),det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(!det)continue;const aa=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det,cc=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det,bb=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det,dd=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
      ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();ctx.setTransform(aa,bb,cc,dd,p.x-aa*a.x-cc*a.y,p.y-bb*a.x-dd*a.y);ctx.drawImage(asset.image,0,0);ctx.restore();
    }
  }
  dispose(){const gl=this.gl;if(!gl)return;for(const buffer of [...this.buffers,this.indexBuffer])gl.deleteBuffer(buffer);gl.deleteTexture(this.texture);gl.deleteProgram(this.program);}
}
export function animationBounds(project,grid,indices,poses,scale=1,limit=true){
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;const used=[...new Set(indices)];for(const pose of poses){const points=deformPoints(grid,project.bones,pose,project.mesh.weights);for(const i of used){const p=points[i];left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}}
  left=Math.floor(left)-2;top=Math.floor(top)-2;right=Math.ceil(right)+2;bottom=Math.ceil(bottom)+2;const width=Math.ceil((right-left)*scale),height=Math.ceil((bottom-top)*scale);if(!Number.isFinite(width)||width<1||height<1||(limit&&(width>4096||height>4096||width*height*poses.length>32000000)))throw new Error('This export is too large. Reduce frames or export scale (maximum 32 million animation pixels).');
  return{left,top,width,height,scale,camera:{x:left+width/(2*scale),y:top+height/(2*scale),zoom:scale}};
}
