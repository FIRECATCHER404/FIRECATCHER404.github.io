import{power}from'./core.js?v=1';
export function renderRects(world,view){
 const rects=[],stack=[[world.root,world.x,world.y]],occupied=new Set();let visited=0;
 while(stack.length){const[n,x,y]=stack.pop();visited++;if(!n.pop)continue;const size=power(n.level),a=view.point(x,y),b=view.point(x+size,y+size);if(b.x<0||b.y<0||a.x>view.width||a.y>view.height)continue;
  const w=b.x-a.x,h=b.y-a.y;if(w<=1||h<=1){const px=Math.max(0,Math.min(view.width-1,Math.floor(a.x))),py=Math.max(0,Math.min(view.height-1,Math.floor(a.y))),key=px+','+py;if(!occupied.has(key)){rects.push(px,py,1,1);occupied.add(key);}continue;}
  if(!n.level||n.pop===power(n.level*2)){const left=Math.max(0,a.x),top=Math.max(0,a.y),right=Math.min(view.width,b.x),bottom=Math.min(view.height,b.y);if(right>left&&bottom>top)rects.push(left,top,right-left,bottom-top);continue;}
  const half=power(n.level-1);stack.push([n.d,x+half,y+half],[n.c,x,y+half],[n.b,x+half,y],[n.a,x,y]);
 }
 return{rects:new Float32Array(rects),visited};
}
