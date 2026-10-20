import {randomUUID} from 'node:crypto';
import {localDay} from './residents.mjs';
import {requireFinance,text,date,rows,bump,openDate,activeFund} from './finance-ledger.mjs';
import {createReceivable} from './finance-receivables.mjs';
import {isOutstanding,settlementPosition,syncSettlement} from './finance-settlements.mjs';
import {collectionHeld,payerLink,requireUnbilledDate} from './finance-collection-policy.mjs';
const normalize=v=>v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
const audit=(u,action,reason,now)=>({at:new Date(now).toISOString(),actor:u.name,actorId:u.id,action,reason});
function record(s,u,input,module){
 requireFinance(u,module);const a=rows(s,'financialAgreements',u.tenant).find(a=>a.id===input.id);if(!a)throw Error('Acordo indisponível.');
 if(!Number.isInteger(input.version)||input.version!==a.version)throw Error('O acordo mudou. Atualize antes de continuar.');return a;
}
function source(s,u,id,version){
 const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===id);if(!r)throw Error('Conta de origem indisponível.');
 if(!Number.isInteger(version)||version!==r.version)throw Error('A origem mudou. Cancele a proposta e prepare outra com o saldo atual.');
 const position=settlementPosition(s,u.tenant,'receivable',r);
 if(collectionHeld(s,u.tenant,r.id))throw Error('Resolva a suspensão ou contestação antes de renegociar a origem.');
 if(!isOutstanding(position)||r.agreementId||r.feeSourceId)throw Error('Acordo exige saldo aberto de conta original, sem outro acordo ativo ou encargo derivado.');activeFund(s,u,r.fundId);return {r,position};
}
function schedule(first,count,total,reference){
 const day=Number(first.slice(8)),base=Math.floor(total/count),extra=total%count;
 if(base<1)throw Error('Cada parcela deve ter pelo menos R$ 0,01.');
 return Array.from({length:count},(_,i)=>{
  const end=new Date(first+'T12:00Z');end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+i+1);end.setUTCDate(0);
  const dueOn=date(end.toISOString().slice(0,7)+'-'+String(Math.min(day,end.getUTCDate())).padStart(2,'0'));
  return {number:i+1,dueOn,amountCents:base+(i<extra?1:0),reference:reference+' · parcela '+String(i+1).padStart(2,'0')};
 });
}
export function createAgreement(s,u,input,now=Date.now()){
 requireFinance(u,'finance');const today=openDate(s,u,localDay(now),now),{r,position}=source(s,u,input.sourceId,input.sourceVersion),reference=text(input.reference,'Referência do acordo',80),terms=text(input.terms,'Condições informadas',500),reason=text(input.reason,'Justificativa',500),firstDueOn=date(input.firstDueOn);
 if(firstDueOn<today)throw Error('Primeiro vencimento deve ser hoje ou uma data futura.');
 if(!Number.isInteger(input.count)||input.count<2||input.count>36)throw Error('Informe de 2 a 36 parcelas mensais.');
 if(rows(s,'financialAgreements',u.tenant).some(a=>normalize(a.reference)===normalize(reference)))throw Error('Referência de acordo já registrada, inclusive se cancelado.');
 if(rows(s,'financialAgreements',u.tenant).some(a=>a.sourceId===r.id&&a.status!=='cancelled'))throw Error('Já existe proposta ou acordo para esta origem. Cancele o anterior antes de continuar.');
 const a={id:randomUUID(),tenant:u.tenant,version:1,status:'draft',reference,terms,sourceId:r.id,sourceVersion:r.version,sourceDescription:r.description,debtor:r.debtor,fundId:r.fundId,fundName:r.fundName,category:r.category,principalCents:position.remainingCents,proposedOn:today,count:input.count,firstDueOn,installments:schedule(firstDueOn,input.count,position.remainingCents,reference),history:[audit(u,'Proposta de parcelamento registrada',reason,now)]};
 s.financialAgreements??=[];s.financialAgreements.push(a);bump(s,u.tenant);return structuredClone(a);
}
export function approveAgreement(s,u,input,now=Date.now()){
 const a=record(s,u,input,'financeClose');if(a.status!=='draft')throw Error('Aprove somente proposta de acordo.');openDate(s,u,localDay(now),now);const {position}=source(s,u,a.sourceId,a.sourceVersion);
 if(position.remainingCents!==a.principalCents||a.firstDueOn<localDay(now))throw Error('Saldo ou vencimentos mudaram. Prepare uma nova proposta.');
 const reason=text(input.reason,'Conferência do acordo',500);a.status='approved';a.version++;a.approval={by:u.id,byName:u.name,at:new Date(now).toISOString(),reason};a.history.push(audit(u,'Parcelamento conferido e aprovado',reason,now));bump(s,u.tenant);return structuredClone(a);
}
export function activateAgreement(s,u,input,now=Date.now()){
 const a=record(s,u,input,'finance');if(a.status!=='approved')throw Error('Ative somente acordo aprovado e ainda não gerado.');const today=openDate(s,u,localDay(now),now),{r,position}=source(s,u,a.sourceId,a.sourceVersion),reason=text(input.reason,'Conferência da ativação',500);
 requireUnbilledDate(s,u.tenant,r.id,today);
 if(position.remainingCents!==a.principalCents||a.firstDueOn<today)throw Error('Saldo ou vencimentos mudaram. Prepare uma nova proposta.');
 if(typeof input.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId))throw Error('Identificador da operação inválido.');
 if(rows(s,'financialAgreements',u.tenant).some(x=>x.activation?.operationId===input.operationId))throw Error('Ativação já registrada.');
 const next=structuredClone(s),agreement=rows(next,'financialAgreements',u.tenant).find(x=>x.id===a.id),original=rows(next,'financialReceivables',u.tenant).find(x=>x.id===r.id);
 for(const installment of agreement.installments){
  const child=createReceivable(next,u,{description:'Acordo '+a.reference+' · parcela '+installment.number,debtor:a.debtor,reference:installment.reference,amountCents:installment.amountCents,fundId:a.fundId,category:a.category,issuedOn:today,dueOn:installment.dueOn},now);
  const saved=next.financialReceivables.find(x=>x.id===child.id);Object.assign(saved,{agreementId:a.id,installmentNumber:installment.number,sourceReceivableId:r.id,assessmentId:r.assessmentId||null,houseId:r.houseId||null,houseNumber:r.houseNumber||null,competence:r.competence||null});installment.receivableId=child.id;
  const link=payerLink(next,u.tenant,r.id);if(link?.payerUserId){next.financialPayerLinks??=[];next.financialPayerLinks.push({id:randomUUID(),tenant:u.tenant,receivableId:child.id,payerUserId:link.payerUserId,payerName:link.payerName,version:1,history:[audit(u,'Pagador explícito preservado da origem do acordo',reason,now)]});}
 }
 original.events.push({date:today,kind:'renegotiated',agreementId:a.id,reason});original.version++;syncSettlement(next,u.tenant,'receivable',original);original.history.push(audit(u,'Saldo transferido para o acordo '+a.reference,reason,now));
 agreement.status='active';agreement.version++;agreement.activatedOn=today;agreement.activation={by:u.id,byName:u.name,at:new Date(now).toISOString(),operationId:input.operationId,reason};agreement.history.push(audit(u,'Parcelas geradas e saldo de origem transferido',reason,now));bump(next,u.tenant);
 s.financialReceivables=next.financialReceivables;s.financialPayerLinks=next.financialPayerLinks||s.financialPayerLinks;s.financialAgreements=next.financialAgreements;s.financialRevisions=next.financialRevisions;return structuredClone(agreement);
}
export function cancelAgreement(s,u,input,now=Date.now()){
 const a=record(s,u,input,'financeClose');if(a.status==='cancelled')throw Error('Acordo já cancelado.');const today=openDate(s,u,localDay(now),now),reason=text(input.reason,'Motivo do cancelamento',500);
 const next=structuredClone(s),agreement=rows(next,'financialAgreements',u.tenant).find(x=>x.id===a.id);
 if(a.status==='active'){
  const children=a.installments.map(i=>rows(next,'financialReceivables',u.tenant).find(r=>r.id===i.receivableId));
  if(children.some(r=>!r||settlementPosition(next,u.tenant,'receivable',r).settledCents!==0))throw Error('Estorne todas as baixas das parcelas antes de cancelar o acordo.');
  if(rows(next,'financialFeeAccruals',u.tenant).some(f=>f.status==='active'&&children.some(r=>r.id===f.sourceId)))throw Error('Cancele as apurações de encargos das parcelas antes de cancelar o acordo.');
  const original=rows(next,'financialReceivables',u.tenant).find(r=>r.id===a.sourceId);if(original?.activeAgreementId!==a.id)throw Error('Origem do acordo inconsistente. Confira o histórico.');
  for(const r of children){r.events.push({date:today,kind:'cancelled',reason});r.version++;syncSettlement(next,u.tenant,'receivable',r);r.history.push(audit(u,'Parcela cancelada com o acordo',reason,now));}
  for(const q of rows(next,'financialManualRequests',u.tenant).filter(q=>!q.cancelledOn&&children.some(r=>r.id===q.receivableId))){q.cancelledOn=today;q.version++;q.history.push(audit(u,'Aviso cancelado com a parcela do acordo',reason,now));}
  original.events.push({date:today,kind:'open',reason});original.version++;syncSettlement(next,u.tenant,'receivable',original);original.history.push(audit(u,'Acordo cancelado; saldo de origem restaurado',reason,now));
 }
 agreement.status='cancelled';agreement.cancelledOn=today;agreement.version++;agreement.history.push(audit(u,'Acordo cancelado',reason,now));bump(next,u.tenant);
 s.financialReceivables=next.financialReceivables||s.financialReceivables;s.financialManualRequests=next.financialManualRequests||s.financialManualRequests;s.financialAgreements=next.financialAgreements;s.financialRevisions=next.financialRevisions;return structuredClone(agreement);
}
export function agreementView(s,tenant,a,through='9999-12-31'){
 const active=a.activatedOn&&a.activatedOn<=through,cancelled=a.cancelledOn&&a.cancelledOn<=through;
 const installments=a.installments.map(i=>{const r=rows(s,'financialReceivables',tenant).find(r=>r.id===i.receivableId);return {...structuredClone(i),...(active&&r?settlementPosition(s,tenant,'receivable',r,through):{status:'planned',settledCents:0,remainingCents:i.amountCents})};});
 const remainingCents=installments.reduce((n,i)=>n+i.remainingCents,0),settledCents=installments.reduce((n,i)=>n+i.settledCents,0);
 return {...structuredClone(a),status:cancelled?'cancelled':active?(remainingCents===0?'settled':'active'):a.status,installments,remainingCents,settledCents};
}
export function agreementsAt(s,tenant,through){return rows(s,'financialAgreements',tenant).filter(a=>a.activatedOn&&a.activatedOn<=through).map(a=>agreementView(s,tenant,a,through));}
