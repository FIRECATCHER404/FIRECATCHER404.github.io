import * as C from './core.js?v=4';

// Render independent, hard-bound source pixels into a native-resolution image.
// The 3D editor displays that image on the same fixed XY plane as smooth sprites.
export class PixelRaster{
  constructor(){
    this.canvas=document.createElement('canvas');this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false});
    const gl=this.gl;if(!gl){this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});this.kind='CPU pixels';return;}this.kind='GPU pixels';
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    const vertex=shader(gl.VERTEX_SHADER,`attribute vec2 a_position;attribute float a_owner;attribute vec4 a_color;uniform vec4 u_rows[99];uniform vec4 u_projection,u_crop;varying vec4 v_color;void main(){int i=int(a_owner)*3;vec4 p=vec4(a_position,0.0,1.0);vec3 world=vec3(dot(u_rows[i],p),dot(u_rows[i+1],p),dot(u_rows[i+2],p));float depth=max(u_projection.w,u_projection.z+world.z);vec2 xy=u_projection.xy+(world.xy-u_projection.xy)*u_projection.z/depth;float z=world.z/(abs(world.z)+u_projection.z);gl_Position=vec4((xy.x-u_crop.x)/u_crop.z*2.0-1.0,1.0-(xy.y-u_crop.y)/u_crop.w*2.0,z,1.0);v_color=vec4(a_color.rgb*a_color.a,a_color.a);}`);
    const fragment=shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec4 v_color;void main(){gl_FragColor=v_color;}`);
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vertex);gl.deleteShader(fragment);gl.useProgram(program);this.program=program;
    this.buffers=[];for(const [name,size,type,normalized]of [['position',2,gl.FLOAT,false],['owner',1,gl.FLOAT,false],['color',4,gl.UNSIGNED_BYTE,true]]){const buffer=gl.createBuffer();this.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const location=gl.getAttribLocation(program,'a_'+name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,type,normalized,0,0);}
    this.uniforms=Object.fromEntries(['rows[0]','projection','crop'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));gl.disable(gl.DITHER);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  }
  setProject(project,asset){
    this.project=project;this.asset=asset;C.validatePixelImage(project,asset.rgba);
    if(this.imageData!==project.image.data){
      this.imageData=project.image.data;this.cells=C.visiblePixelIndices(asset.rgba).map(index=>({index,x:index%project.image.width,y:Math.floor(index/project.image.width)}));this.ownerData=new Float32Array(this.cells.length*6);
      if(this.gl){const positions=new Float32Array(this.cells.length*12),colors=new Uint8Array(this.cells.length*24);let v=0;
        for(const cell of this.cells)for(const [dx,dy]of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){positions[v*2]=cell.x+dx;positions[v*2+1]=cell.y+dy;colors.set(asset.rgba.subarray(cell.index*4,cell.index*4+4),v*4);v++;}
        const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[0]);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[2]);gl.bufferData(gl.ARRAY_BUFFER,colors,gl.STATIC_DRAW);
      }
    }
    this.groupGrid=C.pixelBoundsGrid(project);this.idMap=new Map(project.bones.map((bone,index)=>[bone.id,index+1]));for(let i=0;i<this.cells.length;i++){const owner=this.idMap.get(project.pixelBinding.owners[this.cells[i].index])??0;this.ownerData.fill(owner,i*6,i*6+6);}
    if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffers[1]);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.ownerData,this.gl.DYNAMIC_DRAW);}
  }
  draw(pose){
    const {project,canvas,gl}=this,bounds=C.pixelRasterBounds(project,pose,this.groupGrid);this.bounds=bounds;if(canvas.width!==bounds.width)canvas.width=bounds.width;if(canvas.height!==bounds.height)canvas.height=bounds.height;
    const rows=C.skinRows(project.bones,pose),projection=C.spriteProjection(project.image.width,project.image.height);if(!gl){this.drawCPU(rows,projection,bounds);return bounds;}
    gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const uniforms=new Float32Array(33*12);uniforms.set(rows.get(0));for(const bone of project.bones)uniforms.set(rows.get(bone.id),this.idMap.get(bone.id)*12);gl.uniform4fv(this.uniforms['rows[0]'],uniforms);gl.uniform4f(this.uniforms.projection,projection.centerX,projection.centerY,projection.distance,projection.near);gl.uniform4f(this.uniforms.crop,bounds.left,bounds.top,bounds.width,bounds.height);gl.drawArrays(gl.TRIANGLES,0,this.cells.length*6);return bounds;
  }
  drawCPU(rows,projection,bounds){
    const {canvas,ctx,asset,project}=this,image=ctx.createImageData(canvas.width,canvas.height),depths=new Float64Array(canvas.width*canvas.height);depths.fill(Infinity);let work=0;
    const inside=(p,a,b,c)=>{const side=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x),x=side(a,b,p),y=side(b,c,p),z=side(c,a,p);return(x>=-1e-8&&y>=-1e-8&&z>=-1e-8)||(x<=1e-8&&y<=1e-8&&z<=1e-8);};
    for(const cell of this.cells){const row=rows.get(project.pixelBinding.owners[cell.index])??rows.get(0),q=[[0,0],[1,0],[1,1],[0,1]].map(([dx,dy])=>C.pixelCorner(row,cell.x+dx,cell.y+dy,projection)),left=Math.max(bounds.left,Math.floor(Math.min(...q.map(p=>p.x)))),right=Math.min(bounds.left+bounds.width,Math.ceil(Math.max(...q.map(p=>p.x)))),top=Math.max(bounds.top,Math.floor(Math.min(...q.map(p=>p.y)))),bottom=Math.min(bounds.top+bounds.height,Math.ceil(Math.max(...q.map(p=>p.y))));work+=(right-left)*(bottom-top);if(work>32000000)throw new Error('This pixel pose is too dense for the CPU preview. Reduce its scale or use a browser with WebGL.');
      const z=q.reduce((n,p)=>n+p.skinDepth,0)/4,source=cell.index*4,sa=asset.rgba[source+3]/255;
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const p={x:x+.5,y:y+.5};if(!inside(p,q[0],q[1],q[2])&&!inside(p,q[0],q[2],q[3]))continue;const index=(y-bounds.top)*bounds.width+x-bounds.left;if(z>=depths[index])continue;depths[index]=z;const target=index*4,da=image.data[target+3]/255,alpha=sa+da*(1-sa);for(let c=0;c<3;c++)image.data[target+c]=(asset.rgba[source+c]*sa+image.data[target+c]*da*(1-sa))/(alpha||1);image.data[target+3]=Math.round(alpha*255);}
    }
    ctx.putImageData(image,0,0);
  }
  dispose(){if(!this.gl)return;for(const buffer of this.buffers)this.gl.deleteBuffer(buffer);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
