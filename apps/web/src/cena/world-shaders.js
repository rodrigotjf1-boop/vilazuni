// Shaders do cenário (WebGL 1): luz por pixel com sol e céu, sombra do sol (mapa de profundidade com filtro
// suave), materiais procedurais, água com ondas e reflexo do céu, mapeamento de tons ACES e neblina.
// Os números dos materiais são os de MAT em world-scene.mjs.
export const VERTEX = `
attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;attribute float aMat;
uniform mat4 uM;uniform mat4 uLight;
varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;varying float vMat;varying vec4 vLightPos;varying float vDepth;
void main(){vec4 p=vec4(aPos,1.0);gl_Position=uM*p;vColor=aColor;vNormal=aNormal;vWorld=aPos;vMat=aMat;vLightPos=uLight*vec4(aPos+aNormal*0.08,1.0);vDepth=gl_Position.w;}`;

export const fragmentShader = (highp) => `
precision ${highp ? 'highp' : 'mediump'} float;
varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;varying float vMat;varying vec4 vLightPos;varying float vDepth;
uniform vec3 uCam;uniform vec3 uSun;uniform vec3 uFog;uniform vec3 uFogColor;uniform float uTime;uniform float uShadowOn;
uniform sampler2D uShadow;uniform float uTexel;uniform float uExposure;
const vec3 SUN_COLOR=vec3(2.9,2.55,2.1);
const vec3 SKY_AMB=vec3(0.55,0.7,0.92);
const vec3 GROUND_AMB=vec3(0.46,0.39,0.3);
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}
float unpackDepth(vec4 c){return dot(c,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));}
float occluded(vec2 uv,float z){return z>unpackDepth(texture2D(uShadow,uv))?0.0:1.0;}
// Sombra suave: 3×3 amostras, cada uma com interpolação bilinear entre 4 texels (borda sem serrilhado).
float shadowAt(vec3 n){
 if(uShadowOn<0.5)return 1.0;
 vec3 s=vLightPos.xyz/vLightPos.w*0.5+0.5;
 if(s.x<0.0||s.x>1.0||s.y<0.0||s.y>1.0||s.z>1.0)return 1.0;
 float z=s.z-(0.00025+0.0006*(1.0-max(dot(n,uSun),0.0)));
 vec2 st=s.xy/uTexel-0.5,f=fract(st),origin=(floor(st)+0.5)*uTexel;
 float lit=0.0;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  vec2 o=origin+vec2(float(x),float(y))*uTexel;
  float a=occluded(o,z),b=occluded(o+vec2(uTexel,0.0),z),c=occluded(o+vec2(0.0,uTexel),z),d=occluded(o+vec2(uTexel),z);
  lit+=mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
 return lit/9.0;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
vec3 skyReflect(vec3 r){float e=clamp(r.y,0.0,1.0);
 vec3 c=mix(vec3(0.74,0.84,0.92),vec3(0.18,0.42,0.72),pow(e,0.55));
 return c+vec3(1.6,1.4,1.1)*pow(max(dot(r,uSun),0.0),280.0)*6.0;}
float seaHeight(vec2 p){return fbm(p*0.05+vec2(uTime*0.012,uTime*0.009))*1.1+fbm(p*0.19-vec2(uTime*0.035,-uTime*0.02))*0.35+noise(p*0.9+uTime*0.1)*0.08;}
void main(){
 float m=floor(vMat+0.5);
 if(m==18.0){gl_FragColor=vec4(vColor,1.0);return;}
 vec3 base=pow(vColor,vec3(2.2));
 vec3 n=normalize(vNormal);
 vec3 V=normalize(uCam-vWorld);
 vec2 xz=vWorld.xz;
 float shininess=24.0,specular=0.04,wrap=0.0,water=0.0,emissive=0.0;
 if(m==1.0){ // reboco: textura fina, manchas e sujeira junto ao chão
  float s=fbm(vec2(vWorld.x+vWorld.z,vWorld.y)*2.6);
  base*=0.86+0.2*s;
  base*=mix(0.8,1.0,smoothstep(0.25,1.3,vWorld.y));
 }else if(m==2.0){ // telha colonial em fileiras, com relevo das capas
  float row=vWorld.y*4.4,col=vWorld.z*4.0+floor(row)*0.5;
  float fr=fract(row),fc=fract(col);
  base*=(0.6+0.42*sin(fc*3.14159))*mix(0.5,1.0,smoothstep(0.0,0.16,fr))*(0.82+0.32*hash(floor(vec2(col,row))));
  base*=0.9+0.2*fbm(xz*0.8+vWorld.y);
  n=normalize(n+vec3(0.0,0.0,1.0)*cos(fc*3.14159)*0.55);
  shininess=40.0;specular=0.12;
 }else if(m==3.0||m==4.0){ // calçamento (pedras no chão) e alvenaria de pedra (paredes de arrimo, escadas)
  vec2 p=abs(n.y)>0.5?xz*vec2(1.25,1.6):vec2(vWorld.x+vWorld.z,vWorld.y)*vec2(1.0,2.2);
  if(m==4.0&&abs(n.y)>0.5)p=xz*1.1;
  p.x+=floor(p.y)*0.5;
  vec2 cell=floor(p),f=fract(p);
  float edge=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));
  float joint=smoothstep(0.015,0.07,edge);
  base*=mix(0.42,(0.8+0.34*hash(cell))*(0.9+0.14*noise(xz*7.0+vWorld.y*5.0)),joint);
 }else if(m==5.0){ // grama
  base*=0.72+0.42*fbm(xz*1.4)+0.12*noise(xz*18.0);
 }else if(m==6.0){ // folhagem: tufos de folhas (relevo e tom), sombra interna e luz atravessando as folhas
  vec2 q=vWorld.xz*3.1+vWorld.y*2.7;
  float leaves=fbm(q),fine=noise(q*3.7);
  base*=(0.45+0.85*leaves)*(0.85+0.3*fine);
  n=normalize(n+vec3(noise(q*1.9)-0.5,0.0,noise(q*1.9+9.0)-0.5)*1.1);
  wrap=0.45;specular=0.03;
 }else if(m==7.0){ // madeira
  float g=fract(vWorld.y*7.0+fbm(xz*2.0+vWorld.y)*1.6);
  base*=0.74+0.3*smoothstep(0.0,0.6,g);
 }else if(m==8.0){ // venezianas: ripas inclinadas
  float s=fract(vWorld.y*12.0);
  base*=mix(0.5,1.05,smoothstep(0.0,0.3,s));
  n=normalize(n+vec3(0.0,(s-0.5)*0.9,0.0));
 }else if(m==9.0){ // pintura branca, acabamentos
  base*=0.95+0.06*noise(xz*4.0+vWorld.y*4.0);shininess=50.0;specular=0.08;
 }else if(m==10.0){ // piscina: cáusticas e reflexo
  float c=pow(1.0-abs(sin(fbm(xz*2.2+uTime*0.25)*9.0)),5.0);
  base=base*0.85+vec3(0.55,0.75,0.75)*c*0.35;
  water=1.0;
  n=normalize(vec3((noise(xz*3.0+uTime)-0.5)*0.12,1.0,(noise(xz*3.0-uTime+7.0)-0.5)*0.12));
 }else if(m==11.0){ // mar: ondas, reflexo do céu, brilho do sol
  float e=0.6,h0=seaHeight(xz),hx=seaHeight(xz+vec2(e,0.0)),hz=seaHeight(xz+vec2(0.0,e));
  n=normalize(vec3(h0-hx,e*1.6,h0-hz));
  water=1.0;
 }else if(m==12.0){ // espuma
  base*=0.86+0.2*noise(xz*1.6+vec2(uTime*0.2,0.0));emissive=0.12;
 }else if(m==13.0){ // rocha
  base*=0.62+0.55*fbm(vWorld.xz*0.9+vWorld.y*1.3);
 }else if(m==14.0){ // tronco anelado
  base*=0.66+0.4*smoothstep(0.0,0.35,fract(vWorld.y*4.5))*(0.85+0.2*noise(xz*9.0));
 }else if(m==15.0){ // terreno: grão da areia, ondulações do vento, manchas
  float sand=smoothstep(0.55,0.75,dot(vColor,vec3(0.33)));
  base*=0.86+0.22*fbm(xz*0.32)+0.06*noise(xz*6.0);
  base*=1.0+sand*0.06*sin(vWorld.x*1.3+vWorld.z*0.7+fbm(xz*0.15)*7.0);
 }else if(m==16.0){ // asfalto
  base*=0.8+0.3*noise(xz*14.0);
 }else if(m==17.0){
  base*=0.9+0.12*noise(xz*5.0+vWorld.y*5.0);
 }else if(m==19.0){
  shininess=60.0;specular=0.3;
 }else{
  base*=0.95+0.07*noise(xz*3.0+vWorld.y*3.0);
 }
 float sh=shadowAt(normalize(vNormal));
 float ndl=wrap>0.0?max((dot(n,uSun)+wrap)/(1.0+wrap),0.0):max(dot(n,uSun),0.0);
 vec3 amb=mix(GROUND_AMB,SKY_AMB,n.y*0.5+0.5);
 vec3 col;
 if(water>0.5){
  vec3 R=reflect(-V,n);
  float fres=0.02+0.98*pow(1.0-max(dot(n,V),0.0),5.0);
  vec3 body=base*(amb*0.9+SUN_COLOR*0.35*max(dot(vec3(0.0,1.0,0.0),uSun),0.0)*sh);
  col=mix(body,skyReflect(R)*0.9,fres*0.85);
  col+=SUN_COLOR*pow(max(dot(R,uSun),0.0),180.0)*1.6*sh;
 }else{
  vec3 H=normalize(uSun+V);
  col=base*(amb+SUN_COLOR*ndl*sh)+SUN_COLOR*pow(max(dot(n,H),0.0),shininess)*specular*sh;
  if(wrap>0.0)col+=base*SUN_COLOR*0.12*max(dot(-n,uSun),0.0);
  col+=base*emissive;
 }
 col=aces(col*uExposure);
 col=pow(col,vec3(1.0/2.2));
 float fog=clamp((vDepth-uFog.x)/uFog.y,0.0,uFog.z);
 gl_FragColor=vec4(mix(col,uFogColor,fog),1.0);
}`;

// Profundidade vista do sol, guardada em RGBA (funciona em qualquer WebGL 1, sem extensão).
export const SHADOW_VERTEX = `attribute vec3 aPos;uniform mat4 uLight;varying float vZ;
void main(){gl_Position=uLight*vec4(aPos,1.0);vZ=gl_Position.z*0.5+0.5;}`;
export const shadowFragment = (highp) => `precision ${highp ? 'highp' : 'mediump'} float;varying float vZ;
void main(){vec4 e=fract(vec4(1.0,255.0,65025.0,16581375.0)*vZ);e-=e.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);gl_FragColor=e;}`;
