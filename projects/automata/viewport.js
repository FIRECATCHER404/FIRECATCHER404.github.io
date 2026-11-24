export const UNIT=1n<<64n,TICKS=1024n;
const floor=(a,b)=>{const q=a/b;return a<0n&&a%b?q-1n:q;};
export const cellFloor=v=>floor(v,UNIT);
const parts=t=>{const e=floor(t,TICKS);return{e,f:Number(t-e*TICKS)/1024};};
function scaled(integer,ticks){if(!integer)return 0;const negative=integer<0n,a=negative?-integer:integer,bits=a.toString(2).length,shift=Math.max(0,bits-53),top=Number(a>>BigInt(shift)),{e,f}=parts(ticks),exponent=e+BigInt(shift-64);if(exponent>1024n)return negative?-Infinity:Infinity;if(exponent< -1128n)return 0;return(negative?-top:top)*2**(Number(exponent)+f);}
function unscaled(pixel,ticks){if(!pixel)return 0n;const{e,f}=parts(ticks),p=pixel*2**(-f),negative=p<0,a=Math.abs(p),exp=Math.floor(Math.log2(a)),mantissa=BigInt(Math.round(a/2**exp*2**52)),shift=BigInt(exp+64-52)-e,value=shift>=0n?mantissa<<shift:mantissa>>-shift;return negative?-value:value;}
export class Viewport{
 constructor(width=800,height=600){this.width=width;this.height=height;this.x=0n;this.y=0n;this.ticks=4096n;}
 export(){return{x:String(this.x),y:String(this.y),ticks:String(this.ticks),width:this.width,height:this.height};}
 static from(raw){if(!raw||!Number.isFinite(raw.width)||!Number.isFinite(raw.height)||raw.width<=0||raw.height<=0||raw.width>32768||raw.height>32768)throw Error('Invalid viewport size.');const v=new Viewport(raw.width,raw.height);for(const k of['x','y','ticks']){if(typeof raw[k]!=='string'||!/^(-?)(0|[1-9]\d*)$/.test(raw[k])||raw[k].length>20000)throw Error('Invalid saved viewport.');v[k]=BigInt(raw[k]);}return v;}
 point(x,y){return{x:this.width/2+scaled(BigInt(x)*UNIT-this.x,this.ticks),y:this.height/2+scaled(BigInt(y)*UNIT-this.y,this.ticks)};}
 cellAt(x,y){return{x:cellFloor(this.x+unscaled(x-this.width/2,this.ticks)),y:cellFloor(this.y+unscaled(y-this.height/2,this.ticks))};}
 centerOf(x,y){return{x:this.width/2+scaled(BigInt(x)*UNIT+UNIT/2n-this.x,this.ticks),y:this.height/2+scaled(BigInt(y)*UNIT+UNIT/2n-this.y,this.ticks)};}
 pan(dx,dy){this.x-=unscaled(dx,this.ticks);this.y-=unscaled(dy,this.ticks);}
 zoomAt(x,y,delta){const wx=this.x+unscaled(x-this.width/2,this.ticks),wy=this.y+unscaled(y-this.height/2,this.ticks);this.ticks-=BigInt(Math.round(delta*2.56));if(this.ticks>32768n)this.ticks=32768n;this.x=wx-unscaled(x-this.width/2,this.ticks);this.y=wy-unscaled(y-this.height/2,this.ticks);}
 scaleFrom(old){const d=this.ticks-old.ticks;if(d>1048576n)return Infinity;if(d< -1048576n)return 0;return 2**(Number(d)/1024);}
 offsetFrom(old){return{x:scaled(old.x-this.x,this.ticks),y:scaled(old.y-this.y,this.ticks)};}
 fit(bounds){if(!bounds){this.x=0n;this.y=0n;this.ticks=4096n;return;}const{minX,minY,maxX,maxY}=bounds,w=BigInt(maxX)-BigInt(minX)+1n,h=BigInt(maxY)-BigInt(minY)+1n,log=n=>{const bits=n.toString(2).length,s=Math.max(0,bits-53);return Math.log2(Number(n>>BigInt(s)))+s;};this.x=(BigInt(minX)+BigInt(maxX)+1n)*UNIT/2n;this.y=(BigInt(minY)+BigInt(maxY)+1n)*UNIT/2n;const zoom=Math.min(8,Math.log2(Math.max(40,this.width-80))-log(w),Math.log2(Math.max(40,this.height-80))-log(h));this.ticks=BigInt(Math.floor(zoom*1024));}
}
