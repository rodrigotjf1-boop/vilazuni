import {DELEGATIONS,DELEGATED_ROLES,ROLES} from './permissions.mjs';
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
function reason(v){if(typeof v!=='string'||v.trim().length<3||v.trim().length>500)throw Error('Informe a justificativa da delegação (3 a 500 caracteres).');return v.trim();}
function modules(input){if(!Array.isArray(input)||input.some(m=>!Object.hasOwn(DELEGATIONS,m)))throw Error('Selecione somente módulos disponíveis.');return [...new Set(input)];}
export function prepareBinding(state,issuer,input,now=Date.now()){
 if(issuer.role!=='sindico')throw Error('Somente o síndico concede vínculos e delegações.');
 if(!ROLES.includes(input.role)||input.role==='sindico')throw Error('Perfil não disponível para convite.');
 const ids=[...new Set(Array.isArray(input.houses)?input.houses:[])];if(ids.some(id=>!state.houses.some(h=>h.id===id&&h.tenant===issuer.tenant)))throw Error('Casa fora do condomínio.');
 const validUntil=input.validUntil||null;if(validUntil&&(typeof validUntil!=='string'||!Number.isFinite(Date.parse(validUntil))||Date.parse(validUntil)<=now))throw Error('Informe validade futura.');
 const delegated=DELEGATED_ROLES.includes(input.role);
 if((delegated||['imobiliaria','ocupante'].includes(input.role))&&!validUntil)throw Error('Defina a validade deste vínculo.');
 let houses=[],residentId=null,delegations=[],delegationReason=null;
 if(delegated){delegations=modules(input.delegations);if(!delegations.length)throw Error('Selecione ao menos um módulo delegado.');delegationReason=reason(input.delegationReason);}
 if(['proprietario','imobiliaria'].includes(input.role)){if(!ids.length)throw Error('Selecione ao menos uma casa.');houses=ids;}
 if(input.role==='ocupante'){
  const r=(state.residents||[]).find(r=>r.id===input.residentId&&r.tenant===issuer.tenant&&r.kind==='annual'&&!r.endedOn&&r.startDate<=day(now));if(!r)throw Error('Selecione um vínculo residencial anual vigente.');
  if(ids.some(id=>id!==r.houseId))throw Error('O ocupante só pode acessar a casa do vínculo.');houses=[r.houseId];residentId=r.id;
 }
 return {role:input.role,houses,validUntil,residentId,delegations,delegationReason,delegatedBy:delegated?issuer.id:null,accessVersion:0};
}
export function validBinding(state,user,now=Date.now()){
 if(!user?.active||user.validUntil&&(!Number.isFinite(Date.parse(user.validUntil))||Date.parse(user.validUntil)<=now))return false;
 if(DELEGATED_ROLES.includes(user.role)&&(!user.validUntil||!Number.isFinite(Date.parse(user.validUntil))||!Array.isArray(user.delegations)||!user.delegations.length))return false;
 if(user.role==='ocupante')return !!user.validUntil&&(state.residents||[]).some(r=>r.id===user.residentId&&r.tenant===user.tenant&&r.kind==='annual'&&!r.endedOn&&r.startDate<=day(now)&&user.houses?.length===1&&user.houses[0]===r.houseId);
 return true;
}
export function reviseDelegation(state,users,issuer,input,now=Date.now()){
 if(issuer.role!=='sindico')throw Error('Somente o síndico altera delegações.');const target=users.find(u=>u.id===input.id&&u.tenant===issuer.tenant&&DELEGATED_ROLES.includes(u.role)&&u.active);if(!target)throw Error('Conta delegada indisponível.');
 if(!Number.isInteger(input.version)||input.version!==(target.accessVersion||0))throw Error('A delegação mudou. Atualize a conta antes de continuar.');
 const next=prepareBinding(state,issuer,{...input,role:target.role},now);Object.assign(target,next,{accessVersion:(target.accessVersion||0)+1});return target;
}
