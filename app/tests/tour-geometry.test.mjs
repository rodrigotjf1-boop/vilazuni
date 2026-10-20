import {test} from 'node:test';import assert from 'node:assert/strict';
import {TOUR_POINTS,moveAlongWalkway,walkHeight} from '../tour-layout.mjs';
import {multiply,viewMatrix,perspective,transform,screenRay,pickMesh,createPickIndex,rayTriangle,inverse} from '../tour-geometry.mjs';
const triangle=(z,x=0)=>[x-1,-1,z,1,1,1,x+1,-1,z,1,1,1,x,1,z,1,1,1];
test('raio da câmera corresponde ao ponto projetado e matrizes degeneradas não selecionam',()=>{
 const matrix=multiply(perspective(1.5),viewMatrix([0,4,10],[0,0,0])),point=[1,1,0,1],p=transform(matrix,point),ray=screenRay(matrix,(p[0]/p[3]*.5+.5)*900,(.5-p[1]/p[3]*.5)*600,900,600),t=rayTriangle(ray,[0,0,0],[2,0,0],[1,2,0]);assert.ok(t!==null);const hit=ray.origin.map((v,i)=>v+ray.direction[i]*t);assert.ok(Math.hypot(hit[0]-1,hit[1]-1,hit[2])<.0001);assert.equal(inverse(new Float32Array(16)),null);assert.equal(screenRay(matrix,0,0,0,0),null);
});
test('seleção usa a malha mais próxima e não escolhe casa por proximidade de marcador',()=>{
 const vertices=new Float32Array([...triangle(0),...triangle(2)]),ranges=[{id:'atrás',start:0,count:3},{id:'frente',start:3,count:3}],ray={origin:[0,0,10],direction:[0,0,-1]};assert.equal(pickMesh(vertices,ranges,ray),'frente');assert.equal(createPickIndex(vertices,6,ranges)(ray),'frente');assert.equal(pickMesh(vertices,ranges,{origin:[2,0,10],direction:[0,0,-1]}),null);
});
test('solo e objetos opacos ocultam alvos; clicar fora da malha ou no céu não abre ficha',()=>{
 const vertices=new Float32Array([...triangle(0),...triangle(3)]),pick=createPickIndex(vertices,6,[{id:'casa',start:0,count:3}]);assert.equal(pick({origin:[0,0,10],direction:[0,0,-1]}),null);assert.equal(pick({origin:[0,0,10],direction:[0,1,0]}),null);assert.equal(pick({origin:[20,0,10],direction:[0,0,-1]}),null);assert.equal(pick(null),null);
});
test('caminhada permanece na alameda/escadas e para antes da piscina e das casas',()=>{
 let p={x:0,z:29,yaw:0};for(let i=0;i<1000;i++)p=moveAlongWalkway(p,-1,1);assert.equal(p.z,-45);assert.equal(p.x,2.1);for(let i=0;i<1000;i++)p=moveAlongWalkway({...p,yaw:0},1,-1);assert.equal(p.z,30);assert.equal(p.x,-2.1);assert.ok(TOUR_POINTS.filter(p=>p.kind==='house').every(p=>Math.abs(p.x)>2.1));
 const straight=moveAlongWalkway({x:0,z:0,yaw:0},-1,0),diagonal=moveAlongWalkway({x:0,z:0,yaw:0},-1,1);assert.ok(Math.abs(Math.hypot(straight.x,straight.z)-Math.hypot(diagonal.x,diagonal.z))<1e-9);
});
test('alturas das duas escadas são contínuas e mapa preserva ordem/posição aprovadas',()=>{
 for(const z of [-27,-32.4,-41,-44.3])assert.ok(Math.abs(walkHeight(z+.000001)-walkHeight(z-.000001))<.00001);assert.equal(walkHeight(0),.15);assert.equal(walkHeight(-38),3.15);assert.equal(walkHeight(-45),6.15);
 const find=id=>TOUR_POINTS.find(p=>p.id===id);assert.ok(find('c01').mapX>50&&find('c08').mapX<50);assert.ok(find('c01').mapY>find('c07').mapY);assert.ok(find('bbq').mapY<find('c14').mapY&&find('bbq').mapY>find('party').mapY);assert.ok(find('pool').mapY<find('games').mapY);
});
