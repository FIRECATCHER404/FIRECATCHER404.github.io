import * as THREE from './vendor/three.module.js';
import {ASSETS,TERRAIN} from './catalog.js';
import {tileAt,top,dimensions,support,localSize} from './model.js';
const geometries=new Map(),materials=new Map(),templates=new Map();
function material(color,emissive=false){const key=color+':'+emissive;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.88,metalness:0,flatShading:true,...(emissive?{emissive:color,emissiveIntensity:.28}:{})}));return materials.get(key);}
function boxGeometry(w,h,d,r=.025){const key=[w,h,d,r].join(':');if(!geometries.has(key)){r=Math.min(r,w*.15,h*.15,d*.15);const shape=new THREE.Shape(),x=w/2-r,y=h/2-r;shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:r,bevelThickness:r,curveSegments:1});g.translate(0,0,-(d-2*r)/2);g.computeVertexNormals();geometries.set(key,g);}return geometries.get(key);}
function roofGeometry(){const key='roof';if(!geometries.has(key)){const a=[[-.95,0,-.88],[.95,0,-.88],[0,.48,-.88],[-.95,0,.88],[.95,0,.88],[0,.48,.88]],faces=[[0,2,1],[3,4,5],[0,3,5,2],[1,2,5,4],[0,1,4,3]],data=[];for(const f of faces)for(let i=1;i<f.length-1;i++)for(const v of [f[0],f[i],f[i+1]])data.push(...a[v]);const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();geometries.set(key,g);}return geometries.get(key);}
export function assetTemplate(type,tint=null,size=null){
  const key=type+':'+tint+':'+JSON.stringify(size);if(templates.has(key))return templates.get(key);const a=ASSETS[type];if(!a)throw Error('Unknown prop.');const group=new THREE.Group(),color=tint??a.color,{w,d}=size??a;
  const add=(geometry,c,x,y,z,rx=0,ry=0,rz=0,glow=false)=>{const mesh=new THREE.Mesh(geometry,material(c,glow));mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const box=(w,h,d,c,x=0,y=h/2,z=0,r=.025)=>add(boxGeometry(w,h,d,r),c,x,y,z);
  const cylinder=(r,h,sides,c,x,y,z,rx=0,ry=0,rz=0)=>{const k='cyl:'+r+':'+h+':'+sides;if(!geometries.has(k))geometries.set(k,new THREE.CylinderGeometry(r,r,h,sides));return add(geometries.get(k),c,x,y,z,rx,ry,rz);};
  const shade=(c,v)=>'#'+new THREE.Color(c).offsetHSL(0,0,v).getHexString();
  if(type==='oak'){
    box(.18,.72,.18,'#a08462',0,.36,0);box(.84,.64,.8,color,-.01,1.03,0,.055);box(.65,.37,.62,shade(color,.035),-.05,1.48,-.025,.045);box(.46,.39,.46,shade(color,-.04),.2,.87,-.16,.04);
  }else if(type==='pine'){
    box(.16,.63,.16,'#9f8465',0,.315,0);for(const [r,h,y]of [[.62,.8,.85],[.49,.78,1.25],[.34,.7,1.63]]){const k='cone:'+r+':'+h;if(!geometries.has(k))geometries.set(k,new THREE.ConeGeometry(r,h,4));add(geometries.get(k),shade(color,y>1.3?.03:0),0,y,0,0,Math.PI/4,0);}
  }else if(type==='bush'){
    box(.82,.4,.7,color,0,.24,0,.07);box(.57,.3,.62,shade(color,.03),.12,.47,-.03,.05);
  }else if(type==='flowers'){
    for(const [x,z,h]of [[-.2,-.12,.27],[.19,-.04,.36],[0,.21,.29]]){box(.035,h,.035,'#7d9b68',x,h/2,z,.005);for(const [dx,dz]of [[-.09,0],[.09,0],[0,-.09],[0,.09]])box(.115,.055,.115,color,x+dx,h,z+dz,.016);box(.085,.07,.085,'#e9cb7d',x,h+.018,z,.012);}
  }else if(type==='rock'){
    const base=box(.72,.42,.64,color,0,.22,0,.09);base.rotation.y=.15;box(.4,.17,.38,shade(color,.06),-.1,.49,-.06,.045);
  }else if(type==='lily'){
    cylinder(.39,.035,8,color,0,.025,0);for(const [x,z]of [[-.08,0],[.08,0],[0,-.08],[0,.08]])box(.12,.09,.12,'#e6b5b4',x,.1,z,.025);box(.07,.1,.07,'#f0d494',0,.13,0,.015);
  }else if(['house','cabin','shop'].includes(type)){
    box(1.82,.12,1.72,'#c6bca4',0,.06,0,.035);box(1.66,.94,1.5,type==='cabin'?'#b99b76':'#eee4cd',0,.59,0,.035);
    if(type==='shop'){box(1.9,.17,1.8,'#d8d6c4',0,1.13,0,.04);for(let i=0;i<6;i++)box(.27,.1,.37,i%2?'#e9e0c7':color,-.675+i*.27,.91,.79,.015);}
    else{add(roofGeometry(),color,0,1.045,0);box(.21,.48,.24,'#c3aa8e',.48,1.35,-.38,.025);}
    box(.33,.59,.045,'#927c61',-.34,.37,.775,.018);box(.34,.34,.045,'#c1d5c9',.34,.66,.776,.018);box(.37,.035,.055,'#f1e9d7',.34,.66,.8,.005);box(.035,.36,.055,'#f1e9d7',.34,.66,.8,.005);box(.045,.33,.35,'#bfd2c6',.85,.66,.04,.018);
    if(type==='cabin')box(1.72,.07,.25,'#c5aa85',0,.155,.76,.015);
  }else if(type==='wall'){
    box(w-.08,.7,.22,color,0,.35,0,.025);box(w-.02,.11,.29,shade(color,.05),0,.73,0,.02);for(let i=1;i<w;i++)box(.025,.035,.23,shade(color,-.08),i-w/2,.36,0,.002);
  }else if(type==='fence'){
    for(let i=0;i<=w;i++)box(.11,.68,.12,color,-w/2+.12+i*(w-.24)/w,.34,0,.012);for(const y of [.23,.47])box(w-.18,.08,.07,color,0,y,.015,.01);
  }else if(type==='stairs'){
    for(let i=0;i<6;i++){const h=(i+1)/12;box(w-.14,h,.168,color,0,h/2,-.833+i/6,.012);}box(w-.14,.5,.99,color,0,.25,.5,.025);
  }else if(type==='bridge'||type==='dock'){
    box(w-.1,.12,d-.08,color,0,.1,0,.025);const count=d*3;for(let i=0;i<count;i++)box(w-.11,.025,(d-.12)/count-.015,shade(color,i%2?.025:-.015),0,.175,-d/2+.06+(i+.5)*(d-.12)/count,.006);
    for(const x of [-w/2+.09,w/2-.09]){for(let i=0;i<=d;i++)box(.075,type==='bridge'?.46:.28,.075,color,x,type==='bridge'?.28:.15,-d/2+.18+i*(d-.36)/d,.01);if(type==='bridge')box(.07,.07,d-.25,color,x,.49,0,.01);}
  }else if(type==='bench'){
    box(w-.2,.1,.56,color,0,.4,0,.025);box(w-.2,.34,.09,color,0,.63,-.23,.025);for(let i=0;i<=Math.max(1,w-1);i++)for(const z of [-.18,.18])box(.09,.36,.09,'#667c73',-w/2+.2+i*(w-.4)/Math.max(1,w-1),.18,z,.01);
  }else if(type==='lamp'){
    box(.25,.065,.25,color,0,.0325,0,.02);box(.09,1.26,.09,color,0,.65,0,.012);add(boxGeometry(.23,.26,.23,.02),'#ffe5ab',0,1.36,0,0,0,0,true);box(.31,.065,.31,color,0,1.52,0,.02);
  }else if(type==='crate'){
    box(.6,.56,.6,color,0,.28,0,.035);for(const y of [.11,.44])box(.615,.055,.615,shade(color,-.07),0,y,0,.01);box(.07,.56,.62,shade(color,.04),0,.28,0,.01);
  }else if(type==='car'){
    box(.77,.27,1.55,color,0,.32,0,.06);box(.66,.33,.69,color,0,.61,-.08,.06);box(.52,.21,.035,'#a8c7c7',0,.63,.279,.018);for(const x of [-.337,.337])box(.025,.19,.44,'#a8c7c7',x,.63,-.08,.01);
    for(const x of [-.38,.38])for(const z of [-.49,.49]){cylinder(.15,.08,12,'#52615b',x,.19,z,0,0,Math.PI/2);cylinder(.065,.09,12,'#c8cbbb',x,.19,z,0,0,Math.PI/2);}
    for(const x of [-.23,.23])box(.13,.07,.045,'#f4e6bf',x,.35,.795,.012);box(.65,.075,.055,'#b0b9aa',0,.22,.8,.015);
  }else if(type==='sign'){
    box(.09,.84,.09,'#a58b6b',0,.42,0,.01);box(.66,.32,.08,color,0,.88,0,.025);box(.28,.035,.015,'#d7dfcb',0,.88,.049,.005);
  }else if(type==='duck'){
    box(.35,.27,.5,color,0,.19,0,.065);box(.23,.24,.24,shade(color,.04),0,.4,.16,.04);box(.18,.07,.15,'#d4a360',0,.34,.31,.02);for(const x of [-.115,.115])box(.025,.035,.025,'#485c51',x,.44,.25,.004);
  }else if(['birch','cherry','cypress'].includes(type)){
    box(.14,1.2,.14,type==='birch'?'#e8e0cc':'#a68b6b',0,.6,0,.015);if(type==='birch')for(const y of [.25,.53,.8])box(.145,.035,.145,'#958c79',0,y,0,.003);
    if(type==='cypress'){box(.46,1.26,.48,color,0,1.22,0,.09);box(.32,.46,.34,shade(color,.025),0,1.94,0,.06);}else{box(.87,.64,.85,color,0,1.4,0,.09);box(.61,.4,.66,shade(color,.04),-.07,1.85,-.03,.06);box(.46,.39,.49,shade(color,-.03),.2,1.17,.12,.05);}
  }else if(type==='palm'){
    box(.14,1.65,.16,'#b69a71',0,.825,0,.025);for(let i=0;i<4;i++){const leaf=box(.85,.09,.23,color,0,1.7,0,.025);leaf.rotation.y=i*Math.PI/4;leaf.rotation.z=i%2?.12:-.12;}box(.18,.16,.18,'#a99366',0,1.58,0,.03);
  }else if(type==='hedge'){
    box(w-.1,.65,.63,color,0,.39,0,.065);for(let i=0;i<w;i++)box(.76,.24,.56,shade(color,i%2?.025:0),i-w/2+.5,.78,0,.05);
  }else if(type==='reeds'||type==='tallgrass'){
    for(let i=0;i<7;i++){const x=((i*37)%11)/17-.3,z=((i*23)%13)/21-.28,h=.27+(i%3)*.13;const stem=box(.055,h,.075,color,x,h/2,z,.012);stem.rotation.z=(i%3-1)*.11;if(type==='reeds')box(.065,.17,.07,'#a3916a',x,h+.04,z,.012);}
  }else if(type==='mushrooms'){
    for(const [x,z,h,r]of [[-.18,-.1,.2,.16],[.17,.14,.13,.12],[.18,-.2,.11,.1]]){box(.07,h,.07,'#eadbc0',x,h/2,z,.01);cylinder(r,.09,8,color,x,h,z);box(.04,.02,.04,'#efdfc6',x+.04,h+.05,z,.005);}
  }else if(type==='cactus'){
    box(.23,.93,.24,color,0,.465,0,.045);box(.18,.13,.15,color,-.19,.48,0,.02);box(.13,.29,.15,color,-.25,.56,0,.03);box(.18,.13,.15,color,.2,.64,0,.02);box(.13,.31,.15,color,.26,.73,0,.03);box(.12,.08,.12,'#d7a0a3',0,.98,0,.018);
  }else if(type==='log'){
    box(.78,.29,.32,color,0,.19,0,.06);box(.04,.2,.22,'#dfc8a0',-.4,.19,0,.025);box(.04,.2,.22,'#dfc8a0',.4,.19,0,.025);box(.17,.18,.12,color,.13,.35,.03,.025);
  }else if(type==='stump'){
    cylinder(.26,.35,8,color,0,.175,0);cylinder(.23,.035,8,'#e1caa2',0,.367,0);cylinder(.12,.038,8,shade(color,.09),0,.37,0);
  }else if(type==='tent'){
    box(1.78,.07,1.6,'#bdab89',0,.035,0);const roof=add(roofGeometry(),color,0,.07,0);roof.scale.y=2.6;box(.42,.55,.03,'#746f58',0,.34,.893,.025);for(const x of [-.87,.87])box(.05,.15,.05,'#9c8b6a',x,.075,.82,.006);
  }else if(type==='arch'){
    for(const x of [-.75,.75])box(.14,1.55,.16,color,x,.775,0,.02);box(1.92,.15,.23,color,0,1.55,0,.025);for(const x of [-.6,0,.6])box(.1,.13,.52,color,x,1.67,0,.015);for(const x of [-.76,.76])box(.26,.2,.3,'#c5ac8d',x,.1,0,.03);
  }else if(type==='flowerpot'){
    box(.42,.38,.42,color,0,.19,0,.045);box(.46,.07,.46,shade(color,.03),0,.38,0,.025);box(.34,.02,.34,'#8d7e63',0,.42,0,.01);for(const x of [-.1,.1]){box(.035,.25,.035,'#92a678',x,.54,0,.004);box(.19,.09,.19,'#e6be94',x,.68,0,.025);}
  }else if(type==='mailbox'){
    box(.09,.7,.09,'#a8977b',0,.35,0,.01);box(.38,.28,.49,color,0,.82,0,.04);box(.26,.03,.02,'#6d7f7d',0,.85,.254,.005);box(.04,.25,.04,'#ca8c75',.23,.91,0,.006);
  }else if(type==='bin'){
    box(.4,.62,.4,color,0,.31,0,.035);box(.46,.08,.46,shade(color,-.03),0,.64,0,.025);box(.22,.025,.25,'#5f746a',0,.69,0,.012);
  }else if(type==='hydrant'){
    cylinder(.14,.5,8,color,0,.27,0);cylinder(.18,.08,8,shade(color,.025),0,.54,0);for(const x of [-.2,.2])box(.16,.13,.13,color,x,.35,0,.025);box(.35,.06,.35,'#b1b5a0',0,.03,0,.015);
  }else if(type==='bollard'){
    cylinder(.11,.57,8,color,0,.285,0);cylinder(.115,.07,8,'#e9d7a7',0,.43,0);cylinder(.17,.06,8,color,0,.03,0);
  }else if(type==='picnic'){
    box(1.7,.1,.73,color,0,.75,0,.025);for(const z of [-.65,.65])box(1.7,.09,.3,color,0,.42,z,.025);for(const x of [-.55,.55]){box(.13,.7,1.32,'#8d937c',x,.35,0,.018);}
  }else if(type==='well'){
    for(const z of [-.55,.55])box(1.3,.53,.2,color,0,.265,z,.035);for(const x of [-.55,.55])box(.2,.53,.95,color,x,.265,0,.035);box(.9,.025,.9,'#74b8bc',0,.18,0,.01);for(const x of [-.75,.75])box(.12,1.4,.12,'#b59c76',x,.7,0,.015);const roof=add(roofGeometry(),'#bf9f7b',0,1.4,0);roof.scale.set(.85,.7,.65);
  }else if(type==='fountain'){
    cylinder(.86,.17,12,color,0,.085,0);cylinder(.74,.025,12,'#8ac1c5',0,.183,0);cylinder(.17,.52,8,color,0,.42,0);cylinder(.39,.1,10,color,0,.72,0);cylinder(.3,.02,10,'#a6d3d4',0,.781,0);cylinder(.045,.35,6,'#c4e4df',0,.95,0);
  }else if(type==='boat'){
    box(.68,.11,1.63,'#947f65',0,.06,0,.055);for(const x of [-.32,.32])box(.085,.25,1.56,color,x,.17,0,.035);for(const z of [-.75,.75])box(.66,.23,.1,color,0,.16,z,.03);for(const z of [-.4,.3])box(.61,.065,.18,'#dbc09a',0,.25,z,.012);const oar=box(.07,.045,1.55,'#ac956f',0,.32,0,.008);oar.rotation.y=.34;
  }else if(type==='umbrella'){
    box(.055,1.13,.055,'#c1b497',0,.565,0,.009);for(let i=0;i<4;i++){const leaf=box(.84,.09,.3,i%2?'#f0dfba':color,0,1.16,0,.035);leaf.rotation.y=i*Math.PI/4;}box(.22,.06,.22,'#d2c19e',0,.03,0,.025);
  }
  group.updateMatrixWorld(true);templates.set(key,group);return group;
}
export function entityMatrix(p,e){const d=dimensions(e.type,e.rotation,e.size),s=support(p,e);return new THREE.Matrix4().compose(new THREE.Vector3(e.x+d.w/2-p.width/2,s.ok?s.y:0,e.z+d.d/2-p.depth/2),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),e.rotation*Math.PI/2),new THREE.Vector3(1,1,1));}
export function buildTerrain(p){
  const positions=[],colors=[],faceCells=[],color=new THREE.Color();
  const quad=(pts,hex,x,z,brightness=1)=>{color.set(hex).multiplyScalar(brightness);for(const i of [0,1,2,0,2,3]){positions.push(...pts[i]);colors.push(color.r,color.g,color.b);}faceCells.push({x,z},{x,z});};
  for(let z=0;z<p.depth;z++)for(let x=0;x<p.width;x++){
    const t=tileAt(p,x,z);if(!t)continue;const a=TERRAIN[t.material],y=top(t),x0=x-p.width/2,x1=x0+1,z0=z-p.depth/2,z1=z0+1;
    const surface=t.tint??a.color,edge=t.edge??a.side,detail=t.detail??a.detail??'plain';quad([[x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0]],surface,x,z,1+((x*17+z*31)%7-3)*.004);
    for(const [dx,dz,points]of [[-1,0,[[x0,z1],[x0,z0]]],[1,0,[[x1,z0],[x1,z1]]],[0,-1,[[x0,z0],[x1,z0]]],[0,1,[[x1,z1],[x0,z1]]]]){
      const n=tileAt(p,x+dx,z+dz),bottom=n?top(n):-.42;if(bottom>=y-.0001)continue;const [b,c]=points,cut=Math.max(bottom,y-.12);
      if(cut>bottom)quad([[c[0],bottom,c[1]],[b[0],bottom,b[1]],[b[0],cut,b[1]],[c[0],cut,c[1]]],edge,x,z);
      quad([[c[0],cut,c[1]],[b[0],cut,b[1]],[b[0],y,b[1]],[c[0],y,c[1]]] ,surface,x,z,.9);
    }
    if(t.material==='road'){
      const vertical=tileAt(p,x,z-1)?.material==='road'||tileAt(p,x,z+1)?.material==='road',xx=x0+.5,zz=z0+.5,w=vertical?.035:.21,d=vertical?.21:.035;
      quad([[xx-w,y+.002,zz-d],[xx-w,y+.002,zz+d],[xx+w,y+.002,zz+d],[xx+w,y+.002,zz-d]],'#d2d5bc',x,z);
    }
    const mark=(cx,cz,w,d,brightness)=>quad([[cx-w,y+.004,cz-d],[cx-w,y+.004,cz+d],[cx+w,y+.004,cz+d],[cx+w,y+.004,cz-d]],surface,x,z,brightness);
    if(detail==='grain')for(let i=0;i<5;i++)mark(x0+.13+((i*23+x*7+z*13)%71)/100,z0+.13+((i*37+x*11+z*3)%71)/100,.025+(i%2)*.014,.022, i%2?.9:1.1);
    if(detail==='pavers'){for(let j=0;j<3;j++){mark(x0+.5,z0+(j+1)/4,.48,.009,.88);for(let i=0;i<2;i++)mark(x0+.25+i*.5+(j%2?.12:0),z0+.125+j*.25,.008,.117,.88);}}
    if(detail==='planks')for(let j=1;j<5;j++)mark(x0+.5,z0+j/5,.48,.009,.86);
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();return{geometry,faceCells};
}
export function buildProps(p,omit=null){
  const root=new THREE.Group(),groups=new Map();
  for(const e of p.props){if(e.id===omit)continue;const template=assetTemplate(e.type,e.tint,e.size),transform=entityMatrix(p,e);for(const part of template.children){const key=part.geometry.uuid+':'+part.material.uuid;if(!groups.has(key))groups.set(key,{geometry:part.geometry,material:part.material,matrices:[],ids:[]});const g=groups.get(key);g.matrices.push(new THREE.Matrix4().multiplyMatrices(transform,part.matrixWorld));g.ids.push(e.id);}}
  for(const g of groups.values()){const mesh=new THREE.InstancedMesh(g.geometry,g.material,g.matrices.length);g.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.ids=g.ids;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);}root.updateMatrixWorld(true);return root;
}
