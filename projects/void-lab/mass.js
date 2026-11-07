import * as M from './geometry.js?v=2';

// Integrate a closed convex polyhedron as signed tetrahedra. This also avoids
// unstable principal-axis choices for symmetric clipped hulls.
export function massProperties(faces,density=1){
  const {volume,center}=M.volumeProperties(faces),second=Array.from({length:3},()=>[0,0,0]),keys=['x','y','z'];
  for(const face of faces)for(let i=1;i<face.length-1;i++){
    const p=[face[0],face[i],face[i+1]],v=M.dot(p[0],M.cross(p[1],p[2]))/6;
    for(let a=0;a<3;a++)for(let b=0;b<3;b++){
      let sum=0;for(let j=0;j<3;j++)for(let k=0;k<3;k++)sum+=p[j][keys[a]]*p[k][keys[b]]*(j===k?2:1);
      second[a][b]+=v*sum/20;
    }
  }
  const mass=volume*density,trace=second[0][0]+second[1][1]+second[2][2],c=keys.map(k=>center[k]),r2=M.dot(center,center);
  const tensor=second.map((row,i)=>row.map((n,j)=>density*((i===j?trace:0)-n)-mass*((i===j?r2:0)-c[i]*c[j])));
  const a=tensor.map(row=>[...row]),axes=[[1,0,0],[0,1,0],[0,0,1]];
  for(let iteration=0;iteration<32;iteration++){
    let p=0,q=1;for(const [i,j]of [[0,2],[1,2]])if(Math.abs(a[i][j])>Math.abs(a[p][q])){p=i;q=j;}
    if(Math.abs(a[p][q])<Math.max(1e-20,Math.max(...a.map((row,i)=>Math.abs(row[i])))*1e-12))break;
    const tau=(a[q][q]-a[p][p])/(2*a[p][q]),t=(tau>=0?1:-1)/(Math.abs(tau)+Math.sqrt(1+tau*tau)),cos=1/Math.sqrt(1+t*t),sin=t*cos,off=a[p][q];
    a[p][p]-=t*off;a[q][q]+=t*off;a[p][q]=a[q][p]=0;
    for(let k=0;k<3;k++){
      if(k!==p&&k!==q){const ap=a[k][p],aq=a[k][q];a[k][p]=a[p][k]=cos*ap-sin*aq;a[k][q]=a[q][k]=sin*ap+cos*aq;}
      const vp=axes[k][p],vq=axes[k][q];axes[k][p]=cos*vp-sin*vq;axes[k][q]=sin*vp+cos*vq;
    }
  }
  const m=axes,tr=m[0][0]+m[1][1]+m[2][2];let frame;
  if(tr>0){const s=2*Math.sqrt(tr+1);frame=M.Q((m[2][1]-m[1][2])/s,(m[0][2]-m[2][0])/s,(m[1][0]-m[0][1])/s,s/4);}
  else{let i=0;if(m[1][1]>m[i][i])i=1;if(m[2][2]>m[i][i])i=2;const j=(i+1)%3,k=(i+2)%3,s=2*Math.sqrt(1+m[i][i]-m[j][j]-m[k][k]),v=[0,0,0];v[i]=s/4;v[j]=(m[j][i]+m[i][j])/s;v[k]=(m[k][i]+m[i][k])/s;frame=M.Q(...v,(m[k][j]-m[j][k])/s);}
  return{mass,volume,center,tensor,principal:M.V(a[0][0],a[1][1],a[2][2]),frame:M.normalizeQ(frame)};
}
