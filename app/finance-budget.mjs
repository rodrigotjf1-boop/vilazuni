import {randomUUID} from 'node:crypto';
import {requireFinance,text,date,amount,rows,bump,lastClosedMonth,activeFund,ledger} from './finance-ledger.mjs';

const normalized=v=>v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
function monthValue(month){date(month+'-01');return month;}
const key=(fundId,kind,category)=>JSON.stringify([fundId,kind,normalized(category)]);
export function saveBudget(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const month=monthValue(input.month),last=lastClosedMonth(s,u.tenant);
 if(last&&month<=last)throw Error('Período encerrado. Reabra antes de revisar o orçamento.');
 if(!['income','expense'].includes(input.kind))throw Error('Orçamento aceita somente receita ou despesa.');
 const fund=activeFund(s,u,input.fundId),category=text(input.category,'Categoria'),plannedCents=amount(input.plannedCents,true),reason=text(input.reason,'Justificativa da previsão',500);
 const identity=key(fund.id,input.kind,category),existing=rows(s,'financialBudgets',u.tenant).find(b=>b.month===month&&key(b.fundId,b.kind,b.category)===identity);
 const history={at:new Date(now).toISOString(),actor:u.name,action:input.id?'Previsão revisada':'Previsão registrada',plannedCents,reason};
 if(input.id){
  if(!existing||existing.id!==input.id)throw Error('Previsão indisponível. Mês, fundo, tipo e categoria não podem ser trocados.');
  if(!Number.isInteger(input.version)||input.version!==existing.version)throw Error('O orçamento mudou. Atualize antes de continuar.');
  existing.plannedCents=plannedCents;existing.version++;existing.history.push(history);bump(s,u.tenant);return structuredClone(existing);
 }
 if(existing)throw Error('Já existe previsão para este mês, fundo, tipo e categoria. Revise o registro existente.');
 const record={id:randomUUID(),tenant:u.tenant,month,fundId:fund.id,fundName:fund.name,kind:input.kind,category,plannedCents,version:1,history:[history]};
 s.financialBudgets??=[];s.financialBudgets.push(record);bump(s,u.tenant);return structuredClone(record);
}
export function budgetComparison(s,tenant,month){
 monthValue(month);const grouped=new Map(),entries=ledger(s,tenant),byId=new Map(entries.map(e=>[e.id,e]));
 function group(fundId,kind,category){
  const id=key(fundId,kind,category);if(!grouped.has(id))grouped.set(id,{fundId,fund:rows(s,'financialFunds',tenant).find(f=>f.id===fundId)?.name||fundId,kind,category,hasBudget:false,plannedCents:0,actualCents:0});return grouped.get(id);
 }
 for(const b of rows(s,'financialBudgets',tenant).filter(b=>b.month===month))Object.assign(group(b.fundId,b.kind,b.category),{budgetId:b.id,version:b.version,category:b.category,hasBudget:true,plannedCents:b.plannedCents,history:structuredClone(b.history)});
 for(const e of entries.filter(e=>e.date.slice(0,7)===month)){
  const source=e.kind==='reversal'?byId.get(e.reversalOf):e;
  if(!source||!['income','expense'].includes(source.kind))continue;
  for(const p of e.postings)group(p.fundId,source.kind,source.category).actualCents+=(source.kind==='income'?1:-1)*p.amountCents;
 }
 const result=[...grouped.values()].map(r=>({...r,varianceCents:r.actualCents-r.plannedCents})).sort((a,b)=>a.fund.localeCompare(b.fund)||a.kind.localeCompare(b.kind)||a.category.localeCompare(b.category));
 const totals=Object.fromEntries(['income','expense'].map(kind=>[kind,result.filter(r=>r.kind===kind).reduce((total,r)=>({plannedCents:total.plannedCents+r.plannedCents,actualCents:total.actualCents+r.actualCents,varianceCents:total.varianceCents+r.varianceCents}),{plannedCents:0,actualCents:0,varianceCents:0})]));
 return {basis:'cash-net-reversals-on-date',rows:result,totals};
}
