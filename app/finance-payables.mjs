import {randomUUID} from 'node:crypto';
import {localDay} from './residents.mjs';
import {requireFinance,canReadFinance,text,date,amount,rows,bump,openDate,activeFund,post,ledger} from './finance-ledger.mjs';
import {isOutstanding,settlementPosition,lastSettlementDate,syncSettlement} from './finance-settlements.mjs';
const normalize=v=>v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
export function purchaseSources(s,u){
 if(!canReadFinance(u))return [];
 return rows(s,'purchases',u.tenant).filter(p=>p.status==='received').map(p=>({id:p.id,version:p.version,title:p.title,supplierId:p.approval.quote.supplierId,creditor:p.approval.quote.supplierName,amountCents:p.approval.quote.totalCents,receivedOn:localDay(Date.parse(p.receipt.at)),reference:p.receipt.reference,payableId:rows(s,'financialPayables',u.tenant).find(x=>x.purchaseId===p.id)?.id||null}));
}
function make(s,u,input,source,now){
 requireFinance(u,'finance');const issuedOn=openDate(s,u,input.issuedOn,now),dueOn=date(input.dueOn),fund=activeFund(s,u,input.fundId),category=text(input.category,'Categoria');
 if(dueOn<issuedOn)throw Error('Vencimento deve ser igual ou posterior à emissão.');
 const creditor=source?.creditor||text(input.creditor,'Credor'),reference=source?.reference||text(input.reference,'Documento / referência'),description=source?.title||text(input.description,'Descrição'),value=amount(source?.amountCents??input.amountCents);
 if(source&&issuedOn<source.receivedOn)throw Error('Emissão anterior ao recebimento da compra.');
 if(rows(s,'financialPayables',u.tenant).some(p=>source&&p.purchaseId===source.id||normalize(p.creditor)===normalize(creditor)&&normalize(p.reference)===normalize(reference)))throw Error('Compromisso já registrado. Reabra o registro existente se necessário.');
 const p={id:randomUUID(),tenant:u.tenant,version:1,purchaseId:source?.id||null,creditor,reference,description,amountCents:value,fundId:fund.id,fundName:fund.name,category,issuedOn,dueOn,status:'open',terms:[{date:issuedOn,fundId:fund.id,fundName:fund.name,dueOn,category}],events:[{date:issuedOn,kind:'open'}],history:[{at:new Date(now).toISOString(),actor:u.name,action:'Compromisso registrado'}]};s.financialPayables??=[];s.financialPayables.push(p);bump(s,u.tenant);return structuredClone(p);
}
export function createPayable(s,u,input,now=Date.now()){if(input.purchaseId)throw Error('Use a importação da compra recebida.');return make(s,u,input,null,now);}
export function importPurchase(s,u,input,now=Date.now()){
 requireFinance(u,'finance');const source=purchaseSources(s,u).find(p=>p.id===input.purchaseId);
 if(!source)throw Error('Compra recebida indisponível.');if(!Number.isInteger(input.purchaseVersion)||input.purchaseVersion!==source.version)throw Error('A compra mudou. Atualize antes de importar.');
 return make(s,u,{...input,issuedOn:source.receivedOn},source,now);
}
function editable(s,u,input){requireFinance(u,'finance');const p=rows(s,'financialPayables',u.tenant).find(p=>p.id===input.id);if(!p)throw Error('Compromisso indisponível.');if(!Number.isInteger(input.version)||input.version!==p.version)throw Error('O compromisso mudou. Atualize antes de continuar.');return p;}
export function payPayable(s,u,input,now=Date.now()){return recordPayment(s,u,input,now,false);}
export function payPayablePartial(s,u,input,now=Date.now()){return recordPayment(s,u,input,now,true);}
function recordPayment(s,u,input,now,partial){
 const p=editable(s,u,input),position=settlementPosition(s,u.tenant,'payable',p);if(!isOutstanding(position))throw Error('Compromisso não está em aberto.');const on=openDate(s,u,input.date,now);if(on<lastSettlementDate(s,u.tenant,'payable',p))throw Error('Data anterior à emissão, reabertura ou última alteração do compromisso.');
 const value=partial?amount(input.amountCents):position.remainingCents;if(value>position.remainingCents)throw Error('Saída excede o saldo restante do compromisso.');
 const reference=text(input.reference,'Referência da saída'),reason=text(input.reason,'Conferência da saída manual',500);
 const entry=post(s,u,{operationId:input.operationId,kind:'expense',date:on,description:p.description,category:p.category,reference,reason,amountCents:value,payableId:p.id,purchaseId:p.purchaseId,postings:[{accountId:input.accountId,fundId:p.fundId,amountCents:-value}]},[{id:input.accountId,version:input.accountVersion}],now);
 syncSettlement(s,u.tenant,'payable',p);p.version++;p.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Saída manual registrada',amountCents:value,entryId:entry.id,reason});return {payable:structuredClone(p),entry};
}
export function changePayable(s,u,input,now=Date.now()){
 const p=editable(s,u,input),today=openDate(s,u,localDay(now),now),reason=text(input.reason,'Motivo',500);
 if(settlementPosition(s,u.tenant,'payable',p).settledCents>0)throw Error('Estorne as baixas antes de cancelar o compromisso.');
 if(!['cancelled','open'].includes(input.status)||!(p.status==='open'&&input.status==='cancelled'||p.status==='cancelled'&&input.status==='open'))throw Error('Alteração de compromisso inválida.');
 if(input.status==='open')activeFund(s,u,p.fundId);
 p.status=input.status;p.version++;p.events.push({date:today,kind:input.status,reason});p.history.push({at:new Date(now).toISOString(),actor:u.name,action:input.status==='open'?'Compromisso reaberto':'Compromisso cancelado',reason});bump(s,u.tenant);return structuredClone(p);
}
export function editPayable(s,u,input,now=Date.now()){
 const p=editable(s,u,input);if(!isOutstanding(p))throw Error('Somente compromisso aberto pode ser atualizado.');const on=openDate(s,u,localDay(now),now),fund=activeFund(s,u,input.fundId),dueOn=date(input.dueOn),category=text(input.category,'Categoria'),reason=text(input.reason,'Motivo',500);
 if(dueOn<p.issuedOn)throw Error('Vencimento anterior à emissão.');
 const before={fundId:p.fundId,fundName:p.fundName,dueOn:p.dueOn,category:p.category};Object.assign(p,{fundId:fund.id,fundName:fund.name,dueOn,category,version:p.version+1});p.terms.push({date:on,fundId:fund.id,fundName:fund.name,dueOn,category});p.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Compromisso atualizado',reason,before});bump(s,u.tenant);return structuredClone(p);
}
export function payablesAt(s,tenant,through){
 return rows(s,'financialPayables',tenant).filter(p=>p.issuedOn<=through).map(p=>{
  const terms=p.terms.filter(t=>t.date<=through).at(-1),event=p.events.filter(e=>e.date<=through).at(-1);const cancelled=event?.kind==='cancelled';
  const position=settlementPosition(s,tenant,'payable',p,through);
  return {id:p.id,purchaseId:p.purchaseId,description:p.description,creditor:p.creditor,fundId:terms.fundId,amountCents:p.amountCents,dueOn:terms.dueOn,...position,paidCents:position.settledCents,statusReason:cancelled?event.reason||null:null};
 });
}
