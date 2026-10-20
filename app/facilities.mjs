import {randomUUID} from 'node:crypto';import {can,housingUser} from './permissions.mjs';import {dateBRLocal} from './domain.mjs';
function text(v,label,max=160){if(typeof v!=='string'||v.trim().length<3||v.trim().length>max)throw Error(`${label}: use entre 3 e ${max} caracteres.`);return v.trim();}
const allowed=u=>can(u,'facilities')||housingUser(u);
const overlap=(a,b)=>Date.parse(a.start)<Date.parse(b.end)&&Date.parse(b.start)<Date.parse(a.end);
const holding=r=>['pending','approved'].includes(r.status);
function hour(v){if(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('Informe um horário válido.');return v;}
export function visibleFacilities(state,user){return allowed(user)?structuredClone((state.facilities||[]).filter(f=>f.tenant===user.tenant)):[];}
export function visibleReservations(state,user){if(!allowed(user))return [];return (state.reservations||[]).filter(r=>r.tenant===user.tenant).flatMap(r=>can(user,'facilities')||r.authorId===user.id?[structuredClone(r)]:holding(r)?[{id:r.id,facilityId:r.facilityId,start:r.start,end:r.end,status:r.status}]:[]);}
export function createFacility(state,user,input,now=Date.now()){
 if(!can(user,'facilities'))throw Error('Somente a gestão delegada de dependências cadastra espaços.');
 const name=text(input.name,'Nome'),rules=text(input.rules,'Regras de uso',2000),opens=hour(input.opens),closes=hour(input.closes);
 if(opens>=closes)throw Error('O fechamento deve ser posterior à abertura no mesmo dia.');
 if(!Number.isInteger(input.capacity)||input.capacity<1||input.capacity>1000||!Number.isInteger(input.maxHours)||input.maxHours<1||input.maxHours>24)throw Error('Capacidade de 1 a 1000 e duração máxima de 1 a 24 horas.');
 if((state.facilities||[]).some(f=>f.tenant===user.tenant&&f.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))throw Error('Espaço já cadastrado.');
 const f={id:randomUUID(),tenant:user.tenant,name,rules,opens,closes,capacity:input.capacity,maxHours:input.maxHours,active:true,version:0,history:[{at:new Date(now).toISOString(),actor:user.name,action:'Espaço cadastrado'}]};state.facilities??=[];state.facilities.push(f);return structuredClone(f);
}
export function toggleFacility(state,user,input,now=Date.now()){
 if(!can(user,'facilities'))throw Error('Sem permissão para interditar espaços.');const f=(state.facilities||[]).find(f=>f.id===input.id&&f.tenant===user.tenant);if(!f)throw Error('Espaço indisponível.');if(!Number.isInteger(input.version)||input.version!==f.version)throw Error('O espaço mudou. Atualize antes de continuar.');const reason=text(input.reason,'Motivo',500);if(typeof input.active!=='boolean'||input.active===f.active)throw Error('Alteração inválida.');f.active=input.active;f.version++;f.history.push({at:new Date(now).toISOString(),actor:user.name,action:(f.active?'Espaço reaberto':'Espaço interditado')+' · '+reason});
 if(!f.active)for(const r of state.reservations||[])if(r.tenant===user.tenant&&r.facilityId===f.id&&holding(r)&&Date.parse(r.end)>now){r.status='cancelled';r.version++;r.history.push({at:new Date(now).toISOString(),actor:user.name,action:'Reserva cancelada por interdição',reason});}
 return structuredClone(f);
}
export function createReservation(state,user,input,now=Date.now()){
 if(!allowed(user))throw Error('Perfil sem permissão para reservar.');const f=(state.facilities||[]).find(f=>f.id===input.facilityId&&f.tenant===user.tenant&&f.active);if(!f)throw Error('Espaço indisponível.');
 const h=state.houses.find(h=>h.id===input.houseId&&h.tenant===user.tenant&&(can(user,'facilities')||user.houses?.includes(h.id)));if(!h)throw Error('Casa fora do seu vínculo.');
 const start=dateBRLocal(input.start),end=dateBRLocal(input.end);if(Date.parse(start)<=now||Date.parse(end)<=Date.parse(start))throw Error('Escolha um período futuro com término após o início.');
 if(input.start.slice(0,10)!==input.end.slice(0,10)||input.start.slice(11)<f.opens||input.end.slice(11)>f.closes||Date.parse(end)-Date.parse(start)>f.maxHours*3600000)throw Error('Respeite o horário, duração máxima e o mesmo dia de uso.');
 if(!Number.isInteger(input.people)||input.people<1||input.people>f.capacity)throw Error('Quantidade de pessoas fora da capacidade do espaço.');if(input.acceptRules!==true)throw Error('Confirme a ciência das regras.');
 if((state.reservations||[]).some(r=>r.tenant===user.tenant&&r.facilityId===f.id&&holding(r)&&overlap(r,{start,end})))throw Error('Já existe reserva ou solicitação neste período.');
 const r={id:randomUUID(),tenant:user.tenant,facilityId:f.id,houseId:h.id,authorId:user.id,author:user.name,people:input.people,start,end,status:'pending',rules:f.rules,version:1,history:[{at:new Date(now).toISOString(),actor:user.name,action:'Reserva solicitada',reason:'Regras de uso aceitas'}]};state.reservations??=[];state.reservations.push(r);return structuredClone(r);
}
export function decideReservation(state,user,input,now=Date.now()){
 const r=(state.reservations||[]).find(r=>r.id===input.id&&r.tenant===user.tenant&&(can(user,'facilities')||allowed(user)&&r.authorId===user.id));if(!r)throw Error('Reserva indisponível.');
 if(!Number.isInteger(input.version)||input.version!==r.version)throw Error('A reserva mudou. Atualize antes de continuar.');const reason=text(input.reason,'Motivo',500);
 const transitions=r.status==='pending'?['approved','rejected','cancelled']:r.status==='approved'?['cancelled']:[];if(!transitions.includes(input.status)||input.status!=='cancelled'&&!can(user,'facilities'))throw Error('Decisão não permitida.');
 if(Date.parse(r.end)<=now)throw Error('O período desta reserva já terminou.');
 if(input.status==='approved'){
  const f=(state.facilities||[]).find(f=>f.id===r.facilityId&&f.tenant===user.tenant&&f.active);if(!f)throw Error('Espaço indisponível.');
  if((state.reservations||[]).some(other=>other.id!==r.id&&other.tenant===user.tenant&&other.facilityId===r.facilityId&&holding(other)&&overlap(r,other)))throw Error('Conflito de período.');
 }
 r.status=input.status;r.version++;r.history.push({at:new Date(now).toISOString(),actor:user.name,action:({approved:'Reserva aprovada',rejected:'Reserva recusada',cancelled:'Reserva cancelada'})[r.status],reason});return structuredClone(r);
}
