import {can} from './permissions.mjs';
import {randomUUID} from 'node:crypto';
import {scopedHouses} from './domain.mjs';
import {portraitAttachment} from './community.mjs';
import {canViewHousehold,canViewTenantContacts} from './household-access.mjs';
export const localDay=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const allowedRoles=['sindico','proprietario','imobiliaria'];
function fail(message,status=400){throw Object.assign(Error(message),{status});}
function date(value,optional=false){if(optional&&!value)return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Informe uma data válida.');return value;}
function field(value,label,max=120){const text=String(value||'').trim();if(text.length<3||text.length>max)throw Error(label+' deve ter entre 3 e '+max+' caracteres.');return text;}
function optionalField(value,label,max){if(value!=null&&typeof value!=='string')fail(label+' inválido.');const text=(value||'').trim();if(text.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))fail(label+' inválido.');return text;}
function phone(value){const digits=optionalField(value,'Telefone',30).replace(/[\s()+.-]/g,'');if(digits&&!/^\d{10,15}$/.test(digits))fail('Informe telefone com DDI e DDD, somente números.');return digits;}
function authorize(state,user,houseId,kind){if(!(can(user,'residents')||allowedRoles.includes(user.role))||!scopedHouses(state,user).some(h=>h.id===houseId))throw Error('Sem permissão para esta casa.');if(kind==='owner'&&!can(user,'residents'))throw Error('Somente a gestão registra ou altera proprietários.');}
function safeHistory(history,contactsVisible){return (history||[]).map(entry=>{if(!entry.before)return {...entry};const {photo,history:ignored,contact,phone,whatsapp,email,...before}=entry.before;return {...entry,before:{...before,photo:contactsVisible&&!!photo,...(contactsVisible?{contact,phone,whatsapp,email}:{})}};});}
export function residentView(state,user,record,now=Date.now()){
 const contactsVisible=record.kind==='owner'||canViewTenantContacts(state,user,record.houseId,now);
 const {photo,history,contact,phone,whatsapp,email,...basic}=record;
 return {...basic,version:record.version||1,contactsVisible,photo:contactsVisible&&!!photo,...(contactsVisible?{contact:contact||'',phone:phone||'',whatsapp:whatsapp||'',email:email||''}:{}),...(can(user,'residents')?{history:safeHistory(history,contactsVisible)}:{})};
}
export function visibleResidents(state,user,now=Date.now()){
 if(!(can(user,'residents')||allowedRoles.includes(user.role)||user.role==='zelador'))return [];
 return (state.residents||[]).filter(r=>r.tenant===user.tenant&&canViewHousehold(state,user,r.houseId,now)&&(can(user,'residents')||!r.endedOn)).map(r=>residentView(state,user,r,now));
}
function values(input,current){
 if(!['owner','annual'].includes(input.kind))throw Error('Selecione proprietário ou locação anual.');
 const contractEndDate=input.kind==='annual'?date(input.contractEndDate,true):null,contractReference=input.kind==='annual'&&input.contractReference?field(input.contractReference,'Referência do contrato',100):null;
 const name=field(input.name,'Nome'),contact=optionalField(input.contact,'Contato',200),startDate=date(input.startDate),plannedEndDate=date(input.plannedEndDate,true);
 if(contractEndDate&&contractEndDate<startDate)throw Error('O fim do contrato não pode ser anterior ao início.');if(plannedEndDate&&plannedEndDate<startDate)throw Error('A saída prevista não pode ser anterior à entrada.');
 const people=[...new Set((Array.isArray(input.people)?input.people:[]).map(x=>String(x).trim()).filter(Boolean))],vehicles=[...new Set((Array.isArray(input.vehicles)?input.vehicles:[]).map(x=>String(x).trim().toUpperCase()).filter(Boolean))];
 if(people.length>30||people.some(p=>p.length<3||p.length>120))throw Error('Informe até 30 moradores, com nomes entre 3 e 120 caracteres.');if(vehicles.length>10||vehicles.some(p=>p.length>20))throw Error('Informe até 10 placas, com até 20 caracteres.');
 if(input.kind==='annual'&&!people.some(p=>p.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))throw Error('Inclua o titular na relação de moradores.');
 const ownerOccupancy=input.kind==='owner'?(input.ownerOccupancy??'unspecified'):null;if(ownerOccupancy!==null&&!['resident','rented','unspecified'].includes(ownerOccupancy))fail('Selecione se o proprietário mora no local ou aluga a casa.');
 const email=optionalField(input.email,'E-mail',200);if(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))fail('Informe um e-mail válido.');
 if(input.photo!==undefined&&input.photo!==null&&typeof input.photo!=='string'&&typeof input.photo!=='boolean')fail('Foto inválida.');
 const photo=input.photo===null?null:typeof input.photo==='string'&&input.photo?portraitAttachment(input.photo):current?.photo||null;
 return {kind:input.kind,name,contact,phone:phone(input.phone),whatsapp:phone(input.whatsapp),email,ownerOccupancy,startDate,plannedEndDate,contractEndDate,contractReference,people:input.kind==='annual'?people:[],vehicles,photo};
}
const privateFields=['contact','phone','whatsapp','email','photo'];
function protectedInput(state,user,input,current,now){
 if((current?.kind||input.kind)!=='annual'||canViewTenantContacts(state,user,current?.houseId||input.houseId,now))return input;
 for(const key of privateFields)if(!(key==='photo'&&typeof input[key]==='boolean')&&input[key]!==undefined&&input[key]!==null&&input[key]!==''&&input[key]!==current?.[key])fail('Os contatos e a foto do inquilino só podem ser alterados pelo síndico ou pelo proprietário desta casa.',403);
 // A redacted or older client cannot erase private fields it never received.
 return {...input,...Object.fromEntries(privateFields.map(key=>[key,key==='photo'?undefined:current?.[key]??'']))};
}
function audit(state,user,record,action,now){state.audit??=[];state.audit.unshift({id:randomUUID(),tenant:user.tenant,actor:user.name,action,resource:record.id,at:new Date(now).toISOString()});}
export function createResident(state,user,input,now=Date.now()){
 authorize(state,user,input.houseId,input.kind);const data=values(protectedInput(state,user,input,null,now));state.residents??=[];
 if(state.residents.some(r=>r.tenant===user.tenant&&r.houseId===input.houseId&&!r.endedOn&&r.kind===data.kind&&r.name.toLocaleLowerCase('pt-BR')===data.name.toLocaleLowerCase('pt-BR')))throw Error('Já existe um vínculo aberto com esse nome e tipo nesta casa.');
 const record={id:randomUUID(),tenant:user.tenant,houseId:input.houseId,...data,version:1,endedOn:null,endReason:null,createdAt:new Date(now).toISOString(),history:[]};state.residents.push(record);audit(state,user,record,'Vínculo residencial cadastrado',now);return {record};
}
export function updateResident(state,user,input,now=Date.now()){
 const record=(state.residents||[]).find(r=>r.id===input.id&&r.tenant===user.tenant);if(!record)throw Error('Vínculo indisponível.');authorize(state,user,record.houseId,record.kind);if(record.endedOn)throw Error('Este vínculo já foi encerrado. O histórico foi preservado.');
 if(input.houseId&&input.houseId!==record.houseId||input.kind&&input.kind!==record.kind)throw Error('Casa e tipo de vínculo não podem ser transferidos por esta ação.');
 if(input.version!==undefined&&(!Number.isInteger(input.version)||input.version!==(record.version||1)))fail('O cadastro mudou. Atualize antes de salvar.',409);
 const reason=field(input.reason,'Motivo',500),nextInput={...input,kind:record.kind};
 for(const key of ['contractReference','contractEndDate','contact','phone','whatsapp','email','ownerOccupancy'])if(nextInput[key]===undefined)nextInput[key]=record[key];
 const data=values(protectedInput(state,user,nextInput,record,now),record);
 if((state.residents||[]).some(r=>r.id!==record.id&&r.tenant===record.tenant&&r.houseId===record.houseId&&!r.endedOn&&r.kind===data.kind&&r.name.toLocaleLowerCase('pt-BR')===data.name.toLocaleLowerCase('pt-BR')))throw Error('Já existe um vínculo aberto com esse nome e tipo nesta casa.');
 const {history,photo,...snapshot}=record;history.push({at:new Date(now).toISOString(),actor:user.name,reason,before:{...snapshot,photo:!!photo}});Object.assign(record,data,{version:(record.version||1)+1});audit(state,user,record,'Vínculo residencial atualizado',now);return {record};
}
export function endResident(state,user,input,now=Date.now()){
 const record=(state.residents||[]).find(r=>r.id===input.id&&r.tenant===user.tenant);if(!record)throw Error('Vínculo indisponível.');authorize(state,user,record.houseId,record.kind);if(record.endedOn)throw Error('Este vínculo já foi encerrado.');
 const endedOn=date(input.endedOn),reason=field(input.reason,'Motivo',500);if(endedOn<record.startDate||endedOn>localDay(now))throw Error('A saída efetiva deve estar entre a entrada e hoje. Use a saída prevista para uma data futura.');record.endedOn=endedOn;record.endReason=reason;record.version=(record.version||1)+1;record.history.push({at:new Date(now).toISOString(),actor:user.name,reason,action:'Encerramento'});audit(state,user,record,'Vínculo residencial encerrado',now);return {record};
}
export function readResidentPhoto(state,user,id,version,now=Date.now()){
 const record=(state.residents||[]).find(r=>r.id===id&&r.tenant===user.tenant);
 if(!record||!canViewHousehold(state,user,record.houseId,now)||record.kind==='annual'&&!canViewTenantContacts(state,user,record.houseId,now)||!record.photo||String(version)!==String(record.version||1))fail('Foto indisponível.',404);
 return {mime:record.photo.mime,bytes:Buffer.from(record.photo.data,'base64')};
}
