import {can,ROLES,ROLE_NAMES} from './permissions.mjs';
import {authorizedCaretakerHouses,canViewTenantContacts,canViewHousehold,householdStayView} from './household-access.mjs';
import {portraitAttachment} from './community.mjs';
export {ROLES,ROLE_NAMES};
export function seed() {
  return {
    version:1,
    houses:Array.from({length:14},(_,i)=>{const n=String(i+1).padStart(2,'0');return {id:'c'+n,tenant:'chandra',number:n,type:'Sobrado',floors:2,rooms:2,area:null,owners:i===0?['Ana Demo','Bruno Demo']:i===1?['Ana Demo']:i===2?['Carla Demo']:['Proprietário Demo '+n],parking:i===0||i===2?2:1,parkingType:'Quantidade demonstrativa · confirmar',side:i<7?'Direita':'Esquerda',groundFloor:'Sala, cozinha e área de serviço',upperFloor:'Quartos e banheiro'};}),
    stays:[{id:'e01',tenant:'chandra',houseId:'c03',responsible:'Marina Exemplo',contact:'Contato fictício não informado',source:'Booking',start:'2026-10-18T15:00:00-03:00',end:'2026-10-22T11:00:00-03:00',people:['Marina Exemplo','Paulo Exemplo','Lia Exemplo'],vehicles:['DEMO-03'],status:'approved',createdAt:'2026-10-17T12:00:00Z'},
      {id:'e02',tenant:'chandra',houseId:'c01',responsible:'João Exemplo',contact:'Contato fictício não informado',source:'Airbnb',start:'2026-10-20T15:00:00-03:00',end:'2026-10-24T11:00:00-03:00',people:['João Exemplo','Bia Exemplo'],vehicles:[],status:'pending',createdAt:'2026-10-17T13:00:00Z'}],
    tasks:[{id:'t01',tenant:'chandra',title:'Conferir iluminação da entrada',area:'Portaria',owner:'Zeladoria',due:'2026-10-17',status:'doing'},
      {id:'t02',tenant:'chandra',title:'Revisar filtro da piscina',area:'Piscina',owner:'Zeladoria',due:'2026-10-16',status:'todo'},
      {id:'t03',tenant:'chandra',title:'Inventário de materiais de limpeza',area:'Depósito',owner:'Gestão',due:'2026-10-19',status:'todo'}],
    audit:[]
  };
}
export function actor(role='sindico') {
  if(!ROLES.includes(role)) throw new Error('Perfil inválido.');
  return {role,tenant:'chandra',houses:role==='proprietario'?['c01','c02']:role==='imobiliaria'?['c03']:[],name:role==='sindico'?'Luiza Demo':role==='proprietario'?'Ana Demo':role==='imobiliaria'?'Agência Demo':'Equipe Demo'};
}
export function scopedHouses(state,user,now=Date.now()) {
  const caretakerHouses=new Set(authorizedCaretakerHouses(state,user,now));
  return state.houses.filter(h=>h.tenant===user.tenant && (can(user,'residents')||can(user,'stays')||user.role==='portaria'||['proprietario','imobiliaria','ocupante','temporario'].includes(user.role)&&user.houses?.includes(h.id)||caretakerHouses.has(h.id)));
}
export function scopedStays(state,user,now=Date.now()) {
  if(!can(user,'stays')&&!['proprietario','imobiliaria','portaria'].includes(user.role)&&!authorizedCaretakerHouses(state,user,now).length)return [];
  const ids=new Set(scopedHouses(state,user,now).map(h=>h.id));
  return state.stays.filter(s=>s.tenant===user.tenant&&ids.has(s.houseId));
}
export function visibleStays(state,user,now=Date.now()){return scopedStays(state,user,now).map(stay=>householdStayView(state,user,stay,now));}
export function readStayPhoto(state,user,id,version,now=Date.now()){
 const stay=state.stays.find(s=>s.id===id&&s.tenant===user.tenant);
 if(!stay||!canViewHousehold(state,user,stay.houseId,now)||!canViewTenantContacts(state,user,stay.houseId,now)||!stay.photo||String(version)!==String(stay.version||1))throw Object.assign(Error('Foto indisponível.'),{status:403});
 return {mime:stay.photo.mime,bytes:Buffer.from(stay.photo.data,'base64')};
}
function canHouse(state,user,houseId,now){return scopedHouses(state,user,now).some(h=>h.id===houseId);}
function contactPhone(value){
 if(value==null||value==='')return '';
 if(typeof value!=='string')throw new Error('Telefone inválido.');
 const digits=value.replace(/[\s()+.-]/g,'');
 if(!/^\d{10,15}$/.test(digits))throw new Error('Informe telefone com DDI e DDD.');
 return digits;
}
function contactEmail(value){
 if(value==null||value==='')return '';
 if(typeof value!=='string'||value.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new Error('Informe um e-mail válido.');
 return value.trim();
}
function audit(state,user,action,id,now){state.audit.unshift({id:crypto.randomUUID(),tenant:user.tenant,actor:user.name,action,resource:id,at:new Date(now).toISOString()});}
export function dateBRLocal(value) {
  // A demonstração usa explicitamente o fuso do piloto, não o do dispositivo.
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Informe data e horário completos.');
  const result=value+':00-03:00';
  const timestamp=Date.parse(result);
  if(!Number.isFinite(timestamp)||new Date(timestamp-3*3600000).toISOString().slice(0,16)!==value) throw new Error('Data inválida.');
  return result;
}
export function createStay(state,user,input,now=Date.now()) {
  if(!(can(user,'stays')||['proprietario','imobiliaria'].includes(user.role))||!canHouse(state,user,input.houseId,now)) throw new Error('Sem permissão para cadastrar nesta casa.');
  const responsible=String(input.responsible||'').trim();
  const contact=String(input.contact||'').trim(),phone=contactPhone(input.phone),whatsapp=contactPhone(input.whatsapp),email=contactEmail(input.email),rentalKind=input.rentalKind??'seasonal';
  if(!['daily','seasonal'].includes(rentalKind))throw new Error('Selecione diária ou temporada.');
  const photo=input.photo==null?null:portraitAttachment(input.photo);
  const people=[...new Set((input.people||[]).map(p=>String(p).trim()).filter(Boolean))];
  const vehicles=[...new Set((input.vehicles||[]).map(v=>String(v).trim().toUpperCase()).filter(Boolean))];
  if(responsible.length<3||responsible.length>120)throw new Error('Informe o nome do responsável (3 a 120 caracteres).');
  if((!contact&&!phone&&!whatsapp&&!email)||contact.length>200)throw new Error('Informe um contato de até 200 caracteres ou um telefone, WhatsApp ou e-mail.');
  if(!people.length||people.length>30||people.some(p=>p.length>120))throw new Error('Informe de 1 a 30 ocupantes, com nomes de até 120 caracteres.');
  if(!people.some(p=>p.toLocaleLowerCase('pt-BR')===responsible.toLocaleLowerCase('pt-BR')))throw new Error('Nesta demonstração, inclua o responsável presente na relação de ocupantes.');
  if(vehicles.length>10||vehicles.some(v=>v.length>20))throw new Error('Informe até 10 placas, com até 20 caracteres.');
  const start=dateBRLocal(input.start),end=dateBRLocal(input.end);
  if(Date.parse(end)<=Date.parse(start))throw new Error('A saída deve ser posterior à entrada.');
  if(Date.parse(end)<=Number(now))throw new Error('A estadia deve terminar após o horário atual da demonstração.');
  if(!['Airbnb','Booking','Direta','Outra'].includes(input.source))throw new Error('Selecione uma origem válida.');
  const stay={id:crypto.randomUUID(),tenant:user.tenant,houseId:input.houseId,responsible,contact,phone,whatsapp,email,rentalKind,photo,version:1,people,vehicles,source:input.source,start,end,status:'pending',createdAt:new Date(now).toISOString()};
  state.stays.push(stay);audit(state,user,'Estadia enviada para análise',stay.id,now);
  const house=state.houses.find(h=>h.id===input.houseId&&h.tenant===user.tenant);
  const warnings=[];
  if(vehicles.length>house.parking) warnings.push('Veículos acima do limite simultâneo da casa; cadastro não garante estacionamento.');
  if(state.stays.some(s=>s.id!==stay.id&&s.tenant===user.tenant&&s.houseId===stay.houseId&&!['cancelled','rejected'].includes(s.status)&&Date.parse(s.start)<Date.parse(end)&&Date.parse(start)<Date.parse(s.end)))warnings.push('Existe outro período sobreposto nesta casa; conferir antes de autorizar.');
  return {stay,warnings};
}
export function changeStay(state,user,id,status,reason,now=Date.now()) {
  const stay=scopedStays(state,user,now).find(s=>s.id===id);
  if(!stay)throw new Error('Estadia indisponível.');
  const transition=stay.status==='pending'?['approved','rejected','cancelled']:stay.status==='approved'?['cancelled']:[];
  if(!transition.includes(status))throw new Error('Alteração de situação inválida.');
  if(status!=='cancelled'&&!can(user,'stays'))throw new Error('Somente a gestão pode analisar esta solicitação.');
  if(status==='cancelled'&&!(can(user,'stays')||['proprietario','imobiliaria'].includes(user.role)))throw new Error('Sem permissão para cancelar.');
  if(!String(reason||'').trim())throw new Error('Informe o motivo da decisão.');
  if(status==='approved'&&Date.parse(stay.end)<=Number(now))throw new Error('Não é possível autorizar uma estadia já expirada.');
  stay.status=status;stay.decisionReason=String(reason).trim().slice(0,500);
  audit(state,user,`${status==='approved'?'Estadia autorizada':status==='rejected'?'Estadia recusada':'Estadia cancelada'}: ${stay.decisionReason}`,id,now);
}
export function authorizationStatus(stay,now=Date.now()) {
  if(stay.status!=='approved')return 'Sem autorização';
  if(Number(now)>=Date.parse(stay.end))return 'Expirada';
  if(Number(now)<Date.parse(stay.start))return 'Agendada';
  return 'Vigente';
}
export function changeTask(state,user,id,status,now=Date.now()) {
  if(!(can(user,'tasks')||user.role==='zelador'))throw new Error('Alteração de tarefas disponível apenas à gestão e à zeladoria.');
  const task=state.tasks.find(t=>t.id===id&&t.tenant===user.tenant);
  if(!task||!['todo','doing','review','done'].includes(status))throw new Error('Tarefa ou situação inválida.');
  task.status=status;audit(state,user,'Tarefa atualizada para '+status,id,now);
}
