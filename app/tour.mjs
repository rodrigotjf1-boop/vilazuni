import {randomUUID} from 'node:crypto';
import {can,housingUser} from './permissions.mjs';
import {scopedHouses} from './domain.mjs';
import {TOUR_VISUAL,TOUR_POINTS} from './tour-layout.mjs';

const canFacilities=u=>can(u,'facilities')||housingUser(u);
const linksFor=(s,u)=>(s.tourLinks||[]).filter(l=>l.tenant===u.tenant);
const action=(page,label,id=null)=>({page,label,id});
function housePlace(s,u,h,point){
 const allowed=scopedHouses(s,u).some(x=>x.id===h.id),structure=allowed?{number:h.number,parking:h.parking,parkingType:h.parkingType,...(u.role!=='portaria'?{type:h.type,floors:h.floors,rooms:h.rooms,area:h.area??null}:{} )}:null,actions=[];
 if(allowed){
  if(can(u,'residents')||['proprietario','imobiliaria'].includes(u.role))actions.push(action('residents','Moradores e vínculos',h.id));
  if(can(u,'stays')||['proprietario','imobiliaria'].includes(u.role)){actions.push(action('stays','Estadias desta casa',h.id),action('new','Receber uma estadia',h.id));}
  if(u.role==='portaria')actions.push(action('access','Autorizações desta casa',h.id));
  actions.push(action('parking','Vagas desta casa',h.id));
  if(u.role==='ocupante')actions.push(action('incidents','Minhas ocorrências'),action('myCharges','Minhas cobranças'),action('parcels','Minhas encomendas'));
 }
 return {id:point?.id||'house:'+h.id,sceneId:point?.id||null,title:point?.title||'Casa '+h.number,kind:'house',description:point?.description||'Localização no cenário ainda não definida',map:point?{x:point.mapX,y:point.mapY}:null,houseId:allowed?h.id:null,access:allowed?'allowed':'exterior',status:allowed?'Ficha conforme seu perfil':'Somente exterior ilustrativo',structure,interior:!!point&&allowed&&u.role!=='portaria',actions};
}
function facilityPlace(s,u,f,point){
 const allowed=canFacilities(u),link=point?linksFor(s,u).find(l=>l.pointId===point.id):null;
 return {id:point?.id||'facility:'+f.id,sceneId:point?.id||null,title:allowed?f.name:point?.title||'Dependência',kind:'facility',description:point?.description||'Localização no cenário ainda não vinculada',map:point?{x:point.mapX,y:point.mapY}:null,access:allowed?'allowed':'exterior',status:allowed?(f.active?'Disponível para solicitar':'Interditada'):'Ficha fora do seu escopo',active:allowed?f.active:null,facility:allowed?{id:f.id,name:f.name,capacity:f.capacity,opens:f.opens,closes:f.closes,maxHours:f.maxHours,rules:f.rules}:null,actions:allowed?[action('facilities',f.active?'Regras, agenda e reserva':'Consultar regras e interdição',f.id)]:[],...(point&&can(u,'facilities')?{linkVersion:link?.version||0,linkedFacilityId:f.id}:{} )};
}
export function tourView(s,u){
 const illustrated=u.tenant===TOUR_VISUAL.tenant,points=illustrated?TOUR_POINTS:[],houses=s.houses.filter(h=>h.tenant===u.tenant),facilities=(s.facilities||[]).filter(f=>f.tenant===u.tenant),links=linksFor(s,u),places=[];
 for(const point of points){
  if(point.kind==='house'){const h=houses.find(h=>h.id===point.id);if(h)places.push(housePlace(s,u,h,point));continue;}
  if(point.kind==='gate'){places.push({...point,sceneId:point.id,map:{x:point.mapX,y:point.mapY},access:can(u,'stays')||u.role==='portaria'?'allowed':'exterior',status:'Sem controle de portão conectado',actions:can(u,'stays')||u.role==='portaria'?[action('access','Consultar autorizações')]:[]});continue;}
  const link=links.find(l=>l.pointId===point.id),f=facilities.find(f=>f.id===link?.facilityId);
  places.push(f?facilityPlace(s,u,f,point):{id:point.id,sceneId:point.id,title:point.title,kind:'facility',description:point.description,map:{x:point.mapX,y:point.mapY},access:'exterior',status:'Dependência ainda não vinculada',active:null,facility:null,actions:[],...(can(u,'facilities')?{linkVersion:link?.version||0,linkedFacilityId:null}:{} )});
 }
 for(const h of houses.filter(h=>!points.some(p=>p.kind==='house'&&p.id===h.id)))if(scopedHouses(s,u).some(x=>x.id===h.id))places.push(housePlace(s,u,h,null));
 if(canFacilities(u))for(const f of facilities.filter(f=>!links.some(l=>l.facilityId===f.id&&points.some(p=>p.id===l.pointId))))places.push(facilityPlace(s,u,f,null));
 return {visual:illustrated?structuredClone(TOUR_VISUAL):null,canLink:illustrated&&can(u,'facilities'),places};
}
export function tourPlace(s,u,id){
 const place=tourView(s,u).places.find(p=>p.id===id);if(!place)throw Object.assign(Error('Local indisponível neste condomínio ou perfil.'),{status:403});
 return {...place,...(can(u,'facilities')&&place.kind==='facility'&&place.sceneId?{linkHistory:structuredClone(linksFor(s,u).find(l=>l.pointId===place.sceneId)?.history||[])}:{} )};
}
export function linkTourFacility(s,u,input,now=Date.now()){
 if(!can(u,'facilities')||u.tenant!==TOUR_VISUAL.tenant)throw Error('Vincular locais exige gestão de dependências do piloto.');
 const point=TOUR_POINTS.find(p=>p.id===input.pointId&&p.kind==='facility'),current=linksFor(s,u).find(l=>l.pointId===input.pointId);
 if(!point)throw Error('Selecione um marcador de dependência do cenário.');if(!Number.isInteger(input.version)||input.version!==(current?.version||0))throw Error('O vínculo mudou. Atualize antes de continuar.');
 const facilityId=input.facilityId||null,facility=(s.facilities||[]).find(f=>f.tenant===u.tenant&&f.id===facilityId);
 if(facilityId&&!facility)throw Error('Dependência fora deste condomínio.');if(facilityId&&linksFor(s,u).some(l=>l.pointId!==point.id&&l.facilityId===facilityId))throw Error('Dependência já vinculada a outro marcador. Retire o vínculo anterior primeiro.');
 if((current?.facilityId||null)===facilityId)throw Error('O marcador já está nessa situação.');
 const reason=typeof input.reason==='string'?input.reason.trim():'';if(reason.length<3||reason.length>500)throw Error('Informe motivo de 3 a 500 caracteres.');
 const record=current||{id:randomUUID(),tenant:u.tenant,pointId:point.id,version:0,history:[]},before=record.facilityId||null;
 Object.assign(record,{facilityId,version:record.version+1});record.history.push({at:new Date(now).toISOString(),actor:u.name,actorId:u.id,reason,before,after:facilityId,action:facilityId?'Dependência vinculada ao marcador':'Vínculo do marcador retirado'});s.tourLinks??=[];if(!current)s.tourLinks.push(record);return structuredClone(record);
}
