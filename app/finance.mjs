import {randomUUID,createHash} from 'node:crypto';
import {can} from './permissions.mjs';
import {localDay} from './residents.mjs';
import {canReadFinance,requireFinance,text,date,rows,revision,bump,lastClosedMonth,openDate,ledger,balance,post} from './finance-ledger.mjs';
import {purchaseSources,payablesAt} from './finance-payables.mjs';
import {receivablesAt} from './finance-receivables.mjs';
import {budgetComparison} from './finance-budget.mjs';
import {financialUnits,unissuedAssessments,assessmentsAt} from './finance-assessments.mjs';
export {createFund,createAccount,toggleFinancial,createEntry,transfer} from './finance-ledger.mjs';
export {createPayable,importPurchase,payPayable,changePayable,editPayable} from './finance-payables.mjs';
export {createReceivable,receiveReceivable,changeReceivable,editReceivable} from './finance-receivables.mjs';
export {saveBudget} from './finance-budget.mjs';
export {saveAssessment,approveAssessment,cancelAssessment,generateAssessment} from './finance-assessments.mjs';
export function financeView(s,u,now=Date.now()){
 if(!canReadFinance(u))return null;
 const accounts=rows(s,'financialAccounts',u.tenant).map(a=>({...structuredClone(a),balanceCents:balance(s,u.tenant,a.id)}));
 const funds=rows(s,'financialFunds',u.tenant).map(f=>({...structuredClone(f),balanceCents:balance(s,u.tenant,null,f.id)}));
 const allocations=accounts.flatMap(a=>funds.map(f=>({accountId:a.id,fundId:f.id,balanceCents:balance(s,u.tenant,a.id,f.id)})));
 return {revision:revision(s,u.tenant),lastClosedMonth:lastClosedMonth(s,u.tenant),accounts,funds,allocations,entries:structuredClone(ledger(s,u.tenant)),payables:structuredClone(rows(s,'financialPayables',u.tenant)),receivables:structuredClone(rows(s,'financialReceivables',u.tenant)),budgets:structuredClone(rows(s,'financialBudgets',u.tenant)),units:financialUnits(s,u),assessments:structuredClone(rows(s,'financialAssessments',u.tenant)),purchaseSources:purchaseSources(s,u),closures:rows(s,'financialClosures',u.tenant).map(({report,...c})=>structuredClone(c)),totalCents:balance(s,u.tenant),today:localDay(now)};
}
export function reverseEntry(s,u,input,now=Date.now()){
 const original=rows(s,'financialEntries',u.tenant).find(e=>e.id===input.id);
 if(!original||!['income','expense','transfer','fundTransfer','adjustment'].includes(original.kind))throw Error('Lançamento indisponível para estorno.');
 requireFinance(u,['fundTransfer','adjustment'].includes(original.kind)?'financeClose':'finance');
 if(!Number.isInteger(input.version)||input.version!==original.version||original.reversalId)throw Error('Lançamento já estornado ou versão desatualizada.');
 const on=openDate(s,u,input.date,now);if(on<original.date)throw Error('Estorno anterior ao lançamento original.');const reason=text(input.reason,'Motivo do estorno',500),reference=text(input.reference,'Referência do estorno');
 const reversal=post(s,u,{operationId:input.operationId,kind:'reversal',date:on,description:'Estorno · '+original.description,category:'Estorno',reference,reason,amountCents:original.amountCents,reversalOf:original.id,payableId:original.payableId||null,receivableId:original.receivableId||null,purchaseId:original.purchaseId||null,postings:original.postings.map(p=>({...p,amountCents:-p.amountCents}))},input.accountVersions,now);
 original.reversalId=reversal.id;original.version++;
 if(original.payableId){const p=rows(s,'financialPayables',u.tenant).find(p=>p.id===original.payableId);p.status='open';p.paymentEntryId=null;p.version++;p.events.push({date:on,kind:'open',reason});p.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Saída estornada; compromisso reaberto',entryId:reversal.id,reason});}
 if(original.receivableId){const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===original.receivableId);r.status='open';r.receiptEntryId=null;r.version++;r.events.push({date:on,kind:'open',reason});r.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Entrada estornada; conta a receber reaberta',entryId:reversal.id,reason});}
 return reversal;
}
function monthRange(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}$/.test(value))throw Object.assign(Error('Informe um mês válido.'),{status:400});let from;try{from=date(value+'-01');}catch{throw Object.assign(Error('Informe um mês válido.'),{status:400});}const next=new Date(from+'T12:00Z');next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);return {from,through:next.toISOString().slice(0,10)};
}
const totals=()=>({openingCents:0,initialCents:0,incomeCents:0,expenseCents:0,transferInCents:0,transferOutCents:0,adjustmentCents:0,reversalCents:0,closingCents:0});
export function buildReport(s,u,month){
 if(!canReadFinance(u))throw Object.assign(Error('Relatório financeiro indisponível.'),{status:403});
 const {from,through}=monthRange(month),accounts=rows(s,'financialAccounts',u.tenant).filter(a=>a.openingOn<=through),funds=rows(s,'financialFunds',u.tenant),entries=ledger(s,u.tenant).filter(e=>e.date<=through);
 const allocations=accounts.flatMap(a=>funds.map(f=>({accountId:a.id,account:a.name,fundId:f.id,fund:f.name,...totals()})));
 for(const row of allocations)for(const e of entries)for(const p of e.postings)if(p.accountId===row.accountId&&p.fundId===row.fundId){
  row.closingCents+=p.amountCents;
  if(e.date<from)row.openingCents+=p.amountCents;
  else if(e.kind==='opening')row.initialCents+=p.amountCents;
  else if(e.kind==='income')row.incomeCents+=p.amountCents;
  else if(e.kind==='expense')row.expenseCents-=p.amountCents;
  else if(['transfer','fundTransfer'].includes(e.kind))row[p.amountCents>0?'transferInCents':'transferOutCents']+=Math.abs(p.amountCents);
  else if(e.kind==='adjustment')row.adjustmentCents+=p.amountCents;
  else if(e.kind==='reversal')row.reversalCents+=p.amountCents;
 }
 function aggregate(key,record){return {...record,...allocations.filter(r=>r[key]===record.id).reduce((sum,r)=>{for(const k of Object.keys(sum))sum[k]+=r[k];return sum;},totals())};}
 const summary=allocations.reduce((sum,r)=>{for(const k of Object.keys(sum))sum[k]+=r[k];return sum;},totals());
 const commitments=payablesAt(s,u.tenant,through),outstanding=commitments.filter(p=>p.status==='open');
 const unregisteredPurchases=purchaseSources(s,u).filter(p=>p.receivedOn<=through&&!rows(s,'financialPayables',u.tenant).some(x=>x.purchaseId===p.id&&x.issuedOn<=through));
 const receivables=receivablesAt(s,u.tenant,through),receivableOutstanding=receivables.filter(r=>r.status==='open'),budget=budgetComparison(s,u.tenant,month);
 return {month,from,through,revision:revision(s,u.tenant),summary,accounts:accounts.map(a=>aggregate('accountId',{id:a.id,name:a.name})),funds:funds.map(f=>aggregate('fundId',{id:f.id,name:f.name})),allocations,entries:structuredClone(entries.filter(e=>e.date>=from)),outstanding,commitments,unregisteredPurchases,receivables,receivableOutstanding,budget,assessments:assessmentsAt(s,u.tenant,through,receivables),unissuedAssessments:unissuedAssessments(s,u.tenant,through)};
}
export function financialReport(s,u,month){
 if(!canReadFinance(u))throw Object.assign(Error('Relatório financeiro indisponível.'),{status:403});
 const closure=rows(s,'financialClosures',u.tenant).findLast(c=>c.month===month&&c.status==='closed');
 if(closure){if(createHash('sha256').update(JSON.stringify(closure.report)).digest('hex')!==closure.sha256)throw Object.assign(Error('Integridade do fechamento não confirmada.'),{status:500});return {report:structuredClone(closure.report),closed:true,closureId:closure.id,sha256:closure.sha256};}
 return {report:buildReport(s,u,month),closed:!!lastClosedMonth(s,u.tenant)&&month<=lastClosedMonth(s,u.tenant)};
}
export function financialClosureReport(s,u,id){
 if(!canReadFinance(u))throw Object.assign(Error('Relatório financeiro indisponível.'),{status:403});
 const c=rows(s,'financialClosures',u.tenant).find(c=>c.id===id);if(!c)throw Object.assign(Error('Fechamento indisponível.'),{status:403});
 if(createHash('sha256').update(JSON.stringify(c.report)).digest('hex')!==c.sha256)throw Object.assign(Error('Integridade do fechamento não confirmada.'),{status:500});
 return {report:structuredClone(c.report),closed:c.status==='closed',archived:true,closureId:c.id,sha256:c.sha256};
}
export function closeMonth(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');if(!Number.isInteger(input.revision)||input.revision!==revision(s,u.tenant))throw Error('O financeiro mudou. Atualize o relatório antes de fechar.');
 const {through}=monthRange(input.month),current=localDay(now).slice(0,7);if(input.month>=current)throw Error('Feche somente meses já encerrados no calendário.');
 const last=lastClosedMonth(s,u.tenant);if(!last){const first=rows(s,'financialClosures',u.tenant).map(c=>c.month).sort()[0];if(first&&input.month!==first)throw Error('Reencerre primeiro o mês reaberto.');}if(last){const next=new Date(last+'-01T12:00Z');next.setUTCMonth(next.getUTCMonth()+1);if(input.month!==next.toISOString().slice(0,7))throw Error('Feche os meses em sequência após o último encerramento.');}
 if(!rows(s,'financialAccounts',u.tenant).some(a=>a.openingOn<=through))throw Error('Nenhuma conta cadastrada neste período.');
 const reason=text(input.reason,'Conferência do fechamento',500),report=buildReport(s,u,input.month);if(report.unregisteredPurchases.length)throw Error('Cadastre os compromissos das compras recebidas no período antes de fechar.');
 if(report.unissuedAssessments.length)throw Error('Gere ou cancele os rateios aprovados com emissão no período antes de fechar.');
 const record={id:randomUUID(),tenant:u.tenant,month:input.month,status:'closed',version:1,report,sha256:createHash('sha256').update(JSON.stringify(report)).digest('hex'),history:[{at:new Date(now).toISOString(),actor:u.name,action:'Mês encerrado',reason}]};s.financialClosures??=[];s.financialClosures.push(record);bump(s,u.tenant);return structuredClone(record);
}
export function reopenMonth(s,u,input,now=Date.now()){
 if(u.role!=='sindico')throw Error('Somente o síndico reabre fechamento.');const c=rows(s,'financialClosures',u.tenant).find(c=>c.id===input.id&&c.status==='closed');if(!c||c.month!==lastClosedMonth(s,u.tenant))throw Error('Reabra somente o último mês encerrado.');
 if(!Number.isInteger(input.version)||input.version!==c.version||input.revision!==revision(s,u.tenant))throw Error('Fechamento desatualizado. Atualize o financeiro.');const reason=text(input.reason,'Motivo da reabertura',500);
 c.status='reopened';c.version++;c.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Mês reaberto',reason});bump(s,u.tenant);return {id:c.id,status:c.status};
}
