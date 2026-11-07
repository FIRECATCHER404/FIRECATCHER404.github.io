const text=new TextEncoder();
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(data){let crc=0xffffffff;for(const byte of data)crc=table[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
const concat=arrays=>{const result=new Uint8Array(arrays.reduce((sum,a)=>sum+a.length,0));let at=0;for(const a of arrays){result.set(a,at);at+=a.length;}return result;};
function chunk(type,data){const kind=text.encode(type),result=new Uint8Array(data.length+12),view=new DataView(result.buffer);view.setUint32(0,data.length);result.set(kind,4);result.set(data,8);view.setUint32(data.length+8,crc32(result.subarray(4,data.length+8)));return result;}
export async function encodeAPNG(frames,width,height,count,fps,loop=true,onFrame=()=>{}){
  if(typeof CompressionStream==="undefined")throw new Error("Animated PNG export needs CompressionStream. Sprite-sheet export is still available.");
  if(!Number.isInteger(width)||!Number.isInteger(height)||!Number.isInteger(count)||!Number.isInteger(fps)||width<1||height<1||width>4096||height>4096||count<1||count>240||width*height*count>32000000||fps<1||fps>60)throw new Error("The animation is too large. Reduce frames or export scale.");
  const header=new Uint8Array(13),h=new DataView(header.buffer);h.setUint32(0,width);h.setUint32(4,height);header.set([8,6,0,0,0],8);
  const control=new Uint8Array(8),c=new DataView(control.buffer);c.setUint32(0,count);c.setUint32(4,loop?0:1);
  const chunks=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("acTL",control)];let sequence=0,index=0;
  for await(const rgba of frames){
    if(index>=count||rgba.length!==width*height*4)throw new Error("Invalid animation frame data.");
    const fc=new Uint8Array(26),f=new DataView(fc.buffer);f.setUint32(0,sequence++);f.setUint32(4,width);f.setUint32(8,height);f.setUint16(20,1);f.setUint16(22,fps);fc[24]=0;fc[25]=0;chunks.push(chunk("fcTL",fc));
    const filtered=new Uint8Array((width*4+1)*height);for(let y=0;y<height;y++)filtered.set(rgba.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
    const stream=new Blob([filtered]).stream().pipeThrough(new CompressionStream("deflate")),compressed=new Uint8Array(await new Response(stream).arrayBuffer());
    if(index===0)chunks.push(chunk("IDAT",compressed));else{const fd=new Uint8Array(compressed.length+4);new DataView(fd.buffer).setUint32(0,sequence++);fd.set(compressed,4);chunks.push(chunk("fdAT",fd));}
    onFrame(++index,count);
  }
  if(index!==count)throw new Error("Some animation frames are missing.");chunks.push(chunk("IEND",new Uint8Array()));return concat(chunks);
}
export function zipStore(entries){
  const local=[],central=[];let offset=0;
  for(const [name,data]of entries){const filename=text.encode(name),bytes=typeof data==="string"?text.encode(data):data,crc=crc32(bytes),head=new Uint8Array(30+filename.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,filename.length,true);head.set(filename,30);local.push(head,bytes);
    const record=new Uint8Array(46+filename.length),r=new DataView(record.buffer);r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint16(8,0x800,true);r.setUint16(14,0x21,true);r.setUint32(16,crc,true);r.setUint32(20,bytes.length,true);r.setUint32(24,bytes.length,true);r.setUint16(28,filename.length,true);r.setUint32(42,offset,true);record.set(filename,46);central.push(record);offset+=head.length+bytes.length;
  }
  const directory=concat(central),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,directory.length,true);e.setUint32(16,offset,true);return concat([...local,directory,end]);
}
