import {DELEGATIONS,DELEGATED_ROLES,ROLES} from './permissions.mjs';
import {accessPeriod,contractEndInstant} from './access-periods.mjs';
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
function reason(v){if(typeof v!=='string'||v.trim().length<3||v.trim().length>500)throw Error('Informe a justificativa da delegação (3 a 500 caracteres).');return v.trim();}
function modules(input){if(!Array.isArray(input)||input.some(m=>!Object.hasOwn(DELEGATIONS,m)))throw Error('Selecione somente módulos disponíveis.');return [...new Set(input)];}
export function prepareBinding(state,issuer,input,now=Date.now()){
 if(issuer.role!=='sindico')throw Error('Somente o síndico concede vínculos e delegações.');
 if(!ROLES.includes(input.role)||input.role==='sindico')throw Error('Perfil não disponível para convite.');
 const ids=[...new Set(Array.isArray(input.houses)?input.houses:[])];if(ids.some(id=>!state.houses.some(h=>h.id===id&&h.tenant===issuer.tenant)))throw Error('Casa fora do condomínio.');
 let validUntil=input.validUntil||null;if(validUntil&&(typeof validUntil!=='string'||!Number.isFinite(Date.parse(validUntil))||Date.parse(validUntil)<=now))throw Error('Informe validade futura.');
 const delegated=DELEGATED_ROLES.includes(input.role);
 if((delegated||input.role==='imobiliaria')&&!validUntil)throw Error('Defina a validade deste vínculo.');
 let houses=[],residentId=null,stayId=null,delegations=[],delegationReason=null,purchaseLimitCents=null;
 if(delegated){delegations=modules(input.delegations);if(!delegations.length)throw Error('Selecione ao menos um módulo delegado.');delegationReason=reason(input.delegationReason);}
 if(delegations.includes('purchaseApproval')){if(!Number.isSafeInteger(input.purchaseLimitCents)||input.purchaseLimitCents<1||input.purchaseLimitCents>100000000)throw Error('Defina o limite de aprovação em centavos (até R$ 1.000.000,00).');purchaseLimitCents=input.purchaseLimitCents;}
 if(['proprietario','imobiliaria'].includes(input.role)){if(!ids.length)throw Error('Selecione ao menos uma casa.');houses=ids;}
 if(input.role==='ocupante'){
  const r=(state.residents||[]).find(r=>r.id===input.residentId&&r.tenant===issuer.tenant&&r.kind==='annual'&&!r.endedOn&&r.startDate<=day(now));if(!r)throw Error('Selecione um vínculo residencial anual vigente.');
  if(ids.some(id=>id!==r.houseId))throw Error('O ocupante só pode acessar a casa do vínculo.');houses=[r.houseId];residentId=r.id;
  const end=contractEndInstant(r.contractEndDate);if(!end||Date.parse(end)<=now)throw Error('Informe um contrato residencial com término vigente antes de conceder acesso.');
  if(validUntil&&Date.parse(validUntil)>Date.parse(end))throw Error('O acesso não pode ultrapassar o fim do contrato.');validUntil||=end;
 }
 if(input.role==='temporario'){
  const stay=(state.stays||[]).find(s=>s.id===input.stayId&&s.tenant===issuer.tenant&&s.status==='approved'&&Date.parse(s.end)>now);
  if(!stay)throw Error('Selecione uma estadia aprovada que ainda não terminou.');
  if(ids.some(id=>id!==stay.houseId))throw Error('O temporário só pode acessar a unidade da estadia.');
  if(validUntil&&Date.parse(validUntil)>Date.parse(stay.end))throw Error('O acesso não pode ultrapassar a saída da estadia.');
  houses=[stay.houseId];stayId=stay.id;validUntil||=stay.end;
 }
 return {role:input.role,houses,validUntil,residentId,stayId,delegations,delegationReason,purchaseLimitCents,delegatedBy:delegated?issuer.id:null,accessVersion:0};
}
export function validBinding(state,user,now=Date.now()){
 if(!user?.active||user.validUntil&&(!Number.isFinite(Date.parse(user.validUntil))||Date.parse(user.validUntil)<=now))return false;
 if(DELEGATED_ROLES.includes(user.role)&&(!user.validUntil||!Number.isFinite(Date.parse(user.validUntil))||!Array.isArray(user.delegations)||!user.delegations.length))return false;
 const period=accessPeriod(state,user);if(period.start&&(!Number.isFinite(Date.parse(period.start))||Date.parse(period.start)>now)||period.end&&(!Number.isFinite(Date.parse(period.end))||Date.parse(period.end)<=now))return false;
 if(user.role==='ocupante')return !!user.validUntil&&(state.residents||[]).some(r=>r.id===user.residentId&&r.tenant===user.tenant&&r.kind==='annual'&&!r.endedOn&&r.startDate<=day(now)&&user.houses?.length===1&&user.houses[0]===r.houseId);
 if(user.role==='temporario')return !!user.validUntil&&(state.stays||[]).some(s=>s.id===user.stayId&&s.tenant===user.tenant&&s.status==='approved'&&Date.parse(s.start)<=now&&now<Date.parse(s.end)&&user.houses?.length===1&&user.houses[0]===s.houseId);
 return true;
}
export function reviseResidentialAccess(state,users,issuer,input,now=Date.now()){
 if(issuer.role!=='sindico')throw Error('Somente o síndico altera os vínculos de acesso.');
 const target=users.find(u=>u.id===input.id&&u.tenant===issuer.tenant&&['proprietario','imobiliaria','ocupante','temporario','zelador','portaria'].includes(u.role));
 if(!target||input.version!==(target.accessVersion||0))throw Error('O vínculo mudou. Atualize antes de continuar.');
 const justification=reason(input.reason),next=prepareBinding(state,issuer,{...input,role:target.role},now);
 Object.assign(target,next,{active:true,accessVersion:(target.accessVersion||0)+1});return {...target,accessReason:justification};
}
export function reviseDelegation(state,users,issuer,input,now=Date.now()){
 if(issuer.role!=='sindico')throw Error('Somente o síndico altera delegações.');const target=users.find(u=>u.id===input.id&&u.tenant===issuer.tenant&&DELEGATED_ROLES.includes(u.role)&&u.active);if(!target)throw Error('Conta delegada indisponível.');
 if(!Number.isInteger(input.version)||input.version!==(target.accessVersion||0))throw Error('A delegação mudou. Atualize a conta antes de continuar.');
 const next=prepareBinding(state,issuer,{...input,role:target.role},now);Object.assign(target,next,{accessVersion:(target.accessVersion||0)+1});return target;
}
