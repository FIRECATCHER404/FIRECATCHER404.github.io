import { PALETTES, planarDetail } from "./core.js?v=3";
import { isSolid, solidBasis, solidDetail, solidFragmentSource } from "./solid.js?v=2";

const vertexSource = "attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}";
const fragmentSource = `precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_span;
uniform int u_mode;
uniform int u_iterations;
uniform vec2 u_julia;
uniform vec3 u_colors[5];
vec3 color(float value){
  float t=fract(value*0.025)*4.0;
  if(t<1.0)return mix(u_colors[0],u_colors[1],t);
  if(t<2.0)return mix(u_colors[1],u_colors[2],t-1.0);
  if(t<3.0)return mix(u_colors[2],u_colors[3],t-2.0);
  return mix(u_colors[3],u_colors[4],t-3.0);
}
void main(){
  vec2 p=u_center+(gl_FragCoord.xy-u_resolution*0.5)*u_span/u_resolution.y;
  if(u_mode==4){
    vec2 point=p;
    bool inside=min(point.x,point.y)>=0.0&&max(point.x,point.y)<=1.0;
    for(int i=0;i<48;i++){
      if(i>=u_iterations||!inside)break;
      point*=3.0; vec2 cell=floor(point);
      if(cell.x==1.0&&cell.y==1.0){inside=false;break;}
      point-=cell;
    }
    gl_FragColor=vec4(inside?mix(u_colors[2],u_colors[4],clamp(p.x,0.0,1.0)):vec3(16.0,21.0,23.0)/255.0,1.0);return;
  }
  if(u_mode==3){
    float c=p.y/0.866025403784,b=p.x-c*0.5,a=1.0-b-c;
    bool inside=min(a,min(b,c))>=0.0;
    for(int i=0;i<48;i++){
      if(i>=u_iterations||!inside)break;
      if(max(a,max(b,c))<0.5){inside=false;break;}
      if(a>=b&&a>=c){a=a*2.0-1.0;b*=2.0;c*=2.0;}
      else if(b>=c){b=b*2.0-1.0;a*=2.0;c*=2.0;}
      else{c=c*2.0-1.0;a*=2.0;b*=2.0;}
    }
    gl_FragColor=vec4(inside?mix(u_colors[2],u_colors[4],clamp(p.x,0.0,1.0)):vec3(16.0,21.0,23.0)/255.0,1.0);return;
  }
  vec2 z=u_mode==1?p:vec2(0.0);
  vec2 c=u_mode==1?u_julia:p;
  float value=-1.0;
  for(int i=0;i<8192;i++){
    if(i>=u_iterations)break;
    if(u_mode==2)z=abs(z);
    z=vec2(z.x*z.x-z.y*z.y,2.0*z.x*z.y)+c;
    float r=dot(z,z);
    if(r>4.0){value=max(0.0,float(i)+2.0-log(log(sqrt(r)))/log(2.0));break;}
  }
  gl_FragColor=vec4(value<0.0?vec3(8.0,12.0,14.0)/255.0:color(value),1.0);
}`;

export class FractalRenderer {
  constructor(viewport, onStatus) {
    this.viewport = viewport;
    this.onStatus = onStatus;
    this.gpuCanvas = viewport.querySelector("#gpu-canvas");
    this.cpuCanvas = viewport.querySelector("#cpu-canvas");
    this.curveCanvas = viewport.querySelector("#curve-canvas");
    this.worker = new Worker(new URL("./render-worker.js?v=3", import.meta.url), { type: "module" });
    this.worker.onmessage = event => this.message(event.data);
    this.worker.onerror = () => this.onStatus({ busy: false, error: "The renderer could not start. Reload the page and try again." });
    this.id = 0;
    this.active = null;
    this.lastCamera = null;
    this.stats = {};
    this.initGPU();
    this.gpuCanvas.addEventListener("webglcontextlost", event => { event.preventDefault(); this.gl = null; this.onInvalidate?.(); });
    this.gpuCanvas.addEventListener("webglcontextrestored", () => { this.initGPU(); this.onInvalidate?.(); });
  }

  initGPU() {
    try {
      const gl = this.gpuCanvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false });
      if (!gl || gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision < 23) { this.gl = null; return; }
      const compile = (type, source) => {
        const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      };
      const makeProgram = (source, names) => {
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source)); gl.bindAttribLocation(program, 0, "a_position"); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        return { program, uniforms: Object.fromEntries(names.map(key => [key, gl.getUniformLocation(program, "u_" + key)])) };
      };
      const common = ["resolution", "center", "span", "mode", "colors[0]"];
      this.flatProgram = makeProgram(fragmentSource, [...common, "iterations", "julia"]);
      this.solidProgram = makeProgram(solidFragmentSource, [...common, "levels", "right", "up", "back"]);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.gl = gl;
    } catch (error) { console.warn("Using the CPU fractal renderer:", error.message); this.gl = null; }
  }

  preview(camera) {
    if (!this.active || !this.lastCamera || this.lastMode !== this.request?.state.mode || isSolid(this.lastMode)) return;
    const height = this.viewport.clientHeight;
    const scale = this.lastCamera.span / camera.span;
    const x = (this.lastCamera.x - camera.x) * height / camera.span;
    const y = (camera.y - this.lastCamera.y) * height / camera.span;
    this.active.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  }

  cancel() { this.worker.postMessage({ type: "cancel", id: ++this.id }); }

  show(canvas, request, kind, stats = {}) {
    for (const item of [this.gpuCanvas, this.cpuCanvas, this.curveCanvas]) { item.hidden = item !== canvas; item.style.transform = ""; }
    this.active = canvas; this.lastCamera = { ...request.state.camera }; this.lastMode = request.state.mode;
    this.kind = kind; this.stats = stats;
    this.onStatus({ busy: false, kind, stats });
  }

  render(state) {
    const id = ++this.id;
    this.worker.postMessage({ type: "cancel", id });
    const width = Math.max(1, this.viewport.clientWidth), height = Math.max(1, this.viewport.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const request = { id, state: structuredClone(state), width, height, pixelRatio: ratio };
    this.request = request;
    this.preview(state.camera);
    this.onStatus({ busy: true });
    if (state.mode !== "script" && this.gl && state.camera.span >= 0.002) {
      const canvas = this.gpuCanvas, gl = this.gl, bundle = isSolid(state.mode) ? this.solidProgram : this.flatProgram, u = bundle.uniforms;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(bundle.program);
      gl.uniform2f(u.resolution, canvas.width, canvas.height); gl.uniform2f(u.center, state.camera.x, state.camera.y); gl.uniform1f(u.span, state.camera.span);
      let detail;
      if (isSolid(state.mode)) {
        detail = solidDetail(state.mode, state.camera.span, canvas.height);
        const basis = solidBasis(state.orbit);
        gl.uniform1i(u.mode, state.mode === "menger" ? 0 : 1); gl.uniform1i(u.levels, detail.levels);
        gl.uniform3fv(u.right, basis.right); gl.uniform3fv(u.up, basis.up); gl.uniform3fv(u.back, basis.back);
      } else {
        const levels = planarDetail(state.mode, state.camera.span, canvas.height), planar = ["gasket", "carpet"].includes(state.mode);
        gl.uniform1i(u.mode, state.mode === "julia" ? 1 : state.mode === "ship" ? 2 : state.mode === "gasket" ? 3 : state.mode === "carpet" ? 4 : 0);
        gl.uniform1i(u.iterations, planar ? levels : state.iterations);
        gl.uniform2f(u.julia, state.juliaX, state.juliaY);
        detail = { ...(planar ? { levels } : { iterations: state.iterations }) };
      }
      gl.uniform3fv(u["colors[0]"], new Float32Array(PALETTES[state.palette].colors.flat().map(value => value / 255)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.show(canvas, request, "webgl", { ...detail, width: canvas.width, height: canvas.height, pixelRatio: ratio });
      return;
    }
    if (state.mode === "script") this.worker.postMessage({ ...request, width: Math.round(width * ratio), height: Math.round(height * ratio), type: "render" });
    else {
      request.renderWidth = Math.max(1, Math.round(width * ratio)); request.renderHeight = Math.max(1, Math.round(height * ratio));
      this.buffer = document.createElement("canvas"); this.buffer.width = request.renderWidth; this.buffer.height = request.renderHeight;
      this.bufferContext = this.buffer.getContext("2d");
      this.worker.postMessage({ ...request, width: request.renderWidth, height: request.renderHeight, type: "render" });
    }
  }

  message(message) {
    if (message.id !== this.id) return;
    const request = this.request;
    if (message.type === "error") { this.onStatus({ busy: false, error: message.message }); return; }
    if (message.type === "progress") { this.onStatus({ busy: true, segments: message.segments }); return; }
    if (message.type === "tile") {
      this.bufferContext.putImageData(new ImageData(new Uint8ClampedArray(message.buffer), message.width, message.rows), 0, message.top);
      this.onStatus({ busy: true, progress: message.progress }); return;
    }
    if (message.type === "complete") {
      const canvas = this.cpuCanvas; canvas.width = this.buffer.width; canvas.height = this.buffer.height;
      canvas.getContext("2d").drawImage(this.buffer, 0, 0);
      this.show(canvas, request, "cpu", message.stats); return;
    }
    if (message.type === "curve-start") {
      this.buffer = document.createElement("canvas"); this.buffer.width = message.width; this.buffer.height = message.height;
      const context = this.bufferContext = this.buffer.getContext("2d");
      context.fillStyle = "#101517"; context.fillRect(0, 0, message.width, message.height);
      const gradient = context.createLinearGradient(0, message.height, message.width, 0);
      const colors = PALETTES[request.state.palette].colors.slice(1);
      colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), `rgb(${color.join(",")})`));
      context.strokeStyle = gradient; context.fillStyle = gradient; context.lineWidth = request.state.stroke * request.pixelRatio; context.lineCap = "round";
      return;
    }
    if (message.type === "curve-chunk") {
      const context = this.bufferContext;
      const segments = new Float32Array(message.buffer);
      context.beginPath();
      for (let i = 0; i < segments.length; i += 4) {
        if (Math.hypot(segments[i + 2] - segments[i], segments[i + 3] - segments[i + 1]) < 0.01) context.rect(segments[i] - 0.25, segments[i + 1] - 0.25, 0.5, 0.5);
        else { context.moveTo(segments[i], segments[i + 1]); context.lineTo(segments[i + 2], segments[i + 3]); }
      }
      context.stroke();
      return;
    }
    if (message.type === "curve-complete") {
      const canvas = this.curveCanvas; canvas.width = this.buffer.width; canvas.height = this.buffer.height;
      canvas.getContext("2d").drawImage(this.buffer, 0, 0);
      this.show(canvas, request, "curve", message.stats);
    }
  }

  download() {
    if (!this.active) return;
    const link = document.createElement("a"); link.download = `fractal-${this.lastMode}.png`; link.href = this.active.toDataURL("image/png"); link.click();
  }
}
