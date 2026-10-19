import {can,ROLES} from './permissions.mjs';
// Cena local em WebGL, sem bibliotecas ou serviços externos.
const SVG={map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>',task:'<rect x="5" y="4" width="15" height="18" rx="3"/><path d="M9 4V2h7v2M9 11l2 2 5-5M9 18h7"/>',car:'<path d="m3 13 2-7h14l2 7v7h-3v-3H6v3H3zM3 13h18M7 13v3M17 13v3"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9M17 17l3-3M14 14l3-3"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.1"/>',view:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',arrow:'<path d="m8 5 7 7-7 7"/>'};
const icon=(n)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[n]||SVG.home}</svg>`;
const safe=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountWorld(root,options){
 const {user,role,roles,houses,onRole,onHouse,onPage,onNewStay}=options;
 root.innerHTML=`<main class="world-shell" id="main"><canvas id="world-canvas" tabindex="0" aria-label="Condomínio tridimensional. Arraste para girar, use setas para navegar e mais ou menos para aproximar. Use a lista de locais para acesso por teclado."></canvas><div class="world-vignette"></div><header class="world-top"><div class="world-brand"><span class="brand-icon">V</span><div><strong>Vilazuni</strong><small>CONDOMÍNIO CHANDRA</small></div></div><span class="world-mode"><i></i> Mundo interativo <b>DEMO</b></span><label class="world-profile"><span>Explorar como</span><select id="world-role">${Object.entries(roles).map(([k,v])=>`<option value="${k}" ${role===k?'selected':''}>${v}</option>`).join('')}</select></label></header>
 <section class="world-heading"><p>SEU CONDOMÍNIO, DE OUTRO JEITO</p><h1>Entre. Explore.<br>Sinta-se em casa.</h1><span>Toque em uma casa ou espaço para descobrir.</span></section>
 <nav class="world-tools" aria-label="Ferramentas do condomínio">${[['home','Casas','houses'],['people','Estadias','stays'],['car','Vagas','parking'],...(ROLES.includes(role)?[['list','Ocorrências','incidents']]:[]),...((can(user,'facilities')||['proprietario','imobiliaria','ocupante'].includes(role))?[['map','Reservas','facilities']]:[]),...((can(user,'tasks')||role==='zelador')?[['task','Tarefas','tasks']]:[]),...((can(user,'parcels')||['portaria','proprietario','imobiliaria','ocupante'].includes(role))?[['list','Encomendas','parcels']]:[]),...(ROLES.includes(role)?[['list','Avisos','notifications']]:[]),...(can(user,'maintenance')?[['task','Preventiva','maintenance']]:[]),...((can(user,'materials')||role==='zelador')?[['list','Materiais','materials']]:[]),...((can(user,'stays')||role==='portaria')?[['key','Acessos','access']]:[])].map(([i,t,p])=>`<button data-world-page="${p}" title="${t}" aria-label="${t}">${icon(i)}<span>${t}</span></button>`).join('')}</nav>
 <aside id="world-context" class="world-context" hidden></aside><div class="world-labels" id="world-labels"></div>
 <div class="world-bottom"><div class="world-location"><span>${icon(mapIcon())}</span><div><strong>Alameda central</strong><small id="world-camera-caption">Visão aérea · arraste para explorar</small></div></div><div class="world-controls"><button id="world-walk" title="Alternar vista de passeio" aria-label="Alternar vista de passeio">${icon('view')}<span>Passear</span></button><span class="control-divider"></span><button id="world-minus" aria-label="Afastar">${icon('minus')}</button><button id="world-plus" aria-label="Aproximar">${icon('plus')}</button><button id="world-reset" aria-label="Voltar à visão inicial">${icon('reset')}</button><button id="world-list" aria-label="Lista acessível de locais">${icon('list')}</button></div></div><div class="world-hint" id="world-hint">Arraste para girar <span>·</span> Role para aproximar <span>·</span> Clique para explorar</div><div class="world-disclaimer">Chandra · distribuição informada · medidas ilustrativas · acessos simulados · sem equipamentos conectados</div><button id="world-help" class="world-help" aria-label="Ajuda de navegação">${icon('help')}</button><div id="world-tooltip" class="world-tooltip" hidden></div></main><div id="modal-root"></div>`;
 function mapIcon(){return 'map';}
 document.querySelector('#world-role').onchange=e=>onRole(e.target.value);
 root.querySelectorAll('[data-world-page]').forEach(b=>b.onclick=()=>onPage(b.dataset.worldPage));
 const canvas=root.querySelector('canvas'),ctx=root.querySelector('#world-context'),labels=root.querySelector('#world-labels');
 let sceneReady=false;
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
 if(!gl){canvas.hidden=true;document.querySelector('.world-heading h1').textContent='Explore pela lista de locais';document.querySelector('#world-hint').textContent='WebGL não está disponível neste navegador. A lista mantém o acesso aos locais.';showList();return ()=>{};}
 const vertices=[];const color=hex=>[parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255];
 function tri(a,b,c,col,shade=1){for(const p of [a,b,c])vertices.push(...p,...col.map(v=>v*shade));}
 function box(x,y,z,w,h,d,hex){const c=color(hex),p=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];for(const [a,b,c1,d1,s] of [[0,1,2,3,.82],[4,7,6,5,1],[0,3,7,4,.68],[1,5,6,2,.91],[3,2,6,7,1.08]]){tri(p[a],p[b],p[c1],c,s);tri(p[a],p[c1],p[d1],c,s);}}
 function roof(x,y,z,w,d){const c=color('aa613b'),a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c1=[x+w/2,y,z+d/2],d1=[x-w/2,y,z+d/2],e=[x,y+1.4,z-d/2],f=[x,y+1.4,z+d/2];tri(a,b,e,c,.8);tri(d1,f,c1,c);tri(a,e,f,c,.75);tri(a,f,d1,c,.75);tri(e,b,c1,c,1.05);tri(e,c1,f,c,1.05);}
 function foliage(x,y,z,r,hex){const c=color(hex),rings=5,segs=9;const point=(i,j)=>{const v=Math.PI*i/rings,t=2*Math.PI*j/segs;return[x+Math.sin(v)*Math.cos(t)*r,y+Math.cos(v)*r*.9,z+Math.sin(v)*Math.sin(t)*r];};for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){tri(point(i,j),point(i+1,j),point(i+1,j+1),c,.78+i*.055);tri(point(i,j),point(i+1,j+1),point(i,j+1),c,.78+i*.055);}}
 function tree(x,z,size=1){box(x,.1,z,.22,2.2*size,.22,'887a61');foliage(x,2.2*size,z,1.05*size,'628959');foliage(x-.55*size,1.8*size,z+.25*size,.7*size,'769b62');foliage(x+.45*size,2.6*size,z,.65*size,'89a96c');}
 function palm(x,y,z){box(x,y,z,.2,4,.2,'927857');for(let j=0;j<8;j++){const t=j*Math.PI/4,c=color(j%2?'6f9358':'567c4a');const tip=[x+Math.cos(t)*2.1,y+3.5,z+Math.sin(t)*2.1],mid=[x+Math.cos(t)*.9,y+4.6,z+Math.sin(t)*.9];tri([x,y+4,z],[mid[0]+.35*Math.sin(t),mid[1],mid[2]-.35*Math.cos(t)],tip,c);tri([x,y+4,z],tip,[mid[0]-.35*Math.sin(t),mid[1],mid[2]+.35*Math.cos(t)],c,.85);}}

 // Organização informada pelo usuário; dimensões apenas ilustrativas.
 const objects=[];
 box(0,-.7,-7,34,.6,92,'a4b995');box(0,-.1,2,32,.18,66,'b6b39f');
 for(let z=-28;z<34;z+=1.2)for(let x=-5;x<5;x+=1.1)box(x,.1,z,1.04,.03,1.1,(Math.round((x+5)*10+z*10)%3===0)?'aaa897':'c3bdab');
 function house(n,x,z){const id='c'+String(n).padStart(2,'0'),face=x>0?-1:1;
 box(x,.2,z,7.8,5.3,6.4,'d8aa39');roof(x,5.5,z,8.4,6.8);
 box(x+face*4.2,.12,z,2.5,.15,6.5,'898b80');roof(x+face*4.2,2.6,z,2.8,6.6);
 for(const dz of [-2.9,2.9])box(x+face*5.1,.25,z+dz,.16,2.35,.16,'684730');
 box(x+face*3.94,.3,z+1.65,.08,1.9,1.1,'6a4933');
 for(const level of [1.1,3.6])for(const dz of [-1.7,1.5]){box(x+face*3.94,level,z+dz,.12,1.2,1.4,'f4eee0');box(x+face*4.02,level+.1,z+dz,.1,1,1.2,'715646');}
 objects.push({id,title:'Casa '+String(n).padStart(2,'0'),type:'house',x:x+face*3,y:6.3,z,description:'Dois andares · '+(x>0?'direita':'esquerda')+' de quem entra'});
 }
 for(let i=0;i<7;i++){house(i+1,11,27-i*8);house(i+8,-11,27-i*8);}
 // Churrasqueira após a casa 14, ainda no nível residencial.
 box(-11,.2,-28,8,.2,6,'b6b09c');box(-13,.4,-29,1.5,2.2,1.3,'9b6244');box(-13,1.3,-28.3,1.1,.7,.1,'3b3e35');box(-13,2.6,-29,.8,1.2,.8,'a37353');
 box(-9,.9,-28,3,.15,1.4,'8c7354');for(const z of [-27,-29])box(-9,.45,z,3,.15,.45,'8c7354');
 objects.push({id:'bbq',title:'Churrasqueira',type:'space',x:-19,y:3.6,z:-28,description:'Entre a casa 14 e o salão de festas · churrasqueira e área reservada'});
 // Primeiro patamar: festas à esquerda, jogos à direita.
 box(0,-.1,-38,32,3.1,14,'969a87');box(0,3,-38,32,.15,14,'d0c8b2');
 for(let i=0;i<12;i++)box(0,.1,-27-i*.45,5,(i+1)*.25,.48,'b5b09f');
 for(const [id,title,x] of [['party','Salão de festas',-10],['games','Salão de jogos',10]]){box(x,3.15,-38,9,3,8,'d7ad49');roof(x,6.15,-38,9.6,8.6);box(x,3.2,-33.95,3,2.3,.12,'715c40');objects.push({id,title,type:'space',x,y:7.8,z:-38,description:'Primeiro patamar acima das casas · '+(x<0?'lado esquerdo':'lado direito')});}
 // Segundo lance e piscina no patamar mais alto.
 box(0,-.1,-49,32,6.1,10,'979d88');box(0,6,-49,32,.2,10,'e0d7be');
 for(let i=0;i<12;i++)box(0,3.15,-41-i*.3,5,(i+1)*.25,.33,'bab5a4');
 box(0,6.2,-49,13,.25,6,'f3e9d2');box(0,6.46,-49,11.8,.03,4.8,'55b5bc');
 objects.push({id:'pool',title:'Piscina',type:'space',x:0,y:8,z:-49,description:'Patamar superior · após o segundo lance de escadas'});
 // Portão de entrada na extremidade da circulação central.
 for(const x of [-4.7,4.7])box(x,.15,33,.65,3.2,.7,'f0eee3');roof(0,3.5,33,10.5,2.8);
 for(let x=-4.2;x<=4.2;x+=.34)box(x,.15,33,.23,2.8,.17,'65452e');
 for(const x of [-11,11]){box(x,.1,33,12,1.1,.5,'929080');box(x,1.2,33,12,1.05,.45,'eeeade');}
 objects.push({id:'gate',title:'Entrada e portaria',type:'gate',x:0,y:4.5,z:33,description:'Direita: casas 01–07 · esquerda: casas 08–14 · nenhum portão conectado'});
 for(const x of [-16,16])for(let z=-28;z<33;z+=7)tree(x,z,.9);
 // Jardins, jardineiras floridas, bancos e iluminação de escala humana.
 for(const x of [-15.7,15.7]){box(x,.1,1,1,.18,60,'7b9965');for(let z=-27;z<31;z+=2)foliage(x,.65,z,.65,'5f854d');}
 for(let i=0;i<7;i++)for(const side of [-1,1]){const x=side*5.6,z=29.8-i*8;box(x,.15,z,.85,.55,1.5,'a69577');box(x,.71,z,.7,.04,1.35,'6b6749');for(let j=0;j<3;j++){foliage(x,.98,z-.45+j*.45,.38,j%2?'6b9452':'82a365');foliage(x+.12,1.2,z-.4+j*.4,.12,i%2?'e8cf89':'c98d8b');}}
 for(const x of [-5.3,5.3])for(const z of [24,8,-8,-24]){box(x,.15,z,.09,1.65,.09,'4d5a48');box(x,1.8,z,.4,.15,.4,'eee0b0');box(x,1.95,z,.5,.08,.5,'59654c');}
 for(const x of [-13,13]){palm(x,6.2,-49);box(x,6.2,-45.5,2.4,.2,.9,'d6c4a2');box(x,6.4,-45.7,2.2,.3,.6,'e6ddbf');}
 for(const x of [-5.5,5.5]){box(x,3.2,-36,1.5,.6,2.5,'b4ad95');foliage(x,4.1,-36,.85,'658d58');}
 for(const x of [-14,14])palm(x,.2,31);
 box(-7,.2,-28,1.4,.12,3,'9ab280');foliage(-7,.8,-28,.7,'71975e');
 const exteriorCount=vertices.length/6;
 // Interior conceitual: sala aberta, cozinha e jardim vistos da entrada.
 box(0,-.2,0,16,.2,16,'bda98b');
 for(let x=-8;x<8;x+=.5)box(x,.005,0,.018,.008,16,'aa9276');
 box(0,0,-6,16,4.7,.18,'eee8d9');box(-8,0,0,.18,4.7,12,'dfd9c9');
 box(-3,1,-5.85,6,2.8,.08,'91b7b2');
 for(const x of [-6,-3,0])box(x,1,-5.7,.08,2.8,.12,'f8f3e7');
 box(-3,2.5,-5.7,6,.08,.12,'f8f3e7');
 box(-3,0,-5.6,6,.15,.5,'e4d6be');
 box(-3,.03,1,7,.035,5,'d8d9c5');
 box(-4,.25,-1,4.8,.65,1.8,'e8dfcb');box(-4,.9,-1.7,4.8,.75,.4,'d9cdb5');
 for(const x of [-6.3,-1.7])box(x,.6,-1,.35,.7,1.9,'d9cdb5');
 for(const x of [-5.3,-3.9,-2.5])box(x,.91,-1,1.25,.2,1.05,'f2ecdf');
 box(-3,.35,1.3,2.8,.15,1.35,'987958');box(-3,.05,1.3,2,.3,.9,'6e5947');
 box(-3,.51,1.2,.6,.06,.4,'466e65');box(-2.2,.51,1.4,.25,.25,.25,'eee7d3');
 box(4,0,-4.8,6,1.15,1.6,'698378');box(4,1.15,-4.8,6,.12,1.7,'efe8d8');
 for(const x of [2,3.5,5,6.5])box(x,.45,-3.96,.06,.06,.04,'d5bd88');
 box(5.8,0,-2,2.8,1.1,1.3,'8c9c87');box(5.8,1.1,-2,3,.12,1.5,'f0e7d7');
 for(const x of [4.8,6.5]){box(x,.55,-.6,.75,.15,.75,'987958');box(x,0,-.6,.12,.6,.12,'515e54');}
 box(2,1.9,-5.8,1.5,1.7,.1,'a78860');box(2,2.05,-5.7,1.2,1.4,.03,'718b80');
 box(-7,0,-4,.7,.7,.7,'b39571');tree(-7,-4,1.1);
 box(1,0,3,.13,2.9,.13,'646a58');box(1,2.7,3,1.1,.5,1.1,'eee0bf');
 // Escada interna e área de serviço no térreo.
 for(let i=0;i<10;i++)box(7,0,3-i*.5,1.5,(i+1)*.27,.5,'b4a083');
 box(5,0,-5,1,1,.8,'eae5d9');box(5,.3,-4.58,.65,.55,.04,'99aaa6');
 const interiorCount=vertices.length/6-exteriorCount;
 const upperStart=vertices.length/6;
 box(0,-.2,0,16,.2,16,'bda98b');box(0,0,-6,16,4.7,.18,'eee8d9');box(-8,0,0,.18,4.7,12,'dfd9c9');
 box(-4,1.4,-5.85,3.5,2,.08,'91b7b2');box(-4,2.4,-5.7,3.5,.08,.12,'f8f3e7');
 box(-3,.2,-2,3.6,.5,4.6,'927b5b');box(-3,.7,-2,3.5,.35,4.5,'e6e0ce');box(-3,1.05,-3.4,3.3,.15,1.2,'f5f0df');box(-3,1.05,-.8,3.5,.06,2.1,'859c83');
 box(-3,.3,-4.4,3.8,1.5,.18,'a88b64');box(-6,.1,-3.4,1,.7,1,'a88b64');
 // Banheiro em corte aberto para visualizar a distribuição conceitual.
 box(3.1,0,-3,.18,3.1,6,'d6ded4');box(5.5,.02,-3,4.5,.1,6,'c8d6cd');
 box(6,0,-4.5,2,.15,2,'eceee2');box(6,2.4,-5.4,.8,.08,.8,'758b85');box(6,1,-5.4,.06,1.4,.06,'758b85');
 box(4.4,.7,-2,1.8,.25,1,'f1eee3');box(4.4,1.5,-5.8,1.6,1.5,.08,'8fa9a3');box(6,.1,-1,.8,.55,1.2,'f1eee3');
 const upperCount=vertices.length/6-upperStart;
 const vs=`attribute vec3 aPos;attribute vec3 aColor;uniform mat4 uM;varying vec3 vColor;varying float vDepth;void main(){gl_Position=uM*vec4(aPos,1.0);vColor=aColor;vDepth=gl_Position.w;}`;
 const fs=`precision mediump float;varying vec3 vColor;varying float vDepth;void main(){float fog=clamp((vDepth-65.0)/220.0,0.0,0.22);gl_FragColor=vec4(mix(vColor,vec3(0.84,0.90,0.85),fog),1.0);}`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Leitura gráfica indisponível.');return s;}
 let program,buffer;
 try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error();buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.useProgram(program);for(const [name,offset] of [['aPos',0],['aColor',12]]){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,24,offset);}gl.enable(gl.DEPTH_TEST);}catch{document.querySelector('#world-hint').textContent='A renderização não está disponível. Explore pela lista.';showList();return ()=>{};}
 let interiorHouse=null,upperFloor=false;const shell=root.querySelector('.world-shell');const exitButton=document.createElement('button');exitButton.id='world-exit-house';exitButton.textContent='← Voltar ao condomínio';exitButton.hidden=true;shell.append(exitButton);exitButton.onclick=reset;
 const uM=gl.getUniformLocation(program,'uM');let yaw=.22,pitch=.92,distance=106,tx=0,tz=-8,walk=false,matrix,frame,drag=null,moved=false;
 function mul(a,b){const c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
 function normalize(a){const l=Math.hypot(...a)||1;return a.map(v=>v/l);}
 function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
 function view(eye,target){const z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x),dot=a=>-a.reduce((s,v,i)=>s+v*eye[i],0);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,dot(x),dot(y),dot(z),1]);}
 function project(o){const p=[o.x,o.y,o.z,1],r=[0,0,0,0];for(let i=0;i<4;i++)for(let k=0;k<4;k++)r[i]+=matrix[k*4+i]*p[k];return {x:(r[0]/r[3]*.5+.5)*canvas.clientWidth,y:(-.5*r[1]/r[3]+.5)*canvas.clientHeight,visible:r[3]>0&&Math.abs(r[0]/r[3])<1.1&&Math.abs(r[1]/r[3])<1.1,depth:r[3]};}
 labels.innerHTML=objects.map(o=>`<button class="world-pin ${o.type}" data-world-object="${o.id}" aria-label="Explorar ${safe(o.title)}"><i></i><span>${safe(o.title)}</span></button>`).join('');
 labels.querySelectorAll('button').forEach(b=>b.onclick=()=>select(objects.find(o=>o.id===b.dataset.worldObject)));
 function draw(){if(!canvas.isConnected)return;const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.84,.90,.85,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const f=1/Math.tan(Math.PI/7),near=.2,far=220,aspect=w/h,proj=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
 const groundY=tz<-44?6:tz<-32?3:tz<-27?(-27-tz)*.6:0;const eye=interiorHouse?[Math.sin(yaw)*3,2.7+pitch*.3,Math.max(4,Math.min(9,distance))]:walk?[tx+Math.sin(yaw)*3,2.2+groundY,tz+Math.cos(yaw)*3]:[tx+distance*Math.sin(yaw)*Math.cos(pitch),distance*Math.sin(pitch),tz+distance*Math.cos(yaw)*Math.cos(pitch)];const target=interiorHouse?[Math.sin(yaw)*5,1.8,-3]:walk?[tx-Math.sin(yaw)*5,1.8+groundY,tz-Math.cos(yaw)*5]:[tx,0,tz];matrix=mul(proj,view(eye,target));gl.uniformMatrix4fv(uM,false,matrix);gl.drawArrays(gl.TRIANGLES,interiorHouse?(upperFloor?upperStart:exteriorCount):0,interiorHouse?(upperFloor?upperCount:interiorCount):exteriorCount);
 objects.forEach((o,i)=>{const p=project(o),el=labels.children[i];el.hidden=!!interiorHouse||!p.visible;el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;});frame=requestAnimationFrame(draw);}
 function enterHouse(id){if(!houses.some(h=>h.id===id))return;interiorHouse=id;upperFloor=false;distance=8;yaw=-.15;pitch=.5;walk=false;ctx.hidden=true;labels.hidden=true;shell.classList.add('is-interior');exitButton.hidden=false;root.querySelector('.world-location strong').textContent='Casa '+houses.find(h=>h.id===id).number;root.querySelector('#world-camera-caption').textContent='Interior ilustrativo · arraste para olhar';root.querySelector('#world-walk').disabled=true;root.querySelector('#room-hotspots')?.remove();const spots=document.createElement('div');spots.id='room-hotspots';spots.innerHTML='<button id="floor-switch" aria-label="Subir ao segundo andar">↑<span>Segundo andar</span></button><button aria-label="Moradores desta casa" data-room-spot="residents">↔<span>Pessoas</span></button><button aria-label="Vagas desta casa" data-room-spot="parking">▤<span>Vagas</span></button>';shell.append(spots);spots.querySelectorAll('[data-room-spot]').forEach(b=>b.onclick=()=>onPage(b.dataset.roomSpot,id));spots.querySelector('#floor-switch').onclick=()=>{upperFloor=!upperFloor;const b=spots.querySelector('#floor-switch');b.innerHTML=upperFloor?'↓<span>Térreo</span>':'↑<span>Segundo andar</span>';b.setAttribute('aria-label',upperFloor?'Descer ao térreo':'Subir ao segundo andar');root.querySelector('#world-camera-caption').textContent=upperFloor?'Superior · quartos e banheiro · ilustrativo':'Térreo · sala, cozinha e serviço · ilustrativo';};}
 function select(o){if(!o)return;options.onContext?.();if(o.type==='house'&&houses.some(h=>h.id===o.id)){enterHouse(o.id);onHouse(o.id);return;}const house=houses.find(h=>h.id===o.id),allowed=o.type!=='house'||!!house;ctx.hidden=false;ctx.innerHTML=`<div class="world-context-top"><span>${o.type==='house'?'UNIDADE RESIDENCIAL':'ESPAÇO DO CONDOMÍNIO'}</span><button id="context-close" aria-label="Fechar detalhes">${icon('close')}</button></div><div class="context-art">${icon(o.type==='gate'?'key':o.type==='house'?'home':'map')}</div><h2>${safe(o.title)}</h2><p>${safe(o.description)}</p>${house?`<div class="context-facts"><span>${house.rooms} quartos</span><span>${house.area} m²</span><span>${house.parking} vagas</span></div>`:''}<div class="context-permission">${icon('key')} ${allowed?'Opções conforme seu perfil':'Ficha privada fora do seu escopo'}</div><div class="context-actions">${o.type==='house'?(allowed?`<button id="object-details">${icon('home')} Ficha da casa ${icon('arrow')}</button>${role!=='portaria'?`<button id="object-stays">${icon('people')} Consultar estadias ${icon('arrow')}</button>`:''}${(can(user,'stays')||['proprietario','imobiliaria'].includes(role))?`<button id="object-new">${icon('plus')} Nova estadia ${icon('arrow')}</button>`:''}`:'<p>Você pode explorar o cenário, mas os dados e ações desta casa não estão disponíveis para o perfil selecionado.</p>'):o.type==='gate'?( (can(user,'stays')||role==='portaria')?`<button id="object-access">${icon('key')} Consultar autorizações ${icon('arrow')}</button>`:'<p>Solicitações de acesso são acompanhadas pela gestão e portaria.</p>'):`<p>Consulte as dependências configuradas pela gestão no menu Reservas. O cenário continua ilustrativo.</p>${can(user,'tasks')?`<button id="object-tasks">${icon('task')} Consultar tarefas ${icon('arrow')}</button>`:''}`}</div>`;
 ctx.querySelector('#context-close').onclick=()=>ctx.hidden=true;ctx.querySelector('#object-details')?.addEventListener('click',()=>onHouse(o.id));ctx.querySelector('#object-stays')?.addEventListener('click',()=>onPage('stays'));ctx.querySelector('#object-new')?.addEventListener('click',()=>onNewStay(o.id));ctx.querySelector('#object-access')?.addEventListener('click',()=>onPage('access'));ctx.querySelector('#object-tasks')?.addEventListener('click',()=>onPage('tasks'));}
 function showList(){options.onContext?.();ctx.hidden=false;ctx.innerHTML=`<div class="world-context-top"><span>LOCAIS DO CONDOMÍNIO</span><button id="context-close" aria-label="Fechar lista">${icon('close')}</button></div><h2>Para onde vamos?</h2><p>Escolha um local. Os dados disponíveis dependem do seu perfil.</p><div class="context-actions">${(sceneReady?objects:[...Array.from({length:14},(_,i)=>({id:'c'+String(i+1).padStart(2,'0'),title:'Casa '+String(i+1).padStart(2,'0'),type:'house'})),{id:'pool',title:'Piscina',type:'space'}]).map(o=>`<button data-list-id="${o.id}">${icon(o.type==='house'?'home':'map')}${safe(o.title)}${icon('arrow')}</button>`).join('')}</div>`;ctx.querySelector('#context-close').onclick=()=>ctx.hidden=true;ctx.querySelectorAll('[data-list-id]').forEach(b=>b.onclick=()=>{if(!sceneReady){onPage(b.dataset.listId.startsWith('c')?'houses':'roadmap');return;}select(objects.find(o=>o.id===b.dataset.listId));});}
 function reset(){root.querySelector('#room-hotspots')?.remove();interiorHouse=null;labels.hidden=false;shell.classList.remove('is-interior');exitButton.hidden=true;root.querySelector('#world-walk').disabled=false;root.querySelector('.world-location strong').textContent='Alameda central';options.onExitHouse?.();yaw=.22;pitch=.92;distance=106;tx=0;tz=-8;walk=false;document.querySelector('#world-walk').classList.remove('selected');document.querySelector('#world-camera-caption').textContent='Visão aérea · arraste para explorar';}
 canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};moved=false;canvas.setPointerCapture(e.pointerId);canvas.focus();};
 canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;yaw-=dx*.006;if(!walk)pitch=Math.max(.25,Math.min(1.35,pitch+dy*.005));drag={x:e.clientX,y:e.clientY};};
 canvas.onpointerup=e=>{drag=null;if(moved||interiorHouse)return;const r=canvas.getBoundingClientRect();const hits=objects.map(o=>({o,p:project(o)})).filter(({p})=>p.visible&&Math.hypot(p.x-(e.clientX-r.left),p.y-(e.clientY-r.top))<65).sort((a,b)=>a.p.depth-b.p.depth);if(hits.length)select(hits[0].o);};
 canvas.onpointercancel=()=>drag=null;
 canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(interiorHouse?4:20,Math.min(interiorHouse?9:140,distance+e.deltaY*.035));},{passive:false});
 canvas.onkeydown=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','+','-','Escape'].includes(e.key))e.preventDefault();if(e.key==='Escape')ctx.hidden=true;if(e.key==='+')distance=Math.max(interiorHouse?4:20,distance-1);if(e.key==='-')distance=Math.min(interiorHouse?9:140,distance+1);const forward=['ArrowUp','w'].includes(e.key)?-1:['ArrowDown','s'].includes(e.key)?1:0,side=['ArrowLeft','a'].includes(e.key)?-1:['ArrowRight','d'].includes(e.key)?1:0;tx=Math.max(-16,Math.min(16,tx+forward*Math.sin(yaw)+side*Math.cos(yaw)));tz=Math.max(-51,Math.min(32,tz+forward*Math.cos(yaw)-side*Math.sin(yaw)));};
 root.querySelector('#world-plus').onclick=()=>distance=Math.max(interiorHouse?4:20,distance-1);root.querySelector('#world-minus').onclick=()=>distance=Math.min(interiorHouse?9:140,distance+1);root.querySelector('#world-reset').onclick=reset;root.querySelector('#world-list').onclick=showList;
 root.querySelector('#world-walk').onclick=()=>{walk=!walk;if(walk){tx=0;tz=29;yaw=0;}root.querySelector('#world-walk').classList.toggle('selected',walk);root.querySelector('#world-camera-caption').textContent=walk?'Passeio · setas ou W A S D para caminhar':'Visão aérea · arraste para explorar';root.querySelector('#world-hint').textContent=walk?'Arraste para olhar · setas ou W A S D para caminhar · toque nos marcadores':'Arraste para girar · role para aproximar · clique para explorar';};
 root.querySelector('#world-help').onclick=()=>{options.onContext?.();ctx.hidden=false;ctx.innerHTML=`<div class="world-context-top"><span>NAVEGAÇÃO</span><button id="context-close" aria-label="Fechar ajuda">${icon('close')}</button></div><h2>Explore no seu ritmo.</h2><p>Arraste o cenário para girar a câmera. Use + e − para aproximar. Toque nos marcadores para abrir opções do local.</p><p>No modo Passear, use as setas ou W A S D para se mover. A lista de locais oferece navegação por teclado e celular.</p><p>Os perfis são simulados. A distribuição segue as informações do Chandra; medidas, interiores e detalhes são ilustrativos.</p>`;ctx.querySelector('#context-close').onclick=()=>ctx.hidden=true;};
 sceneReady=true;
 frame=requestAnimationFrame(draw);
 const dispose=()=>{cancelAnimationFrame(frame);gl.deleteBuffer(buffer);gl.deleteProgram(program);};dispose.enterHouse=enterHouse;dispose.exitHouse=reset;return dispose;
}
