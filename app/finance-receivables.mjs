import {randomUUID} from 'node:crypto';
import {localDay} from './residents.mjs';
import {requireFinance,text,date,amount,rows,bump,openDate,activeFund,post,ledger} from './finance-ledger.mjs';

const normalize=v=>v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
export function createReceivable(s,u,input,now=Date.now()){
 requireFinance(u,'finance');
 if(input.assessmentId||input.houseId||input.competence)throw Error('Use a geração do rateio aprovado para vincular contribuições por unidade.');
 const issuedOn=openDate(s,u,input.issuedOn,now),dueOn=date(input.dueOn),fund=activeFund(s,u,input.fundId);
 const debtor=text(input.debtor,'Pagador'),reference=text(input.reference,'Documento / referência'),description=text(input.description,'Descrição'),category=text(input.category,'Categoria'),value=amount(input.amountCents);
 if(dueOn<issuedOn)throw Error('Vencimento deve ser igual ou posterior à emissão.');
 if(rows(s,'financialReceivables',u.tenant).some(r=>normalize(r.debtor)===normalize(debtor)&&normalize(r.reference)===normalize(reference)))throw Error('Conta a receber já registrada. Reabra o registro existente se necessário.');
 const r={id:randomUUID(),tenant:u.tenant,version:1,debtor,reference,description,category,amountCents:value,fundId:fund.id,fundName:fund.name,issuedOn,dueOn,status:'open',terms:[{date:issuedOn,fundId:fund.id,fundName:fund.name,dueOn,category}],events:[{date:issuedOn,kind:'open'}],history:[{at:new Date(now).toISOString(),actor:u.name,action:'Conta a receber registrada'}]};
 s.financialReceivables??=[];s.financialReceivables.push(r);bump(s,u.tenant);return structuredClone(r);
}
function editable(s,u,input){
 requireFinance(u,'finance');const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===input.id);
 if(!r)throw Error('Conta a receber indisponível.');
 if(!Number.isInteger(input.version)||input.version!==r.version)throw Error('A conta a receber mudou. Atualize antes de continuar.');return r;
}
export function receiveReceivable(s,u,input,now=Date.now()){
 const r=editable(s,u,input);if(r.status!=='open')throw Error('Conta a receber não está em aberto.');
 const on=openDate(s,u,input.date,now);
 if(on<r.issuedOn||on<r.events.at(-1).date||on<r.terms.at(-1).date)throw Error('Data anterior à emissão, reabertura ou última alteração da conta a receber.');
 const reference=text(input.reference,'Referência da entrada'),reason=text(input.reason,'Conferência da entrada manual',500);
 const entry=post(s,u,{operationId:input.operationId,kind:'income',date:on,description:r.description,category:r.category,reference,reason,amountCents:r.amountCents,receivableId:r.id,postings:[{accountId:input.accountId,fundId:r.fundId,amountCents:r.amountCents}]},[{id:input.accountId,version:input.accountVersion}],now);
 r.status='received';r.receiptEntryId=entry.id;r.version++;r.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Entrada manual registrada',entryId:entry.id,reason});return {receivable:structuredClone(r),entry};
}
export function changeReceivable(s,u,input,now=Date.now()){
 const r=editable(s,u,input),today=openDate(s,u,localDay(now),now),reason=text(input.reason,'Motivo',500);
 if(!['cancelled','open'].includes(input.status)||!(r.status==='open'&&input.status==='cancelled'||r.status==='cancelled'&&input.status==='open'))throw Error('Alteração da conta a receber inválida.');
 if(input.status==='open')activeFund(s,u,r.fundId);
 r.status=input.status;r.version++;r.events.push({date:today,kind:input.status,reason});r.history.push({at:new Date(now).toISOString(),actor:u.name,action:input.status==='open'?'Conta a receber reaberta':'Conta a receber cancelada',reason});bump(s,u.tenant);return structuredClone(r);
}
export function editReceivable(s,u,input,now=Date.now()){
 const r=editable(s,u,input);if(r.status!=='open')throw Error('Somente conta a receber aberta pode ser atualizada.');
 const on=openDate(s,u,localDay(now),now),fund=activeFund(s,u,input.fundId),dueOn=date(input.dueOn),category=text(input.category,'Categoria'),reason=text(input.reason,'Motivo',500);
 if(dueOn<r.issuedOn)throw Error('Vencimento anterior à emissão.');
 const before={fundId:r.fundId,fundName:r.fundName,dueOn:r.dueOn,category:r.category};
 Object.assign(r,{fundId:fund.id,fundName:fund.name,dueOn,category,version:r.version+1});r.terms.push({date:on,fundId:fund.id,fundName:fund.name,dueOn,category});r.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Conta a receber atualizada',reason,before});bump(s,u.tenant);return structuredClone(r);
}
export function receivablesAt(s,tenant,through){
 const entries=ledger(s,tenant).filter(e=>e.date<=through);
 return rows(s,'financialReceivables',tenant).filter(r=>r.issuedOn<=through).map(r=>{
  const terms=r.terms.filter(t=>t.date<=through).at(-1),event=r.events.filter(e=>e.date<=through).at(-1),cancelled=event?.kind==='cancelled';
  const receivedCents=entries.filter(e=>e.receivableId===r.id).reduce((sum,e)=>sum+e.postings.reduce((n,p)=>n+p.amountCents,0),0);
  return {id:r.id,description:r.description,reference:r.reference,debtor:r.debtor,fundId:terms.fundId,category:terms.category,amountCents:r.amountCents,dueOn:terms.dueOn,assessmentId:r.assessmentId||null,houseId:r.houseId||null,houseNumber:r.houseNumber||null,competence:r.competence||null,status:cancelled?'cancelled':receivedCents===r.amountCents?'received':'open',receivedCents,statusReason:cancelled?event.reason||null:null};
 });
}
