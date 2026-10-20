export function multiply(a,b){const c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
const normalize=a=>{const length=Math.hypot(...a)||1;return a.map(v=>v/length);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
export function viewMatrix(eye,target){const z=normalize(subtract(eye,target)),x=normalize(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function perspective(aspect,fov=Math.PI*2/7){const f=1/Math.tan(fov/2),near=.2,far=220;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
export function transform(m,p){return Array.from({length:4},(_,i)=>p.reduce((n,v,k)=>n+m[k*4+i]*v,0));}
export function inverse(m){
 const a=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>m[c*4+r]),...Array.from({length:4},(_,c)=>Number(r===c))]);
 for(let col=0;col<4;col++){
  let pivot=col;for(let r=col+1;r<4;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;if(Math.abs(a[pivot][col])<1e-12)return null;
  [a[col],a[pivot]]=[a[pivot],a[col]];const value=a[col][col];for(let c=0;c<8;c++)a[col][c]/=value;
  for(let r=0;r<4;r++)if(r!==col){const factor=a[r][col];for(let c=0;c<8;c++)a[r][c]-=factor*a[col][c];}
 }
 return new Float32Array(Array.from({length:16},(_,i)=>a[i%4][4+Math.floor(i/4)]));
}
export function screenRay(matrix,x,y,width,height){
 if(!width||!height)return null;const inv=inverse(matrix);if(!inv)return null;
 const point=z=>{const p=transform(inv,[x/width*2-1,1-y/height*2,z,1]);return p.slice(0,3).map(v=>v/p[3]);},origin=point(-1),far=point(1);return {origin,direction:normalize(subtract(far,origin))};
}
export function rayTriangle(ray,a,b,c){
 const edge1=subtract(b,a),edge2=subtract(c,a),h=cross(ray.direction,edge2),det=dot(edge1,h);if(Math.abs(det)<1e-9)return null;
 const inv=1/det,s=subtract(ray.origin,a),u=inv*dot(s,h);if(u<0||u>1)return null;const q=cross(s,edge1),v=inv*dot(ray.direction,q);if(v<0||u+v>1)return null;const t=inv*dot(edge2,q);return t>=0?t:null;
}
export function pickMesh(vertices,ranges,ray){
 if(!ray)return null;let nearest=Infinity,id=null;
 for(const range of ranges)for(let i=range.start;i<range.start+range.count;i+=3){
  const point=n=>[vertices[(i+n)*6],vertices[(i+n)*6+1],vertices[(i+n)*6+2]],distance=rayTriangle(ray,point(0),point(1),point(2));
  if(distance!==null&&distance<nearest){nearest=distance;id=range.id;}
 }return id;
}
function hitsBox(ray,min,max){let near=0,far=Infinity;for(let k=0;k<3;k++){
 if(Math.abs(ray.direction[k])<1e-12){if(ray.origin[k]<min[k]||ray.origin[k]>max[k])return false;continue;}
 const a=(min[k]-ray.origin[k])/ray.direction[k],b=(max[k]-ray.origin[k])/ray.direction[k];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return false;
 }return true;}
export function createPickIndex(vertices,count,ranges){
 const chunks=[];for(let start=0;start<count;start+=192){const end=Math.min(count,start+192),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=start;i<end;i++)for(let k=0;k<3;k++){const v=vertices[i*6+k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}chunks.push({start,end,min,max});}
 return ray=>{if(!ray)return null;let nearest=Infinity,hit=-1;for(const c of chunks){if(!hitsBox(ray,c.min,c.max))continue;for(let i=c.start;i<c.end;i+=3){const p=n=>[vertices[(i+n)*6],vertices[(i+n)*6+1],vertices[(i+n)*6+2]],t=rayTriangle(ray,p(0),p(1),p(2));if(t!==null&&t<nearest){nearest=t;hit=i;}}}return ranges.find(r=>hit>=r.start&&hit<r.start+r.count)?.id||null;};
}
