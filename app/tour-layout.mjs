// Geometria ilustrativa do piloto, sem dados pessoais ou medidas levantadas em campo.
export const TOUR_VISUAL={id:'chandra-illustrative-v1',tenant:'chandra',kind:'illustrative3d',updatedOn:'2026-10-19',label:'Modelo 3D ilustrativo',captureDate:null};
export const TOUR_POINTS=[
 ...Array.from({length:14},(_,i)=>{const n=i+1,right=n<=7;return {id:'c'+String(n).padStart(2,'0'),title:'Casa '+String(n).padStart(2,'0'),kind:'house',x:right?8:-8,y:6.3,z:27-((n-1)%7)*8,mapX:right?72:28,mapY:80-((n-1)%7)*7,description:'Dois andares · '+(right?'direita':'esquerda')+' de quem entra'};}),
 {id:'bbq',title:'Churrasqueira',kind:'facility',x:-19,y:3.6,z:-28,mapX:25,mapY:31,description:'Junto à casa 14, antes do salão de festas'},
 {id:'party',title:'Salão de festas',kind:'facility',x:-10,y:7.8,z:-38,mapX:25,mapY:22,description:'Primeiro patamar · lado esquerdo'},
 {id:'games',title:'Salão de jogos',kind:'facility',x:10,y:7.8,z:-38,mapX:75,mapY:22,description:'Primeiro patamar · lado direito'},
 {id:'pool',title:'Piscina',kind:'facility',x:0,y:8,z:-49,mapX:50,mapY:10,description:'Patamar superior · após o segundo lance de escadas'},
 {id:'gate',title:'Entrada e portaria',kind:'gate',x:0,y:4.5,z:33,mapX:50,mapY:92,description:'Entrada · casas 01–07 à direita, 08–14 à esquerda'}
];
export const normalizeSearch=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export function filterTourPlaces(places,{query='',kind='all',accessible=false}={}){
 const term=normalizeSearch(query);return places.filter(p=>(kind==='all'||p.kind===kind)&&(!accessible||p.access==='allowed')&&(!term||normalizeSearch(p.title+' '+p.description).includes(term)));
}
export function walkHeight(z){return z>=-27?.15:z>=-32.4?.15+(-27-z)/5.4*3:z>=-41?3.15:z>=-44.3?3.15+(-41-z)/3.3*3:6.15;}
export function moveAlongWalkway({x,z,yaw},forward,side,step=.65){
 const length=Math.hypot(forward,side)||1;
 return {x:Math.max(-2.1,Math.min(2.1,x+(forward*Math.sin(yaw)+side*Math.cos(yaw))*step/length)),z:Math.max(-45,Math.min(30,z+(forward*Math.cos(yaw)-side*Math.sin(yaw))*step/length)),yaw};
}
