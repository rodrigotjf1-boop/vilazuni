import {can} from './permissions.mjs';

const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const inHouse=(state,user,houseId)=>!!user&&state.houses.some(h=>h.tenant===user.tenant&&h.id===houseId);
const ownHouse=(state,user,houseId)=>inHouse(state,user,houseId)&&user.role==='proprietario'&&user.houses?.includes(houseId);
const activeGrant=(g,user,now)=>g.tenant===user.tenant&&g.userId===user.id&&!g.revokedAt&&g.expiresOn>=day(now);
export function authorizedCaretakerHouses(state,user,now=Date.now()){
 if(user?.role!=='zelador'||!user.id)return [];
 return [...new Set((state.householdContactGrants||[]).filter(g=>activeGrant(g,user,now)&&inHouse(state,user,g.houseId)).map(g=>g.houseId))];
}
export function canAuthorizeCaretakerContacts(state,user,houseId){return inHouse(state,user,houseId)&&(user.role==='sindico'||ownHouse(state,user,houseId));}
export function canViewTenantContacts(state,user,houseId,now=Date.now()){
 return inHouse(state,user,houseId)&&(user.role==='sindico'||ownHouse(state,user,houseId)||authorizedCaretakerHouses(state,user,now).includes(houseId));
}
export function canViewHousehold(state,user,houseId,now=Date.now()){
 return inHouse(state,user,houseId)&&(can(user,'residents')||can(user,'stays')||['proprietario','imobiliaria','ocupante','temporario'].includes(user.role)&&user.houses?.includes(houseId)||authorizedCaretakerHouses(state,user,now).includes(houseId));
}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Informe uma validade real para a autorização.',400);return value;}
function reason(value){if(typeof value!=='string'||value.trim().length<3||value.trim().length>500)fail('Informe o motivo da autorização (3 a 500 caracteres).',400);return value.trim();}
function audit(state,user,grant,action,now){state.audit??=[];state.audit.unshift({id:crypto.randomUUID(),tenant:user.tenant,actor:user.name,actorId:user.id,action,resource:grant.id,at:new Date(now).toISOString()});}
const view=(g,users,now)=>({id:g.id,houseId:g.houseId,userId:g.userId,name:users.find(u=>u.id===g.userId&&u.tenant===g.tenant)?.name||'Zelador',expiresOn:g.expiresOn,active:!g.revokedAt&&g.expiresOn>=day(now),revokedAt:g.revokedAt||null,reason:g.reason,createdAt:g.createdAt});
export function caregiverContactGrants(state,users,user,houseId,now=Date.now()){
 if(!canViewHousehold(state,user,houseId,now))fail('Casa fora do seu acesso.');
 const canAuthorize=canAuthorizeCaretakerContacts(state,user,houseId);
 return {canAuthorize,grants:(state.householdContactGrants||[]).filter(g=>g.tenant===user.tenant&&g.houseId===houseId&&(canAuthorize||g.userId===user.id)).map(g=>view(g,users,now)),caretakers:canAuthorize?users.filter(u=>u.tenant===user.tenant&&u.role==='zelador'&&u.active!==false&&(!u.validUntil||Date.parse(u.validUntil)>now)).map(({id,name})=>({id,name})):[]};
}
export function grantCaretakerContacts(state,users,user,input,now=Date.now()){
 if(!canAuthorizeCaretakerContacts(state,user,input.houseId))fail('Somente o síndico ou o proprietário desta casa autoriza a zeladoria.');
 const caretaker=users.find(u=>u.id===input.userId&&u.tenant===user.tenant&&u.role==='zelador'&&u.active!==false&&(!u.validUntil||Date.parse(u.validUntil)>now));
 if(!caretaker)fail('Selecione um zelador ativo deste condomínio.',400);
 const expiresOn=date(input.expiresOn),justification=reason(input.reason);
 if(expiresOn<day(now))fail('A validade da autorização deve ser hoje ou uma data futura.',400);
 state.householdContactGrants??=[];
 for(const previous of state.householdContactGrants.filter(g=>g.tenant===user.tenant&&g.houseId===input.houseId&&g.userId===caretaker.id&&!g.revokedAt))previous.revokedAt=new Date(now).toISOString();
 const grant={id:crypto.randomUUID(),tenant:user.tenant,houseId:input.houseId,userId:caretaker.id,expiresOn,reason:justification,createdBy:user.id,createdAt:new Date(now).toISOString(),revokedAt:null};state.householdContactGrants.push(grant);
 audit(state,user,grant,'Zeladoria autorizada a consultar contatos de inquilinos desta casa',now);return {grant:view(grant,users,now)};
}
export function revokeCaretakerContacts(state,user,input,now=Date.now()){
 const grant=(state.householdContactGrants||[]).find(g=>g.id===input.id&&g.tenant===user.tenant);
 if(!grant||!canAuthorizeCaretakerContacts(state,user,grant.houseId))fail('Autorização fora do seu acesso.');
 const justification=reason(input.reason);if(grant.revokedAt)fail('Esta autorização já foi revogada.',409);
 grant.revokedAt=new Date(now).toISOString();grant.revokedBy=user.id;grant.revokeReason=justification;
 audit(state,user,grant,'Autorização da zeladoria para contatos revogada',now);return {revoked:true};
}
// All stay payloads, including operation responses, must pass through this projection.
export function householdStayView(state,user,stay,now=Date.now()){
 const {contact,phone,whatsapp,email,photo,history,...basic}=stay,contactsVisible=canViewTenantContacts(state,user,stay.houseId,now);
 return {...basic,contactsVisible,...(contactsVisible?{contact:contact||'',phone:phone||'',whatsapp:whatsapp||'',email:email||''}:{}),photo:contactsVisible&&!!photo,version:stay.version||1};
}
