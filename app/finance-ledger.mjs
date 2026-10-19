import {randomUUID} from 'node:crypto';
import {can} from './permissions.mjs';
import {localDay} from './residents.mjs';
export const canReadFinance=u=>['financeRead','finance','financeClose','financeExport'].some(m=>can(u,m));
export const requireFinance=(u,module)=>{if(!can(u,module))throw Error('Ação financeira fora da delegação desta conta.');};
export function text(v,label,max=160){if(typeof v!=='string'||v.trim().length<3||v.trim().length>max)throw Error(`${label}: use entre 3 e ${max} caracteres.`);return v.trim();}
export function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00Z'))||new Date(v+'T12:00Z').toISOString().slice(0,10)!==v)throw Error('Informe uma data válida.');return v;}
export function amount(v,zero=false){if(!Number.isSafeInteger(v)||v<0||(!zero&&v===0)||v>100000000)throw Error('Valor em centavos deve estar entre R$ 0,01 e R$ 1.000.000,00 (saldo inicial também pode ser zero).');return v;}
export const rows=(s,key,tenant)=>(s[key]||[]).filter(r=>r.tenant===tenant);
export const revision=(s,tenant)=>rows(s,'financialRevisions',tenant)[0]?.version||0;
export function bump(s,tenant){s.financialRevisions??=[];let r=s.financialRevisions.find(r=>r.tenant===tenant);if(!r){r={tenant,version:0};s.financialRevisions.push(r);}r.version++;}
export function lastClosedMonth(s,tenant){return rows(s,'financialClosures',tenant).filter(c=>c.status==='closed').map(c=>c.month).sort().at(-1)||null;}
export function openDate(s,u,value,now){const d=date(value);if(d>localDay(now))throw Error('Lançamentos não podem ter data futura.');const last=lastClosedMonth(s,u.tenant);if(last&&d.slice(0,7)<=last)throw Error('Período encerrado. Use um período aberto ou solicite reabertura ao síndico.');return d;}
export function ledger(s,tenant){
 const initial=rows(s,'financialAccounts',tenant).filter(a=>a.openingCents>0).map(a=>({id:a.id+':opening',tenant,kind:'opening',date:a.openingOn,description:'Saldo inicial · '+a.name,category:'Saldo inicial',reference:'Saldo inicial · '+a.name,amountCents:a.openingCents,postings:[{accountId:a.id,fundId:a.openingFundId,amountCents:a.openingCents}],createdBy:a.createdBy,createdByName:a.createdByName,at:a.createdAt,version:1}));
 return [...initial,...rows(s,'financialEntries',tenant)];
}
export function balance(s,tenant,accountId=null,fundId=null,through='9999-12-31'){
 return ledger(s,tenant).filter(e=>e.date<=through).reduce((sum,e)=>sum+e.postings.filter(p=>(!accountId||p.accountId===accountId)&&(!fundId||p.fundId===fundId)).reduce((n,p)=>n+p.amountCents,0),0);
}
export function activeAccount(s,u,id){const a=rows(s,'financialAccounts',u.tenant).find(a=>a.id===id&&a.active);if(!a)throw Error('Selecione uma conta financeira ativa deste condomínio.');return a;}
export function activeFund(s,u,id){const f=rows(s,'financialFunds',u.tenant).find(f=>f.id===id&&f.active);if(!f)throw Error('Selecione um fundo ativo deste condomínio.');return f;}
function normalized(v){return v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');}
export function createFund(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const name=text(input.name,'Nome'),purpose=text(input.purpose,'Finalidade',500);
 if(rows(s,'financialFunds',u.tenant).some(f=>normalized(f.name)===normalized(name)))throw Error('Fundo já cadastrado.');
 const f={id:randomUUID(),tenant:u.tenant,name,purpose,active:true,version:1,history:[{at:new Date(now).toISOString(),actor:u.name,action:'Fundo criado'}]};s.financialFunds??=[];s.financialFunds.push(f);bump(s,u.tenant);return structuredClone(f);
}
export function createAccount(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const name=text(input.name,'Nome'),openingOn=openDate(s,u,input.openingOn,now),openingCents=amount(input.openingCents,true),reason=text(input.reason,'Origem do saldo inicial',500);
 if(!['bank','cash'].includes(input.kind))throw Error('Escolha conta bancária ou caixa.');const fund=activeFund(s,u,input.fundId);
 if(rows(s,'financialAccounts',u.tenant).some(a=>normalized(a.name)===normalized(name)))throw Error('Conta já cadastrada.');if(balance(s,u.tenant)+openingCents>1000000000000)throw Error('Limite de saldo do piloto excedido.');
 const a={id:randomUUID(),tenant:u.tenant,name,kind:input.kind,openingOn,openingCents,openingFundId:fund.id,createdBy:u.id,createdByName:u.name,createdAt:new Date(now).toISOString(),active:true,version:1,history:[{at:new Date(now).toISOString(),actor:u.name,action:'Saldo inicial registrado',reason}]};s.financialAccounts??=[];s.financialAccounts.push(a);bump(s,u.tenant);return structuredClone(a);
}
export function toggleFinancial(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');if(!['account','fund'].includes(input.kind))throw Error('Cadastro financeiro inválido.');
 const list=rows(s,input.kind==='account'?'financialAccounts':'financialFunds',u.tenant),r=list.find(r=>r.id===input.id);if(!r)throw Error('Cadastro indisponível.');
 if(!Number.isInteger(input.version)||input.version!==r.version)throw Error('Cadastro mudou. Atualize antes de continuar.');const reason=text(input.reason,'Motivo',500);if(typeof input.active!=='boolean'||input.active===r.active)throw Error('Alteração inválida.');
 if(!input.active){if(balance(s,u.tenant,input.kind==='account'?r.id:null,input.kind==='fund'?r.id:null)!==0)throw Error('Zere o saldo antes de inativar.');if(input.kind==='fund'&&['financialPayables','financialReceivables'].some(key=>rows(s,key,u.tenant).some(p=>p.fundId===r.id&&['open','partial'].includes(p.status))))throw Error('Fundo possui compromissos ou contas a receber em aberto.');if(input.kind==='fund'&&rows(s,'financialAssessments',u.tenant).some(a=>a.fundId===r.id&&a.status==='approved'))throw Error('Fundo possui rateio aprovado ainda não gerado.');}
 r.active=input.active;r.version++;r.history.push({at:new Date(now).toISOString(),actor:u.name,action:(r.active?'Reativado':'Inativado')+' · '+reason});bump(s,u.tenant);return structuredClone(r);
}
function checkHistory(s,u,tx){
 const cells=new Map();for(const p of tx.postings)cells.set(p.accountId+':'+p.fundId,{accountId:p.accountId,fundId:p.fundId});
 for(const {accountId,fundId} of cells.values()){
  const dates=new Map();for(const e of [...ledger(s,u.tenant),tx])for(const p of e.postings)if(p.accountId===accountId&&p.fundId===fundId)dates.set(e.date,(dates.get(e.date)||0)+p.amountCents);
  let value=0;for(const [,delta] of [...dates].sort(([a],[b])=>a.localeCompare(b))){value+=delta;if(!Number.isSafeInteger(value)||value<0||value>1000000000000)throw Error('Saldo insuficiente na conta/fundo ou em uma data afetada pelo lançamento.');}
 }
 const total=balance(s,u.tenant)+tx.postings.reduce((n,p)=>n+p.amountCents,0);if(total>1000000000000)throw Error('Limite de saldo do piloto excedido.');
}
export function post(s,u,tx,versions,now){
 if(typeof tx.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tx.operationId))throw Error('Identificador da operação inválido.');
 if(rows(s,'financialEntries',u.tenant).some(e=>e.operationId===tx.operationId))throw Error('Operação já registrada. Atualize o financeiro.');
 const accounts=[...new Set(tx.postings.map(p=>p.accountId))].map(id=>activeAccount(s,u,id));
 if(!Array.isArray(versions)||versions.length!==accounts.length||new Set(versions.map(v=>v.id)).size!==accounts.length||accounts.some(a=>!versions.some(v=>v.id===a.id&&Number.isInteger(v.version)&&v.version===a.version)))throw Error('A conta mudou. Atualize o financeiro antes de continuar.');
 for(const p of tx.postings){activeFund(s,u,p.fundId);if(!Number.isSafeInteger(p.amountCents)||Math.abs(p.amountCents)>100000000||p.amountCents===0)throw Error('Lançamento monetário inválido.');}
 for(const a of accounts){if(tx.date<a.openingOn)throw Error('Lançamento anterior ao saldo inicial da conta.');if(rows(s,'financialEntries',u.tenant).some(e=>normalized(e.reference)===normalized(tx.reference)&&e.postings.some(p=>p.accountId===a.id)))throw Error('Referência já registrada nesta conta.');}
 checkHistory(s,u,tx);
 const record={...tx,id:randomUUID(),tenant:u.tenant,version:1,createdBy:u.id,createdByName:u.name,at:new Date(now).toISOString()};
 s.financialEntries??=[];s.financialEntries.push(record);for(const a of accounts)a.version++;bump(s,u.tenant);return structuredClone(record);
}
export function createEntry(s,u,input,now=Date.now()){
 const control=input.kind==='adjustment';requireFinance(u,control?'financeClose':'finance');
 if(!['income','expense','adjustment'].includes(input.kind))throw Error('Tipo de lançamento inválido.');if(input.purchaseId||input.payableId||input.receivableId)throw Error('Use contas a pagar ou a receber para registrar uma baixa vinculada.');
 const on=openDate(s,u,input.date,now),value=amount(input.amountCents),description=text(input.description,'Descrição'),category=text(input.category,'Categoria'),reference=text(input.reference,'Referência'),reason=text(input.reason,'Observação',500);
 if(control&&!['credit','debit'].includes(input.direction))throw Error('Escolha crédito ou débito do ajuste.');const sign=input.kind==='expense'||control&&input.direction==='debit'?-1:1;
 return post(s,u,{operationId:input.operationId,kind:input.kind,date:on,description,category,reference,reason,amountCents:value,postings:[{accountId:input.accountId,fundId:input.fundId,amountCents:sign*value}]},[{id:input.accountId,version:input.accountVersion}],now);
}
export function transfer(s,u,input,now=Date.now()){
 const allocation=input.kind==='fundTransfer';requireFinance(u,allocation?'financeClose':'finance');if(!['transfer','fundTransfer'].includes(input.kind))throw Error('Transferência inválida.');
 const on=openDate(s,u,input.date,now),value=amount(input.amountCents),description=text(input.description,'Descrição'),reference=text(input.reference,'Referência'),reason=text(input.reason,'Justificativa',500);
 const targetAccountId=allocation?input.accountId:input.targetAccountId,targetFundId=allocation?input.targetFundId:input.fundId;
 if(allocation?input.fundId===targetFundId:input.accountId===targetAccountId)throw Error('Selecione origem e destino diferentes.');
 const versions=[{id:input.accountId,version:input.accountVersion},...(!allocation?[{id:targetAccountId,version:input.targetAccountVersion}]:[])];
 return post(s,u,{operationId:input.operationId,kind:input.kind,date:on,description,reference,reason,category:allocation?'Realocação entre fundos':'Transferência entre contas',amountCents:value,postings:[{accountId:input.accountId,fundId:input.fundId,amountCents:-value},{accountId:targetAccountId,fundId:targetFundId,amountCents:value}]},versions,now);
}
