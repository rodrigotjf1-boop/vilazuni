import {randomUUID} from 'node:crypto';
import {canReadFinance,requireFinance,text,date,amount,rows,bump,lastClosedMonth,openDate,activeFund} from './finance-ledger.mjs';
import {createReceivable} from './finance-receivables.mjs';

const normalize=v=>v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
const unitOrder=(a,b)=>a.houseNumber.localeCompare(b.houseNumber,'pt-BR',{numeric:true})||a.houseId.localeCompare(b.houseId);
export function financialUnits(s,u){
 if(!canReadFinance(u))return [];
 return rows(s,'houses',u.tenant).filter(h=>h.active!==false).map(h=>({id:h.id,number:String(h.number)})).sort((a,b)=>a.number.localeCompare(b.number,'pt-BR',{numeric:true})||a.id.localeCompare(b.id));
}
function openCompetence(s,u,month){
 if(typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month))throw Error('Informe uma competência válida.');
 date(month+'-01');const last=lastClosedMonth(s,u.tenant);
 if(last&&month<=last)throw Error('Competência encerrada. Reabra o período antes de alterar ou gerar o rateio.');return month;
}
function allocate(totalCents,lines){
 const total=BigInt(totalCents),denominator=lines.reduce((n,l)=>n+BigInt(l.weight),0n);
 const portions=lines.map(l=>{const product=total*BigInt(l.weight);return {...l,amountCents:Number(product/denominator),remainder:product%denominator};});
 const remaining=totalCents-portions.reduce((n,l)=>n+l.amountCents,0);
 const priority=portions.slice().sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:unitOrder(a,b));
 for(let i=0;i<remaining;i++)priority[i].amountCents++;
 if(portions.some(l=>l.amountCents<1))throw Error('Cada unidade deve receber pelo menos R$ 0,01. Aumente o total ou revise os pesos/unidades.');
 return portions.map(({remainder,...l})=>l).sort(unitOrder);
}
function terms(s,u,input,now){
 const month=openCompetence(s,u,input.month),issuedOn=openDate(s,u,input.issuedOn,now),dueOn=date(input.dueOn),fund=activeFund(s,u,input.fundId);
 if(dueOn<issuedOn)throw Error('Vencimento deve ser igual ou posterior à emissão.');
 if(!['equal','weighted'].includes(input.method))throw Error('Escolha divisão igual ou por pesos inteiros.');
 const title=text(input.title,'Título',100),reference=text(input.reference,'Referência do rateio',100),category=text(input.category,'Categoria'),basis=text(input.basis,'Fundamento da distribuição',500),totalCents=amount(input.totalCents);
 if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>100||new Set(input.lines.map(l=>l?.houseId)).size!==input.lines.length)throw Error('Selecione de 1 a 100 unidades distintas.');
 const units=financialUnits(s,u),lines=input.lines.map(l=>{
  const unit=units.find(h=>h.id===l?.houseId);if(!unit||unit.number.length>40)throw Error('Selecione unidades ativas deste condomínio.');
  const debtor=text(l.debtor,'Pagador da unidade '+unit.number),weight=input.method==='equal'?1:l.weight;
  if(!Number.isInteger(weight)||weight<1||weight>1000000)throw Error('Peso deve ser um inteiro entre 1 e 1.000.000.');
  return {houseId:unit.id,houseNumber:unit.number,debtor,weight,reference:text(reference+' · '+unit.id,'Referência por unidade')};
 });
 return {month,issuedOn,dueOn,fundId:fund.id,fundName:fund.name,title,reference,category,basis,totalCents,method:input.method,lines:allocate(totalCents,lines)};
}
function record(s,u,input,module){
 requireFinance(u,module);const a=rows(s,'financialAssessments',u.tenant).find(a=>a.id===input.id);
 if(!a)throw Error('Rateio indisponível.');
 if(!Number.isInteger(input.version)||input.version!==a.version)throw Error('O rateio mudou. Atualize antes de continuar.');return a;
}
function history(u,action,reason,now){return {at:new Date(now).toISOString(),actor:u.name,actorId:u.id,action,reason};}
function validateFrozen(s,u,a,now){
 openCompetence(s,u,a.month);openDate(s,u,a.issuedOn,now);activeFund(s,u,a.fundId);
 const units=financialUnits(s,u);if(a.lines.some(l=>!units.some(h=>h.id===l.houseId&&h.number===l.houseNumber)))throw Error('As unidades mudaram. Cancele este rateio ou revise o rascunho antes de aprovar.');
}
export function saveAssessment(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const existing=input.id?record(s,u,input,'financeClose'):null;
 if(existing&&existing.status!=='draft')throw Error('Somente rascunho de rateio pode ser revisado.');
 const values=terms(s,u,input,now),reason=text(input.reason,'Justificativa do rateio',500);
 if(rows(s,'financialAssessments',u.tenant).some(a=>a.id!==existing?.id&&normalize(a.reference)===normalize(values.reference)))throw Error('Referência de rateio já registrada, inclusive se cancelado.');
 if(existing){const before=Object.fromEntries(Object.keys(values).map(k=>[k,structuredClone(existing[k])]));Object.assign(existing,values,{version:existing.version+1});existing.history.push({...history(u,'Rascunho revisado',reason,now),before});bump(s,u.tenant);return structuredClone(existing);}
 const a={id:randomUUID(),tenant:u.tenant,version:1,status:'draft',...values,history:[history(u,'Rascunho registrado',reason,now)]};s.financialAssessments??=[];s.financialAssessments.push(a);bump(s,u.tenant);return structuredClone(a);
}
export function approveAssessment(s,u,input,now=Date.now()){
 const a=record(s,u,input,'financeClose');if(a.status!=='draft')throw Error('Aprovação disponível somente para rascunho.');
 validateFrozen(s,u,a,now);const reason=text(input.reason,'Conferência e aprovação',500);
 a.status='approved';a.version++;a.approval={by:u.id,byName:u.name,at:new Date(now).toISOString(),reason};a.history.push(history(u,'Distribuição aprovada e congelada',reason,now));bump(s,u.tenant);return structuredClone(a);
}
export function cancelAssessment(s,u,input,now=Date.now()){
 const a=record(s,u,input,'financeClose');if(!['draft','approved'].includes(a.status))throw Error('Cancele somente rateio ainda não gerado. Após gerar, trate cada conta a receber.');
 const reason=text(input.reason,'Motivo do cancelamento',500);a.status='cancelled';a.version++;a.history.push(history(u,'Rateio cancelado sem gerar recebíveis',reason,now));bump(s,u.tenant);return structuredClone(a);
}
export function generateAssessment(s,u,input,now=Date.now()){
 const a=record(s,u,input,'finance');if(a.status!=='approved')throw Error('Gere somente rateio aprovado e ainda não emitido.');
 validateFrozen(s,u,a,now);const reason=text(input.reason,'Conferência da geração',500);
 if(typeof input.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId))throw Error('Identificador da operação inválido.');
 if(rows(s,'financialAssessments',u.tenant).some(r=>r.generation?.operationId===input.operationId))throw Error('Operação de geração já registrada.');
 // Build the complete batch separately: a collision on any unit must leave no partial receivables.
 const next=structuredClone(s),batch=rows(next,'financialAssessments',u.tenant).find(r=>r.id===a.id);
 for(const line of batch.lines){
  const receivable=createReceivable(next,u,{debtor:line.debtor,reference:line.reference,description:a.title+' · unidade '+line.houseNumber,category:a.category,amountCents:line.amountCents,fundId:a.fundId,issuedOn:a.issuedOn,dueOn:a.dueOn},now);
  const saved=next.financialReceivables.find(r=>r.id===receivable.id);Object.assign(saved,{assessmentId:a.id,houseId:line.houseId,houseNumber:line.houseNumber,competence:a.month});saved.history[0]={...history(u,'Contribuição gerada do rateio '+a.reference,reason,now)};line.receivableId=receivable.id;
 }
 batch.status='generated';batch.version++;batch.generation={operationId:input.operationId,by:u.id,byName:u.name,at:new Date(now).toISOString(),reason};batch.history.push(history(u,'Contas a receber geradas em lote',reason,now));bump(next,u.tenant);
 s.financialAssessments=next.financialAssessments;s.financialReceivables=next.financialReceivables;s.financialRevisions=next.financialRevisions;
 return {assessment:structuredClone(batch),receivableIds:batch.lines.map(l=>l.receivableId)};
}
export function unissuedAssessments(s,tenant,through){
 return rows(s,'financialAssessments',tenant).filter(a=>a.status==='approved'&&a.issuedOn<=through).map(a=>({id:a.id,title:a.title,reference:a.reference,month:a.month,issuedOn:a.issuedOn,totalCents:a.totalCents}));
}
export function assessmentsAt(s,tenant,through,receivables){
 return rows(s,'financialAssessments',tenant).filter(a=>a.status==='generated'&&a.issuedOn<=through).map(a=>{
  const lines=a.lines.map(l=>{const r=receivables.find(r=>r.id===l.receivableId);return {...structuredClone(l),status:r?.status||'open',receivedCents:r?.receivedCents||0};});
  return {id:a.id,title:a.title,reference:a.reference,month:a.month,issuedOn:a.issuedOn,dueOn:a.dueOn,fundId:a.fundId,fundName:a.fundName,category:a.category,basis:a.basis,totalCents:a.totalCents,method:a.method,approval:structuredClone(a.approval),lines};
 });
}
