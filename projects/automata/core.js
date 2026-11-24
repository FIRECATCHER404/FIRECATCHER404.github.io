export class Budget extends Error{}
export const power=n=>1n<<BigInt(n);
const children=n=>[n.a,n.b,n.c,n.d];
export class Factory{
 constructor(){this.serial=2;this.cache=new Map();this.zero={id:0,level:0,pop:0n,minX:0n,minY:0n,maxX:-1n,maxY:-1n,future:new Map()};this.one={id:1,level:0,pop:1n,minX:0n,minY:0n,maxX:0n,maxY:0n,future:new Map()};this.zeros=[this.zero];this.calls=0;this.hits=0;this.deadline=Infinity;}
 empty(level){while(this.zeros.length<=level){const z=this.zeros.at(-1);this.zeros.push(this.join(z,z,z,z));}return this.zeros[level];}
 join(a,b,c,d){
  if(a.level!==b.level||a.level!==c.level||a.level!==d.level)throw Error('Unequal quadtree children.');
  const key=[a.id,b.id,c.id,d.id].join(','),old=this.cache.get(key);if(old)return old;
  if(this.cache.size>1500000)throw Error('The pattern has exceeded this browser’s working-memory budget. Save the map or use a smaller pattern.');
  const half=power(a.level),entries=[[a,0n,0n],[b,half,0n],[c,0n,half],[d,half,half]].filter(([n])=>n.pop),mins=entries.map(([n,x,y])=>[n.minX+x,n.minY+y,n.maxX+x,n.maxY+y]);
  const min=(i)=>mins.reduce((v,m)=>m[i]<v?m[i]:v,mins[0]?.[i]??0n),max=(i)=>mins.reduce((v,m)=>m[i]>v?m[i]:v,mins[0]?.[i]??-1n);
  const node={id:this.serial++,level:a.level+1,a,b,c,d,pop:a.pop+b.pop+c.pop+d.pop,minX:min(0),minY:min(1),maxX:max(2),maxY:max(3),future:new Map()};this.cache.set(key,node);return node;
 }
 center(n){return this.join(n.a.d,n.b.c,n.c.b,n.d.a);}
 future(n,exponent){
  if(!n.pop)return this.empty(n.level-1);const cached=n.future.get(exponent);if(cached){this.hits++;return cached;}
  if((++this.calls&1023)===0&&performance.now()>this.deadline)throw new Budget();
  let result;
  if(n.level===2){
   const cell=(x,y)=>{const q=children(n)[(y>>1)*2+(x>>1)];return children(q)[(y&1)*2+(x&1)].pop?1:0;},next=[];
   for(let y=1;y<=2;y++)for(let x=1;x<=2;x++){let count=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)count+=cell(x+dx,y+dy);next.push(count===3||count===2&&cell(x,y)?this.one:this.zero);}result=this.join(...next);
  }else{
   const{a,b,c,d}=n,overlap=[a,this.join(a.b,b.a,a.d,b.c),b,this.join(a.c,a.d,c.a,c.b),this.join(a.d,b.c,c.b,d.a),this.join(b.c,b.d,d.a,d.b),c,this.join(c.b,d.a,c.d,d.c),d],maximal=exponent===n.level-2,p=maximal?exponent-1:exponent,first=overlap.map(q=>this.future(q,p)),parts=[];
   for(const i of[0,1,3,4]){const q=this.join(first[i],first[i+1],first[i+3],first[i+4]);parts.push(maximal?this.future(q,p):this.center(q));}result=this.join(...parts);
  }
  n.future.set(exponent,result);return result;
 }
 collect(root){
  const seen=new Set(),stack=[root,...this.zeros],keep=new Map();while(stack.length){const n=stack.pop();if(seen.has(n.id))continue;seen.add(n.id);n.future.clear();if(n.level){keep.set(children(n).map(c=>c.id).join(','),n);stack.push(...children(n));}}this.cache=keep;
 }
}
export class World{
 constructor(){this.factory=new Factory();this.root=this.factory.empty(4);this.x=-8n;this.y=-8n;this.generation=0n;}
 expand(){const f=this.factory,n=this.root,z=f.empty(n.level-1),h=power(n.level-1);this.root=f.join(f.join(z,z,z,n.a),f.join(z,z,n.b,z),f.join(z,n.c,z,z),f.join(n.d,z,z,z));this.x-=h;this.y-=h;}
 get(x,y){x=BigInt(x)-this.x;y=BigInt(y)-this.y;let n=this.root;if(x<0n||y<0n||x>=power(n.level)||y>=power(n.level))return false;while(n.level){const h=power(n.level-1),right=x>=h,down=y>=h;if(right)x-=h;if(down)y-=h;n=children(n)[Number(down)*2+Number(right)];}return!!n.pop;}
 set(x,y,on){
  x=BigInt(x);y=BigInt(y);if(!on&&!this.get(x,y))return;
  while(x<this.x||y<this.y||x>=this.x+power(this.root.level)||y>=this.y+power(this.root.level))this.expand();
  let rx=x-this.x,ry=y-this.y,n=this.root;const path=[];while(n.level){const h=power(n.level-1),right=rx>=h,down=ry>=h,index=Number(down)*2+Number(right);path.push([n,index]);if(right)rx-=h;if(down)ry-=h;n=children(n)[index];}n=on?this.factory.one:this.factory.zero;
  while(path.length){const[parent,index]=path.pop(),parts=children(parent);parts[index]=n;n=this.factory.join(...parts);}this.root=n;
 }
 advance(exponent=0,deadline=Infinity){
  if(!Number.isInteger(exponent)||exponent<0||exponent>1024)throw Error('Invalid generation jump.');const step=power(exponent);this.factory.deadline=deadline;
  if(!this.root.pop){this.generation+=step;return;}
  while(true){const n=this.root,s=power(n.level),q=s/4n;if(n.level>=exponent+2&&n.minX>=q+step&&n.minY>=q+step&&n.maxX<s-q-step&&n.maxY<s-q-step)break;this.expand();}
  const q=power(this.root.level-2),next=this.factory.future(this.root,exponent);this.root=next;this.x+=q;this.y+=q;this.generation+=step;
  while(this.root.level>4){const n=this.root,q=power(n.level-2),s=power(n.level);if(n.pop&&(n.minX<q||n.minY<q||n.maxX>=s-q||n.maxY>=s-q))break;this.root=this.factory.center(n);this.x+=q;this.y+=q;}
 }
 bounds(){const n=this.root;return n.pop?{minX:this.x+n.minX,minY:this.y+n.minY,maxX:this.x+n.maxX,maxY:this.y+n.maxY}:null;}
 cells(limit=100000){const out=[],stack=[[this.root,this.x,this.y]];while(stack.length){const[n,x,y]=stack.pop();if(!n.pop)continue;if(!n.level){if(out.length>=limit)throw Error('Cell enumeration limit.');out.push([x,y]);continue;}const h=power(n.level-1);stack.push([n.d,x+h,y+h],[n.c,x,y+h],[n.b,x+h,y],[n.a,x,y]);}return out;}
 pack(){
  const ids=new Map([[0,0],[1,1]]),records=[],stack=[[this.root,false]];while(stack.length){const[n,done]=stack.pop();if(ids.has(n.id))continue;if(done){ids.set(n.id,records.length+2);records.push(children(n).map(c=>ids.get(c.id)));}else{stack.push([n,true]);for(const c of children(n))if(!ids.has(c.id))stack.push([c,false]);}}
  return{version:1,nodes:records,root:ids.get(this.root.id),x:String(this.x),y:String(this.y),generation:String(this.generation)};
 }
 static unpack(data){
  if(!data||data.version!==1||!Array.isArray(data.nodes)||data.nodes.length>350000)throw Error('Invalid or oversized quadtree.');const coordinate=v=>{if(typeof v!=='string'||!/^(-?)(0|[1-9]\d*)$/.test(v)||v.length>20000)throw Error('Invalid map coordinate.');return BigInt(v);},w=new World(),nodes=[w.factory.zero,w.factory.one];
  for(const record of data.nodes){if(!Array.isArray(record)||record.length!==4||record.some(i=>!Number.isInteger(i)||i<0||i>=nodes.length))throw Error('Invalid quadtree reference.');const parts=record.map(i=>nodes[i]);if(parts.some(n=>n.level!==parts[0].level)||parts[0].level>16000)throw Error('Invalid quadtree level.');nodes.push(w.factory.join(...parts));}
  if(!Number.isInteger(data.root)||data.root<2||data.root>=nodes.length)throw Error('Invalid quadtree root.');w.root=nodes[data.root];if(w.root.level<2)throw Error('Map root is too small.');w.x=coordinate(data.x);w.y=coordinate(data.y);w.generation=coordinate(data.generation);if(w.generation<0n)throw Error('Invalid generation count.');return w;
 }
}
export class AntWorld{
 constructor(){this.world=new World();this.ants=[];this.nextId=1;}
 add(x,y,direction=0){if(!Number.isInteger(direction)||direction<0||direction>3)throw Error('Invalid ant direction.');if(this.ants.length>=5000)throw Error('This browser supports up to 5,000 ants.');this.ants.push({id:this.nextId++,x:BigInt(x),y:BigInt(y),direction});}
 step(){const toggles=new Map(),delta=[[0n,-1n],[1n,0n],[0n,1n],[-1n,0n]];for(const ant of this.ants){const key=ant.x+','+ant.y,on=this.world.get(ant.x,ant.y);toggles.set(key,{x:ant.x,y:ant.y,on,toggle:!toggles.get(key)?.toggle});ant.direction=(ant.direction+(on?3:1))%4;ant.x+=delta[ant.direction][0];ant.y+=delta[ant.direction][1];}for(const t of toggles.values())if(t.toggle)this.world.set(t.x,t.y,!t.on);this.world.generation++;}
}
